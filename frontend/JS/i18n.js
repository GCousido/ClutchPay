/**
 * Internationalization System (i18n)
 * 
 * @module i18n
 * @description Translation system for multiple languages (ES/EN).
 * Stores selected language in localStorage and provides a simple API
 * to get translations using dot notation.
 * 
 * @example
 * // Change language
 * i18n.setLanguage('en');
 * 
 * // Get translation
 * const email = i18n.t('login.email'); // "Email"
 * 
 * // Get current language
 * const currentLang = i18n.currentLang; // 'en'
 */

/**
 * Object with all translations organized hierarchically
 * 
 * @const {Object} MESSAGES
 * @property {Object} es - Spanish translations
 * @property {Object} en - English translations
 * 
 * Structure for each language:
 * - login: Login page texts
 * - register: Registration page texts
 * - dashboard: Main dashboard texts
 * - country: Translated country list (69 countries)
 * - userDashboard: User dashboard texts
 * - invoices: Invoice management texts
 * - general: Common application texts
 */
// i18n.js
const MESSAGES = {
    es: {
        login: {
            email: "Correo electrónico",
            password: "Contraseña",
            requiredEmail: "El correo es obligatorio",
            requiredPassword: "La contraseña es obligatoria",
            signIn: "Iniciar sesión",
            loginSuccess: "Login exitoso",
            incorrectCredentials: "Email o contraseña incorrectos",
            loggingIn: "Iniciando sesión...",
            title: "Iniciar sesión"
        },
        register: {
            title: "Registro",
            name: "Nombre",
            surnames: "Apellidos",
            email: "Correo electrónico",
            password: "Contraseña",
            confirmPassword: "Confirmar Contraseña",
            phone: "Teléfono",
            country: "País",
            imageUrl: "URL Imagen",
            submit: "Crear cuenta",
            errors: {
                required: "Este campo es obligatorio",
                passwordMismatch: "Las contraseñas no coinciden",
            },
            creatingAccount: "Creando cuenta...",
            errorDefault: "Error al crear la cuenta"
        },
        dashboard: {
            title: "Dashboard de Usuario",
            welcomeMessage: "Bienvenido al panel de control",
            successMessage: 'Has iniciado sesión exitosamente.'
        },
        country: {
            selectCountry: "Selecciona tu país",
            countries: {
                AF: "Afganistán",
                AL: "Albania",
                DE: "Alemania",
                AD: "Andorra",
                AO: "Angola",
                AR: "Argentina",
                AM: "Armenia",
                AU: "Australia",
                AT: "Austria",
                BE: "Bélgica",
                BO: "Bolivia",
                BR: "Brasil",
                CA: "Canadá",
                CL: "Chile",
                CN: "China",
                CO: "Colombia",
                CR: "Costa Rica",
                HR: "Croacia",
                CU: "Cuba",
                DK: "Dinamarca",
                EC: "Ecuador",
                EG: "Egipto",
                SV: "El Salvador",
                ES: "España",
                US: "Estados Unidos",
                FI: "Finlandia",
                FR: "Francia",
                GR: "Grecia",
                GT: "Guatemala",
                HN: "Honduras",
                HU: "Hungría",
                IN: "India",
                ID: "Indonesia",
                IE: "Irlanda",
                IL: "Israel",
                IT: "Italia",
                JP: "Japón",
                MX: "México",
                MC: "Mónaco",
                MA: "Marruecos",
                NI: "Nicaragua",
                NO: "Noruega",
                NZ: "Nueva Zelanda",
                PA: "Panamá",
                PY: "Paraguay",
                PE: "Perú",
                PL: "Polonia",
                PT: "Portugal",
                PR: "Puerto Rico",
                GB: "Reino Unido",
                DO: "República Dominicana",
                RO: "Rumanía",
                RU: "Rusia",
                SM: "San Marino",
                SA: "Arabia Saudita",
                SE: "Suecia",
                CH: "Suiza",
                TR: "Turquía",
                UA: "Ucrania",
                UY: "Uruguay",
                VE: "Venezuela"
            }

        },
        userDashboard: {
            editProfile: "Editar Perfil",
            logout: "Cerrar Sesión",
            myContacts: "Mis Contactos",
            addContact: "Añadir Contacto",
            noContacts: "No tienes contactos añadidos aún",
            clickToAdd: "Haz clic en \"Añadir Contacto\" para empezar",
            addContactTitle: "Añadir Contacto",
            addContactDescription: "Introduce el correo electrónico del usuario",
            email: "Correo Electrónico",
            addButton: "Añadir Contacto",
            cancel: "Cancelar",
            accept: "Aceptar",
            deleteConfirm: "Confirmar eliminación",
            contactAdded: "añadido a tus contactos",
            contactDeleted: "Contacto eliminado correctamente",
            profileUpdated: "Perfil actualizado correctamente",
            profileError: "Error al actualizar el perfil",
            editProfileTitle: "Editar Perfil",
            name: "Nombre",
            surnames: "Apellidos",
            phone: "Teléfono",
            country: "País",
            imageUrl: "URL de Imagen",
            profileImage: "Imagen de Perfil",
            dropImageHere: "Arrastra una imagen aquí",
            selectImage: "Seleccionar Imagen",
            saveChanges: "Guardar Cambios",
            loading: "Cargando contactos...",
            errorLoadingContacts: "Error al cargar contactos",
            errorAddingContact: "Error al añadir contacto",
            userNotFound: "No se encontró ningún usuario con ese email",
            alreadyContact: "Este usuario ya está en tu lista de contactos",
            cannotAddYourself: "No puedes añadirte a ti mismo como contacto"
        },
        invoices: {
            title: "Mis Facturas",
            filterAll: "Todas",
            filterPending: "Pendientes",
            filterPaid: "Pagadas",
            filterAllType: "Todas",
            filterIssued: "Emitidas",
            filterReceived: "Recibidas",
            sortBy: "Ordenar por",
            sortIssueDate: "Fecha de emisión",
            sortDueDate: "Fecha de vencimiento",
            sortPaymentDate: "Fecha de pago",
            sortAmount: "Cantidad",
            loading: "Cargando facturas...",
            noInvoices: "No tienes facturas",
            noInvoicesDesc: "Cuando recibas o emitas facturas, aparecerán aquí",
            statusPaid: "Pagada",
            statusPending: "Pendiente",
            statusOverdue: "Vencida",
            statusCanceled: "Cancelada",
            issued: "Emitida",
            received: "Recibida",
            issueDate: "Fecha emisión",
            dueDate: "Fecha vencimiento",
            paymentDate: "Fecha pago",
            amount: "Importe",
            subject: "Asunto",
            description: "Descripción",
            issuer: "Emisor",
            pdfDocument: "Documento PDF",
            downloadPdf: "Descargar PDF",
            createInvoice: "Crear Factura",
            invoiceNumber: "Número de Factura",
            recipient: "Destinatario",
            pdfFile: "Archivo PDF",
            invoiceCreated: "Factura creada correctamente",
            errorCreating: "Error al crear la factura",
            errorLoading: "Error al cargar las facturas"
        },
        general: {
            welcome: "Bienvenido a ClutchPay",
            logout: "Cerrar sesión",
            login: "Iniciar sesión",
            register: "Registrarse",
            connectionError: "Error de conexión. Por favor, verifica que el servidor esté corriendo.",
            back: "Volver al inicio",
            languages: "Idiomas",
            cancel: "Cancelar",
            loading: "Cargando..."
        },
    },
    en: {
        login: {
            email: "Email",
            password: "Password",
            requiredEmail: "Email is required",
            requiredPassword: "Password is required",
            signIn: "Sign In",
            loginSuccess: "Login successful",
            incorrectCredentials: "Incorrect email or password",
            loggingIn: "Logging in...",
            title: "Login"
        },
        register: {
            title: "Register",
            name: "Name",
            surnames: "Surnames",
            email: "Email",
            password: "Password",
            confirmPassword: "Confirm Password",
            phone: "Phone",
            country: "Country",
            imageUrl: "Image URL",
            submit: "Create Account",
            errors: {
                required: "This field is required",
                passwordMismatch: "Passwords do not match",
            },
            creatingAccount: "Creating account...",
            errorDefault: "Error creating account"
        },
        dashboard: {
            title: "User Dashboard",
            welcomeMessage: "Welcome to the dashboard",
            successMessage: 'You have successfully logged in.'
        },
        country: {
            selectCountry: "Select your country",
            countries: {
                AF: "Afghanistan",
                AL: "Albania",
                DE: "Germany",
                AD: "Andorra",
                AO: "Angola",
                AR: "Argentina",
                AM: "Armenia",
                AU: "Australia",
                AT: "Austria",
                BE: "Belgium",
                BO: "Bolivia",
                BR: "Brazil",
                CA: "Canada",
                CL: "Chile",
                CN: "China",
                CO: "Colombia",
                CR: "Costa Rica",
                HR: "Croatia",
                CU: "Cuba",
                DK: "Denmark",
                EC: "Ecuador",
                EG: "Egypt",
                SV: "El Salvador",
                ES: "Spain",
                US: "United States",
                FI: "Finland",
                FR: "France",
                GR: "Greece",
                GT: "Guatemala",
                HN: "Honduras",
                HU: "Hungary",
                IN: "India",
                ID: "Indonesia",
                IE: "Ireland",
                IL: "Israel",
                IT: "Italy",
                JP: "Japan",
                MX: "Mexico",
                MC: "Monaco",
                MA: "Morocco",
                NI: "Nicaragua",
                NO: "Norway",
                NZ: "New Zealand",
                PA: "Panama",
                PY: "Paraguay",
                PE: "Peru",
                PL: "Poland",
                PT: "Portugal",
                PR: "Puerto Rico",
                GB: "United Kingdom",
                DO: "Dominican Republic",
                RO: "Romania",
                RU: "Russia",
                SM: "San Marino",
                SA: "Saudi Arabia",
                SE: "Sweden",
                CH: "Switzerland",
                TR: "Turkey",
                UA: "Ukraine",
                UY: "Uruguay",
                VE: "Venezuela"
            }
        },
        userDashboard: {
            editProfile: "Edit Profile",
            logout: "Logout",
            myContacts: "My Contacts",
            addContact: "Add Contact",
            noContacts: "You don't have any contacts yet",
            clickToAdd: "Click \"Add Contact\" to get started",
            addContactTitle: "Add Contact",
            addContactDescription: "Enter the user's email address",
            email: "Email Address",
            addButton: "Add Contact",
            cancel: "Cancel",
            accept: "Accept",
            deleteConfirm: "Confirm Deletion",
            contactAdded: "added to your contacts",
            contactDeleted: "Contact deleted successfully",
            profileUpdated: "Profile updated successfully",
            profileError: "Error updating profile",
            editProfileTitle: "Edit Profile",
            name: "Name",
            surnames: "Surnames",
            phone: "Phone",
            country: "Country",
            imageUrl: "Image URL",
            profileImage: "Profile Image",
            dropImageHere: "Drop an image here",
            selectImage: "Select Image",
            saveChanges: "Save Changes",
            loading: "Loading contacts...",
            errorLoadingContacts: "Error loading contacts",
            errorAddingContact: "Error adding contact",
            userNotFound: "No user found with that email",
            alreadyContact: "This user is already in your contacts",
            cannotAddYourself: "You cannot add yourself as a contact"
        },
        invoices: {
            title: "My Invoices",
            filterAll: "All",
            filterPending: "Pending",
            filterPaid: "Paid",
            filterAllType: "All",
            filterIssued: "Issued",
            filterReceived: "Received",
            sortBy: "Sort by",
            sortIssueDate: "Issue date",
            sortDueDate: "Due date",
            sortPaymentDate: "Payment date",
            sortAmount: "Amount",
            loading: "Loading invoices...",
            noInvoices: "You have no invoices",
            noInvoicesDesc: "When you receive or issue invoices, they will appear here",
            statusPaid: "Paid",
            statusPending: "Pending",
            statusOverdue: "Overdue",
            statusCanceled: "Canceled",
            issued: "Issued",
            received: "Received",
            issueDate: "Issue date",
            dueDate: "Due date",
            paymentDate: "Payment date",
            amount: "Amount",
            subject: "Subject",
            description: "Description",
            issuer: "Issuer",
            pdfDocument: "PDF Document",
            downloadPdf: "Download PDF",
            createInvoice: "Create Invoice",
            invoiceNumber: "Invoice Number",
            recipient: "Recipient",
            pdfFile: "PDF File",
            invoiceCreated: "Invoice created successfully",
            errorCreating: "Error creating invoice",
            errorLoading: "Error loading invoices"
        },
        general: {
            welcome: "Welcome to ClutchPay",
            logout: "Logout",
            login: "Login",
            register: "Register",
            connectionError: "Connection error. Please verify that the server is running.",
            back: "Back to home",
            languages: "Languages",
            cancel: "Cancel",
            loading: "Loading..."
        },
    }
};

