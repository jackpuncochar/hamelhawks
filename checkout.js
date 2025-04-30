import { fetchProductsData, fetchShippingRates, updateCartPrices } from './utils.js';
import { API_BASE_URL } from './config.js';
import { initAutocomplete } from './autocomplete.js';

const stripe = Stripe('pk_live_51R9ntrJZJy0o2UfjZhZT1KKyUY8vNQ1yGNHN52i4Qh0gErkzjtLN32qIfZtSi3L1owoirPmeC01PAEquWpUfas2o00Q2FaCEc3');
const elements = stripe.elements();
// Create card Elements
const cardNumber = elements.create('cardNumber');
const cardExpiry = elements.create('cardExpiry');
const cardCvc = elements.create('cardCvc');

let cart = JSON.parse(localStorage.getItem('cart')) || [];
const submitButton = document.getElementById('submit');
let freeShipping = true; // enable/disable free shipping globally
let shippingCalculated = false;
let updatedCart = null; // Cache updated cart
let shippingData = null; // Cache shipping cost and dates

const form = document.getElementById('payment-form');
const sameAsShippingCheckbox = document.getElementById('same-as-shipping');
const shippingFields = ['shipping-name', 'shipping-street', 'shipping-city', 'shipping-state', 'shipping-zip', 'shipping-country'];
const billingFieldIds = ['billing-name', 'billing-street', 'billing-city', 'billing-state', 'billing-zip', 'billing-country'];

const USE_GOOGLE_API = true;
let shippingAutocomplete, billingAutocomplete;

// Global state objects
const shippingState = { suggestionBox: null, isVisible: true, pacContainer: null };
const billingState = { suggestionBox: null, isVisible: true, pacContainer: null };

const validStates = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];

const countries = [
    { name: 'United States', code: 'US' },
    // Add more countries as needed, e.g., { name: 'Canada', code: 'CA' }
];
const stateNames = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut',
    'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana',
    'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts',
    'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska',
    'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina',
    'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island',
    'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

function populateDropdowns() {
    const dropdowns = [
        { id: 'shipping-country', options: countries, key: 'name', value: 'code' },
        { id: 'billing-country', options: countries, key: 'name', value: 'code' },
        { id: 'shipping-state', options: validStates.map(state => ({ name: stateNames[state], code: state })), key: 'name', value: 'code' },
        { id: 'billing-state', options: validStates.map(state => ({ name: stateNames[state], code: state })), key: 'name', value: 'code' }
    ];
    dropdowns.forEach(({ id, options, key, value }) => {
        const select = document.getElementById(id);
        options.forEach(opt => select.add(new Option(opt[key], opt[value])));
    });
}

function validateField(fieldId, validationFn, errorMessage) {
    const field = document.getElementById(fieldId);
    const isValid = validationFn(field.value);
    field.classList.toggle('invalid', !isValid);
    const errorDiv = document.getElementById(`${fieldId}-error`);
    if (errorDiv) {
        errorDiv.textContent = isValid ? '' : errorMessage;
        errorDiv.style.display = isValid ? 'none' : 'block';
    }
    return isValid;
}
  
function validateAddress(prefix, address) {
    const zipRegex = /^\d{5}$/;
    const validations = [
        { id: `${prefix}-name`, fn: val => val.trim().length > 0, msg: 'Name is required' },
        { id: `${prefix}-street`, fn: val => val.trim().length > 0, msg: 'Address is required' },
        { id: `${prefix}-city`, fn: val => val.trim().length > 0, msg: 'City is required' },
        { id: `${prefix}-state`, fn: val => validStates.includes(val), msg: 'Select state' },
        { id: `${prefix}-zip`, fn: val => zipRegex.test(val), msg: 'Enter ZIP (5 digits)' },
        { id: `${prefix}-country`, fn: val => countries.some(c => c.code === val), msg: 'Select country' }
    ];

    for (const v of validations) {
        if (!validateField(v.id, v.fn, v.msg)) return v.msg;
    }
    return null;
}


