/**
 * Dashboard Mobile Module
 * 
 * @module dashboard/mobile
 * @description Handles mobile-specific UI functionality including
 * hamburger menu toggle and mobile menu interactions.
 * 
 * Exports:
 * - DashboardMobile: Mobile UI management class
 * 
 * Features:
 * - Hamburger menu toggle
 * - Close menu on outside click
 * - Close menu when clicking buttons
 */

class DashboardMobile {
    /**
     * Creates DashboardMobile instance
     * 
     * @param {DashboardCore} core - Dashboard core instance (unused, for consistency)
     */
    constructor(core) {
        this.core = core;
        this.sidebar = null;
        this.menuToggle = null;
        this.mobileMenu = null;
    }

    /**
     * Initializes mobile module
     * 
     * @description
     * Sets up:
     * - Hamburger menu toggle
     * - Outside click to close
     * - Button click to close menu
     */
    init() {
        this.sidebar = document.getElementById('sidebar');
        this.menuToggle = document.getElementById('menu-toggle');
        this.mobileMenu = document.getElementById('mobile-menu');

        if (this.menuToggle && this.mobileMenu) {
            this.initMenuToggle();
            this.initOutsideClick();
            this.initButtonClick();
        }
    }

    /**
     * Initializes hamburger menu toggle
     * 
     * @description
     * Toggles .active class on menu toggle button and mobile menu
     */
    initMenuToggle() {
        this.menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.menuToggle.classList.toggle('active');
            this.mobileMenu.classList.toggle('active');
        });
    }

    /**
     * Initializes outside click to close menu
     * 
     * @description
     * Closes mobile menu when clicking outside sidebar/menu area
     */
    initOutsideClick() {
        document.addEventListener('click', (e) => {
            if (this.sidebar && !this.sidebar.contains(e.target) && !this.mobileMenu.contains(e.target)) {
                this.menuToggle.classList.remove('active');
                this.mobileMenu.classList.remove('active');
            }
        });
    }

    /**
     * Initializes button click to close menu
     * 
     * @description
     * Closes mobile menu when clicking any button inside the menu
     */
    initButtonClick() {
        this.mobileMenu.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn') || e.target.closest('.btn')) {
                this.menuToggle.classList.remove('active');
                this.mobileMenu.classList.remove('active');
            }
        });
    }
}
