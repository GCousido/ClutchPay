/**
 * Dashboard Invoices Module
 * 
 * @module dashboard/invoices
 * @description Manages invoice functionality including
 * load, filter, and render invoices.
 * 
 * Exports:
 * - DashboardInvoices: Invoices management class
 * 
 * Features:
 * - Load invoices from API
 * - Filter by status (all/pending/paid)
 * - Render invoice cards
 * - Display issued vs received invoices
 */

class DashboardInvoices {
    /**
     * Creates DashboardInvoices instance
     * 
     * @param {DashboardCore} core - Dashboard core instance
     */
    constructor(core) {
        this.core = core;
        this.allInvoices = [];
        this.currentTypeFilter = 'all'; // all, issued, received
        this.currentStatusFilter = 'all'; // all, pending, paid
        this.currentSortBy = 'issueDate'; // issueDate, dueDate, paymentDate, amount
        this.currentSortOrder = 'desc'; // asc, desc
    }

    /**
     * Initializes invoices module
     * 
     * @description
     * Sets up:
     * - Type filter button handlers (all/issued/received)
     * - Status filter button handlers (all/pending/paid)
     * - Sort selector handler
     * - Sort order button handler
     * - Create invoice button handler
     * - Initial invoices load
     */
    init() {
        this.initTypeFilters();
        this.initStatusFilters();
        this.initSortHandlers();
        this.initCreateInvoiceButton();
        this.loadInvoices();
    }

    /**
     * Loads invoices from backend API
     * 
     * @async
     * @description
     * Fetches user's invoices:
     * 1. GET /api/invoices?userId=${userId}
     * 2. Stores in allInvoices array
     * 3. Calls renderInvoices() with current filter
     * 4. If error: Shows error message and empty state
     */
    async loadInvoices() {
        try {
            // Load issued and received invoices
            const [issuedResponse, receivedResponse] = await Promise.all([
                fetch(
                    `${this.core.authInstance.API_BASE_URL}/api/invoices?role=issuer&limit=1000`,
                    { credentials: 'include' }
                ),
                fetch(
                    `${this.core.authInstance.API_BASE_URL}/api/invoices?role=debtor&limit=1000`,
                    { credentials: 'include' }
                )
            ]);

            if (!issuedResponse.ok || !receivedResponse.ok) {
                throw new Error('Error loading invoices');
            }

            const issuedData = await issuedResponse.json();
            const receivedData = await receivedResponse.json();
            
            // API returns { meta: {...}, data: [...] }
            const issuedInvoices = issuedData.data || [];
            const receivedInvoices = receivedData.data || [];
            
            // Mark each invoice with its type for filtering
            issuedInvoices.forEach(inv => inv.type = 'issued');
            receivedInvoices.forEach(inv => inv.type = 'received');
            
            // Combine both lists
            this.allInvoices = [...issuedInvoices, ...receivedInvoices];
            this.renderInvoices();
        } catch (error) {
            console.error('Error loading invoices:', error);
            this.core.showErrorMessage(i18n.t('invoices.errorLoading'));
            const spinner = document.querySelector('.loading-spinner');
            if (spinner) spinner.style.display = 'none';
            const emptyState = document.getElementById('empty-invoices');
            if (emptyState) emptyState.style.display = 'flex';
        }
    }

