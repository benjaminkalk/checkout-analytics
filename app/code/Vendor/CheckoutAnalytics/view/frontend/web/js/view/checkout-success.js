/**
 * checkout-success.js — Vendor_CheckoutAnalytics
 *
 * Initialized via x-magento-init on the checkout_onepage_success page.
 * Restores the cart snapshot saved by place-order-mixin.js, sets MSE contexts,
 * and fires mse.publish.placeOrder().
 *
 * The SDK and Collector are loaded as AMD dependencies via requirejs-config.js paths.
 * By the time this callback runs they have already executed and attached to
 * window.magentoStorefrontEvents.
 */
define([
    'magentoStorefrontEvents',
    'magentoStorefrontEventCollector'
], function () {
    'use strict';

    var STORAGE_KEY = 'mse_checkout_cart_data';

    function getPersistedCartData() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error('[CheckoutAnalytics] Could not parse persisted cart data:', e);
            return null;
        }
    }

    function getOrderId() {
        var orderId = (window.checkoutConfig || {}).orderId;
        if (orderId) {
            return String(orderId);
        }
        // Fallback: Luma renders the increment ID inside .order-number > strong
        var el = document.querySelector('.order-number strong');
        return (el && el.textContent) ? el.textContent.trim() : '';
    }

    function publishPlaceOrder(mse, cartData) {
        var cc    = window.checkoutConfig || {};
        var items = (cartData && cartData.items) || [];

        mse.context.setStorefrontInstance({
            environment:           'Testing',
            environmentId:         'BK_TEST_ENV',
            baseCurrencyCode:      'USD',
            storeViewCurrencyCode: 'USD',
            viewId:                'CatlogView1',
            storefrontTemplate:    'LUMA_BRIDGE',
            storeUrl:              ''
        });

        mse.context.setShoppingCart({
            cartId: (cartData && cartData.cartId) || '',
            items: items.map(function (item, ix) {
                return {
                    id:      String(ix),
                    product: {
                        name:         item.productName     || '',
                        sku:          item.productSku      || '',
                        mainImageUrl: item.productImageUrl || ''
                    },
                    quantity: item.qty || 1,
                    prices:   { price: { value: item.offerPrice || 0 } }
                };
            }),
            totalQuantity: items.length,
            prices: {
                subtotalExcludingTax: { value: cartData ? cartData.subTotal : 0 },
                subtotalIncludingTax: { value: cartData ? cartData.subTotal + cartData.taxTotal : 0 },
            }
        });

        mse.context.setOrder({
            orderId:        getOrderId(),
            grandTotal:     (cartData && cartData.grandTotal)     || 0,
            subTotal:       (cartData && cartData.subTotal)       || 0,
            taxTotal:       (cartData && cartData.taxTotal)       || 0,
            discountAmount: (cartData && cartData.discountAmount) || 0,
            currencyCode:   (cartData && cartData.currencyCode)   || ''
        });

        mse.context.setPage({
            pageType:    'checkout',
            eventType:   'visibilityHidden',
            maxXOffset:  0,
            maxYOffset:  0,
            minHeight:   0,
            minWidth:    0,
            referrerUrl: document.referrer || '',
            ping:        { pageInfos: [] }
        });

        var shopperId = 'guest';
        if (cc.customerData && cc.customerData.id) {
            shopperId = String(cc.customerData.id);
        }
        mse.context.setShopper({ shopperId: shopperId });

        mse.publish.pageView();
        mse.publish.placeOrder();

        localStorage.removeItem(STORAGE_KEY);
    }

    return function () {
        console.log('[CheckoutAnalytics] checkout-success component initialized');

        var cartData = getPersistedCartData();
        if (!cartData) {
            console.warn('[CheckoutAnalytics] No cart snapshot in localStorage — ' +
                'placeOrder event will fire without item-level detail.');
        }

        var mse = window.magentoStorefrontEvents;
        if (!mse) {
            console.error('[CheckoutAnalytics] MSE SDK not available on window — cannot fire placeOrder event.');
            return;
        }

        console.log('[CheckoutAnalytics] cartData:', cartData);
        publishPlaceOrder(mse, cartData);
    };
});
