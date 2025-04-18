import { renderVariants, groupVariantsByColorAndSize } from './variants.js';
import { addToCart } from './cart.js';
import { API_BASE_URL } from './config.js';

async function fetchProducts() {
    const response = await fetch(`${API_BASE_URL}/api/products`);
    const data = await response.json();
    return data;
}

// fetch product details from json
async function fetchProductDetails() {
    try {
        const response = await fetch('/productDetails.json');
        const data = await response.json();
        return data.products || [];
    } catch (error) {
        console.error('Error fetching product details:', error);
        return [];
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const products = await fetchProducts();
        const productDetails = await fetchProductDetails();
        const productsDiv = document.getElementById('products');
        console.log(products);
        if (!Array.isArray(products) || products.length === 0) {
            productsDiv.innerHTML = '<p>No products available.</p>';
            return;
        }

        window.productsData = products;
        window.productDetailsData = productDetails;
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

        // Function to open popup
        function openProductPopup(syncProductId, variantId) {
            const product = window.productsData.find(p => String(p.sync_product.id) === String(syncProductId));

            const activeVariant = product.sync_variants.find(v => String(v.id) === String(variantId));
            if (!activeVariant) {
                console.error('Variant not found for ID:', variantId);
                return;
            }

            const details = window.productDetailsData.find(p => String(p.sync_product_id) === String(syncProductId));
            const activeColor = activeVariant.color || 'Default';
            const variantDetails = details?.variants?.find(v => v.color === activeColor);

            console.log("Active color", activeColor);
            console.log("details", variantDetails);

            const popup = document.getElementById('productPopup');
            if (!popup) {
                console.error('Popup element #productPopup not found in DOM');
                return;
            }

            const title = popup.querySelector('.product-title');
            const description = popup.querySelector('.product-description');
            const mainPopupImage = popup.querySelector('.main-popup-image');
            const thumbnails = popup.querySelector('.thumbnails');

            if (!mainPopupImage || !title || !description || !thumbnails) {
                console.error('Missing required popup elements:', { mainPopupImage, title, description, thumbnails });
                return;
            }

            title.textContent = product.sync_product.name;
            description.textContent = variantDetails?.description || details?.variants?.[0]?.description || 'No description available.';
            
            // Populate images
            const defaultImage = activeVariant.files.find(f => f.type === 'preview')?.preview_url || product.sync_product.thumbnail_url || 'https://via.placeholder.com/400';
            const mockupImages = variantDetails?.mockup_images || [];
            const images = [defaultImage, ...mockupImages];

            // Set main popup image
            mainPopupImage.src = defaultImage;
            mainPopupImage.alt = `${product.sync_product.name}`;
            
            // Populate thumbnails only if mockup images exist
            if (mockupImages.length > 0) {
                thumbnails.style.display = 'flex';
                thumbnails.innerHTML = images.map((img, index) => `
                    <img src="${img}" alt="${product.sync_product.name} thumbnail ${index + 1}" 
                         class="${index === 0 ? 'active' : ''}" 
                         data-image="${img}" 
                         loading="lazy">
                `).join('');

                // Add click handlers for thumbnails
                thumbnails.querySelectorAll('img').forEach(thumb => {
                    thumb.addEventListener('click', () => {
                        mainPopupImage.src = thumb.dataset.image;
                        thumbnails.querySelectorAll('img').forEach(t => t.classList.remove('active'));
                        thumb.classList.add('active');
                    });
                });
            } else {
                thumbnails.style.display = 'none';
                thumbnails.innerHTML = '';
            }

            popup.style.display = 'block';
        }

        // Close popup
        document.querySelector('.close-btn').addEventListener('click', () => {
            document.getElementById('productPopup').style.display = 'none';
        });

        console.log(document.getElementById('productPopup'));
        productsDiv.addEventListener('click', (e) => {
            const productDiv = e.target.closest('.product');
            if (!productDiv) return;
            const productId = productDiv.dataset.productId;
            console.log("product id", productId);
            const product = products.find(p => String(p.sync_product.id) === String(productId));
            const addToCartBtn = productDiv.querySelector('.add-to-cart');
            const priceElement = productDiv.querySelector('.price');
            const defaultPrice = parseFloat(productDiv.dataset.defaultPrice);

           // Handle main image click
           if (e.target.classList.contains('main-image')) {
            const variantId = e.target.dataset.variantId;
            openProductPopup(productId, variantId);
            return;
        }

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