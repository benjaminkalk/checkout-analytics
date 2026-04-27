/**
 * checkout-success.js — Part 2 of Vendor_CheckoutAnalytics
 *
 * PURPOSE:
 *   Runs on the checkout/success page. Loads the Adobe Commerce Storefront Events
 *   SDK and Collector from CDN, restores the cart snapshot written by
 *   place-order-mixin.js, sets all required MSE contexts, and fires
 *   mse.publish.placeOrder().
 *
 * INITIALIZATION:
 *   This is a plain AMD component initialized via x-magento-init in
 *   Vendor_CheckoutAnalytics::checkout-success.phtml, which is injected on the
 *   checkout_onepage_success layout handle. It receives (config, element) from
 *   Magento's component initializer — config is the {} object from the template,
 *   element is document.body (due to the "*" selector).
 *
 * SDK LOADING STRATEGY:
 *   The MSE SDK and Collector are vanilla IIFE bundles that attach to
 *   window.magentoStorefrontEvents. They are NOT AMD modules, so we inject them
 *   as sequential <script> tags and wait for each onload before proceeding,
 *   guaranteeing SDK → Collector execution order.
 */
define([
    'magentoStorefrontEvents',
    'magentoStorefrontEventCollector'
], function () {
    'use strict';

    /** Must match the key used in place-order-mixin.js */
    var STORAGE_KEY = 'mse_checkout_cart_data';

    /**
     * CDN URLs for the Adobe Commerce Storefront Events packages.
     * Pinned to major version 1 — receives patches without breaking changes.
     */
    var SDK_URL       = 'https://cdn.jsdelivr.net/npm/@adobe/magento-storefront-events-sdk@1/dist/index.js';
    var COLLECTOR_URL = 'https://cdn.jsdelivr.net/npm/@adobe/magento-storefront-events-collector@1/dist/index.js';

    /**
     * Inject a <script> tag into <head> and return a Promise that resolves
     * when the script has loaded, or rejects on error.
     *
     * Guards against double-loading if the component fires more than once.
     *
     * @param  {string} src  Absolute script URL
     * @return {Promise}
     */
    // function loadScript(src) {
    //     return new Promise(function (resolve, reject) {
    //         if (document.querySelector('script[src="' + src + '"]')) {
    //             // Already injected — resolve immediately.
    //             resolve();
    //             return;
    //         }
    //         var script     = document.createElement('script');
    //         script.src     = src;
    //         script.async   = false;  // preserve relative execution order
    //         script.onload  = resolve;
    //         script.onerror = function () {
    //             reject(new Error('[CheckoutAnalytics] Failed to load: ' + src));
    //         };
    //         document.head.appendChild(script);
    //     });
    // }

    /**
     * Load SDK then Collector. The Collector registers listeners on the SDK's
     * event bus so SDK MUST be fully executed before Collector runs.
     *
     * @return {Promise<Object>}  Resolves with window.magentoStorefrontEvents
     */
    // function loadMseStack() {
    //     return loadScript(SDK_URL)
    //         .then(function () {
    //             return loadScript(COLLECTOR_URL);
    //         })
    //         .then(function () {
    //             var mse = window.magentoStorefrontEvents;
    //             if (!mse) {
    //                 throw new Error('[CheckoutAnalytics] MSE SDK did not attach to window.magentoStorefrontEvents');
    //             }
    //             return mse;
    //         });
    // }

    /**
     * Read the cart snapshot written by place-order-mixin.js from localStorage.
     *
     * @return {Object|null}
     */
    function getPersistedCartData() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error('[CheckoutAnalytics] Could not parse persisted cart data:', e);
            return null;
        }
    }

    /**
     * Derive the order ID from the available sources, in priority order:
     *  1. window.checkoutConfig.orderId  (set by Magento_Checkout on success page)
     *  2. The "order ID" paragraph rendered by Magento_Checkout::success.phtml
     *     (.order-number strong is standard in Luma's success template)
     *
     * @return {string}
     */
    function getOrderId() {
        var cc = window.checkoutConfig || {};

        if (cc.orderId) {
            return String(cc.orderId);
        }

        // Luma's success.phtml renders something like:
        //   <p class="order-number">Your order # is: <strong>000000123</strong>.</p>
        var el = document.querySelector('.order-number strong');
        if (el && el.textContent) {
            return el.textContent.trim();
        }

        return '';
    }

    /**
     * Set all MSE contexts and publish the placeOrder event.
     *
     * @param {Object}      mse       window.magentoStorefrontEvents
     * @param {Object|null} cartData  Snapshot from localStorage (may be null)
     */
    function publishPlaceOrder(mse, cartData) {
        var cc    = window.checkoutConfig || {};
        var sf    = (cartData && cartData.storefrontInstance) || {};
        var items = (cartData && cartData.items) || [];

        // ── a. StorefrontInstance context ──────────────────────────────────────
        // Identifies which store view this event originated from. Required by the
        // Collector to route data to the correct Adobe data stream / ECID org.
        mse.context.setStorefrontInstance({
            environment: "Testing",
            environmentId:  'BK_TEST_ENV',
            baseCurrencyCode: "USD",
            storeViewCurrencyCode: "USD",
            viewId: 'CatlogView1',
            storefrontTemplate: 'LUMA_BRIDGE',
            storeUrl: '',
        });

        // ── b. ShoppingCart context ────────────────────────────────────────────
        // Represents the cart contents at the moment of purchase. Magento clears
        // the cart before the success page loads, so we rely on the localStorage
        // snapshot written by place-order-mixin.js.
        mse.context.setShoppingCart({
            cartId: (cartData && cartData.cartId) || '',
            items: items.map(function (item, ix) {
                return {
                    id: String(ix),  // required, but we have no real product IDs at this point — use the index
                    product: {
                        name: item.productName || '',
                        sku: item.productSku || '',
                        mainImageUrl: item.productImageUrl || ''
                    },
                    quantity: item.qty || 1,
                    prices:      {
                        price: {
                            value: item.offerPrice || 0,
                        }
                    },
                };
            }),
            totalQuantity: items.length,

        });

        // ── c. Order context ───────────────────────────────────────────────────
        // The order that was just placed. orderId is the Magento increment ID
        // (e.g. "000000042"). Totals come from the persisted quote snapshot.
        mse.context.setOrder({
            orderId:        getOrderId(),
            grandTotal:     (cartData && cartData.grandTotal)     || 0,
            subTotal:       (cartData && cartData.subTotal)       || 0,
            taxTotal:       (cartData && cartData.taxTotal)       || 0,
            discountAmount: (cartData && cartData.discountAmount) || 0,
            currencyCode:   (cartData && cartData.currencyCode)   || '',
            // items: items.map(function (item) {
            //     return {
            //         productSku:   item.productSku  || '',
            //         productName:  item.productName || '',
            //         qty:          item.qty         || 1,
            //         offerPrice:   item.offerPrice  || 0,
            //         currencyCode: item.currencyCode || ''
            //     };
            // })
        });

        // ── d. Page context ────────────────────────────────────────────────────
        // pageType 'checkout' + eventType 'visibilityHidden' is the canonical pair
        // for order-confirmation pages per the MSE event reference docs.
        mse.context.setPage({
            pageType:    'checkout',
            eventType:   'visibilityHidden',
            maxXOffset:  0,
            maxYOffset:  0,
            minHeight:   0,
            minWidth:    0,
            referrerUrl: document.referrer || '',  // the checkout page URL
            ping: {
                pageInfos: []
            }
        });

        // ── e. Shopper context ─────────────────────────────────────────────────
        // Use the Magento customer ID for logged-in shoppers; otherwise 'guest'.
        var shopperId = 'guest';
        if (cc.customerData && cc.customerData.id) {
            shopperId = String(cc.customerData.id);
        }
        mse.context.setShopper({ shopperId: shopperId });

        mse.publish.pageView();  // ensure the page view event fires before placeOrder

        // ── Publish ────────────────────────────────────────────────────────────
        // All contexts must be set before publishing. The Collector reads the
        // current context at publish time and forwards it to Adobe.
        console.log('[CheckoutAnalytics] Publishing placeOrder event');
        mse.publish.placeOrder();

        // ── Cleanup ────────────────────────────────────────────────────────────
        // Remove the snapshot so stale data cannot bleed into a subsequent order.
        localStorage.removeItem(STORAGE_KEY);
    }

    /**
     * Component entry point.
     * x-magento-init calls this as:  component(config, element)
     * where config = {} and element = document.body (from the "*" selector).
     */
    return function (config) {
        console.log('[CheckoutAnalytics] checkout-success component initialized');

        var cartData = getPersistedCartData();

        if (!cartData) {
            console.warn('[CheckoutAnalytics] No cart snapshot in localStorage — ' +
                'placeOrder event will fire without item-level detail. ' +
                'Ensure place-order-mixin.js is active on the checkout page.');
        }
        var mse = window.magentoStorefrontEvents;
        if (mse) {
            console.log('[CheckoutAnalytics] cartData:', cartData);
            // SDK is already loaded (e.g. by a previous page view) — proceed immediately.
            publishPlaceOrder(mse, cartData);
            return;
        } else {
            console.log('[CheckoutAnalytics] MSE SDK not found, loading from CDN');
        }
        // loadMseStack()
        //     .then(function (mse) {
        //         publishPlaceOrder(mse, cartData);
        //     })
        //     .catch(function (err) {
        //         // A failed analytics event must never disrupt the success page UX.
        //         console.error('[CheckoutAnalytics] Could not fire placeOrder event:', err);
        //     });
    };
});
