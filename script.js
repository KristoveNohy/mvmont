// Main JavaScript file
document.addEventListener('DOMContentLoaded', function() {
    console.log('Document ready!');
    
    // Mobile menu toggle
    initMobileMenu();
    
    // Contact form validation and submission
    initContactForm();
    
    // Gallery lightbox functionality
    initGallery();
    
    // Gallery filter functionality
    initGalleryFilter();
});

// Mobile Menu Functionality
function initMobileMenu() {
    const toggleBtn = document.querySelector('[data-landingsite-mobile-menu-toggle]');
    const mobileMenu = document.querySelector('[data-landingsite-mobile-menu]');
    
    if (toggleBtn && mobileMenu) {
        toggleBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }
}

// Contact Form Validation and Submission
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const serviceInput = document.getElementById('service');
    const messageInput = document.getElementById('message');
    
    // Real-time validation
    if (nameInput) {
        nameInput.addEventListener('blur', () => validateField(nameInput, 'name-error', 'Prosím, zadajte vaše meno'));
    }
    
    if (emailInput) {
        emailInput.addEventListener('blur', () => validateEmail(emailInput, 'email-error'));
    }
    
    if (phoneInput) {
        phoneInput.addEventListener('blur', () => validateField(phoneInput, 'phone-error', 'Prosím, zadajte telefónne číslo'));
    }
    
    if (serviceInput) {
        serviceInput.addEventListener('change', () => validateField(serviceInput, 'service-error', 'Prosím, vyberte typ služby'));
    }
    
    if (messageInput) {
        messageInput.addEventListener('blur', () => validateField(messageInput, 'message-error', 'Prosím, zadajte vašu správu'));
    }
    
    // Form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validate all fields
        let isValid = true;
        
        if (!validateField(nameInput, 'name-error', 'Prosím, zadajte vaše meno')) {
            isValid = false;
        }
        
        if (!validateEmail(emailInput, 'email-error')) {
            isValid = false;
        }
        
        if (!validateField(phoneInput, 'phone-error', 'Prosím, zadajte telefónne číslo')) {
            isValid = false;
        }
        
        if (!validateField(serviceInput, 'service-error', 'Prosím, vyberte typ služby')) {
            isValid = false;
        }
        
        if (!validateField(messageInput, 'message-error', 'Prosím, zadajte vašu správu')) {
            isValid = false;
        }
        
        if (isValid) {
            // Show success message
            const successMessage = document.getElementById('success-message');
            if (successMessage) {
                successMessage.classList.add('show');
                
                // Reset form
                form.reset();
                
                // Hide success message after 5 seconds
                setTimeout(() => {
                    successMessage.classList.remove('show');
                }, 5000);
                
                // Scroll to success message
                successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            // In a real application, you would send the form data to a server here
            console.log('Form submitted successfully!');
            console.log({
                name: nameInput.value,
                email: emailInput.value,
                phone: phoneInput.value,
                service: serviceInput.value,
                message: messageInput.value
            });
        }
    });
}

// Field validation helper
function validateField(input, errorId, errorMessage) {
    const errorElement = document.getElementById(errorId);
    
    if (!input || !errorElement) return true;
    
    if (input.value.trim() === '') {
        input.classList.add('error');
        errorElement.textContent = errorMessage;
        errorElement.classList.add('show');
        return false;
    } else {
        input.classList.remove('error');
        errorElement.classList.remove('show');
        return true;
    }
}

// Email validation
function validateEmail(input, errorId) {
    const errorElement = document.getElementById(errorId);
    
    if (!input || !errorElement) return true;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (input.value.trim() === '') {
        input.classList.add('error');
        errorElement.textContent = 'Prosím, zadajte e-mail';
        errorElement.classList.add('show');
        return false;
    } else if (!emailRegex.test(input.value)) {
        input.classList.add('error');
        errorElement.textContent = 'Prosím, zadajte platný e-mail';
        errorElement.classList.add('show');
        return false;
    } else {
        input.classList.remove('error');
        errorElement.classList.remove('show');
        return true;
    }
}

// Gallery Lightbox Functionality
function initGallery() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    
    if (!lightbox || !lightboxImg) return;
    
    let currentIndex = 0;
    let visibleItems = Array.from(galleryItems);
    
    // Open lightbox when clicking on gallery item
    galleryItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            currentIndex = parseInt(item.dataset.index);
            openLightbox(item.querySelector('img').src);
        });
    });
    
    // Close lightbox
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }
    
    // Close on background click
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
    
    // Previous image
    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            showPrevImage();
        });
    }
    
    // Next image
    if (lightboxNext) {
        lightboxNext.addEventListener('click', (e) => {
            e.stopPropagation();
            showNextImage();
        });
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        
        if (e.key === 'Escape') {
            closeLightbox();
        } else if (e.key === 'ArrowLeft') {
            showPrevImage();
        } else if (e.key === 'ArrowRight') {
            showNextImage();
        }
    });
    
    function openLightbox(src) {
        lightboxImg.src = src;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    function showPrevImage() {
        updateVisibleItems();
        currentIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
        const prevItem = visibleItems[currentIndex];
        if (prevItem) {
            lightboxImg.src = prevItem.querySelector('img').src;
        }
    }
    
    function showNextImage() {
        updateVisibleItems();
        currentIndex = (currentIndex + 1) % visibleItems.length;
        const nextItem = visibleItems[currentIndex];
        if (nextItem) {
            lightboxImg.src = nextItem.querySelector('img').src;
        }
    }
    
    function updateVisibleItems() {
        const allItems = document.querySelectorAll('.gallery-item');
        visibleItems = Array.from(allItems).filter(item => {
            return window.getComputedStyle(item).display !== 'none';
        });
    }
}

// Gallery Filter Functionality
function initGalleryFilter() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    if (filterButtons.length === 0 || galleryItems.length === 0) return;
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.dataset.filter;
            
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Filter gallery items
            galleryItems.forEach(item => {
                const category = item.dataset.category;
                
                if (filter === 'all' || category === filter) {
                    item.style.display = 'block';
                    // Fade in animation
                    item.style.opacity = '0';
                    setTimeout(() => {
                        item.style.transition = 'opacity 0.3s ease';
                        item.style.opacity = '1';
                    }, 10);
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#' || href === '') return;
        
        e.preventDefault();
        const target = document.querySelector(href);
        
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});