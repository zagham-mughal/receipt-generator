// TypeScript Receipt Generator Frontend

// Types
interface ReceiptItem {
    name: string;
    quantity: number;
    price: number;
}

interface ReceiptFormData {
    companyId: number;
    country: string;
    date: string;
    paymentMethod: string;
    cardLast4?: string;
    cardEntryMethod?: string;
    items: ReceiptItem[];
}

interface ReceiptData extends ReceiptFormData {
    receiptNumber: string;
    design: string;
}

interface Design {
    id: number;
    name: string;
    businessType: string;
    features: {
        barcode: boolean;
        paymentDetails: boolean;
        cashier: boolean;
    };
}

interface CompanyData {
    id: number;
    name: string;
    address: string;
    email: string;
    phone: string;
    country: string;
    designId: number;
    designName: string;
    businessType: string;
}

interface StoreData {
    id: number;
    companyId: number;
    storeCode: string;
    address: string;
    cityState: string;
    phone: string;
    items: string;
}

interface GenerateReceiptResponse {
    success: boolean;
    receiptNumber: string;
    fileName: string;
    downloadUrl: string;
    design: string;
    error?: string;
    message?: string;
}

// Global state
let itemCount: number = 0;
let companies: CompanyData[] = [];
let stores: StoreData[] = [];
let companyItems: string[] = [];
let currentReceiptData: ReceiptData | null = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
    // Check authentication
    try {
        const authResponse = await fetch('/api/auth/check', {
            credentials: 'include'
        });
        const authData = await authResponse.json();
        
        if (!authData.authenticated) {
            // Hide loading overlay before redirect
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
            // Redirect to login page
            window.location.href = '/login';
            return;
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
        // Hide loading overlay before redirect
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
        window.location.href = '/login';
        return;
    }
    
    // Set up logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (): Promise<void> => {
            try {
                await fetch('/api/logout', {
                    method: 'POST',
                    credentials: 'include'
                });
                window.location.href = '/login';
            } catch (error) {
                console.error('Error logging out:', error);
                window.location.href = '/login';
            }
        });
    }
    
    // Set current date/time
    const now = new Date();
    const dateTimeLocal = now.toISOString().slice(0, 16);
    const dateInput = document.getElementById('date') as HTMLInputElement;
    if (dateInput) dateInput.value = dateTimeLocal;
    
    // Load companies from database
    await loadCompanies();
    
    // Add first item by default
    addItem();
    
    // Event listeners
    const addItemBtn = document.getElementById('addItemBtn');
    const receiptForm = document.getElementById('receiptForm') as HTMLFormElement;
    const newReceiptBtn = document.getElementById('newReceiptBtn');
    const closeReceiptPreview = document.getElementById('closeReceiptPreview');
    const itemsList = document.getElementById('itemsList');
    const countrySelect = document.getElementById('country') as HTMLSelectElement;
    const paymentMethodSelect = document.getElementById('paymentMethod') as HTMLSelectElement;
    const companySelect = document.getElementById('designId') as HTMLSelectElement;
    // Hide Tax row in preview
    const taxPreviewEl = document.getElementById('taxPreview');
    if (taxPreviewEl && taxPreviewEl.parentElement) {
        (taxPreviewEl.parentElement as HTMLElement).style.display = 'none';
    }
    
    if (addItemBtn) addItemBtn.addEventListener('click', addItem);
    if (receiptForm) {
        console.log('Adding submit event listener to form');
        receiptForm.addEventListener('submit', generateReceipt);
    } else {
        console.error('Receipt form not found');
    }
    if (newReceiptBtn) newReceiptBtn.addEventListener('click', resetForm);
    if (closeReceiptPreview) closeReceiptPreview.addEventListener('click', closeReceiptPreviewHandler);
    if (itemsList) itemsList.addEventListener('input', updateTotal);
    if (countrySelect) countrySelect.addEventListener('change', filterCompaniesByCountry);
    if (paymentMethodSelect) paymentMethodSelect.addEventListener('change', toggleCardFields);
    if (companySelect) {
        companySelect.addEventListener('change', async () => {
            await loadStoresForSelectedCompany();
            await loadItemsForSelectedCompany();
            
            // Re-evaluate vehicle details visibility when company changes
            toggleCardFields();
            
            // Show company name and vehicle ID for USA companies (override any hiding from toggleCardFields)
            const selectedCompanyId = companySelect.value ? parseInt(companySelect.value) : null;
            const selectedCompany = selectedCompanyId ? companies.find(c => c.id === selectedCompanyId) : null;
            const isUSACompany = selectedCompany && selectedCompany.country === 'United States of America';
            const isFlyingJCanada = selectedCompany && selectedCompany.name.toLowerCase().includes('flying j') && selectedCompany.country === 'Canada';
            const paymentMethod = (document.getElementById('paymentMethod') as HTMLSelectElement)?.value || '';
            
            // Hide Vehicle ID for Flying J Canada (but not for Visa or Master payment method)
            if (isFlyingJCanada && paymentMethod !== 'Visa' && paymentMethod !== 'Master') {
                const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement | null;
                const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement | null;
                if (vehicleIdGroup) vehicleIdGroup.style.display = 'none';
                if (vehicleIdField) {
                    vehicleIdField.required = false;
                    vehicleIdField.removeAttribute('required');
                }
            }
            
            if (isUSACompany) {
                const companyNameGroup = document.getElementById('companyNameGroup') as HTMLElement | null;
                const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement | null;
                const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement | null;
                const vehicleDetailsRow = document.getElementById('vehicleDetailsRow') as HTMLElement | null;
                
                // Show vehicle details row
                if (vehicleDetailsRow) {
                    vehicleDetailsRow.style.display = 'grid';
                    
                    // Move company name group to vehicleDetailsRow so they're in the same row
                    if (companyNameGroup) {
                        const currentParent = companyNameGroup.parentElement;
                        // Only move if it's not already in vehicleDetailsRow
                        if (currentParent !== vehicleDetailsRow) {
                            companyNameGroup.style.display = 'block';
                            // Insert company name group right after Vehicle ID group (as second child)
                            const vehicleIdGroup = vehicleDetailsRow.querySelector('.form-group:first-child') as HTMLElement | null;
                            if (vehicleIdGroup && vehicleIdGroup.nextSibling) {
                                vehicleDetailsRow.insertBefore(companyNameGroup, vehicleIdGroup.nextSibling);
                            } else {
                                // If no next sibling, append after Vehicle ID
                                const dlNumberGroup = vehicleDetailsRow.querySelector('.form-group:nth-child(2)') as HTMLElement | null;
                                if (dlNumberGroup) {
                                    vehicleDetailsRow.insertBefore(companyNameGroup, dlNumberGroup);
                                } else {
                                    vehicleDetailsRow.appendChild(companyNameGroup);
                                }
                            }
                        } else {
                            companyNameGroup.style.display = 'block';
                        }
                    }
                }
                
                // Show company name field
                if (companyNameField) {
                    companyNameField.disabled = false;
                    companyNameField.required = true;
                    companyNameField.setAttribute('required', 'required');
                }
                
                // Show vehicle ID field
                const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement | null;
                if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
                if (vehicleIdField) {
                    vehicleIdField.disabled = false;
                    vehicleIdField.required = true;
                    vehicleIdField.setAttribute('required', 'required');
                }
            }
            
            // Update item labels and pump field visibility
            updateAllItemUnitLabels();
            // Update payment method options based on company
            updatePaymentMethodOptions();
        });
    }
    
    // Add input validation for EFS fields
    setupInputValidation();
    
    // Setup input validation for EFS fields
function setupInputValidation(): void {
    // Check Number fields - only allow digits
    const checkNumberInput = document.getElementById('checkNumber') as HTMLInputElement;
    const checkNumberConfirmInput = document.getElementById('checkNumberConfirm') as HTMLInputElement;
    
    if (checkNumberInput) {
        checkNumberInput.addEventListener('input', function(e) {
            const target = e.target as HTMLInputElement;
            target.value = target.value.replace(/[^0-9]/g, '');
        });
        
        checkNumberInput.addEventListener('keypress', function(e) {
            const char = String.fromCharCode(e.which);
            if (!/[0-9]/.test(char)) {
                e.preventDefault();
            }
        });
    }
    
    if (checkNumberConfirmInput) {
        checkNumberConfirmInput.addEventListener('input', function(e) {
            const target = e.target as HTMLInputElement;
            target.value = target.value.replace(/[^0-9]/g, '');
        });
        
        checkNumberConfirmInput.addEventListener('keypress', function(e) {
            const char = String.fromCharCode(e.which);
            if (!/[0-9]/.test(char)) {
                e.preventDefault();
            }
        });
    }
    
    // Driver Name fields - only allow letters and spaces
    const driverFirstNameInput = document.getElementById('driverFirstName') as HTMLInputElement;
    const driverLastNameInput = document.getElementById('driverLastName') as HTMLInputElement;
    
    if (driverFirstNameInput) {
        driverFirstNameInput.addEventListener('input', function(e) {
            const target = e.target as HTMLInputElement;
            target.value = target.value.replace(/[^a-zA-Z\s]/g, '');
        });
        
        driverFirstNameInput.addEventListener('keypress', function(e) {
            const char = String.fromCharCode(e.which);
            if (!/[a-zA-Z\s]/.test(char)) {
                e.preventDefault();
            }
        });
    }
    
    if (driverLastNameInput) {
        driverLastNameInput.addEventListener('input', function(e) {
            const target = e.target as HTMLInputElement;
            target.value = target.value.replace(/[^a-zA-Z\s]/g, '');
        });
        
        driverLastNameInput.addEventListener('keypress', function(e) {
            const char = String.fromCharCode(e.which);
            if (!/[a-zA-Z\s]/.test(char)) {
                e.preventDefault();
            }
        });
    }
}

// Restrict cardLast4 input to digits only
    const cardLast4Input = document.getElementById('cardLast4') as HTMLInputElement;
    if (cardLast4Input) {
        cardLast4Input.addEventListener('input', function(e) {
            const target = e.target as HTMLInputElement;
            // Remove any non-digit characters
            target.value = target.value.replace(/[^0-9]/g, '');
        });
    }
    
    // Hide loading overlay and show main content
    const loadingOverlay = document.getElementById('loadingOverlay');
    const mainContainer = document.getElementById('mainContainer');
    
    if (loadingOverlay && mainContainer) {
        // Add a small delay for smooth transition
        setTimeout(() => {
            loadingOverlay.classList.add('hidden');
            mainContainer.style.display = 'block';
        }, 300);
    }
});

// Load companies from database
async function loadCompanies(): Promise<void> {
    try {
        const response = await fetch('/api/companies', {
            credentials: 'include'
        });
        const data = await response.json();
        companies = data.companies;
        
        // Initialize company dropdown with placeholder
        const select = document.getElementById('designId') as HTMLSelectElement;
        if (select) {
            select.innerHTML = '';
            
            // Add a placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = '-- Select a Country First --';
            placeholderOption.disabled = true;
            placeholderOption.selected = true;
            select.appendChild(placeholderOption);
            select.disabled = true;
            
            // Auto-fill company data when selected
            select.addEventListener('change', handleCompanySelection);
        }
    } catch (error) {
        console.error('Error loading companies:', error);
        alert('Failed to load companies. Please refresh the page.');
    }
}

// Toggle card fields based on payment method
// Helper function to ensure all vehicleId fields are properly handled (there can be multiple)
function handleAllVehicleIdFields(): void {
    // Get all vehicleId fields (there are multiple - one in vehicleDetailsRow and one in efsDetailsRow)
    const allVehicleIdFields = document.querySelectorAll('#vehicleId') as NodeListOf<HTMLInputElement>;
    
    allVehicleIdFields.forEach(field => {
        const formGroup = field.closest('.form-group') as HTMLElement | null;
        const parentRow = formGroup?.parentElement as HTMLElement | null;
        
        // Check if field or any ancestor is hidden
        const formGroupHidden = formGroup && (formGroup.style.display === 'none' || window.getComputedStyle(formGroup).display === 'none');
        const parentRowHidden = parentRow && (parentRow.style.display === 'none' || window.getComputedStyle(parentRow).display === 'none');
        const notInRenderingTree = (field as HTMLElement).offsetParent === null;
        
        const isHidden = !formGroup || formGroupHidden || parentRowHidden || notInRenderingTree;
        
        if (isHidden) {
            // Remove required and disable if hidden
            field.required = false;
            field.removeAttribute('required');
            field.disabled = true;
        }
    });
}

// Helper function to restore required attributes for visible fields
function restoreRequiredAttributes(): void {
    // Check if this is a Husky + Visa combination - if so, don't restore required attributes
    const paymentMethodInput = document.getElementById('paymentMethod') as HTMLSelectElement;
    const designIdInput = document.getElementById('designId') as HTMLSelectElement;
    const paymentMethod = paymentMethodInput?.value;
    const selectedCompanyId = designIdInput?.value ? parseInt(designIdInput.value) : null;
    const selectedCompany = selectedCompanyId ? companies.find(c => c.id === selectedCompanyId) : null;
    const isHuskyCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('husky');
    const isPetroCanadaCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('petro-canada');
    const isBVDPetroleumCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('bvd petroleum');
    const isAnyCanadaCompany = selectedCompany && selectedCompany.country === 'Canada';
    const isOne9Company = selectedCompany && (selectedCompany.name.toLowerCase().includes('one 9') || selectedCompany.name.toLowerCase().includes('one9'));
    const isLovesCompany = selectedCompany && (selectedCompany.name.toLowerCase().includes('love') || selectedCompany.name.toLowerCase().includes("love's"));
    const isPilotCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('pilot');
    const isOne9Master = isOne9Company && paymentMethod === 'Master';
    const isOne9EFS = isOne9Company && paymentMethod === 'EFS';
    const isPilotEFS = isPilotCompany && paymentMethod === 'EFS';
    const isLovesEFS = isLovesCompany && paymentMethod === 'EFS';
    
    // For One9 + EFS and Pilot + EFS, ensure check number and driver name fields remain hidden and not required
    if (isOne9EFS || isPilotEFS) {
        const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
        const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
        const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
        const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
        
        const hideField = (field: HTMLInputElement | null) => {
            if (field) {
                field.required = false;
                field.removeAttribute('required');
                const formGroup = field.closest('.form-group') as HTMLElement | null;
                if (formGroup) {
                    formGroup.style.display = 'none';
                }
            }
        };
        
        hideField(checkNumberField);
        hideField(checkNumberConfirmField);
        hideField(driverFirstNameField);
        hideField(driverLastNameField);
    }
    const isHuskyVisa = isHuskyCompany && (paymentMethod === 'Visa' || paymentMethod === 'Master' || paymentMethod === 'Mastercard' || paymentMethod === 'Interac' || paymentMethod === 'American Express' || paymentMethod === 'EFS' || paymentMethod === 'TCH');
    const isPetroCanadaAny = isPetroCanadaCompany; // Hide for any payment method
    const isBVDPetroleumAny = isBVDPetroleumCompany; // Hide for any payment method
    
    // For Love's + EFS, ensure check number and driver name fields remain hidden and not required
    if (isLovesEFS) {
        const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
        const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
        const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
        const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
        
        const showField = (field: HTMLInputElement | null, required: boolean = true) => {
            if (field) {
                const formGroup = field.closest('.form-group') as HTMLElement | null;
                if (formGroup) {
                    formGroup.style.display = 'block';
                }
                if (required) {
                    field.setAttribute('required', 'required');
                    field.required = true;
                } else {
                    field.removeAttribute('required');
                    field.required = false;
                }
            }
        };
        
        const hideField = (field: HTMLInputElement | null) => {
            if (field) {
                field.required = false;
                field.removeAttribute('required');
                const formGroup = field.closest('.form-group') as HTMLElement | null;
                if (formGroup) {
                    formGroup.style.display = 'none';
                }
            }
        };
        
        // Show check number, driver first name, and driver last name for Loves + EFS
        showField(checkNumberField, true);
        showField(driverFirstNameField, true);
        showField(driverLastNameField, true);
        // Hide check number confirm field
        hideField(checkNumberConfirmField);
    }
    
    // For One9 + Master, ensure Vehicle ID in vehicleDetailsRow is not required (since it's hidden)
    if (isOne9Master) {
        const vehicleDetailsRow = document.getElementById('vehicleDetailsRow') as HTMLElement | null;
        const vehicleDetailsRowVehicleId = vehicleDetailsRow?.querySelector('#vehicleId') as HTMLInputElement | null;
        if (vehicleDetailsRowVehicleId) {
            vehicleDetailsRowVehicleId.required = false;
            vehicleDetailsRowVehicleId.removeAttribute('required');
        }
    }
    
    // For Pilot + Master, ensure Vehicle ID in vehicleDetailsRow is not required (since it's hidden)
    // But enable Vehicle ID in efsDetailsRow
    const isPilotMaster = isPilotCompany && paymentMethod === 'Master';
    if (isPilotMaster) {
        const vehicleDetailsRow = document.getElementById('vehicleDetailsRow') as HTMLElement | null;
        const vehicleDetailsRowVehicleId = vehicleDetailsRow?.querySelector('#vehicleId') as HTMLInputElement | null;
        if (vehicleDetailsRowVehicleId) {
            vehicleDetailsRowVehicleId.required = false;
            vehicleDetailsRowVehicleId.removeAttribute('required');
            vehicleDetailsRowVehicleId.disabled = true;
        }
        
        // Enable Vehicle ID in efsDetailsRow for Pilot + Master
        const efsDetailsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
        const vehicleIdInEfsRow = efsDetailsRow?.querySelector('#vehicleId') as HTMLInputElement | null;
        if (vehicleIdInEfsRow) {
            vehicleIdInEfsRow.disabled = false;
            vehicleIdInEfsRow.required = true;
            vehicleIdInEfsRow.setAttribute('required', 'required');
            const vehicleIdGroupInEfsRow = vehicleIdInEfsRow.closest('.form-group') as HTMLElement | null;
            if (vehicleIdGroupInEfsRow) {
                vehicleIdGroupInEfsRow.style.display = 'block';
            }
        }
    }
    
        if (isPetroCanadaAny) {
            // For Petro-Canada + any payment method, ensure fields remain disabled and not required
            console.log('RestoreRequiredAttributes: Keeping fields disabled for Petro-Canada + any payment method');
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            const cardEntryMethodField = document.getElementById('cardEntryMethod') as HTMLSelectElement;
            
            if (vehicleIdField) {
                vehicleIdField.required = false;
                vehicleIdField.disabled = true;
                vehicleIdField.removeAttribute('required');
            }
            if (dlNumberField) {
                dlNumberField.required = false;
                dlNumberField.disabled = true;
                dlNumberField.removeAttribute('required');
            }
            if (companyNameField) {
                companyNameField.required = false;
                companyNameField.disabled = true;
                companyNameField.removeAttribute('required');
            }
            // Enable card entry method for Canadian companies (Petro-Canada)
            if (cardEntryMethodField) {
                cardEntryMethodField.disabled = false;
                cardEntryMethodField.setAttribute('required', 'required');
                const cardEntryMethodGroup = cardEntryMethodField.closest('.form-group') as HTMLElement;
                if (cardEntryMethodGroup) cardEntryMethodGroup.style.display = 'block';
            }
            return;
    } else if (isBVDPetroleumAny) {
        // For BVD Petroleum + any payment method, ensure fields remain disabled and not required
        console.log('RestoreRequiredAttributes: Keeping fields disabled for BVD Petroleum + any payment method');
        const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
        const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
        const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
        const cardEntryMethodField = document.getElementById('cardEntryMethod') as HTMLSelectElement;
        
        if (vehicleIdField) {
            vehicleIdField.required = false;
            vehicleIdField.disabled = true;
            vehicleIdField.removeAttribute('required');
        }
        if (dlNumberField) {
            dlNumberField.required = false;
            dlNumberField.disabled = true;
            dlNumberField.removeAttribute('required');
        }
        if (companyNameField) {
            companyNameField.required = false;
            companyNameField.disabled = true;
            companyNameField.removeAttribute('required');
        }
        // Enable card entry method for Canadian companies (BVD Petroleum if Canadian)
        if (cardEntryMethodField) {
            const isBVDPetroleumCanadian = selectedCompany && selectedCompany.country === 'Canada';
            if (isBVDPetroleumCanadian) {
                cardEntryMethodField.disabled = false;
                cardEntryMethodField.setAttribute('required', 'required');
                const cardEntryMethodGroup = cardEntryMethodField.closest('.form-group') as HTMLElement;
                if (cardEntryMethodGroup) cardEntryMethodGroup.style.display = 'block';
            } else {
                cardEntryMethodField.required = false;
                cardEntryMethodField.disabled = true;
                cardEntryMethodField.removeAttribute('required');
            }
        }
        return;
    } else if (isAnyCanadaCompany) {
        // Show card entry method for Canadian companies
        const cardEntryMethodField = document.getElementById('cardEntryMethod') as HTMLSelectElement;
        if (cardEntryMethodField) {
            cardEntryMethodField.disabled = false;
            cardEntryMethodField.setAttribute('required', 'required');
            const cardEntryMethodGroup = cardEntryMethodField.closest('.form-group') as HTMLElement;
            if (cardEntryMethodGroup) cardEntryMethodGroup.style.display = 'block';
        }
        // If vehicle details are currently hidden, ensure their fields are not required
        const vehicleDetailsRow = document.getElementById('vehicleDetailsRow') as HTMLElement;
        if (vehicleDetailsRow && vehicleDetailsRow.style.display === 'none') {
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (vehicleIdField) { vehicleIdField.required = false; vehicleIdField.disabled = true; vehicleIdField.removeAttribute('required'); }
            if (dlNumberField) { dlNumberField.required = false; dlNumberField.disabled = true; dlNumberField.removeAttribute('required'); }
            if (companyNameField) { companyNameField.required = false; companyNameField.disabled = true; companyNameField.removeAttribute('required'); }
        }
        // Do not restore required attributes for these fields
        return;
    } else if (isHuskyVisa) {
        // For Husky + Visa/EFS/TCH, ensure fields remain disabled and not required
        console.log('RestoreRequiredAttributes: Keeping fields disabled for Husky + Visa/EFS/TCH');
        const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
        const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
        const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
        
        if (vehicleIdField) {
            vehicleIdField.required = false;
            vehicleIdField.disabled = true;
            vehicleIdField.removeAttribute('required');
        }
        if (dlNumberField) {
            dlNumberField.required = false;
            dlNumberField.disabled = true;
            dlNumberField.removeAttribute('required');
        }
        if (companyNameField) {
            companyNameField.required = false;
            companyNameField.disabled = true;
            companyNameField.removeAttribute('required');
        }
        return;
    }
    
    // For One9 + Master, handle Vehicle ID fields separately (there are two with duplicate IDs)
    if (isOne9Master) {
        // Ensure Vehicle ID in vehicleDetailsRow (hidden) is not required
        const vehicleDetailsRow = document.getElementById('vehicleDetailsRow') as HTMLElement | null;
        const vehicleDetailsRowVehicleId = vehicleDetailsRow?.querySelector('#vehicleId') as HTMLInputElement | null;
        if (vehicleDetailsRowVehicleId) {
            vehicleDetailsRowVehicleId.required = false;
            vehicleDetailsRowVehicleId.removeAttribute('required');
        }
        // Ensure Vehicle ID in efsDetailsRow (visible) is required
        const efsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
        if (efsRow) {
            const allVehicleIdFields = document.querySelectorAll('#vehicleId');
            for (let i = 0; i < allVehicleIdFields.length; i++) {
                const field = allVehicleIdFields[i] as HTMLInputElement;
                const group = field.closest('.form-group') as HTMLElement | null;
                if (group && group.parentElement === efsRow) {
                    const efsVehicleIdGroup = group;
                    if (efsVehicleIdGroup && efsVehicleIdGroup.style.display !== 'none') {
                        field.required = true;
                        field.disabled = false;
                        field.setAttribute('required', 'required');
                    }
                    break;
                }
            }
        }
    } else {
        // For other cases, handle normally
    const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
    const vehicleDetailsRowEl = document.getElementById('vehicleDetailsRow') as HTMLElement;
    
    if (vehicleIdField) {
        const vehicleIdGroup = vehicleIdField.closest('.form-group') as HTMLElement;
        const rowVisible = !vehicleDetailsRowEl || vehicleDetailsRowEl.style.display !== 'none';
        if (vehicleIdGroup && vehicleIdGroup.style.display !== 'none' && rowVisible) {
            vehicleIdField.required = true;
            vehicleIdField.disabled = false;
            vehicleIdField.setAttribute('required', 'required');
        } else {
            vehicleIdField.required = false;
            vehicleIdField.removeAttribute('required');
        }
    }
    }
    
    const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
    const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
    const vehicleDetailsRowEl = document.getElementById('vehicleDetailsRow') as HTMLElement;
    
    if (dlNumberField) {
        const dlNumberGroup = dlNumberField.closest('.form-group') as HTMLElement;
        const rowVisible = !vehicleDetailsRowEl || vehicleDetailsRowEl.style.display !== 'none';
        if (dlNumberGroup && dlNumberGroup.style.display !== 'none' && rowVisible) {
            dlNumberField.required = true;
            dlNumberField.disabled = false;
            dlNumberField.setAttribute('required', 'required');
        } else {
            dlNumberField.required = false;
            dlNumberField.removeAttribute('required');
        }
    }
    if (companyNameField) {
        const companyNameGroup = companyNameField.closest('.form-group') as HTMLElement;
        const cardDetailsRow = document.getElementById('cardDetailsRow') as HTMLElement;
        const isHidden = (companyNameGroup && companyNameGroup.style.display === 'none') || (cardDetailsRow && cardDetailsRow.style.display === 'none');
        if (!isHidden) {
            companyNameField.required = true;
            companyNameField.disabled = false;
            companyNameField.setAttribute('required', 'required');
        } else {
            companyNameField.required = false;
            companyNameField.removeAttribute('required');
        }
    }
}

