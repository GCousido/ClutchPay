/**
 * Dashboard Payments Module
 * 
 * @module dashboard/payments
 * @description Manages payment functionality including
 * load, filter, sort and render payments.
 * 
 * Exports:
 * - DashboardPayments: Payments management class
 * 
 * Features:
 * - Load payments from API
 * - Sort by date or amount
 * - Render payment cards
 * - Display payment details
 */

class DashboardPayments {
    /**
     * Creates DashboardPayments instance
     * 
     * @param {DashboardCore} core - Dashboard core instance
     */
    constructor(core) {
        this.core = core;
        this.allPayments = [];
        this.currentSortBy = 'paymentDate'; // paymentDate, amount
        this.currentSortOrder = 'desc'; // asc, desc
    }

    /**
     * Initializes payments module
     * 
     * @description
     * Sets up:
     * - Sort selector handler
     * - Sort order button handler
     * - Initial payments load
     */
    init() {
        this.initSortHandlers();
        this.loadPayments();
    }

    /**
     * Initializes sort control handlers
     */
    initSortHandlers() {
        const sortSelect = document.getElementById('payment-sort');
        const sortOrderBtn = document.getElementById('payment-sort-order-btn');

        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.currentSortBy = sortSelect.value;
                this.renderPayments();
            });
        }

        if (sortOrderBtn) {
            sortOrderBtn.addEventListener('click', () => {
                this.currentSortOrder = this.currentSortOrder === 'asc' ? 'desc' : 'asc';
                this.renderPayments();
            });
        }
    }

    /**
     * Loads payments from backend API
     * 
     * @async
     * @description
     * Fetches user's payments:
     * 1. GET /api/payments
     * 2. Stores in allPayments array
     * 3. Calls renderPayments()
     * 4. If error: Shows error message and empty state
     */
    async loadPayments() {
        try {
            const response = await fetch(
                `${this.core.authInstance.API_BASE_URL}/api/payments?limit=1000`,
                { credentials: 'include' }
            );

            if (!response.ok) {
                throw new Error('Error loading payments');
            }

            const data = await response.json();
            
            // API returns { meta: {...}, data: [...] }
            this.allPayments = data.data || [];
            this.renderPayments();
        } catch (error) {
            console.error('Error loading payments:', error);
            this.core.showErrorMessage(i18n.t('payments.errorLoading') || 'Error al cargar los pagos');
            const spinner = document.querySelector('#payments-section .loading-spinner');
            if (spinner) spinner.style.display = 'none';
            const emptyState = document.getElementById('empty-payments');
            if (emptyState) emptyState.style.display = 'flex';
        }
    }

    /**
     * Sorts payments array
     * 
     * @param {Array} payments - Array of payments to sort
     * @returns {Array} Sorted payments array
     */
    sortPayments(payments) {
        const sorted = [...payments];
        
        sorted.sort((a, b) => {
            let aVal, bVal;
            
            if (this.currentSortBy === 'paymentDate') {
                aVal = new Date(a.paymentDate).getTime();
                bVal = new Date(b.paymentDate).getTime();
            } else if (this.currentSortBy === 'amount') {
                // Get amount from related invoice
                aVal = parseFloat(a.invoice?.amount || 0);
                bVal = parseFloat(b.invoice?.amount || 0);
            }
            
            if (this.currentSortOrder === 'asc') {
                return aVal - bVal;
            } else {
                return bVal - aVal;
            }
        });
        
        return sorted;
    }

    /**
     * Renders payment cards based on sorting
     * 
     * @description
     * Displays payment grid with sorting:
     * - paymentDate/amount (asc/desc)
     * 
     * If empty: Shows empty state message
     * If has payments: Renders cards with payment details
     */
    renderPayments() {
        const grid = document.getElementById('payments-grid');
        const emptyState = document.getElementById('empty-payments');
        
        if (!grid || !emptyState) return;

        // Apply sorting
        const sortedPayments = this.sortPayments(this.allPayments);

        if (sortedPayments.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';
        
        const paymentsHTML = sortedPayments.map(payment => {
            const paymentDate = new Date(payment.paymentDate).toLocaleDateString();
            const amount = payment.invoice ? parseFloat(payment.invoice.amount).toFixed(2) : '0.00';
            const invoiceNumber = payment.invoice?.invoiceNumber || 'N/A';
            const paymentMethod = payment.paymentMethod || 'N/A';
            const subject = payment.subject || payment.invoice?.subject || 'Pago realizado';
            
            // Payment method icon
            let methodIcon = '💳';
            if (paymentMethod === 'PAYPAL') methodIcon = '🅿️';
            else if (paymentMethod === 'CARD') methodIcon = '💳';
            else if (paymentMethod === 'BANK_TRANSFER') methodIcon = '🏦';
            
            return `
                <div class="invoice-card payment-card" data-payment-id="${payment.id}">
                    <div class="invoice-header">
                        <span class="invoice-number">#${invoiceNumber}</span>
                        <span class="payment-method-badge">${methodIcon} ${paymentMethod}</span>
                    </div>
                    
                    <h3 class="invoice-subject">${subject}</h3>
                    
                    <div class="invoice-amount">€${amount}</div>
                    
                    <div class="invoice-details">
                        <div class="invoice-detail-row">
                            <span class="invoice-detail-label">${i18n.t('payments.paymentDate') || 'Fecha de pago'}:</span>
                            <span class="invoice-detail-value">${paymentDate}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        grid.innerHTML = paymentsHTML;
        
        // Add click event listeners to open modal
        grid.querySelectorAll('.payment-card').forEach(card => {
            card.addEventListener('click', () => {
                const paymentId = parseInt(card.dataset.paymentId);
                const payment = this.allPayments.find(p => p.id === paymentId);
                console.log('Payment clicked:', payment);
                if (payment) {
                    this.showPaymentModal(payment);
                }
            });
        });
    }

    /**
     * Shows detailed payment information in a modal
     * @param {Object} payment - Payment object with all details
     */
    async showPaymentModal(payment) {
        console.log('Opening payment modal for:', payment);
        
        const paymentDate = new Date(payment.paymentDate).toLocaleDateString();
        const amount = payment.invoice ? parseFloat(payment.invoice.amount).toFixed(2) : '0.00';
        const invoiceNumber = payment.invoice?.invoiceNumber || 'N/A';
        const paymentMethod = payment.paymentMethod || 'N/A';
        const subject = payment.subject || payment.invoice?.subject || 'Pago realizado';
        
        // Payment method icon
        let methodIcon = '💳';
        if (paymentMethod === 'PAYPAL') methodIcon = '🅿️';
        else if (paymentMethod === 'CARD') methodIcon = '💳';
        else if (paymentMethod === 'BANK_TRANSFER') methodIcon = '🏦';
        
        // Load payer and receiver information
        let payerInfo = 'Cargando...';
        let receiverInfo = 'Cargando...';
        
        try {
            const promises = [];
            
            if (payment.invoice?.debtorUserId) {
                promises.push(
                    fetch(`${this.core.authInstance.API_BASE_URL}/api/users/${payment.invoice.debtorUserId}`, { credentials: 'include' })
                        .then(res => res.ok ? res.json() : null)
                );
            } else {
                promises.push(Promise.resolve(null));
            }
            
            if (payment.invoice?.issuerUserId) {
                promises.push(
                    fetch(`${this.core.authInstance.API_BASE_URL}/api/users/${payment.invoice.issuerUserId}`, { credentials: 'include' })
                        .then(res => res.ok ? res.json() : null)
                );
            } else {
                promises.push(Promise.resolve(null));
            }
            
            const [payer, receiver] = await Promise.all(promises);
            
            if (payer) {
                payerInfo = payer.name && payer.surnames 
                    ? `${payer.name} ${payer.surnames}` 
                    : (payer.name || payer.email);
            } else {
                payerInfo = 'No disponible';
            }
            
            if (receiver) {
                receiverInfo = receiver.name && receiver.surnames 
                    ? `${receiver.name} ${receiver.surnames}` 
                    : (receiver.name || receiver.email);
            } else {
                receiverInfo = 'No disponible';
            }
        } catch (error) {
            console.error('Error loading user info:', error);
            payerInfo = 'No disponible';
            receiverInfo = 'No disponible';
        }
        
        console.log('Generating modal HTML...');
        
        const modalHTML = `
            <div class="modal-overlay" id="payment-modal">
                <div class="modal-content invoice-modal-content">
                    <button class="modal-close" id="close-payment-modal">×</button>
                    
                    <div class="invoice-modal-header">
                        <div>
                            <h2>${i18n.t('payments.paymentDetails') || 'Detalles del Pago'}</h2>
                            <div class="invoice-type-badge">
                                ${methodIcon} ${paymentMethod}
                            </div>
                        </div>
                    </div>
                    
                    <div class="invoice-modal-body">
                        <div class="invoice-modal-section">
                            <h3 data-i18n="invoices.invoiceNumber">Número de Factura</h3>
                            <p>#${invoiceNumber}</p>
                        </div>
                        
                        <div class="invoice-modal-section">
                            <h3 data-i18n="payments.payer">Pagador</h3>
                            <p>${payerInfo}</p>
                        </div>
                        
                        <div class="invoice-modal-section">
                            <h3 data-i18n="payments.receiver">Receptor</h3>
                            <p>${receiverInfo}</p>
                        </div>
                        
                        <div class="invoice-modal-section">
                            <h3 data-i18n="payments.subject">Concepto</h3>
                            <p>${subject}</p>
                        </div>
                        
                        <div class="invoice-modal-section">
                            <h3 data-i18n="invoices.amount">Importe</h3>
                            <p class="invoice-modal-amount">€${amount}</p>
                        </div>
                        
                        <div class="invoice-modal-dates">
                            <div class="invoice-modal-date-item">
                                <span class="date-label" data-i18n="payments.paymentDate">Fecha de pago:</span>
                                <span class="date-value">${paymentDate}</span>
                            </div>
                        </div>
                        
                        ${payment.paymentReference ? `
                        <div class="invoice-modal-section">
                            <h3 data-i18n="payments.reference">Referencia del Pago</h3>
                            <p class="payment-reference-full">${payment.paymentReference}</p>
                        </div>
                        ` : ''}
                        
                        ${payment.receiptPdfUrl && payment.receiptPdfUrl !== 'unavailable' ? `
                        <div class="invoice-modal-section">
                            <h3 data-i18n="payments.receipt">Recibo</h3>
                            <div class="payment-modal-buttons">
                                <a href="${payment.receiptPdfUrl}" target="_blank" class="btn btn-primary">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                        <line x1="16" y1="13" x2="8" y2="13"/>
                                        <line x1="16" y1="17" x2="8" y2="17"/>
                                        <polyline points="10 9 9 9 8 9"/>
                                    </svg>
                                    ${i18n.t('payments.downloadReceipt') || 'Descargar Recibo'}
                                </a>
                                <button class="btn btn-secondary" id="close-payment-modal-btn">
                                    ${i18n.t('general.close') || 'Cerrar'}
                                </button>
                            </div>
                        </div>
                        ` : `
                    </div>
                    
                    <div class="invoice-modal-footer">
                        <button class="btn btn-secondary" id="close-payment-modal-btn">
                            ${i18n.t('general.close') || 'Cerrar'}
                        </button>
                    </div>
                        `}
                    ${payment.receiptPdfUrl && payment.receiptPdfUrl !== 'unavailable' ? '' : '</div>'}
                </div>
            </div>
        `;
        
        console.log('Inserting modal into DOM...');
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        console.log('Modal inserted, setting up event listeners...');
        const modal = document.getElementById('payment-modal');
        const closeBtn = document.getElementById('close-payment-modal');
        const closeModalBtn = document.getElementById('close-payment-modal-btn');
        
        if (!modal) {
            console.error('Modal element not found!');
            return;
        }
        
        const closeModal = () => {
            modal.classList.add('fade-out');
            setTimeout(() => modal.remove(), 300);
        };
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeModal);
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Trigger fade-in animation (same as invoice modal)
        setTimeout(() => modal.classList.add('show'), 10);
    }
}
