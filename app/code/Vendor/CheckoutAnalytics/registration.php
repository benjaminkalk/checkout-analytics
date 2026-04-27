<?php
/**
 * Vendor_CheckoutAnalytics
 *
 * Registers the module with the Magento component registry.
 */

use Magento\Framework\Component\ComponentRegistrar;

ComponentRegistrar::register(
    ComponentRegistrar::MODULE,
    'Vendor_CheckoutAnalytics',
    __DIR__
);
