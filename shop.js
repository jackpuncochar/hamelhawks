// Initialize Stripe with your Publishable Key
const stripe = Stripe('pk_test_your_publishable_key_here'); // Replace with your Stripe Publishable Key

// Base URL for Vercel API (update after deployment)
const API_BASE_URL = 'https://hamel-hawks-api.vercel.app';

// Cart state
let cart = [];

// Fetch products from Vercel API
fetch(`${API_BASE_URL}/products`)
  .then(response => {
    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
  })
  .then(data => {
    const productsDiv = document.getElementById('products');
    if (!Array.isArray(data) || data.length === 0) {
      productsDiv.innerHTML = '<p>No products available.</p>';
      return;
    }
    data.forEach(product => {
      const variant = product.sync_variants && product.sync_variants.length > 0 ? product.sync_variants[0] : {};
      const price = variant.retail_price ? parseFloat(variant.retail_price) : 25.00;
      console.log(`Product: ${product.sync_product.name}, API Price: ${variant.retail_price}, Displayed: ${price}`);
      productsDiv.innerHTML += `
        <div class="product">
          <img src="${product.sync_product.thumbnail_url}" alt="${product.sync_product.name}">
          <h2>${product.sync_product.name}</h2>
          <p>$${price.toFixed(2)}</p>
          <button onclick="addToCart('${product.sync_product.id}', '${product.sync_product.name}', ${price})">Add to Cart</button>
        </div>`;
    });
  })
  .catch(error => {
    console.error('Error fetching products:', error);
    productsDiv.innerHTML = '<p>Sorry, unable to load products right now.</p>';
  });

// Cart functions
function addToCart(id, name, price) {
  cart.push({ id, name, price: parseFloat(price) });
  updateCart();
}

function updateCart() {
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');
  const checkoutBtn = document.getElementById('checkout-btn');

  cartItems.innerHTML = '';
  let total = 0;
  cart.forEach(item => {
    total += item.price;
    cartItems.innerHTML += `<li>${item.name} - $${item.price.toFixed(2)}</li>`;
  });
  cartTotal.textContent = total.toFixed(2);
  checkoutBtn.disabled = cart.length === 0;
}

// Checkout with Stripe
document.getElementById('checkout-btn').addEventListener('click', async () => {
  if (cart.length === 0) return;

  try {
    // Create Payment Intent
    const response = await fetch(`${API_BASE_URL}/payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        amount: Math.round(cart.reduce((sum, item) => sum + item.price, 0) * 100) // In cents
      })
    });
    if (!response.ok) throw new Error('Failed to create payment intent');
    const { clientSecret } = await response.json();

    // Confirm payment (test mode; add Stripe Elements later)
    const { error } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: { token: 'tok_visa' } // Test token
      }
    });

    if (error) {
      alert('Payment failed: ' + error.message);
    } else {
      // Submit order to Printful
      const orderResponse = await fetch(`${API_BASE_URL}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart })
      });
      const orderData = await orderResponse.json();
      if (orderResponse.ok) {
        alert('Order placed successfully! Order ID: ' + orderData.orderId);
        cart = [];
        updateCart();
      } else {
        alert('Order submission failed: ' + orderData.error);
      }
    }
  } catch (error) {
    console.error('Checkout error:', error);
    alert('Checkout failed. Please try again.');
  }
});

// Hamburger menu
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  navMenu.classList.toggle('responsive');
});

// Highlight active nav
const navLinks = document.querySelectorAll('.nav-menu .item');
navLinks.forEach(link => {
  if (link.href === window.location.href) {
    link.parentElement.classList.add('active');
  }
});