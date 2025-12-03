/**
 * Theme System - Light/Dark Mode
 * 
 * @module theme
 * @description IIFE (Immediately Invoked Function Expression) that manages the
 * light/dark theme of the application. Persists selection in localStorage and applies
 * the theme via data-theme attribute on <html> element.
 * 
 * Available themes:
 * - 'light': Light theme (default)
 * - 'dark': Dark theme
 * 
 * Theme is applied automatically on page load.
 * Requires CSS with variables that respond to [data-theme="dark"].
 * 
 * @example
 * // Required CSS:
 * :root {
 *   --color-bg: white;
 *   --color-text: black;
 * }
 * [data-theme="dark"] {
 *   --color-bg: black;
 *   --color-text: white;
 * }
 * 
 * // Toggle button HTML:
 * <button id="theme-toggle" aria-label="Toggle theme">
 *   <span class="theme-icon">🌙</span>
 * </button>
 */
// Theme toggle functionality

(function() {
    'use strict';

    /**
     * Gets current theme from localStorage
     * 
     * @function getTheme
     * @private
     * @returns {string} 'light' | 'dark'
     * @default 'light'
     */
    // Get the current theme from localStorage or default to 'light'
    const getTheme = () => {
        return localStorage.getItem('theme') || 'light';
    };

    /**
     * Applies theme to page and saves it in localStorage
     * 
     * @function setTheme
     * @private
     * @param {string} theme - 'light' | 'dark'
     * @returns {void}
     * 
     * @description
     * Sets data-theme attribute on <html> element and
     * saves preference in localStorage with key 'theme'.
     */
    // Set the theme
    const setTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    };

    /**
     * Initializes theme on page load
     * 
     * @function initTheme
     * @private
     * @returns {void}
     * 
     * @description
     * Reads saved theme from localStorage and applies it.
     * If no saved theme, uses 'light' by default.
     */
    // Initialize theme on page load
    const initTheme = () => {
        const currentTheme = getTheme();
        setTheme(currentTheme);
    };

    /**
     * Toggles between light and dark theme
     * 
     * @function toggleTheme
     * @private
     * @returns {void}
     * 
     * @description
     * Switches from light to dark or vice versa.
     * Updates DOM and localStorage automatically.
     */
    // Toggle between light and dark themes
    const toggleTheme = () => {
        const currentTheme = getTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
    };

    // Initialize theme when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }

    // Add event listener to theme toggle button when it exists
    document.addEventListener('DOMContentLoaded', () => {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }
    });
})();
