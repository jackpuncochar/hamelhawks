import { renderVariants, groupVariantsByColorAndSize } from './variants.js';
import { addToCart } from './cart.js';
import { API_BASE_URL } from './config.js';

async function fetchProducts() {
    const response = await fetch(`${API_BASE_URL}/api/products`);
    const data = await response.json();
    return data;
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const products = await fetchProducts();
        const productsDiv = document.getElementById('products');

        if (!Array.isArray(products) || products.length === 0) {
            productsDiv.innerHTML = '<p>No products available.</p>';
            return;
        }

        window.productsData = products;
        // console.log("PRODUCTS DATA", products);
        productsDiv.innerHTML = '';
        products.forEach(product => {
            const defaultVariant = product.sync_variants[0];
            const defaultPrice = parseFloat(defaultVariant.retail_price);
            const previewUrl = defaultVariant.files.find(f => f.type === 'preview')?.preview_url || product.sync_product.thumbnail_url;

            productsDiv.innerHTML += `
                <div class="product" data-product-id="${product.sync_product.id}" data-default-price="${defaultPrice}">
                    <div class="product-content">
                        <img src="${previewUrl}" alt="${product.sync_product.name}" class="main-image" data-variant-id="${defaultVariant.id}">
                        <h3 class="product-name">${product.sync_product.name}</h3>
                        <p class="price">$${defaultPrice.toFixed(2)}</p>
                        <div class="variant-container"></div>
                    </div>
                    <button class="add-to-cart" disabled>Select a size</button>
                </div>
            `;

            const variantContainer = productsDiv.querySelector(`[data-product-id="${product.sync_product.id}"] .variant-container`);
            renderVariants(variantContainer, product.sync_variants, defaultVariant.id, product);
        });

        productsDiv.addEventListener('click', (e) => {
            const productDiv = e.target.closest('.product');
            if (!productDiv) return;
            const productId = productDiv.dataset.productId;
            const product = products.find(p => String(p.sync_product.id) === String(productId));
            const addToCartBtn = productDiv.querySelector('.add-to-cart');
            const priceElement = productDiv.querySelector('.price');
            const defaultPrice = parseFloat(productDiv.dataset.defaultPrice);

            const box = e.target.closest('.size-box');
            if (box) {
                const variantId = box.dataset.variantId;
                // console.log('Size click for', product.sync_product.name, 'variantId:', variantId);
                const variant = product.sync_variants.find(v => String(v.id) === String(variantId));
                if (!variant) {
                    console.error('Variant not found for ID:', variantId);
                    return;
                }
                addToCartBtn.disabled = false;
                addToCartBtn.textContent = 'Add to Cart';
                addToCartBtn.dataset.variantId = variantId;
                productDiv.querySelectorAll('.size-box').forEach(b => {
                    b.style.border = b === box ? '2px solid #4169e1' : '1px solid #ddd';
                });

                // Update price
                const newPrice = parseFloat(variant.retail_price);
                priceElement.textContent = `$${newPrice.toFixed(2)}`;
                updatePriceWarning(productDiv, newPrice, defaultPrice);
            }

            const img = e.target.closest('.variant-image');
            if (img) {
                // console.log('Variant image clicked for', product.sync_product.name, 'variantId:', img.dataset.variantId);
                const mainImage = productDiv.querySelector('.main-image');
                const variantId = img.dataset.variantId;
                const selectedVariant = product.sync_variants.find(v => String(v.id) === String(variantId));
                const selectedColor = selectedVariant.color || 'Default';

                mainImage.src = img.src;
                mainImage.dataset.variantId = variantId;

                productDiv.querySelectorAll('.variant-image').forEach(v => {
                    v.style.border = v.dataset.variantId === variantId ? '2px solid #4169e1' : '1px solid #ddd';
                });

                const sizeBoxes = productDiv.querySelector('.size-boxes');
                const { sizes, isOneSize } = groupVariantsByColorAndSize(product.sync_variants);
                if (sizeBoxes && !isOneSize) {
                    const filteredSizes = sizes.filter(size => size.color === selectedColor);
                    sizeBoxes.innerHTML = filteredSizes.map(size => `
                        <div class="size-box" data-variant-id="${size.variant_id}">
                            ${size.name}
                        </div>
                    `).join('') || '<p>No sizes for this color</p>';
                    addToCartBtn.disabled = true;
                    addToCartBtn.textContent = 'Select a size';
                    delete addToCartBtn.dataset.variantId;
                } else if (isOneSize) {
                    addToCartBtn.dataset.variantId = variantId;
                }

                // Update price
                const newPrice = parseFloat(selectedVariant.retail_price);
                priceElement.textContent = `$${newPrice.toFixed(2)}`;
                updatePriceWarning(productDiv, newPrice, defaultPrice);
            }

            if (e.target.classList.contains('add-to-cart') && !e.target.disabled) {
                const variantId = e.target.dataset.variantId;
                const variant = product.sync_variants.find(v => String(v.id) === String(variantId));
                const thumbnail = variant.files.find(f => f.type === 'preview')?.preview_url || product.sync_product.thumbnail_url;
                addToCart(
                    product.sync_product.id,
                    product.sync_product.name,
                    parseFloat(variant.retail_price),
                    variantId,
                    thumbnail,
                    variant.name,
                    variant.color,
                    variant.size
                );
                // console.log('Added to cart:', product.sync_product.name, 'Variant:', variantId);
            }
        }, { passive: true });
    } catch (error) {
        console.error('Fetch error:', error);
        productsDiv.innerHTML = '<p>Error loading products.</p>';
    }
});

function updatePriceWarning(productDiv, newPrice, defaultPrice) {
    let warningElement = productDiv.querySelector('.price-warning');
    const priceElement = productDiv.querySelector('.price');

    if (newPrice > defaultPrice) {
        if (!warningElement) {
            warningElement = document.createElement('p');
            warningElement.className = 'price-warning';
            priceElement.insertAdjacentElement('afterend', warningElement); // Insert after price
        }
        warningElement.textContent = 'This product variant costs more than the default';
    } else if (warningElement) {
        warningElement.remove();
    }
}