// Helper function to check if selected company is USA
function isUSACompany(): boolean {
    const companySelect = document.getElementById('designId') as HTMLSelectElement;
    const selectedCompanyId = companySelect?.value ? parseInt(companySelect.value) : null;
    const selectedCompany = selectedCompanyId ? companies.find(c => c.id === selectedCompanyId) : null;
    return selectedCompany ? selectedCompany.country === 'United States of America' : false;
}

function toggleCardFields(): void {
    const paymentMethodSelect = document.getElementById('paymentMethod') as HTMLSelectElement;
    const cardDetailsRow = document.getElementById('cardDetailsRow');
    const vehicleDetailsRow = document.getElementById('vehicleDetailsRow');
    const cardLast4Input = document.getElementById('cardLast4') as HTMLInputElement;
    
    if (!paymentMethodSelect || !cardDetailsRow) return;
    
    const paymentMethod = paymentMethodSelect.value;
    const isUSA = isUSACompany();
    
    // Show card fields if payment method is NOT Cash and NOT EFS
    if (paymentMethod !== 'Cash' && paymentMethod !== 'EFS') {
        cardDetailsRow.style.display = 'grid';
        // Make fields required when shown
        if (cardLast4Input) {
            cardLast4Input.required = true;
        }
        // Show card-related fields
        const cardLast4Group = cardLast4Input?.closest('.form-group') as HTMLElement | null;
        const cardEntryMethodField = document.getElementById('cardEntryMethod') as HTMLSelectElement | null;
        const cardEntryGroup = cardEntryMethodField?.closest('.form-group') as HTMLElement | null;
        if (cardLast4Group) cardLast4Group.style.display = 'block';
        if (cardEntryGroup) cardEntryGroup.style.display = 'block';
    } else {
        cardDetailsRow.style.display = 'none';
        // Make fields optional when hidden
        if (cardLast4Input) {
            cardLast4Input.required = false;
            cardLast4Input.value = ''; // Clear the value
        }
        // For USA companies, keep company name visible even when card details are hidden
        // For non-USA companies, hide company name when card details are hidden
        if (!isUSA) {
        const companyNameInput = document.getElementById('driverCompanyName') as HTMLInputElement | null;
        const companyNameGroup = document.getElementById('companyNameGroup') as HTMLElement | null;
        if (companyNameInput) {
            companyNameInput.required = false;
            companyNameInput.removeAttribute('required');
            companyNameInput.disabled = false; // keep enabled to avoid not focusable
        }
        if (companyNameGroup) companyNameGroup.style.display = 'none';
        }
    }
    
    // For USA companies, ensure company name is always visible (even if cardDetailsRow is hidden)
    if (isUSA) {
        const companyNameGroupUSA = document.getElementById('companyNameGroup') as HTMLElement | null;
        const companyNameFieldUSA = document.getElementById('driverCompanyName') as HTMLInputElement | null;
        if (companyNameGroupUSA) {
            companyNameGroupUSA.style.display = 'block';
        }
        if (companyNameFieldUSA) {
            companyNameFieldUSA.disabled = false;
            companyNameFieldUSA.required = true;
            companyNameFieldUSA.setAttribute('required', 'required');
        }
    }
    
    // Get selected company to check if it's One9 or Love's
    const companySelect = document.getElementById('designId') as HTMLSelectElement;
    const selectedCompanyId = companySelect?.value ? parseInt(companySelect.value) : null;
    const selectedCompany = selectedCompanyId ? companies.find(c => c.id === selectedCompanyId) : null;
    const isOne9Company = selectedCompany && (selectedCompany.name.toLowerCase().includes('one 9') || selectedCompany.name.toLowerCase().includes('one9'));
    const isLovesCompany = selectedCompany && (selectedCompany.name.toLowerCase().includes('love') || selectedCompany.name.toLowerCase().includes("love's"));
    const isFlyingJCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('flying j');
    const isTravelCentersCompany = selectedCompany && (selectedCompany.name.toLowerCase().includes('travelcenters') || selectedCompany.name.toLowerCase().includes('travel centers'));
    const isPilotCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('pilot');
    const isHuskyCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('husky');
    const isPetroCanadaCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('petro-canada');
    const isBVDPetroleumCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('bvd petroleum');
    const isAnyCanadaCompany = selectedCompany && selectedCompany.country === 'Canada';
    
    // Toggle vehicle details based on payment method and company
    if (vehicleDetailsRow) {
        // Reorder Company Name and Card Entry Method for USA Flying J + Visa
        const companyNameGroup = document.getElementById('companyNameGroup') as HTMLElement | null;
        const cardEntryMethodFieldDOM = document.getElementById('cardEntryMethod') as HTMLSelectElement | null;
        const cardEntryGroup = cardEntryMethodFieldDOM?.closest('.form-group') as HTMLElement | null;
        // Only attempt reordering if both groups are children of cardDetailsRow
        const companyNameInCardRow = companyNameGroup && companyNameGroup.parentElement === cardDetailsRow;
        const cardEntryInCardRow = cardEntryGroup && cardEntryGroup.parentElement === cardDetailsRow;
        if (companyNameInCardRow && cardEntryInCardRow) {
            if (selectedCompany && selectedCompany.name.toLowerCase().includes('flying j') && getCurrentCountry() === 'United States of America' && paymentMethod === 'Visa') {
                if (companyNameGroup && cardEntryGroup) {
                    companyNameGroup.style.display = 'block';
                    cardDetailsRow.insertBefore(companyNameGroup, cardEntryGroup);
                }
            } else {
                if (companyNameGroup && cardEntryGroup) {
                    cardDetailsRow.insertBefore(cardEntryGroup, companyNameGroup);
                }
            }
        }
        // Show card entry method for Canadian companies
        if (isAnyCanadaCompany) {
            const cardEntryMethodField = document.getElementById('cardEntryMethod') as HTMLSelectElement;
            if (cardEntryMethodField) {
                cardEntryMethodField.disabled = false;
                cardEntryMethodField.setAttribute('required', 'required');
                const cardEntryMethodGroup = cardEntryMethodField.closest('.form-group') as HTMLElement;
                if (cardEntryMethodGroup) cardEntryMethodGroup.style.display = 'block';
            }
        }
        // Husky + Interac → hide vehicle/company fields (but not for USA companies)
        if (isHuskyCompany && paymentMethod === 'Interac' && !isUSA) {
            console.log('Hiding vehicle details for Husky + Interac');
            vehicleDetailsRow.style.display = 'none';
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (vehicleIdField) { vehicleIdField.required = false; vehicleIdField.value=''; vehicleIdField.disabled = true; vehicleIdField.removeAttribute('required'); }
            if (dlNumberField) { dlNumberField.required = false; dlNumberField.value=''; dlNumberField.disabled = true; dlNumberField.removeAttribute('required'); }
            if (companyNameField) { companyNameField.required = false; companyNameField.value=''; companyNameField.disabled = true; companyNameField.removeAttribute('required'); }
            const vidGroup = vehicleIdField?.closest('.form-group') as HTMLElement | null;
            const dlGroup = dlNumberField?.closest('.form-group') as HTMLElement | null;
            const companyNameGroup = document.getElementById('companyNameGroup') as HTMLElement | null;
            if (vidGroup) vidGroup.style.display = 'none';
            if (dlGroup) dlGroup.style.display = 'none';
            if (companyNameGroup) companyNameGroup.style.display = 'none';
            return;
        }
        // Show Vehicle ID and Company Name for Canadian Flying J + Visa
        if (selectedCompany && selectedCompany.name.toLowerCase().includes('flying j') && getCurrentCountry() === 'Canada' && paymentMethod === 'Visa') {
            console.log('Showing Vehicle ID and Company Name for Canadian Flying J + Visa');
            vehicleDetailsRow.style.display = 'grid';
            const efsDetailsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement | null;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement | null;
            const companyNameGroup = document.getElementById('companyNameGroup') as HTMLElement | null;
            
            // Hide efsDetailsRow (we'll move Company Name to vehicleDetailsRow)
            if (efsDetailsRow) {
                efsDetailsRow.style.display = 'none';
            }
            
            // Hide other EFS fields (Check Number, Driver Names, Vehicle ID in efsDetailsRow, etc.)
            const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
            const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
            const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
            const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
            
            const hideField = (field: HTMLInputElement | null) => {
                if (field) {
                    const fieldGroup = field.closest('.form-group') as HTMLElement | null;
                    if (fieldGroup) fieldGroup.style.display = 'none';
                    field.required = false;
                    field.removeAttribute('required');
                }
            };
            
            hideField(checkNumberField);
            hideField(checkNumberConfirmField);
            hideField(driverFirstNameField);
            hideField(driverLastNameField);
            
            // Show Vehicle ID in vehicleDetailsRow
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            if (vehicleIdField) {
                vehicleIdField.disabled = false;
                vehicleIdField.required = true;
                vehicleIdField.setAttribute('required', 'required');
            }
            
            // Hide DL Number
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            if (dlNumberField) {
                dlNumberField.required = false;
                dlNumberField.removeAttribute('required');
            }
            
            // Move Company Name to vehicleDetailsRow so it appears in the same row as Vehicle ID
            if (companyNameGroup && vehicleDetailsRow) {
                const currentParent = companyNameGroup.parentElement;
                // Only move if it's not already in vehicleDetailsRow
                if (currentParent !== vehicleDetailsRow) {
                    companyNameGroup.style.display = 'block';
                    vehicleDetailsRow.appendChild(companyNameGroup);
                } else {
                    companyNameGroup.style.display = 'block';
                }
                
                if (companyNameField) {
                    companyNameField.disabled = false;
                    companyNameField.required = true;
                    companyNameField.setAttribute('required', 'required');
                }
            }
            return;
        }
        // Show Vehicle ID and Company Name for Canadian Flying J + Master
        if (selectedCompany && selectedCompany.name.toLowerCase().includes('flying j') && getCurrentCountry() === 'Canada' && paymentMethod === 'Master') {
            console.log('Showing Vehicle ID and Company Name for Canadian Flying J + Master');
            vehicleDetailsRow.style.display = 'grid';
            const efsDetailsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement | null;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement | null;
            const companyNameGroup = document.getElementById('companyNameGroup') as HTMLElement | null;
            
            // Hide efsDetailsRow (we'll move Company Name to vehicleDetailsRow)
            if (efsDetailsRow) {
                efsDetailsRow.style.display = 'none';
            }
            
            // Show Vehicle ID in vehicleDetailsRow
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            if (vehicleIdField) {
                vehicleIdField.disabled = false;
                vehicleIdField.required = true;
                vehicleIdField.setAttribute('required', 'required');
            }
            
            // Hide DL Number
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            if (dlNumberField) {
                dlNumberField.required = false;
                dlNumberField.removeAttribute('required');
            }
            
            // Move Company Name to vehicleDetailsRow so it appears in the same row as Vehicle ID
            if (companyNameGroup && vehicleDetailsRow) {
                const currentParent = companyNameGroup.parentElement;
                // Only move if it's not already in vehicleDetailsRow
                if (currentParent !== vehicleDetailsRow) {
                    companyNameGroup.style.display = 'block';
                    vehicleDetailsRow.appendChild(companyNameGroup);
                } else {
                    companyNameGroup.style.display = 'block';
                }
                
                if (companyNameField) {
                    companyNameField.disabled = false;
                    companyNameField.required = true;
                    companyNameField.setAttribute('required', 'required');
                }
            }
            return;
        }
        // Show Vehicle ID and Company Name for One9 + Master
        if (isOne9Company && paymentMethod === 'Master') {
            console.log('Showing vehicle details for One9 + Master');
            // Remove required attribute from Vehicle ID field in vehicleDetailsRow before hiding it
            const vehicleDetailsRowVehicleId = vehicleDetailsRow?.querySelector('#vehicleId') as HTMLInputElement | null;
            if (vehicleDetailsRowVehicleId) {
                vehicleDetailsRowVehicleId.required = false;
                vehicleDetailsRowVehicleId.removeAttribute('required');
            }
            // Hide vehicleDetailsRow completely to avoid showing Vehicle ID from there
            vehicleDetailsRow.style.display = 'none';
            // Show efsDetailsRow to make companyNameGroup and Vehicle ID (already in efsDetailsRow) visible
            const efsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            if (efsRow) efsRow.style.display = 'grid';
            
            // Get Vehicle ID field from efsDetailsRow (there are two Vehicle ID fields in HTML, we want the one in efsDetailsRow)
            const allVehicleIdFields = document.querySelectorAll('#vehicleId');
            let vehicleIdField: HTMLInputElement | null = null;
            let vehicleIdGroup: HTMLElement | null = null;
            
            // Find the Vehicle ID field that's in efsDetailsRow
            allVehicleIdFields.forEach((field) => {
                const group = field.closest('.form-group') as HTMLElement | null;
                if (group && efsRow && group.parentElement === efsRow) {
                    vehicleIdField = field as HTMLInputElement;
                    vehicleIdGroup = group;
                }
            });
            
            // Fallback: get first Vehicle ID if we couldn't find the one in efsDetailsRow
            if (!vehicleIdField && allVehicleIdFields.length > 0) {
                vehicleIdField = allVehicleIdFields[0] as HTMLInputElement;
                vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement | null;
            }
            
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            const companyNameGroup = document.getElementById('companyNameGroup') as HTMLElement | null;
            
            // Ensure companyNameGroup is in efsDetailsRow (move it if needed)
            if (companyNameGroup && efsRow) {
                // Move companyNameGroup into efsDetailsRow if not already there
                if (companyNameGroup.parentElement !== efsRow) {
                    // If companyNameGroup is in cardDetailsRow, move it to efsDetailsRow
                    const cardDetailsRow = document.getElementById('cardDetailsRow') as HTMLElement | null;
                    if (cardDetailsRow && companyNameGroup.parentElement === cardDetailsRow) {
                        cardDetailsRow.removeChild(companyNameGroup);
                    }
                    // Insert companyNameGroup after Vehicle ID and before signature checkbox
                    const signatureCheckboxGroup = document.getElementById('signatureCheckboxGroup') as HTMLElement | null;
                    if (vehicleIdGroup && vehicleIdGroup.parentElement === efsRow) {
                        // Insert after Vehicle ID
                        if (vehicleIdGroup.nextSibling) {
                            efsRow.insertBefore(companyNameGroup, vehicleIdGroup.nextSibling);
                        } else {
                            efsRow.appendChild(companyNameGroup);
                        }
                    } else if (signatureCheckboxGroup && signatureCheckboxGroup.parentElement === efsRow) {
                        // Insert before signature checkbox
                        efsRow.insertBefore(companyNameGroup, signatureCheckboxGroup);
                    } else {
                        // Just append to efsRow
                        efsRow.appendChild(companyNameGroup);
                    }
                } else {
                    // Already in efsRow, ensure correct order: Vehicle ID -> Company Name -> Signature
                    const signatureCheckboxGroup = document.getElementById('signatureCheckboxGroup') as HTMLElement | null;
                    if (vehicleIdGroup && vehicleIdGroup.parentElement === efsRow) {
                        // Ensure companyNameGroup comes after vehicleIdGroup
                        if (companyNameGroup.previousSibling !== vehicleIdGroup && 
                            vehicleIdGroup.nextSibling !== companyNameGroup) {
                            // Move companyNameGroup to be right after vehicleIdGroup
                            if (vehicleIdGroup.nextSibling) {
                                efsRow.insertBefore(companyNameGroup, vehicleIdGroup.nextSibling);
                            } else {
                                efsRow.appendChild(companyNameGroup);
                            }
                        }
                    }
                    // Ensure signature checkbox comes after companyNameGroup
                    if (signatureCheckboxGroup && signatureCheckboxGroup.parentElement === efsRow) {
                        // Check if signatureCheckboxGroup is before companyNameGroup
                        let signatureBeforeCompany = false;
                        let current = signatureCheckboxGroup.nextSibling;
                        while (current) {
                            if (current === companyNameGroup) {
                                signatureBeforeCompany = true;
                                break;
                            }
                            current = current.nextSibling;
                        }
                        // If signatureCheckboxGroup is before companyNameGroup, move it after
                        if (signatureBeforeCompany) {
                            if (companyNameGroup.nextSibling) {
                                efsRow.insertBefore(signatureCheckboxGroup, companyNameGroup.nextSibling);
                            } else {
                                efsRow.appendChild(signatureCheckboxGroup);
                            }
                        }
                    }
                }
            }
            
            // Show Vehicle ID field in efsDetailsRow
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            if (vehicleIdField) { 
                vehicleIdField.disabled = false; 
                vehicleIdField.required = true; 
                vehicleIdField.setAttribute('required', 'required'); 
            }
            
            // Show Company Name field
            if (companyNameGroup) {
                companyNameGroup.style.display = 'block';
            }
            if (companyNameField) { 
                companyNameField.disabled = false; 
                companyNameField.required = true; 
                companyNameField.setAttribute('required', 'required'); 
            }
            
            // Hide DL Number field for One9 + Master
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement | null;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            if (dlNumberField) { 
                dlNumberField.required = false; 
                dlNumberField.removeAttribute('required'); 
            }
            
            // Hide EFS-only fields within the row
            const hideFieldGroup = (input: HTMLInputElement | null) => {
                if (!input) return;
                input.required = false;
                const g = input.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'none';
            };
            hideFieldGroup(document.getElementById('checkNumber') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('checkNumberConfirm') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('driverFirstName') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('driverLastName') as HTMLInputElement | null);
            
            // Show signature checkbox for One9 + Master
            const signatureCheckboxGroup = document.getElementById('signatureCheckboxGroup') as HTMLElement | null;
            if (signatureCheckboxGroup) {
                signatureCheckboxGroup.style.display = 'flex';
                // Ensure signature checkbox is in efsDetailsRow
                if (signatureCheckboxGroup.parentElement !== efsRow && efsRow) {
                    efsRow.appendChild(signatureCheckboxGroup);
                }
            }
            
            // Final enforcement: Ensure correct order and visibility for One9 + Master
            // Order should be: Vehicle ID -> Company Name -> Signature Checkbox (all in one row)
            if (efsRow && vehicleIdGroup && companyNameGroup && signatureCheckboxGroup) {
                // Ensure all are in efsDetailsRow
                if (vehicleIdGroup.parentElement !== efsRow) efsRow.appendChild(vehicleIdGroup);
                if (companyNameGroup.parentElement !== efsRow) efsRow.appendChild(companyNameGroup);
                if (signatureCheckboxGroup.parentElement !== efsRow) efsRow.appendChild(signatureCheckboxGroup);
                
                // Ensure correct order: Vehicle ID -> Company Name -> Signature
                const allChildren = Array.from(efsRow.children) as HTMLElement[];
                const vehicleIdIndex = allChildren.indexOf(vehicleIdGroup);
                const companyNameIndex = allChildren.indexOf(companyNameGroup);
                const signatureIndex = allChildren.indexOf(signatureCheckboxGroup);
                
                // Reorder if needed
                if (vehicleIdIndex >= 0 && companyNameIndex >= 0 && signatureIndex >= 0) {
                    if (vehicleIdIndex > companyNameIndex || companyNameIndex > signatureIndex) {
                        // Remove all from current positions (only if they're still children)
                        if (vehicleIdGroup.parentElement === efsRow) efsRow.removeChild(vehicleIdGroup);
                        if (companyNameGroup.parentElement === efsRow) efsRow.removeChild(companyNameGroup);
                        if (signatureCheckboxGroup.parentElement === efsRow) efsRow.removeChild(signatureCheckboxGroup);
                        
                        // Re-add in correct order
                        efsRow.appendChild(vehicleIdGroup);
                        efsRow.appendChild(companyNameGroup);
                        efsRow.appendChild(signatureCheckboxGroup);
                    }
                }
                
                // Final visibility check
                vehicleIdGroup.style.display = 'block';
                companyNameGroup.style.display = 'block';
                signatureCheckboxGroup.style.display = 'flex';
            }
            
            return;
        }

        if (isPetroCanadaCompany && !isUSA) {
            // Hide all vehicle details for Petro-Canada + any payment method (but not for USA companies)
            console.log('Hiding vehicle details for Petro-Canada + any payment method');
            vehicleDetailsRow.style.display = 'none';
            // Remove required attributes when hidden, clear values, and disable fields
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            const cardEntryMethodField = document.getElementById('cardEntryMethod') as HTMLSelectElement;
            if (vehicleIdField) {
                vehicleIdField.required = false;
                vehicleIdField.value = '';
                vehicleIdField.disabled = true;
                vehicleIdField.removeAttribute('required');
            }
            if (dlNumberField) {
                dlNumberField.required = false;
                dlNumberField.value = '';
                dlNumberField.disabled = true;
                dlNumberField.removeAttribute('required');
            }
            if (companyNameField) {
                companyNameField.required = false;
                companyNameField.value = '';
                companyNameField.disabled = true;
                companyNameField.removeAttribute('required');
            }
            if (cardEntryMethodField) {
                // Show card entry method for Canadian companies
                cardEntryMethodField.disabled = false;
                cardEntryMethodField.setAttribute('required', 'required');
                const cardEntryMethodGroup = cardEntryMethodField.closest('.form-group') as HTMLElement;
                if (cardEntryMethodGroup) cardEntryMethodGroup.style.display = 'block';
            }
        } else if (isBVDPetroleumCompany && !isUSA) {
            // Hide all vehicle details for BVD Petroleum + any payment method (but not for USA companies)
            console.log('Hiding vehicle details for BVD Petroleum + any payment method');
            vehicleDetailsRow.style.display = 'none';
            // Remove required attributes when hidden, clear values, and disable fields
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            const cardEntryMethodField = document.getElementById('cardEntryMethod') as HTMLSelectElement;
            if (vehicleIdField) {
                vehicleIdField.required = false;
                vehicleIdField.value = '';
                vehicleIdField.disabled = true;
                vehicleIdField.removeAttribute('required');
            }
            if (dlNumberField) {
                dlNumberField.required = false;
                dlNumberField.value = '';
                dlNumberField.disabled = true;
                dlNumberField.removeAttribute('required');
            }
            if (companyNameField) {
                companyNameField.required = false;
                companyNameField.value = '';
                companyNameField.disabled = true;
                companyNameField.removeAttribute('required');
            }
            if (cardEntryMethodField) {
                // Show card entry method for Canadian companies
                cardEntryMethodField.disabled = false;
                cardEntryMethodField.setAttribute('required', 'required');
                const cardEntryMethodGroup = cardEntryMethodField.closest('.form-group') as HTMLElement;
                if (cardEntryMethodGroup) cardEntryMethodGroup.style.display = 'block';
            }
        } else if (paymentMethod === 'TCH' && isOne9Company) {
            // Show Vehicle ID and DL Number for TCH payment with One9 company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for One9 + TCH combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            
            // Hide Vehicle ID field for One9 + TCH combination (but not for USA companies)
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement;
            if (vehicleIdGroup && !isUSA) vehicleIdGroup.style.display = 'none';
            // Remove required attribute when hidden
            if (vehicleIdField && !isUSA) vehicleIdField.required = false;
        } else if (isHuskyCompany && (paymentMethod === 'Visa' || paymentMethod === 'Master' || paymentMethod === 'Mastercard' || paymentMethod === 'Interac' || paymentMethod === 'American Express' || paymentMethod === 'EFS' || paymentMethod === 'TCH') && !isUSA) {
            // Hide all vehicle details for Husky + card methods (Visa/Master/Interac/EFS/TCH) (but not for USA companies)
            console.log('Hiding vehicle details for Husky + selected payment method');
            vehicleDetailsRow.style.display = 'none';
            // Remove required attributes when hidden, clear values, and disable fields
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (vehicleIdField) {
                vehicleIdField.required = false;
                vehicleIdField.value = '';
                vehicleIdField.disabled = true;
                vehicleIdField.removeAttribute('required');
            }
            if (dlNumberField) {
                dlNumberField.required = false;
                dlNumberField.value = '';
                dlNumberField.disabled = true;
                dlNumberField.removeAttribute('required');
            }
            if (companyNameField) {
                companyNameField.required = false;
                companyNameField.value = '';
                companyNameField.disabled = true;
                companyNameField.removeAttribute('required');
            }
            
            // Also ensure the company name group is hidden
            const companyNameGroup = document.getElementById('companyNameGroup');
            if (companyNameGroup) {
                companyNameGroup.style.display = 'none';
            }
        } else if (paymentMethod === 'TCH' && selectedCompany && selectedCompany.country === 'Canada' && selectedCompany.name.toLowerCase().includes('flying j')) {
            // Show vehicle details row for Canadian Flying J with TCH, but only show company name
            vehicleDetailsRow.style.display = 'grid';
            // Hide Vehicle ID and DL Number fields for Canadian Flying J + TCH combination
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'none';
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            // Remove required attribute when hidden
            if (vehicleIdField) vehicleIdField.required = false;
            if (dlNumberField) dlNumberField.required = false;
        } else if (paymentMethod === 'TCH' && selectedCompany && selectedCompany.country === 'United States of America' && selectedCompany.name.toLowerCase().includes('flying j')) {
            // Show vehicle details row for USA Flying J with TCH - show company name and vehicle ID
            vehicleDetailsRow.style.display = 'grid';
            // Show Vehicle ID for USA companies
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            // Keep Vehicle ID visible for USA companies
            if (vehicleIdGroup && isUSA) vehicleIdGroup.style.display = 'block';
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            // Keep Vehicle ID required for USA companies
            if (vehicleIdField && isUSA) {
                vehicleIdField.required = true;
                vehicleIdField.setAttribute('required', 'required');
            }
            if (dlNumberField) dlNumberField.required = false;
        } else if (paymentMethod === 'TCH' && !isUSA) {
            // Hide Vehicle ID and DL Number for TCH payment with other companies (but not USA)
            vehicleDetailsRow.style.display = 'none';
            // Remove required attribute when hidden
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            if (vehicleIdField) vehicleIdField.required = false;
            if (dlNumberField) dlNumberField.required = false;
        } else if (paymentMethod === 'Cash' && isOne9Company) {
            // Show Vehicle ID and DL Number for Cash payment with One9 company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for One9 + Cash combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            
            // Make Vehicle ID required when visible
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            if (vehicleIdField) {
                vehicleIdField.required = true;
                // Make sure the field is visible
                const vehicleIdGroup = vehicleIdField.closest('.form-group') as HTMLElement;
                if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            }
        } else if (paymentMethod === 'Cash' && isLovesCompany) {
            // Show Vehicle ID for Cash payment with Love's company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for Love's + Cash combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            
            // Make Vehicle ID required when visible
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            if (vehicleIdField) {
                vehicleIdField.required = true;
                // Make sure the field is visible
                const vehicleIdGroup = vehicleIdField.closest('.form-group') as HTMLElement;
                if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            }
        } else if (paymentMethod === 'Cash' && isFlyingJCompany) {
            // Show Vehicle ID for Cash payment with Flying J company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for Flying J + Cash combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            
            // Make Vehicle ID required when visible
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            if (vehicleIdField) {
                vehicleIdField.required = true;
                // Make sure the field is visible
                const vehicleIdGroup = vehicleIdField.closest('.form-group') as HTMLElement;
                if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            }
        } else if (paymentMethod === 'Cash' && isTravelCentersCompany) {
            // Show Vehicle ID for Cash payment with TravelCenters company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for TravelCenters + Cash combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            
            // Make Vehicle ID required when visible
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            if (vehicleIdField) {
                vehicleIdField.required = true;
                // Make sure the field is visible
                const vehicleIdGroup = vehicleIdField.closest('.form-group') as HTMLElement;
                if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            }
        } else if (paymentMethod === 'EFS' && isFlyingJCompany) {
            // Show Vehicle ID for EFS payment with Flying J company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for Flying J + EFS combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            
            // Make Vehicle ID required when visible
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            if (vehicleIdField) {
                vehicleIdField.required = true;
                // Make sure the field is visible
                const vehicleIdGroup = vehicleIdField.closest('.form-group') as HTMLElement;
                if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            }
        } else if (paymentMethod === 'EFS' && isPilotCompany && !isUSA) {
            // Show only Vehicle ID for Pilot + EFS combination (non-USA)
            vehicleDetailsRow.style.display = 'grid';
            
            // Hide EFS Details row for Pilot + EFS combination (non-USA)
            const efsDetailsRow = document.getElementById('efsDetailsRow');
            if (efsDetailsRow) efsDetailsRow.style.display = 'none';
            
            // Hide DL Number field for Pilot + EFS combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            // Remove required attribute when hidden
            if (dlNumberField) dlNumberField.required = false;
            
            // Show Vehicle ID field for Pilot + EFS combination
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement;
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            if (vehicleIdField) vehicleIdField.required = true;
        } else if (paymentMethod === 'EFS' && isTravelCentersCompany) {
            // Show EFS Details for TravelCenters company (but not for USA Flying J)
            const isUSAFlyingJ = selectedCompany && selectedCompany.country === 'United States of America' && selectedCompany.name.toLowerCase().includes('flying j');
            
            if (!isUSAFlyingJ) {
            const efsDetailsRow = document.getElementById('efsDetailsRow');
            if (efsDetailsRow) efsDetailsRow.style.display = 'grid';
            
            // Hide vehicle details row
            vehicleDetailsRow.style.display = 'none';
            
            // Hide DL Number and Vehicle ID fields for TravelCenters + EFS combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            // Remove required attribute when hidden
            if (dlNumberField) dlNumberField.required = false;
            
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement;
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'none';
            // Remove required attribute when hidden
            if (vehicleIdField) vehicleIdField.required = false;
            
            // Show and make required all EFS fields
            const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement;
            const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement;
            const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement;
            const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement;
            
            if (checkNumberField) {
                checkNumberField.required = true;
                const checkNumberGroup = checkNumberField.closest('.form-group') as HTMLElement;
                if (checkNumberGroup) checkNumberGroup.style.display = 'block';
            }
            
            if (checkNumberConfirmField) {
                checkNumberConfirmField.required = true;
                const checkNumberConfirmGroup = checkNumberConfirmField.closest('.form-group') as HTMLElement;
                if (checkNumberConfirmGroup) checkNumberConfirmGroup.style.display = 'block';
            }
            
            if (driverFirstNameField) {
                driverFirstNameField.required = true;
                const driverFirstNameGroup = driverFirstNameField.closest('.form-group') as HTMLElement;
                if (driverFirstNameGroup) driverFirstNameGroup.style.display = 'block';
            }
            
            if (driverLastNameField) {
                driverLastNameField.required = true;
                const driverLastNameGroup = driverLastNameField.closest('.form-group') as HTMLElement;
                if (driverLastNameGroup) driverLastNameGroup.style.display = 'block';
                }
            }
        } else if (paymentMethod === 'TCH' && isTravelCentersCompany) {
            // Show Vehicle ID for TCH payment with TravelCenters company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for TravelCenters + TCH combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            // Remove required attribute when hidden
            if (dlNumberField) dlNumberField.required = false;
            
            // Make Vehicle ID required when visible
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            if (vehicleIdField) {
                vehicleIdField.required = true;
                // Make sure the field is visible
                const vehicleIdGroup = vehicleIdField.closest('.form-group') as HTMLElement;
                if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            }
        } else if (paymentMethod === 'Cash' && !isUSA) {
            // Hide Vehicle ID and DL Number for Cash payment with other companies (but not USA)
            // For USA companies, always show vehicle details row
            if (!isUSA) {
            vehicleDetailsRow.style.display = 'none';
            } else {
                vehicleDetailsRow.style.display = 'grid';
            }
            // Remove required attribute when hidden
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            if (vehicleIdField && !isUSA) vehicleIdField.required = false;
            if (dlNumberField) dlNumberField.required = false;
        } else if (paymentMethod === 'EFS' && isOne9Company) {
            // Show Vehicle ID for EFS payment with One9 company
            // Hide Check Number, Check Number Confirm, Driver First Name, Driver Last Name
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for One9 + EFS combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            
            // Hide EFS-only fields (check numbers and driver names)
            const efsDetailsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            if (efsDetailsRow) efsDetailsRow.style.display = 'grid';
            
            const hideFieldGroup = (input: HTMLInputElement | null) => {
                if (!input) return;
                input.required = false;
                const g = input.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'none';
            };
            
            hideFieldGroup(document.getElementById('checkNumber') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('checkNumberConfirm') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('driverFirstName') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('driverLastName') as HTMLInputElement | null);
            
            // Make Vehicle ID required when visible
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            if (vehicleIdField) {
                vehicleIdField.required = true;
                // Make sure the field is visible
                const vehicleIdGroup = vehicleIdField.closest('.form-group') as HTMLElement;
                if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            }
        } else if (paymentMethod === 'EFS' && isLovesCompany) {
            // For Love's + EFS: Show Company Name, Signature checkbox, Copy Type, Check Number, Driver First Name, and Driver Last Name
            // Hide vehicle specific fields and check number confirm
            vehicleDetailsRow.style.display = 'none';
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            if (vehicleIdField) vehicleIdField.required = false;
            if (dlNumberField) dlNumberField.required = false;

            // Ensure EFS details row is visible
            const efsDetailsRow = document.getElementById('efsDetailsRow');
            if (efsDetailsRow) efsDetailsRow.style.display = 'grid';
            
            // Show check number field (required for Love's EFS)
            const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement;
            if (checkNumberField) {
                checkNumberField.required = true;
                const g = checkNumberField.closest('.form-group') as HTMLElement;
                if (g) g.style.display = 'block';
            }
            
            // Hide check number confirm field
            const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement;
            if (checkNumberConfirmField) {
                checkNumberConfirmField.required = false;
                const g = checkNumberConfirmField.closest('.form-group') as HTMLElement;
                if (g) g.style.display = 'none';
            }
            
            // Show driver first and last name fields (required for Love's EFS)
            const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement;
            const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement;
            if (driverFirstNameField) {
                driverFirstNameField.required = true;
                const g = driverFirstNameField.closest('.form-group') as HTMLElement;
                if (g) g.style.display = 'block';
            }
            if (driverLastNameField) {
                driverLastNameField.required = true;
                const g = driverLastNameField.closest('.form-group') as HTMLElement;
                if (g) g.style.display = 'block';
            }
            
            // Hide Vehicle ID field in efsDetailsRow
            const vehicleIdInEfsRow = efsDetailsRow?.querySelector('#vehicleId') as HTMLInputElement | null;
            if (vehicleIdInEfsRow) {
                const vehicleIdGroupInEfs = vehicleIdInEfsRow.closest('.form-group') as HTMLElement | null;
                if (vehicleIdGroupInEfs) vehicleIdGroupInEfs.style.display = 'none';
            }

            // Show company name field (in efsDetailsRow)
            const companyNameGroup = document.getElementById('companyNameGroup') as HTMLElement;
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameGroup) companyNameGroup.style.display = 'block';
            if (companyNameField) { companyNameField.required = true; companyNameField.disabled = false; }
            
            // Get signature checkbox group (will be shown after copy type)
            const signatureCheckboxGroup = document.getElementById('signatureCheckboxGroup') as HTMLElement | null;
            
            // Move copy type group into efsDetailsRow for Love's + EFS (before signature checkbox)
            const copyTypeGroup = document.getElementById('copyTypeGroup') as HTMLElement | null;
            const copyTypeRow = document.getElementById('copyTypeRow') as HTMLElement | null;
            if (copyTypeGroup && efsDetailsRow) {
                // Move copy type group into efsDetailsRow if not already there
                if (copyTypeGroup.parentElement !== efsDetailsRow) {
                    // Insert copy type before signature checkbox if it exists, otherwise append
                    if (signatureCheckboxGroup && signatureCheckboxGroup.parentElement === efsDetailsRow) {
                        efsDetailsRow.insertBefore(copyTypeGroup, signatureCheckboxGroup);
                    } else {
                        efsDetailsRow.appendChild(copyTypeGroup);
                    }
                } else {
                    // If already in efsDetailsRow, ensure it's before signature checkbox
                    if (signatureCheckboxGroup && signatureCheckboxGroup.parentElement === efsDetailsRow && 
                        copyTypeGroup.nextSibling !== signatureCheckboxGroup) {
                        efsDetailsRow.insertBefore(copyTypeGroup, signatureCheckboxGroup);
                    }
                }
                copyTypeGroup.style.display = 'block';
            }
            
            // Show signature checkbox after copy type
            if (signatureCheckboxGroup) {
                signatureCheckboxGroup.style.display = 'flex';
            }
            
            // Hide the separate copyTypeRow since we're using it in efsDetailsRow
            if (copyTypeRow) copyTypeRow.style.display = 'none';
        } else if (paymentMethod === 'EFS' && !isUSA) {
            // Hide Vehicle ID and DL Number for EFS payment with other companies (but not USA)
            vehicleDetailsRow.style.display = 'none';
            // Remove required attribute when hidden
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            if (vehicleIdField) vehicleIdField.required = false;
            if (dlNumberField) dlNumberField.required = false;
        } else if (paymentMethod === 'Master' && isOne9Company) {
            // Show Vehicle ID and DL Number for Master payment with One9 company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for One9 + Master combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberLabel = document.querySelector('label[for="dlNumber"]') as HTMLLabelElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            
            // Make Vehicle ID required when visible
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            if (vehicleIdField) {
                vehicleIdField.required = true;
                // Make sure the field is visible
                const vehicleIdGroup = vehicleIdField.closest('.form-group') as HTMLElement;
                if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            }
        } else if (paymentMethod === 'Master' && isLovesCompany) {
            // Show Vehicle ID for Master payment with Love's company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for Love's + Master combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            
            // Show Vehicle ID field for Love's + Master combination
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement;
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            if (vehicleIdField) vehicleIdField.required = true;
        } else if (paymentMethod === 'Master' && isTravelCentersCompany) {
            // Vehicle ID is now in EFS Details row, so no need to show vehicleDetailsRow
            // The EFS Details row will be shown separately and includes Vehicle ID
            vehicleDetailsRow.style.display = 'none';
            // Hide DL Number field for TravelCenters + Master combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            // Remove required attribute when hidden
            if (dlNumberField) dlNumberField.required = false;
        } else if (paymentMethod === 'Master' && selectedCompany && selectedCompany.name.toLowerCase().includes('flying j') && getCurrentCountry() === 'United States of America') {
            // Show Vehicle ID for Master payment with USA Flying J company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for USA Flying J + Master combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            
            // Show Vehicle ID field for USA Flying J + Master combination
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement;
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            if (vehicleIdField) vehicleIdField.required = true;
        } else if (paymentMethod === 'Master' && isPilotCompany) {
            // Hide vehicleDetailsRow for Pilot + Master (Vehicle ID will be shown in efsDetailsRow)
            vehicleDetailsRow.style.display = 'none';
            // Remove required attribute from Vehicle ID in vehicleDetailsRow when hidden
            // Use querySelector to get the specific Vehicle ID field within vehicleDetailsRow
            const vehicleIdFieldInVehicleDetailsRow = vehicleDetailsRow.querySelector('#vehicleId') as HTMLInputElement | null;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            if (vehicleIdFieldInVehicleDetailsRow) {
                vehicleIdFieldInVehicleDetailsRow.required = false;
                vehicleIdFieldInVehicleDetailsRow.removeAttribute('required');
                // Also disable it to prevent validation
                vehicleIdFieldInVehicleDetailsRow.disabled = true;
            }
            if (dlNumberField) {
                dlNumberField.required = false;
                dlNumberField.removeAttribute('required');
            }
        } else if (paymentMethod === 'Master' && !isUSA) {
            // Hide Vehicle ID and DL Number for Master payment with other companies (but not USA, not Pilot)
            vehicleDetailsRow.style.display = 'none';
            // Remove required attribute when hidden
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            if (vehicleIdField) vehicleIdField.required = false;
            if (dlNumberField) dlNumberField.required = false;
        } else if (paymentMethod === 'Visa' && isLovesCompany) {
            // Show Vehicle ID for Visa payment with Love's company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for Love's + Visa combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            
            // Show Vehicle ID field for Love's + Visa combination
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement;
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            if (vehicleIdField) vehicleIdField.required = true;
        } else if (paymentMethod === 'Visa' && isPilotCompany) {
            // Show Vehicle ID for Pilot + Visa, hide DL
            vehicleDetailsRow.style.display = 'grid';
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            if (vehicleIdField) vehicleIdField.required = true;
            if (dlNumberField) dlNumberField.required = false;
        } else if (paymentMethod === 'Visa' && isTravelCentersCompany) {
            // Show Vehicle ID for Visa payment with TravelCenters company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for TravelCenters + Visa combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            // Remove required attribute when hidden
            if (dlNumberField) dlNumberField.required = false;
            
            // Show Vehicle ID field for TravelCenters + Visa combination
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement;
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            if (vehicleIdField) vehicleIdField.required = true;
        } else if (paymentMethod === 'Visa' && isOne9Company) {
            // Show Vehicle ID for Visa payment with One9 company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for One9 + Visa combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            // Remove required attribute when hidden
            if (dlNumberField) dlNumberField.required = false;
            
            // Show Vehicle ID field for One9 + Visa combination
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement;
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            if (vehicleIdField) vehicleIdField.required = true;
        } else {
            // Show Vehicle ID and DL Number for other payment methods
            vehicleDetailsRow.style.display = 'grid';
            // Show DL Number field for other combinations
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'block';
            
            // Make Vehicle ID and DL Number required when visible
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            if (vehicleIdField) {
                vehicleIdField.required = true;
                // Make sure the field is visible
                const vehicleIdGroup = vehicleIdField.closest('.form-group') as HTMLElement;
                if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            }
            if (dlNumberField) dlNumberField.required = true;
        }
        
        // Always ensure all vehicleId fields are properly handled (remove required from hidden ones)
        handleAllVehicleIdFields();
    }
    
    // Toggle company name field and signature checkbox based on payment method and company
    const companyNameGroup = document.getElementById('companyNameGroup');
    const signatureCheckboxGroup = document.getElementById('signatureCheckboxGroup');
    if (companyNameGroup && signatureCheckboxGroup) {
        if (paymentMethod === 'Cash' && isOne9Company) {
            // Show Company Name for Cash payment with One9 company
            companyNameGroup.style.display = 'block';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
        } else if (paymentMethod === 'Cash' && isLovesCompany) {
            // Show Company Name for Cash payment with Love's company
            // Ensure EFS row is visible to host the company name group
            const efsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            if (efsRow) efsRow.style.display = 'grid';
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'none';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) { companyNameField.required = true; companyNameField.disabled = false; }
            // Hide EFS-only fields within the row
            const hideGroup = (el: HTMLElement | null) => { if (el) el.style.display = 'none'; };
            const hideFieldGroup = (input: HTMLInputElement | null) => {
                if (!input) return;
                input.required = false;
                const g = input.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'none';
            };
            hideFieldGroup(document.getElementById('checkNumber') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('checkNumberConfirm') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('driverFirstName') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('driverLastName') as HTMLInputElement | null);
        } else if (paymentMethod === 'Cash' && isFlyingJCompany) {
            // Show Company Name for Cash payment with Flying J company
            companyNameGroup.style.display = 'block';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
        } else if (paymentMethod === 'Cash' && isTravelCentersCompany) {
            // Show Company Name for Cash payment with TravelCenters company
            companyNameGroup.style.display = 'block';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
        } else if (paymentMethod === 'Visa' && isOne9Company && !isUSA) {
            // ONE 9 + Visa: hide company name and ensure it's not required (but not for USA companies)
            companyNameGroup.style.display = 'none';
            signatureCheckboxGroup.style.display = 'none';
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) { companyNameField.required = false; companyNameField.removeAttribute('required'); }
        } else if (paymentMethod === 'Master' && isOne9Company) {
            // ONE 9 + Master: hide vehicleDetailsRow to avoid showing Vehicle ID from there
            // Remove required attribute from Vehicle ID field in vehicleDetailsRow before hiding it
            const vehicleDetailsRowVehicleId = vehicleDetailsRow?.querySelector('#vehicleId') as HTMLInputElement | null;
            if (vehicleDetailsRowVehicleId) {
                vehicleDetailsRowVehicleId.required = false;
                vehicleDetailsRowVehicleId.removeAttribute('required');
            }
            // Hide vehicleDetailsRow completely
            if (vehicleDetailsRow) vehicleDetailsRow.style.display = 'none';
            // Show efsDetailsRow to make companyNameGroup and Vehicle ID visible
            const efsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            if (efsRow) efsRow.style.display = 'grid';
            
            // Get Vehicle ID field from efsDetailsRow (there are two Vehicle ID fields in HTML, we want the one in efsDetailsRow)
            const allVehicleIdFields = document.querySelectorAll('#vehicleId');
            let vehicleIdField: HTMLInputElement | null = null;
            let vehicleIdGroup: HTMLElement | null = null;
            
            // Find the Vehicle ID field that's in efsDetailsRow
            allVehicleIdFields.forEach((field) => {
                const group = field.closest('.form-group') as HTMLElement | null;
                if (group && efsRow && group.parentElement === efsRow) {
                    vehicleIdField = field as HTMLInputElement;
                    vehicleIdGroup = group;
                }
            });
            
            // Fallback: get first Vehicle ID if we couldn't find the one in efsDetailsRow
            if (!vehicleIdField && allVehicleIdFields.length > 0) {
                vehicleIdField = allVehicleIdFields[0] as HTMLInputElement;
                vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement | null;
            }
            
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            const companyNameGroupForMaster = document.getElementById('companyNameGroup') as HTMLElement | null;
            
            // Show Vehicle ID field in efsDetailsRow
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            if (vehicleIdField) { 
                vehicleIdField.disabled = false; 
                vehicleIdField.required = true; 
                vehicleIdField.setAttribute('required', 'required'); 
            }
            
            // Show Company Name field
            if (companyNameGroupForMaster) companyNameGroupForMaster.style.display = 'block';
            if (companyNameField) { 
                companyNameField.disabled = false; 
                companyNameField.required = true; 
                companyNameField.setAttribute('required', 'required'); 
            }
            
            // Hide DL Number field for One9 + Master
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement | null;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            if (dlNumberField) { 
                dlNumberField.required = false; 
                dlNumberField.removeAttribute('required'); 
            }
            
            // Hide EFS-only fields within the row
            const hideFieldGroup = (input: HTMLInputElement | null) => {
                if (!input) return;
                input.required = false;
                const g = input.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'none';
            };
            hideFieldGroup(document.getElementById('checkNumber') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('checkNumberConfirm') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('driverFirstName') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('driverLastName') as HTMLInputElement | null);
            
            // Show signature checkbox for One9 + Master
            if (signatureCheckboxGroup) signatureCheckboxGroup.style.display = 'flex';
        } else if (paymentMethod === 'Visa' && isPilotCompany) {
            // Show Company Name for Visa payment with Pilot company
            const efsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            if (efsRow) efsRow.style.display = 'grid';
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'none';
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) { companyNameField.required = true; companyNameField.disabled = false; }
        } else if (paymentMethod === 'EFS' && isFlyingJCompany) {
            // Show Company Name and Signature checkbox for EFS payment with Flying J company
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'flex';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
        } else if (paymentMethod === 'EFS' && isLovesCompany) {
            // For Love's + EFS: Show Company Name, Signature checkbox, Copy Type, Check Number, Driver First Name, and Driver Last Name
            // Hide vehicle fields and check number confirm
            if (vehicleDetailsRow) vehicleDetailsRow.style.display = 'none';
            companyNameGroup.style.display = 'block';
            // Make Company Name required
            const companyNameFieldReq = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameFieldReq) companyNameFieldReq.required = true;
            // Hide Vehicle ID and DL Number fields for Love's + EFS combination
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'none';
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            // Remove required attribute when hidden
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
            
            // Ensure EFS details row is visible
            const efsDetailsRow = document.getElementById('efsDetailsRow');
            if (efsDetailsRow) efsDetailsRow.style.display = 'grid';
            
            // Show check number field (required for Love's EFS)
            const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
            if (checkNumberField) {
                checkNumberField.required = true;
                const g = checkNumberField.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'block';
            }
            
            // Hide check number confirm field
            const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
            if (checkNumberConfirmField) {
                checkNumberConfirmField.required = false;
                const g = checkNumberConfirmField.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'none';
            }
            
            // Show driver first and last name fields (required for Love's EFS)
            const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
            const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
            if (driverFirstNameField) {
                driverFirstNameField.required = true;
                const g = driverFirstNameField.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'block';
            }
            if (driverLastNameField) {
                driverLastNameField.required = true;
                const g = driverLastNameField.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'block';
            }
            
            // Ensure copy type is shown in efsDetailsRow (before signature checkbox)
            const copyTypeGroup = document.getElementById('copyTypeGroup') as HTMLElement | null;
            const copyTypeRow = document.getElementById('copyTypeRow') as HTMLElement | null;
            const signatureCheckboxGroup = document.getElementById('signatureCheckboxGroup') as HTMLElement | null;
            if (copyTypeGroup && efsDetailsRow && signatureCheckboxGroup) {
                // Move copy type group into efsDetailsRow if not already there (before signature checkbox)
                if (copyTypeGroup.parentElement !== efsDetailsRow) {
                    // Insert copy type before signature checkbox if it exists, otherwise append
                    if (signatureCheckboxGroup.parentElement === efsDetailsRow) {
                        efsDetailsRow.insertBefore(copyTypeGroup, signatureCheckboxGroup);
                    } else {
                        efsDetailsRow.appendChild(copyTypeGroup);
                    }
                } else {
                    // If already in efsDetailsRow, ensure it's before signature checkbox
                    if (signatureCheckboxGroup.parentElement === efsDetailsRow && 
                        copyTypeGroup.nextSibling !== signatureCheckboxGroup) {
                        efsDetailsRow.insertBefore(copyTypeGroup, signatureCheckboxGroup);
                    }
                }
                copyTypeGroup.style.display = 'block';
            }
            // Show signature checkbox after copy type
            if (signatureCheckboxGroup) {
                signatureCheckboxGroup.style.display = 'flex';
            }
            if (copyTypeRow) copyTypeRow.style.display = 'none';
        } else if (paymentMethod === 'EFS' && isPilotCompany) {
            // Show Company Name and Signature checkbox for EFS payment with Pilot company
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'flex';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
            
            // Hide EFS-specific fields for Pilot + EFS
            const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
            const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
            const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
            const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
            
            const hideFieldGroup = (field: HTMLInputElement | null) => {
                if (field) {
                    field.required = false;
                    field.removeAttribute('required');
                    const formGroup = field.closest('.form-group') as HTMLElement | null;
                    if (formGroup) {
                        formGroup.style.display = 'none';
                    }
                }
            };
            
            hideFieldGroup(checkNumberField);
            hideFieldGroup(checkNumberConfirmField);
            hideFieldGroup(driverFirstNameField);
            hideFieldGroup(driverLastNameField);
        } else if (paymentMethod === 'Cash' && !isUSA) {
            // Hide Company Name and Signature checkbox for Cash payment with other companies (but not USA)
            companyNameGroup.style.display = 'none';
            signatureCheckboxGroup.style.display = 'none';
            // Remove required attribute when hidden
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = false;
        } else if (paymentMethod === 'TCH' && isPilotCompany && !isUSA) {
            // Hide Company Name and Signature checkbox for TCH payment with Pilot company (but not for USA)
            companyNameGroup.style.display = 'none';
            signatureCheckboxGroup.style.display = 'none';
            // Remove required attribute when hidden
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = false;
            // Also handle Vehicle ID field - ensure it's not required and is disabled
            const vehicleDetailsRow = document.getElementById('vehicleDetailsRow') as HTMLElement | null;
            if (vehicleDetailsRow) {
                vehicleDetailsRow.style.display = 'none';
                // Remove required attribute from Vehicle ID in vehicleDetailsRow
                const vehicleIdFieldInVehicleDetailsRow = vehicleDetailsRow.querySelector('#vehicleId') as HTMLInputElement | null;
                if (vehicleIdFieldInVehicleDetailsRow) {
                    vehicleIdFieldInVehicleDetailsRow.required = false;
                    vehicleIdFieldInVehicleDetailsRow.removeAttribute('required');
                    vehicleIdFieldInVehicleDetailsRow.disabled = true;
                }
            }
            // Also check efsDetailsRow for Vehicle ID field
            const efsDetailsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            if (efsDetailsRow) {
                const vehicleIdFieldInEfsRow = efsDetailsRow.querySelector('#vehicleId') as HTMLInputElement | null;
                if (vehicleIdFieldInEfsRow) {
                    vehicleIdFieldInEfsRow.required = false;
                    vehicleIdFieldInEfsRow.removeAttribute('required');
                    vehicleIdFieldInEfsRow.disabled = true;
                    // Hide the Vehicle ID group in efsDetailsRow
                    const vehicleIdGroupInEfsRow = vehicleIdFieldInEfsRow.closest('.form-group') as HTMLElement | null;
                    if (vehicleIdGroupInEfsRow) {
                        vehicleIdGroupInEfsRow.style.display = 'none';
                    }
                }
            }
        } else if (paymentMethod === 'TCH' && isOne9Company) {
            // Show Company Name for TCH payment with One9 company
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'none';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
        } else if (paymentMethod === 'TCH' && isLovesCompany) {
            // Show Company Name for TCH payment with Love's company
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'none';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
        } else if (paymentMethod === 'TCH' && isFlyingJCompany && selectedCompany && selectedCompany.country === 'United States of America') {
            // Show Company Name for TCH payment with USA Flying J company
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'none';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
        } else if (paymentMethod === 'TCH' && selectedCompany && selectedCompany.country === 'Canada' && selectedCompany.name.toLowerCase().includes('flying j')) {
            // Show Company Name for TCH payment with Canadian Flying J company
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'none';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
        } else if (paymentMethod === 'TCH' && isTravelCentersCompany) {
            // Show Company Name for TCH payment with TravelCenters company
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'none';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
        } else if (paymentMethod === 'TCH' && !isUSA) {
            // Hide Company Name for TCH payment with other companies (but not USA)
            companyNameGroup.style.display = 'none';
            signatureCheckboxGroup.style.display = 'none';
            // Remove required attribute when hidden
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = false;
        } else if (paymentMethod === 'EFS' && isOne9Company) {
            // Show Company Name and Signature checkbox for EFS payment with One9 company
            // Hide Check Number, Check Number Confirm, Driver First Name, Driver Last Name
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'flex';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
            
            // Hide EFS-only fields (check numbers and driver names)
            const hideFieldGroup = (input: HTMLInputElement | null) => {
                if (!input) return;
                input.required = false;
                const g = input.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'none';
            };
            
            hideFieldGroup(document.getElementById('checkNumber') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('checkNumberConfirm') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('driverFirstName') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('driverLastName') as HTMLInputElement | null);
        } else if (paymentMethod === 'EFS' && !isUSA) {
            // Hide Company Name for EFS payment with other companies (but not USA)
            companyNameGroup.style.display = 'none';
            signatureCheckboxGroup.style.display = 'none';
            // Remove required attribute when hidden
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = false;
        } else if (paymentMethod === 'Master' && isLovesCompany) {
            // Show Company Name and Signature checkbox for Master payment with Love's company
            // Ensure efsDetailsRow is visible to show companyNameGroup
            const efsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            if (efsRow) efsRow.style.display = 'grid';
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'flex';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) { 
                companyNameField.required = true;
                companyNameField.disabled = false;
            }
        } else if (paymentMethod === 'Master' && isPilotCompany) {
            // Show Vehicle ID, Company Name, and Signature checkbox for Master payment with Pilot company
            const efsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            if (efsRow) {
                efsRow.style.display = 'grid';
                
                // Get Vehicle ID from efsDetailsRow (there's one in there)
                const vehicleIdInEfsRow = efsRow.querySelector('#vehicleId') as HTMLInputElement | null;
                const vehicleIdGroupInEfsRow = vehicleIdInEfsRow?.closest('.form-group') as HTMLElement | null;
                
                
                // Get Company Name field
                const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement | null;
                
                // Clear Vehicle ID and Company Name values for Pilot + Master
                if (vehicleIdInEfsRow) {
                    vehicleIdInEfsRow.value = '';
                }
                if (companyNameField) {
                    companyNameField.value = '';
                }
                
                // Ensure companyNameGroup is in efsDetailsRow
                if (companyNameGroup && companyNameGroup.parentElement !== efsRow) {
                    efsRow.appendChild(companyNameGroup);
                }
                
                // Ensure signatureCheckboxGroup is in efsDetailsRow
                if (signatureCheckboxGroup && signatureCheckboxGroup.parentElement !== efsRow) {
                    efsRow.appendChild(signatureCheckboxGroup);
                }
                
                // Show Vehicle ID from efsDetailsRow
                if (vehicleIdGroupInEfsRow) {
                    vehicleIdGroupInEfsRow.style.display = 'block';
                }
                if (vehicleIdInEfsRow) {
                    vehicleIdInEfsRow.required = true;
                    vehicleIdInEfsRow.disabled = false; // Enable the field so it's clickable
                    vehicleIdInEfsRow.setAttribute('required', 'required');
                }
                
                // Ensure efsRow uses grid layout (same as other form-rows)
                efsRow.style.display = 'grid';
                efsRow.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
                efsRow.style.gap = '20px';
                
                // Order: Vehicle ID -> Company Name (in same row), Signature Checkbox (on new line)
                if (vehicleIdGroupInEfsRow && companyNameGroup && signatureCheckboxGroup) {
                    // Remove all from row first
                    if (vehicleIdGroupInEfsRow.parentElement === efsRow) efsRow.removeChild(vehicleIdGroupInEfsRow);
                    if (companyNameGroup.parentElement === efsRow) efsRow.removeChild(companyNameGroup);
                    if (signatureCheckboxGroup.parentElement === efsRow) efsRow.removeChild(signatureCheckboxGroup);
                    
                    // Add Vehicle ID and Company Name in same row first
                    efsRow.appendChild(vehicleIdGroupInEfsRow);
                    efsRow.appendChild(companyNameGroup);
                    
                    // Ensure Vehicle ID and Company Name form-groups take full width of their grid columns
                    // Match the spacing and width of Card Last 4 Digits and Card Entry Method
                    vehicleIdGroupInEfsRow.style.width = '100%';
                    vehicleIdGroupInEfsRow.style.maxWidth = '100%';
                    vehicleIdGroupInEfsRow.style.minWidth = '0';
                    vehicleIdGroupInEfsRow.style.marginTop = '0';
                    vehicleIdGroupInEfsRow.style.marginBottom = '0';
                    vehicleIdGroupInEfsRow.style.marginLeft = '0';
                    vehicleIdGroupInEfsRow.style.marginRight = '0';
                    // Keep default form-group margin-bottom for proper spacing (24px)
                    vehicleIdGroupInEfsRow.style.marginBottom = '24px';
                    
                    companyNameGroup.style.width = '100%';
                    companyNameGroup.style.maxWidth = '100%';
                    companyNameGroup.style.minWidth = '0';
                    companyNameGroup.style.marginTop = '0';
                    companyNameGroup.style.marginBottom = '0';
                    companyNameGroup.style.marginLeft = '0';
                    companyNameGroup.style.marginRight = '0';
                    // Keep default form-group margin-bottom for proper spacing (24px)
                    companyNameGroup.style.marginBottom = '24px';
                    
                    // Ensure the input fields inside also take full width
                    const vehicleIdInput = vehicleIdGroupInEfsRow.querySelector('input') as HTMLInputElement | null;
                    const companyNameInput = companyNameGroup.querySelector('input') as HTMLInputElement | null;
                    if (vehicleIdInput) {
                        vehicleIdInput.style.width = '100%';
                        vehicleIdInput.style.maxWidth = '100%';
                        vehicleIdInput.style.boxSizing = 'border-box';
                    }
                    if (companyNameInput) {
                        companyNameInput.style.width = '100%';
                        companyNameInput.style.maxWidth = '100%';
                        companyNameInput.style.boxSizing = 'border-box';
                    }
                    
                    // Add signature checkbox on new line (after Vehicle ID and Company Name)
                    efsRow.appendChild(signatureCheckboxGroup);
                    
                    // Make signature checkbox take full width (new line) and minimize vertical gap
                    signatureCheckboxGroup.style.width = '100%';
                    signatureCheckboxGroup.style.gridColumn = '1 / -1';
                    // Use negative margin to minimize gap (form-row has 20px gap, so we compensate)
                    signatureCheckboxGroup.style.marginTop = '-10px'; // Reduce gap from 20px to ~10px
                    signatureCheckboxGroup.style.marginBottom = '0';
                    signatureCheckboxGroup.style.marginLeft = '0';
                    signatureCheckboxGroup.style.marginRight = '0';
                    signatureCheckboxGroup.style.paddingTop = '0';
                    signatureCheckboxGroup.style.paddingBottom = '0';
                    // Override any default form-group margin
                    signatureCheckboxGroup.style.setProperty('margin-top', '-10px', 'important');
                    signatureCheckboxGroup.style.setProperty('margin-bottom', '0', 'important');
                }
            }
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'flex';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) { companyNameField.required = true; companyNameField.disabled = false; }
            // Hide EFS-only fields within the row (Check Number, Driver names, etc.)
            const hideFieldGroup = (input: HTMLInputElement | null) => {
                if (!input) return;
                input.required = false;
                const g = input.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'none';
            };
            hideFieldGroup(document.getElementById('checkNumber') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('checkNumberConfirm') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('driverFirstName') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('driverLastName') as HTMLInputElement | null);
        } else if (paymentMethod === 'Master' && isTravelCentersCompany) {
            // Show Company Name and EFS fields for Master payment with TravelCenters company
            const efsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            if (efsRow) efsRow.style.display = 'grid';
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'none';
            // Make Company Name required
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) { companyNameField.required = true; companyNameField.disabled = false; }
            // Show and make required EFS fields for TA + Master
            const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
            const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
            const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
            const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement | null;
            
            const showFieldGroup = (input: HTMLInputElement | null, required: boolean = false) => {
                if (!input) return;
                const g = input.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'block';
                if (required) {
                    input.required = true;
                }
            };
            
            showFieldGroup(checkNumberField, true);
            showFieldGroup(checkNumberConfirmField, true);
            showFieldGroup(driverFirstNameField, true);
            showFieldGroup(driverLastNameField, true);
            showFieldGroup(vehicleIdField, true);
        } else if (paymentMethod === 'Master' && selectedCompany && selectedCompany.name.toLowerCase().includes('flying j') && getCurrentCountry() === 'United States of America') {
            // Show Company Name and Signature checkbox for Master payment with USA Flying J company
            const efsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            if (efsRow) efsRow.style.display = 'grid';
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'flex';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) { companyNameField.required = true; companyNameField.disabled = false; }
            // Hide EFS-only fields within the row
            const hideFieldGroup = (input: HTMLInputElement | null) => {
                if (!input) return;
                input.required = false;
                const g = input.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'none';
            };
            hideFieldGroup(document.getElementById('checkNumber') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('checkNumberConfirm') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('driverFirstName') as HTMLInputElement | null);
            hideFieldGroup(document.getElementById('driverLastName') as HTMLInputElement | null);
        } else if (paymentMethod === 'Master' && !isUSA && !isPilotCompany) {
            // Hide Company Name for Master payment with other companies (but not USA, not Pilot)
            companyNameGroup.style.display = 'none';
            signatureCheckboxGroup.style.display = 'none';
            // Remove required attribute when hidden
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = false;
        } else if (paymentMethod === 'Visa' && isTravelCentersCompany) {
            // Show Company Name for Visa payment with TravelCenters company
            const efsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            if (efsRow) efsRow.style.display = 'grid';
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'none';
            // Make Company Name required
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) { companyNameField.required = true; companyNameField.disabled = false; }
        } else if (paymentMethod === 'Visa' && isLovesCompany && !isUSA) {
            // Hide Company Name for Visa payment with Love's company (but not for USA)
            // Note: Signature checkbox will be shown next to copy type dropdown (handled later)
            companyNameGroup.style.display = 'none';
            // Don't hide signature checkbox here - it will be shown in copyTypeRow for Love's + Visa
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = false;
        } else if (!(paymentMethod === 'Master' && isPilotCompany)) {
            // Show Company Name for other payment methods (but not Pilot + Master, which is handled above)
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'none';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
        }
    }

    // Final enforcement for Love's + EFS layout visibility
    if (paymentMethod === 'EFS' && isLovesCompany) {
        const efsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
        if (efsRow) efsRow.style.display = 'grid';
        const companyNameGroupEl = document.getElementById('companyNameGroup') as HTMLElement | null;
        const signatureGroupEl = document.getElementById('signatureCheckboxGroup') as HTMLElement | null;
        const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
        const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
        const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
        const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
        const copyTypeGroup = document.getElementById('copyTypeGroup') as HTMLElement | null;
        const copyTypeRow = document.getElementById('copyTypeRow') as HTMLElement | null;
        
        if (companyNameGroupEl) companyNameGroupEl.style.display = 'block';
        if (signatureGroupEl) signatureGroupEl.style.display = 'flex';
        
        // Show driver first and last name fields (required for Love's EFS)
        if (driverFirstNameField) {
            driverFirstNameField.required = true;
            const g = driverFirstNameField.closest('.form-group') as HTMLElement | null;
            if (g) g.style.display = 'block';
        }
        if (driverLastNameField) {
            driverLastNameField.required = true;
            const g = driverLastNameField.closest('.form-group') as HTMLElement | null;
            if (g) g.style.display = 'block';
        }
        
        // Show check number field (required for Love's EFS)
        if (checkNumberField) {
            checkNumberField.required = true;
            const g = checkNumberField.closest('.form-group') as HTMLElement | null;
            if (g) g.style.display = 'block';
        }
        
        // Hide check number confirm field
        if (checkNumberConfirmField) {
            checkNumberConfirmField.required = false;
            const g = checkNumberConfirmField.closest('.form-group') as HTMLElement | null;
            if (g) g.style.display = 'none';
        }
        
        // Show copy type in efsDetailsRow (before signature checkbox)
        if (copyTypeGroup && efsRow && signatureGroupEl) {
            // Move copy type group into efsDetailsRow if not already there (before signature checkbox)
            if (copyTypeGroup.parentElement !== efsRow) {
                // Insert copy type before signature checkbox if it exists, otherwise append
                if (signatureGroupEl.parentElement === efsRow) {
                    efsRow.insertBefore(copyTypeGroup, signatureGroupEl);
                } else {
                    efsRow.appendChild(copyTypeGroup);
                }
            } else {
                // If already in efsRow, ensure it's before signature checkbox
                if (signatureGroupEl.parentElement === efsRow && 
                    copyTypeGroup.nextSibling !== signatureGroupEl) {
                    efsRow.insertBefore(copyTypeGroup, signatureGroupEl);
                }
            }
            copyTypeGroup.style.display = 'block';
        }
        if (copyTypeRow) copyTypeRow.style.display = 'none';
    }
    // Ensure EFS details row is hidden for non-EFS, except keep it for Pilot + Visa, Pilot + Master, TA + Visa, TA + Master, Love's + Cash, Love's + Master, and USA Flying J + Master to show Company Name and Signature checkbox
    if (paymentMethod !== 'EFS') {
        const efsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
        const keepForPilotVisa = paymentMethod === 'Visa' && isPilotCompany;
        const keepForPilotMaster = paymentMethod === 'Master' && isPilotCompany;
        const keepForTAVisas = paymentMethod === 'Visa' && isTravelCentersCompany;
        const keepForTAMaster = paymentMethod === 'Master' && isTravelCentersCompany;
        const keepForLovesCash = paymentMethod === 'Cash' && isLovesCompany;
        const keepForLovesMaster = paymentMethod === 'Master' && isLovesCompany;
        const keepForUSAFlyingJMaster = paymentMethod === 'Master' && selectedCompany && selectedCompany.name.toLowerCase().includes('flying j') && getCurrentCountry() === 'United States of America';
        const keepRow = keepForPilotVisa || keepForPilotMaster || keepForTAVisas || keepForTAMaster || keepForLovesCash || keepForLovesMaster || keepForUSAFlyingJMaster;
        if (efsRow) efsRow.style.display = keepRow ? 'grid' : 'none';
        const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement | null;
        if (companyNameField) {
            if (keepRow) {
                companyNameField.required = true;
                companyNameField.disabled = false;
            } else {
                companyNameField.required = false;
                companyNameField.removeAttribute('required');
            }
        }
        // Hide EFS-only sub-fields when showing row for Pilot + Visa, Pilot + Master, TA + Visa, Love's + Cash, Love's + Master, but show them for TA + Master and USA Flying J + Master
        
        if (keepRow) {
            const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
            const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
            const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
            const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
            const sigGroup = document.getElementById('signatureCheckboxGroup') as HTMLElement | null;
            const hideGroup = (el: HTMLElement | null) => { if (el) el.style.display = 'none'; };
            const hideFieldGroup = (input: HTMLInputElement | null) => {
                if (!input) return;
                input.required = false;
                const g = input.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'none';
            };
            const showFieldGroup = (input: HTMLInputElement | null, required: boolean = true) => {
                if (!input) return;
                const g = input.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'block';
                if (required) {
                    input.required = true;
                }
            };
            
            // Get Vehicle ID field for TA + Master
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement | null;
            
            // Show fields for TA + Master, hide for others (including Pilot + Master, Love's + Master)
            if (keepForTAMaster) {
                // Explicitly show all EFS fields for TA + Master
                showFieldGroup(checkNumberField, true);
                showFieldGroup(checkNumberConfirmField, true);
                showFieldGroup(driverFirstNameField, true);
                showFieldGroup(driverLastNameField, true);
                if (vehicleIdField) {
                    // Show Vehicle ID for TA + Master (it's in the EFS row now, after Driver Last Name)
                    showFieldGroup(vehicleIdField, true);
                }
            } else if (keepForUSAFlyingJMaster) {
                // For USA Flying J + Master, hide EFS-specific fields (only show signature checkbox)
                hideFieldGroup(checkNumberField);
                hideFieldGroup(checkNumberConfirmField);
                hideFieldGroup(driverFirstNameField);
                hideFieldGroup(driverLastNameField);
                if (vehicleIdField) {
                    hideFieldGroup(vehicleIdField);
                }
            } else {
                // Hide fields for other combinations (Pilot + Visa, TA + Visa, Love's + Cash, Love's + Master, Pilot + Master)
                hideFieldGroup(checkNumberField);
                hideFieldGroup(checkNumberConfirmField);
                hideFieldGroup(driverFirstNameField);
                if (vehicleIdField) {
                    hideFieldGroup(vehicleIdField);
                }
                hideFieldGroup(driverLastNameField);
            }
            // Show signature checkbox for Pilot + Master, Love's + Master, USA Flying J + Master, and TA + Master
            // Hide it for Pilot + Visa, TA + Visa, Love's + Cash
            if (keepForPilotMaster || keepForLovesMaster || keepForUSAFlyingJMaster || keepForTAMaster) {
                // Show signature checkbox for Pilot + Master, Love's + Master, USA Flying J + Master, and TA + Master
                if (sigGroup) sigGroup.style.display = 'flex';
            } else {
                // Hide signature checkbox for other combinations
                hideGroup(sigGroup);
            }
        }
        
        // Explicitly hide EFS fields for Pilot + Master (even if EFS row is shown elsewhere) and ensure signature checkbox is visible
        if (keepForPilotMaster) {
            const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
            const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
            const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
            const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
            const signatureCheckboxGroup = document.getElementById('signatureCheckboxGroup') as HTMLElement | null;
            
            const hideFieldGroup = (input: HTMLInputElement | null) => {
                if (!input) return;
                input.required = false;
                const g = input.closest('.form-group') as HTMLElement | null;
                if (g) g.style.display = 'none';
            };
            
            hideFieldGroup(checkNumberField);
            hideFieldGroup(checkNumberConfirmField);
            hideFieldGroup(driverFirstNameField);
            hideFieldGroup(driverLastNameField);
            
            // Ensure signature checkbox is visible for Pilot + Master
            if (signatureCheckboxGroup) {
                signatureCheckboxGroup.style.display = 'flex';
            }
        }
    }
    
    // Show/hide Copy Type dropdown only for companies that support it
    // Companies that use copyType: One9, Travel Centers of America (TA), Love's
    // Pilot with Master does NOT show copy type dropdown
    // One9 with Master does NOT show copy type dropdown
    // Only show for payment methods that display "Type: SALE"
    const copyTypeRow = document.getElementById('copyTypeRow') as HTMLElement | null;
    const copyTypeGroup = document.getElementById('copyTypeGroup') as HTMLElement | null;
    const isUSAJWithMaster = selectedCompany && selectedCompany.name.toLowerCase().includes('flying j') && getCurrentCountry() === 'United States of America' && paymentMethod === 'Master';
    
    // Check if the selected company supports copyType
    // Exclude Pilot with Master payment method
    // Exclude Pilot with VISA payment method
    // Exclude Pilot with EFS payment method
    // Exclude Pilot with TCH payment method
    // Exclude Pilot with Cash payment method
    // Exclude One9 with Master payment method
    // Exclude One9 with EFS payment method
    // Exclude One9 with TCH payment method
    // Exclude One9 with VISA payment method
    const pilotWithMaster = isPilotCompany && paymentMethod === 'Master';
    const pilotWithVisa = isPilotCompany && paymentMethod === 'Visa';
    const pilotWithEFS = isPilotCompany && paymentMethod === 'EFS';
    const pilotWithTCH = isPilotCompany && paymentMethod === 'TCH';
    const pilotWithCash = isPilotCompany && paymentMethod === 'Cash';
    const one9WithMaster = isOne9Company && paymentMethod === 'Master';
    const one9WithEFS = isOne9Company && paymentMethod === 'EFS';
    const one9WithTCH = isOne9Company && paymentMethod === 'TCH';
    const one9WithVisa = isOne9Company && paymentMethod === 'Visa';
    const companySupportsCopyType = isOne9Company || isTravelCentersCompany || isLovesCompany;
    
    // Only show copy type for supported companies and appropriate payment methods
    // For Love's, show for Cash payment method
    // For Travel Centers, show for Cash payment method
    // Hide for Pilot + Master, Pilot + VISA, Pilot + EFS, Pilot + TCH, Pilot + Cash, One9 + Master, One9 + EFS, One9 + TCH, and One9 + VISA
    const lovesCash = isLovesCompany && paymentMethod === 'Cash';
    const travelCentersCash = isTravelCentersCompany && paymentMethod === 'Cash';
    
    // Show copy type for:
    // - One9, TA with Visa/Master/TCH/Interac (but not One9+Master, not One9+EFS, not One9+TCH, not One9+VISA)
    // - Love's with Cash
    // - Travel Centers with Cash
    // - Love's with EFS (shown in efsDetailsRow, not copyTypeRow)
    const lovesEFS = isLovesCompany && paymentMethod === 'EFS';
    let showCopyType = false;
    if (lovesCash) {
        // Love's + Cash: always show copy type
        showCopyType = true;
        console.log('Love\'s + Cash detected, showing copy type dropdown', {
            isLovesCompany,
            paymentMethod,
            companyName: selectedCompany?.name
        });
    } else if (travelCentersCash) {
        // Travel Centers + Cash: always show copy type
        showCopyType = true;
        console.log('Travel Centers + Cash detected, showing copy type dropdown', {
            isTravelCentersCompany,
            paymentMethod,
            companyName: selectedCompany?.name
        });
    } else if (lovesEFS) {
        // Love's + EFS: copy type is handled in efsDetailsRow section, don't show in copyTypeRow
        showCopyType = false; // Will be shown in efsDetailsRow instead
    } else if (companySupportsCopyType && 
        (paymentMethod === 'Visa' || paymentMethod === 'Master' || paymentMethod === 'TCH' || paymentMethod === 'EFS' || paymentMethod === 'Interac') && 
        !isUSAJWithMaster && !pilotWithMaster && !pilotWithVisa && !pilotWithEFS && !pilotWithTCH && !pilotWithCash && !one9WithMaster && !one9WithEFS && !one9WithTCH && !one9WithVisa) {
        // Other supported companies with card payments
        showCopyType = true;
    }
    
    console.log('Copy type visibility check:', {
        showCopyType,
        isLovesCompany,
        isTravelCentersCompany,
        paymentMethod,
        lovesCash,
        travelCentersCash,
        lovesEFS,
        companyName: selectedCompany?.name,
        companySupportsCopyType
    });
    
    // Show/hide the copy type row and group
    // For Love's + EFS, copy type is shown in efsDetailsRow, not copyTypeRow
    // For One9 + EFS, copy type should be hidden
    // For One9 + TCH, copy type should be hidden
    // For One9 + VISA, copy type should be hidden
    // For Pilot + VISA, copy type should be hidden
    // For Pilot + EFS, copy type should be hidden
    // For Pilot + TCH, copy type should be hidden
    // For Pilot + Cash, copy type should be hidden
    if (!lovesEFS && !one9WithEFS && !one9WithTCH && !one9WithVisa && !pilotWithVisa && !pilotWithEFS && !pilotWithTCH && !pilotWithCash && copyTypeRow) {
        copyTypeRow.style.display = showCopyType ? 'grid' : 'none';
    } else if ((lovesEFS || one9WithEFS || one9WithTCH || one9WithVisa || pilotWithVisa || pilotWithEFS || pilotWithTCH || pilotWithCash) && copyTypeRow) {
        // Hide copyTypeRow for Love's + EFS (it's in efsDetailsRow), One9 + EFS (should be hidden), One9 + TCH (should be hidden), One9 + VISA (should be hidden), Pilot + VISA (should be hidden), Pilot + EFS (should be hidden), Pilot + TCH (should be hidden), and Pilot + Cash (should be hidden)
        copyTypeRow.style.display = 'none';
    }
    // Only show copyTypeGroup in copyTypeRow if not Love's + EFS, not One9 + EFS, not One9 + TCH, not One9 + VISA, not Pilot + VISA, not Pilot + EFS, not Pilot + TCH, and not Pilot + Cash
    if (!lovesEFS && !one9WithEFS && !one9WithTCH && !one9WithVisa && !pilotWithVisa && !pilotWithEFS && !pilotWithTCH && !pilotWithCash && copyTypeGroup) {
        // Make sure copyTypeGroup is in copyTypeRow for non-Love's+EFS, non-One9+EFS, non-One9+TCH, non-One9+VISA, non-Pilot+VISA, non-Pilot+EFS, and non-Pilot+TCH cases
        const copyTypeRowEl = document.getElementById('copyTypeRow') as HTMLElement | null;
        if (copyTypeRowEl && copyTypeGroup.parentElement !== copyTypeRowEl) {
            copyTypeRowEl.appendChild(copyTypeGroup);
        }
        copyTypeGroup.style.display = showCopyType ? 'block' : 'none';
        console.log('Copy type group display set to:', copyTypeGroup.style.display);
    } else if ((one9WithEFS || one9WithTCH || one9WithVisa || pilotWithVisa || pilotWithEFS || pilotWithTCH || pilotWithCash) && copyTypeGroup) {
        // Explicitly hide copy type for One9 + EFS, One9 + TCH, One9 + VISA, Pilot + VISA, Pilot + EFS, Pilot + TCH, and Pilot + Cash
        copyTypeGroup.style.display = 'none';
        const copyTypeRowEl = document.getElementById('copyTypeRow') as HTMLElement | null;
        if (copyTypeRowEl) copyTypeRowEl.style.display = 'none';
    } else if (!copyTypeGroup) {
        console.error('copyTypeGroup element not found!');
    }
    
    // Handle Love's + Visa: Show signature checkbox next to copy type dropdown
    const lovesVisa = isLovesCompany && paymentMethod === 'Visa';
    if (lovesVisa) {
        // Ensure copy type is shown for Love's + Visa
        if (!showCopyType) {
            showCopyType = true;
        }
        
        if (copyTypeRow && copyTypeGroup && signatureCheckboxGroup) {
            // Ensure copy type row is visible
            copyTypeRow.style.display = 'grid';
            copyTypeGroup.style.display = 'block';
            
            // Make sure copyTypeGroup is in copyTypeRow
            if (copyTypeGroup.parentElement !== copyTypeRow) {
                copyTypeRow.appendChild(copyTypeGroup);
            }
            
            // Move signature checkbox into copyTypeRow if not already there
            if (signatureCheckboxGroup.parentElement !== copyTypeRow) {
                copyTypeRow.appendChild(signatureCheckboxGroup);
            }
            
            // Show signature checkbox
            signatureCheckboxGroup.style.display = 'flex';
            
            // Ensure copy type group comes before signature checkbox
            if (copyTypeGroup.parentElement === copyTypeRow && 
                signatureCheckboxGroup.parentElement === copyTypeRow) {
                // Check if copy type is before signature checkbox
                let copyTypeBeforeSignature = false;
                let current = copyTypeGroup.nextSibling;
                while (current) {
                    if (current === signatureCheckboxGroup) {
                        copyTypeBeforeSignature = true;
                        break;
                    }
                    current = current.nextSibling;
                }
                if (!copyTypeBeforeSignature) {
                    copyTypeRow.insertBefore(copyTypeGroup, signatureCheckboxGroup);
                }
            }
            
            console.log('Love\'s + Visa: Showing signature checkbox next to copy type dropdown');
        }
    }
    
    // Restore required attributes for visible fields
    restoreRequiredAttributes();
    
    // FORCE show company name and vehicle ID for USA companies regardless of payment method
    // This must run last to override any other hiding logic
    if (isUSA) {
        const companyNameGroupUSA = document.getElementById('companyNameGroup') as HTMLElement | null;
        const companyNameFieldUSA = document.getElementById('driverCompanyName') as HTMLInputElement | null;
        const vehicleDetailsRowUSA = document.getElementById('vehicleDetailsRow') as HTMLElement | null;
        const efsDetailsRowUSA = document.getElementById('efsDetailsRow') as HTMLElement | null;
        
        // Force show vehicle details row (this contains Vehicle ID)
        if (vehicleDetailsRowUSA) {
            vehicleDetailsRowUSA.style.display = 'grid';
            
            // Get Vehicle ID field from vehicleDetailsRow (the first one)
            const vehicleIdInVehicleRow = vehicleDetailsRowUSA.querySelector('#vehicleId') as HTMLInputElement | null;
            const vehicleIdGroupInVehicleRow = vehicleIdInVehicleRow?.closest('.form-group') as HTMLElement | null;
            if (vehicleIdGroupInVehicleRow) {
                vehicleIdGroupInVehicleRow.style.display = 'block';
            }
            if (vehicleIdInVehicleRow) {
                vehicleIdInVehicleRow.disabled = false;
                vehicleIdInVehicleRow.required = true;
                vehicleIdInVehicleRow.setAttribute('required', 'required');
            }
            
            // Move company name group to vehicleDetailsRow so they're in the same row
            if (companyNameGroupUSA) {
                const currentParent = companyNameGroupUSA.parentElement;
                // Only move if it's not already in vehicleDetailsRow
                if (currentParent !== vehicleDetailsRowUSA) {
                    companyNameGroupUSA.style.display = 'block';
                    // Insert company name group right after Vehicle ID group
                    // Find the Vehicle ID group and insert company name after it
                    const allFormGroups = vehicleDetailsRowUSA.querySelectorAll('.form-group');
                    let vehicleIdGroupIndex = -1;
                    allFormGroups.forEach((group, index) => {
                        if (group.querySelector('#vehicleId') && !group.querySelector('#dlNumber')) {
                            vehicleIdGroupIndex = index;
                        }
                    });
                    
                    if (vehicleIdGroupIndex >= 0 && allFormGroups[vehicleIdGroupIndex + 1]) {
                        // Insert after Vehicle ID group
                        vehicleDetailsRowUSA.insertBefore(companyNameGroupUSA, allFormGroups[vehicleIdGroupIndex + 1]);
                    } else {
                        // If Vehicle ID is the last or only child, append company name
                        vehicleDetailsRowUSA.appendChild(companyNameGroupUSA);
                    }
                } else {
                    // Already in vehicleDetailsRow, just make sure it's visible
                    companyNameGroupUSA.style.display = 'block';
                }
            }
            
            // Hide DL Number for USA companies (we only want Vehicle ID and Company Name in one row)
            const dlNumberField = vehicleDetailsRowUSA.querySelector('#dlNumber') as HTMLInputElement | null;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement | null;
            if (dlNumberGroup) {
                dlNumberGroup.style.display = 'none';
            }
        }
        
        // Set company name field properties
        if (companyNameFieldUSA) {
            companyNameFieldUSA.disabled = false;
            companyNameFieldUSA.required = true;
            companyNameFieldUSA.setAttribute('required', 'required');
        }
        
        // For EFS payment method, show efsDetailsRow with EFS-specific fields
        // For other payment methods, hide efsDetailsRow (company name is already in vehicleDetailsRow)
        if (efsDetailsRowUSA) {
            if (paymentMethod === 'EFS') {
                // Check if this is USA Flying J company
                const companySelect = document.getElementById('designId') as HTMLSelectElement;
                const selectedCompanyId = companySelect?.value ? parseInt(companySelect.value) : null;
                const selectedCompany = selectedCompanyId ? companies.find(c => c.id === selectedCompanyId) : null;
                const isUSAFlyingJ = selectedCompany && selectedCompany.country === 'United States of America' && selectedCompany.name.toLowerCase().includes('flying j');
                
                if (isUSAFlyingJ) {
                    // For USA Flying J + EFS, hide EFS-specific fields but keep signature checkbox visible
                    // Don't hide efsDetailsRow completely - we need it to show the signature checkbox
                    // Instead, hide individual EFS fields inside it
                    
                    // Hide and remove required from EFS-specific fields
                    const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
                    const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
                    const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
                    const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
                    
                    if (checkNumberField) {
                        const checkNumberGroup = checkNumberField.closest('.form-group') as HTMLElement | null;
                        if (checkNumberGroup) checkNumberGroup.style.display = 'none';
                        checkNumberField.required = false;
                        checkNumberField.removeAttribute('required');
                    }
                    if (checkNumberConfirmField) {
                        const checkNumberConfirmGroup = checkNumberConfirmField.closest('.form-group') as HTMLElement | null;
                        if (checkNumberConfirmGroup) checkNumberConfirmGroup.style.display = 'none';
                        checkNumberConfirmField.required = false;
                        checkNumberConfirmField.removeAttribute('required');
                    }
                    if (driverFirstNameField) {
                        const driverFirstNameGroup = driverFirstNameField.closest('.form-group') as HTMLElement | null;
                        if (driverFirstNameGroup) driverFirstNameGroup.style.display = 'none';
                        driverFirstNameField.required = false;
                        driverFirstNameField.removeAttribute('required');
                    }
                    if (driverLastNameField) {
                        const driverLastNameGroup = driverLastNameField.closest('.form-group') as HTMLElement | null;
                        if (driverLastNameGroup) driverLastNameGroup.style.display = 'none';
                        driverLastNameField.required = false;
                        driverLastNameField.removeAttribute('required');
                    }
                    
                    // Hide Vehicle ID in efsDetailsRow (we use the one in vehicleDetailsRow)
                    const vehicleIdInEfsRow = efsDetailsRowUSA.querySelector('#vehicleId') as HTMLInputElement | null;
                    if (vehicleIdInEfsRow) {
                        const vehicleIdGroupInEfsRow = vehicleIdInEfsRow.closest('.form-group') as HTMLElement | null;
                        if (vehicleIdGroupInEfsRow) vehicleIdGroupInEfsRow.style.display = 'none';
                    }
                    
                    // Hide Company Name in efsDetailsRow (it's already in vehicleDetailsRow)
                    const companyNameInEfsRow = efsDetailsRowUSA.querySelector('#companyNameGroup') as HTMLElement | null;
                    if (companyNameInEfsRow) {
                        companyNameInEfsRow.style.display = 'none';
                    }
                    
                    // Keep efsDetailsRow visible but show only the signature checkbox
                    efsDetailsRowUSA.style.display = 'grid';
                    
                    // Ensure signature checkbox is visible for USA Flying J + EFS
                    const signatureCheckboxGroup = document.getElementById('signatureCheckboxGroup') as HTMLElement | null;
                    if (signatureCheckboxGroup) {
                        signatureCheckboxGroup.style.display = 'flex';
                    }
                } else {
                    // Check if this is One9 company - if so, don't show EFS fields (they're handled separately)
                    const isOne9CompanyUSA = selectedCompany && (selectedCompany.name.toLowerCase().includes('one 9') || selectedCompany.name.toLowerCase().includes('one9'));
                    
                    if (!isOne9CompanyUSA) {
                        // For other USA companies with EFS (but not One9), show efsDetailsRow and EFS fields
                        efsDetailsRowUSA.style.display = 'grid';
                        
                        // Show EFS-specific fields (check number, check number confirm, driver names)
                        const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
                        const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
                        const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
                        const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
                        
                        if (checkNumberField) {
                            const checkNumberGroup = checkNumberField.closest('.form-group') as HTMLElement | null;
                            if (checkNumberGroup) checkNumberGroup.style.display = 'block';
                            checkNumberField.required = true;
                            checkNumberField.setAttribute('required', 'required');
                        }
                        if (checkNumberConfirmField) {
                            const checkNumberConfirmGroup = checkNumberConfirmField.closest('.form-group') as HTMLElement | null;
                            if (checkNumberConfirmGroup) checkNumberConfirmGroup.style.display = 'block';
                            checkNumberConfirmField.required = true;
                            checkNumberConfirmField.setAttribute('required', 'required');
                        }
                        if (driverFirstNameField) {
                            const driverFirstNameGroup = driverFirstNameField.closest('.form-group') as HTMLElement | null;
                            if (driverFirstNameGroup) driverFirstNameGroup.style.display = 'block';
                            driverFirstNameField.required = true;
                            driverFirstNameField.setAttribute('required', 'required');
                        }
                        if (driverLastNameField) {
                            const driverLastNameGroup = driverLastNameField.closest('.form-group') as HTMLElement | null;
                            if (driverLastNameGroup) driverLastNameGroup.style.display = 'block';
                            driverLastNameField.required = true;
                            driverLastNameField.setAttribute('required', 'required');
                        }
                    } else {
                        // For One9 + EFS, hide EFS-specific fields
                        const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
                        const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
                        const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
                        const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
                        
                        const hideFieldGroup = (input: HTMLInputElement | null) => {
                            if (!input) return;
                            input.required = false;
                            input.removeAttribute('required');
                            const g = input.closest('.form-group') as HTMLElement | null;
                            if (g) g.style.display = 'none';
                        };
                        
                        hideFieldGroup(checkNumberField);
                        hideFieldGroup(checkNumberConfirmField);
                        hideFieldGroup(driverFirstNameField);
                        hideFieldGroup(driverLastNameField);
                    }
                    
                    // Hide Vehicle ID in efsDetailsRow (we use the one in vehicleDetailsRow)
                    const vehicleIdInEfsRow = efsDetailsRowUSA.querySelector('#vehicleId') as HTMLInputElement | null;
                    if (vehicleIdInEfsRow) {
                        const vehicleIdGroupInEfsRow = vehicleIdInEfsRow.closest('.form-group') as HTMLElement | null;
                        if (vehicleIdGroupInEfsRow) vehicleIdGroupInEfsRow.style.display = 'none';
                    }
                }
                
                // Company name is already in vehicleDetailsRow, so hide it in efsDetailsRow if it's still there
                // But don't hide the group itself if it's needed elsewhere
            } else {
                // For non-EFS payment methods, check if we need to keep efsDetailsRow for signature checkbox
                const companySelect = document.getElementById('designId') as HTMLSelectElement;
                const selectedCompanyId = companySelect?.value ? parseInt(companySelect.value) : null;
                const selectedCompany = selectedCompanyId ? companies.find(c => c.id === selectedCompanyId) : null;
                const isUSAFlyingJ = selectedCompany && selectedCompany.country === 'United States of America' && selectedCompany.name.toLowerCase().includes('flying j');
                const isUSAFlyingJWithMaster = isUSAFlyingJ && paymentMethod === 'Master';
                
                if (isUSAFlyingJWithMaster) {
                    // For USA Flying J + Master, keep efsDetailsRow visible for signature checkbox
                    efsDetailsRowUSA.style.display = 'grid';
                    
                    // Hide EFS-specific fields but keep signature checkbox visible
                    const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
                    const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
                    const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
                    const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
                    
                    if (checkNumberField) {
                        const checkNumberGroup = checkNumberField.closest('.form-group') as HTMLElement | null;
                        if (checkNumberGroup) checkNumberGroup.style.display = 'none';
                        checkNumberField.required = false;
                        checkNumberField.removeAttribute('required');
                    }
                    if (checkNumberConfirmField) {
                        const checkNumberConfirmGroup = checkNumberConfirmField.closest('.form-group') as HTMLElement | null;
                        if (checkNumberConfirmGroup) checkNumberConfirmGroup.style.display = 'none';
                        checkNumberConfirmField.required = false;
                        checkNumberConfirmField.removeAttribute('required');
                    }
                    if (driverFirstNameField) {
                        const driverFirstNameGroup = driverFirstNameField.closest('.form-group') as HTMLElement | null;
                        if (driverFirstNameGroup) driverFirstNameGroup.style.display = 'none';
                        driverFirstNameField.required = false;
                        driverFirstNameField.removeAttribute('required');
                    }
                    if (driverLastNameField) {
                        const driverLastNameGroup = driverLastNameField.closest('.form-group') as HTMLElement | null;
                        if (driverLastNameGroup) driverLastNameGroup.style.display = 'none';
                        driverLastNameField.required = false;
                        driverLastNameField.removeAttribute('required');
                    }
                    
                    // Hide Vehicle ID in efsDetailsRow (we use the one in vehicleDetailsRow)
                    const vehicleIdInEfsRow = efsDetailsRowUSA.querySelector('#vehicleId') as HTMLInputElement | null;
                    if (vehicleIdInEfsRow) {
                        const vehicleIdGroupInEfsRow = vehicleIdInEfsRow.closest('.form-group') as HTMLElement | null;
                        if (vehicleIdGroupInEfsRow) vehicleIdGroupInEfsRow.style.display = 'none';
                    }
                    
                    // Hide Company Name in efsDetailsRow (it's already in vehicleDetailsRow)
                    const companyNameInEfsRow = efsDetailsRowUSA.querySelector('#companyNameGroup') as HTMLElement | null;
                    if (companyNameInEfsRow) {
                        companyNameInEfsRow.style.display = 'none';
                    }
                    
                    // Ensure signature checkbox is visible for USA Flying J + Master
                    const signatureCheckboxGroup = document.getElementById('signatureCheckboxGroup') as HTMLElement | null;
                    if (signatureCheckboxGroup) {
                        signatureCheckboxGroup.style.display = 'flex';
                    }
                } else {
                    // For other non-EFS payment methods, hide efsDetailsRow (company name is in vehicleDetailsRow)
                    efsDetailsRowUSA.style.display = 'none';
                    
                    // Remove required attribute from EFS fields when they're hidden to prevent validation errors
                    const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
                    const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
                    const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
                    const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
                    
                    if (checkNumberField) {
                        checkNumberField.required = false;
                        checkNumberField.removeAttribute('required');
                    }
                    if (checkNumberConfirmField) {
                        checkNumberConfirmField.required = false;
                        checkNumberConfirmField.removeAttribute('required');
                    }
                    if (driverFirstNameField) {
                        driverFirstNameField.required = false;
                        driverFirstNameField.removeAttribute('required');
                    }
                    if (driverLastNameField) {
                        driverLastNameField.required = false;
                        driverLastNameField.removeAttribute('required');
                    }
                }
            }
        }
        
        // Final enforcement: Ensure signature checkbox is visible for USA Flying J + EFS and Master
        if (isUSA && (paymentMethod === 'EFS' || paymentMethod === 'Master')) {
            const companySelect = document.getElementById('designId') as HTMLSelectElement;
            const selectedCompanyId = companySelect?.value ? parseInt(companySelect.value) : null;
            const selectedCompany = selectedCompanyId ? companies.find(c => c.id === selectedCompanyId) : null;
            const isUSAFlyingJ = selectedCompany && selectedCompany.country === 'United States of America' && selectedCompany.name.toLowerCase().includes('flying j');
            
            if (isUSAFlyingJ) {
                const signatureCheckboxGroup = document.getElementById('signatureCheckboxGroup') as HTMLElement | null;
                if (signatureCheckboxGroup) {
                    signatureCheckboxGroup.style.display = 'flex';
                }
            }
        }
        
        // ABSOLUTE FINAL ENFORCEMENT: For Love's + EFS, ensure check number and driver name fields are ALWAYS hidden
        // This runs at the very end to override any other logic that might show them
        const companySelectFinal = document.getElementById('designId') as HTMLSelectElement;
        const selectedCompanyIdFinal = companySelectFinal?.value ? parseInt(companySelectFinal.value) : null;
        const selectedCompanyFinal = selectedCompanyIdFinal ? companies.find(c => c.id === selectedCompanyIdFinal) : null;
        const isLovesCompanyFinal = selectedCompanyFinal && (selectedCompanyFinal.name.toLowerCase().includes('love') || selectedCompanyFinal.name.toLowerCase().includes("love's"));
        const isLovesEFSFinal = isLovesCompanyFinal && paymentMethod === 'EFS';
        
        if (isLovesEFSFinal) {
            const checkNumberFieldFinal = document.getElementById('checkNumber') as HTMLInputElement | null;
            const checkNumberConfirmFieldFinal = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
            const driverFirstNameFieldFinal = document.getElementById('driverFirstName') as HTMLInputElement | null;
            const driverLastNameFieldFinal = document.getElementById('driverLastName') as HTMLInputElement | null;
            
            const showField = (field: HTMLInputElement | null, required: boolean = true) => {
                if (field) {
                    const formGroup = field.closest('.form-group') as HTMLElement | null;
                    if (formGroup) {
                        formGroup.style.display = 'block';
                        formGroup.style.visibility = 'visible';
                    }
                    if (required) {
                        field.required = true;
                        field.setAttribute('required', 'required');
                    } else {
                        field.required = false;
                        field.removeAttribute('required');
                    }
                    field.disabled = false;
                }
            };
            
            const hideField = (field: HTMLInputElement | null) => {
                if (field) {
                    field.required = false;
                    field.removeAttribute('required');
                    field.disabled = false;
                    const formGroup = field.closest('.form-group') as HTMLElement | null;
                    if (formGroup) {
                        formGroup.style.display = 'none';
                        formGroup.style.visibility = 'hidden';
                    }
                }
            };
            
            // Show check number, driver first name, and driver last name for Loves + EFS
            showField(checkNumberFieldFinal, true);
            showField(driverFirstNameFieldFinal, true);
            showField(driverLastNameFieldFinal, true);
            // Hide check number confirm
            hideField(checkNumberConfirmFieldFinal);
        }
        
        // ABSOLUTE FINAL ENFORCEMENT: For One9 + EFS, ensure check number and driver name fields are ALWAYS hidden
        // This runs at the very end to override any other logic that might show them
        const isOne9CompanyFinal = selectedCompanyFinal && (selectedCompanyFinal.name.toLowerCase().includes('one 9') || selectedCompanyFinal.name.toLowerCase().includes('one9'));
        const isOne9EFSFinal = isOne9CompanyFinal && paymentMethod === 'EFS';
        
        if (isOne9EFSFinal) {
            const checkNumberFieldFinal = document.getElementById('checkNumber') as HTMLInputElement | null;
            const checkNumberConfirmFieldFinal = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
            const driverFirstNameFieldFinal = document.getElementById('driverFirstName') as HTMLInputElement | null;
            const driverLastNameFieldFinal = document.getElementById('driverLastName') as HTMLInputElement | null;
            
            const forceHideField = (field: HTMLInputElement | null) => {
                if (field) {
                    field.required = false;
                    field.removeAttribute('required');
                    field.disabled = false;
                    const formGroup = field.closest('.form-group') as HTMLElement | null;
                    if (formGroup) {
                        formGroup.style.display = 'none';
                        formGroup.style.visibility = 'hidden';
                    }
                }
            };
            
            forceHideField(checkNumberFieldFinal);
            forceHideField(checkNumberConfirmFieldFinal);
            forceHideField(driverFirstNameFieldFinal);
            forceHideField(driverLastNameFieldFinal);
        }
        
        // ABSOLUTE FINAL ENFORCEMENT: For Pilot + EFS, ensure check number and driver name fields are ALWAYS hidden
        // This runs at the very end to override any other logic that might show them
        const isPilotCompanyFinal = selectedCompanyFinal && (selectedCompanyFinal.name.toLowerCase().includes('pilot'));
        const isPilotEFSFinal = isPilotCompanyFinal && paymentMethod === 'EFS';
        
        if (isPilotEFSFinal) {
            const checkNumberFieldFinal = document.getElementById('checkNumber') as HTMLInputElement | null;
            const checkNumberConfirmFieldFinal = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
            const driverFirstNameFieldFinal = document.getElementById('driverFirstName') as HTMLInputElement | null;
            const driverLastNameFieldFinal = document.getElementById('driverLastName') as HTMLInputElement | null;
            
            const forceHideField = (field: HTMLInputElement | null) => {
                if (field) {
                    field.required = false;
                    field.removeAttribute('required');
                    field.disabled = false;
                    const formGroup = field.closest('.form-group') as HTMLElement | null;
                    if (formGroup) {
                        formGroup.style.display = 'none';
                        formGroup.style.visibility = 'hidden';
                    }
                }
            };
            
            forceHideField(checkNumberFieldFinal);
            forceHideField(checkNumberConfirmFieldFinal);
            forceHideField(driverFirstNameFieldFinal);
            forceHideField(driverLastNameFieldFinal);
        }
        
        // ABSOLUTE FINAL ENFORCEMENT: For Love's + Visa, ensure signature checkbox and copy type are ALWAYS visible
        // This runs at the very end to override any other logic that might hide them
        const isLovesVisaFinal = isLovesCompanyFinal && paymentMethod === 'Visa';
        
        if (isLovesVisaFinal) {
            const copyTypeRowFinal = document.getElementById('copyTypeRow') as HTMLElement | null;
            const copyTypeGroupFinal = document.getElementById('copyTypeGroup') as HTMLElement | null;
            const signatureCheckboxGroupFinal = document.getElementById('signatureCheckboxGroup') as HTMLElement | null;
            
            if (copyTypeRowFinal && copyTypeGroupFinal && signatureCheckboxGroupFinal) {
                // Ensure copy type row is visible
                copyTypeRowFinal.style.display = 'grid';
                
                // Ensure copy type group is visible and in copyTypeRow
                copyTypeGroupFinal.style.display = 'block';
                if (copyTypeGroupFinal.parentElement !== copyTypeRowFinal) {
                    copyTypeRowFinal.appendChild(copyTypeGroupFinal);
                }
                
                // Ensure signature checkbox is visible and in copyTypeRow (next to copy type)
                signatureCheckboxGroupFinal.style.display = 'flex';
                if (signatureCheckboxGroupFinal.parentElement !== copyTypeRowFinal) {
                    copyTypeRowFinal.appendChild(signatureCheckboxGroupFinal);
                }
                
                // Ensure copy type comes before signature checkbox
                if (copyTypeGroupFinal.parentElement === copyTypeRowFinal && 
                    signatureCheckboxGroupFinal.parentElement === copyTypeRowFinal) {
                    let copyTypeBeforeSignature = false;
                    let current = copyTypeGroupFinal.nextSibling;
                    while (current) {
                        if (current === signatureCheckboxGroupFinal) {
                            copyTypeBeforeSignature = true;
                            break;
                        }
                        current = current.nextSibling;
                    }
                    if (!copyTypeBeforeSignature) {
                        copyTypeRowFinal.insertBefore(copyTypeGroupFinal, signatureCheckboxGroupFinal);
                    }
                }
            }
        }
        
        // ABSOLUTE FINAL ENFORCEMENT: For Pilot + Master, ensure signature checkbox is ALWAYS visible and Vehicle ID/Company Name are in same row
        // This runs at the very end to override any other logic that might hide it
        const isPilotCompanyForMaster = selectedCompanyFinal && selectedCompanyFinal.name.toLowerCase().includes('pilot');
        const isPilotMasterFinal = isPilotCompanyForMaster && paymentMethod === 'Master';
        
        if (isPilotMasterFinal) {
            const efsRowFinal = document.getElementById('efsDetailsRow') as HTMLElement | null;
            const signatureCheckboxGroupFinal = document.getElementById('signatureCheckboxGroup') as HTMLElement | null;
            const companyNameGroupFinal = document.getElementById('companyNameGroup') as HTMLElement | null;
            const vehicleDetailsRowFinal = document.getElementById('vehicleDetailsRow') as HTMLElement | null;
            
            // Ensure vehicleDetailsRow is hidden (to avoid duplicate Vehicle ID)
            if (vehicleDetailsRowFinal) {
                vehicleDetailsRowFinal.style.display = 'none';
                // Explicitly remove required attribute from Vehicle ID in vehicleDetailsRow
                const vehicleIdFieldInVehicleDetailsRow = vehicleDetailsRowFinal.querySelector('#vehicleId') as HTMLInputElement | null;
                if (vehicleIdFieldInVehicleDetailsRow) {
                    vehicleIdFieldInVehicleDetailsRow.required = false;
                    vehicleIdFieldInVehicleDetailsRow.removeAttribute('required');
                    vehicleIdFieldInVehicleDetailsRow.disabled = true;
                }
            }
            
            // Ensure efsDetailsRow is visible
            if (efsRowFinal) {
                efsRowFinal.style.display = 'grid';
                
                // Get Vehicle ID from efsDetailsRow (not from vehicleDetailsRow)
                const vehicleIdInEfsRowFinal = efsRowFinal.querySelector('#vehicleId') as HTMLInputElement | null;
                const vehicleIdGroupInEfsRowFinal = vehicleIdInEfsRowFinal?.closest('.form-group') as HTMLElement | null;
                
                // Get Company Name field
                const companyNameFieldFinal = document.getElementById('driverCompanyName') as HTMLInputElement | null;
                
                // Clear Vehicle ID and Company Name values for Pilot + Master
                if (vehicleIdInEfsRowFinal) {
                    vehicleIdInEfsRowFinal.value = '';
                }
                if (companyNameFieldFinal) {
                    companyNameFieldFinal.value = '';
                }
                
                
                // Show Vehicle ID from efsDetailsRow
                if (vehicleIdGroupInEfsRowFinal) {
                    vehicleIdGroupInEfsRowFinal.style.display = 'block';
                }
                if (vehicleIdInEfsRowFinal) {
                    vehicleIdInEfsRowFinal.required = true;
                }
                
                // Ensure company name group is visible and in efsDetailsRow
                if (companyNameGroupFinal) {
                    companyNameGroupFinal.style.display = 'block';
                    if (companyNameGroupFinal.parentElement !== efsRowFinal) {
                        efsRowFinal.appendChild(companyNameGroupFinal);
                    }
                }
                
                // Ensure signature checkbox is visible and in efsDetailsRow
                if (signatureCheckboxGroupFinal) {
                    signatureCheckboxGroupFinal.style.display = 'flex';
                    if (signatureCheckboxGroupFinal.parentElement !== efsRowFinal) {
                        efsRowFinal.appendChild(signatureCheckboxGroupFinal);
                    }
                }
                
                // Ensure correct order: Vehicle ID -> Company Name (in same row), Signature Checkbox (on new line)
                if (vehicleIdGroupInEfsRowFinal && companyNameGroupFinal && signatureCheckboxGroupFinal) {
                    // Remove all from row first
                    if (vehicleIdGroupInEfsRowFinal.parentElement === efsRowFinal) efsRowFinal.removeChild(vehicleIdGroupInEfsRowFinal);
                    if (companyNameGroupFinal.parentElement === efsRowFinal) efsRowFinal.removeChild(companyNameGroupFinal);
                    if (signatureCheckboxGroupFinal.parentElement === efsRowFinal) efsRowFinal.removeChild(signatureCheckboxGroupFinal);
                    
                    // Add Vehicle ID and Company Name in same row first
                    efsRowFinal.appendChild(vehicleIdGroupInEfsRowFinal);
                    efsRowFinal.appendChild(companyNameGroupFinal);
                    
                    // Ensure efsRow uses grid layout (same as other form-rows)
                    // For Pilot + Master, use equal-width columns so Vehicle ID and Company Name take equal space
                    efsRowFinal.style.display = 'grid';
                    efsRowFinal.style.gridTemplateColumns = '1fr 1fr';
                    efsRowFinal.style.gap = '20px';
                    
                    // Ensure Vehicle ID and Company Name form-groups take full width of their grid columns
                    // Match the spacing and width of Card Last 4 Digits and Card Entry Method
                    vehicleIdGroupInEfsRowFinal.style.width = '100%';
                    vehicleIdGroupInEfsRowFinal.style.maxWidth = '100%';
                    vehicleIdGroupInEfsRowFinal.style.minWidth = '0';
                    vehicleIdGroupInEfsRowFinal.style.marginTop = '0';
                    vehicleIdGroupInEfsRowFinal.style.marginLeft = '0';
                    vehicleIdGroupInEfsRowFinal.style.marginRight = '0';
                    // Keep default form-group margin-bottom for proper spacing (24px)
                    vehicleIdGroupInEfsRowFinal.style.marginBottom = '24px';
                    
                    companyNameGroupFinal.style.width = '100%';
                    companyNameGroupFinal.style.maxWidth = '100%';
                    companyNameGroupFinal.style.minWidth = '0';
                    companyNameGroupFinal.style.marginTop = '0';
                    companyNameGroupFinal.style.marginLeft = '0';
                    companyNameGroupFinal.style.marginRight = '0';
                    // Keep default form-group margin-bottom for proper spacing (24px)
                    companyNameGroupFinal.style.marginBottom = '24px';
                    
                    // Ensure the input fields inside also take full width
                    const vehicleIdInputFinal = vehicleIdGroupInEfsRowFinal.querySelector('input') as HTMLInputElement | null;
                    const companyNameInputFinal = companyNameGroupFinal.querySelector('input') as HTMLInputElement | null;
                    if (vehicleIdInputFinal) {
                        vehicleIdInputFinal.style.width = '100%';
                        vehicleIdInputFinal.style.maxWidth = '100%';
                        vehicleIdInputFinal.style.boxSizing = 'border-box';
                    }
                    if (companyNameInputFinal) {
                        companyNameInputFinal.style.width = '100%';
                        companyNameInputFinal.style.maxWidth = '100%';
                        companyNameInputFinal.style.boxSizing = 'border-box';
                    }
                    
                    // Add signature checkbox on new line (after Vehicle ID and Company Name)
                    efsRowFinal.appendChild(signatureCheckboxGroupFinal);
                    
                    // Make signature checkbox take full width (new line) and minimize vertical gap
                    signatureCheckboxGroupFinal.style.width = '100%';
                    signatureCheckboxGroupFinal.style.gridColumn = '1 / -1';
                    // Use negative margin to minimize gap (form-row has 20px gap, so we compensate)
                    signatureCheckboxGroupFinal.style.marginTop = '-10px'; // Reduce gap from 20px to ~10px
                    signatureCheckboxGroupFinal.style.marginBottom = '0';
                    signatureCheckboxGroupFinal.style.marginLeft = '0';
                    signatureCheckboxGroupFinal.style.marginRight = '0';
                    signatureCheckboxGroupFinal.style.paddingTop = '0';
                    signatureCheckboxGroupFinal.style.paddingBottom = '0';
                    // Override any default form-group margin
                    signatureCheckboxGroupFinal.style.setProperty('margin-top', '-10px', 'important');
                    signatureCheckboxGroupFinal.style.setProperty('margin-bottom', '0', 'important');
                }
            }
        }
    }
    
    // Always ensure all vehicleId fields are properly handled (remove required from hidden ones)
    handleAllVehicleIdFields();
}

