/**
 * Form Validation System
 * 
 * @module validaciones
 * @description Validation function library that uses HTML5 Constraint Validation API.
 * All validations use setCustomValidity() for native form integration.
 */

/**
 * Validates that a field contains only letters with minimum 3 letters
 * 
 * @function validateOnlyLettersMin3
 * @param {HTMLInputElement} input - Input element to validate
 * @returns {boolean} true if valid, false if invalid
 * 
 * @description
 * Rules:
 * - Only allows letters: A-Za-zÁÉÍÓÚáéíóúÑñÜü and spaces
 * - Minimum 3 letters (not counting spaces)
 * 
 * Error messages:
 * - "Only letters and spaces allowed"
 * - "Minimum 3 letters"
 * 
 * @example
 * const nameInput = document.getElementById('name');
 * nameInput.addEventListener('input', () => {
 *     validateOnlyLettersMin3(nameInput);
 * });
 * 
 * // Valid: "Juan", "María José", "José Luis"
 * // Invalid: "Jo", "Juan123", "J"
 */
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

/**
 * Validates phones in international format
 * 
 * @function validateInternationalPhone
 * @param {HTMLInputElement} input - Phone field to validate
 * @returns {boolean} true if valid or empty, false if invalid
 * 
 * @description
 * Valid format: +[country code][number]
 * 
 * Rules:
 * - Must start with +
 * - Country code 1-3 digits (cannot start with 0)
 * - Total between 8-15 digits (not counting +)
 * - Spaces, hyphens and parentheses are ignored when validating
 * 
 * Regex: /^\+[1-9]\d{7,14}$/
 * 
 * Error message:
 * - "Valid format: +[country code][number] (e.g. +34123456789)"
 * 
 * @example
 * // Valid:
 * // +34612345678     // Spain
 * // +1234567890      // USA
 * // +52 55 1234 5678 // Mexico (spaces removed)
 * // +44(20)12345678  // UK (parentheses removed)
 * 
 * // Invalid:
 * // 612345678        // Missing +
 * // +0123456789      // Country code cannot start with 0
 * // +34 612          // Too short
 */
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

/**
 * Verifies that two password fields match
 * 
 * @function validatePasswordMatch
 * @param {HTMLInputElement} pwd1 - Original password field
 * @param {HTMLInputElement} pwd2 - Confirmation field
 * @returns {boolean} true if match, false if not
 * 
 * @description
 * Compares values of two password fields.
 * Error message is set on pwd2.
 * 
 * Error message: "Passwords do not match"
 * 
 * @example
 * const password = document.getElementById('password');
 * const passwordConfirm = document.getElementById('passwordConfirm');
 * passwordConfirm.addEventListener('blur', () => {
 *     validatePasswordMatch(password, passwordConfirm);
 * });
 */
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

/**
 * Validates email format
 * 
 * @function validateEmail
 * @param {HTMLInputElement} input - Email field
 * @returns {boolean} true if valid, false if invalid
 * 
 * @description
 * Rules:
 * - Non-empty field
 * - Format: text@domain.extension
 * - Regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
 * 
 * Error messages:
 * - "Email address is required" (if empty)
 * - "Enter a valid email address (example@mail.com)"
 * 
 * @example
 * // Valid:
 * // user@example.com
 * // name.surname@company.co.uk
 * // test_123@sub.domain.org
 * 
 * // Invalid:
 * // invalidemail           // No @
 * // @example.com           // No user
 * // user@                  // No domain
 * // user@domain            // No TLD
 */
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

/**
 * Validates minimum password length
 * 
 * @function validatePassword
 * @param {HTMLInputElement} input - Password field
 * @param {number} [minLength=8] - Required minimum length
 * @returns {boolean} true if valid, false if invalid
 * 
 * @description
 * Rules:
 * - Non-empty
 * - Length >= minLength
 * 
 * Error messages:
 * - "Password is required" (if empty)
 * - "Password must have at least {minLength} characters"
 * 
 * @example
 * const password = document.getElementById('password');
 * validatePassword(password, 10); // Requires 10+ characters
 */
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

