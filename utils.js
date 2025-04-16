import { API_BASE_URL } from './config.js';

export async function fetchProductsData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/products`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Fetch products error:', error);
        return [];
    }
};

export async function fetchShippingRates(cartItems, shippingAddress) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/shipping`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cartItems, shippingAddress })
        });
        const data = await response.json();
        if (!response.ok) {
            // Throw Printful's error message if available
            const errorMessage = data.result || data.error || 'Unable to calculate shipping rates';
            throw new Error(errorMessage);
        }

        const standardOption = data.rawResponse.result.find(option => option.id === 'STANDARD');
        if (!standardOption || typeof standardOption.rate !== 'string') {
            throw new Error('No STANDARD shipping option available');
        }

        return {
            shippingCost: parseFloat(standardOption.rate),
            minDeliveryDate: standardOption.minDeliveryDate || 'TBD',
            maxDeliveryDate: standardOption.maxDeliveryDate || 'TBD'
        };
    } catch (error) {
        console.error('Fetch shipping error:', error.message);
        throw error; // Propagate the error to checkout.js
    }
};

export function updateCartPrices(cart, productsData) {
    return cart.map(item => {
        const product = productsData.find(p => String(p.sync_product.id) === String(item.id));
        const variant = product?.sync_variants.find(v => String(v.id) === String(item.productVariantId));
        return {
            ...item,
            price: variant ? parseFloat(variant.retail_price || item.price) : item.price,
            thumbnail: variant?.files?.find(f => f.type === 'preview')?.thumbnail_url || item.thumbnail
        };
    });
};