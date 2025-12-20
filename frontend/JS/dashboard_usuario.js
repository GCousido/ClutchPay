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

    //Initialize all dashboard modules first
    const dashboardProfile = new DashboardProfile(dashboardCore);
    const dashboardContacts = new DashboardContacts(dashboardCore);
    const dashboardInvoices = new DashboardInvoices(dashboardCore);
    const dashboardPayments = new DashboardPayments(dashboardCore);
    const dashboardMobile = new DashboardMobile(dashboardCore);

    //Initialize internal notifications system
    const notificationSystem = new InternalNotifications(authInstance);
    await notificationSystem.init();
    // Make it globally accessible for click handlers
    window.notificationSystem = notificationSystem;

    //Initialize modules
    dashboardProfile.init();
    dashboardContacts.init();
    dashboardInvoices.init();
    dashboardPayments.init();
    dashboardMobile.init();

    // Initialize main navigation tabs
    const mainNavTabs = document.querySelectorAll('.main-nav-tab');
    mainNavTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const section = tab.dataset.section;
            
            // Update active tab
            mainNavTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active section
            document.querySelectorAll('.section-content').forEach(s => s.classList.remove('active'));
            const targetSection = document.getElementById(`${section}-section`);
            if (targetSection) targetSection.classList.add('active');
        });
    });

    // Check for payment redirect parameters AFTER initializing modules
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const invoiceId = urlParams.get('invoiceId');
    
    if (paymentStatus && invoiceId) {
        if (paymentStatus === 'success') {
            // Webhook handles database update automatically
            dashboardCore.showSuccessMessage(i18n.t('invoices.paymentSuccess') || 'Pago completado exitosamente');
            // Wait 2 seconds for webhook to process, then reload invoices
            setTimeout(() => dashboardInvoices.loadInvoices(), 2000);
        } else if (paymentStatus === 'cancel') {
            dashboardCore.showErrorMessage(i18n.t('invoices.paymentCanceled') || 'Pago cancelado');
        }
        
        // Clean URL parameters
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }
});
