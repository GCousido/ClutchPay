/**
 * Dashboard Profile Module
 * 
 * @module dashboard/profile
 * @description Handles user profile editing functionality including
 * modal management, image preview, and profile updates.
 * 
 * Exports:
 * - DashboardProfile: Profile management class
 * 
 * Features:
 * - Profile display in header
 * - Edit profile modal
 * - Live image URL preview
 * - Profile form validation and submission
 * - Desktop and mobile profile buttons
 */

class DashboardProfile {
    /**
     * Creates DashboardProfile instance
     * 
     * @param {DashboardCore} core - Dashboard core instance
     */
    constructor(core) {
        this.core = core;
    }

    /**
     * Initializes profile module
     * 
     * @description
     * Sets up:
     * - Initial UI update
     * - Logout button handlers (desktop + mobile)
     * - Edit profile button handlers (desktop + mobile)
     * - Image preview listeners
     * - Modal close handlers
     * - Profile form submission
     */
    init() {
        this.updateUI();
        this.initLogoutButtons();
        this.initEditProfileButtons();
        this.initImagePreview();
        this.initModalHandlers();
        this.initFormSubmission();
    }

    /**
     * Updates profile UI with current user data
     * 
     * @description
     * Updates:
     * - #profile-pic: User avatar (fallback to avatar-default.svg)
     * - #user-name: Full name (name + surnames)
     * - #user-email: User email
     */
    updateUI() {
        const currentUser = this.core.currentUser;
        const profilePic = document.getElementById('profile-pic');
        
        // Set image with fallback
        if (currentUser.imageUrl && currentUser.imageUrl.trim() !== '') {
            profilePic.src = currentUser.imageUrl;
            profilePic.onerror = function() {
                this.onerror = null;
                this.src = '../imagenes/avatar-default.svg';
            };
        } else {
            profilePic.src = '../imagenes/avatar-default.svg';
        }
        
        document.getElementById('user-name').textContent = `${currentUser.name} ${currentUser.surnames}`;
        
        const emailElement = document.getElementById('user-email');
        if (emailElement) {
            emailElement.textContent = currentUser.email;
        }
    }

