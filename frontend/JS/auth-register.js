//auth-register.js
document.addEventListener('DOMContentLoaded', function () {
    i18n.setLanguage(localStorage.getItem('lang') || 'es');
    const form = document.getElementById('register-form');
    if (!form) return;
    const authInstance = new Auth();

    // --- TRADUCCIÓN DE OPCIONES DEL SELECT DE PAÍS ---
    const countrySelect = document.getElementById('country');
    if (countrySelect) {
        const options = countrySelect.querySelectorAll('option');
        options.forEach(option => {
            if (!option.value) {
                // Placeholder traducido
                option.textContent = i18n.t('country.selectCountry');
            } else {
                // Nombre país traducido
                const key = `country.countries.${option.value}`;
                let txt = i18n.t(key);
                option.textContent = txt;
            }
        });
    }

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
            country: countrySelect ? countrySelect.value : undefined
        };

        try {
            const { ok, error } = await authInstance.register(formData);
            if (ok) {
                window.location.href = '../login.html';
            } else {
                showErrorMessage(error);
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

