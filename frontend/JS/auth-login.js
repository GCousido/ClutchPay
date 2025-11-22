//auth-login.js
document.addEventListener('DOMContentLoaded', function () {
	i18n.setLanguage(localStorage.getItem('lang') || 'es');
	const form = document.getElementById('login-form');

	if (!form) return;
	const authInstance = new Auth();

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

				alert(errorMessage);
				submitBtn.disabled = false;
				submitBtn.textContent = originalText;
			}
		} catch (error) {
			console.error('Error:', error);
			alert(i18n.t('general.connectionError'));
			submitBtn.disabled = false;
			submitBtn.textContent = originalText;
		}
	});
});