// Filter companies by selected country
function filterCompaniesByCountry(): void {
    const countrySelect = document.getElementById('country') as HTMLSelectElement;
    const companySelect = document.getElementById('designId') as HTMLSelectElement;
    
    if (!countrySelect || !companySelect) return;
    
    const selectedCountry = countrySelect.value;
    
    if (!selectedCountry) {
        // No country selected, disable company dropdown
        companySelect.innerHTML = '';
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = '-- Select a Country First --';
        placeholderOption.disabled = true;
        placeholderOption.selected = true;
        companySelect.appendChild(placeholderOption);
        companySelect.disabled = true;
        return;
    }
    
    // Filter companies by selected country
    let filteredCompanies = companies.filter(c => c.country === selectedCountry);
    // When Canada is selected, exclude Pearson Mart Esso and BVD Petroleum Vancouver
    if (selectedCountry === 'Canada') {
        filteredCompanies = filteredCompanies.filter(c => {
            const n = c.name.toLowerCase();
            return !(n.includes('pearson mart esso') || n.includes('bvd petroleum vancouver'));
        });
    }
    
    // Populate company dropdown with filtered companies
    companySelect.innerHTML = '';
    companySelect.disabled = false;
    
    // Add placeholder
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = '-- Select a Company --';
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    companySelect.appendChild(placeholderOption);
    
    // Add filtered companies
    filteredCompanies.forEach((company: CompanyData) => {
        const option = document.createElement('option');
        option.value = company.id.toString();
        option.textContent = company.name;
        companySelect.appendChild(option);
    });
    
    if (filteredCompanies.length === 0) {
        const noCompaniesOption = document.createElement('option');
        noCompaniesOption.value = '';
        noCompaniesOption.textContent = '-- No Companies Available --';
        noCompaniesOption.disabled = true;
        companySelect.appendChild(noCompaniesOption);
    }
    
    // Hide store selection when country changes
    const storeSelectionGroup = document.getElementById('storeSelectionGroup');
    if (storeSelectionGroup) {
        storeSelectionGroup.style.display = 'none';
    }
    
    // Reset items when country changes
    companyItems = [];
    updateAllItemDropdowns();
    
    // Update unit labels when country changes
    updateAllItemUnitLabels();
}

