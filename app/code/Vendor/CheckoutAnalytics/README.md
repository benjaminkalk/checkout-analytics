# Vendor_CheckoutAnalytics

Fires a `placeOrder` storefront event on the checkout success page for a Luma/PHP Adobe Commerce storefront. Because Magento empties the cart server-side before the success page renders, this module uses a two-part approach: a mixin snapshots cart data to `localStorage` immediately before the order redirect, and a success-page component restores that data, loads the Adobe Commerce Storefront Events SDK and Collector, and publishes the event with full context.

## Prerequisites

Before installing this module, confirm the following:

- Adobe Commerce 2.4.x installed and running
- A Luma-based or Luma-derived frontend (RequireJS AMD module pattern)
- PHP 8.1 or later
- Access to the Magento CLI (`bin/magento`)
- The server can reach `cdn.jsdelivr.net` from the browser (CDN URLs are loaded client-side)

>[!NOTE]
>
>This module does not require Composer or an npm build step. All JavaScript dependencies are loaded from CDN at runtime with noop fallbacks if the CDN is unreachable.

## Module overview

| File | Purpose |
|---|---|
| `registration.php` | Registers the module with the Magento component registry |
| `etc/module.xml` | Declares the module and its soft dependency on `Magento_Checkout` |
| `view/frontend/requirejs-config.js` | Registers the place-order mixin and defines CDN paths for the MSE SDK and Collector |
| `view/frontend/layout/checkout_onepage_success.xml` | Injects the analytics block into the checkout success page layout |
| `view/frontend/templates/checkout-success.phtml` | Initializes the success-page JS component via `x-magento-init` |
| `view/frontend/web/js/action/place-order-mixin.js` | Wraps the core place-order action to snapshot cart data before the redirect |
| `view/frontend/web/js/view/checkout-success.js` | Loads the MSE SDK, sets all contexts, and fires `mse.publish.placeOrder()` |
| `view/frontend/web/js/noopSdk.js` | Empty AMD module used as a CDN fallback for the MSE SDK |
| `view/frontend/web/js/noopCollector.js` | Empty AMD module used as a CDN fallback for the MSE Collector |
| `view/frontend/web/js/noopDs.js` | Empty AMD module used as a CDN fallback for the data services base |

## Step 1: Copy the module into your Magento installation

Copy the module directory into your Magento `app/code` directory.

```bash
cp -r app/code/Vendor/CheckoutAnalytics /var/www/html/app/code/Vendor/CheckoutAnalytics
```

Confirm the following files are present before continuing:

```
app/code/Vendor/CheckoutAnalytics/
  registration.php
  etc/module.xml
  view/frontend/layout/checkout_onepage_success.xml
  view/frontend/requirejs-config.js
  view/frontend/templates/checkout-success.phtml
  view/frontend/web/js/action/place-order-mixin.js
  view/frontend/web/js/view/checkout-success.js
  view/frontend/web/js/noopSdk.js
  view/frontend/web/js/noopCollector.js
  view/frontend/web/js/noopDs.js
```

## Step 2: Enable the module

Run the following commands from your Magento root directory.

```bash
bin/magento module:enable Vendor_CheckoutAnalytics
bin/magento setup:upgrade
```

`setup:upgrade` registers the module in `app/etc/config.php` and runs any required schema or data upgrades from its dependencies.

Confirm the module is active:

```bash
bin/magento module:status Vendor_CheckoutAnalytics
```

The output should read `Module is enabled`.

## Step 3: Compile dependency injection

```bash
bin/magento setup:di:compile
```

>[!NOTE]
>
>This module contains no PHP classes beyond `registration.php`, so this step completes quickly. It is still required to rebuild the global DI map so Magento picks up the new module correctly.

## Step 4: Deploy static content

```bash
bin/magento setup:static-content:deploy -f
```

This publishes the RequireJS configuration and all JavaScript files under `view/frontend/web/js/` to the static asset directory. The `-f` flag forces deployment in any application mode.

For production mode, specify your locale explicitly:

```bash
bin/magento setup:static-content:deploy en_US -f
```

## Step 5: Flush the cache

```bash
bin/magento cache:flush
```

## Step 6: Configure the storefront instance context

Open `view/frontend/web/js/view/checkout-success.js` and update the `setStorefrontInstance` call with your environment values:

```javascript
mse.context.setStorefrontInstance({
    environment:           'Production',   // 'Testing' or 'Production'
    environmentId:         'YOUR_ENV_ID',  // Tenant ID associated with ACO/EDS storefront
    baseCurrencyCode:      'USD',
    storeViewCurrencyCode: 'USD',
    viewId:                'YOUR_VIEW_ID', // Catalog View ID associated with ACO/EDS storefront
    storefrontTemplate:    'LUMA_BRIDGE',
    storeUrl:              'https://your-store.example.com'
});
```