    /**
     * Initializes logout button handlers
     * 
     * @description
     * Sets up click handlers for:
     * - #logout-btn (desktop)
     * - #logout-btn-mobile (mobile)
     */
    initLogoutButtons() {
        // Desktop logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await this.core.logout();
            });
        }

        // Mobile logout
        const logoutBtnMobile = document.getElementById('logout-btn-mobile');
        if (logoutBtnMobile) {
            logoutBtnMobile.addEventListener('click', async () => {
                await this.core.logout();
            });
        }
    }

    /**
     * Initializes edit profile button handlers
     * 
     * @description
     * Sets up click handlers for:
     * - #edit-profile-btn (desktop)
     * - #edit-profile-btn-mobile (mobile)
     * 
     * Opens modal and fills form with current user data
     */
    initEditProfileButtons() {
        const openModal = () => {
            const currentUser = this.core.currentUser;
            
            // Fill form with current user data
            document.getElementById('name').value = currentUser.name || '';
            document.getElementById('surnames').value = currentUser.surnames || '';
            document.getElementById('phone').value = currentUser.phone || '';
            document.getElementById('country').value = currentUser.country || '';
            document.getElementById('imageUrl').value = currentUser.imageUrl || '';
            
            // Update preview image
            const previewImg = document.getElementById('image-preview');
            if (currentUser.imageUrl && currentUser.imageUrl.trim() !== '') {
                previewImg.src = currentUser.imageUrl;
                previewImg.onerror = function() {
                    this.onerror = null;
                    this.src = '../imagenes/avatar-default.svg';
                };
            } else {
                previewImg.src = '../imagenes/avatar-default.svg';
            }
            
            document.getElementById('edit-profile-modal').style.display = 'flex';
        };

        // Desktop edit button
        const editBtn = document.getElementById('edit-profile-btn');
        if (editBtn) {
            editBtn.addEventListener('click', openModal);
        }

        // Mobile edit button
        const editBtnMobile = document.getElementById('edit-profile-btn-mobile');
        if (editBtnMobile) {
            editBtnMobile.addEventListener('click', openModal);
        }
    }

    /**
     * Initializes drag and drop image upload
     * 
     * @description
     * Sets up drag and drop functionality, file selection,
     * image preview, and upload to Cloudinary.
     */
    initImagePreview() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('image-file-input');
        const selectBtn = document.getElementById('select-image-btn');
        const previewContainer = document.getElementById('image-preview-container');
        const previewImg = document.getElementById('image-preview');
        const removeBtn = document.getElementById('remove-image-btn');
        const imageUrlInput = document.getElementById('imageUrl');
        
        if (!dropZone || !fileInput) return;
        
        // Current selected file
        this.selectedFile = null;
        
        // Click to select file
        selectBtn.addEventListener('click', () => fileInput.click());
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleImageFile(file);
            }
        });
        
        // Drag and drop events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            });
        });
        
        dropZone.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleImageFile(file);
            }
        });
        
        // Remove image button
        removeBtn.addEventListener('click', () => {
            this.selectedFile = null;
            imageUrlInput.value = '';
            previewContainer.style.display = 'none';
            dropZone.querySelector('.drop-zone-content').style.display = 'flex';
            fileInput.value = '';
        });
    }
    
    /**
     * Handles selected image file
     * @param {File} file - Selected image file
     */
    handleImageFile(file) {
        this.selectedFile = file;
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewImg = document.getElementById('image-preview');
            const previewContainer = document.getElementById('image-preview-container');
            const dropZone = document.getElementById('drop-zone');
            
            previewImg.src = e.target.result;
            previewContainer.style.display = 'flex';
            dropZone.querySelector('.drop-zone-content').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
    
    /**
     * Converts File to base64 string
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

    /**
     * Initializes modal close handlers
     * 
     * @description
     * Sets up close handler for #close-modal button
     */
    initModalHandlers() {
        const closeModal = document.getElementById('close-modal');
        if (closeModal) {
            closeModal.onclick = () => {
                document.getElementById('edit-profile-modal').style.display = 'none';
            };
        }
    }

    /**
     * Initializes profile form submission
     * 
     * @description
     * Handles form submit:
     * 1. Collects form data (fallback to current values)
     * 2. Calls core.updateUserProfile()
     * 3. If success: Updates UI, shows message, closes modal
     * 4. If error: Shows error message
     */
    initFormSubmission() {
        const form = document.getElementById('edit-profile-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();

                const currentUser = this.core.currentUser;
                const submitBtn = form.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                
                try {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Subiendo imagen...';
                    
                    let imageUrl = document.getElementById('imageUrl').value || currentUser.imageUrl;
                    
                    // If there's a new image selected, upload it to Cloudinary first
                    if (this.selectedFile) {
                        const base64Image = await this.fileToBase64(this.selectedFile);
                        
                        // Upload to Cloudinary via backend API
                        const uploadResponse = await fetch(
                            `${this.core.authInstance.API_BASE_URL}/api/users/${currentUser.id}`,
                            {
                                method: 'PUT',
                                credentials: 'include',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    imageUrl: base64Image
                                })
                            }
                        );
                        
                        if (!uploadResponse.ok) {
                            throw new Error('Error al subir la imagen');
                        }
                        
                        const uploadResult = await uploadResponse.json();
                        imageUrl = uploadResult.imageUrl;
                    }
                    
                    submitBtn.textContent = 'Guardando...';
                    
                    const updatedUser = {
                        name: document.getElementById('name').value || currentUser.name,
                        surnames: document.getElementById('surnames').value || currentUser.surnames,
                        phone: document.getElementById('phone').value || currentUser.phone,
                        country: document.getElementById('country').value || currentUser.country,
                        imageUrl: imageUrl
                    };

                    const result = await this.core.updateUserProfile(updatedUser);

                    if (result) {
                        this.selectedFile = null;
                        this.updateUI();
                        this.core.showSuccessMessage(i18n.t('userDashboard.profileUpdated'));
                        document.getElementById('edit-profile-modal').style.display = 'none';
                    } else {
                        this.core.showErrorMessage(i18n.t('userDashboard.profileError'));
                    }
                } catch (error) {
                    console.error('Error updating profile:', error);
                    this.core.showErrorMessage('Error al actualizar el perfil: ' + error.message);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            };
        }
    }
}
