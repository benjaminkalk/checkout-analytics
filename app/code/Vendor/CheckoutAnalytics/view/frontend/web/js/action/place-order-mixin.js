/**
 * place-order-mixin.js — Vendor_CheckoutAnalytics
 *
 * Intercepts the place-order action before the redirect so we can snapshot
 * cart + storefront data to localStorage. Magento clears the cart server-side
 * before the success page loads, so this is the only opportunity to capture it.
 */
define([
    'mage/utils/wrapper',
    'Magento_Checkout/js/model/quote'
], function (wrapper, quote) {
    'use strict';

    var STORAGE_KEY = 'mse_checkout_cart_data';

    function getImageUrl(item) {
        if (item.thumbnail) { return item.thumbnail; }
        if (item.product && item.product.thumbnail_url) { return item.product.thumbnail_url; }
        return '';
    }

    function persistCartData() {
        try {
            var quoteItems = quote.getItems();
            var totals     = quote.getTotals()();  // KO observable — call it to get value
            var cartId     = quote.getQuoteId ? quote.getQuoteId() : '';
            var cc         = window.checkoutConfig || {};

            var items = (quoteItems || []).map(function (item) {
                return {
                    productSku:      item.sku  || '',
                    productName:     item.name || '',
                    qty:             item.qty  || 1,
                    offerPrice:      parseFloat(item.price) || 0,
                    currencyCode:    (totals && totals.quote_currency_code) || '',
                    productImageUrl: getImageUrl(item)
                };
            });

            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                cartId: cartId,
                items:  items,
                grandTotal:     totals ? parseFloat(totals.grand_total)      || 0 : 0,
                subTotal:       totals ? parseFloat(totals.subtotal)          || 0 : 0,
                taxTotal:       totals ? parseFloat(totals.tax_amount)        || 0 : 0,
                discountAmount: totals ? parseFloat(totals.discount_amount)   || 0 : 0,
                currencyCode:   totals ? (totals.quote_currency_code || '')       : '',
                storefrontInstance: {
                    storeCode:     cc.storeCode                    || '',
                    storeViewCode: cc.activeStore || cc.storeViewCode || '',
                    websiteCode:   cc.websiteCode                  || '',
                    environmentId: cc.environmentId                || '',
                    storeId:       cc.storeId      || null,
                    websiteId:     cc.websiteId    || null,
                    storeGroupId:  cc.storeGroupId || null
                }
            }));
        } catch (e) {
            console.error('[CheckoutAnalytics] Failed to persist cart data:', e);
        }
    }

    return function (originalAction) {
        console.log('[CheckoutAnalytics] place-order mixin initialized');
        return wrapper.wrap(originalAction, function (originalFn, paymentData, messageContainer) {
            console.log('[CheckoutAnalytics] place-order mixin invoked, persisting cart data');
            persistCartData();
            return originalFn(paymentData, messageContainer);
        });
    };
});