>[!IMPORTANT]
>
>The `environmentId` value is issued by Adobe when you provision a data stream in Adobe Experience Platform. Using a placeholder value like `TEST_ENV` will cause events to be routed to the wrong data stream or dropped entirely.

After editing the file, redeploy static content:

```bash
bin/magento setup:static-content:deploy -f && bin/magento cache:flush
```

## Step 7: Update the CDN package versions (optional)

By default, `requirejs-config.js` loads the `@qa` tag of the SDK and Collector packages. To pin to a stable release, update the `paths` entries:

```javascript
paths: {
    magentoStorefrontEvents: [
        'https://cdn.jsdelivr.net/npm/@adobe/magento-storefront-events-sdk@1/dist/index',
        'Vendor_CheckoutAnalytics/js/noopSdk'
    ],
    magentoStorefrontEventCollector: [
        'https://cdn.jsdelivr.net/npm/@adobe/magento-storefront-event-collector@1/dist/index',
        'Vendor_CheckoutAnalytics/js/noopCollector'
    ]
}
```

The array syntax is RequireJS's built-in fallback mechanism. If the CDN URL fails to load, RequireJS automatically tries the next entry in the array — in this case the local noop module — so the checkout flow is never blocked.

## Step 8: Verify the module is working

### Verify Part 1 — cart snapshot on the checkout page

1. Open your store in a browser with the DevTools console open.
2. Add one or more products to the cart and proceed to checkout.
3. Fill in shipping and payment details but **do not yet place the order**.
4. In the console, confirm the mixin initialized:

   ```
   [CheckoutAnalytics] place-order mixin initialized
   ```

5. Place the order. Before the page redirects, confirm:

   ```
   [CheckoutAnalytics] place-order mixin invoked, persisting cart data
   ```

6. In DevTools, open **Application > Local Storage** and confirm a key named `mse_checkout_cart_data` exists with a JSON payload containing your cart items, totals, and storefront instance fields.

### Verify Part 2 — event published on the success page

1. After the redirect to the success page, open the console and confirm:

   ```
   [CheckoutAnalytics] checkout-success component initialized
   [CheckoutAnalytics] cartData: { cartId: "...", items: [...], ... }
   [CheckoutAnalytics] Publishing placeOrder event
   ```

2. Confirm the `mse_checkout_cart_data` key has been removed from Local Storage after the event fires.

3. To confirm the event was received by the MSE SDK, run the following in the console before placing a test order:

   ```javascript
   window.magentoStorefrontEvents.subscribe.placeOrder(function (event) {
       console.log('placeOrder event received:', event);
   });
   ```

>[!NOTE]
>
>If `window.magentoStorefrontEvents` is `undefined` on the success page, the CDN scripts failed to load. Check the Network tab in DevTools for failed requests to `cdn.jsdelivr.net`. The noop fallback modules prevent JavaScript errors but do not set `window.magentoStorefrontEvents`, so no event will fire.

## Troubleshooting

**The `place-order` mixin is not running**

Confirm the mixin is registered correctly by checking the compiled RequireJS config in the browser:

```javascript
require.s.contexts._.config.config.mixins
// Should contain an entry for 'Magento_Checkout/js/action/place-order'
```

If the entry is missing, re-run static content deployment and flush the cache.

---

**`mse_checkout_cart_data` is empty or missing on the success page**

This means `persistCartData()` ran but the quote returned no items. This can happen if:

- The mixin fired after the cart was already cleared (unlikely — the mixin runs synchronously before the AJAX call)
- `quote.getItems()` returns an empty array because the payment method bypasses the standard place-order action

Check whether your active payment method uses a custom place-order action. If so, add a second mixin targeting that module.

---

**The `placeOrder` event fires but contexts are missing or incorrect**

Open the console and inspect the context state directly before publishing:

```javascript
var mse = window.magentoStorefrontEvents;
console.log(mse.context.getShoppingCart());
console.log(mse.context.getOrder());
console.log(mse.context.getStorefrontInstance());
```

Cross-reference each field against the [MSE context reference](https://developer.adobe.com/commerce/services/shared-services/storefront-events/sdk/context/).

---

**Static content is not updating after editing JS files**

In developer mode, RequireJS serves files directly from `app/code` so edits are reflected immediately. In production mode, you must redeploy static content and flush the cache after every JS change:

```bash
bin/magento setup:static-content:deploy -f && bin/magento cache:flush
```

## Related documentation

- [Adobe Commerce Storefront Events SDK](https://developer.adobe.com/commerce/services/shared-services/storefront-events/sdk/install/)
- [Storefront Events Collector](https://developer.adobe.com/commerce/services/shared-services/storefront-events/collector/)
- [Storefront Events reference — placeOrder](https://developer.adobe.com/commerce/services/shared-services/storefront-events/reference/storefront-events/)
- [Magento custom JS components](https://developer.adobe.com/commerce/frontend-core/javascript/custom)
- [RequireJS mixins in Magento](https://developer.adobe.com/commerce/frontend-core/javascript/requirejs/)
