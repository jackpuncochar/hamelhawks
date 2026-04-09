// navigation.js
document.addEventListener('DOMContentLoaded', () => {
    // Hamburger menu
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('responsive');
        });
    }

    // Highlight active nav
    const navLinks = document.querySelectorAll('.nav-menu .item');
    const currentPath = window.location.pathname.replace(/\/$/, '');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return; // skip dropdown toggles and non-page links
        }

        const linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/$/, '');
        if (linkPath === currentPath || (currentPath === '' && linkPath === '/index.html')) {
            link.parentElement.classList.add('active');
        }
    });
});