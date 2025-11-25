function validateOnlyLettersMin3(input) {
	if (!input) return;
	const value = input.value || '';

	const letters = (value.match(/[A-Za-zÁÉÍÓÚáéíóúÑñÜü]/g) || []).length;
	const onlyAllowed = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü ]*$/.test(value);

	if (!onlyAllowed) {
		input.setCustomValidity('Solo se permiten letras y espacios');
		return false;
	} else if (letters < 3) {
		input.setCustomValidity('Mínimo 3 letras');
		return false;
	} else {
		input.setCustomValidity('');
		return true;
	}
}

function validateInternationalPhone(input) {
	if (!input) return;
	const value = input.value.trim();

	if (!value) {
		input.setCustomValidity('');
		return true;
	}

	const cleaned = value.replace(/[\s\-()]/g, '');

	const internationalFormat = /^\+[1-9]\d{7,14}$/;

	const isValid = internationalFormat.test(cleaned);

	if (!isValid) {
		input.setCustomValidity('Formato válido: +[código país][número] (ej: +34123456789)');
		return false;
	} else {
		input.setCustomValidity('');
		return true;
	}
}

function validatePasswordMatch(pwd1, pwd2) {
	if (!pwd1 || !pwd2) return false;

	if (pwd1.value !== pwd2.value) {
		pwd2.setCustomValidity('Las contraseñas no coinciden');
		return false;
	} else {
		pwd2.setCustomValidity('');
		return true;
	}
}

function validateEmail(input) {
	if (!input) return false;

	const value = input.value.trim();

	if (!value) {
		input.setCustomValidity('El correo electrónico es obligatorio');
		return false;
	}

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(value)) {
		input.setCustomValidity('Ingresa un correo electrónico válido (ejemplo@correo.com)');
		return false;
	}

	input.setCustomValidity('');
	return true;
}

function validatePassword(input, minLength = 8) {
	if (!input) return false;

	const value = input.value;

	if (!value) {
		input.setCustomValidity('La contraseña es obligatoria');
		return false;
	}

	if (value.length < minLength) {
		input.setCustomValidity(`La contraseña debe tener al menos ${minLength} caracteres`);
		return false;
	}

	input.setCustomValidity('');
	return true;
}

function initLoginValidations() {
	const form = document.getElementById('login-form');
	const emailInput = document.getElementById('email');
	const passwordInput = document.getElementById('password');

	if (!form) return;

	emailInput?.addEventListener('blur', () => {
		if (emailInput.value) validateEmail(emailInput);
	});

	passwordInput?.addEventListener('blur', () => {
		if (passwordInput.value) validatePassword(passwordInput);
	});

	emailInput?.addEventListener('input', () => {
		if (emailInput.validity.customError) {
			emailInput.setCustomValidity('');
		}
	});

	passwordInput?.addEventListener('input', () => {
		if (passwordInput.validity.customError) {
			passwordInput.setCustomValidity('');
		}
	});

	form.addEventListener('submit', function (e) {
		let isValid = true;

		if (!validateEmail(emailInput)) isValid = false;
		if (!validatePassword(passwordInput, 8)) isValid = false;

		if (!isValid) {
			e.preventDefault();
			form.reportValidity();
		}
	});
}

function initRegisterValidations() {
	const form = document.getElementById('register-form');
	const emailInput = document.getElementById('email');
	const passwordInput = document.getElementById('password');
	const passwordConfirmInput = document.getElementById('passwordConfirm');
	const nameInput = document.getElementById('name');
	const surnamesInput = document.getElementById('surnames');
	const phoneInput = document.getElementById('phone');

	if (!form) return;

	nameInput?.addEventListener('input', () => validateOnlyLettersMin3(nameInput));
	surnamesInput?.addEventListener('input', () => validateOnlyLettersMin3(surnamesInput));

	emailInput?.addEventListener('blur', () => {
		if (emailInput.value) validateEmail(emailInput);
	});

	passwordInput?.addEventListener('blur', () => {
		if (passwordInput.value) {
			validatePassword(passwordInput);
			if (passwordConfirmInput?.value) {
				validatePasswordMatch(passwordInput, passwordConfirmInput);
			}
		}
	});

	passwordConfirmInput?.addEventListener('blur', () => {
		if (passwordConfirmInput.value) validatePasswordMatch(passwordInput, passwordConfirmInput);
	});

	phoneInput?.addEventListener('blur', () => {
		if (phoneInput.value) validateInternationalPhone(phoneInput);
	});

	emailInput?.addEventListener('input', () => {
		if (emailInput.validity.customError) emailInput.setCustomValidity('');
	});

	passwordInput?.addEventListener('input', () => {
		if (passwordInput.validity.customError) passwordInput.setCustomValidity('');
		if (passwordConfirmInput?.value && passwordConfirmInput.validity.customError) {
			passwordConfirmInput.setCustomValidity('');
		}
	});

	passwordConfirmInput?.addEventListener('input', () => {
		if (passwordConfirmInput.validity.customError) passwordConfirmInput.setCustomValidity('');
	});

	phoneInput?.addEventListener('input', () => {
		if (phoneInput.validity.customError) phoneInput.setCustomValidity('');
	});

	form.addEventListener('submit', function (e) {
		let isValid = true;

		if (!validateOnlyLettersMin3(nameInput)) isValid = false;
		if (!validateOnlyLettersMin3(surnamesInput)) isValid = false;
		if (!validateEmail(emailInput)) isValid = false;
		if (!validatePassword(passwordInput, 8)) isValid = false;
		if (!validatePasswordMatch(passwordInput, passwordConfirmInput)) isValid = false;
		if (phoneInput?.value && !validateInternationalPhone(phoneInput)) isValid = false;

		if (!isValid) {
			e.preventDefault();
			form.reportValidity();
		}
	});
}

document.addEventListener('DOMContentLoaded', function () {
	if (document.getElementById('login-form')) {
		initLoginValidations();
	}

	if (document.getElementById('register-form')) {
		initRegisterValidations();
	}
});
