// Simple, clean type definitions

export interface ReceiptItem {
  name: string;
  quantity: number;  // This is gallons
  price: number;     // This is price per gallon
  pump?: number;     // Pump number
  qty?: number;      // Item quantity (1, 2, 3, etc.)
}

export interface Receipt {
  receiptNumber: string;
  companyName: string;
  companyAddress?: string;
  companyEmail?: string;
  country?: string;
  date: Date;
  items: ReceiptItem[];
  notes?: string;
  paymentMethod?: string;
  cardLast4?: string;
  cardEntryMethod?: string;
  copyType?: string;
  vehicleId?: string;
  dlNumber?: string;
  driverCompanyName?: string;
  driverFirstName?: string;
  driverLastName?: string;
  checkNumber?: string;
  checkNumberConfirm?: string;
  includeSignature?: boolean;
  pos?: string;
  clerk?: string;
  companyData?: {
    storeNumber?: string;
    phone?: string;
    address?: string;
    city?: string;
  };
}

export interface Company {
  name: string;
  address?: string;
  email?: string;
}

