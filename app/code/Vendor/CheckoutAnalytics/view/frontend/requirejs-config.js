/**
 * RequireJS configuration for Vendor_CheckoutAnalytics.
 *
 * Registers one mixin:
 *
 *  place-order-mixin — wraps the core place-order action so we can snapshot
 *  the cart into localStorage BEFORE Magento redirects to the success page
 *  (the cart is emptied server-side before the success page renders).
 *
 * The success-page analytics component (checkout-success.js) is NOT a mixin.
 * It is initialized via x-magento-init in checkout-success.phtml, which is
 * injected by the checkout_onepage_success layout handle. This is the correct
 * approach because Magento_Checkout/js/view/checkout/success is not loaded on
 * the success page — it only exists in the checkout SPA bundle.
 */
var config = {
    config: {
        mixins: {
            // Part 1: intercept the place-order action during checkout
            'Magento_Checkout/js/action/place-order': {
                'Vendor_CheckoutAnalytics/js/action/place-order-mixin': true
            }
        }
    },
    paths: {
        magentoStorefrontEvents: [
            'https://cdn.jsdelivr.net/npm/@adobe/magento-storefront-events-sdk@qa/dist/index',
            'Vendor_CheckoutAnalytics/js/noopSdk'
        ],
        magentoStorefrontEventCollector: [
            'https://cdn.jsdelivr.net/npm/@adobe/magento-storefront-event-collector@qa/dist/index',
            'Vendor_CheckoutAnalytics/js/noopCollector'
        ],
        dataServicesBase: [
            'https://acds-events.adobe.io/v7/ds.min',
            'Magento_DataServices/js/noopDs'
        ],
    }
};
