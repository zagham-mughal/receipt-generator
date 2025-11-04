import PDFDocument from 'pdfkit';

export interface ReceiptDesign {
  name: string;
  businessType: string;
  width: number;
  headerStyle: 'centered' | 'left' | 'logo-top' | 'split';
  fontSize: {
    store: number;
    header: number;
    body: number;
    small: number;
  };
  itemLayout: 'compact' | 'spacious' | 'table' | 'description';
  separatorStyle: 'dashed' | 'solid' | 'double' | 'stars' | 'equals';
  showElements: {
    barcode: boolean;
    storeNumber: boolean;
    cashier: boolean;
    paymentDetails: boolean;
  };
}

export const DESIGNS: ReceiptDesign[] = [
  {
    name: 'Grocery Store',
    businessType: 'Supermarket',
    width: 226.77,
    headerStyle: 'centered',
    fontSize: { store: 12, header: 9, body: 8, small: 7 },
    itemLayout: 'compact',
    separatorStyle: 'dashed',
    showElements: { barcode: true, storeNumber: true, cashier: true, paymentDetails: true }
  },
  {
    name: 'Coffee Shop',
    businessType: 'Cafe',
    width: 226.77,
    headerStyle: 'logo-top',
    fontSize: { store: 14, header: 9, body: 8, small: 7 },
    itemLayout: 'spacious',
    separatorStyle: 'solid',
    showElements: { barcode: false, storeNumber: false, cashier: true, paymentDetails: false }
  },
  {
    name: 'Gas Station',
    businessType: 'Fuel',
    width: 226.77,
    headerStyle: 'centered',
    fontSize: { store: 11, header: 8, body: 7, small: 6 },
    itemLayout: 'compact',
    separatorStyle: 'stars',
    showElements: { barcode: true, storeNumber: true, cashier: false, paymentDetails: true }
  },
  {
    name: 'Pharmacy',
    businessType: 'Medical',
    width: 226.77,
    headerStyle: 'centered',
    fontSize: { store: 13, header: 9, body: 8, small: 7 },
    itemLayout: 'description',
    separatorStyle: 'double',
    showElements: { barcode: true, storeNumber: true, cashier: true, paymentDetails: false }
  },
  {
    name: 'Electronics Store',
    businessType: 'Retail',
    width: 226.77,
    headerStyle: 'split',
    fontSize: { store: 14, header: 10, body: 9, small: 7 },
    itemLayout: 'table',
    separatorStyle: 'solid',
    showElements: { barcode: true, storeNumber: true, cashier: true, paymentDetails: true }
  },
  {
    name: 'Fast Food',
    businessType: 'Restaurant',
    width: 226.77,
    headerStyle: 'logo-top',
    fontSize: { store: 15, header: 10, body: 9, small: 7 },
    itemLayout: 'spacious',
    separatorStyle: 'equals',
    showElements: { barcode: false, storeNumber: true, cashier: true, paymentDetails: false }
  },
  {
    name: 'Clothing Store',
    businessType: 'Fashion',
    width: 226.77,
    headerStyle: 'centered',
    fontSize: { store: 16, header: 10, body: 9, small: 7 },
    itemLayout: 'table',
    separatorStyle: 'dashed',
    showElements: { barcode: true, storeNumber: true, cashier: true, paymentDetails: true }
  },
  {
    name: 'Hardware Store',
    businessType: 'Home Improvement',
    width: 226.77,
    headerStyle: 'left',
    fontSize: { store: 12, header: 9, body: 8, small: 6 },
    itemLayout: 'compact',
    separatorStyle: 'solid',
    showElements: { barcode: true, storeNumber: true, cashier: true, paymentDetails: true }
  },
  {
    name: 'Bookstore',
    businessType: 'Books & Media',
    width: 226.77,
    headerStyle: 'centered',
    fontSize: { store: 14, header: 9, body: 8, small: 7 },
    itemLayout: 'description',
    separatorStyle: 'dashed',
    showElements: { barcode: true, storeNumber: false, cashier: true, paymentDetails: false }
  },
  {
    name: 'Convenience Store',
    businessType: '24/7 Shop',
    width: 226.77,
    headerStyle: 'centered',
    fontSize: { store: 11, header: 8, body: 7, small: 6 },
    itemLayout: 'compact',
    separatorStyle: 'stars',
    showElements: { barcode: true, storeNumber: true, cashier: true, paymentDetails: true }
  }
];

export function getDesignForCompany(index: number): ReceiptDesign {
  return DESIGNS[index % DESIGNS.length];
}

export function drawSeparator(doc: PDFKit.PDFDocument, style: string, y: number, width: number): void {
  const startX = 15;
  const endX = width - 15;
  
  switch (style) {
    case 'dashed':
      doc.moveTo(startX, y).lineTo(endX, y).dash(3, { space: 2 }).stroke().undash();
      break;
    case 'solid':
      doc.moveTo(startX, y).lineTo(endX, y).stroke();
      break;
    case 'double':
      doc.moveTo(startX, y).lineTo(endX, y).stroke();
      doc.moveTo(startX, y + 2).lineTo(endX, y + 2).stroke();
      break;
    case 'stars':
      doc.fontSize(7).font('Courier').text('* * * * * * * * * * * * * * * * * * * *', startX, y);
      break;
    case 'equals':
      doc.fontSize(7).font('Courier').text('========================================', startX, y);
      break;
  }
}

export function drawBarcode(doc: PDFKit.PDFDocument, code: string, x: number, y: number, width: number): void {
  const barcodeWidth = width - 30;
  const barcodeHeight = 35;
  
  for (let i = 0; i < 60; i++) {
    const lineWidth = Math.random() > 0.5 ? 2 : 1;
    doc.rect(x + 15 + (i * (barcodeWidth / 60)), y, lineWidth, barcodeHeight).fill('#000000');
  }
  
  doc.fontSize(7).font('Courier').text(code, x, y + barcodeHeight + 3, { width: width, align: 'center' });
}
