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
    const printBtn = document.getElementById('printBtn');
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
    if (printBtn) printBtn.addEventListener('click', printReceipt);
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
});

// Load companies from database
async function loadCompanies(): Promise<void> {
    try {
        const response = await fetch('/api/companies');
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
    const isOne9Master = isOne9Company && paymentMethod === 'Master';
    const isHuskyVisa = isHuskyCompany && (paymentMethod === 'Visa' || paymentMethod === 'Master' || paymentMethod === 'Mastercard' || paymentMethod === 'Interac' || paymentMethod === 'American Express' || paymentMethod === 'EFS' || paymentMethod === 'TCH');
    const isPetroCanadaAny = isPetroCanadaCompany; // Hide for any payment method
    const isBVDPetroleumAny = isBVDPetroleumCompany; // Hide for any payment method
    
    // For One9 + Master, ensure Vehicle ID in vehicleDetailsRow is not required (since it's hidden)
    if (isOne9Master) {
        const vehicleDetailsRow = document.getElementById('vehicleDetailsRow') as HTMLElement | null;
        const vehicleDetailsRowVehicleId = vehicleDetailsRow?.querySelector('#vehicleId') as HTMLInputElement | null;
        if (vehicleDetailsRowVehicleId) {
            vehicleDetailsRowVehicleId.required = false;
            vehicleDetailsRowVehicleId.removeAttribute('required');
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
            if (cardEntryMethodField) {
                cardEntryMethodField.required = false;
                cardEntryMethodField.disabled = true;
                cardEntryMethodField.removeAttribute('required');
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
        if (cardEntryMethodField) {
            cardEntryMethodField.required = false;
            cardEntryMethodField.disabled = true;
            cardEntryMethodField.removeAttribute('required');
        }
        return;
    } else if (isAnyCanadaCompany) {
        // For any Canadian company, keep card entry method disabled/hidden and not required
        const cardEntryMethodField = document.getElementById('cardEntryMethod') as HTMLSelectElement;
        if (cardEntryMethodField) {
            cardEntryMethodField.required = false;
            cardEntryMethodField.disabled = true;
            cardEntryMethodField.removeAttribute('required');
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

function toggleCardFields(): void {
    const paymentMethodSelect = document.getElementById('paymentMethod') as HTMLSelectElement;
    const cardDetailsRow = document.getElementById('cardDetailsRow');
    const vehicleDetailsRow = document.getElementById('vehicleDetailsRow');
    const cardLast4Input = document.getElementById('cardLast4') as HTMLInputElement;
    
    if (!paymentMethodSelect || !cardDetailsRow) return;
    
    const paymentMethod = paymentMethodSelect.value;
    
    // Show card fields if payment method is NOT Cash and NOT EFS
    if (paymentMethod !== 'Cash' && paymentMethod !== 'EFS') {
        cardDetailsRow.style.display = 'grid';
        // Make fields required when shown
        if (cardLast4Input) {
            cardLast4Input.required = true;
        }
    } else {
        cardDetailsRow.style.display = 'none';
        // Make fields optional when hidden
        if (cardLast4Input) {
            cardLast4Input.required = false;
            cardLast4Input.value = ''; // Clear the value
        }
        // Also relax Company Name when card details are hidden (e.g., Cash)
        const companyNameInput = document.getElementById('driverCompanyName') as HTMLInputElement | null;
        const companyNameGroup = document.getElementById('companyNameGroup') as HTMLElement | null;
        if (companyNameInput) {
            companyNameInput.required = false;
            companyNameInput.removeAttribute('required');
            companyNameInput.disabled = false; // keep enabled to avoid not focusable
        }
        if (companyNameGroup) companyNameGroup.style.display = 'none';
    }
    
    // Get selected company to check if it's One9 or Love's
    const companySelect = document.getElementById('designId') as HTMLSelectElement;
    const selectedCompanyId = companySelect?.value ? parseInt(companySelect.value) : null;
    const selectedCompany = selectedCompanyId ? companies.find(c => c.id === selectedCompanyId) : null;
    const isOne9Company = selectedCompany && (selectedCompany.name.toLowerCase().includes('one 9') || selectedCompany.name.toLowerCase().includes('one9'));
    const isLovesCompany = selectedCompany && selectedCompany.name.toLowerCase().includes('love');
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
        // Always hide card entry method for any Canadian company
        if (isAnyCanadaCompany) {
            const cardEntryMethodField = document.getElementById('cardEntryMethod') as HTMLSelectElement;
            if (cardEntryMethodField) {
                cardEntryMethodField.required = false;
                cardEntryMethodField.value = 'INSERT';
                cardEntryMethodField.disabled = true;
                cardEntryMethodField.removeAttribute('required');
                const cardEntryMethodGroup = cardEntryMethodField.closest('.form-group') as HTMLElement;
                if (cardEntryMethodGroup) cardEntryMethodGroup.style.display = 'none';
            }
        }
        // Husky + Interac → hide vehicle/company fields
        if (isHuskyCompany && paymentMethod === 'Interac') {
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
        // Show ALL vehicle/company fields for Canadian Flying J + Master
        if (selectedCompany && selectedCompany.name.toLowerCase().includes('flying j') && getCurrentCountry() === 'Canada' && paymentMethod === 'Master') {
            console.log('Showing vehicle details for Canadian Flying J + Master');
            vehicleDetailsRow.style.display = 'grid';
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement | null;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement | null;
            const companyNameGroup = document.getElementById('companyNameGroup') as HTMLElement | null;
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            if (dlNumberGroup) dlNumberGroup.style.display = 'block';
            if (companyNameGroup) companyNameGroup.style.display = 'block';
            if (vehicleIdField) { vehicleIdField.disabled = false; vehicleIdField.required = true; vehicleIdField.setAttribute('required', 'required'); }
            if (dlNumberField) { dlNumberField.disabled = false; dlNumberField.required = true; dlNumberField.setAttribute('required', 'required'); }
            if (companyNameField) { companyNameField.disabled = false; companyNameField.required = true; companyNameField.setAttribute('required', 'required'); }
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
            
            // Show Vehicle ID field in efsDetailsRow
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'block';
            if (vehicleIdField) { 
                vehicleIdField.disabled = false; 
                vehicleIdField.required = true; 
                vehicleIdField.setAttribute('required', 'required'); 
            }
            
            // Show Company Name field
            if (companyNameGroup) companyNameGroup.style.display = 'block';
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
            if (signatureCheckboxGroup) signatureCheckboxGroup.style.display = 'flex';
            
            return;
        }

        if (isPetroCanadaCompany) {
            // Hide all vehicle details for Petro-Canada + any payment method
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
                cardEntryMethodField.required = false;
                cardEntryMethodField.value = 'INSERT';
                cardEntryMethodField.disabled = true;
                cardEntryMethodField.removeAttribute('required');
                // Hide the card entry method field visually
                const cardEntryMethodGroup = cardEntryMethodField.closest('.form-group') as HTMLElement;
                if (cardEntryMethodGroup) cardEntryMethodGroup.style.display = 'none';
            }
        } else if (isBVDPetroleumCompany) {
            // Hide all vehicle details for BVD Petroleum + any payment method
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
                cardEntryMethodField.required = false;
                cardEntryMethodField.value = 'INSERT';
                cardEntryMethodField.disabled = true;
                cardEntryMethodField.removeAttribute('required');
                // Hide the card entry method field visually
                const cardEntryMethodGroup = cardEntryMethodField.closest('.form-group') as HTMLElement;
                if (cardEntryMethodGroup) cardEntryMethodGroup.style.display = 'none';
            }
        } else if (paymentMethod === 'TCH' && isOne9Company) {
            // Show Vehicle ID and DL Number for TCH payment with One9 company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for One9 + TCH combination
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            
            // Hide Vehicle ID field for One9 + TCH combination
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement;
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'none';
            // Remove required attribute when hidden
            if (vehicleIdField) vehicleIdField.required = false;
        } else if (isHuskyCompany && (paymentMethod === 'Visa' || paymentMethod === 'Master' || paymentMethod === 'Mastercard' || paymentMethod === 'Interac' || paymentMethod === 'American Express' || paymentMethod === 'EFS' || paymentMethod === 'TCH')) {
            // Hide all vehicle details for Husky + card methods (Visa/Master/Interac/EFS/TCH)
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
            // Show vehicle details row for USA Flying J with TCH, but only show company name
            vehicleDetailsRow.style.display = 'grid';
            // Hide Vehicle ID and DL Number fields for USA Flying J + TCH combination
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            const vehicleIdGroup = vehicleIdField?.closest('.form-group') as HTMLElement;
            const dlNumberGroup = dlNumberField?.closest('.form-group') as HTMLElement;
            if (vehicleIdGroup) vehicleIdGroup.style.display = 'none';
            if (dlNumberGroup) dlNumberGroup.style.display = 'none';
            // Remove required attribute when hidden
            if (vehicleIdField) vehicleIdField.required = false;
            if (dlNumberField) dlNumberField.required = false;
        } else if (paymentMethod === 'TCH') {
            // Hide Vehicle ID and DL Number for TCH payment with other companies
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
        } else if (paymentMethod === 'EFS' && isPilotCompany) {
            // Show only Vehicle ID for Pilot + EFS combination
            vehicleDetailsRow.style.display = 'grid';
            
            // Hide EFS Details row for Pilot + EFS combination
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
            // Show EFS Details for TravelCenters company
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
        } else if (paymentMethod === 'Cash') {
            // Hide Vehicle ID and DL Number for Cash payment with other companies
            vehicleDetailsRow.style.display = 'none';
            // Remove required attribute when hidden
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            if (vehicleIdField) vehicleIdField.required = false;
            if (dlNumberField) dlNumberField.required = false;
        } else if (paymentMethod === 'EFS' && isOne9Company) {
            // Show Vehicle ID and DL Number for EFS payment with One9 company
            vehicleDetailsRow.style.display = 'grid';
            // Hide DL Number field for One9 + EFS combination
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
        } else if (paymentMethod === 'EFS' && isLovesCompany) {
            // Show Company Name + Driver First/Last for Love's + EFS
            // Hide vehicle specific fields
            vehicleDetailsRow.style.display = 'none';
            const vehicleIdField = document.getElementById('vehicleId') as HTMLInputElement;
            const dlNumberField = document.getElementById('dlNumber') as HTMLInputElement;
            if (vehicleIdField) vehicleIdField.required = false;
            if (dlNumberField) dlNumberField.required = false;

            // Ensure EFS details row is visible
            const efsDetailsRow = document.getElementById('efsDetailsRow');
            if (efsDetailsRow) efsDetailsRow.style.display = 'grid';
            // Hide check number fields (not needed for Love's EFS) and remove required
            const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement;
            const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement;
            if (checkNumberField) {
                checkNumberField.required = false;
                const g = checkNumberField.closest('.form-group') as HTMLElement;
                if (g) g.style.display = 'none';
            }
            if (checkNumberConfirmField) {
                checkNumberConfirmField.required = false;
                const g = checkNumberConfirmField.closest('.form-group') as HTMLElement;
                if (g) g.style.display = 'none';
            }
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

            // Show company name field (lives in card details row) without card fields
            const cardDetailsRowLocal = document.getElementById('cardDetailsRow') as HTMLElement;
            const companyNameGroup = document.getElementById('companyNameGroup') as HTMLElement;
            const cardLast4Group = (document.getElementById('cardLast4')?.closest('.form-group')) as HTMLElement | null;
            const cardEntryGroup = (document.getElementById('cardEntryMethod')?.closest('.form-group')) as HTMLElement | null;
            if (cardDetailsRowLocal) cardDetailsRowLocal.style.display = 'grid';
            if (cardLast4Group) cardLast4Group.style.display = 'none';
            if (cardEntryGroup) cardEntryGroup.style.display = 'none';
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameGroup) companyNameGroup.style.display = 'block';
            if (companyNameField) { companyNameField.required = true; companyNameField.disabled = false; }
        } else if (paymentMethod === 'EFS') {
            // Hide Vehicle ID and DL Number for EFS payment with other companies
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
        } else if (paymentMethod === 'Master') {
            // Hide Vehicle ID and DL Number for Master payment with other companies
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
        } else if (paymentMethod === 'Visa' && isOne9Company) {
            // ONE 9 + Visa: hide company name and ensure it's not required
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
            // Show Company Name and Signature for Love's + EFS
            if (vehicleDetailsRow) vehicleDetailsRow.style.display = 'grid';
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'flex';
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
        } else if (paymentMethod === 'EFS' && isPilotCompany) {
            // Show Company Name and Signature checkbox for EFS payment with Pilot company
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'flex';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
        } else if (paymentMethod === 'Cash') {
            // Hide Company Name and Signature checkbox for Cash payment with other companies
            companyNameGroup.style.display = 'none';
            signatureCheckboxGroup.style.display = 'none';
            // Remove required attribute when hidden
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = false;
        } else if (paymentMethod === 'TCH' && isPilotCompany) {
            // Hide Company Name and Signature checkbox for TCH payment with Pilot company
            companyNameGroup.style.display = 'none';
            signatureCheckboxGroup.style.display = 'none';
            // Remove required attribute when hidden
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = false;
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
        } else if (paymentMethod === 'TCH') {
            // Hide Company Name for TCH payment with other companies
            companyNameGroup.style.display = 'none';
            signatureCheckboxGroup.style.display = 'none';
            // Remove required attribute when hidden
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = false;
        } else if (paymentMethod === 'EFS' && isOne9Company) {
            // Show Company Name and Signature checkbox for EFS payment with One9 company
            companyNameGroup.style.display = 'block';
            signatureCheckboxGroup.style.display = 'flex';
            // Make Company Name required when visible
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = true;
        } else if (paymentMethod === 'EFS') {
            // Hide Company Name for EFS payment with other companies
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
            // Show Company Name and Signature checkbox for Master payment with Pilot company
            const efsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
            if (efsRow) efsRow.style.display = 'grid';
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
        } else if (paymentMethod === 'Master') {
            // Hide Company Name for Master payment with other companies
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
        } else if (paymentMethod === 'Visa' && isLovesCompany) {
            // Hide Company Name for Visa payment with Love's company
            companyNameGroup.style.display = 'none';
            signatureCheckboxGroup.style.display = 'none';
            const companyNameField = document.getElementById('driverCompanyName') as HTMLInputElement;
            if (companyNameField) companyNameField.required = false;
        } else {
            // Show Company Name for other payment methods
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
        if (companyNameGroupEl) companyNameGroupEl.style.display = 'block';
        if (signatureGroupEl) signatureGroupEl.style.display = 'flex';
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
        if (checkNumberField) {
            checkNumberField.required = false;
            const g = checkNumberField.closest('.form-group') as HTMLElement | null;
            if (g) g.style.display = 'none';
        }
        if (checkNumberConfirmField) {
            checkNumberConfirmField.required = false;
            const g = checkNumberConfirmField.closest('.form-group') as HTMLElement | null;
            if (g) g.style.display = 'none';
        }
    }
    // Ensure EFS details row is hidden for non-EFS, except keep it for Pilot + Visa, TA + Visa, TA + Master, Love's + Cash, Love's + Master, and USA Flying J + Master to show Company Name only
    if (paymentMethod !== 'EFS') {
        const efsRow = document.getElementById('efsDetailsRow') as HTMLElement | null;
        const keepForPilotVisa = paymentMethod === 'Visa' && isPilotCompany;
        const keepForTAVisas = paymentMethod === 'Visa' && isTravelCentersCompany;
        const keepForTAMaster = paymentMethod === 'Master' && isTravelCentersCompany;
        const keepForLovesCash = paymentMethod === 'Cash' && isLovesCompany;
        const keepForLovesMaster = paymentMethod === 'Master' && isLovesCompany;
        const keepForUSAFlyingJMaster = paymentMethod === 'Master' && selectedCompany && selectedCompany.name.toLowerCase().includes('flying j') && getCurrentCountry() === 'United States of America';
        const keepRow = keepForPilotVisa || keepForTAVisas || keepForTAMaster || keepForLovesCash || keepForLovesMaster || keepForUSAFlyingJMaster;
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
        // Hide EFS-only sub-fields when showing row for Pilot + Visa, TA + Visa, Love's + Cash, Love's + Master, but show them for TA + Master and USA Flying J + Master
        // Also hide these fields specifically for Pilot + Master
        const keepForPilotMaster = paymentMethod === 'Master' && isPilotCompany;
        
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
            if (keepForTAMaster || keepForUSAFlyingJMaster) {
                // Explicitly show all EFS fields for TA + Master and USA Flying J + Master
                showFieldGroup(checkNumberField, true);
                showFieldGroup(checkNumberConfirmField, true);
                showFieldGroup(driverFirstNameField, true);
                showFieldGroup(driverLastNameField, true);
                if (keepForTAMaster && vehicleIdField) {
                    // Show Vehicle ID for TA + Master (it's in the EFS row now, after Driver Last Name)
                    showFieldGroup(vehicleIdField, true);
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
            // Show signature checkbox for Love's + Master, USA Flying J + Master, and TA + Master
            // Hide it for Pilot + Visa, TA + Visa, Love's + Cash
            if (keepForLovesMaster) {
                // Show signature checkbox for Love's + Master
                if (sigGroup) sigGroup.style.display = 'flex';
            } else if (!keepForUSAFlyingJMaster && !keepForTAMaster) {
                hideGroup(sigGroup);
            }
        }
        
        // Explicitly hide EFS fields for Pilot + Master (even if EFS row is shown elsewhere)
        if (keepForPilotMaster) {
            const checkNumberField = document.getElementById('checkNumber') as HTMLInputElement | null;
            const checkNumberConfirmField = document.getElementById('checkNumberConfirm') as HTMLInputElement | null;
            const driverFirstNameField = document.getElementById('driverFirstName') as HTMLInputElement | null;
            const driverLastNameField = document.getElementById('driverLastName') as HTMLInputElement | null;
            
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
        }
    }
    
    // Show/hide Copy Type dropdown only for companies that support it
    // Companies that use copyType: One9, Travel Centers of America (TA), Husky
    // Pilot with Master does NOT show copy type dropdown
    // One9 with Master does NOT show copy type dropdown
    // Only show for payment methods that display "Type: SALE"
    const copyTypeGroup = document.getElementById('copyTypeGroup') as HTMLElement | null;
    const isUSAJWithMaster = selectedCompany && selectedCompany.name.toLowerCase().includes('flying j') && getCurrentCountry() === 'United States of America' && paymentMethod === 'Master';
    
    // Check if the selected company supports copyType
    // Exclude Pilot with Master payment method
    // Exclude One9 with Master payment method
    const pilotWithMaster = isPilotCompany && paymentMethod === 'Master';
    const one9WithMaster = isOne9Company && paymentMethod === 'Master';
    const companySupportsCopyType = isOne9Company || isTravelCentersCompany || isHuskyCompany;
    
    // Only show copy type for supported companies and appropriate payment methods
    // Hide for Pilot + Master and One9 + Master
    const showCopyType = companySupportsCopyType && 
        (paymentMethod === 'Visa' || paymentMethod === 'Master' || paymentMethod === 'TCH' || paymentMethod === 'EFS' || paymentMethod === 'Interac') && 
        !isUSAJWithMaster && !pilotWithMaster && !one9WithMaster;
    
    if (copyTypeGroup) {
        copyTypeGroup.style.display = showCopyType ? 'block' : 'none';
    }
    
    // Restore required attributes for visible fields
    restoreRequiredAttributes();
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
        const response = await fetch(`/api/companies/${companyId}/stores`);
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
        const response = await fetch(`/api/companies/${companyId}/items`);
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
    
    // Check if BVD Petroleum company is selected
    const selectedCompany = getSelectedCompany();
    const isBVDPetroleum = selectedCompany && selectedCompany.name.toLowerCase().includes('bvd petroleum');
    
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
        <div class="form-group" ${isBVDPetroleum ? 'style="display: none;"' : ''}>
            <label>Quantity *</label>
            <input type="text" class="item-qty" placeholder="1" inputmode="numeric" ${isBVDPetroleum ? '' : 'required'}>
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
                // For Cash Advance: ALWAYS show Quantity for all companies
                if (qtyGroup) qtyGroup.style.display = 'block';
                if (qtyInput) qtyInput.setAttribute('required', 'required');
                // Hide other item inputs
                if (pumpGroup) pumpGroup.style.display = 'none';
                if (gallonsGroup) gallonsGroup.style.display = 'none';
                if (priceGroup) priceGroup.style.display = 'none';
                // Clear and remove required
                if (pumpInput) { pumpInput.value = ''; pumpInput.removeAttribute('required'); }
                if (gallonsInput) { gallonsInput.value = ''; gallonsInput.removeAttribute('required'); }
                if (priceInput) { priceInput.value = ''; priceInput.removeAttribute('required'); }
            } else if (isBVDPetroleum) {
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
            
            updateTotal();
        });
    }
    
    if (qtyInput) {
        qtyInput.addEventListener('input', function(e) {
            const target = e.target as HTMLInputElement;
            target.value = target.value.replace(/[^0-9]/g, '');
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
            // Cash advance does not contribute to fuel subtotal
            // Keep preview consistent with receipt: line total is 0.00
            subtotal += 0;
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
async function generateReceipt(e: Event): Promise<void> {
    e.preventDefault();
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
        const vehicleIdInput = document.getElementById('vehicleId') as HTMLInputElement;
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
                    // For cash advance items, only require name and quantity
                    if (qty) {
                    const qtyNum = parseInt(qty);
                    
                    console.log('Cash advance item data:', { name, qty });
                    console.log('Parsed values:', { qtyNum });
                    
                    formData.items.push({ 
                        name, 
                        quantity: qtyNum,     // For cash advance, quantity is the amount
                        price: 0.0,           // Set price to 0.0 for cash advance
                        pump: undefined,      // No pump for cash advance
                        qty: qtyNum           // Item quantity
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
            <option value="Visa">💳 Visa</option>
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
        // For Petro-Canada, show Visa, Master, and Interac payment methods
        paymentMethodSelect.innerHTML = `
            <option value="Visa">💳 Visa</option>
            <option value="Master">💳 Master</option>
            <option value="Interac">💳 Interac</option>
        `;
        // Set Visa as default
        paymentMethodSelect.value = 'Visa';
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