// Load stores for selected company
async function loadStoresForSelectedCompany(): Promise<void> {
    const companySelect = document.getElementById('designId') as HTMLSelectElement;
    const storeSelectionGroup = document.getElementById('storeSelectionGroup');
    const storeSelect = document.getElementById('storeId') as HTMLSelectElement;
    const storeSearch = document.getElementById('storeSearch') as HTMLInputElement;
    
    if (!companySelect || !storeSelectionGroup || !storeSelect) return;
    
    const companyId = parseInt(companySelect.value);
    
    if (!companyId) {
        // No company selected, hide store selection
        storeSelectionGroup.style.display = 'none';
        return;
    }
    
    // Get selected company
    const selectedCompany = companies.find(c => c.id === companyId);
    
    // Show store selection for both USA and Canadian companies
    if (!selectedCompany || (selectedCompany.country !== 'United States of America' && selectedCompany.country !== 'Canada')) {
        storeSelectionGroup.style.display = 'none';
        return;
    }
    
    try {
        // Fetch stores for this company
        const response = await fetch(`/api/companies/${companyId}/stores`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.stores && data.stores.length > 0) {
            stores = data.stores;
            
            // Show store selection
            storeSelectionGroup.style.display = 'block';
            
            // Populate store dropdown
            populateStoreDropdown(stores);
            
            // Setup store search filter
            if (storeSearch) {
                // Remove old event listener
                const newStoreSearch = storeSearch.cloneNode(true) as HTMLInputElement;
                storeSearch.parentNode?.replaceChild(newStoreSearch, storeSearch);
                
                newStoreSearch.addEventListener('input', function() {
                    const searchTerm = this.value.toLowerCase();
                    const filteredStores = stores.filter((store: StoreData) => {
                        const storeText = `${store.storeCode} ${store.cityState} ${store.address}`.toLowerCase();
                        return storeText.includes(searchTerm);
                    });
                    populateStoreDropdown(filteredStores);
                });
            }
        } else {
            // No stores found, hide selection
            storeSelectionGroup.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading stores:', error);
        storeSelectionGroup.style.display = 'none';
    }
}

// Helper function to populate store dropdown
function populateStoreDropdown(storeList: StoreData[]): void {
    const storeSelect = document.getElementById('storeId') as HTMLSelectElement;
    if (!storeSelect) return;
    
    storeSelect.innerHTML = '';
    
    if (storeList.length === 0) {
        const noResultsOption = document.createElement('option');
        noResultsOption.value = '';
        noResultsOption.textContent = '-- No stores found --';
        noResultsOption.disabled = true;
        storeSelect.appendChild(noResultsOption);
        return;
    }
    
    // Add stores
    storeList.forEach((store: StoreData) => {
        const option = document.createElement('option');
        option.value = store.id.toString();
        option.textContent = `${store.storeCode} - ${store.cityState}`;
        storeSelect.appendChild(option);
    });
}

// Load items for selected company
async function loadItemsForSelectedCompany(): Promise<void> {
    const companySelect = document.getElementById('designId') as HTMLSelectElement;
    
    if (!companySelect) return;
    
    const companyId = parseInt(companySelect.value);
    
    if (!companyId) {
        // No company selected, reset to default items
        companyItems = [];
        updateAllItemDropdowns();
        return;
    }
    
    // Get selected company
    const selectedCompany = companies.find(c => c.id === companyId);
    
    // Load custom items for both USA and Canadian companies
    if (!selectedCompany || (selectedCompany.country !== 'United States of America' && selectedCompany.country !== 'Canada')) {
        companyItems = [];
        updateAllItemDropdowns();
        return;
    }
    
    // Special case: Husky company uses a fixed set of items
    if (selectedCompany.name.toLowerCase().includes('husky')) {
        companyItems = ['DSL EFF', 'RETAIL BULK DEF', 'PREPAY FUEL'];
        updateAllItemDropdowns();
        return;
    }
    
    try {
        // Fetch items for this company
        const response = await fetch(`/api/companies/${companyId}/items`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        console.log('Loaded items for company:', selectedCompany.name, data.items);
        
        if (data.items && data.items.length > 0) {
            companyItems = data.items;
            console.log('Company items set to:', companyItems);
        } else {
            // No items found, use default
            companyItems = [];
            console.log('No items found, using defaults');
        }
        
        // Update all existing item dropdowns
        updateAllItemDropdowns();
    } catch (error) {
        console.error('Error loading items:', error);
        companyItems = [];
        updateAllItemDropdowns();
    }
}

// Update all item dropdowns with current companyItems
function updateAllItemDropdowns(): void {
    const itemRows = document.querySelectorAll('.item-row');
    const currentItems = companyItems.length > 0 ? companyItems : ['Diesel', 'Premium', 'Regular', 'Super', 'Mid-Grade'];
    
    itemRows.forEach((row) => {
        const select = row.querySelector('.item-name') as HTMLSelectElement;
        if (select) {
            const currentValue = select.value;
            
            // Rebuild options
            select.innerHTML = '';
            
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = '-- Select Item --';
            select.appendChild(placeholderOption);
            
            currentItems.forEach((item: string) => {
                const option = document.createElement('option');
                option.value = item;
                option.textContent = item;
                select.appendChild(option);
            });
            
            // Restore previous value if it exists in new options
            if (currentValue && currentItems.includes(currentValue)) {
                select.value = currentValue;
            }
        }
    });
}

// Handle company selection from dropdown
function handleCompanySelection(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const selectedOption = select.selectedOptions[0];
    
    if (!selectedOption || !selectedOption.value) return;
    
    const companyId = parseInt(selectedOption.value);
    const company = companies.find(c => c.id === companyId);
    
    // Company is now used directly from the database, no need to auto-fill
    if (company) {
        console.log(`Selected company: ${company.name} (${company.businessType})`);
    }
    
    // Update field visibility based on company and payment method
    toggleCardFields();
    
    // Update quantity field visibility for all item rows when company changes
    updateAllItemUnitLabels();
}

// Get current country for unit display
function getCurrentCountry(): string {
    const countrySelect = document.getElementById('country') as HTMLSelectElement;
    return countrySelect?.value || '';
}

// Get selected company
function getSelectedCompany(): { name: string } | null {
    const companySelect = document.getElementById('designId') as HTMLSelectElement;
    const selectedOption = companySelect?.selectedOptions[0];
    if (selectedOption && selectedOption.value) {
        return { name: selectedOption.textContent || '' };
    }
    return null;
}

// Get unit labels based on country
function getUnitLabels(): { volume: string, pricePer: string } {
    const country = getCurrentCountry();
    if (country === 'Canada') {
        return { volume: 'Liters', pricePer: '$ / L' };
    } else {
        return { volume: 'Gallons', pricePer: 'Price/Gal' };
    }
}

// Update unit labels for all existing item rows
function updateAllItemUnitLabels(): void {
    const itemRows = document.querySelectorAll('.item-row');
    const labels = getUnitLabels();
    const country = getCurrentCountry();
    
    // Check if BVD Petroleum or Loves company is selected
    const selectedCompany = getSelectedCompany();
    const isBVDPetroleum = selectedCompany && selectedCompany.name.toLowerCase().includes('bvd petroleum');
    const isLovesCompany = selectedCompany && (selectedCompany.name.toLowerCase().includes('love') || selectedCompany.name.toLowerCase().includes("love's"));
    
    itemRows.forEach((row) => {
        // Update gallons/liters label
        const gallonsLabel = row.querySelector('.form-group:nth-child(4) label') as HTMLLabelElement;
        if (gallonsLabel) {
            gallonsLabel.textContent = `${labels.volume} *`;
        }
        
        // Update input placeholder
        const gallonsInput = row.querySelector('.item-gallons') as HTMLInputElement;
        if (gallonsInput) {
            gallonsInput.placeholder = country === 'Canada' ? '40.0' : '10.5';
        }
        
        // Handle quantity and pump field visibility for BVD Petroleum
        const qtyGroup = row.querySelector('.form-group:nth-child(2)') as HTMLElement;
        const qtyInput = row.querySelector('.item-qty') as HTMLInputElement;
        const pumpGroup = row.querySelector('.form-group:nth-child(3)') as HTMLElement;
        const pumpInput = row.querySelector('.item-pump') as HTMLInputElement;
        
        // Update labels for BVD Petroleum
        const volumeLabel = row.querySelector('.form-group:nth-child(4) label') as HTMLLabelElement;
        const priceLabel = row.querySelector('.form-group:nth-child(5) label') as HTMLLabelElement;
        
        // Hide pump field for all companies - generate random pump numbers
        if (pumpGroup) pumpGroup.style.display = 'none';
        if (pumpInput) {
            pumpInput.removeAttribute('required');
            pumpInput.value = '';
        }
        
        if (isBVDPetroleum) {
            // Hide quantity field for BVD Petroleum
            if (qtyGroup) qtyGroup.style.display = 'none';
            if (qtyInput) {
                qtyInput.removeAttribute('required');
                qtyInput.value = '';
            }
            // Update labels for BVD Petroleum
            if (volumeLabel) volumeLabel.textContent = 'Volume *';
            if (priceLabel) priceLabel.textContent = 'Unit Price *';
        } else if (isLovesCompany) {
            // Hide quantity field for Loves company
            if (qtyGroup) qtyGroup.style.display = 'none';
            if (qtyInput) {
                qtyInput.removeAttribute('required');
                qtyInput.value = '';
            }
            // Use standard labels for Loves
            if (volumeLabel) volumeLabel.textContent = `${labels.volume} *`;
            if (priceLabel) priceLabel.textContent = `${labels.pricePer} *`;
        } else {
            // Show quantity field for other companies
            if (qtyGroup) qtyGroup.style.display = 'block';
            if (qtyInput) qtyInput.setAttribute('required', 'required');
            // Use standard labels for other companies
            if (volumeLabel) volumeLabel.textContent = `${labels.volume} *`;
            if (priceLabel) priceLabel.textContent = `${labels.pricePer} *`;
        }
    });
}

// Add new item row
function addItem(): void {
    itemCount++;
    const itemsList = document.getElementById('itemsList');
    if (!itemsList) return;
    
    const itemRow = document.createElement('div');
    itemRow.className = 'item-row';
    itemRow.id = `item-${itemCount}`;
    
    // Get current items to populate dropdown
    const currentItems = companyItems.length > 0 ? companyItems : ['Diesel', 'Premium', 'Regular', 'Super', 'Mid-Grade'];
    
    console.log('Adding item with items:', currentItems);
    console.log('companyItems array:', companyItems);
    
    // Get unit labels based on current country
    const labels = getUnitLabels();
    const country = getCurrentCountry();
    
    // Check if BVD Petroleum company is selected
    const selectedCompany = getSelectedCompany();
    const isBVDPetroleum = selectedCompany && selectedCompany.name.toLowerCase().includes('bvd petroleum');
    const isLovesCompany = selectedCompany && (selectedCompany.name.toLowerCase().includes('love') || selectedCompany.name.toLowerCase().includes("love's"));
    const isHuskyCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('husky');
    
    // Build options HTML
    let optionsHTML = '<option value="">-- Select Item --</option>';
    currentItems.forEach((item: string) => {
        optionsHTML += `<option value="${item}">${item}</option>`;
    });
    
    itemRow.innerHTML = `
        <div class="form-group">
            <label>Item Name *</label>
            <select class="item-name form-select" required>
                ${optionsHTML}
            </select>
        </div>
        <div class="form-group" ${isBVDPetroleum || isLovesCompany ? 'style="display: none;"' : ''}>
            <label>Quantity *</label>
            <input type="text" class="item-qty" placeholder="1" inputmode="numeric" ${isBVDPetroleum || isLovesCompany ? '' : 'required'}>
        </div>
           <div class="form-group" style="display: none;">
            <label>Pump *</label>
               <input type="text" class="item-pump" placeholder="1" inputmode="numeric">
        </div>
        <div class="form-group">
            <label>${isBVDPetroleum ? 'Volume *' : labels.volume + ' *'}</label>
            <input type="text" class="item-gallons" placeholder="${country === 'Canada' ? '40.0' : '10.5'}" inputmode="decimal" required>
        </div>
        <div class="form-group">
            <label>${isBVDPetroleum ? 'Unit Price *' : labels.pricePer + ' *'}</label>
            <input type="text" class="item-price-per-gal" placeholder="3.50" inputmode="decimal" required>
        </div>
        <button type="button" class="btn btn-danger" onclick="removeItem(${itemCount})">🗑️</button>
    `;
    
    itemsList.appendChild(itemRow);
    
    // Add input validation for numeric fields
    const qtyInput = itemRow.querySelector('.item-qty') as HTMLInputElement;
    const pumpInput = itemRow.querySelector('.item-pump') as HTMLInputElement;
    const gallonsInput = itemRow.querySelector('.item-gallons') as HTMLInputElement;
    const priceInput = itemRow.querySelector('.item-price-per-gal') as HTMLInputElement;
    const itemSelect = itemRow.querySelector('.item-name') as HTMLSelectElement;
    
    // Add event listener for item selection to handle cash advance and BVD Petroleum
    if (itemSelect) {
        itemSelect.addEventListener('change', function(e) {
            const target = e.target as HTMLSelectElement;
            const selectedItem = target.value.toLowerCase();
            const isCashAdvance = selectedItem.includes('cash advance');
            
            // Check selected company flags
            const selectedCompany = getSelectedCompany();
            const isBVDPetroleum = selectedCompany && selectedCompany.name.toLowerCase().includes('bvd petroleum');
            const isLovesCompany = selectedCompany && (selectedCompany.name.toLowerCase().includes('love') || selectedCompany.name.toLowerCase().includes("love's"));
            const isHuskyCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('husky');
            const isFlyingJCanada = selectedCompany && selectedCompany.name.toLowerCase().includes('flying j') && getCurrentCountry() === 'Canada';
            
            // Get the form groups for quantity, pump, gallons, and price/gal
            let qtyGroup = itemRow.querySelector('.form-group:nth-child(2)') as HTMLElement | null;
            const pumpGroup = itemRow.querySelector('.form-group:nth-child(3)') as HTMLElement | null;
            const gallonsGroup = itemRow.querySelector('.form-group:nth-child(4)') as HTMLElement | null;
            const priceGroup = itemRow.querySelector('.form-group:nth-child(5)') as HTMLElement | null;
            // Fallback: locate group via the input itself
            if (!qtyGroup) {
                const qtyEl = itemRow.querySelector('.item-qty') as HTMLElement | null;
                qtyGroup = qtyEl ? (qtyEl.closest('.form-group') as HTMLElement | null) : null;
            }
            
            if (isCashAdvance) {
                // For Cash Advance: Change quantity label to "Price" and show field
                if (qtyGroup) {
                    qtyGroup.style.display = 'block';
                    // Change label from "Quantity" to "Price"
                    const qtyLabel = qtyGroup.querySelector('label');
                    if (qtyLabel) qtyLabel.textContent = 'Price *';
                }
                if (qtyInput) {
                    qtyInput.setAttribute('required', 'required');
                    // Change placeholder to show it's for price
                    qtyInput.placeholder = '0.00';
                    // Clear the value so user can enter price
                    if (qtyInput.value === '1') {
                        qtyInput.value = '';
                    }
                }
                // Hide other item inputs
                if (pumpGroup) pumpGroup.style.display = 'none';
                if (gallonsGroup) gallonsGroup.style.display = 'none';
                if (priceGroup) priceGroup.style.display = 'none';
                // Clear and remove required
                if (pumpInput) { pumpInput.value = ''; pumpInput.removeAttribute('required'); }
                if (gallonsInput) { gallonsInput.value = ''; gallonsInput.removeAttribute('required'); }
                if (priceInput) { priceInput.value = ''; priceInput.removeAttribute('required'); }
            } else {
                // For non-cash advance items: Reset quantity label and behavior
                if (qtyGroup) {
                    const qtyLabel = qtyGroup.querySelector('label');
                    if (qtyLabel) qtyLabel.textContent = 'Quantity *';
                }
                if (qtyInput) {
                    qtyInput.placeholder = '1';
                }
                
                if (isBVDPetroleum) {
                // For BVD Petroleum, hide quantity and pump, show volume and unit price
                if (qtyGroup) qtyGroup.style.display = 'none';
                if (pumpGroup) pumpGroup.style.display = 'none';
                if (gallonsGroup) gallonsGroup.style.display = 'block';
                if (priceGroup) priceGroup.style.display = 'block';
                
                // Clear quantity and pump values, keep volume and price
                if (qtyInput) {
                    qtyInput.value = '';
                    qtyInput.removeAttribute('required');
                }
                if (pumpInput) {
                    pumpInput.value = '';
                    pumpInput.removeAttribute('required');
                }
                if (gallonsInput) gallonsInput.setAttribute('required', 'required');
                if (priceInput) priceInput.setAttribute('required', 'required');
            } else if (isLovesCompany) {
                // For Loves, hide quantity field when item is selected, show volume and price
                if (qtyGroup) qtyGroup.style.display = 'none';
                if (pumpGroup) pumpGroup.style.display = 'none';
                if (gallonsGroup) gallonsGroup.style.display = 'block';
                if (priceGroup) priceGroup.style.display = 'block';
                
                // Clear quantity value
                if (qtyInput) {
                    qtyInput.value = '';
                    qtyInput.removeAttribute('required');
                }
                if (pumpInput) {
                    pumpInput.value = '';
                    pumpInput.removeAttribute('required');
                }
                if (gallonsInput) gallonsInput.setAttribute('required', 'required');
                if (priceInput) priceInput.setAttribute('required', 'required');
            } else {
                // Show quantity, gallons, and price fields for regular items in other companies
                // Hide pump field for all companies - generate random pump numbers
                if (qtyGroup) qtyGroup.style.display = 'block';
                if (pumpGroup) pumpGroup.style.display = 'none';
                if (gallonsGroup) gallonsGroup.style.display = 'block';
                if (priceGroup) priceGroup.style.display = 'block';
                
                // Add back required attribute for visible fields
                if (qtyInput) qtyInput.setAttribute('required', 'required');
                if (pumpInput) {
                    pumpInput.value = '';
                    pumpInput.removeAttribute('required');
                }
                if (gallonsInput) gallonsInput.setAttribute('required', 'required');
                if (priceInput) priceInput.setAttribute('required', 'required');
                }
            }
            
            updateTotal();
        });
    }
    
    if (qtyInput) {
        qtyInput.addEventListener('input', function(e) {
            const target = e.target as HTMLInputElement;
            const itemSelect = itemRow.querySelector('.item-name') as HTMLSelectElement;
            const selectedItem = itemSelect?.value.toLowerCase() || '';
            const isCashAdvance = selectedItem.includes('cash advance');
            
            if (isCashAdvance) {
                // For cash advance, allow decimals (like price input)
                target.value = target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
            } else {
                // For regular items, only allow integers
            target.value = target.value.replace(/[^0-9]/g, '');
            }
        });
        qtyInput.addEventListener('change', updateTotal);
    }
    
    if (pumpInput) {
        pumpInput.addEventListener('input', function(e) {
            const target = e.target as HTMLInputElement;
            target.value = target.value.replace(/[^0-9]/g, '');
        });
        pumpInput.addEventListener('change', updateTotal);
    }
    
    if (gallonsInput) {
        gallonsInput.addEventListener('input', function(e) {
            const target = e.target as HTMLInputElement;
            // Allow digits and one decimal point
            target.value = target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        });
        gallonsInput.addEventListener('change', updateTotal);
    }
    
    if (priceInput) {
        priceInput.addEventListener('input', function(e) {
            const target = e.target as HTMLInputElement;
            // Allow digits and one decimal point
            target.value = target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        });
        priceInput.addEventListener('change', updateTotal);
    }
    
    updateTotal();
}

// Remove item row
function removeItem(id: number): void {
    const itemRow = document.getElementById(`item-${id}`);
    if (itemRow) {
        itemRow.remove();
        updateTotal();
    }
}

// Make removeItem available globally for onclick handler
(window as any).removeItem = removeItem;

// Update total preview
function updateTotal(): void {
    const items = document.querySelectorAll('.item-row');
    let subtotal = 0;
    
    items.forEach((item) => {
        const nameInput = item.querySelector('.item-name') as HTMLSelectElement;
        const qtyInput = item.querySelector('.item-qty') as HTMLInputElement;
        const gallonsInput = item.querySelector('.item-gallons') as HTMLInputElement;
        const pricePerGalInput = item.querySelector('.item-price-per-gal') as HTMLInputElement;
        
        const name = nameInput?.value;
        const qty = parseFloat(qtyInput?.value || '0') || 0;
        const gallons = parseFloat(gallonsInput?.value || '0') || 0;
        const pricePerGal = parseFloat(pricePerGalInput?.value || '0') || 0;
        
        // Check if this is a cash advance item
        const isCashAdvance = name && name.toLowerCase().includes('cash advance');
        
        if (isCashAdvance) {
            // For cash advance, quantity field is actually the price
            // Total = price * 1 (quantity is hardcoded to 1)
            const price = parseFloat(qtyInput?.value || '0') || 0;
            subtotal += price;
        } else {
            // For regular items, calculate gallons * price per gallon
            subtotal += gallons * pricePerGal;
        }
    });
    
    // No tax in preview
    const total = subtotal;
    
    const subtotalEl = document.getElementById('subtotalPreview');
    const taxEl = document.getElementById('taxPreview');
    const totalEl = document.getElementById('totalPreview');
    
    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (taxEl) taxEl.textContent = '';
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
}

// Generate receipt
// Helper function to remove required attribute from hidden fields
function removeRequiredFromHiddenFields(): void {
    // Get the form element
    const form = document.getElementById('receiptForm') as HTMLFormElement;
    if (!form) return;
    
    // Helper function to check if an element or any of its ancestors is hidden
    function isElementOrAncestorHidden(element: HTMLElement): boolean {
        // Check the element itself
        const elementStyle = window.getComputedStyle(element);
        if (elementStyle.display === 'none' || elementStyle.visibility === 'hidden') {
            return true;
        }
        
        // Check inline styles on the element
        if (element.style.display === 'none' || element.style.visibility === 'hidden') {
            return true;
        }
        
        // Check all ancestors up to the form
        let parent = element.parentElement;
        while (parent && parent !== form && parent !== document.body) {
            const parentStyle = window.getComputedStyle(parent);
            if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
                return true;
            }
            if (parent.style.display === 'none' || parent.style.visibility === 'hidden') {
                return true;
            }
            parent = parent.parentElement;
        }
        
        return false;
    }
    
    // Find all required fields (inputs, selects, textareas)
    const allRequiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');
    
    allRequiredFields.forEach(field => {
        const element = field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        
        // Check if field or any ancestor is hidden
        if (isElementOrAncestorHidden(element)) {
            element.required = false;
            element.removeAttribute('required');
        }
    });
    
    // Also check for disabled fields (they can't be focused for validation)
    const allDisabledFields = form.querySelectorAll('input[disabled], select[disabled], textarea[disabled]');
    allDisabledFields.forEach(field => {
        const element = field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        if (element.required) {
            element.required = false;
            element.removeAttribute('required');
        }
    });
    
    // Final safety check: Remove required from any field that can't be focused
    // This handles edge cases where fields might be technically "visible" but not focusable
    const allRequiredFieldsFinal = form.querySelectorAll('input[required], select[required], textarea[required]');
    allRequiredFieldsFinal.forEach(field => {
        const element = field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        
        // If any ancestor is hidden, the field cannot be focused
        if (isElementOrAncestorHidden(element)) {
            element.required = false;
            element.removeAttribute('required');
            return;
        }
        
        // Check if offsetParent is null (field is not in rendering tree - not focusable)
        // This is the most reliable indicator that a field cannot be focused
        if ((element as HTMLElement).offsetParent === null) {
            element.required = false;
            element.removeAttribute('required');
            return;
        }
        
        // Also check if the field has zero dimensions (effectively hidden)
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            element.required = false;
            element.removeAttribute('required');
        }
    });
}

