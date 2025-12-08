/**
 * Login Page Logic
 * 
 * @module auth-login
 * @description Script that handles the login form.
 * 
 * Login flow:
 * 1. User enters email and password
 * 2. Real-time validations (via validaciones.js)
 * 3. Submit: disables button and shows "Logging in..."
 * 4. Sends credentials to auth.login()
 * 5. If success: redirects to main.html (dashboard)
 * 6. If error: shows message and re-enables button
 * 
 * Dependencies:
 * - i18n.js: Translations
 * - auth.js: Auth class for authentication
 * - notifications.js: Toast messages
 * - validaciones.js: Field validation
 */
//auth-login.js
document.addEventListener('DOMContentLoaded', function () {
	i18n.setLanguage(localStorage.getItem('lang') || 'es');
	const form = document.getElementById('login-form');

	if (!form) return;
	const authInstance = new Auth();

	/**
	 * Login form submit event handler
	 * 
	 * Process:
	 * 1. Prevents default submission
	 * 2. Disables button and shows "Logging in..."
	 * 3. Gets email and password (trim on email)
	 * 4. Calls authInstance.login(email, password)
	 * 5. If success:
	 *    - Redirects immediately to main.html
	 * 6. If error:
	 *    - Shows translated incorrect credentials message
	 *    - Re-enables button with original text
	 * 7. If exception:
	 *    - Shows connection error message
	 *    - Re-enables button
	 * 
	 * Note: Does not trim() password to preserve intentional spaces
	 */
	form.addEventListener('submit', async function (e) {
		e.preventDefault();

		const submitBtn = form.querySelector('button[type="submit"]');
		const originalText = submitBtn.textContent;
		submitBtn.disabled = true;
		submitBtn.textContent = i18n.t('login.loggingIn');

		const email = document.getElementById('email').value.trim();
		const password = document.getElementById('password').value;

		try {
			const { ok, error } = await authInstance.login(email, password);

			if (ok) {
				window.location.href = '../main.html';
			} else {
				let errorMessage = i18n.t('login.incorrectCredentials');

				if (error) {
					errorMessage = error;
				}

				showErrorMessage(errorMessage);
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
