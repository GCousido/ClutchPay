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
            deleteConfirm: "¿Estás seguro de que quieres eliminar a",
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
            saveChanges: "Guardar Cambios",
            loading: "Cargando contactos...",
            errorLoadingContacts: "Error al cargar contactos",
            errorAddingContact: "Error al añadir contacto",
            userNotFound: "No se encontró ningún usuario con ese email",
            alreadyContact: "Este usuario ya está en tu lista de contactos",
            cannotAddYourself: "No puedes añadirte a ti mismo como contacto"
        },
        general: {
            welcome: "Bienvenido a ClutchPay",
            logout: "Cerrar sesión",
            login: "Iniciar sesión",
            register: "Registrarse",
            connectionError: "Error de conexión. Por favor, verifica que el servidor esté corriendo en http://localhost:3000",
            back: "Volver al inicio",
            languages: "Idiomas"
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
            deleteConfirm: "Are you sure you want to delete",
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
            saveChanges: "Save Changes",
            loading: "Loading contacts...",
            errorLoadingContacts: "Error loading contacts",
            errorAddingContact: "Error adding contact",
            userNotFound: "No user found with that email",
            alreadyContact: "This user is already in your contacts",
            cannotAddYourself: "You cannot add yourself as a contact"
        },
        general: {
            welcome: "Welcome to ClutchPay",
            logout: "Logout",
            login: "Login",
            register: "Register",
            connectionError: "Connection error. Please ensure the server is running at http://localhost:3000",
            back: "Back to Home",
            languages: "Languages"
        }
    }
};

let currentLang = localStorage.getItem('lang') || 'es';

function setLanguage(lang) {
    if (MESSAGES[lang]) {
        currentLang = lang;
        localStorage.setItem('lang', lang);
    }
}


function t(key) {
    const keys = key.split('.');
    let result = MESSAGES[currentLang];
    for (const k of keys) {
        result = result?.[k];
        if (!result) return key;
    }
    return result;
}

window.i18n = {
    setLanguage,
    t,
    get currentLang() {
        return currentLang;
    }
};