    /**
     * Renders invoice cards based on filters and sorting
     * 
     * @description
     * Displays invoice grid with three-level filtering:
     * 1. Type filter: all/issued/received
     * 2. Status filter: all/pending/paid
     * 3. Sorting: issueDate/dueDate/paymentDate/amount (asc/desc)
     * 
     * If empty: Shows empty state message
     * If has invoices: Renders cards with invoice details
     * 
     * Status badges:
     * - PAID: Green badge
     * - PENDING: Yellow badge
     * - OVERDUE: Red badge
     */
    renderInvoices() {
        const grid = document.getElementById('invoices-grid');
        const emptyState = document.getElementById('empty-invoices');
        
        if (!grid || !emptyState) return;

        // Apply type filter (issued/received/all)
        let filteredInvoices = this.allInvoices;
        
        if (this.currentTypeFilter === 'issued') {
            filteredInvoices = filteredInvoices.filter(inv => inv.type === 'issued');
        } else if (this.currentTypeFilter === 'received') {
            filteredInvoices = filteredInvoices.filter(inv => inv.type === 'received');
        }

        // Apply status filter (pending/paid/all)
        if (this.currentStatusFilter === 'pending') {
            filteredInvoices = filteredInvoices.filter(
                inv => inv.status === 'PENDING' || inv.status === 'OVERDUE'
            );
        } else if (this.currentStatusFilter === 'paid') {
            filteredInvoices = filteredInvoices.filter(inv => inv.status === 'PAID');
        }

        // Apply sorting
        filteredInvoices = this.sortInvoices(filteredInvoices);

        if (filteredInvoices.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';
        
        const invoicesHTML = filteredInvoices.map(invoice => {
            const statusClass = invoice.status.toLowerCase();
            const statusLabel = i18n.t(`invoices.status${invoice.status.charAt(0) + invoice.status.slice(1).toLowerCase()}`);
            const typeLabel = invoice.type === 'issued' ? i18n.t('invoices.issued') : i18n.t('invoices.received');
            const typeIcon = invoice.type === 'issued' ? '📤' : '📥';
            
            const issueDate = new Date(invoice.issueDate).toLocaleDateString();
            const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-';
            
            return `
                <div class="invoice-card status-${statusClass}" data-invoice-id="${invoice.id}">
                    <div class="invoice-header">
                        <span class="invoice-number">#${invoice.invoiceNumber}</span>
                        <span class="invoice-status-badge ${statusClass}">${statusLabel}</span>
                    </div>
                    
                    <div class="invoice-type-badge">
                        ${typeIcon} ${typeLabel}
                    </div>
                    
                    <h3 class="invoice-subject">${invoice.subject}</h3>
                    
                    <div class="invoice-amount">€${parseFloat(invoice.amount).toFixed(2)}</div>
                    
                    <div class="invoice-details">
                        <div class="invoice-detail-row">
                            <span class="invoice-detail-label">${i18n.t('invoices.issueDate')}:</span>
                            <span class="invoice-detail-value">${issueDate}</span>
                        </div>
                        ${invoice.dueDate ? `
                        <div class="invoice-detail-row">
                            <span class="invoice-detail-label">${i18n.t('invoices.dueDate')}:</span>
                            <span class="invoice-detail-value">${dueDate}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        grid.innerHTML = invoicesHTML;
        
        // Add click event listeners to open modal
        grid.querySelectorAll('.invoice-card').forEach(card => {
            card.addEventListener('click', () => {
                const invoiceId = parseInt(card.dataset.invoiceId);
                const invoice = this.allInvoices.find(inv => inv.id === invoiceId);
                if (invoice) {
                    this.showInvoiceModal(invoice);
                }
            });
        });
    }

    /**
     * Shows detailed invoice information in a modal
     * @param {Object} invoice - Invoice object with all details
     */
    async showInvoiceModal(invoice) {
        const typeLabel = invoice.type === 'issued' ? i18n.t('invoices.issued') : i18n.t('invoices.received');
        const typeIcon = invoice.type === 'issued' ? '📤' : '📥';
        const statusClass = invoice.status.toLowerCase();
        const statusLabel = i18n.t(`invoices.status${invoice.status.charAt(0) + invoice.status.slice(1).toLowerCase()}`);
        
        const issueDate = new Date(invoice.issueDate).toLocaleDateString();
        const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-';
        const paymentDate = invoice.paymentDate ? new Date(invoice.paymentDate).toLocaleDateString() : '-';
        
        // Load issuer information
        let issuerInfo = 'Loading...';
        try {
            const issuerResponse = await fetch(
                `${this.core.authInstance.API_BASE_URL}/api/users/${invoice.issuerUserId}`,
                { credentials: 'include' }
            );
            if (issuerResponse.ok) {
                const issuer = await issuerResponse.json();
                issuerInfo = issuer.name && issuer.surnames 
                    ? `${issuer.name} ${issuer.surnames}` 
                    : (issuer.name || issuer.email);
            }
        } catch (error) {
            console.error('Error loading issuer info:', error);
            issuerInfo = 'No disponible';
        }
        
        // Load debtor/receiver information
        let debtorInfo = 'Loading...';
        try {
            const debtorResponse = await fetch(
                `${this.core.authInstance.API_BASE_URL}/api/users/${invoice.debtorUserId}`,
                { credentials: 'include' }
            );
            if (debtorResponse.ok) {
                const debtor = await debtorResponse.json();
                debtorInfo = debtor.name && debtor.surnames 
                    ? `${debtor.name} ${debtor.surnames}` 
                    : (debtor.name || debtor.email);
            }
        } catch (error) {
            console.error('Error loading debtor info:', error);
            debtorInfo = 'No disponible';
        }
        
        // Load payment receipt if invoice is paid
        let receiptPdfUrl = null;
        if (invoice.status === 'PAID') {
            try {
                // Try both roles to ensure we get the payment regardless of user role
                const [payerPayments, receiverPayments] = await Promise.all([
                    fetch(`${this.core.authInstance.API_BASE_URL}/api/payments?role=payer&limit=1000`, { credentials: 'include' })
                        .then(res => res.ok ? res.json() : { data: [] }),
                    fetch(`${this.core.authInstance.API_BASE_URL}/api/payments?role=receiver&limit=1000`, { credentials: 'include' })
                        .then(res => res.ok ? res.json() : { data: [] })
                ]);
                
                const allPayments = [...payerPayments.data, ...receiverPayments.data];
                const payment = allPayments.find(p => p.invoiceId === invoice.id);
                
                if (payment && payment.receiptPdfUrl && payment.receiptPdfUrl !== 'unavailable') {
                    receiptPdfUrl = payment.receiptPdfUrl;
                }
            } catch (error) {
                console.error('Error loading payment receipt:', error);
            }
        }
        
        const modalHTML = `
            <div class="modal-overlay" id="invoice-modal">
                <div class="modal-content invoice-modal-content">
                    <button class="modal-close" id="close-invoice-modal">×</button>
                    
                    <div class="invoice-modal-header">
                        <div>
                            <h2>#${invoice.invoiceNumber}</h2>
                            <div class="invoice-type-badge">
                                ${typeIcon} ${typeLabel}
                            </div>
                        </div>
                        <span class="invoice-status-badge ${statusClass}">${statusLabel}</span>
                    </div>
                    
                    <div class="invoice-modal-body">
                        <div class="invoice-modal-section">
                            <h3 data-i18n="invoices.issuer">Emisor</h3>
                            <p>${issuerInfo}</p>
                        </div>
                        
                        <div class="invoice-modal-section">
                            <h3 data-i18n="invoices.recipient">Receptor</h3>
                            <p>${debtorInfo}</p>
                        </div>
                        
                        <div class="invoice-modal-section">
                            <h3 data-i18n="invoices.subject">Asunto</h3>
                            <p>${invoice.subject}</p>
                        </div>
                        
                        ${invoice.description ? `
                        <div class="invoice-modal-section">
                            <h3 data-i18n="invoices.description">Descripción</h3>
                            <p>${invoice.description}</p>
                        </div>
                        ` : ''}
                        
                        <div class="invoice-modal-section">
                            <h3 data-i18n="invoices.amount">Importe</h3>
                            <p class="invoice-modal-amount">€${parseFloat(invoice.amount).toFixed(2)}</p>
                        </div>
                        
                        <div class="invoice-modal-dates">
                            <div class="invoice-modal-date-item">
                                <span class="date-label" data-i18n="invoices.issueDate">Fecha emisión:</span>
                                <span class="date-value">${issueDate}</span>
                            </div>
                            ${invoice.dueDate ? `
                            <div class="invoice-modal-date-item">
                                <span class="date-label" data-i18n="invoices.dueDate">Fecha vencimiento:</span>
                                <span class="date-value">${dueDate}</span>
                            </div>
                            ` : ''}
                            ${invoice.paymentDate ? `
                            <div class="invoice-modal-date-item">
                                <span class="date-label" data-i18n="invoices.paymentDate">Fecha pago:</span>
                                <span class="date-value">${paymentDate}</span>
                            </div>
                            ` : ''}
                        </div>
                        
                        ${invoice.invoicePdfUrl ? `
                        <div class="invoice-modal-section">
                            <h3 data-i18n="invoices.pdfDocument">Documento PDF</h3>
                            <div>
                                <button id="download-pdf-btn" class="btn btn-primary" data-pdf-url="${invoice.invoicePdfUrl}" data-invoice-number="${invoice.invoiceNumber}">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                        <line x1="16" y1="13" x2="8" y2="13"/>
                                        <line x1="16" y1="17" x2="8" y2="17"/>
                                        <polyline points="10 9 9 9 8 9"/>
                                    </svg>
                                    <span data-i18n="invoices.downloadPdf">Descargar PDF</span>
                                </button>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${receiptPdfUrl ? `
                        <div class="invoice-modal-section">
                            <h3 data-i18n="payments.receipt">Recibo de Pago</h3>
                            <div>
                                <a href="${receiptPdfUrl}" target="_blank" class="btn btn-primary">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                        <line x1="16" y1="13" x2="8" y2="13"/>
                                        <line x1="16" y1="17" x2="8" y2="17"/>
                                        <polyline points="10 9 9 9 8 9"/>
                                    </svg>
                                    <span data-i18n="payments.downloadReceipt">Descargar Recibo</span>
                                </a>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${invoice.type === 'received' && (invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && !invoice.payment ? `
                        <div class="invoice-modal-section">
                            <div class="invoice-payment-actions">
                                <button id="pay-with-stripe-btn" class="btn btn-stripe" data-invoice-id="${invoice.id}">
                                    💳 <span data-i18n="invoices.payWithStripe">Pagar con Stripe</span>
                                </button>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        // Insert modal into DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Apply translations to modal
        if (typeof i18n !== 'undefined' && i18n.applyTranslations) {
            i18n.applyTranslations();
        }
        
        // Add event listeners
        const modal = document.getElementById('invoice-modal');
        const closeBtn = document.getElementById('close-invoice-modal');
        
        const closeModal = () => {
            modal.classList.add('fade-out');
            setTimeout(() => modal.remove(), 300);
        };
        
        closeBtn.addEventListener('click', closeModal);
        
        // Add PDF download handler
        const downloadBtn = document.getElementById('download-pdf-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const pdfUrl = downloadBtn.dataset.pdfUrl;
                window.open(pdfUrl, '_blank');
            });
        }
        
        // Add Stripe payment handler
        const stripeBtn = document.getElementById('pay-with-stripe-btn');
        if (stripeBtn) {
            stripeBtn.addEventListener('click', async () => {
                await this.handleStripePayment(invoice, closeModal);
            });
        }
        
        // Trigger fade-in animation
        setTimeout(() => modal.classList.add('show'), 10);
    }

    /**
     * Sorts invoices based on current sort settings
     * 
     * @param {Array} invoices - Array of invoices to sort
     * @returns {Array} Sorted invoices
     */
    sortInvoices(invoices) {
        const sorted = [...invoices];
        
        sorted.sort((a, b) => {
            let valueA, valueB;
            
            switch(this.currentSortBy) {
                case 'issueDate':
                    valueA = new Date(a.issueDate);
                    valueB = new Date(b.issueDate);
                    break;
                case 'dueDate':
                    valueA = a.dueDate ? new Date(a.dueDate) : new Date(0);
                    valueB = b.dueDate ? new Date(b.dueDate) : new Date(0);
                    break;
                case 'paymentDate':
                    valueA = a.paymentDate ? new Date(a.paymentDate) : new Date(0);
                    valueB = b.paymentDate ? new Date(b.paymentDate) : new Date(0);
                    break;
                case 'amount':
                    valueA = parseFloat(a.amount);
                    valueB = parseFloat(b.amount);
                    break;
                default:
                    valueA = new Date(a.issueDate);
                    valueB = new Date(b.issueDate);
            }
            
            if (this.currentSortOrder === 'asc') {
                return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
            } else {
                return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
            }
        });
        
        return sorted;
    }

    /**
     * Initializes type filter buttons (all/issued/received)
     */
    initTypeFilters() {
        document.querySelectorAll('.type-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTypeFilter = btn.dataset.typeFilter;
                this.renderInvoices();
            });
        });
    }

    /**
     * Initializes status filter buttons (all/pending/paid)
     */
    initStatusFilters() {
        document.querySelectorAll('.status-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentStatusFilter = btn.dataset.statusFilter;
                this.renderInvoices();
            });
        });
    }

    /**
     * Initializes sort handlers
     */
    initSortHandlers() {
        const sortSelect = document.getElementById('invoice-sort');
        const sortOrderBtn = document.getElementById('sort-order-btn');

        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSortBy = e.target.value;
                this.renderInvoices();
            });
        }

        if (sortOrderBtn) {
            sortOrderBtn.addEventListener('click', () => {
                this.currentSortOrder = this.currentSortOrder === 'asc' ? 'desc' : 'asc';
                sortOrderBtn.classList.toggle('asc', this.currentSortOrder === 'asc');
                this.renderInvoices();
            });
        }
    }

    /**
     * Initializes create invoice button
     */
    initCreateInvoiceButton() {
        const createBtn = document.getElementById('create-invoice-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreateInvoiceModal());
        }
    }

    /**
     * Shows modal to create a new invoice
     */
    async showCreateInvoiceModal() {
        // Load user contacts
        let contactsHTML = '<option value="">Selecciona un contacto</option>';
        try {
            const response = await fetch(
                `${this.core.authInstance.API_BASE_URL}/api/users/${this.core.currentUser.id}/contacts?limit=1000`,
                { credentials: 'include' }
            );
            
            if (response.ok) {
                const data = await response.json();
                const contacts = data.data || [];
                console.log('Contacts loaded:', contacts); // Debug log
                contactsHTML += contacts.map(contact => 
                    `<option value="${contact.id}">${contact.name || contact.email}</option>`
                ).join('');
            } else {
                console.error('Failed to load contacts:', response.status);
            }
        } catch (error) {
            console.error('Error loading contacts:', error);
        }

        const modalHTML = `
            <div class="modal-overlay" id="create-invoice-modal">
                <div class="modal-content create-invoice-modal-content">
                    <button class="modal-close" id="close-create-invoice-modal">×</button>
                    
                    <h2 data-i18n="invoices.createInvoice">Crear Factura</h2>
                    
                    <form id="create-invoice-form" class="invoice-form">
                        <div class="form-group">
                            <label for="invoice-number" data-i18n="invoices.invoiceNumber">Número de Factura</label>
                            <input type="text" id="invoice-number" name="invoiceNumber" required 
                                   placeholder="INV-2024-001">
                        </div>

                        <div class="form-group">
                            <label for="invoice-debtor" data-i18n="invoices.recipient">Destinatario</label>
                            <select id="invoice-debtor" name="debtorUserId" required>
                                ${contactsHTML}
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="invoice-subject" data-i18n="invoices.subject">Asunto</label>
                            <input type="text" id="invoice-subject" name="subject" required 
                                   placeholder="Desarrollo Web">
                        </div>

                        <div class="form-group">
                            <label for="invoice-description" data-i18n="invoices.description">Descripción</label>
                            <textarea id="invoice-description" name="description" rows="3" required minlength="10"
                                      placeholder="Detalle de los servicios prestados..."></textarea>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="invoice-amount" data-i18n="invoices.amount">Importe (€)</label>
                                <input type="number" id="invoice-amount" name="amount" step="0.01" required 
                                       placeholder="1000.00">
                            </div>

                            <div class="form-group">
                                <label for="invoice-issue-date" data-i18n="invoices.issueDate">Fecha Emisión</label>
                                <input type="date" id="invoice-issue-date" name="issueDate" required>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="invoice-due-date" data-i18n="invoices.dueDate">Fecha Vencimiento</label>
                                <input type="date" id="invoice-due-date" name="dueDate">
                            </div>

                            <div class="form-group">
                                <label for="invoice-pdf" data-i18n="invoices.pdfFile">Archivo PDF</label>
                                <input type="file" id="invoice-pdf" name="invoicePdf" accept=".pdf">
                            </div>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" id="cancel-create-invoice" 
                                    data-i18n="general.cancel">Cancelar</button>
                            <button type="submit" class="btn btn-primary" 
                                    data-i18n="invoices.createInvoice">Crear Factura</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Apply translations
        if (typeof i18n !== 'undefined' && i18n.applyTranslations) {
            i18n.applyTranslations();
        }

        // Set default issue date to today
        const issueDateInput = document.getElementById('invoice-issue-date');
        if (issueDateInput) {
            issueDateInput.valueAsDate = new Date();
        }

        // Invoice number validation using validaciones.js
        const invoiceNumberInput = document.getElementById('invoice-number');
        if (typeof initInvoiceNumberValidation === 'function') {
            initInvoiceNumberValidation(invoiceNumberInput, this.allInvoices);
        }

        // Event listeners
        const modal = document.getElementById('create-invoice-modal');
        const closeBtn = document.getElementById('close-create-invoice-modal');
        const cancelBtn = document.getElementById('cancel-create-invoice');
        const form = document.getElementById('create-invoice-form');

        const closeModal = () => {
            modal.classList.add('fade-out');
            setTimeout(() => modal.remove(), 300);
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        form.addEventListener('submit', (e) => this.handleCreateInvoice(e, modal));

        // Trigger fade-in animation
        setTimeout(() => modal.classList.add('show'), 10);
    }

    /**
     * Handles invoice creation form submission
     */
    async handleCreateInvoice(e, modal) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        // Clear previous error messages
        form.querySelectorAll('.field-error').forEach(el => el.remove());
        form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span data-i18n="general.loading">Creando...</span>';

            const formData = new FormData(form);
            const invoiceNumber = formData.get('invoiceNumber');
            
            // Validate invoice number uniqueness before submitting
            const invoiceNumberInput = form.querySelector('#invoice-number');
            if (typeof validateUniqueInvoiceNumber === 'function') {
                if (!validateUniqueInvoiceNumber(invoiceNumberInput, this.allInvoices)) {
                    throw new Error('El número de factura ya existe. Por favor, usa uno diferente.');
                }
            } else {
                // Fallback validation if validaciones.js is not loaded
                const exists = this.allInvoices.some(inv => inv.invoiceNumber === invoiceNumber);
                if (exists) {
                    throw new Error('El número de factura ya existe. Por favor, usa uno diferente.');
                }
            }
            
            // Convert FormData to JSON object
            const data = {
                invoiceNumber: invoiceNumber,
                issuerUserId: parseInt(this.core.currentUser.id),
                debtorUserId: parseInt(formData.get('debtorUserId')),
                subject: formData.get('subject'),
                description: (formData.get('description') || '').trim() || 'Sin descripción proporcionada',
                amount: parseFloat(formData.get('amount')),
                issueDate: new Date(formData.get('issueDate')).toISOString(),
                dueDate: formData.get('dueDate') ? new Date(formData.get('dueDate')).toISOString() : null,
            };

            // Convert PDF file to base64 if provided
            const pdfFile = formData.get('invoicePdf');
            if (pdfFile && pdfFile.size > 0) {
                const base64 = await this.fileToBase64(pdfFile);
                data.invoicePdf = base64;
            } else {
                // PDF is required
                throw new Error('El PDF de la factura es obligatorio');
            }

            const response = await fetch(
                `${this.core.authInstance.API_BASE_URL}/api/invoices`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                }
            );

            if (!response.ok) {
                const error = await response.json();
                
                // Check if error has field-specific validation errors
                if (error.errors && typeof error.errors === 'object') {
                    // Display field-specific errors
                    for (const [field, message] of Object.entries(error.errors)) {
                        // Map backend field names to frontend input IDs
                        let inputId = field;
                        if (field === 'invoiceNumber') inputId = 'invoice-number';
                        if (field === 'debtorUserId') inputId = 'debtor-user';
                        if (field === 'issueDate') inputId = 'issue-date';
                        if (field === 'dueDate') inputId = 'due-date';
                        if (field === 'description') inputId = 'invoice-description';
                        if (field === 'subject') inputId = 'invoice-subject';
                        if (field === 'amount') inputId = 'invoice-amount';
                        if (field === 'invoicePdf') inputId = 'invoice-pdf';
                        
                        const input = form.querySelector(`#${inputId}`);
                        if (input) {
                            input.classList.add('input-error');
                            
                            // Create error message element
                            const errorEl = document.createElement('div');
                            errorEl.className = 'field-error';
                            errorEl.textContent = message;
                            errorEl.style.color = '#ef4444';
                            errorEl.style.fontSize = '0.85rem';
                            errorEl.style.marginTop = '0.25rem';
                            
                            // Insert after input or its parent
                            const container = input.closest('.form-group') || input.parentNode;
                            container.appendChild(errorEl);
                        }
                    }
                    throw new Error(error.message || i18n.t('invoices.validationErrors') || 'Por favor, corrige los errores en el formulario');
                } else {
                    throw new Error(error.message || 'Error al crear la factura');
                }
            }

            this.core.showSuccessMessage(i18n.t('invoices.invoiceCreated'));
            modal.classList.add('fade-out');
            setTimeout(() => modal.remove(), 300);
            
            // Refresh invoice list
            await this.loadInvoices();

        } catch (error) {
            console.error('Error creating invoice:', error);
            this.core.showErrorMessage(error.message || i18n.t('invoices.errorCreating'));
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    /**
     * Handles Stripe payment for an invoice
     * Creates a Stripe checkout session and redirects to payment page
     * 
     * @param {Object} invoice - Invoice to pay
     * @param {Function} closeModal - Function to close the modal
     */
    async handleStripePayment(invoice, closeModal) {
        try {
            // Show loading state
            const stripeBtn = document.getElementById('pay-with-stripe-btn');
            const originalText = stripeBtn.innerHTML;
            stripeBtn.disabled = true;
            stripeBtn.innerHTML = '<span data-i18n="general.loading">Procesando...</span>';

            // Initialize PaymentManager if not exists
            if (!window.paymentManager) {
                window.paymentManager = new PaymentManager(this.core.authInstance);
            }

            // Create Stripe checkout session
            const result = await window.paymentManager.createCheckoutSession(invoice.id);

            if (!result.success) {
                throw new Error(result.error || 'Error al crear la sesión de pago');
            }
            
            // Redirect to Stripe Checkout
            console.log('[Invoice] Redirecting to Stripe:', result.checkoutUrl);
            window.location.href = result.checkoutUrl;

        } catch (error) {
            console.error('Error processing Stripe payment:', error);
            this.core.showErrorMessage(error.message || 'Error al procesar el pago con Stripe');
            
            // Restore button state
            const stripeBtn = document.getElementById('pay-with-stripe-btn');
            if (stripeBtn) {
                stripeBtn.disabled = false;
                stripeBtn.innerHTML = '💳 <span data-i18n="invoices.payWithStripe">Pagar con Stripe</span>';
            }
        }
    }

    /**
     * Converts a File object to base64 string
     * @param {File} file - File to convert
     * @returns {Promise<string>} Base64 string with data URL prefix
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}
