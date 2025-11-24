# ClutchPay Frontend

The frontend application for ClutchPay, built with vanilla HTML, CSS, and JavaScript. This client-side application provides a user-friendly interface for invoice management, authentication, and user dashboard functionality.

---

## 📋 Overview

This is a traditional multi-page application (MPA) using vanilla web technologies:

- **Authentication Pages**: Login and registration with client-side validation
- **User Dashboard**: Main application interface for logged-in users
- **Internationalization**: Multi-language support (English/Spanish)
- **Responsive Design**: Mobile-friendly layouts

---

## 🏗️ Architecture

### Directory Structure

```text
frontend/
├── JS/                      # JavaScript modules
│   ├── auth.js              # Authentication utilities
│   ├── auth-login.js        # Login page logic
│   ├── auth-register.js     # Registration page logic
│   ├── dashboard_usuario.js # Dashboard functionality
│   ├── i18n.js              # Internationalization
│   └── validaciones.js      # Form validation helpers
│
├── CSS/                     # Stylesheets
│   ├── styles.css           # Global styles
│   └── dashboard_usuario.css # Dashboard-specific styles
│
├── imagenes/                # Image assets
│   └── (application images)
│
├── docker/                  # Docker configuration
│   ├── Dockerfile           # Container image definition
│   ├── docker-compose.yml   # Service orchestration
│   └── .env                 # Docker environment variables
│
├── index.html               # Landing page
├── login.html               # Login page
├── register.html            # Registration page
├── main.html                # Main dashboard
│
├── .env                     # Environment variables
└── .gitignore               # Git ignore rules
```

---

## 🎨 Pages

### 1. Landing Page (index.html)

- Welcome screen
- Navigation to login/register
- Project information

### 2. Login Page (login.html)

- Email/password authentication
- Form validation
- Error handling
- Language selector

### 3. Registration Page (register.html)

- New user signup
- Field validation
- Password strength checking
- Terms acceptance

### 4. Main Dashboard (main.html)

- User dashboard interface
- Invoice management
- Payment tracking
- User settings

---

## 💻 JavaScript Modules

### auth.js

Core authentication utilities:

- Session management
- Token handling
- Authentication state
- API authentication headers

### auth-login.js

Login page functionality:

- Form submission handling
- Credential validation
- Login API integration
- Error display

### auth-register.js

Registration page functionality:

- Form validation
- Password confirmation
- Registration API integration
- Success/error handling

### dashboard_usuario.js

Dashboard functionality:

- User data fetching
- Invoice display
- Payment tracking
- User interactions

### i18n.js

Internationalization system:

- Language detection
- Translation loading
- Dynamic text updates
- Language switching

### validaciones.js

Form validation helpers:

- Email validation
- Password strength
- Phone number formatting
- Required field checks

---

## 🎨 Styling

### styles.css

Global application styles:

- CSS variables for theming
- Responsive grid layouts
- Form styling
- Button components
- Modal dialogs
- Navigation bars

### dashboard_usuario.css

Dashboard-specific styles:

- Dashboard layout
- Card components
- Data tables
- Charts/graphs
- User widgets

---

## 🌐 Internationalization

Supported languages:

- **English (en)**: Default language
- **Spanish (es)**: Secondary language

### Implementation

The i18n system dynamically loads translations and updates the DOM:

```javascript
// Usage example
i18n.translate('login.title'); // Returns "Login" or "Iniciar sesión"
```

---

## 🔧 Configuration

### Environment Variables (.env)

```env
API_BASE_URL=http://localhost:3000
```

---

## 🎯 Features

### Current Features

- ✅ User authentication (login/logout)
- ✅ User registration
- ✅ Multi-language support (EN/ES)
- ✅ Responsive design
- ✅ Form validation
- ✅ Session management
- ✅ Docker deployment

---

## 🔍 Troubleshooting

### Common Issues

**API connection errors:**

- Check `API_BASE_URL` in `.env`
- Ensure backend is running
- Check CORS configuration

**Docker container won't start:**

```bash
# Check logs
docker-compose logs frontend

# Rebuild image
docker-compose up --build
```

**Translations not loading:**

- Check network tab for failed requests
- Verify i18n.js is loaded
- Check browser console for errors

**Styling issues:**

- Clear browser cache
- Check CSS file paths
- Verify CSS is not blocked by CSP

---

## 📚 Additional Resources

- **Main Documentation**: [../README.md](../README.md)
- **Backend API**: [../back/README.md](../back/README.md)
- **Development Tools**: [../utils_dev/README.md](../utils_dev/README.md)
