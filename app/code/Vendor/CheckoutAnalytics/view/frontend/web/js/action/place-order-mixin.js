/**
 * place-order-mixin.js — Part 1 of Vendor_CheckoutAnalytics
 *
 * PURPOSE:
 *   Magento clears the cart server-side before the checkout/success page loads,
 *   so by the time the success page runs, quote.getItems() returns nothing.
 *   This mixin intercepts the place-order action BEFORE the redirect happens and
 *   persists a snapshot of cart + storefront data to localStorage under the key
 *   `mse_checkout_cart_data`. The success-page mixin reads this snapshot back.
 *
 * HOOK POINT:
 *   Magento_Checkout/js/action/place-order is a plain function (not a UI Component),
 *   so Magento's mixin system wraps it via a factory function pattern.
 */
define([
    'jquery',
    'mage/utils/wrapper',
    'Magento_Checkout/js/model/quote',
    'magentoStorefrontEvents',
    'magentoStorefrontEventCollector'
], function ($, wrapper, quote) {
    'use strict';

    /** localStorage key shared with checkout-success-mixin.js */
    var STORAGE_KEY = 'mse_checkout_cart_data';

    /**
     * Attempt to read the product image URL for an item.
     * quote items expose `product` with `thumbnail` or `image` depending on the
     * quote item extension attributes populated by Magento.
     *
     * @param  {Object} item  A quote item object
     * @return {string}
     */
    function getImageUrl(item) {
        // Extension attributes may expose a thumbnail URL; fall back to empty string.
        if (item.thumbnail) {
            return item.thumbnail;
        }
        if (item.product && item.product.thumbnail_url) {
            return item.product.thumbnail_url;
        }
        return '';
    }

    /**
     * Serialize current quote state and write it to localStorage.
     * Called once, synchronously, just before we yield to the original action.
     */
    function persistCartData() {
        try {
            var quoteItems = quote.getItems();
            var totals      = quote.getTotals()();  // ko observable — call it
            var cartId      = quote.getQuoteId ? quote.getQuoteId() : '';

            // Pull storefront identifiers from window.checkoutConfig which Magento
            // inlines on the checkout page. These are needed to set the
            // StorefrontInstance context on the success page.
            var cc = window.checkoutConfig || {};

            var storefrontInstance = {
                // storeCode / storeViewCode come from the checkout config block
                storeCode:      cc.storeCode      || '',
                storeViewCode:  cc.activeStore    || cc.storeViewCode || '',
                websiteCode:    cc.websiteCode    || '',
                // environmentId is populated when Live Search / Product Recs are active
                environmentId:  cc.environmentId  || '',
                // Numeric IDs — Magento exposes these in some versions of checkoutConfig
                storeId:        cc.storeId        || null,
                websiteId:      cc.websiteId      || null,
                storeGroupId:   cc.storeGroupId   || null
            };

            // Map quote items to a serialisable shape that mirrors the MSE
            // ShoppingCart.items[] context schema.
            var items = (quoteItems || []).map(function (item) {
                return {
                    // productSku / productName are the field names expected by the
                    // MSE setShoppingCart() context call.
                    productSku:      item.sku || '',
                    productName:     item.name || '',
                    qty:             item.qty || 1,
                    // item_price is the row price divided by qty; price is the unit price.
                    offerPrice:      parseFloat(item.price) || 0,
                    currencyCode:    (totals && totals.quote_currency_code) || '',
                    productImageUrl: getImageUrl(item)
                };
            });

            var payload = {
                cartId:             cartId,
                items:              items,
                // Grand total and sub-total come from the quote totals observable.
                grandTotal:         totals ? parseFloat(totals.grand_total)  || 0 : 0,
                subTotal:           totals ? parseFloat(totals.subtotal)      || 0 : 0,
                taxTotal:           totals ? parseFloat(totals.tax_amount)    || 0 : 0,
                discountAmount:     totals ? parseFloat(totals.discount_amount) || 0 : 0,
                currencyCode:       totals ? (totals.quote_currency_code || '') : '',
                storefrontInstance: storefrontInstance
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (e) {
            // Never let a failure here block the actual order placement.
            console.error('[CheckoutAnalytics] Failed to persist cart data:', e);
        }
    }

    /**
     * The mixin factory receives the original `placeOrder` function and must
     * return a replacement function with the same signature.
     *
     * Original signature:
     *   placeOrder(paymentData, messageContainer)  → Promise/Deferred
     */
    return function (originalAction) {
        console.log('[CheckoutAnalytics] place-order mixin initialized');
        return wrapper.wrap(originalAction, function (originalFn, paymentData, messageContainer) {
            // Snapshot cart data synchronously before we hand off to the original
            // action. The action itself is async (makes an AJAX call) so the page
            // redirect happens after the promise resolves — our localStorage write
            // will already be done well before that.
            console.log('[CheckoutAnalytics] place-order mixin invoked, persisting cart data');
            persistCartData();

            // Call the original place-order action and return its result unchanged
            // so the rest of the checkout flow is unaffected.
            return originalFn(paymentData, messageContainer);
        });
    };
});
