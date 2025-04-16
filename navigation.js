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
    navLinks.forEach(link => {
        if (link.href === window.location.href) {
            link.parentElement.classList.add('active');
        }
    });
});