/**
 * RequireJS configuration for Vendor_CheckoutAnalytics.
 *
 * - place-order-mixin: snapshots cart to localStorage before the order redirect.
 * - paths: loads the MSE SDK and Collector as AMD deps with CDN + noop fallbacks.
 *   The success-page component (checkout-success.js) declares these as deps so
 *   they are guaranteed to execute before its callback runs.
 */
var config = {
    config: {
        mixins: {
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
        ]
    }
};
