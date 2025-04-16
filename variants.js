export function groupVariantsByColorAndSize(variants) {
    const colors = [];
    const sizes = [];
    const seenColors = new Set();
    let isOneSize = true;

    variants.forEach(variant => {
        const color = variant.color || 'Default';
        const size = variant.size || null;
        const preview = variant.files.find(f => f.type === 'preview')?.preview_url || 'https://via.placeholder.com/50';

        if (!seenColors.has(color)) {
            seenColors.add(color);
            colors.push({ name: color, variant_id: variant.id, preview_url: preview });
        }

        if (size) {
            sizes.push({ name: size, variant_id: variant.id, color: color });
            if (size !== 'One size') {
                isOneSize = false;
            }
        } else {
            isOneSize = false;
        }
    });

    if (sizes.length > 0 && sizes.every(size => size.name === 'One size')) {
        isOneSize = true;
    } else if (sizes.length === 0) {
        isOneSize = false;
    }

    return { colors, sizes, isOneSize };
}

export function renderVariants(container, variants, defaultVariantId) {
    const { colors, sizes, isOneSize } = groupVariantsByColorAndSize(variants);
    const defaultVariant = variants.find(v => String(v.id) === String(defaultVariantId));
    const defaultColor = defaultVariant.color || 'Default';
    let html = '';

    // Render variant images if multiple colors
    if (colors.length > 1) {
        html += `
            <div class="variant-images">
                ${colors.map(color => `
                    <div class="variant-image-container" style="text-align: center; margin: 0 5px; line-height: 2rem; width: 50px;">
                        <img src="${color.preview_url}" alt="${color.name}" class="variant-image" 
                        data-variant-id="${color.variant_id}" style="${color.variant_id === defaultVariantId ? 
                        'border: 2px solid #4169e1;' : 'border: 1px solid #ddd;'}">
                        <span class="variant-color-name" style="display: block; font-size: 12px; color: #333; margin-top: 5px; line-height: 1rem;">${color.name}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Render size boxes only for multi-size products, filtered by default color
    if (!isOneSize && sizes.length > 1) {
        const filteredSizes = sizes.filter(size => size.color === defaultColor);
        html += `
            <div class="size-boxes">
                ${filteredSizes.map(size => `
                    <div class="size-box" data-variant-id="${size.variant_id}">
                        ${size.name}
                    </div>
                `).join('')}
            </div>
        `;
    } else if (isOneSize && colors.length === 1) {
        html += `<p class="size-note">*One size fits all</p>`;
    }

    container.innerHTML = html;

    // Enable "Add to Cart" button for "One size" products
    if (isOneSize) {
        const productDiv = container.closest('.product');
        const addToCartBtn = productDiv.querySelector('.add-to-cart');
        addToCartBtn.disabled = false;
        addToCartBtn.textContent = 'Add to Cart';
        addToCartBtn.dataset.variantId = defaultVariantId;
    }
}