// --------------------------------------------
// Utility: debounce
// --------------------------------------------
function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// --------------------------------------------
// Helper: fill fields from address object
// --------------------------------------------
export function fillFields(fields, address, suggestionBox, state) {
    const addressFields = fields.slice(1); // exclude name

    addressFields.forEach(id => {
        const el = document.getElementById(id);
        if (el && (!el.value.trim() || el.classList.contains('invalid'))) {
            el.value = '';
        }
    });

    document.getElementById(fields[1]).value = address.street || '';
    document.getElementById(fields[2]).value = address.city || '';

    const stateSelect = document.getElementById(fields[3]);
    stateSelect.value = address.state || '';

    document.getElementById(fields[4]).value = address.zip || '';

    const countrySelect = document.getElementById(fields[5]);
    countrySelect.value = address.country || 'US';

    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el?.value) {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    suggestionBox.style.display = 'none';
    state.isVisible = false;
}

// --------------------------------------------
// Helper: show fallback suggestions (non-Google)
// --------------------------------------------
export function showSuggestions(input, suggestions, suggestionBox, fields, closeButton, state) {
    suggestionBox.innerHTML = '';

    const header = document.createElement('h3');
    header.textContent = 'Suggestions';
    suggestionBox.appendChild(header);
    suggestionBox.appendChild(closeButton);

    if (!suggestions.length) {
        suggestionBox.style.display = 'none';
        return;
    }

    suggestions.forEach(addr => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}, ${addr.country}`;

        div.addEventListener('click', e => {
            e.stopPropagation();
            fillFields(fields, addr, suggestionBox, state);
        });

        suggestionBox.appendChild(div);
    });

    suggestionBox.style.display = 'block';
    state.isVisible = true;
}

// --------------------------------------------
// Public API: initAutocomplete
// --------------------------------------------
export function initAutocomplete(fieldId, fields, state, enabled = true) {
    if (!enabled) {
        state.enabled = false;
        return null;
    }

    const input = document.getElementById(fieldId);
    if (!input) {
        console.error(`Autocomplete input #${fieldId} not found`);
        return null;
    }

    // Initialize state
    state.enabled ??= true;
    state.autocomplete ??= null;
    state.handleOutsideClick ??= null;
    state.handlePlaceChanged ??= null;

    // Suggestion box
    let suggestionBox = document.getElementById(`${fieldId}-suggestion-box`);
    if (!suggestionBox) {
        suggestionBox = document.createElement('div');
        suggestionBox.id = `${fieldId}-suggestion-box`;
        suggestionBox.className = 'suggestion-box';
        input.parentNode.insertBefore(suggestionBox, input.nextSibling);
    }
    state.suggestionBox = suggestionBox;

    // Close button
    const closeButton = document.createElement('div');
    closeButton.className = 'suggestion-close-button';
    closeButton.innerHTML = '×';
    closeButton.title = 'Close suggestions';

    closeButton.addEventListener('click', e => {
        e.stopPropagation();
        suggestionBox.style.display = 'none';
        state.isVisible = false;
        input.focus();
    });

    // --------------------------------------------
    // Disable autocomplete cleanly
    // --------------------------------------------
    state.disable = () => {
        state.enabled = false;

        if (state.autocomplete) {
            google.maps.event.clearInstanceListeners(state.autocomplete);
            state.autocomplete = null;
        }

        if (state.handleOutsideClick) {
            document.removeEventListener('click', state.handleOutsideClick, { capture: true });
            state.handleOutsideClick = null;
        }

        suggestionBox.style.display = 'none';
    };

    // --------------------------------------------
    // Enable autocomplete cleanly
    // --------------------------------------------
    state.enable = () => {
        if (!window.google?.maps?.places || !state.enabled) return;

        // Cleanup previous instance
        state.disable();
        state.enabled = true;

        const autocomplete = new google.maps.places.Autocomplete(input, {
            componentRestrictions: { country: 'us' },
            fields: ['address_components', 'geometry'],
            types: ['address']
        });

        const handlePlaceChanged = () => {
            const place = autocomplete.getPlace();
            if (!place?.geometry) return;

            const get = type =>
                place.address_components.find(c => c.types.includes(type))?.long_name || '';

            const address = {
                street: `${get('street_number')} ${get('route')}`.trim(),
                city: get('locality'),
                state: place.address_components.find(c =>
                    c.types.includes('administrative_area_level_1')
                )?.short_name || '',
                zip: get('postal_code'),
                country: 'US'
            };

            input.value = address.street;
            fillFields(fields, address, suggestionBox, state);

            // Hide suggestion box safely
            const pac = document.querySelector('.pac-container');
            if (pac) pac.style.display = 'none';
            state.isVisible = false;
        };

        const handleOutsideClick = event => {
            const pac = document.querySelector('.pac-container');
            if (pac && !pac.contains(event.target) && event.target !== input) {
                pac.style.display = 'none';
                state.isVisible = false;
            }
        };

        autocomplete.addListener('place_changed', handlePlaceChanged);
        document.addEventListener('click', handleOutsideClick, { capture: true });

        state.autocomplete = autocomplete;
        state.handlePlaceChanged = handlePlaceChanged;
        state.handleOutsideClick = handleOutsideClick;
    };

    // --------------------------------------------
    // Fallback input logic (debounced, no API calls)
    // --------------------------------------------
    const debouncedFallback = debounce(() => {
        if (!state.enabled || window.google?.maps?.places) return;

        const value = input.value.toLowerCase();

        if (value.length < 3) {
            suggestionBox.style.display = 'none';
            state.isVisible = false;
            return;
        }

        const matches = mockAddresses.filter(addr =>
            addr.street.toLowerCase().includes(value) ||
            addr.city.toLowerCase().includes(value) ||
            addr.zip.includes(value)
        );

        if (matches.length) {
            showSuggestions(value, matches, suggestionBox, fields, closeButton, state);
        } else {
            suggestionBox.style.display = 'none';
            state.isVisible = false;
        }
    }, 300);

    input.addEventListener('input', debouncedFallback);

    // Start enabled by default
    state.enable();

    return state;
}