async function generateReceipt(e: Event): Promise<void> {
    e.preventDefault(); // Prevent default form submission first
    // Handle all vehicleId fields first (ensure hidden ones don't have required)
    handleAllVehicleIdFields();
    // Remove required attribute from hidden fields before form validation
    removeRequiredFromHiddenFields();
    
    // Explicit check for driverCompanyName field - ensure it's not required if hidden or not focusable
    const driverCompanyNameField = document.getElementById('driverCompanyName') as HTMLInputElement | null;
    if (driverCompanyNameField && driverCompanyNameField.required) {
        // Check if field or any parent is hidden
        const fieldStyle = window.getComputedStyle(driverCompanyNameField);
        const isFieldHidden = fieldStyle.display === 'none' || fieldStyle.visibility === 'hidden';
        
        // Check if field has zero dimensions (effectively hidden)
        const rect = driverCompanyNameField.getBoundingClientRect();
        const hasZeroDimensions = rect.width === 0 || rect.height === 0;
        
        // Check if offsetParent is null (field is not in rendering tree - not focusable)
        const isNotInRenderingTree = driverCompanyNameField.offsetParent === null;
        
        // Check parent containers - specifically check efsDetailsRow and companyNameGroup
        const companyNameGroup = document.getElementById('companyNameGroup') as HTMLElement | null;
        const efsDetailsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
        const isCompanyNameGroupHidden = companyNameGroup ? 
            (window.getComputedStyle(companyNameGroup).display === 'none' || 
             window.getComputedStyle(companyNameGroup).visibility === 'hidden' ||
             companyNameGroup.style.display === 'none' ||
             companyNameGroup.style.visibility === 'hidden') : false;
        const isEfsRowHidden = efsDetailsRow ? 
            (window.getComputedStyle(efsDetailsRow).display === 'none' || 
             window.getComputedStyle(efsDetailsRow).visibility === 'hidden' ||
             efsDetailsRow.style.display === 'none' ||
             efsDetailsRow.style.visibility === 'hidden') : false;
        
        // Check all parent containers
        let parent = driverCompanyNameField.parentElement;
        let isParentHidden = false;
        while (parent && parent !== document.body) {
            const parentStyle = window.getComputedStyle(parent);
            if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden' || 
                parent.style.display === 'none' || parent.style.visibility === 'hidden') {
                isParentHidden = true;
                break;
            }
            parent = parent.parentElement;
        }
        
        // If field is hidden in any way OR not focusable, remove required
        if (isFieldHidden || hasZeroDimensions || isNotInRenderingTree || isParentHidden || 
            isCompanyNameGroupHidden || isEfsRowHidden) {
            driverCompanyNameField.required = false;
            driverCompanyNameField.removeAttribute('required');
        }
    }
    
    console.log('Generate receipt function called');
    
    // Get current selections to check for Husky + Visa combination
    const paymentMethodInput = document.getElementById('paymentMethod') as HTMLSelectElement;
    const designIdInput = document.getElementById('designId') as HTMLSelectElement;
    const countryInput = document.getElementById('country') as HTMLSelectElement;
    
    const paymentMethod = paymentMethodInput?.value;
    const selectedCompanyId = designIdInput?.value ? parseInt(designIdInput.value) : null;
    const country = countryInput?.value;
    const selectedCompany = selectedCompanyId ? companies.find(c => c.id === selectedCompanyId) : null;
    
    const isHuskyCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('husky');
    const isPetroCanadaCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('petro-canada');
    const isBVDPetroleumCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('bvd petroleum');
    const isAnyCanadaCompany = selectedCompany && selectedCompany.country === 'Canada';
    const isHuskyVisa = isHuskyCompany && (paymentMethod === 'Visa' || paymentMethod === 'Master' || paymentMethod === 'Mastercard' || paymentMethod === 'Interac' || paymentMethod === 'American Express' || paymentMethod === 'EFS' || paymentMethod === 'TCH');
    const isPetroCanadaAny = isPetroCanadaCompany; // Skip validation for any payment method
    const isBVDPetroleumAny = isBVDPetroleumCompany; // Skip validation for any payment method
    
    console.log('Form submission check:', { isHuskyCompany, isPetroCanadaCompany, isBVDPetroleumCompany, paymentMethod, isHuskyVisa, isPetroCanadaAny, isBVDPetroleumAny });
    
    // For Husky + Visa combinations, Petro-Canada + any payment method, and BVD Petroleum + any payment method, skip form validation entirely
    if (!isHuskyVisa && !isPetroCanadaAny && !isBVDPetroleumAny) {
        // Check if form is valid before proceeding for other combinations
        const form = document.getElementById('receiptForm') as HTMLFormElement;
        
        // Temporarily disable validation for hidden/disabled fields
        const hiddenFields = form.querySelectorAll('input[disabled], select[disabled]');
        // Additionally, disable any fields inside hidden groups/rows (includes Company Name row when hidden)
        const hiddenGroups = form.querySelectorAll('[style*="display: none"] input, [style*="display: none"] select');
        const allHidden = Array.from(hiddenFields).concat(Array.from(hiddenGroups));
        allHidden.forEach(field => {
            const input = field as HTMLInputElement | HTMLSelectElement;
            input.setAttribute('data-original-required', input.required.toString());
            input.required = false;
        });
        
        if (!form.checkValidity()) {
            console.log('Form validation failed');
            form.reportValidity();
            
            // Restore original required state
            allHidden.forEach(field => {
                const input = field as HTMLInputElement | HTMLSelectElement;
                const originalRequired = input.getAttribute('data-original-required') === 'true';
                input.required = originalRequired;
                input.removeAttribute('data-original-required');
            });
            return;
        }
        
        // Restore original required state
        allHidden.forEach(field => {
            const input = field as HTMLInputElement | HTMLSelectElement;
            const originalRequired = input.getAttribute('data-original-required') === 'true';
            input.required = originalRequired;
            input.removeAttribute('data-original-required');
        });
    }
    
    const btn = document.getElementById('generateBtn') as HTMLButtonElement;
    if (!btn) {
        console.error('Generate button not found');
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Generating...';
    
    try {
        // Collect form data
        const dateInput = document.getElementById('date') as HTMLInputElement;
        const paymentMethodInput = document.getElementById('paymentMethod') as HTMLSelectElement;
        const cardLast4Input = document.getElementById('cardLast4') as HTMLInputElement;
        const cardEntryMethodInput = document.getElementById('cardEntryMethod') as HTMLSelectElement;
        const designIdInput = document.getElementById('designId') as HTMLSelectElement;
        const countryInput = document.getElementById('country') as HTMLSelectElement;
        
        const selectedCompanyId = designIdInput?.value ? parseInt(designIdInput.value) : null;
        
        if (!selectedCompanyId) {
            alert('Please select a company');
            btn.disabled = false;
            btn.textContent = 'Generate Receipt 🧾';
            return;
        }
        
        if (!countryInput?.value) {
            alert('Please select a country');
            btn.disabled = false;
            btn.textContent = 'Generate Receipt 🧾';
            return;
        }
        
        // Get selected store if any
        const storeSelect = document.getElementById('storeId') as HTMLSelectElement;
        const selectedStoreId = storeSelect?.value ? parseInt(storeSelect.value) : null;
        const selectedStore = selectedStoreId ? stores.find(s => s.id === selectedStoreId) : null;
        
        // Get vehicle details
        // For Pilot + Master, Vehicle ID is in efsDetailsRow, so check both locations
        let vehicleIdInput = document.getElementById('vehicleId') as HTMLInputElement;
        const isPilotCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('pilot');
        const paymentMethod = paymentMethodInput?.value || 'Cash';
        const isPilotMaster = isPilotCompany && paymentMethod === 'Master';
        
        // If Pilot + Master, get Vehicle ID from efsDetailsRow (the visible one)
        if (isPilotMaster) {
            const efsDetailsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            const vehicleIdInEfsRow = efsDetailsRow?.querySelector('#vehicleId') as HTMLInputElement | null;
            if (vehicleIdInEfsRow && vehicleIdInEfsRow.offsetParent !== null) {
                // Use the visible Vehicle ID from efsDetailsRow
                vehicleIdInput = vehicleIdInEfsRow;
            }
        }
        
        const dlNumberInput = document.getElementById('dlNumber') as HTMLInputElement;
        const driverCompanyNameInput = document.getElementById('driverCompanyName') as HTMLInputElement;
        
        // Get EFS details
        const checkNumberInput = document.getElementById('checkNumber') as HTMLInputElement;
        const checkNumberConfirmInput = document.getElementById('checkNumberConfirm') as HTMLInputElement;
        const driverFirstNameInput = document.getElementById('driverFirstName') as HTMLInputElement;
        const driverLastNameInput = document.getElementById('driverLastName') as HTMLInputElement;
        
        // Get signature checkbox
        const includeSignatureInput = document.getElementById('includeSignature') as HTMLInputElement;
        
        // Get copy type dropdown (for Love's + Visa and TA + Visa)
        const copyTypeInput = document.getElementById('copyType') as HTMLSelectElement;
        
        const formData: any = {
            companyId: selectedCompanyId,
            country: countryInput.value,
            date: dateInput?.value || new Date().toISOString(),
            paymentMethod: paymentMethodInput?.value || 'Cash',
            cardLast4: cardLast4Input?.value || '3948',
            cardEntryMethod: cardEntryMethodInput?.value || 'INSERT',
            copyType: copyTypeInput?.value || 'Original',
            vehicleId: vehicleIdInput?.value || '',
            dlNumber: dlNumberInput?.value || '',
            driverCompanyName: driverCompanyNameInput?.value || '',
            checkNumber: checkNumberInput?.value || '',
            checkNumberConfirm: checkNumberConfirmInput?.value || '',
            driverFirstName: driverFirstNameInput?.value || '',
            driverLastName: driverLastNameInput?.value || '',
            includeSignature: includeSignatureInput?.checked || false,
            storeData: selectedStore ? {
                storeCode: selectedStore.storeCode,
                address: selectedStore.address,
                cityState: selectedStore.cityState,
                phone: selectedStore.phone
            } : null,
            items: []
        };
        
        // Collect items
        const itemRows = document.querySelectorAll('.item-row');
        itemRows.forEach((row) => {
            const nameInput = row.querySelector('.item-name') as HTMLSelectElement;
            const qtyInput = row.querySelector('.item-qty') as HTMLInputElement;
            const pumpInput = row.querySelector('.item-pump') as HTMLInputElement;
            const gallonsInput = row.querySelector('.item-gallons') as HTMLInputElement;
            const pricePerGalInput = row.querySelector('.item-price-per-gal') as HTMLInputElement;
            
            const name = nameInput?.value;
            const qty = qtyInput?.value;
            const pump = pumpInput?.value;
            const gallons = gallonsInput?.value;
            const pricePerGal = pricePerGalInput?.value;
            
            // Check if this is a cash advance item
            const isCashAdvance = name && name.toLowerCase().includes('cash advance');
            
            // Check if BVD Petroleum company is selected
            const selectedCompany = getSelectedCompany();
            const isBVDPetroleum = selectedCompany && selectedCompany.name.toLowerCase().includes('bvd petroleum');
            
            if (name) {
                if (isCashAdvance) {
                    // For cash advance items, quantity field is actually the price
                    // Quantity is hardcoded to 1
                    if (qty) {
                    const priceNum = parseFloat(qty); // qty field contains the price
                    
                    console.log('Cash advance item data:', { name, price: qty });
                    console.log('Parsed values:', { price: priceNum, quantity: 1 });
                    
                    formData.items.push({ 
                        name, 
                        quantity: 1,          // Hardcoded to 1 for cash advance
                        price: priceNum,      // Price from quantity field
                        pump: undefined,      // No pump for cash advance
                        qty: 1                // Hardcoded to 1
                    });
                    }
                } else if (isBVDPetroleum) {
                    // For BVD Petroleum, only require gallons and price per gallon
                    if (gallons && pricePerGal) {
                        const gallonsNum = parseFloat(gallons);
                        const pricePerGalNum = parseFloat(pricePerGal);
                        const pumpNum = Math.floor(Math.random() * 15) + 1; // Generate random pump number 1-15
                        
                        console.log('BVD Petroleum item data:', { name, gallons, pricePerGal });
                        console.log('Parsed values:', { gallonsNum, pricePerGalNum, pumpNum });
                        
                        formData.items.push({ 
                            name, 
                            quantity: gallonsNum,  // Backend expects quantity for total calculation
                            price: pricePerGalNum, // Backend expects price per unit
                            pump: pumpNum,         // Random pump number 1-15
                            qty: 1                 // Default quantity for BVD Petroleum
                        });
                    }
                } else if (gallons && pricePerGal) {
                    // For regular items in other companies, require gallons and price per gallon
                    const gallonsNum = parseFloat(gallons);
                    const pricePerGalNum = parseFloat(pricePerGal);
                    const pumpNum = Math.floor(Math.random() * 15) + 1; // Generate random pump number 1-15
                    const qtyNum = qty ? parseInt(qty) : undefined;
                    
                    console.log('Regular item data:', { name, qty, gallons, pricePerGal });
                    console.log('Parsed values:', { qtyNum, pumpNum, gallonsNum, pricePerGalNum });
                    
                    formData.items.push({ 
                        name, 
                        quantity: gallonsNum,  // Backend expects quantity for total calculation
                        price: pricePerGalNum, // Backend expects price per unit
                        pump: pumpNum,         // Random pump number 1-15
                        qty: qtyNum            // Item quantity
                    });
                }
            }
        });
        
        // Validate items
        if (formData.items.length === 0) {
            alert('Please add at least one item');
            btn.disabled = false;
            btn.textContent = 'Generate Receipt 🧾';
            return;
        }
        
        // Send to API
        const response = await fetch('/api/generate-receipt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(formData)
        });
        
        const result: GenerateReceiptResponse = await response.json();
        
        if (result.success) {
            // Store receipt data for printing
            currentReceiptData = {
                ...formData,
                receiptNumber: result.receiptNumber,
                design: result.design
            };
            
            // Show success message
            const receiptForm = document.getElementById('receiptForm');
            const successMessage = document.getElementById('successMessage');
            const receiptInfo = document.getElementById('receiptInfo');
            const downloadLink = document.getElementById('downloadLink') as HTMLAnchorElement;
            
            if (receiptForm) receiptForm.style.display = 'none';
            if (successMessage) successMessage.style.display = 'block';
            if (receiptInfo) {
                receiptInfo.innerHTML = `
                    <strong>Receipt Number:</strong> ${result.receiptNumber}<br>
                    <strong>Design:</strong> ${result.design}<br>
                    <strong>File:</strong> ${result.fileName}
                `;
            }
            if (downloadLink) downloadLink.href = result.downloadUrl;
            
            // Generate print preview
            if (currentReceiptData) {
                generatePrintPreview(currentReceiptData);
            }
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            alert('Error: ' + (result.error || 'Failed to generate receipt'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to generate receipt. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Receipt 🧾';
    }
}

// Reset form for new receipt
function resetForm(): void {
    const receiptForm = document.getElementById('receiptForm') as HTMLFormElement;
    const successMessage = document.getElementById('successMessage');
    const printReceipt = document.getElementById('printReceipt');
    const receiptPreviewContainer = document.getElementById('receiptPreviewContainer');
    const itemsList = document.getElementById('itemsList');
    const dateInput = document.getElementById('date') as HTMLInputElement;
    const paymentMethodSelect = document.getElementById('paymentMethod') as HTMLSelectElement;
    const cardLast4Input = document.getElementById('cardLast4') as HTMLInputElement;
    const cardEntryMethodSelect = document.getElementById('cardEntryMethod') as HTMLSelectElement;
    const vehicleIdInput = document.getElementById('vehicleId') as HTMLInputElement;
    const dlNumberInput = document.getElementById('dlNumber') as HTMLInputElement;
    const driverCompanyNameInput = document.getElementById('driverCompanyName') as HTMLInputElement;
    const countrySelect = document.getElementById('country') as HTMLSelectElement;
    const companySelect = document.getElementById('designId') as HTMLSelectElement;
    const storeInput = document.getElementById('storeInput') as HTMLInputElement;
    const storeSelect = document.getElementById('storeSelect') as HTMLSelectElement;
    
    if (receiptForm) {
        receiptForm.reset();
        receiptForm.style.display = 'block';
    }
    if (successMessage) successMessage.style.display = 'none';
    if (printReceipt) printReceipt.classList.remove('show-preview');
    if (receiptPreviewContainer) receiptPreviewContainer.style.display = 'none';
    
    // Clear items
    if (itemsList) itemsList.innerHTML = '';
    itemCount = 0;
    currentReceiptData = null;
    
    // Reset all form fields to default values
    if (dateInput) {
        const now = new Date();
        const dateTimeLocal = now.toISOString().slice(0, 16);
        dateInput.value = dateTimeLocal;
    }
    
    if (paymentMethodSelect) paymentMethodSelect.value = 'Cash';
    if (cardLast4Input) cardLast4Input.value = '';
    if (cardEntryMethodSelect) cardEntryMethodSelect.value = 'INSERT';
    if (vehicleIdInput) vehicleIdInput.value = '101';
    if (dlNumberInput) dlNumberInput.value = '0';
    if (driverCompanyNameInput) driverCompanyNameInput.value = 'MCMPLOGISTICSINC';
    if (countrySelect) countrySelect.value = '';
    if (companySelect) companySelect.value = '';
    if (storeInput) storeInput.value = '';
    if (storeSelect) storeSelect.value = '';
    
    // Reset form visibility and fields
    toggleCardFields();
    
    // Add first item
    addItem();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Generate print preview
function generatePrintPreview(data: ReceiptData): void {
    const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;
    
    // Get selected company info
    const designIdInput = document.getElementById('designId') as HTMLSelectElement;
    const selectedCompanyId = designIdInput?.value ? parseInt(designIdInput.value) : null;
    const company = selectedCompanyId ? companies.find(c => c.id === selectedCompanyId) : null;
    
    const receiptHTML = `
        <div class="receipt-header">
            <div class="receipt-store-name">${company ? company.name.toUpperCase() : 'YOUR BRAND NAME'}</div>
            <div>${company ? company.address : '123 Main Street'}</div>
            <div>${company ? company.email : 'City, State 12345'}</div>
            <div>Tel: ${company ? company.phone : '(555) 123-4567'}</div>
        </div>
        
        <div class="receipt-divider"></div>
        
        <div class="receipt-row">
            <span>Receipt #:</span>
            <span>${data.receiptNumber}</span>
        </div>
        <div class="receipt-row">
            <span>Date:</span>
            <span>${new Date(data.date).toLocaleDateString()}</span>
        </div>
        <div class="receipt-row">
            <span>Design:</span>
            <span>${data.design}</span>
        </div>
        
        <div class="receipt-divider"></div>
        
        <div style="margin: 10px 0;">
            ${data.items.map(item => `
                <div class="receipt-item">
                    <div>${item.name}</div>
                    <div class="receipt-row">
                        <span>${item.quantity} x $${item.price.toFixed(2)}</span>
                        <span>$${(item.quantity * item.price).toFixed(2)}</span>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="receipt-divider"></div>
        
        <div class="receipt-row">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
        </div>
        <div class="receipt-row">
            <span>Tax (8%):</span>
            <span>$${tax.toFixed(2)}</span>
        </div>
        
        <div class="receipt-solid-divider"></div>
        
        <div class="receipt-row receipt-total">
            <span>TOTAL:</span>
            <span>$${total.toFixed(2)}</span>
        </div>
        
        <div class="receipt-divider"></div>
        
        <div style="text-align: center; margin: 10px 0;">
            <div>Payment: ${data.paymentMethod}</div>
        </div>
        
        <div class="receipt-barcode">
            ||||| ${data.receiptNumber} |||||
        </div>
        
        <div class="receipt-footer">
            <div>Thank you for your business!</div>
            <div>Please come again</div>
        </div>
    `;
    
    const printDiv = document.getElementById('printReceipt');
    if (printDiv) printDiv.innerHTML = receiptHTML;
}

// Print receipt
function printReceipt(): void {
    if (!currentReceiptData) {
        alert('No receipt data available');
        return;
    }
    
    const printDiv = document.getElementById('printReceipt');
    if (!printDiv) return;
    
    // Make receipt visible for printing
    printDiv.classList.add('show-preview');
    
    // Trigger print dialog
    window.print();
    
    // Hide preview after print
    setTimeout(() => {
        printDiv.classList.remove('show-preview');
    }, 100);
}

// Generate receipt preview content
function generateReceiptPreview(data: ReceiptData): string {
    const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;
    
    // Get selected company info
    const designIdInput = document.getElementById('designId') as HTMLSelectElement;
    const selectedCompanyId = designIdInput?.value ? parseInt(designIdInput.value) : null;
    const company = selectedCompanyId ? companies.find(c => c.id === selectedCompanyId) : null;
    
    // Get payment details from form
    const paymentMethodInput = document.getElementById('paymentMethod') as HTMLSelectElement;
    const cardLast4Input = document.getElementById('cardLast4') as HTMLInputElement;
    const cardEntryMethodInput = document.getElementById('cardEntryMethod') as HTMLSelectElement;
    
    const paymentMethod = paymentMethodInput?.value || 'Cash';
    const cardLast4 = cardLast4Input?.value || '';
    const cardEntryMethod = cardEntryMethodInput?.value || 'INSERT';
    
    return `
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">${company ? company.name.toUpperCase() : 'RECEIPT'}</div>
            ${company ? `
                <div style="font-size: 12px; line-height: 1.6;">
                    ${company.address}<br>
                    ${company.phone}<br>
                    ${company.email}
                </div>
            ` : ''}
        </div>
        
        <div style="border-top: 2px dashed #333; border-bottom: 2px dashed #333; padding: 15px 0; margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Receipt #:</span>
                <span style="font-weight: bold;">${data.receiptNumber}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Date:</span>
                <span>${new Date(data.date).toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Country:</span>
                <span>${data.country}</span>
            </div>
        </div>
        
        <div style="margin: 20px 0;">
            <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px;">ITEMS</div>
            ${data.items.map(item => `
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold;">
                        <span>${item.name}</span>
                        <span>$${(item.quantity * item.price).toFixed(2)}</span>
                    </div>
                    <div style="font-size: 11px; color: #666; margin-top: 2px;">
                        ${item.quantity} x $${item.price.toFixed(2)}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div style="border-top: 2px dashed #333; padding-top: 15px; margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Subtotal:</span>
                <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Tax (8%):</span>
                <span>$${tax.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; margin-top: 15px; padding-top: 15px; border-top: 2px solid #333;">
                <span>TOTAL:</span>
                <span>$${total.toFixed(2)}</span>
            </div>
        </div>
        
        <div style="border-top: 2px dashed #333; padding-top: 15px; margin-top: 20px;">
            <div style="font-weight: bold; margin-bottom: 10px;">PAYMENT</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Method:</span>
                <span style="font-weight: bold;">${paymentMethod}</span>
            </div>
            ${cardLast4 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Card:</span>
                    <span>XXXXXXXXXXXX${cardLast4}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Entry:</span>
                    <span>${cardEntryMethod}</span>
                </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between;">
                <span>Amount:</span>
                <span style="font-weight: bold;">$${total.toFixed(2)}</span>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px dashed #333; font-size: 11px;">
            <div style="margin-bottom: 5px;">Thank you for your business!</div>
            <div>Please come again</div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; font-family: monospace; letter-spacing: 2px;">
            ||| ${data.receiptNumber} |||
        </div>
    `;
}

// Update payment method options based on selected company
function updatePaymentMethodOptions(): void {
    const paymentMethodSelect = document.getElementById('paymentMethod') as HTMLSelectElement;
    const selectedCompany = getSelectedCompany();
    
    if (!paymentMethodSelect || !selectedCompany) return;
    
    const isBVDPetroleum = selectedCompany.name.toLowerCase().includes('bvd petroleum');
    const isPetroCanada = selectedCompany.name.toLowerCase().includes('petro-canada');
    const isHusky = selectedCompany.name.toLowerCase().includes('husky');
    const isFlyingJCanada = selectedCompany.name.toLowerCase().includes('flying j') && getCurrentCountry() === 'Canada';
    
    if (isBVDPetroleum) {
        // For BVD Petroleum, only show Master payment method
        paymentMethodSelect.innerHTML = `
            <option value="Master">💳 Master</option>
        `;
        // Set Master as default
        paymentMethodSelect.value = 'Master';
    } else if (isHusky) {
        // For Husky, show only Master, TCH, Visa, Interac (hide Cash/EFS)
        paymentMethodSelect.innerHTML = `
            <option value="Master">💳 Master</option>
            <option value="TCH">💳 TCH</option>
            <option value="Interac">💳 Interac</option>
        `;
        paymentMethodSelect.value = 'Master';
    } else if (isFlyingJCanada) {
        // For Flying J Canada, show only Master, TCH, and Visa
        paymentMethodSelect.innerHTML = `
            <option value="Master">💳 Master</option>
            <option value="TCH">💳 TCH</option>
            <option value="Visa">💳 Visa</option>
        `;
        paymentMethodSelect.value = 'Master';
    } else if (isPetroCanada) {
        // For Petro-Canada, show Master and Interac payment methods (Visa hidden)
        paymentMethodSelect.innerHTML = `
            <option value="Master">💳 Master</option>
            <option value="Interac">💳 Interac</option>
        `;
        // Set Master as default
        paymentMethodSelect.value = 'Master';
    } else {
        // For other companies, show all payment methods
        paymentMethodSelect.innerHTML = `
            <option value="Cash">💵 Cash</option>
            <option value="EFS">💳 EFS</option>
            <option value="Master">💳 Master</option>
            <option value="TCH">💳 TCH</option>
            <option value="Visa">💳 Visa</option>
        `;
    }
    
    // Trigger change event to update card fields visibility
    paymentMethodSelect.dispatchEvent(new Event('change'));
}

// Close receipt preview handler
function closeReceiptPreviewHandler(): void {
    const receiptPreviewContainer = document.getElementById('receiptPreviewContainer');
    
    if (receiptPreviewContainer) {
        receiptPreviewContainer.style.display = 'none';
    }
}