/**
 * Initializes validations for login form
 * 
 * @function initLoginValidations
 * @returns {void}
 * 
 * @description
 * Sets up event listeners for real-time validation on login form.
 * 
 * Form: #login-form
 * Fields:
 * - #email: Email format validation
 * - #password: Minimum length validation
 * 
 * Events:
 * - blur: Validates when field loses focus
 * - input: Clears error messages while user types
 * - submit: Validates all fields before submission, prevents if errors
 */
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

/**
 * Initializes validations for registration form
 * 
 * @function initRegisterValidations
 * @returns {void}
 * 
 * @description
 * Sets up event listeners for real-time validation on registration form.
 * 
 * Form: #register-form
 * Validated fields:
 * - #name: Letters only, minimum 3
 * - #surnames: Letters only, minimum 3
 * - #email: Valid email format
 * - #password: Minimum 8 characters
 * - #passwordConfirm: Must match password
 * - #phone: International format (optional, only validates if has value)
 * 
 * Real-time validation:
 * - name, surnames: On each 'input' event
 * - Rest: On 'blur' and 'input' events (to clear errors)
 * 
 * Submit validation:
 * - Verifies all required fields
 * - If phone has value, validates it
 * - Prevents submission if errors and shows reportValidity()
 */
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

/**
 * Validates that an invoice number is unique
 * 
 * @function validateUniqueInvoiceNumber
 * @param {HTMLInputElement} input - Invoice number input element
 * @param {Array} existingInvoices - Array of existing invoices to check against
 * @returns {boolean} true if unique or empty, false if duplicate
 * 
 * @description
 * Checks if the invoice number already exists in the system.
 * Displays a custom error message if duplicate is found.
 * 
 * Error message:
 * - "This invoice number already exists"
 * 
 * @example
 * const invoiceNumberInput = document.getElementById('invoice-number');
 * const allInvoices = [{invoiceNumber: 'INV-001'}, {invoiceNumber: 'INV-002'}];
 * 
 * validateUniqueInvoiceNumber(invoiceNumberInput, allInvoices);
 * // Returns false if input value matches any existing invoice number
 */
function validateUniqueInvoiceNumber(input, existingInvoices) {
	if (!input) return true;
	
	const value = input.value.trim();
	
	if (!value) {
		input.setCustomValidity('');
		return true;
	}
	
	const exists = existingInvoices.some(invoice => invoice.invoiceNumber === value);
	
	if (exists) {
		input.setCustomValidity('Este número de factura ya existe');
		return false;
	} else {
		input.setCustomValidity('');
		return true;
	}
}

/**
 * Initializes real-time validation for invoice number uniqueness
 * 
 * @function initInvoiceNumberValidation
 * @param {HTMLInputElement} input - Invoice number input element
 * @param {Array} existingInvoices - Array of existing invoices
 * @param {number} [debounceTime=500] - Debounce time in milliseconds
 * 
 * @description
 * Sets up event listener with debouncing for real-time validation.
 * Shows visual feedback (red border and error message) when duplicate is found.
 * 
 * @example
 * const invoiceNumberInput = document.getElementById('invoice-number');
 * const allInvoices = [...]; // Array from API
 * 
 * initInvoiceNumberValidation(invoiceNumberInput, allInvoices);
 */
function initInvoiceNumberValidation(input, existingInvoices, debounceTime = 500) {
	if (!input) return;
	
	let validationTimeout;
	
	input.addEventListener('input', () => {
		clearTimeout(validationTimeout);
		
		// Remove previous validation message
		const existingMsg = input.parentElement.querySelector('.validation-message');
		if (existingMsg) existingMsg.remove();
		
		const value = input.value.trim();
		
		if (!value) {
			input.style.borderColor = '';
			return;
		}
		
		// Debounce validation
		validationTimeout = setTimeout(() => {
			const isValid = validateUniqueInvoiceNumber(input, existingInvoices);
			
			if (!isValid) {
				// Show error message
				const msg = document.createElement('span');
				msg.className = 'validation-message error';
				msg.textContent = 'Este número de factura ya existe';
				msg.style.color = '#dc3545';
				msg.style.fontSize = '0.85rem';
				msg.style.marginTop = '0.25rem';
				msg.style.display = 'block';
				input.parentElement.appendChild(msg);
				input.style.borderColor = '#dc3545';
			} else {
				input.style.borderColor = '';
			}
		}, debounceTime);
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
