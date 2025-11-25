// Theme toggle functionality

(function() {
    'use strict';

    // Get the current theme from localStorage or default to 'light'
    const getTheme = () => {
        return localStorage.getItem('theme') || 'light';
    };

    // Set the theme
    const setTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    };

    // Initialize theme on page load
    const initTheme = () => {
        const currentTheme = getTheme();
        setTheme(currentTheme);
    };

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
