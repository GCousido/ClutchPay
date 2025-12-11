/**
 * Registration Page Logic
 * 
 * @module auth-register
 * @description Script that handles the new user registration form.
 * Includes dynamic country selector translation and form validation.
 * 
 * Registration flow:
 * 1. User fills out form
 * 2. Real-time validations (via validaciones.js)
 * 3. Submit: disables button and shows loading state
 * 4. Sends data to auth.register()
 * 5. If success: shows notification and redirects to login after 1.5s
 * 6. If error: shows message and re-enables button
 * 
 * Dependencies:
 * - i18n.js: Translations
 * - auth.js: Auth class for registration
 * - notifications.js: Toast messages
 * - validaciones.js: Field validation
 */
//auth-register.js
document.addEventListener('DOMContentLoaded', function () {
    i18n.setLanguage(localStorage.getItem('lang') || 'es');
    const form = document.getElementById('register-form');
    if (!form) return;
    const authInstance = new Auth();

    /**
     * Dynamic country selector translation
     * 
     * @description
     * Iterates over all options in #country select and:
     * - Translates placeholder (option without value)
     * - Translates each country name using i18n.t('country.countries.{code}')
     * 
     * Supports 69 countries with ES/EN translations
     */
    // --- COUNTRY SELECT OPTIONS TRANSLATION ---
    const countrySelect = document.getElementById('country');
    if (countrySelect) {
        const options = countrySelect.querySelectorAll('option');
        options.forEach(option => {
            if (!option.value) {
                // Translated placeholder
                option.textContent = i18n.t('country.selectCountry');
            } else {
                // Translated country name
                const key = `country.countries.${option.value}`;
                let txt = i18n.t(key);
                option.textContent = txt;
            }
        });
    }

    /**
     * Form submit event handler
     * 
     * @description
     * Process:
     * 1. Prevents default submission
     * 2. Disables button and shows "Creating account..."
     * 3. Collects form data (trim on text fields)
     * 4. Calls authInstance.register(formData)
     * 5. If success:
     *    - Shows success notification
     *    - Waits 1.5s and redirects to login.html
     * 6. If error:
     *    - Shows backend error message
     *    - Re-enables button with original text
     * 7. If exception (network error):
     *    - Shows generic connection message
     *    - Re-enables button
     * 
     * Submitted fields:
     * @property {string} name - User's first name
     * @property {string} surnames - User's last names
     * @property {string} email - User's email
     * @property {string} password - Password (no trim for security)
     * @property {string} phone - Phone in international format
     * @property {string} country - ISO country code
     */
    // --- Submit del registro ---
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = i18n.t('register.creatingAccount');

        const formData = {
            name: document.getElementById('name').value.trim(),
            surnames: document.getElementById('surnames').value.trim(),
            email: document.getElementById('email').value.trim(),
            password: document.getElementById('password').value,
            phone: document.getElementById('phone').value.trim(),
            country: countrySelect ? countrySelect.value : undefined,
        };

        // Clear previous error messages
        document.querySelectorAll('.field-error').forEach(el => el.remove());
        document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

        try {
            const { ok, error } = await authInstance.register(formData);
            if (ok) {
                showSuccessMessage(i18n.t('register.creatingAccount') || 'Registro exitoso');
                setTimeout(() => {
                    window.location.href = '../login.html';
                }, 1500);
            } else {
                // Check if error is an object with field-specific errors
                if (typeof error === 'object' && error !== null && !error.message) {
                    // Display field-specific errors
                    let hasErrors = false;
                    for (const [field, message] of Object.entries(error)) {
                        const input = document.getElementById(field);
                        if (input) {
                            hasErrors = true;
                            input.classList.add('input-error');
                            
                            // Create error message element
                            const errorEl = document.createElement('div');
                            errorEl.className = 'field-error';
                            errorEl.textContent = message;
                            errorEl.style.color = '#ef4444';
                            errorEl.style.fontSize = '0.85rem';
                            errorEl.style.marginTop = '0.25rem';
                            
                            // Insert after input
                            input.parentNode.insertBefore(errorEl, input.nextSibling);
                        }
                    }
                    if (hasErrors) {
                        showErrorMessage(i18n.t('register.errors.validationFailed') || 'Por favor, corrige los errores en el formulario');
                    } else {
                        showErrorMessage(JSON.stringify(error));
                    }
                } else {
                    // Display general error message
                    showErrorMessage(error.message || error);
                }
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        } catch (error) {
            console.error('Error:', error);
            showErrorMessage(i18n.t('general.connectionError'));
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
});