async function validateWithUSPS(address) {
    const response = await fetch(`${API_BASE_URL}/api/usps-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            address: {
                addressLine1: address.address1,
                city: address.city,
                state: address.state,
                zipCode: address.zip
            }
        })
    });
    const data = await response.json();
    if (data.status === 'invalid' || !data.address) {
        throw new Error('Invalid address. Please ensure all fields are accurate.');
    }
    return true;
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout); // Cancel previous call
        timeout = setTimeout(() => {
            timeout = null;
            func.apply(this, args);
        }, wait);
    };
}

// Helper functions for error handling
function showError(errorId, message) {
    const errorDiv = document.getElementById(errorId);
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block !important';
    }
}

function clearErrors() {
    const errorIds = ['shipping-error', 'billing-error', 'email-error', 'card-error', 'general-error', ...
    shippingFields.map(id => `${id}-error`), ...billingFieldIds.map(id => `${id}-error`)];
    errorIds.forEach(id => {
        const errorDiv = document.getElementById(id);
        if (errorDiv && errorDiv.style.display !== 'none') {
            errorDiv.textContent = '';
            errorDiv.style.display = 'none';
        }
    });
    document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
}

function resetButton() {
    submitButton.disabled = false;
    submitButton.textContent = 'Pay now';
}

function updateSubmitButton() {
    const checks = {
        cartEmpty: !cart.length,
        shippingFilled: shippingFields.every(id => document.getElementById(id).value.trim()),
        emailFilled: document.getElementById('email').value.trim(),
        billingFilled: sameAsShippingCheckbox.checked || billingFieldIds.every(id => document.getElementById(id).value.trim()),
        cardNameFilled: document.getElementById('card-name').value.trim(),
        cardComplete: cardNumber._complete && cardExpiry._complete && cardCvc._complete
    };
    // Explicitly check conditions
    const allConditionsMet = (
        !checks.cartEmpty && // cart has items
        checks.shippingFilled && // all shipping fields filled
        checks.emailFilled && // email filled
        checks.billingFilled && // billing fields or checkbox
        checks.cardNameFilled && // card name filled
        checks.cardComplete // all card elements complete
    );

    submitButton.disabled = !allConditionsMet;
    // console.log('Submit button checks:', checks);
    // console.log("submit button disabled?", submitButton.disabled);
}

async function initializeCheckout() {
    updatedCart = JSON.parse(localStorage.getItem('cart')) || [];
    const subtotal = updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    populateDropdowns();
    await displayCheckout();
    if (!updatedCart.length) {
        // console.log('Cart empty on init');
        resetCheckoutDisplay(0, 'Add items to your cart.');
    } else {
        resetCheckoutDisplay(subtotal, 'Complete all fields to calculate shipping.');
    }
}

async function displayCheckout() {
    const checkoutDiv = document.getElementById('checkout');
    const toggleTotal = document.querySelector('.toggle-total');
    if (!cart.length) {
        checkoutDiv.innerHTML = '<p>Your cart is empty.</p>';
        submitButton.disabled = true;
        toggleTotal.textContent = '$0.00';
        return;
    }
    const subtotal = updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    let shippingDisplay = 'Fill out shipping form fields';

    checkoutDiv.innerHTML = `
      <div class="checkout-items">
        ${updatedCart.map(item => `
            <div class="checkout-item">
              <div class="checkout-photo">
                <img src="${item.thumbnail || 'https://via.placeholder.com/50'}" alt="${item.variantName}">
                <span class="checkout-quantity">${item.quantity}</span>
              </div>
              <div class="checkout-details">
                <span>${item.variantName}</span>
                <span>$${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            </div>
        `).join('')}
      </div>
      <div class="checkout-summary">
        <div class="summary-grid">
            <span class="summary-header">Subtotal</span>
            <span class="summary-value">$${subtotal.toFixed(2)}</span>
            <span class="summary-header">Shipping</span>
            <span class="summary-value shipping-value">${shippingDisplay}</span>
            <span class="summary-header">Est. Delivery</span>
            <span class="summary-value delivery-value">${shippingDisplay}</span>
            <span class="summary-header header-total">Total</span>
            <span class="summary-value summary-total">$${subtotal.toFixed(2)}</span>
        </div>
        <div id="shipping-error" style="color: red;"></div>
      </div>
    `;
    toggleTotal.textContent = `$${subtotal.toFixed(2)}`;
    submitButton.disabled = true;
}

function resetCheckoutDisplay(subtotal, errorMessage) {
    const checkoutDiv = document.getElementById('checkout');
    if (!checkoutDiv) return;
    const elements = {
        shippingValue: checkoutDiv.querySelector('.shipping-value'),
        deliveryValue: checkoutDiv.querySelector('.delivery-value'),
        totalValue: checkoutDiv.querySelector('.summary-total'),
        toggleTotal: document.querySelector('.toggle-total'),
        errorDiv: document.getElementById('shipping-error')
    };
    if (Object.values(elements).some(el => !el)) return;
    elements.shippingValue.textContent = 'Enter a valid address to calculate';
    elements.shippingValue.classList.remove('calculated');
    elements.deliveryValue.textContent = 'Enter a valid address to calculate';
    elements.deliveryValue.classList.remove('calculated');
    elements.totalValue.textContent = `$${subtotal.toFixed(2)}`;
    elements.toggleTotal.textContent = `$${subtotal.toFixed(2)}`;
    elements.errorDiv.textContent = errorMessage || '';
    elements.errorDiv.style.display = 'block';
    submitButton.disabled = true;
    shippingCalculated = false;
    shippingData = null;
}

async function calculateShipping() {
    submitButton.disabled = true;
    const shippingAddress = {
        name: document.getElementById('shipping-name').value,
        address1: document.getElementById('shipping-street').value,
        city: document.getElementById('shipping-city').value,
        state: document.getElementById('shipping-state').value,
        zip: document.getElementById('shipping-zip').value,
        country_code: document.getElementById('shipping-country').value
    };

    const checkoutDiv = document.getElementById('checkout');
    const elements = {
        shippingValue: checkoutDiv.querySelector('.shipping-value'),
        deliveryValue: checkoutDiv.querySelector('.delivery-value'),
        totalValue: checkoutDiv.querySelector('.summary-total'),
        toggleTotal: document.querySelector('.toggle-total'),
        errorDiv: document.getElementById('shipping-error')
    };
    elements.shippingValue.textContent = 'Calculating...';
    elements.deliveryValue.textContent = 'Calculating...';
    elements.errorDiv.style.color = 'red';
    elements.errorDiv.textContent = 'Calculating shipping costs...';
    elements.toggleTotal.textContent = 'Calculating...';
    elements.shippingValue.classList.remove('calculated');
    elements.deliveryValue.classList.remove('calculated');

    const inputs = shippingFields.map(id => document.getElementById(id));
    inputs.forEach(el => { el.disabled = true; el.style.cursor = 'not-allowed'; });

    try {
        const validationError = validateAddress('shipping', shippingAddress);
        if (validationError) {
            showError('shipping-error', validationError);
            resetCheckoutDisplay(updatedCart ? updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0) : 0, validationError);
            return;
        }

        // console.log("Validating with USPS");
        await validateWithUSPS(shippingAddress);
        const productsData = await fetchProductsData();
        updatedCart = updateCartPrices(cart, productsData);
        const subtotal = updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const { shippingCost, minDeliveryDate, maxDeliveryDate } = await fetchShippingRates(updatedCart, shippingAddress);

        const formatDate = dateStr => {
            if (dateStr === 'TBD') return 'TBD';
            const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!match) return dateStr;
            const [, year, month, day] = match;
            const date = new Date(year, month - 1, day);
            return isNaN(date.getTime()) ? dateStr : date.toLocaleString('en-US', { month: 'short', day: '2-digit' });
        };
        const deliveryRange = `${formatDate(minDeliveryDate)} - ${formatDate(maxDeliveryDate)}`;
        
        // Determine if free shipping applies
        const isMinnesotaCustomer = shippingAddress.state.toUpperCase() === 'MN';
        const applyFreeShipping = freeShipping && isMinnesotaCustomer;

        // Calculate effective shipping cost (what the customer pays)
        const effectiveShippingCost = applyFreeShipping ? 0 : shippingCost;

        // Calculate total and display shipping cost
        const displayedShippingCost = applyFreeShipping ? 'FREE' : `$${shippingCost.toFixed(2)}`;
        const total = subtotal + effectiveShippingCost;

        elements.shippingValue.textContent = displayedShippingCost;
        elements.shippingValue.setAttribute('data-label', displayedShippingCost);
        elements.shippingValue.classList.add('calculated');
        elements.deliveryValue.textContent = deliveryRange;
        elements.deliveryValue.classList.add('calculated');
        elements.totalValue.textContent = `$${total.toFixed(2)}`;
        elements.toggleTotal.textContent = `$${total.toFixed(2)}`;
        
        if (applyFreeShipping) {
            elements.errorDiv.textContent = 'Free shipping applied for Minnesota customers!';
            elements.errorDiv.style.color = '#28a745';
        } else {
            elements.errorDiv.textContent = '';
        }

        shippingData = { shippingCost, effectiveShippingCost, minDeliveryDate, maxDeliveryDate, deliveryRange };
        shippingCalculated = true;
        updateSubmitButton();
    } catch (error) {
        const subtotal = updatedCart ? updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0) : 0;
        resetCheckoutDisplay(subtotal, error.message.includes('Address not found') ? 'Address not found. Please verify.' : error.message);
    } finally {
        inputs.forEach(el => { el.disabled = false; el.style.cursor = ''; });
    }
}

async function checkout(event) {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
    // clearErrors();

    const shippingAddress = {
        name: document.getElementById('shipping-name').value,
        address1: document.getElementById('shipping-street').value,
        city: document.getElementById('shipping-city').value,
        state: document.getElementById('shipping-state').value,
        zip: document.getElementById('shipping-zip').value,
        country: document.getElementById('shipping-country').value
    };

    const formData = {
        email: document.getElementById('email').value,
        cardName: document.getElementById('card-name').value,
        shippingAddress,
        billingAddress: sameAsShippingCheckbox.checked ? null : {
            name: document.getElementById('billing-name').value,
            address1: document.getElementById('billing-street').value,
            city: document.getElementById('billing-city').value,
            state: document.getElementById('billing-state').value,
            zip: document.getElementById('billing-zip').value,
            country: document.getElementById('billing-country').value
        }
    };

    if (!formData.billingAddress) {
        formData.billingAddress = formData.shippingAddress;
    }

    try {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            showError('email-error', 'Please enter a valid email address.');
            resetButton();
            return;
        }

        let shippingError = validateAddress('shipping', formData.shippingAddress);
        if (shippingError) {
            showError('shipping-error', `Shipping: ${shippingError}`);
            resetButton();
            return;
        }

        if (!sameAsShippingCheckbox.checked) {
            let billingError = validateAddress('billing', formData.billingAddress);
            if (billingError) {
                showError('billing-error', `Billing: ${billingError}`);
                resetButton();
                return;
            }
        }

        const cardComplete = cardNumber._complete && cardExpiry._complete && cardCvc._complete;
        if (!cardComplete) {
            showError('card-error', 'Please complete all card details correctly.');
            resetButton();
            return;
        }

        if (!formData.cardName.trim()) {
            showError('card-error', 'Please enter the name on the card.');
            resetButton();
            return;
        }

        if (!shippingData) {
            showError('general-error', 'Please calculate shipping before proceeding.');
            resetButton();
            return;
        }

        await validateWithUSPS(formData.shippingAddress);
        if (!sameAsShippingCheckbox.checked) {
            await validateWithUSPS(formData.billingAddress);
        }

        const subtotal = updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        
        // Use effectiveShippingCost for the customer's total
        const effectiveShippingCost = shippingData.effectiveShippingCost;
        const total = subtotal + effectiveShippingCost;
        const amount = Math.round(total * 100);

        const paymentResponse = await fetch(`${API_BASE_URL}/api/payment-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        const { clientSecret, paymentIntentId } = await paymentResponse.json();

        const result = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardNumber,
                billing_details: {
                    name: formData.cardName,
                    address: {
                        line1: formData.billingAddress.address1,
                        city: formData.billingAddress.city,
                        state: formData.billingAddress.state,
                        postal_code: formData.billingAddress.zip,
                        country: formData.billingAddress.country_code
                    },
                    email: formData.email
                }
            }
        });

        if (result.error) {
            showError('card-error', result.error.message);
            resetButton();
            return;
        }

        if (result.paymentIntent.status !== 'requires_capture') {
            showError('card-error', 'Payment authorization failed. Please try again.');
            resetButton();
            return;
        }

        const orderPayload = {
            items: updatedCart,
            shippingAddress: formData.shippingAddress,
            billingAddress: formData.billingAddress,
            email: formData.email,
            total,
            deliveryRange: shippingData.deliveryRange,
            paymentIntentId // Include for capture/cancel in order.js
        };
        const orderResponse = await fetch(`${API_BASE_URL}/api/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });

        if (!orderResponse.ok) {
            const orderError = await orderResponse.json();
            showError('general-error', `Order error: ${orderError.error || 'Failed to process order'} You were not charged.`);
            resetButton();
            return;
        }

        const orderData = await orderResponse.json();
        const orderId = orderData.orderId;
        const shippingAddressFormatted = `${formData.shippingAddress.address1}, ${formData.shippingAddress.city}, ${formData.shippingAddress.state} ${formData.shippingAddress.zip}`;
        localStorage.setItem('orderId', orderId);
        localStorage.setItem('shippingAddress', shippingAddressFormatted);
        localStorage.setItem('deliveryRange', shippingData.deliveryRange);
        localStorage.removeItem('cart');
        window.location.href = 'confirmation.html';
    } catch (error) {
        showError('general-error', 'An unexpected error occurred. Please try again.');
        resetButton();
    }
}

function validateAndShow(prefix) {
    const fields = prefix === 'shipping' ? shippingFields : billingFieldIds;
    const address = fields.reduce((obj, id) => ({
        ...obj,
        [id.replace(`${prefix}-`, '')]: document.getElementById(id).value
    }), { address1: '' });
    address.address1 = address.street;
    delete address.street;

    if (!Object.values(address).every(val => val.trim())) {
        clearErrors(prefix + '-error');
        return;
    }

    const error = validateAddress(prefix, address);
    if (error) showError(prefix + '-error', error);
}

const debouncedCalculateShipping = debounce(() => {
    if (shippingFields.every(id => document.getElementById(id).value.trim())) {
        calculateShipping();
    } else {
        const subtotal = updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        resetCheckoutDisplay(subtotal, 'Complete all fields to calculate shipping.');
    }
}, 500);
const debouncedValidateShipping = debounce(() => validateAndShow('shipping'), 500);
const debouncedValidateBilling = debounce(() => validateAndShow('billing'), 500);

function setupFieldListeners() {
    const billingFields = document.getElementById('billing-fields');
    if (!billingFields) return;

    if (sameAsShippingCheckbox.checked) {
        billingFields.classList.add('hidden');
        billingFieldIds.forEach(id => document.getElementById(id).removeAttribute('required'));
    } else {
        billingFields.classList.remove('hidden');
        billingFieldIds.forEach(id => document.getElementById(id).setAttribute('required', ''));
    }

    shippingFields.forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('blur', debouncedValidateShipping);
        el.addEventListener('blur', debouncedCalculateShipping);
        el.addEventListener('keydown', e => e.key === 'Enter' && (e.preventDefault(), debouncedCalculateShipping()));
        if (el.tagName === 'SELECT') el.addEventListener('change', debouncedCalculateShipping);
        el.addEventListener('input', updateSubmitButton);
    });

    billingFieldIds.forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('input', debouncedValidateBilling);
        el.addEventListener('blur', debouncedValidateBilling);
        el.addEventListener('keydown', e => e.key === 'Enter' && (e.preventDefault(), debouncedValidateBilling()));
        if (el.tagName === 'SELECT') el.addEventListener('change', debouncedValidateBilling);
        el.addEventListener('input', updateSubmitButton);
    });

    cardNumber.mount('#card-number');
    cardExpiry.mount('#card-expiry');
    cardCvc.mount('#card-cvc');

    [cardNumber, cardExpiry, cardCvc].forEach(element => {
        element.on('change', (event) => {
            clearErrors('card-error');
            if (event.error) {
                showError('card-error', event.error.message);
            }
            updateSubmitButton();
        });
        element.on('input', () => updateSubmitButton());
        element.on('ready', () => updateSubmitButton());
        element.on('blur', () => updateSubmitButton());
    });

    document.getElementById('card-name').addEventListener('input', updateSubmitButton);
    document.getElementById('email').addEventListener('input', updateSubmitButton);

    sameAsShippingCheckbox.addEventListener('change', e => {
        billingFields.classList.toggle('hidden', e.target.checked);
        billingFieldIds.forEach(id => {
            const input = document.getElementById(id);
            input.toggleAttribute('required', !e.target.checked);
            if (e.target.checked) {
                input.value = '';
            }
        });
        if (!e.target.checked && USE_GOOGLE_API && window.google?.maps?.places) {
            if (billingAutocomplete) {
                google.maps.event.clearInstanceListeners(billingAutocomplete);
                billingAutocomplete = null;
            }
            billingAutocomplete = initAutocomplete('billing-street', billingFieldIds, billingState);
        }
        updateSubmitButton();
    });

    form?.addEventListener('submit', checkout);
}

function setupFormFieldAnimations() {
    document.querySelectorAll('#payment-form .form-field').forEach(field => {
        const input = field.querySelector('input, select');
        if (!input) return;
        if (input.value || (input.tagName === 'SELECT' && input.value)) field.classList.add('active');
        input.addEventListener('input', () => field.classList.toggle('active', !!input.value));
        input.addEventListener('focus', () => field.classList.add('active'));
        input.addEventListener('blur', () => !input.value && field.classList.remove('active'));
        if (input.tagName === 'SELECT') {
            input.addEventListener('change', () => field.classList.toggle('active', !!input.value));
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeCheckout();
    setupFieldListeners();
    setupFormFieldAnimations();
    if (USE_GOOGLE_API) {
        const loadGoogleAPI = (retries = 3, delay = 1000) => {
            if (document.querySelector('script[src*="maps.googleapis.com"]')) {
                if (window.google?.maps?.places) {
                    shippingAutocomplete = initAutocomplete('shipping-street', shippingFields, {});
                    if (!sameAsShippingCheckbox.checked) {
                        billingAutocomplete = initAutocomplete('billing-street', billingFieldIds, {});
                    }
                }
                return;
            }
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyCO3Tw7s4q05CNB1-TWF6kzooFnNDGDj1g&libraries=places&v=weekly`;
            script.async = true;
            script.onload = async () => {
                await google.maps.importLibrary('places');
                if (window.google?.maps?.places) {
                    shippingAutocomplete = initAutocomplete('shipping-street', shippingFields, {});
                    if (!sameAsShippingCheckbox.checked) {
                        billingAutocomplete = initAutocomplete('billing-street', billingFieldIds, {});
                    }
                } else if (retries > 0) {
                    setTimeout(() => loadGoogleAPI(retries - 1, delay * 2), delay);
                } else {
                    showError('general-error', 'Address autocomplete unavailable. Using manual entry.');
                }
            };
            script.onerror = () => retries > 0 ? setTimeout(() => loadGoogleAPI(retries - 1, delay * 2), delay) : showError('general-error', 'Failed to load address autocomplete.');
            document.head.appendChild(script);
        };
        loadGoogleAPI();
    } else {
        shippingAutocomplete = initAutocomplete('shipping-street', shippingFields, {});
        if (!sameAsShippingCheckbox.checked) {
            billingAutocomplete = initAutocomplete('billing-street', billingFieldIds, {});
        }
    }
});