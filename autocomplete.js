export function fillFields(fields, address, suggestionBox, state) {
    const addressFields = fields.slice(1); // Exclude name
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
    countrySelect.value = address.country || '';

    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el.value) {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    suggestionBox.style.display = 'none';
    if (state.pacContainer) state.pacContainer.style.display = 'none';
    state.isVisible = false;
}

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
    suggestions.forEach((addr, index) => {
        const div = document.createElement('div');
        div.textContent = `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}, ${addr.country}`;
        div.className = 'suggestion-item';
        div.addEventListener('click', event => {
            event.stopPropagation();
            fillFields(fields, addr, suggestionBox, state);
        });
        suggestionBox.appendChild(div);
    });
    suggestionBox.style.display = 'block';
}

export function initAutocomplete(fieldId, fields, state) {
    const input = document.getElementById(fieldId);
    if (!input) {
        console.error(`Input #${fieldId} not found`);
        return null;
    }

    let suggestionBox = document.getElementById(`${fieldId}-suggestion-box`);
    if (!suggestionBox) {
        suggestionBox = document.createElement('div');
        suggestionBox.id = `${fieldId}-suggestion-box`;
        suggestionBox.className = 'suggestion-box';
        input.parentNode.insertBefore(suggestionBox, input.nextSibling);
    }
    state.suggestionBox = suggestionBox;

    const closeButton = document.createElement('div');
    closeButton.className = 'suggestion-close-button';
    closeButton.innerHTML = '×';
    closeButton.title = 'Close suggestions';
    closeButton.addEventListener('click', event => {
        event.stopPropagation();
        state.isVisible = false;
        suggestionBox.style.display = 'none';
        input.focus();
    });

    if (window.google?.maps?.places) {
        const autocomplete = new google.maps.places.Autocomplete(input, {
            componentRestrictions: { country: 'us' },
            fields: ['address_components', 'geometry', 'formatted_address'],
            types: ['address']
        });

        const handlePlaceChanged = () => {
            const place = autocomplete.getPlace();
            if (!place?.geometry) {
                input.value = '';
                state.isVisible = false;
                return;
            }

            const address = {
                street: `${place.address_components.find(c => c.types.includes('street_number'))?.long_name || ''} ${place.address_components.find(c => c.types.includes('route'))?.long_name || ''}`.trim(),
                city: place.address_components.find(c => c.types.includes('locality'))?.long_name || '',
                state: place.address_components.find(c => c.types.includes('administrative_area_level_1'))?.short_name || '',
                zip: place.address_components.find(c => c.types.includes('postal_code'))?.long_name || '',
                country: place.address_components.find(c => c.types.includes('country'))?.short_name || 'US'
            };

            // Suppress events to prevent retrigger
            const suppressEvents = e => e.stopPropagation();
            input.addEventListener('input', suppressEvents, { capture: true, once: true });
            input.addEventListener('change', suppressEvents, { capture: true, once: true });

            input.value = address.street;
            fillFields(fields, address, suggestionBox, state);

            // Minimal pac-container cleanup
            const pacContainer = document.querySelector('.pac-container');
            if (pacContainer) {
                pacContainer.style.display = 'none';
                state.pacContainer = null;
            }
        };

        // Remove previous listeners to prevent duplicates
        google.maps.event.clearInstanceListeners(autocomplete);
        autocomplete.addListener('place_changed', handlePlaceChanged);

        // Handle outside clicks
        const handleOutsideClick = event => {
            const pacContainer = document.querySelector('.pac-container');
            if (pacContainer && !pacContainer.contains(event.target) && event.target !== input) {
                pacContainer.style.display = 'none';
                state.isVisible = false;
                state.pacContainer = null;
            }
        };
        document.removeEventListener('click', handleOutsideClick, { capture: true });
        document.addEventListener('click', handleOutsideClick, { capture: true });

        return autocomplete;
    }

    suggestionBox.appendChild(closeButton);
    input.addEventListener('input', () => {
        const value = input.value.toLowerCase();
        if (value.length < 3) {
            suggestionBox.innerHTML = '';
            suggestionBox.appendChild(closeButton);
            suggestionBox.style.display = 'none';
            state.isVisible = false;
            return;
        }
        const matches = mockAddresses.filter(addr =>
            addr.street.toLowerCase().includes(value) ||
            addr.city.toLowerCase().includes(value) ||
            addr.zip.includes(value)
        );
        showSuggestions(value, matches, suggestionBox, fields, closeButton, state);
    });
    return null;
}