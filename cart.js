const BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://www.hamelhawks.com';
import { fetchProductsData, updateCartPrices, fetchShippingRates } from './utils.js';

let cart = JSON.parse(localStorage.getItem('cart')) || [];

export function initializeCart() {
    if (!window.productsData) {
        fetchProductsData().then(data => {
            window.productsData = data;
            updateCart();
        }).catch(error => console.error('Init error:', error));
    } else {
        updateCart();
    }

    const cartIcon = document.getElementById('cart-icon');
    if (cartIcon) {
        cartIcon.addEventListener('click', showCart);
    }
}

export function showCart() {
    const cartPopup = document.getElementById('cart-popup');
    const isMobile = window.matchMedia('(max-width: 1000px)').matches;
    if (cartPopup) {
        cartPopup.classList.add('show');
        if (isMobile) {
            document.body.classList.add('no-scroll');
        }
    }
}

export function addToCart(id, name, price, variantId) {
    const product = window.productsData.find(p => String(p.sync_product.id) === String(id));
    if (!product) return;
    // console.log("PRODUCT", product);
    const variant = product.sync_variants.find(v => String(v.id) === String(variantId));
    if (!variant) return;

    const productVariantId = variant.id;
    const shippingVariantId = variant.variant_id || variant.id;
    const thumbnail = variant.files?.find(f => f.type === 'preview')?.thumbnail_url || product.sync_product.thumbnail_url || 'https://via.placeholder.com/50';

    const existingItem = cart.find(item => item.productVariantId === productVariantId);
    // console.log("ExistingItem", existingItem);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        // console.log('Adding with productVariantId:', productVariantId, 'shippingVariantId:', shippingVariantId, 'thumbnail:', thumbnail);
        cart.push({
            id: String(id),
            name: product.sync_product.name || name,
            price,
            productVariantId,
            shippingVariantId,
            quantity: 1,
            thumbnail,
            variantName: variant.name,
            color: variant.color,
            size: variant.size,
            syncVariantId: variant.id // this is what printful needs for custom design elements (what goes on the product)
        });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCart();
    showCart();
}

export async function updateCart() {
    const cartCount = document.getElementById('cart-count');
    const cartPopup = document.getElementById('cart-popup');
    if (!cartPopup || !cartCount) return;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    cartCount.classList.toggle('show', totalItems > 0);

    const updatedCart = updateCartPrices(cart, window.productsData);
    const subtotal = updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal;

    cartPopup.innerHTML = `
        <div class="cart-header">
            <div class="close-cart">
                <span class="bar top"></span>
                <span class="bar bottom"></span>
            </div>
        </div>
        <div class="cart-content">
            <div class="cart-items">
                ${totalItems === 0 ? `
                    <p>Your cart is empty</p>
                    <button class="return-button" onclick="window.location.href='https://www.hamelhawks.com/shop'">Go to shop</button>
                ` : updatedCart.map((item, index) => `
                    <div class="cart-item">
                        <img src="${item.thumbnail}" alt="${item.variantName}">
                        <div class="cart-item-details">
                            <div class="name">${item.name}</div>
                            <div class="subtext">Size: ${item.size}</div>
                            <div class="subtext">Color: ${item.color}</div>
                            <div class="stepper">
                                <button class="qty-minus" data-index="${index}">-</button>
                                <span>${item.quantity}</span>
                                <button class="qty-plus" data-index="${index}">+</button>
                            </div>
                        </div>
                        <div class="cart-item-actions">
                            <div class="remove-item" data-index="${index}">
                                <span class="bar top"></span>
                                <span class="bar bottom"></span>
                            </div>
                            <div class="price">$${(item.price * item.quantity).toFixed(2)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ${totalItems > 0 ? `
            <div class="cart-summary">
                <p>Subtotal: $${subtotal.toFixed(2)}</p>
                <p>Shipping: <span class="shipping-cost">adjusts at checkout</span></p>
                <button class="estimate-shipping-btn">Estimate Shipping</button>
                <p><strong>Total: $${total.toFixed(2)}</strong></p>
                <button class="checkout-btn">Proceed to Checkout</button>
            </div>
        ` : ''}
    `;

    const closeCart = document.querySelector('.close-cart');
    if (closeCart) {
        closeCart.addEventListener('click', () => {
            cartPopup.classList.remove('show');
            document.body.classList.remove('no-scroll');
            resetBars('.close-cart');
        });
    }

    const checkoutBtn = document.querySelector('.checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.location.pathname.startsWith('/news/')) {
                observer.disconnect();
            }
            window.location.href = `${BASE_URL}/checkout.html`;
        });
    }

    const estimateBtn = document.querySelector('.estimate-shipping-btn');
    if (estimateBtn) {
        estimateBtn.addEventListener('click', async () => {
            estimateBtn.disabled = true;
            estimateBtn.textContent = 'Estimating...';
            estimateBtn.classList.add('processing');

            const defaultShippingAddress = {
                address1: 'Hamel, MN 55340',
                city: 'Hamel',
                country_code: 'US',
                state_code: 'MN',
                zip: '55340',
                phone: '123-456-7890'
            };

            const shippingData = await fetchShippingRates(updatedCart, defaultShippingAddress);
            const shippingCost = shippingData.shippingCost;
            const shippingDisplay = cartPopup.querySelector('.shipping-cost');
            shippingDisplay.textContent = `$${shippingCost.toFixed(2)} (estimate)`;
            const totalDisplay = cartPopup.querySelector('.cart-summary strong');
            const newTotal = subtotal + shippingCost;
            totalDisplay.textContent = `Total: $${newTotal.toFixed(2)}`;

            // Reset button state
            estimateBtn.disabled = false;
            estimateBtn.textContent = 'Estimate Shipping';
            estimateBtn.classList.remove('processing');
        });
    }

    document.querySelectorAll('.qty-minus').forEach(btn => {
        btn.addEventListener('click', () => updateQuantity(parseInt(btn.dataset.index), cart[btn.dataset.index].quantity - 1));
    });
    
    document.querySelectorAll('.qty-plus').forEach(btn => {
        btn.addEventListener('click', () => updateQuantity(parseInt(btn.dataset.index), cart[btn.dataset.index].quantity + 1));
    });
    
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => removeItem(parseInt(btn.dataset.index)));
    });
}

export function updateQuantity(index, newQuantity) {
    const qty = parseInt(newQuantity, 10);
    if (qty >= 1) {
        cart[index].quantity = qty;
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCart();
    }
}

export function removeItem(index) {
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCart();
}

function resetBars(selector) {
    const bars = document.querySelector(selector);
    bars.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', initializeCart);