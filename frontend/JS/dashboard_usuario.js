/**
 * User Dashboard - Main Orchestrator
 * 
 * @module dashboard_usuario
 * @description Main orchestrator for the dashboard application.
 * Coordinates all dashboard modules (core, profile, contacts, invoices, mobile).
 * 
 * Architecture:
 * - dashboard/core.js: Shared utilities, session, notifications
 * - dashboard/profile.js: Profile editing and display
 * - dashboard/contacts.js: Contacts management
 * - dashboard/invoices.js: Invoice management
 * - dashboard/mobile.js: Mobile-specific UI
 * 
 * This file:
 * - Initializes Auth instance
 * - Creates module instances
 * - Coordinates module initialization
 * - Minimal logic, delegates to modules
 * 
 * Dependencies:
 * - auth.js: Authentication class
 * - i18n.js: Translations
 * - notifications.js: Toast messages (legacy, now in core)
 * - dashboard/core.js: Core utilities
 * - dashboard/profile.js: Profile management
 * - dashboard/contacts.js: Contacts management
 * - dashboard/invoices.js: Invoice management
 * - dashboard/mobile.js: Mobile UI
 */

document.addEventListener('DOMContentLoaded', async () => {
    //Initialize Auth instance
    const authInstance = new Auth();

    //Initialize Dashboard Core
    const dashboardCore = new DashboardCore(authInstance);

    //Verify session and load user data
    const sessionValid = await dashboardCore.initSession();
    if (!sessionValid) {
        return; //Redirected to login
    }

    //Initialize all dashboard modules
    const dashboardProfile = new DashboardProfile(dashboardCore);
    const dashboardContacts = new DashboardContacts(dashboardCore);
    const dashboardInvoices = new DashboardInvoices(dashboardCore);
    const dashboardMobile = new DashboardMobile(dashboardCore);

    //Initialize modules
    dashboardProfile.init();
    dashboardContacts.init();
    dashboardInvoices.init();
    dashboardMobile.init();
});