/**
 * Variable that stores the current language
 * Initialized from localStorage or defaults to 'es'
 * 
 * @type {string}
 */
let currentLang = localStorage.getItem('lang') || 'es';

/**
 * Sets the application's active language
 * 
 * @function setLanguage
 * @param {string} lang - Language code ('es' | 'en')
 * @returns {void}
 * 
 * @description
 * Changes the active language and persists it in localStorage.
 * After calling this function, the page should be reloaded
 * to apply translations.
 * 
 * @example
 * i18n.setLanguage('en');
 * location.reload();
 */
function setLanguage(lang) {
    if (MESSAGES[lang]) {
        currentLang = lang;
        localStorage.setItem('lang', lang);
    }
}


/**
 * Gets a translation using dot notation
 * 
 * @function t
 * @param {string} key - Path to translation (e.g., 'login.email', 'country.countries.ES')
 * @returns {string} Found translation or original key if not found
 * 
 * @description
 * Navigates through MESSAGES object using key with dots as separator.
 * If translation is not found, returns original key as fallback.
 * 
 * @example
 * i18n.t('login.email')              // "Correo electrónico" (ES) or "Email" (EN)
 * i18n.t('country.countries.ES')     // "España" (ES) or "Spain" (EN)
 * i18n.t('register.errors.required') // "Este campo es obligatorio" (ES)
 */
function t(key) {
    const keys = key.split('.');
    let result = MESSAGES[currentLang];
    for (const k of keys) {
        result = result?.[k];
        if (!result) return key;
    }
    return result;
}

/**
 * Global i18n system API
 * 
 * @namespace i18n
 * @global
 * @property {function} setLanguage - Sets the active language
 * @property {function} t - Gets translation by key
 * @property {string} currentLang - Current language getter (readonly)
 * 
 * @description
 * Object exposed globally in window for access from any script.
 * Provides all internationalization functionality.
 */
window.i18n = {
    setLanguage,
    t,
    get currentLang() {
        return currentLang;
    }
};

