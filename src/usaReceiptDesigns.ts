import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { Receipt, ReceiptItem } from './types';

// Use require for svg-to-pdfkit to avoid TypeScript issues with ts-node
const SVGtoPDF = require('svg-to-pdfkit');

// Company-specific receipt generators matching VISA.pdf designs

export class ONE9FuelReceiptGenerator {
  async generate(receipt: Receipt, outputPath: string): Promise<void> {
    const doc = new PDFDocument({ size: [280, 800], margin: 15, autoFirstPage: false });
    const fontPath = path.join(__dirname, '../fonts/ocr_b_becker.ttf');
    doc.registerFont('OCR-B', fontPath);

    doc.addPage({ size: [280, 800], margin: 15 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const leftMargin = 15;

    // Load and display ONE 9 logo image at the top (jpeg/png)
    try {
      const jpegPath = path.resolve(process.cwd(), 'assets/logos/one9-logo.jpeg');
      const pngPath = path.resolve(process.cwd(), 'assets/logos/one9-logo.png');
      const chosenPath = fs.existsSync(jpegPath) ? jpegPath : (fs.existsSync(pngPath) ? pngPath : '');
      if (!chosenPath) throw new Error('ONE 9 logo image not found');

      const logoWidth = 140;
      const logoHeight = 70;
      const logoX = (doc.page.width - logoWidth) / 2;
      const currentY = doc.y;
      doc.image(chosenPath, logoX, currentY, { width: logoWidth, height: logoHeight, align: 'center' });
      doc.y = currentY + logoHeight + 5;
    } catch (error) {
      // Fallback to text if image can't be loaded
      console.error('Error loading ONE 9 logo:', error);
      doc.fontSize(38).font('OCR-B').text('ONE 9', { align: 'center' });
      doc.moveDown(0.1);
      doc.fontSize(11).font('OCR-B').text('FUEL NETWORK.', { align: 'center' });
      doc.moveDown(0.8);
    }

    // Store info centered - use dynamic data from selected store or fallback to hardcoded
    const storeNumber = receipt.companyData?.storeNumber || '088';
    const address = receipt.companyData?.address || '4455 King Street';
    const cityState = receipt.companyData?.city || 'Cocoa , FL 32926';
    const phone = receipt.companyData?.phone || '(321) 639-0346';
    
    doc.fontSize(9).font('OCR-B').text(`STORE ${storeNumber}`, { align: 'center' });
    doc.fontSize(9).text(address, { align: 'center' });
    doc.fontSize(9).text(cityState, { align: 'center' });
    doc.fontSize(9).text(phone, { align: 'center' });
    doc.fontSize(9).text(receipt.date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }), { align: 'center' });
    doc.moveDown(0.8);

    // SALE section
    doc.fontSize(10).font('OCR-B').text('SALE', leftMargin);
    doc.fontSize(9).font('OCR-B').text(`Transaction #:    ${receipt.receiptNumber.replace('REC-', '')}`, leftMargin);
    
    // Dashed separator
    doc.fontSize(7).font('OCR-B').text('---------------------------------------------------------', leftMargin);
    
    // Table header - Petro-Canada style (QTY first, then NAME)
    const headerLine = 'Qty'.padEnd(5) + 'Name'.padEnd(20) + 'Price'.padEnd(8) + 'Total';
    doc.fontSize(10).font('OCR-B').text(headerLine, leftMargin);
    doc.fontSize(7).font('OCR-B').text('---------------------------------------------------------', leftMargin);

    // Calculate totals
    const subtotal = receipt.items.reduce((sum, item) => {
      const isCashAdvance = item.name.toLowerCase().includes('cash advance');
      // For cash advance, price is already the total (quantity is 1)
      // For regular items, calculate quantity * price
      return isCashAdvance ? sum + item.price : sum + (item.quantity * item.price);
    }, 0);
    
    // Items section - Petro-Canada style format (US units)
    receipt.items.forEach(item => {
      // Check if this is a cash advance item
      const isCashAdvance = item.name.toLowerCase().includes('cash advance');
      
      // Calculate totals for all items
      const total = isCashAdvance ? item.price : (item.quantity * item.price);
      
      // Display item in Petro-Canada style format with proper alignment
      const qtyDisplay = item.qty || 1;
      const qtyStr = qtyDisplay.toString();
      
      // Format item line: name (padded to 20) + qty (padded to 5) + price (padded to 7) + total
      // For cash advance, show the price as the price; for regular items, show price per gallon
      const itemLine = qtyStr.padEnd(5) + item.name.padEnd(20) + total.toFixed(2).padEnd(8) + total.toFixed(2);
      doc.fontSize(10).font('OCR-B').text(itemLine, leftMargin);
      
      // Fuel details - use US units (Gallons instead of Liters) - only for non-cash advance items
      if (!isCashAdvance) {
        const pumpNumber = item.pump !== undefined && item.pump !== null ? item.pump : Math.floor(Math.random() * 15) + 1;
        const gallons = item.quantity.toFixed(3);  // quantity is gallons
        const pricePerGallon = item.price.toFixed(3);  // price is price per gallon

        console.log('Receipt - Item:', { pump: item.pump, qty: item.qty, pumpNumber });

        // Align the values by using consistent padding (same as Petro-Canada style)
        doc.fontSize(10).font('OCR-B').text(` Pump:        ${pumpNumber}`, leftMargin + 35);
        doc.fontSize(10).font('OCR-B').text(` Gallons:     ${gallons}`, leftMargin + 35);
        doc.fontSize(10).font('OCR-B').text(` Price / Gal: ${pricePerGallon}`, leftMargin + 35);
      }
      
      doc.moveDown(1);
    });
    
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);

    // Totals section - matching screenshot exactly
    const salesTax = 0.00;
    const total = subtotal + salesTax;

    doc.fontSize(9).font('OCR-B').text('Subtotal', leftMargin, doc.y, { continued: true, width: 245 });
    doc.text(subtotal.toFixed(2), { align: 'right', width: 245 });
    
    doc.fontSize(9).text('Sales Tax', leftMargin, doc.y, { continued: true, width: 245 });
    doc.text(salesTax.toFixed(2), { align: 'right', width: 245 });
    
    doc.fontSize(7).font('OCR-B').text('---------------------------------------------------------', leftMargin);
    
    doc.fontSize(9).font('OCR-B').text('Total', leftMargin, doc.y, { continued: true, width: 245 });
    doc.text(total.toFixed(2), { align: 'right', width: 245 });
    
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
    doc.moveDown(0.3);

    // Received / Payment section - matching screenshot exactly
    const paymentMethodText = receipt.paymentMethod || 'Visa';
    
    // Show card details for Visa and Master payments
    if (receipt.paymentMethod === 'Visa' && receipt.cardLast4) {
      doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
    let displayPaymentMethod = paymentMethodText;
    if (paymentMethodText === 'EFS') {
      displayPaymentMethod = 'EFS LLC Checks';
    } else if (paymentMethodText === 'TCH') {
      displayPaymentMethod = 'TCH Card';
    }
      doc.fontSize(9).text(`  ${displayPaymentMethod}`, leftMargin, doc.y, { continued: true, width: 245 });
      doc.text(total.toFixed(2), { align: 'right', width: 245 });
    
      const last4 = receipt.cardLast4;
      const entryMethod = receipt.cardEntryMethod || 'INSERT';
      doc.fontSize(9).text(`  XXXXXXXXXXXX${last4}    ${entryMethod}`, leftMargin);
      doc.fontSize(9).text('  Approved', leftMargin);
      
      // Generate random authorization number (5 alphanumeric characters)
      const authNum = Math.random().toString(36).substring(2, 7).toUpperCase();
      doc.fontSize(9).text(`  Auth #:  ${authNum}`, leftMargin);
    } else if (receipt.paymentMethod === 'Master' && receipt.cardLast4) {
      // Master payment format - match screenshot exactly
      doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
      
      // MC on next line
      doc.fontSize(9).font('OCR-B').text('MC', leftMargin + 10, doc.y, { continued: true, width: 235 });
      doc.text(total.toFixed(2), { align: 'right', width: 235 });
      
      // Card number with INSERT and amount on the right
      const last4 = receipt.cardLast4;
      const entryMethod = receipt.cardEntryMethod === 'INSERT' ? 'INSERT' : 
                          receipt.cardEntryMethod === 'TAP' ? 'TAP' : 'SWIPED';
      doc.fontSize(9).font('OCR-B').text(`XXXXXXXXXXXX${last4}    ${entryMethod}`, leftMargin + 10,);
      
      doc.fontSize(9).font('OCR-B').text('Approved', leftMargin + 10);
      
      // Generate random authorization number (6 digits for Master, e.g., 054292)
      const authNum = Math.floor(Math.random() * 900000) + 100000;
      doc.fontSize(9).font('OCR-B').text(`Auth #: ${authNum.toString().padStart(6, '0')}`, leftMargin + 10);
      doc.moveDown(0.8);
      
      // Transaction Details
      doc.fontSize(9).font('OCR-B').text('TYPE: COMPLETION', leftMargin);
      doc.moveDown(0.3);
      doc.fontSize(9).font('OCR-B').text('MASTERCARD    (C)', leftMargin);
      doc.moveDown(0.3);
      
      // AID (standard Mastercard AID)
      doc.fontSize(9).font('OCR-B').text('AID: A0000000041010', leftMargin);
      doc.moveDown(0.3);
      
      // TVR (10 hex digits, e.g., 0400008000)
      const tvr = Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
      doc.fontSize(9).font('OCR-B').text(`TVR: ${tvr}`, leftMargin);
      doc.moveDown(0.3);
      
      // IAD (32 hex digits followed by FF, e.g., 0110A0023324000000000000000000FF)
      const iad = Array.from({ length: 30 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('') + 'FF';
      doc.fontSize(9).font('OCR-B').text(`IAD: ${iad}`, leftMargin);
      doc.moveDown(0.3);
      
      // TSI (4 hex digits, e.g., E800)
      const tsi = Array.from({ length: 4 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
      doc.fontSize(9).font('OCR-B').text(`TSI: ${tsi}`, leftMargin);
      doc.moveDown(0.3);
      
      // ARC (2 characters, e.g., 23)
      const arcChars = ['23', '00', '01', '02', '03', '04', '05'];
      const arc = arcChars[Math.floor(Math.random() * arcChars.length)];
      doc.fontSize(9).font('OCR-B').text(`ARC: ${arc}`, leftMargin);
      doc.moveDown(0.8);
      
      // Important notice
      doc.fontSize(9).font('OCR-B').text('IMPORTANT - Retain this copy for your records.', leftMargin);
      doc.moveDown(0.8);
    } else if (receipt.paymentMethod === 'TCH' && receipt.cardLast4) {
      // TCH payment method - show Received section with amount
      doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
      doc.fontSize(9).font('OCR-B').text('TCH', leftMargin + 10, doc.y, { continued: true, width: 245 });
      doc.fontSize(9).font('OCR-B').text(total.toFixed(2), { align: 'right', width: 245 });
      doc.moveDown(0.5);
      
      // Card details
      const last4 = receipt.cardLast4;
      const entryMethod = receipt.cardEntryMethod === 'INSERT' ? 'INSERT' : 
                          receipt.cardEntryMethod === 'TAP' ? 'TAP' : 'SWIPED';
      doc.fontSize(9).text(`  XXXXXXXXXXXX${last4}    ${entryMethod}`, leftMargin);
      doc.fontSize(9).text('  Approved', leftMargin);
      
      // Generate random authorization number (6 digits for TCH)
      const authNum = Math.floor(Math.random() * 900000) + 100000;
      doc.fontSize(9).text(`  Auth #:  ${authNum}`, leftMargin);
      doc.moveDown(0.5);
      
      // TCH company name - exactly as in screenshot
      const userCompanyName = receipt.driverCompanyName || 'ACG';
      const truckingCompany = `TruckingCompanyNameTCI    ${userCompanyName}`;
      doc.fontSize(9).font('OCR-B').text(truckingCompany, leftMargin);
    } else if (receipt.paymentMethod === 'EFS') {
      // EFS payment method - match screenshot exactly
      
      // Received section - show EFS LLC Checks with amount
      doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
      doc.fontSize(9).font('OCR-B').text('EFS LLC Checks', leftMargin, doc.y, { continued: true, width: 245 });
      doc.fontSize(9).font('OCR-B').text(total.toFixed(2), { align: 'right', width: 245 });
      doc.moveDown(0.5);
      
      // Transaction details - exactly as in screenshot
      doc.fontSize(9).font('OCR-B').text('  Tran/Route #:', leftMargin);
      doc.fontSize(9).font('OCR-B').text('  Account #:', leftMargin);
      doc.fontSize(9).font('OCR-B').text('  Check #:', leftMargin);
      doc.fontSize(9).font('OCR-B').text(`  Tran Amount : $ ${total.toFixed(2)}`, leftMargin);
      
      // Generate random approval code (6 digits)
      const approvalCode = Math.floor(Math.random() * 900000) + 100000;
      doc.fontSize(9).font('OCR-B').text('  Approval CD :', leftMargin, doc.y, { continued: true });
      doc.text(`${approvalCode}`, leftMargin + 5);
      
      doc.fontSize(9).font('OCR-B').text('  Record #:', leftMargin);
      
      // Generate random clerk ID (4 digits)
      const clerkId = Math.floor(Math.random() * 9000) + 1000;
      doc.fontSize(9).font('OCR-B').text('  Clerk ID:', leftMargin, doc.y, { continued: true });
      doc.text(`${clerkId}`, leftMargin + 5);
      
      doc.fontSize(9).font('OCR-B').text('  Reference #:', leftMargin);
      
      // Generate random transaction reference (12 digits)
      const tranRef = Math.floor(Math.random() * 1000000000000);
      doc.fontSize(9).font('OCR-B').text('  Tran Ref:', leftMargin, doc.y, { continued: true });
      doc.text(`${tranRef.toString().padStart(12, '0')}`, leftMargin + 5);
      
      doc.fontSize(9).font('OCR-B').text('  Tran ID:', leftMargin);
      doc.fontSize(9).font('OCR-B').text('  Approval #:', leftMargin, doc.y, { continued: true });
      doc.text(`${approvalCode}`, leftMargin + 5);
      doc.moveDown(0.5);
      
      // Instruction - exactly as in screenshot
      doc.fontSize(9).font('OCR-B').text('Please destroy check', leftMargin + 20);
      doc.moveDown(2);

      doc.fontSize(7).font('OCR-B').text('-------------------------------------------------', leftMargin);
      doc.moveDown(1);
      
      // Authorization section with signature line
      doc.fontSize(9).font('OCR-B').text('Auth #:', leftMargin + 10, doc.y, { continued: true });
      doc.text(`${approvalCode}`, leftMargin + 10);
      doc.moveDown(0.8);
      
      // Add signature image only if checkbox is checked
      const includeSignature = receipt.includeSignature;
      if (includeSignature) {
        try {
          const signaturePath = path.resolve(process.cwd(), 'assets/signatures/signature.jpeg');
          console.log('Looking for signature at:', signaturePath);
          if (fs.existsSync(signaturePath)) {
            console.log('Signature file found, loading...');
            const signatureWidth = 80;
            const signatureHeight = 20;
            const signatureX = (doc.page.width - signatureWidth) / 2; // Center the signature
            const signatureY = doc.y;
            
            // Try to load the image with error handling for corrupted JPEGs
            try {
              doc.image(signaturePath, signatureX, signatureY, {
                width: signatureWidth,
                height: signatureHeight
              });
              doc.y = signatureY + signatureHeight + 10;
              console.log('Signature loaded successfully');
            } catch (imageError) {
              console.error('Error loading signature image (corrupted JPEG):', imageError instanceof Error ? imageError.message : String(imageError));
              // Fallback: draw a signature line instead
              doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
              doc.y = signatureY + 15;
              console.log('Used signature line fallback');
            }
          } else {
            console.log('Signature file not found at:', signaturePath);
            // Fallback: draw a signature line
            doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
            doc.moveDown(1);
          }
        } catch (error) {
          console.error('Error loading signature:', error);
          // Fallback: draw a signature line
          doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
          doc.moveDown(1);
        }
      } else {
        console.log('Signature checkbox not checked, skipping signature');
        doc.moveDown(1);
      }

      doc.fontSize(7).font('OCR-B').text('-------------------------------------------------', leftMargin);
      doc.moveDown(1);
      
      // Vehicle and company details - exactly as in screenshot
      const vehicleId = receipt.vehicleId || 'bb16312';
      const dlState = 'on'; // From screenshot
      const companyName = receipt.driverCompanyName || 'MCMPLOGISTICSINC';
      
      doc.fontSize(9).font('OCR-B').text(`VehicleID`, leftMargin, doc.y, { continued: true });
      doc.text(vehicleId, leftMargin + 30);
      doc.fontSize(9).font('OCR-B').text(`DLState`, leftMargin, doc.y, { continued: true });
      doc.text(dlState, leftMargin + 70);
      doc.fontSize(9).font('OCR-B').text(`CompanyName`, leftMargin, doc.y, { continued: true });
      doc.text(companyName, leftMargin + 30);
      doc.fontSize(9).font('OCR-B').text(`Odometer`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`HubOdometer`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`TrailerID`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`TripNumber`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`UnitLicenseNumber`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`UnitLicenseState`, leftMargin);
    } else if (receipt.paymentMethod === 'Cash') {
      // Cash payment method - show Received section with amount
      doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
      doc.fontSize(9).font('OCR-B').text('Cash', leftMargin + 10, doc.y, { continued: true, width: 238 });
      doc.fontSize(9).font('OCR-B').text(total.toFixed(2), { align: 'right', width: 238 });
      doc.moveDown(0.5);
      
      // Show vehicle and company details
      const vehicleId = receipt.vehicleId || 'm121';
      const companyName = receipt.driverCompanyName || 'mcmp';
      
      doc.fontSize(9).font('OCR-B').text(`VehicleID`, leftMargin, doc.y, { continued: true });
      doc.text(vehicleId, leftMargin + 40);
      doc.fontSize(9).font('OCR-B').text(`CompanyName`, leftMargin, doc.y, { continued: true });
      doc.text(companyName, leftMargin + 30);
      doc.fontSize(9).font('OCR-B').text(`Odometer`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`TripNumber`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`TrailerID`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`UnitLicenseNumber`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`UnitLicenseState`, leftMargin);
    }
    doc.moveDown(0.5);

    // Transaction details - show for Visa and Master payments
    if (receipt.paymentMethod === 'Visa') {
      doc.fontSize(9).font('OCR-B').text('TYPE: COMPLETION', leftMargin);
      doc.fontSize(9).text(`${paymentMethodText.toUpperCase()} CREDIT    (C)`, leftMargin);
      // Generate random AID (Application Identifier)
      const aid = `A${Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0')}`;
      doc.fontSize(9).text(`AID: ${aid}`, leftMargin);
      
      // Generate random TVR (Terminal Verification Results)
      const tvr = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
      doc.fontSize(9).text(`TVR: ${tvr}`, leftMargin);
      
      // Generate random IAD (Issuer Application Data)
      const iad = Math.floor(Math.random() * 1000000000000000).toString(16).toUpperCase().padStart(16, '0');
      doc.fontSize(9).text(`IAD: ${iad}`, leftMargin);
      
      // Generate random TSI (Transaction Status Information)
      const tsi = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      doc.fontSize(9).text(`TSI: ${tsi}`, leftMargin);
      
      // Generate random ARC (Authorization Response Code)
      const arcCodes = ['Z3', 'A1', 'B2', 'C4', 'D5', 'E6', 'F7', 'G8', 'H9', 'I0'];
      const arc = arcCodes[Math.floor(Math.random() * arcCodes.length)];
      doc.fontSize(9).text(`ARC: ${arc}`, leftMargin);
      doc.moveDown(0.8);

      // Verification - exactly as in screenshot
      doc.fontSize(9).font('OCR-B').text('Verified by PIN', leftMargin);
      doc.moveDown(0.5);
    }
    
    // Customer copy section - show for Visa and Master payments
    if (receipt.paymentMethod === 'Visa') {
      doc.fontSize(9).text('CUSTOMER COPY', leftMargin);
      const labelMargin = leftMargin + 2;
      const valueMargin = leftMargin + 25;
      
      // Use user-entered vehicle details or fallback to defaults
      const vehicleId = receipt.vehicleId || '101';
      const companyName = receipt.driverCompanyName || 'MCMPLOGISTICSINC';
      
      doc.fontSize(9).text('VehicleID', labelMargin, doc.y, { continued: true });
      doc.text(`    ${vehicleId}`, labelMargin + 12);
      doc.fontSize(9).text('CompanyName', labelMargin, doc.y, { continued: true });
      doc.text(companyName, valueMargin);
      doc.fontSize(9).text('Odometer', labelMargin);
      doc.fontSize(9).text('TripNumber', labelMargin);
    } else if (receipt.paymentMethod === 'Master') {
      // CUSTOMER COPY section - match screenshot format
      doc.fontSize(9).font('OCR-B').text('CUSTOMER COPY', leftMargin);
      doc.moveDown(0.5);
      
      const vehicleId = receipt.vehicleId || '107';
      const companyName = receipt.driverCompanyName || 'MCMP';
      
      // VehicleID with value on the right
      doc.fontSize(9).font('OCR-B').text('VehicleID', leftMargin, doc.y, { continued: true, width: 205 });
      doc.text(vehicleId, { align: 'right', width: 205 });
      
      // CompanyName with value on the right
      doc.fontSize(9).font('OCR-B').text('CompanyName', leftMargin, doc.y, { continued: true, width: 205 });
      doc.text(companyName, { align: 'right', width: 205 });
      
      // Odometer (empty)
      doc.fontSize(9).font('OCR-B').text('Odometer', leftMargin);
      
      // TripNumber (empty)
      doc.fontSize(9).font('OCR-B').text('TripNumber', leftMargin);
      doc.moveDown(1.5);
      
      // Add signature image only if checkbox is checked
      const includeSignature = receipt.includeSignature;
      if (includeSignature) {
        try {
          const signaturePath = path.resolve(process.cwd(), 'assets/signatures/signature.jpeg');
          console.log('Looking for signature at:', signaturePath);
          if (fs.existsSync(signaturePath)) {
            console.log('Signature file found, loading...');
            const signatureWidth = 80;
            const signatureHeight = 20;
            const signatureX = (doc.page.width - signatureWidth) / 2; // Center the signature
            const signatureY = doc.y;
            
            // Try to load the image with error handling for corrupted JPEGs
            try {
              doc.image(signaturePath, signatureX, signatureY, {
                width: signatureWidth,
                height: signatureHeight
              });
              doc.y = signatureY + signatureHeight + 10;
              console.log('Signature loaded successfully');
            } catch (imageError) {
              console.error('Error loading signature image (corrupted JPEG):', imageError instanceof Error ? imageError.message : String(imageError));
              // Fallback: draw a signature line instead
              doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
              doc.y = signatureY + 15;
              console.log('Used signature line fallback');
            }
          } else {
            console.log('Signature file not found at:', signaturePath);
            // Fallback: draw a signature line
            doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
            doc.moveDown(1);
          }
        } catch (error) {
          console.error('Error loading signature:', error);
          // Fallback: draw a signature line
          doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
          doc.moveDown(1);
        }
      } else {
        console.log('Signature checkbox not checked, skipping signature');
        doc.moveDown(1);
      }
    }

    doc.end();
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });
  }
}
export class PilotTravelCentersReceiptGenerator {
  async generate(receipt: Receipt, outputPath: string): Promise<void> {
    const doc = new PDFDocument({ size: [280, 800], margin: 15, autoFirstPage: false });
    const fontPath = path.join(__dirname, '../fonts/ocr_b_becker.ttf');
    doc.registerFont('OCR-B', fontPath);
    doc.addPage({ size: [280, 800], margin: 15 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const leftMargin = 15;

    // Load and display Pilot logo at the top
    try {
      const logoPath = path.resolve(process.cwd(), 'assets/logos/pilot-logo.jpeg');
      
      if (fs.existsSync(logoPath)) {
        const logoWidth = 430;
        const logoHeight = 80;
        const logoX = (doc.page.width - logoWidth) / 2;
        const currentY = doc.y;
        
        doc.image(logoPath, logoX, currentY, {
          width: logoWidth,
          height: logoHeight,
          align: 'center'
        });
        
        doc.y = currentY + logoHeight;
      } else {
        // Fallback to text if logo not found
        doc.fontSize(28).font('OCR-B').text('PILOT', { align: 'center' });
        doc.moveDown(0.5);
      }
    } catch (error) {
      // Fallback to text if logo can't be loaded
      console.error('Error loading Pilot logo:', error);
      doc.fontSize(28).font('OCR-B').text('PILOT', { align: 'center' });
      doc.moveDown(0.5);
    }

    // Store info centered - use dynamic data from selected store or fallback to hardcoded
    const storeNumber = receipt.companyData?.storeNumber || '4649';
    const address = receipt.companyData?.address || '713 Oakland Circle';
    const cityState = receipt.companyData?.city || 'Raphine, VA 24472';
    const phone = receipt.companyData?.phone || '(540) 377-923';
    
    // SALE section - show simple format for all payment methods including Master
    // Show store info (centered format matching screenshot 1)
    doc.fontSize(9).font('OCR-B').text(`STORE ${storeNumber}`, { align: 'center' });
      doc.fontSize(9).text(address, { align: 'center' });
      doc.fontSize(9).text(cityState, { align: 'center' });
      doc.fontSize(9).text(phone, { align: 'center' });
      doc.fontSize(9).text(receipt.date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }), { align: 'center' });
      doc.moveDown(0.8);
      
    // Show SALE and Transaction # format
    doc.fontSize(10).font('OCR-B').text('SALE', leftMargin);
    doc.fontSize(9).font('OCR-B').text(`Transaction #:    ${receipt.receiptNumber.replace('REC-', '')}`, leftMargin, doc.y, { continued: true, width: 240 });
    
    // Dashed separator
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
    
    // Table header - Petro-Canada style (QTY first, then NAME)
    const headerLine = 'Qty'.padEnd(5) + 'Name'.padEnd(20) + 'Price'.padEnd(9) + 'Total';
    doc.fontSize(10).font('OCR-B').text(headerLine, leftMargin);
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);

    // Calculate totals
    const subtotal = receipt.items.reduce((sum, item) => {
      const isCashAdvance = item.name.toLowerCase().includes('cash advance');
      // For cash advance, price is already the total (quantity is 1)
      // For regular items, calculate quantity * price
      return isCashAdvance ? sum + item.price : sum + (item.quantity * item.price);
    }, 0);
    
    // Items section - Petro-Canada style format (US units)
    receipt.items.forEach(item => {
      // Check if this is a cash advance item
      const isCashAdvance = item.name.toLowerCase().includes('cash advance');
      
      // Calculate totals for all items
      const total = isCashAdvance ? item.price : (item.quantity * item.price);
      
      // Display item in Petro-Canada style format with proper alignment
      const qtyDisplay = item.qty || 1;
      const qtyStr = qtyDisplay.toString();
      
      // Format item line: name (padded to 20) + qty (padded to 5) + price (padded to 7) + total
      // For cash advance, show the price as the price; for regular items, show price per gallon
      const itemLine = qtyStr.padEnd(5) + item.name.padEnd(20) + total.toFixed(2).padEnd(9) + total.toFixed(2);
      doc.fontSize(10).font('OCR-B').text(itemLine, leftMargin);
      
      // Fuel details - use US units (Gallons instead of Liters) - only for non-cash advance items
      if (!isCashAdvance) {
        const pumpNumber = item.pump !== undefined && item.pump !== null ? item.pump : Math.floor(Math.random() * 15) + 1;
        const gallons = item.quantity.toFixed(3);  // quantity is gallons
        const pricePerGallon = item.price.toFixed(3);  // price is price per gallon
        
        console.log('Receipt - Item:', { pump: item.pump, qty: item.qty, pumpNumber });
        
        // Align the values by using consistent padding (same as Petro-Canada style)
        doc.fontSize(10).font('OCR-B').text(` Pump:        ${pumpNumber}`, leftMargin + 35);
        doc.fontSize(10).font('OCR-B').text(` Gallons:     ${gallons}`, leftMargin + 35);
        doc.fontSize(10).font('OCR-B').text(` Price / Gal: ${pricePerGallon}`, leftMargin + 35);
      }
      
      doc.moveDown(1);
    });
    
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);

    // Totals section - matching screenshot exactly
    const salesTax = 0.00;
    const total = subtotal + salesTax;

    doc.fontSize(9).font('OCR-B').text('Subtotal', leftMargin, doc.y, { continued: true, width: 240 });
    doc.text(subtotal.toFixed(2), { align: 'right', width: 240 });
    
    doc.fontSize(9).text('Sales Tax', leftMargin, doc.y, { continued: true, width: 240 });
    doc.text(salesTax.toFixed(2), { align: 'right', width: 240 });
    
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
    
    doc.fontSize(9).font('OCR-B').text('Total', leftMargin, doc.y, { continued: true, width: 240 });
    doc.text(total.toFixed(2), { align: 'right', width: 240 });
    
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
    doc.moveDown(0.3);

    // Received / Payment section - matching screenshot exactly
    const paymentMethodText = receipt.paymentMethod || 'Visa';
    let displayPaymentMethod = paymentMethodText;
    if (paymentMethodText === 'EFS') {
      displayPaymentMethod = 'EFS LLC Checks';
    } else if (paymentMethodText === 'TCH') {
      displayPaymentMethod = 'TCH';
    } else if (paymentMethodText === 'Master') {
      // For Master payment, show "MC" and format differently
      displayPaymentMethod = 'MC';
    } else {
      displayPaymentMethod = paymentMethodText;
    }
    
    // Show card details for Visa and Master payments
    if (receipt.paymentMethod === 'Visa' && receipt.cardLast4) {
      // Visa payment format matching screenshot
      const last4 = receipt.cardLast4;
      const entryMethod = receipt.cardEntryMethod === 'INSERT' ? 'INSERT' : 
                          receipt.cardEntryMethod === 'TAP' ? 'TAP' : 'SWIPED';
      
      // Received section - show Visa with amount
      doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
      
      // Visa with amount on the right
      doc.fontSize(9).font('OCR-B').text('Visa', leftMargin + 10, doc.y, { continued: true, width: 240 });
      doc.fontSize(9).font('OCR-B').text(total.toFixed(2), { align: 'right', width: 240 });
      
      // Card number with INSERT on the right
      doc.fontSize(9).font('OCR-B').text(`XXXXXXXXXXXX${last4}`, leftMargin + 10, doc.y, { continued: true, width: 150 });
      doc.fontSize(9).font('OCR-B').text(entryMethod, { align: 'right', width: 150 });
      
      // Approved on new line
      doc.fontSize(9).font('OCR-B').text('Approved', leftMargin + 10);
      
      // Generate authorization code (5 digits + letter, e.g., "06526F")
      const authCodeDigits = Math.floor(Math.random() * 90000) + 10000; // 5-digit number
      const authCodeLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // Random letter A-Z
      const authCode = `${authCodeDigits.toString().padStart(5, '0')}${authCodeLetter}`;
      doc.fontSize(9).text(`Auth #: ${authCode}`, leftMargin + 10);
      doc.moveDown(0.8);
      
      // Transaction Details
      doc.fontSize(9).font('OCR-B').text('TYPE: COMPLETION', leftMargin);
      doc.fontSize(9).font('OCR-B').text('VISA CREDIT (C)', leftMargin);
      
      // AID - randomly generate AID (Application Identifier) for Visa
      const aidVisa = `A${Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0')}`;
      doc.fontSize(9).font('OCR-B').text(`AID: ${aidVisa}`, leftMargin);
      
      // TVR - randomly generate TVR (Terminal Verification Results)
      const tvr = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
      doc.fontSize(9).font('OCR-B').text(`TVR: ${tvr}`, leftMargin);
      
      // IAD - randomly generate IAD (Issuer Application Data) as hex string
      const iad = Array.from({ length: 14 }, () => {
        const chars = '0123456789ABCDEF';
        return chars[Math.floor(Math.random() * chars.length)];
      }).join('');
      doc.fontSize(9).font('OCR-B').text(`IAD: ${iad}`, leftMargin);
      
      // TSI - randomly generate TSI (Transaction Status Information) as hex
      const tsi = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
      doc.fontSize(9).font('OCR-B').text(`TSI: ${tsi}`, leftMargin);
      
      // ARC - randomly generate ARC (Authorization Response Code)
      const arcChars = ['Z3', 'A1', 'B2', 'C4', 'D5', 'E6', 'F7', 'G8', 'H9', 'I0', 'J1', 'K2', 'L3', 'M4', 'N5', 'O6', 'P7', 'Q8', 'R9', 'S0'];
      const arc = arcChars[Math.floor(Math.random() * arcChars.length)];
      doc.fontSize(9).font('OCR-B').text(`ARC: ${arc}`, leftMargin);
      doc.moveDown(1.5);
      
      // Verified by PIN
      doc.fontSize(9).font('OCR-B').text('Verified by PIN', leftMargin);
      doc.moveDown(0.8);
      // Important notice
      doc.fontSize(9).font('OCR-B').text('IMPORTANT - Retain this copy for your records.', leftMargin);
      doc.moveDown(1);
      
      // CUSTOMER COPY section
      doc.fontSize(9).font('OCR-B').text('CUSTOMER COPY', leftMargin);
      const companyName = receipt.driverCompanyName || '';
      const vehicleId = receipt.vehicleId || '';

      // Show Company Name and Vehicle ID - match screenshot format
      doc.fontSize(9).font('OCR-B').text(`CompanyName:   ${companyName.toUpperCase()}`, leftMargin + 20);
      doc.fontSize(9).font('OCR-B').text(`VehicleID:    ${vehicleId}`, leftMargin + 22);
      doc.fontSize(9).font('OCR-B').text('Odometer:', leftMargin + 10);
      doc.fontSize(9).font('OCR-B').text('TripNumber:', leftMargin + 10);
      doc.moveDown(1.5);
      
      // Add signature image only if checkbox is checked
      const includeSignature = receipt.includeSignature;
      if (includeSignature) {
        try {
          const signaturePath = path.resolve(process.cwd(), 'assets/signatures/signature.jpeg');
          if (fs.existsSync(signaturePath)) {
            const signatureWidth = 80;
            const signatureHeight = 20;
            const signatureX = (doc.page.width - signatureWidth) / 2; // Center the signature
            const signatureY = doc.y;
            
            try {
              doc.image(signaturePath, signatureX, signatureY, {
                width: signatureWidth,
                height: signatureHeight
              });
              doc.y = signatureY + signatureHeight + 10;
            } catch (imageError) {
              doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
              doc.y = signatureY + 15;
            }
          } else {
            doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
            doc.moveDown(1);
          }
        } catch (error) {
          doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
          doc.moveDown(1);
        }
      } else {
        doc.moveDown(0.5);
      }
      
      doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
    } else if (receipt.paymentMethod === 'Master' && receipt.cardLast4) {
      // Master payment format matching screenshot
      const last4 = receipt.cardLast4;
      const entryMethod = receipt.cardEntryMethod === 'INSERT' ? 'INSERT' : 
                          receipt.cardEntryMethod === 'TAP' ? 'TAP' : 'SWIPED';
      
      // Received section - show MC with amount (matching EFS format)
      doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
      
      // MC with amount on the right
      doc.fontSize(9).font('OCR-B').text('MC', leftMargin + 10, doc.y, { continued: true, width: 240 });
      doc.fontSize(9).font('OCR-B').text(total.toFixed(2), { align: 'right', width: 240 });
      doc.moveDown(0.3);
      
      // Card number with INSERT on the right
      doc.fontSize(9).font('OCR-B').text(`XXXXXXXXXXXXX${last4}`, leftMargin + 10, doc.y, { continued: true, width: 150 });
      doc.fontSize(9).font('OCR-B').text(entryMethod, { align: 'right', width: 150 });
      doc.moveDown(0.3);
      
      // Approved on new line
      doc.fontSize(9).font('OCR-B').text('Approved', leftMargin + 10);
      doc.moveDown(0.3);
      
      // Generate authorization code (5 digits + letter, e.g., "06677Z")
      const authCodeDigits = Math.floor(Math.random() * 90000) + 10000; // 5-digit number
      const authCodeLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // Random letter A-Z
      const authCode = `${authCodeDigits.toString().padStart(5, '0')}${authCodeLetter}`;
      doc.fontSize(9).text(`Auth #: ${authCode}`, leftMargin + 10);
      doc.moveDown(0.8);
      
      // Transaction Details
      doc.fontSize(9).font('OCR-B').text('TYPE: COMPLETION', leftMargin);
      doc.moveDown(0.3);
      doc.fontSize(9).font('OCR-B').text('Mastercard    (C)', leftMargin);
      doc.moveDown(0.3);
      
      // AID
      // Randomly generate AID (Application Identifier) for Master
      const aidMaster = `A${Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0')}`;
      doc.fontSize(9).font('OCR-B').text(`AID: ${aidMaster}`, leftMargin);
      doc.moveDown(0.3);
      
      // TVR
      const tvr = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
      doc.fontSize(9).font('OCR-B').text(`TVR: ${tvr}`, leftMargin);
      doc.moveDown(0.3);
      
      // IAD (long hex string)
      const iad = `0110A00003240000000000000000000000FF`;
      doc.fontSize(9).font('OCR-B').text(`IAD: ${iad}`, leftMargin);
      doc.moveDown(0.3);
      
      // TSI
      const tsi = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
      doc.fontSize(9).font('OCR-B').text(`TSI: ${tsi}`, leftMargin);
      doc.moveDown(0.3);
      
      // ARC (2 characters)
      const arcChars = ['Z3', 'A1', 'B2', 'C4', 'D5', 'E6', 'F7', 'G8', 'H9', 'I0'];
      const arc = arcChars[Math.floor(Math.random() * arcChars.length)];
      doc.fontSize(9).font('OCR-B').text(`ARC: ${arc}`, leftMargin);
      doc.moveDown(1.5);
      
      // Important notice
      doc.fontSize(9).font('OCR-B').text('IMPORTANT - Retain this copy for your records.', leftMargin);
      doc.moveDown(1);
      
      // CUSTOMER COPY section
      doc.fontSize(9).font('OCR-B').text('CUSTOMER COPY', leftMargin);
      const companyName = receipt.driverCompanyName || '';
      const vehicleId = receipt.vehicleId || '';

      // Always show the user-entered Vehicle ID if present
      doc.fontSize(9).font('OCR-B').text(`VehicleId:     ${vehicleId}`, leftMargin + 10);
      doc.fontSize(9).font('OCR-B').text(`CompanyName:   ${(companyName || '').toLowerCase()}`, leftMargin + 10);
      doc.fontSize(9).font('OCR-B').text('Odometer:', leftMargin + 10);
      doc.fontSize(9).font('OCR-B').text('TripNumber:', leftMargin + 10);
      doc.moveDown(1.5);
      
      // Add signature image only if checkbox is checked (same as Flying J Master)
      const includeSignature = receipt.includeSignature;
      if (includeSignature) {
        try {
          const signaturePath = path.resolve(process.cwd(), 'assets/signatures/signature.jpeg');
          console.log('Looking for signature at:', signaturePath);
          if (fs.existsSync(signaturePath)) {
            console.log('Signature file found, loading...');
            const signatureWidth = 80;
            const signatureHeight = 20;
            const signatureX = (doc.page.width - signatureWidth) / 2; // Center the signature
            const signatureY = doc.y;
            
            // Try to load the image with error handling for corrupted JPEGs
            try {
              doc.image(signaturePath, signatureX, signatureY, {
                width: signatureWidth,
                height: signatureHeight
              });
              doc.y = signatureY + signatureHeight + 10;
              console.log('Signature loaded successfully');
            } catch (imageError) {
              console.error('Error loading signature image (corrupted JPEG):', imageError instanceof Error ? imageError.message : String(imageError));
              // Fallback: draw a signature line instead
              doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
              doc.y = signatureY + 15;
              console.log('Used signature line fallback');
            }
          } else {
            console.log('Signature file not found at:', signaturePath);
            // Fallback: draw a signature line
            doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
            doc.moveDown(1);
          }
        } catch (error) {
          console.error('Error loading signature:', error);
          // Fallback: draw a signature line
          doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
          doc.moveDown(1);
        }
      } else {
        console.log('Signature checkbox not checked, skipping signature');
        doc.moveDown(0.5);
      }
      
      doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
      
      // Dashed horizontal line
    } else if (receipt.paymentMethod === 'TCH' && receipt.cardLast4) {
      // TCH payment method - show Received section with amount
      doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
      doc.fontSize(9).font('OCR-B').text('TCH', leftMargin + 5, doc.y, { continued: true, width: 240 });
      doc.fontSize(9).font('OCR-B').text(total.toFixed(2), { align: 'right', width: 240 });
      
      // Card details
      const last4 = receipt.cardLast4;
      const entryMethod = receipt.cardEntryMethod === 'INSERT' ? 'INSERT' : 
                          receipt.cardEntryMethod === 'TAP' ? 'TAP' : 'SWIPED';
      doc.fontSize(9).text(`XXXXXXXXXXXXXXX${last4}    ${entryMethod}`, leftMargin + 5);
      doc.fontSize(9).text('Approved', leftMargin + 5);
      
      // Generate random authorization number (6 digits for TCH)
      const authNum = Math.floor(Math.random() * 900000) + 100000;
      doc.fontSize(9).text(`Auth #:  ${authNum}`, leftMargin + 5);
      
      // Generate random invoice number (10 digits)
      const invoiceNum = Math.floor(Math.random() * 9000000000) + 1000000000;
      doc.fontSize(9).text(`Invoice Number: ${invoiceNum}`, leftMargin + 5);
      doc.moveDown(1);
      
      // Transaction type
      doc.fontSize(9).font('OCR-B').text('TYPE:    PURCHASE', leftMargin);
      doc.fontSize(9).font('OCR-B').text('TCH Card', leftMargin);
      doc.moveDown(2);
      
      // Important notice
      doc.fontSize(9).font('OCR-B').text('IMPORTANT  -  Retain this copy for your records.', leftMargin);
    } else if (receipt.paymentMethod === 'EFS') {
      // EFS payment method - match screenshot exactly
      
      // Received section - show EFS LLC Checks with amount
      doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
      doc.fontSize(9).font('OCR-B').text('EFS LLC Checks', leftMargin + 10, doc.y, { continued: true, width: 235 });
      doc.fontSize(9).font('OCR-B').text(total.toFixed(2), { align: 'right', width: 235 });
      
      // Transaction details - exactly as in screenshot
      doc.fontSize(9).font('OCR-B').text('Tran/Route #:', leftMargin);
      doc.fontSize(9).font('OCR-B').text('Account #:', leftMargin);
      doc.fontSize(9).font('OCR-B').text('Check #:', leftMargin);
      doc.fontSize(9).font('OCR-B').text(`Tran Amount :    $${total.toFixed(2)}`, leftMargin);
      
      // Generate random approval code (6 digits)
      const approvalCode = Math.floor(Math.random() * 900000) + 100000;
      doc.fontSize(9).font('OCR-B').text('Approval CD :   ', leftMargin, doc.y, { continued: true });
      doc.text(`${approvalCode}`);
      
      doc.fontSize(9).font('OCR-B').text('Record #:', leftMargin);
      
      // Generate random clerk ID (4 digits)
      const clerkId = Math.floor(Math.random() * 9000) + 1000;
      doc.fontSize(9).font('OCR-B').text('Clerk ID:   ', leftMargin, doc.y, { continued: true });
      doc.text(`${clerkId}`, leftMargin + 5);
      
      doc.fontSize(9).font('OCR-B').text('Reference #:', leftMargin);
      
      // Generate random transaction reference (12 digits)
      const tranRef = Math.floor(Math.random() * 1000000000000);
      doc.fontSize(9).font('OCR-B').text('Tran Ref:   ', leftMargin, doc.y, { continued: true });
      doc.text(`${tranRef.toString().padStart(12, '0')}`);
      
      doc.fontSize(9).font('OCR-B').text('Tran ID:', leftMargin);
      doc.fontSize(9).font('OCR-B').text('Approval #:   ', leftMargin, doc.y, { continued: true });
      doc.text(`${approvalCode}`);
      doc.moveDown(0.5);
      
      // Instruction - exactly as in screenshot
      doc.fontSize(9).font('OCR-B').text('Please destroy check', leftMargin + 20);
      doc.moveDown(2);

      doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
      doc.moveDown(1);
      
      // Authorization section with signature line
      doc.fontSize(9).font('OCR-B').text('Auth #:   ', leftMargin + 10, doc.y, { continued: true });
      doc.text(`${approvalCode}`, leftMargin + 15);
      doc.moveDown(0.8);
      
      // Add signature image only if checkbox is checked
      const includeSignature = receipt.includeSignature;
      if (includeSignature) {
        try {
          const signaturePath = path.resolve(process.cwd(), 'assets/signatures/signature.jpeg');
          console.log('Looking for signature at:', signaturePath);
          if (fs.existsSync(signaturePath)) {
            console.log('Signature file found, loading...');
            const signatureWidth = 80;
            const signatureHeight = 20;
            const signatureX = (doc.page.width - signatureWidth) / 2; // Center the signature
            const signatureY = doc.y;
            
            // Try to load the image with error handling for corrupted JPEGs
            try {
              doc.image(signaturePath, signatureX, signatureY, {
                width: signatureWidth,
                height: signatureHeight
              });
              doc.y = signatureY + signatureHeight + 10;
              console.log('Signature loaded successfully');
            } catch (imageError) {
              console.error('Error loading signature image (corrupted JPEG):', imageError instanceof Error ? imageError.message : String(imageError));
              // Fallback: draw a signature line instead
              doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
              doc.y = signatureY + 15;
              console.log('Used signature line fallback');
            }
          } else {
            console.log('Signature file not found at:', signaturePath);
            // Fallback: draw a signature line
            doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
            doc.moveDown(1);
          }
        } catch (error) {
          console.error('Error loading signature:', error);
          // Fallback: draw a signature line
          doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
          doc.moveDown(1);
        }
      } else {
        console.log('Signature checkbox not checked, skipping signature');
        doc.moveDown(1);
      }

      doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
      doc.moveDown(1);
    } else if (receipt.paymentMethod === 'Cash') {
      // Cash payment method - show Received section with amount
      doc.fontSize(9).font('OCR-B').text('Received', { align: 'left' });
      doc.fontSize(9).font('OCR-B').text('Cash', leftMargin + 5, doc.y, { continued: true, width: 240 });
      doc.text(total.toFixed(2), { align: 'right', width: 240 });
      doc.moveDown(1);
    }
    
    // Vehicle and company details section - show for Visa, Master, EFS, Cash
    if (receipt.paymentMethod === 'EFS') {
      // Vehicle and company details for Visa, Master, and EFS - exactly as in screenshot
      const vehicleId = receipt.vehicleId || '122';
      const dlState = 'on'; // From screenshot
      const companyName = receipt.driverCompanyName || 'MCMPLOGISTICSINC';
      
      doc.fontSize(9).font('OCR-B').text(`VehicleID`, leftMargin, doc.y, { continued: true });
      doc.text(vehicleId, leftMargin + 37);
      doc.fontSize(9).font('OCR-B').text(`DLState`, leftMargin, doc.y, { continued: true });
      doc.text(dlState, leftMargin + 50);
      doc.fontSize(9).font('OCR-B').text(`CompanyName`, leftMargin, doc.y, { continued: true });
      doc.text(companyName, leftMargin + 30);
      doc.fontSize(9).font('OCR-B').text(`Odometer`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`HubOdometer`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`TrailerID`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`TripNumber`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`UnitLicenseNumber`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`UnitLicenseState`, leftMargin);
    } else if (receipt.paymentMethod === 'Cash') {
      // Cash payment method - show vehicle and company details
      const vehicleId = receipt.vehicleId || 'm121';
      const companyName = receipt.driverCompanyName || 'mcmp';
      
      doc.fontSize(9).font('OCR-B').text(`VehicleID`, leftMargin, doc.y, { continued: true });
      doc.text(vehicleId, leftMargin + 40);
      doc.fontSize(9).font('OCR-B').text(`CompanyName`, leftMargin, doc.y, { continued: true });
      doc.text(companyName, leftMargin + 25);
      doc.fontSize(9).font('OCR-B').text(`Odometer`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`TripNumber`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`TrailerID`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`UnitLicenseNumber`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`UnitLicenseState`, leftMargin);
    }
    doc.moveDown(0.5);

    // Transaction details section removed for Visa - now handled in the main Visa payment block above
    
    // Customer copy section is now handled within each payment method block
    // No separate section needed here

    doc.end();
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });
  }
}

export class FlyingJTravelPlazaReceiptGenerator {
  async generate(receipt: Receipt, outputPath: string): Promise<void> {
    const doc = new PDFDocument({ size: [280, 800], margin: 15, autoFirstPage: false });
    const fontPath = path.join(__dirname, '../fonts/ocr_b_becker.ttf');
    doc.registerFont('OCR-B', fontPath);
    doc.addPage({ size: [280, 800], margin: 15 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const leftMargin = 15;

    // Load and display Flying J logo at the top
    try {
      const logoPath = path.resolve(process.cwd(), 'assets/logos/flying-logo.jpeg');
      
      if (fs.existsSync(logoPath)) {
        const logoWidth = 150;
        const logoHeight = 70;
        // Center the logo horizontally
        const logoX = (doc.page.width - logoWidth) / 2;
        const currentY = doc.y;
        
        doc.image(logoPath, logoX, currentY, {
          width: logoWidth,
          height: logoHeight,
          align: 'center'
        });
        
        doc.y = currentY + logoHeight;
      } else {
        // Fallback to text
        doc.fontSize(28).font('OCR-B').text('FLYING', { align: 'center' });
        doc.moveDown(0.5);
      }
    } catch (error) {
      console.error('Error loading Flying J logo:', error);
      doc.fontSize(28).font('OCR-B').text('FLYING', { align: 'center' });
      doc.moveDown(0.5);
    }

    // Store info - use dynamic data from selected store or fallback to hardcoded
    const storeNumber = receipt.companyData?.storeNumber || '860';
    const address = receipt.companyData?.address || '1637 Pettit Road';
    const cityState = receipt.companyData?.city || 'Ft.Erie, ON';
    const phone = receipt.companyData?.phone || '905-991-1800';
    
    doc.fontSize(10).font('OCR-B').text(`STORE ${storeNumber}`, { align: 'center' });
    doc.fontSize(10).font('OCR-B').text(address, { align: 'center' });
    doc.fontSize(10).font('OCR-B').text(cityState, { align: 'center' });
    doc.fontSize(10).font('OCR-B').text(phone, { align: 'center' });
    
    // Date format: 10/24/2025
    const month = String(receipt.date.getMonth() + 1).padStart(2, '0');
    const day = String(receipt.date.getDate()).padStart(2, '0');
    const year = receipt.date.getFullYear();
    doc.fontSize(10).font('OCR-B').text(`${month}/${day}/${year}`, { align: 'center' });
    doc.moveDown(0.8);

    // SALE header
    doc.fontSize(10).font('OCR-B').text('SALE', leftMargin);
    
    // Transaction number
    const transactionNum = `${Math.floor(Math.random() * 9000000) + 1000000}`;

      doc.fontSize(10).font('OCR-B').text(`Transaction #:  ${transactionNum} `, leftMargin);
 
    doc.fontSize(8).font('OCR-B').text('---------------------------------------------------', leftMargin);
    // Column headers - Petro-Canada style (QTY first, then NAME)
    const headerLine = 'Qty'.padEnd(5) + 'Name'.padEnd(20) + 'Price'.padEnd(10) + 'Total';
    doc.fontSize(10).font('OCR-B').text(headerLine, leftMargin);
    doc.fontSize(8).font('OCR-B').text('---------------------------------------------------', leftMargin);

    // Calculate subtotal
    const subtotal = receipt.items.reduce((sum, item) => {
      const isCashAdvance = item.name.toLowerCase().includes('cash advance');
      // For cash advance, price is already the total (quantity is 1)
      // For regular items, calculate quantity * price
      return isCashAdvance ? sum + item.price : sum + (item.quantity * item.price);
    }, 0);

    // Items section - Petro-Canada style format (US units)
    receipt.items.forEach(item => {
      // Check if this is a cash advance item
      const isCashAdvance = item.name.toLowerCase().includes('cash advance');
      
      // Calculate totals for all items
      const total = isCashAdvance ? item.price : (item.quantity * item.price);
      
      // Display item in Petro-Canada style format with proper alignment
      const qtyDisplay = item.qty || 1;
      const qtyStr = qtyDisplay.toString();
      
      // Format item line: name (padded to 20) + qty (padded to 5) + price (padded to 7) + total
      // For cash advance, show the price as the price; for regular items, show price per gallon
      const itemLine = qtyStr.padEnd(5) + item.name.padEnd(20) + total.toFixed(2).padEnd(10) + total.toFixed(2);
      doc.fontSize(10).font('OCR-B').text(itemLine, leftMargin);
      
      // Fuel details - use US units (Gallons instead of Liters) - only for non-cash advance items
      if (!isCashAdvance) {
      const pumpNumber = item.pump !== undefined && item.pump !== null ? item.pump : Math.floor(Math.random() * 20) + 1;
        const gallons = item.quantity.toFixed(3);  // quantity is gallons
        const pricePerGallon = item.price.toFixed(3);  // price is price per gallon
        
        // Align the values by using consistent padding (same as Petro-Canada style)
        doc.fontSize(10).font('OCR-B').text(` Pump:        ${pumpNumber}`, leftMargin + 35);
        doc.fontSize(10).font('OCR-B').text(` Gallons:     ${gallons}`, leftMargin + 35);
        doc.fontSize(10).font('OCR-B').text(` Price / Gal: ${pricePerGallon}`, leftMargin + 35);
      }
      
      doc.moveDown(1);
    });


    // Separator
    doc.fontSize(8).font('OCR-B').text('---------------------------------------------------', leftMargin);
    
    // Totals
    const salesTax = 0.00;
    const total = subtotal + salesTax;

    doc.fontSize(10).font('OCR-B').text('Subtotal', leftMargin, doc.y, { continued: true, width: 245 });
    doc.font('OCR-B').text(subtotal.toFixed(2), { align: 'right', width: 245 });
    
    doc.fontSize(10).font('OCR-B').text('Sales Tax', leftMargin, doc.y, { continued: true, width: 245 });
    doc.font('OCR-B').text(salesTax.toFixed(2), { align: 'right', width: 245 });
    
    doc.fontSize(8).font('OCR-B').text('---------------------------------------------------', leftMargin);
    
    doc.fontSize(10).font('OCR-B').text('Total', leftMargin, doc.y, { continued: true, width: 245 });
    doc.font('OCR-B').text(total.toFixed(2), { align: 'right', width: 245 });
    
    doc.fontSize(8).font('OCR-B').text('---------------------------------------------------', leftMargin);
    doc.moveDown(0.3);

    // Received / Payment section - show for Visa, TCH, EFS, Cash, and Master
    if (receipt.paymentMethod === 'Visa' || receipt.paymentMethod === 'TCH' || receipt.paymentMethod === 'EFS' || receipt.paymentMethod === 'Cash' || receipt.paymentMethod === 'Master') {
      if (receipt.paymentMethod === 'TCH') {
        // Add "Received" text for TCH payment
        doc.fontSize(10).font('OCR-B').text('Received', leftMargin);
        doc.fontSize(10).font('OCR-B').text(`  TCH Card`, leftMargin, doc.y, { continued: true, width: 245 });
        doc.font('OCR-B').text(total.toFixed(2), { align: 'right', width: 245 });
        
        const last4 = receipt.cardLast4 || '4551';
        const entryMethod = receipt.cardEntryMethod === 'INSERT' ? 'INSERT' : 
                            receipt.cardEntryMethod === 'TAP' ? 'TAP' : 'SWIPED';
        doc.fontSize(10).font('OCR-B').text(`  XXXXXXXXXXXXXXX${last4} ${entryMethod}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`  Approved`, leftMargin);
        
        // Generate random authorization number (6 digits for TCH)
        const authNum = Math.floor(Math.random() * 900000) + 100000;
        doc.fontSize(10).font('OCR-B').text(`  Auth #:  ${authNum}`, leftMargin);
        doc.moveDown(0.5);
      } else if (receipt.paymentMethod === 'Master') {
        // Master payment - match screenshot exactly
        doc.fontSize(10).font('OCR-B').text('Received', leftMargin);
        // MC with amount on the right
        doc.fontSize(10).font('OCR-B').text('MC', leftMargin+10, doc.y, { continued: true, width: 230 });
        doc.font('OCR-B').text(total.toFixed(2), { align: 'right', width: 230 });
        
        const last4 = receipt.cardLast4 || '4459';
        const entryMethod = receipt.cardEntryMethod === 'INSERT' ? 'INSERT' : 
                            receipt.cardEntryMethod === 'TAP' ? 'TAP' : 'SWIPED';
        // Card number and entry method on next line
        doc.fontSize(10).font('OCR-B').text(`XXXXXXXXXXXX${last4} ${entryMethod}`, leftMargin+10);
        
        doc.fontSize(10).font('OCR-B').text('Approved', leftMargin+10);
        
        // Generate random authorization number (alphanumeric 6 chars)
        const authAlphaNum = Math.random().toString(36).substring(2, 8).toUpperCase();
        doc.fontSize(10).font('OCR-B').text(`Auth #: ${authAlphaNum}`, leftMargin+10);
        doc.moveDown(0.8);
        
        // Transaction details section
        doc.fontSize(10).font('OCR-B').text('TYPE: COMPLETION', leftMargin);
        doc.fontSize(10).font('OCR-B').text('Mastercard (C)', leftMargin);
        
        // Generate random AID, TVR, IAD, TSI, ARC
        // AID format: A followed by 14 hex digits
        const aid = 'A' + Array.from({ length: 14 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
        // TVR format: 10 hex digits
        const tvr = Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
        // IAD format: 32 hex digits followed by FF
        const iad = Array.from({ length: 26 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('') + 'FF';
        // TSI format: 4 hex digits
        const tsi = Array.from({ length: 4 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
        // ARC format: 2 hex digits
        const arc = Array.from({ length: 2 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
        
        doc.fontSize(10).font('OCR-B').text(`AID: ${aid}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`TVR: ${tvr}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`IAD: ${iad}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`TSI: ${tsi}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`ARC: ${arc}`, leftMargin);
        doc.moveDown(1.5);
        
        // Important message
        doc.fontSize(9).font('OCR-B').text('IMPORTANT - Retain this copy for your records.', leftMargin);
        doc.moveDown(0.8);
        
        // Customer copy section
        doc.fontSize(10).font('OCR-B').text('CUSTOMER COPY', leftMargin);
        
        // Vehicle and company details
        const vehicleId = receipt.vehicleId || 'm101';
        const companyName = receipt.driverCompanyName || 'mcmp';
        
        doc.fontSize(10).font('OCR-B').text('VehicleID', leftMargin, doc.y, { continued: true, width: 245 });
        doc.text(vehicleId, { align: 'right', width: 245 });

        doc.fontSize(10).font('OCR-B').text('CompanyName', leftMargin, doc.y, { continued: true, width: 245 });
        doc.text(companyName, { align: 'right', width: 245 });

        doc.fontSize(10).font('OCR-B').text('Odometer', leftMargin, doc.y, { continued: true, width: 245 });
        doc.text('', { align: 'right', width: 245 });
        doc.moveDown(2);
        
        // Add signature image if checkbox is checked
        if (receipt.includeSignature) {
          try {
            const signaturePath = path.resolve(process.cwd(), 'assets/signatures/signature.jpeg');
            if (fs.existsSync(signaturePath)) {
              const signatureWidth = 80;
              const signatureHeight = 20;
              const signatureX = (doc.page.width - signatureWidth) / 2;
              const signatureY = doc.y;
              
              try {
                doc.image(signaturePath, signatureX, signatureY, {
                  width: signatureWidth,
                  height: signatureHeight
                });
                doc.y = signatureY + signatureHeight + 10;
              } catch (imageError) {
                doc.fontSize(9).font('OCR-B').text('_________________', leftMargin);
                doc.moveDown(1);
              }
            } 
          } catch (error) {
            doc.fontSize(9).font('OCR-B').text('_________________', leftMargin);
            doc.moveDown(1);
          }
        } else {
          doc.fontSize(9).font('OCR-B').text('_________________', leftMargin);
        }

        // Dashed line
        doc.fontSize(7).font('OCR-B').text('--------------------------------------------------------', leftMargin);
        doc.moveDown(3);
        
        // Promotional message
        doc.fontSize(10).font('OCR-B').text('YOU HAVE SHOWER POWER!', { align: 'center' });
        doc.moveDown(0.8);
        doc.fontSize(9).font('OCR-B').text('Special Promotional Offer', { align: 'center' });
      } else if (receipt.paymentMethod === 'EFS' || receipt.paymentMethod === 'Cash') {
        // EFS (USA Flying J) / Cash receipt block - match provided screenshot
        const isEfs = receipt.paymentMethod === 'EFS';
        const paymentType = isEfs ? 'EFS LLC Checks' : 'Cash';

        // Top line: Received + payment type + amount right aligned
        doc.fontSize(10).font('OCR-B').text('Received', leftMargin);
        doc.fontSize(10).font('OCR-B').text(`  ${paymentType}`, leftMargin, doc.y, { continued: true, width: 245 });
        doc.font('OCR-B').text(total.toFixed(2), { align: 'right', width: 245 });

        // Date line: mm/dd/yyyy hh:mm:ss (only show for Cash, not EFS)
        if (!isEfs) {
        const mm = String(receipt.date.getMonth() + 1).padStart(2, '0');
        const dd = String(receipt.date.getDate()).padStart(2, '0');
        const yyyy = String(receipt.date.getFullYear());
        const hh = String(receipt.date.getHours()).padStart(2, '0');
        const min = String(receipt.date.getMinutes()).padStart(2, '0');
        const ss = String(receipt.date.getSeconds()).padStart(2, '0');
        doc.fontSize(10).font('OCR-B').text(`Date:  ${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`, leftMargin + 30);
        }
        
        // For Cash payment method, show Vehicle ID and Company Name after the second date
        if (!isEfs) {
          const vehicleId = (receipt.vehicleId || '').trim();
          const companyName = (receipt.driverCompanyName || '').trim();
          
          // Display Vehicle ID and Company Name in the same format as other receipts
          if (vehicleId) {
            doc.fontSize(10).font('OCR-B').text('VehicleID', leftMargin, doc.y, { continued: true, width: 245 });
            doc.text(vehicleId, { align: 'right', width: 2475 });
          }
          
          if (companyName) {
            doc.fontSize(10).font('OCR-B').text('CompanyName', leftMargin, doc.y, { continued: true, width: 245 });
            doc.text(companyName, { align: 'right', width: 245 });
          }
        }

        // Random helpers
        const randNum = (digits: number) => String(Math.floor(Math.random() * Math.pow(10, digits))).padStart(digits, '0');
        const randAlphaNum = (len: number) => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let out = '';
          for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
          return out;
        };

        const tranRoute = randNum(6);
        const accountNum = randNum(8);
        const checkNum = randNum(6);
        const approvalId = randAlphaNum(6);
        const recordId = randNum(6);
        const clerkId = randNum(3);
        const referenceNum = randNum(6);
        const tranRef = randNum(12);
        const tranId = randNum(6);

        // Body lines
        doc.fontSize(10).font('OCR-B').text(`Tran/Route #:   ${tranRoute}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`Account #:      ${accountNum}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`Check #:        ${checkNum}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`Tran Amount :   $ ${total.toFixed(2)}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`Approval ID :   ${approvalId}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`Record #:       ${recordId}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`Clerk ID:       ${clerkId}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`Reference #:    ${referenceNum}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`Tran Ref:       ${tranRef}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`Tran ID:        ${tranId}`, leftMargin);
        doc.fontSize(10).font('OCR-B').text(`Approval #:     ${approvalId}`, leftMargin);

        if (isEfs) {
          doc.moveDown(0.5);
          doc.fontSize(10).font('OCR-B').text('Please destroy check', leftMargin + 10);
          doc.moveDown(0.5);

          doc.fontSize(7).font('OCR-B').text('-------------------------------------------------', leftMargin);
          doc.moveDown(1);
          
          // Show Auth number before signature
          doc.fontSize(10).font('OCR-B').text(`Auth #: ${approvalId}`, leftMargin);
          doc.moveDown(0.5);
          
          // Add signature image only if checkbox is checked
          const includeSignature = receipt.includeSignature;
          if (includeSignature) {
            try {
              const signaturePath = path.resolve(process.cwd(), 'assets/signatures/signature.jpeg');
              console.log('Looking for signature at:', signaturePath);
              if (fs.existsSync(signaturePath)) {
                console.log('Signature file found, loading...');
                const signatureWidth = 80;
                const signatureHeight = 20;
                const signatureX = (doc.page.width - signatureWidth) / 2; // Center the signature
                const signatureY = doc.y;
                
                // Try to load the image with error handling for corrupted JPEGs
                try {
                  doc.image(signaturePath, signatureX, signatureY, {
                    width: signatureWidth,
                    height: signatureHeight
                  });
                  doc.y = signatureY + signatureHeight + 10;
                  console.log('Signature loaded successfully');
                } catch (imageError) {
                  console.error('Error loading signature image (corrupted JPEG):', imageError instanceof Error ? imageError.message : String(imageError));
                  // Fallback: draw a signature line instead
                  doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
                  doc.y = signatureY + 15;
                  console.log('Used signature line fallback');
                }
              } else {
                console.log('Signature file not found at:', signaturePath);
                // Fallback: draw a signature line
                doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
                doc.moveDown(1);
              }
            } catch (error) {
              console.error('Error loading signature:', error);
              // Fallback: draw a signature line
              doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
              doc.moveDown(1);
            }
          } else {
            console.log('Signature checkbox not checked, skipping signature');
            // Show signature line when checkbox is not checked
            doc.fontSize(9).font('OCR-B').text('Signature: _________________', { align: 'center' });
            doc.moveDown(1);
          }

          doc.fontSize(7).font('OCR-B').text('-------------------------------------------------', leftMargin);
          doc.moveDown(1);
          
          // Vehicle and Driver Details section (matching screenshot 2 format)
          const vehicleId = (receipt.vehicleId || '').trim();
          const dlNumber = (receipt.dlNumber || '').trim();
          const dlState = dlNumber ? 'CA' : ''; // Default to CA if DL Number exists, can be enhanced later
          const companyName = (receipt.driverCompanyName || '').trim();
          
          // Display vehicle and driver details
          if (vehicleId) {
            doc.fontSize(10).font('OCR-B').text(`VehicleID      ${vehicleId}`, leftMargin);
          } else {
            doc.fontSize(10).font('OCR-B').text('VehicleID', leftMargin);
          }
          
          if (dlState) {
            doc.fontSize(10).font('OCR-B').text(`DLState ${dlState}`, leftMargin);
          } else {
            doc.fontSize(10).font('OCR-B').text('DLState', leftMargin);
          }
          
          if (companyName) {
            doc.fontSize(10).font('OCR-B').text(`CompanyName    ${companyName}`, leftMargin);
          } else {
            doc.fontSize(10).font('OCR-B').text('CompanyName', leftMargin);
          }
          
          // Additional fields (empty in screenshot, but shown for consistency)
          doc.fontSize(10).font('OCR-B').text('Odometer', leftMargin);
          doc.fontSize(10).font('OCR-B').text('HubOdometer', leftMargin);
          doc.fontSize(10).font('OCR-B').text('TrailerID', leftMargin);
          doc.fontSize(10).font('OCR-B').text('TripNumber', leftMargin);
          doc.fontSize(10).font('OCR-B').text('UnitLicenseNumber', leftMargin);
          doc.fontSize(10).font('OCR-B').text('UnitLicenseState', leftMargin);
          
          doc.moveDown(1);
          
          // Promotional message section (matching Master payment format)
          doc.fontSize(7).font('OCR-B').text('--------------------------------------------------------', leftMargin);
          doc.moveDown(3);
          
          // Promotional message
          doc.fontSize(10).font('OCR-B').text('YOU HAVE SHOWER POWER!', { align: 'center' });
          doc.moveDown(0.8);
          doc.fontSize(9).font('OCR-B').text('Special Promotional Offer', { align: 'center' });
        }
      } else {
        // Visa payment format matching screenshot
        const last4 = receipt.cardLast4 || '4444';
        const entryMethod = receipt.cardEntryMethod === 'INSERT' ? 'INSERT' : 
                            receipt.cardEntryMethod === 'TAP' ? 'TAP' : 'SWIPED';
        
        // Received section - show Visa with amount
        doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
        
        // Visa with amount on the right
        doc.fontSize(9).font('OCR-B').text('Visa', leftMargin + 10, doc.y, { continued: true, width: 240 });
        doc.fontSize(9).font('OCR-B').text(total.toFixed(2), { align: 'right', width: 240 });
        
        // Card number with INSERT on the right
        doc.fontSize(9).font('OCR-B').text(`XXXXXXXXXXXX${last4}`, leftMargin + 10, doc.y, { continued: true, width: 150 });
        doc.fontSize(9).font('OCR-B').text(entryMethod, { align: 'right', width: 150 });
        
        // Approved on new line
        doc.fontSize(9).font('OCR-B').text('Approved', leftMargin + 10);
        
        // Generate authorization code (6 digits, e.g., "004950")
        const authCode = Math.floor(Math.random() * 900000) + 100000;
        doc.fontSize(9).text(`Auth #: ${authCode.toString().padStart(6, '0')}`, leftMargin + 10);
        doc.moveDown(0.8);
        
        // Transaction Details
        doc.fontSize(9).font('OCR-B').text('TYPE: COMPLETION', leftMargin);
        doc.fontSize(9).font('OCR-B').text('Visa DEBIT (C)', leftMargin);
        
        // AID - randomly generate AID (Application Identifier) for Visa
        const aidVisa = `A${Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0')}`;
        doc.fontSize(9).font('OCR-B').text(`AID: ${aidVisa}`, leftMargin);
        
        // TVR - randomly generate TVR (Terminal Verification Results)
        const tvr = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
        doc.fontSize(9).font('OCR-B').text(`TVR: ${tvr}`, leftMargin);
        
        // IAD - randomly generate IAD (Issuer Application Data) as hex string
        const iad = Array.from({ length: 14 }, () => {
          const chars = '0123456789ABCDEF';
          return chars[Math.floor(Math.random() * chars.length)];
        }).join('');
        doc.fontSize(9).font('OCR-B').text(`IAD: ${iad}`, leftMargin);
        
        // TSI - randomly generate TSI (Transaction Status Information) as hex
        const tsi = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
        doc.fontSize(9).font('OCR-B').text(`TSI: ${tsi}`, leftMargin);
        
        // ARC - randomly generate ARC (Authorization Response Code)
        const arcChars = ['Z3', 'A1', 'B2', 'C4', 'D5', 'E6', 'F7', 'G8', 'H9', 'I0', 'J1', 'K2', 'L3', 'M4', 'N5', 'O6', 'P7', 'Q8', 'R9', 'S0'];
        const arc = arcChars[Math.floor(Math.random() * arcChars.length)];
        doc.fontSize(9).font('OCR-B').text(`ARC: ${arc}`, leftMargin);
        doc.moveDown(1.5);
        
        // Verified by PIN
        doc.fontSize(9).font('OCR-B').text('Verified by PIN', leftMargin);
        doc.moveDown(0.8);
        
        // Important notice
        doc.fontSize(9).font('OCR-B').text('IMPORTANT - Retain this copy for your records.', leftMargin);
      doc.moveDown(1);

        // CUSTOMER COPY section
        doc.fontSize(9).font('OCR-B').text('CUSTOMER COPY', leftMargin);
        const companyName = receipt.driverCompanyName || '';
        const vehicleId = receipt.vehicleId || '';

        // Show VehicleID with value on the right, then company name (shortened)
        doc.fontSize(9).font('OCR-B').text('VehicleID', leftMargin + 10, doc.y, { continued: true, width: 205 });
        doc.text(vehicleId, { align: 'right', width: 205 });
        doc.fontSize(9).font('OCR-B').text('CompanyName', leftMargin + 10, doc.y, { continued: true, width: 205 });
        doc.text(companyName, { align: 'right', width: 205 });

        
        doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
      }
    }

    // Transaction record separator - only show for Visa
    if (receipt.paymentMethod === 'Visa') {

    } else if (receipt.paymentMethod === 'TCH') {
      // TCH payment method - show "TruckingCompanyNameTCI" + user company name
      const userCompanyName = receipt.driverCompanyName || 'ACG';
      const truckingCompany = `TruckingCompanyNameTCI    ${userCompanyName}`;
      doc.fontSize(10).font('OCR-B').text(truckingCompany, leftMargin);
    }

    doc.end();
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });
  }
}

export class LovesTravelStopsReceiptGenerator {
  async generate(receipt: Receipt, outputPath: string): Promise<void> {
    const doc = new PDFDocument({ size: [280, 800], margin: 15, autoFirstPage: false });
    const fontPath = path.join(__dirname, '../fonts/ocr_b_becker.ttf');
    doc.registerFont('OCR-B', fontPath);
    doc.addPage({ size: [280, 800], margin: 15 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    // Love's header with actual logo
    try {
      const logoPath = path.resolve(process.cwd(), 'assets/logos/loves-logo.jpeg');
      
      if (fs.existsSync(logoPath)) {
        // Add Love's logo
        const logoWidth = 200;
        const logoHeight = 50;
        const logoX = (doc.page.width - logoWidth) / 2;
        const currentY = doc.y;
        
        doc.image(logoPath, logoX, currentY, { width: logoWidth });
        doc.y = currentY + logoHeight;
      } else {
        // Fallback to text if logo not found
        doc.fontSize(18).font('OCR-B').text("Love's", { align: 'center' });
        doc.moveDown(0.5);
      }
    } catch (error) {
      console.error('Error loading Love\'s logo:', error);
      doc.fontSize(18).font('OCR-B').text("Love's", { align: 'center' });
      doc.moveDown(0.5);
    }

    // Store info centered - match One9 format exactly
    const storeNumber = receipt.companyData?.storeNumber || '317';
    const address = receipt.companyData?.address || '770 Moores Ferry Rd';
    const cityState = receipt.companyData?.city || 'Skippers, VA 23879';
    const phone = receipt.companyData?.phone || '(434) 336-0203';
    
    doc.fontSize(9).font('OCR-B').text(`STORE  #${storeNumber}`, { align: 'center' });
    doc.fontSize(9).text(address, { align: 'center' });
    doc.fontSize(9).text(cityState, { align: 'center' });
    doc.fontSize(9).text(phone, { align: 'center' });
    doc.moveDown(0.8);


    // Date and Ticket - match screenshot 2 format exactly
    const leftMargin = 15;
    const formattedDate = receipt.date.toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: 'numeric' 
    });
    doc.fontSize(9).font('OCR-B').text(`${formattedDate}  Tkt #${receipt.receiptNumber.replace('REC-', '')}`, leftMargin);
    
    // Dashed separator
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
    
    // Transaction type - use copyType if provided, otherwise default to ORIGINAL
    const copyTypeDisplay = receipt.copyType ? receipt.copyType.toUpperCase() : 'ORIGINAL';
    doc.fontSize(9).font('OCR-B').text(`Type:  SALE      (${copyTypeDisplay})`, leftMargin);
    
    // Dashed separator
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
    
    // Table header - Petro-Canada style (QTY first, then NAME)
    const headerLine = 'Qty'.padEnd(5) + 'Name'.padEnd(20) + 'Price'.padEnd(10) + 'Total';
    doc.fontSize(10).font('OCR-B').text(headerLine, leftMargin);
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);

    // Calculate totals
    const subtotal = receipt.items.reduce((sum, item) => {
      const isCashAdvance = item.name.toLowerCase().includes('cash advance');
      // For cash advance, price is already the total (quantity is 1)
      // For regular items, calculate quantity * price
      return isCashAdvance ? sum + item.price : sum + (item.quantity * item.price);
    }, 0);
    
    // Items section - Petro-Canada style format (US units)
    receipt.items.forEach(item => {
      // Check if this is a cash advance item
      const isCashAdvance = item.name.toLowerCase().includes('cash advance');
      
      // Calculate totals for all items
      const total = isCashAdvance ? item.price : (item.quantity * item.price);
      
      // For Loves company, show empty Qty and Price values (as per screenshot)
      // Exception: For CASH ADVANCE items, show Qty as "1"
      // Display item in Petro-Canada style format with proper alignment
      const qtyStr = isCashAdvance ? '1' : ''; // Show "1" for cash advance, empty for other items
      
      // Format item line: name (padded to 20) + qty (padded to 5) + price (padded to 7) + total
      // For Loves, show empty price; for cash advance, show the price as the price; for regular items, show price per gallon
      const priceToShow = ''; // Empty for Loves - show blank Price
      // For CASH ADVANCE, show price in the Price column; otherwise, keep blank
      const priceField = isCashAdvance ? item.price.toFixed(2) : '';
      const itemLine = qtyStr.padEnd(5) +  item.name.padEnd(20) + priceField.padEnd(10) + total.toFixed(2);
      doc.fontSize(10).font('OCR-B').text(itemLine, leftMargin);
      
      // Fuel details - use US units (Gallons instead of Liters) - only for non-cash advance items
      if (!isCashAdvance) {
        const pumpNumber = item.pump !== undefined && item.pump !== null ? item.pump : Math.floor(Math.random() * 15) + 1;
        const gallons = item.quantity.toFixed(3);  // quantity is gallons
        const pricePerGallon = item.price.toFixed(3);  // price is price per gallon
        
        console.log('Love\'s Receipt - Item:', { pump: item.pump, qty: item.qty, pumpNumber });
        
        // Align the values by using consistent padding (same as Petro-Canada style)
        doc.fontSize(10).font('OCR-B').text(` Pump:              ${pumpNumber}`, leftMargin + 35);
        doc.fontSize(10).font('OCR-B').text(` Gallons:           ${gallons}`, leftMargin + 35);
        doc.fontSize(10).font('OCR-B').text(` Price / Gal:       ${pricePerGallon}`, leftMargin + 35);
      }
      
      doc.moveDown(1);
    });

    doc.fontSize(7).font('OCR-B').text('-----------------------------------------------------------', leftMargin);

    // Totals section - match One9 format exactly
    const salesTax = 0.00;
    const total = subtotal + salesTax;

    doc.fontSize(9).font('OCR-B').text('Subtotal', leftMargin, doc.y, { continued: true, width: 245 });
    doc.text(subtotal.toFixed(2), { align: 'right', width: 245 });
    
    doc.fontSize(9).text('Sales Tax', leftMargin, doc.y, { continued: true, width: 245 });
    doc.text(salesTax.toFixed(2), { align: 'right', width: 245 });
    
    doc.fontSize(9).font('OCR-B').text('Total', leftMargin, doc.y, { continued: true, width: 245 });
    doc.text(total.toFixed(2), { align: 'right', width: 245 });
    
    doc.fontSize(7).font('OCR-B').text('-----------------------------------------------------------', leftMargin);
    doc.moveDown(0.3);

    // Payment section - handle different payment methods
    if (receipt.paymentMethod === 'Cash') {
      // Cash payment - show amount in front of Cash (right-aligned)
      doc.fontSize(9).font('OCR-B').text('Received:', { align: 'left' });
      doc.fontSize(9).font('OCR-B').text('Cash', leftMargin + 5, doc.y, { continued: true, width: 245 });
      doc.text(total.toFixed(2), { align: 'right', width: 245 });
      doc.moveDown(1);
    } else if (receipt.paymentMethod === 'EFS') {
      // EFS payment - match screenshot format exactly
      doc.fontSize(9).font('OCR-B').text('Received:', { align: 'left' });
      
      // Show EFS LLC Check with total amount aligned to the right
      doc.fontSize(9).font('OCR-B').text('EFS LLC Check', leftMargin + 5, doc.y, { continued: true, width: 245 });
      doc.text(total.toFixed(2), { align: 'right', width: 245 });
      
      // Generate random auth number (6 digits with leading zeros) and invoice number (5 digits)
      const authNum = Math.floor(Math.random() * 999999); // 0-999999
      const invoiceNum = Math.floor(Math.random() * 99999); // 0-99999
      
      doc.fontSize(9).font('OCR-B').text(`Auth No: ${authNum.toString().padStart(6, '0')}`, leftMargin + 10);
      doc.fontSize(9).font('OCR-B').text(`Invoice Number: ${invoiceNum.toString().padStart(5, '0')}`, leftMargin);
      doc.moveDown(2);
      
      // Add signature image only if checkbox is checked
      const includeSignature = receipt.includeSignature;
      if (includeSignature) {
        try {
          const signaturePath = path.resolve(process.cwd(), 'assets/signatures/signature.jpeg');
          if (fs.existsSync(signaturePath)) {
            const signatureWidth = 80;
            const signatureHeight = 20;
            const signatureX = (doc.page.width - signatureWidth) / 2; // Center the signature
            const signatureY = doc.y;
            
            // Try to load the image with error handling for corrupted JPEGs
            try {
              doc.image(signaturePath, signatureX, signatureY, {
                width: signatureWidth,
                height: signatureHeight
              });
              doc.y = signatureY + signatureHeight + 5;
            } catch (imageError) {
              // Fallback: just move down
              doc.moveDown(0.5);
            }
          } else {
            // No signature image, just move down
            doc.moveDown(0.5);
          }
        } catch (error) {
          // Error loading signature, just move down
          doc.moveDown(0.5);
        }
      } else {
        // No signature, just move down
        doc.moveDown(0.5);
      }

      // Add horizontal line after signature
      doc.moveTo(leftMargin, doc.y).lineTo(doc.page.width - leftMargin, doc.y).stroke();
      doc.moveDown(0.5);
      
      // Add "Signature:" text after the line (match screenshot 2)
      doc.fontSize(9).font('OCR-B').text('Signature:', leftMargin);
      doc.moveDown(0.5);
      
      // Driver and trucking information after signature - match screenshot format
      const companyName = receipt.driverCompanyName || 'mcmp';
      const checkNumber = receipt.checkNumber || '2082717306';
      const driverFirstName = receipt.driverFirstName || 's';
      const driverLastName = receipt.driverLastName || 'garcha';
      const dlState = receipt.dlNumber ? receipt.dlNumber.substring(0, 2).toLowerCase() : 'on';
      const vehicleId = receipt.vehicleId || '';
      
      // Display fields with labels on left, values on right (aligned) - proper spacing to prevent overlap
      doc.fontSize(9).font('OCR-B').text('TruckingCompanyName', leftMargin, doc.y, { continued: true, width: 247 });
      doc.text(companyName, { align: 'right', width: 247 });

      
      doc.fontSize(9).font('OCR-B').text('CheckNumber', leftMargin, doc.y, { continued: true, width: 247 });
      doc.text(checkNumber, { align: 'right', width: 247 });

      
      doc.fontSize(9).font('OCR-B').text('DriverFName', leftMargin, doc.y, { continued: true, width: 247 });
      doc.text(driverFirstName, { align: 'right', width: 247 });

      
      doc.fontSize(9).font('OCR-B').text('DriverLName', leftMargin, doc.y, { continued: true, width: 247 });
      doc.text(driverLastName, { align: 'right', width: 247 });

      
      doc.fontSize(9).font('OCR-B').text('DLState', leftMargin, doc.y, { continued: true, width: 247 });
      doc.text(dlState, { align: 'right', width: 247 });

      
      // VehicleID with value if provided
      doc.fontSize(9).font('OCR-B').text('VehicleID', leftMargin, doc.y, { continued: true, width: 247 });
      doc.text(vehicleId || '', { align: 'right', width: 247 });
      
      // Just field labels as single left-aligned lines, no blank value fields at all
      doc.fontSize(9).font('OCR-B').text('Odometer', leftMargin);
      doc.fontSize(9).font('OCR-B').text('HubOdometer', leftMargin);
      doc.fontSize(9).font('OCR-B').text('TripNumber', leftMargin);
      doc.fontSize(9).font('OCR-B').text('TrailerID', leftMargin);
      doc.fontSize(9).font('OCR-B').text('TruckLicense', leftMargin);

      
    } else if (receipt.paymentMethod === 'TCH') {
      // TCH payment - match screenshot format
      doc.fontSize(9).font('OCR-B').text('Received:', { align: 'left' });
      
      // Show TCH Fleet with total amount aligned to the right
      doc.fontSize(9).font('OCR-B').text('TCH Fleet', leftMargin + 5, doc.y, { continued: true, width: 245 });
      doc.text(total.toFixed(2), { align: 'right', width: 245 });
      
      // Card details
      const last4 = receipt.cardLast4 || '4544';
      const entryMethod = receipt.cardEntryMethod === 'INSERT' ? 'INSERTED' : 
                          receipt.cardEntryMethod === 'TAP' ? 'TAP' : 'SWIPED';
      doc.fontSize(9).font('OCR-B').text(`***************${last4} ${entryMethod}`, leftMargin + 5);
      
      // Generate random auth number and invoice number
      const authNum = Math.floor(Math.random() * 900000) + 100000; // 6-digit number
      const invoiceNum = Math.floor(Math.random() * 90000) + 10000; // 5-digit number
      
      doc.fontSize(9).font('OCR-B').text(`Auth No:${authNum}`, leftMargin + 10);
      const companyName = receipt.driverCompanyName || 'TCI ACG';
      doc.fontSize(9).font('OCR-B').text(`Company: ${companyName}`, leftMargin);
      doc.fontSize(9).font('OCR-B').text(`INVOICE# ${invoiceNum}`, leftMargin);
      doc.moveDown(1.5);
    } else if (receipt.paymentMethod === 'Visa') {
      // Visa payment - match screenshot format
      doc.fontSize(9).font('OCR-B').text('Received:', { align: 'left' });
      
      // Show Visa with total amount aligned to the right
      doc.fontSize(9).font('OCR-B').text('Visa', leftMargin + 5, doc.y, { continued: true, width: 245 });
      doc.text(total.toFixed(2), { align: 'right', width: 245 });
      doc.moveDown(0.5);
      
      // Card details on next line - card number on left, entry method on right
      const last4 = receipt.cardLast4 || '5703';
      const entryMethod = receipt.cardEntryMethod === 'INSERT' ? 'INSERT' : 
                          receipt.cardEntryMethod === 'TAP' ? 'TAP' : 'SWIPED';
      doc.fontSize(9).font('OCR-B').text(`XXXXXXXXXXXX${last4}`, leftMargin + 5, doc.y, { continued: true, width: 150 });
      doc.text(entryMethod, { align: 'right', width: 150 });
      
      // Generate random auth number and invoice number
      const authNum = Math.floor(Math.random() * 900000) + 100000; // 6-digit number
      const invoiceNum = Math.floor(Math.random() * 90000) + 10000; // 5-digit number
      
      doc.fontSize(9).font('OCR-B').text(`Auth No: ${authNum}`, leftMargin + 10);
      doc.fontSize(9).font('OCR-B').text(`INVOICE# ${invoiceNum}`, leftMargin + 5);
      doc.fontSize(9).font('OCR-B').text('AID: A0000000031010', leftMargin);
      doc.fontSize(9).font('OCR-B').text('APP: Visa DEBIT', leftMargin);
      doc.fontSize(9).font('OCR-B').text('Verified by PIN', leftMargin);
      doc.moveDown(2);
      
      // Add signature image only if checkbox is checked
      const includeSignature = receipt.includeSignature;
      if (includeSignature) {
        try {
          const signaturePath = path.resolve(process.cwd(), 'assets/signatures/signature.jpeg');
          if (fs.existsSync(signaturePath)) {
            const signatureWidth = 80;
            const signatureHeight = 20;
            const signatureX = (doc.page.width - signatureWidth) / 2; // Center the signature
            const signatureY = doc.y;
            
            // Try to load the image with error handling for corrupted JPEGs
            try {
              doc.image(signaturePath, signatureX, signatureY, {
                width: signatureWidth,
                height: signatureHeight
              });
              doc.y = signatureY + signatureHeight + 10;
            } catch (imageError) {
              // Fallback: show signature line section if image fails
              doc.fontSize(7).font('OCR-B').text('________________________________________________', leftMargin);
              doc.moveDown(0.3);
              doc.fontSize(9).font('OCR-B').text('Signature:', leftMargin + 5);
              doc.fontSize(9).font('OCR-B').text('_________________', leftMargin + 50);
              doc.moveDown(1);
              doc.fontSize(7).font('OCR-B').text('________________________________________________', leftMargin);
              doc.moveDown(0.3);
            }
          } else {
            // Fallback: show signature line section if image file not found
            doc.fontSize(7).font('OCR-B').text('________________________________________________', leftMargin);
            doc.moveDown(0.3);
            doc.fontSize(9).font('OCR-B').text('Signature:', leftMargin + 5);
            doc.fontSize(9).font('OCR-B').text('_________________', leftMargin + 50);
            doc.moveDown(1);
            doc.fontSize(7).font('OCR-B').text('________________________________________________', leftMargin);
            doc.moveDown(0.3);
          }
        } catch (error) {
          // Fallback: show signature line section if error occurs
          doc.fontSize(7).font('OCR-B').text('________________________________________________', leftMargin);
          doc.moveDown(0.3);
          doc.fontSize(9).font('OCR-B').text('Signature:', leftMargin + 5);
          doc.fontSize(9).font('OCR-B').text('_________________', leftMargin + 50);
          doc.moveDown(1);
          doc.fontSize(7).font('OCR-B').text('________________________________________________', leftMargin);
          doc.moveDown(0.3);
        }
      } else {
        // Show signature line section when checkbox is not checked
        doc.fontSize(7).font('OCR-B').text('___________________________________________________________', leftMargin);
        doc.moveDown(0.3);
        doc.fontSize(9).font('OCR-B').text('Signature:', leftMargin + 5);
      doc.moveDown(2.0);
      }
      
      // TruckingCompanyName and VehicleID for Visa payments
      const companyName = receipt.driverCompanyName || 'mcmp';
      const vehicleId = receipt.vehicleId || '117';
      doc.fontSize(9).font('OCR-B').text(`TruckingCompanyName`, leftMargin, doc.y, { continued: true, width: 247 });
      doc.text(companyName, { align: 'right', width: 247 });
      doc.fontSize(9).font('OCR-B').text(`VehicleID`, leftMargin, doc.y, { continued: true, width: 247 });
      doc.text(vehicleId, { align: 'right', width: 247 });
      
      // Dashed separator line
      doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
      doc.moveDown(1);
      
      // Footer for Visa payments
      doc.fontSize(9).font('OCR-B').text('My Love Rewards', { align: 'center' });
    } else if (receipt.paymentMethod === 'Master') {
      // Mastercard payment - match screenshot format exactly
      doc.fontSize(9).font('OCR-B').text('Received:', leftMargin);
      
      // MASTERCARD with amount on the right
      doc.fontSize(9).font('OCR-B').text('MASTERCARD', leftMargin + 5, doc.y, { continued: true, width: 245 });
      doc.text(total.toFixed(2), { align: 'right', width: 245 });
      doc.moveDown(0.3);
      
      // Card number with INSERT
      const last4 = receipt.cardLast4 || '4459';
      const entryMethod = receipt.cardEntryMethod === 'INSERT' ? 'INSERT' : 
                          receipt.cardEntryMethod === 'TAP' ? 'TAP' : 'SWIPED';
      doc.fontSize(9).font('OCR-B').text(`************${last4}    ${entryMethod}`, leftMargin + 5);
      
      // Authorization details - match screenshot format
      const authNum = Math.floor(Math.random() * 900000) + 100000; // 6-digit number (e.g., 091762)
      doc.fontSize(9).font('OCR-B').text(`Auth No: ${authNum.toString().padStart(6, '0')}`, leftMargin + 10);
      
      // Generate random invoice number (5 digits, e.g., 39287)
      const invoiceNum = Math.floor(Math.random() * 90000) + 10000;
      doc.fontSize(9).font('OCR-B').text(`INVOICE# ${invoiceNum}`, leftMargin + 5);
      
      // AID
      doc.fontSize(9).font('OCR-B').text('AID: A0000000041010', leftMargin);
      
      // APP: Mastercard
      doc.fontSize(9).font('OCR-B').text('APP: Mastercard', leftMargin);
      
      // Verified by PIN
      doc.fontSize(9).font('OCR-B').text('Verified by PIN', leftMargin);
      doc.moveDown(1);
      // Show signature line and label at bottom if no signature image
      doc.moveDown(1.5);
      doc.fontSize(9).font('OCR-B').text('______________________________________________', leftMargin);
      doc.moveDown(0.1);
      doc.fontSize(9).font('OCR-B').text('Signature:', leftMargin);
      doc.moveDown(1);
      // Add signature image only if checkbox is checked
      const includeSignature = receipt.includeSignature;
      if (includeSignature) {
        try {
          const signaturePath = path.resolve(process.cwd(), 'assets/signatures/signature.jpeg');
          if (fs.existsSync(signaturePath)) {
            const signatureWidth = 80;
            const signatureHeight = 20;
            const signatureX = (doc.page.width - signatureWidth) / 2; // Center the signature
            const signatureY = doc.y;
            
            // Try to load the image with error handling for corrupted JPEGs
            try {
              doc.image(signaturePath, signatureX, signatureY, {
                width: signatureWidth,
                height: signatureHeight
              });
              doc.y = signatureY + signatureHeight + 10;
            } catch (imageError) {
              // Fallback: draw a signature line instead
              doc.fontSize(9).font('OCR-B').text('_________________', leftMargin + 50);
              doc.moveDown(1);
            }
          } else {
            // Fallback: draw a signature line
            doc.fontSize(9).font('OCR-B').text('_________________', leftMargin + 50);
            doc.moveDown(1);
          }
        } catch (error) {
          // Fallback: draw a signature line
          doc.fontSize(9).font('OCR-B').text('_________________', leftMargin + 50);
          doc.moveDown(1);
        }
      } else {
        doc.moveDown(1);
      }
      
      // TruckingCompanyName and VehicleID - match screenshot format
      const companyName = receipt.driverCompanyName || 'NCMP';
      const vehicleId = receipt.vehicleId || '101';
      doc.fontSize(9).font('OCR-B').text('TruckingCompanyName', leftMargin, doc.y, { continued: true, width: 247 });
      doc.text(companyName, { align: 'right', width: 247 });
      doc.fontSize(9).font('OCR-B').text('VehicleID', leftMargin, doc.y, { continued: true, width: 247 });
      doc.text(vehicleId, { align: 'right', width: 247 });
      doc.moveDown(0.5);
      
      // Dashed separator line
      doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
      doc.moveDown(1.5);
      
      // My Love Rewards section
      doc.fontSize(9).font('OCR-B').text('My Love Rewards', { align: 'center' });
      doc.moveDown(1);
      
      // Generate random loyalty member name
      const loyaltyNames = ['Syed Abdul Sani', 'John Smith', 'Michael Brown', 'Sarah Johnson'];
      const loyaltyName = loyaltyNames[Math.floor(Math.random() * loyaltyNames.length)];
      doc.fontSize(9).font('OCR-B').text(`Loyalty Member ${loyaltyName}`, { align: 'left' });
      
      // Generate random points
      const pointsEarned = Math.floor(Math.random() * 200) + 100; // 100-300 points
      const pointsRedeemed = 0;
      const pointsBalance = Math.floor(Math.random() * 3000) + 1500; // 1500-4500 points
      
      doc.fontSize(9).font('OCR-B').text('Points Earned', leftMargin, doc.y, { continued: true, width: 247 });
      doc.text(pointsEarned.toString(), { align: 'right', width: 247 });
      doc.fontSize(9).font('OCR-B').text('Points Redeemed', leftMargin, doc.y, { continued: true, width: 247 });
      doc.text(pointsRedeemed.toString(), { align: 'right', width: 247 });
      doc.fontSize(9).font('OCR-B').text('Points Balance', leftMargin, doc.y, { continued: true, width: 247 });
      doc.text(pointsBalance.toString(), { align: 'right', width: 247 });
    }

    // Transaction details - hide for EFS, Visa, and Master payments (Master is handled above)
    if (receipt.paymentMethod !== 'EFS' && receipt.paymentMethod !== 'Visa' && receipt.paymentMethod !== 'Master') {
      // Only show TruckingCompanyName and VehicleID for non-TCH payments
      if (receipt.paymentMethod !== 'TCH') {
        const companyName = receipt.driverCompanyName || 'private';
        const vehicleId = receipt.vehicleId || '0';
        doc.fontSize(9).font('OCR-B').text(`TruckingCompanyName`, leftMargin, doc.y, { continued: true, width: 247 });
        doc.text(companyName, { align: 'right', width: 205 });
        doc.fontSize(9).font('OCR-B').text(`VehicleID`, leftMargin, doc.y, { continued: true, width: 247 });
        doc.text(vehicleId, { align: 'right', width: 205 });
      }
      
      // Additional fields for Cash payment - match screenshot format
      if (receipt.paymentMethod === 'Cash') {
        doc.fontSize(9).font('OCR-B').text('DLState', leftMargin);
        doc.fontSize(9).font('OCR-B').text('Odometer', leftMargin);
        doc.fontSize(9).font('OCR-B').text('HubOdometer', leftMargin);
        doc.fontSize(9).font('OCR-B').text('TripNumber', leftMargin);
        doc.fontSize(9).font('OCR-B').text('TrailerID', leftMargin);
        doc.fontSize(9).font('OCR-B').text('UnitLicenseNumber', leftMargin);
        doc.fontSize(9).font('OCR-B').text('UnitLicenseState', leftMargin);
      }
      
      // TCH payment shows Pos and Date (no additional fields needed)
      if (receipt.paymentMethod === 'TCH') {
        // TCH payments show Pos and Date in the main section
      }
      
      doc.fontSize(9).font('OCR-B').text('Pos: #1', { align: 'left' });
      doc.fontSize(9).font('OCR-B').text(`Date: ${formattedDate}`, { align: 'left' });

      doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
    doc.moveDown(0.5);

    // Final total and footer - matching screenshot exactly
      doc.fontSize(9).font('OCR-B').text('Total Sale:', leftMargin, doc.y, { continued: true, width: 247 });
      doc.text(total.toFixed(2), { align: 'right', width: 247 });
    doc.moveDown(0.5);
      doc.fontSize(9).font('OCR-B').text('Thank you for shopping at Love\'s', { align: 'left' });
    }

    doc.end();
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });
  }
}

export class TravelCentersOfAmericaReceiptGenerator {
  async generate(receipt: Receipt, outputPath: string): Promise<void> {
    const doc = new PDFDocument({ size: [280, 800], margin: 15, autoFirstPage: false });
    const fontPath = path.join(__dirname, '../fonts/ocr_b_becker.ttf');
    const fontPath2 = path.join(__dirname, '../fonts/ocr_b_becker_bold.ttf');
    doc.registerFont('OCR-B', fontPath);
    doc.registerFont('OCR-B-Bold', fontPath2);
    doc.addPage({ size: [280, 800], margin: 15 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const leftMargin = 15;

    // TA header with logo
    try {
      const logoPath = path.resolve(process.cwd(), 'assets/logos/ta-logo.jpeg');
      
      if (!fs.existsSync(logoPath)) {
        throw new Error(`Logo not found at: ${logoPath}`);
      }
      
      // Add the logo image - use only width to maintain aspect ratio
      doc.image(logoPath, (doc.page.width - 100) / 2, doc.y, { width: 100 });
      
      // Move cursor down by proper logo height plus extra spacing
      doc.y = doc.y + 70 + 30; // Proper logo height + 15pts spacing
    } catch (error) {
      // Fallback to text if logo can't be loaded
      console.error('Error loading TA logo:', error);
    doc.fontSize(24).font('OCR-B').text('TravelCenters', { align: 'center' });
    doc.fontSize(12).font('OCR-B').text('of America', { align: 'center' });
    doc.fontSize(8).font('OCR-B').text('TA PETRO', { align: 'center' });
    doc.moveDown(1.5);
    }

    // Store info centered - use dynamic data from selected store or fallback to hardcoded
    const storeNumber = receipt.companyData?.storeNumber || '245';
    const address = receipt.companyData?.address || '24601 Center Ridge Road';
    const cityState = receipt.companyData?.city || 'Westlake, OH 44145';
    const phone = receipt.companyData?.phone || '(440) 555-0555';
    
    doc.fontSize(9).font('OCR-B').text(`${storeNumber}`, { align: 'center' });
    doc.fontSize(9).text(address, { align: 'center' });
    doc.fontSize(9).text(cityState, { align: 'center' });
    doc.fontSize(9).text(phone, { align: 'center' });
    doc.moveDown(0.8);

    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
    doc.moveDown(0.5);

    // Receipt header - match screenshot 1 format
    doc.fontSize(9).font('OCR-B').text(`Receipt #    ${receipt.receiptNumber.replace('REC-', '')}`, leftMargin);
    doc.moveDown(0.3);
    // Format "Wed Sep 6 2023" with *no* comma after weekday
    (() => {
      const d = receipt.date;
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      const month = d.toLocaleDateString('en-US', { month: 'short' });
      const day = d.getDate();
      const year = d.getFullYear();
      const displayStr = `${weekday} ${month} ${day} ${year}`;
      doc.fontSize(9).font('OCR-B').text(displayStr, leftMargin);
    })();
    doc.moveDown(0.3);
    doc.fontSize(9).font('OCR-B').text('Sherline Marshall', leftMargin);
    doc.moveDown(0.3);
    doc.fontSize(9).font('OCR-B').text('Register    #41', leftMargin);
    doc.moveDown(0.3);
    
    // Only show SUSPENDED for non-EFS payments
    if (receipt.paymentMethod !== 'EFS' && receipt.paymentMethod !== 'Master' && receipt.paymentMethod !== 'Cash' && receipt.paymentMethod !== 'Visa') {
      doc.fontSize(9).font('OCR-B').text('**** SUSPENDED ****', { align: 'left' });
    doc.moveDown(0.3);
    }

    // Use copyType for Visa payments, otherwise show ORIGINAL
    // Always display the selected copyType if provided, otherwise show ORIGINAL
    const copyTypeDisplay = receipt.copyType ? receipt.copyType.toUpperCase() : 'ORIGINAL';
    doc.fontSize(9).font('OCR-B').text(`Type:    SALE              (${copyTypeDisplay})`, leftMargin);
      doc.moveDown(0.3);
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
    doc.moveDown(0.3);

    // Table header - Petro-Canada style (QTY first, then NAME)
    const headerLine = 'Qty'.padEnd(5) + 'Name'.padEnd(20) + 'Price'.padEnd(9) + 'Total';
    doc.fontSize(10).font('OCR-B').text(headerLine, leftMargin);
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);

    // Calculate totals
    const subtotal = receipt.items.reduce((sum, item) => {
      const isCashAdvance = item.name.toLowerCase().includes('cash advance');
      // For cash advance, price is already the total (quantity is 1)
      // For regular items, calculate quantity * price
      return isCashAdvance ? sum + item.price : sum + (item.quantity * item.price);
    }, 0);
    
    // Items section - Petro-Canada style format (US units)
    receipt.items.forEach(item => {
      // Check if this is a cash advance item
      const isCashAdvance = item.name.toLowerCase().includes('cash advance');
      
      // Calculate totals for all items
      const total = isCashAdvance ? item.price : (item.quantity * item.price);
      
      // Display item in Petro-Canada style format with proper alignment
      const qtyDisplay = item.qty || 1;
      const qtyStr = qtyDisplay.toString();
      
      // Format item line: name (padded to 20) + qty (padded to 5) + price (padded to 7) + total
      // For cash advance, show the price as the price; for regular items, show price per gallon
      const priceToShow = isCashAdvance ? item.price : item.price;
      const itemLine = qtyStr.padEnd(5) + item.name.padEnd(20) +  priceToShow.toFixed(2).padEnd(9) + total.toFixed(2);
      doc.fontSize(10).font('OCR-B').text(itemLine, leftMargin);
      
      // Fuel details - use US units (Gallons instead of Liters) - only for non-cash advance items
      if (!isCashAdvance) {
        const pumpNumber = item.pump !== undefined && item.pump !== null ? item.pump : Math.floor(Math.random() * 15) + 1;
        const gallons = item.quantity.toFixed(3);  // quantity is gallons
        const pricePerGallon = item.price.toFixed(3);  // price is price per gallon
        
        console.log('TA Receipt - Item:', { pump: item.pump, qty: item.qty, pumpNumber });
        
        // Align the values by using consistent padding (same as Petro-Canada style)
        doc.fontSize(10).font('OCR-B').text(` Pump:        ${pumpNumber}`, leftMargin + 35);
        doc.fontSize(10).font('OCR-B').text(` Gallons:     ${gallons}`, leftMargin + 35);
        doc.fontSize(10).font('OCR-B').text(` Price / Gal: ${pricePerGallon}`, leftMargin + 35);
      }
      
      doc.moveDown(1);
    });

    // Totals section - match One9 format exactly
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
    doc.moveDown(0.3);
    
    const tax = subtotal * 0.08;
    const salesTax = 0.00;
    const total = subtotal + salesTax
    
    doc.fontSize(9).font('OCR-B').text('Sale Total', leftMargin, doc.y, { continued: true, width: 245 });
    doc.text(subtotal.toFixed(2), { align: 'right', width: 245 });
    
    doc.fontSize(9).text('Sales Tax Total', leftMargin, doc.y, { continued: true, width: 245 });
    doc.text(salesTax.toFixed(2), { align: 'right', width: 245 });
    doc.moveDown(0.3);

    
    doc.fontSize(9).font('Helvetica-Bold').text('Total', leftMargin, doc.y, { continued: true, width: 245 });
    doc.text(`$${total.toFixed(2)}`, { align: 'right', width: 245 });
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
    doc.moveDown(0.3);

    // Payment section - conditional based on payment method
    if (receipt.paymentMethod === 'EFS') {
      // EFS payment format
      doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
      doc.fontSize(9).font('OCR-B').text('EFS TransCheck', leftMargin +10, doc.y, { continued: true, width: 238 });
      doc.text(total.toFixed(2), { align: 'right', width: 238 });
      
      // Generate random auth code and invoice number
      const authCode = Math.floor(Math.random() * 900000) + 100000; // 6-digit number
      const invoiceNumber = Math.floor(Math.random() * 90000) + 10000; // 5-digit number
      
      // Add Approved status before Auth Code
      doc.fontSize(9).font('OCR-B').text('Approved', leftMargin +10);
      doc.fontSize(9).font('OCR-B').text(`Auth. Code: ${authCode}`, leftMargin +10);
      doc.fontSize(9).font('OCR-B').text(`Invoice NO. ${invoiceNumber}`, leftMargin +10);
      doc.moveDown(1);

      // PROMPTS section for EFS
      doc.fontSize(9).font('OCR-B').text('PROMPTS', leftMargin);
      doc.moveDown(0.3);
      
      // Use user-entered values (no fallbacks)
      const checkNumber = receipt.checkNumber || '';
      const checkNumberConfirm = receipt.checkNumberConfirm || '';
      const driverFName = receipt.driverFirstName || '';
      const driverLName = receipt.driverLastName || '';
      
      doc.fontSize(9).font('OCR-B').text('CheckNumber          :', leftMargin +10, doc.y, { continued: true, width: 245 });
      doc.text(checkNumber, leftMargin + 20);
      doc.fontSize(9).font('OCR-B').text('CheckNumberConfirm   :', leftMargin +10, doc.y, { continued: true, width: 245 });
      doc.text(checkNumberConfirm, leftMargin + 20);
      doc.fontSize(9).font('OCR-B').text('DriverFName          :', leftMargin +10, doc.y, { continued: true, width: 245 });
      doc.text(driverFName, leftMargin + 20);
      doc.fontSize(9).font('OCR-B').text('DriverLName          :', leftMargin +10, doc.y, { continued: true, width: 245 });
      doc.text(driverLName, leftMargin + 20);
    doc.moveDown(0.5);
    } else if (receipt.paymentMethod === 'Master') {
      // Master payment format - match screenshot exactly
      doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
      
      // MASTERCARD with amount on the right
      const cardLast4 = receipt.cardLast4 || '3495';
      doc.fontSize(9).font('OCR-B').text('MASTERCARD', leftMargin + 10, doc.y, { continued: true, width: 238 });
      doc.text(total.toFixed(2), { align: 'right', width: 238 });
      doc.moveDown(0.3);
      
      // Masked card number with amount on the right
      doc.fontSize(9).font('OCR-B').text(`XXXXXXXXXXXX${cardLast4}`, leftMargin + 20);

      doc.moveDown(0.3);
      
      // Generate authorization code (format: 5 digits + letter)
      const authCodeDigits = Math.floor(Math.random() * 90000) + 10000; // 5-digit number
      const authCodeLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // Random letter A-Z
      const authCode = `${authCodeDigits}${authCodeLetter}`;
      
      // APPROVED with auth code
      doc.fontSize(9).font('OCR-B').text(`APPROVED ${authCode}`, leftMargin + 10);
      doc.moveDown(0.3);
      
      // Auth. Code
      doc.fontSize(9).font('OCR-B').text(`Auth. Code: ${authCode}`, leftMargin + 10);
      doc.moveDown(0.3);
      
      // Invoice NO.
      const invoiceNo = Math.floor(Math.random() * 90000) + 10000; // 5-digit number
      doc.fontSize(9).font('OCR-B').text(`Invoice NO. ${invoiceNo}`, leftMargin + 10);
      doc.moveDown(0.3);
      
      // AID (Application Identifier)
      const aid = `a0000000041010`; // Standard Mastercard AID
      doc.fontSize(9).font('OCR-B').text(`AID: ${aid}`);
      doc.moveDown(0.3);
      
      // APP: MASTERCARD
      doc.fontSize(9).font('OCR-B').text('APP: MASTERCARD');
      doc.moveDown(0.3);
      
      // TID (Terminal ID) - masked format
      const tidLast4 = Math.floor(Math.random() * 9000) + 1000; // 4-digit number
      doc.fontSize(9).font('OCR-B').text(`TID: *********${tidLast4}`);
      doc.moveDown(0.3);
      
      // Card Entry Method
      const entryMethod = receipt.cardEntryMethod || 'INSERT';
      let entryMethodDisplay = entryMethod;
      if (entryMethod === 'TAP') {
        entryMethodDisplay = 'Contactless';
      } else if (entryMethod === 'INSERT') {
        entryMethodDisplay = 'Contactiess';
      } else if (entryMethod === 'SWIPE') {
        entryMethodDisplay = 'Swiped';
      }
      
      doc.fontSize(9).font('OCR-B').text('Card Entry Method:');
      doc.moveDown(0.1);
      doc.fontSize(9).font('OCR-B').text(entryMethodDisplay);
      doc.moveDown(0.3);
      
      // Payment Network
      doc.fontSize(9).font('OCR-B').text('Payment Network: 14');
      doc.moveDown(0.3);
      
      // Authorized by Issuer
      doc.fontSize(9).font('OCR-B').text('Authorized by Issuer');
      doc.moveDown(1);
      
      // PROMPTS section for Master payment
      doc.fontSize(9).font('OCR-B').text('PROMPTS');
      doc.moveDown(0.3);
      
      // Use user-entered values (no fallbacks)
      const checkNumber = receipt.checkNumber || '';
      const checkNumberConfirm = receipt.checkNumberConfirm || '';
      const driverFName = receipt.driverFirstName || '';
      const driverLName = receipt.driverLastName || '';
      
      doc.fontSize(9).font('OCR-B').text(`TruckingCompanyName:    ${receipt.driverCompanyName || ''}`, leftMargin + 20);
      doc.fontSize(9).font('OCR-B').text(`VehicleID:              ${receipt.vehicleId || ''}`, leftMargin + 20);
      doc.moveDown(0.5);
    } else if (receipt.paymentMethod === 'TCH') {
      // TCH payment format - match screenshot exactly
      doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
      doc.fontSize(9).font('OCR-B').text('TCH Card', leftMargin + 10, doc.y, { continued: true, width: 238 });
      doc.text(total.toFixed(2), { align: 'right', width: 238 });
      
      // Card details
      const cardLast4 = receipt.cardLast4 || '4551';
      const entryMethod = receipt.cardEntryMethod || 'SWIPED';
      
      doc.fontSize(9).font('OCR-B').text(`XXXXXXXXXXXXXXX${cardLast4}    ${entryMethod}`, leftMargin + 10);
      
      // Transaction status
      doc.fontSize(9).font('OCR-B').text('Approved', leftMargin + 10);
      
      // Authorization number
      const authNumber = Math.floor(Math.random() * 900000) + 100000; // 6-digit number
      doc.fontSize(9).font('OCR-B').text(`Auth #: ${authNumber}`, leftMargin + 10);
      doc.moveDown(1.5);
      
      // Company name - show user-entered company name
      const userCompanyName = receipt.driverCompanyName || 'ACG';
      const userVehicleId = receipt.vehicleId || '';
      doc.fontSize(9).font('OCR-B').text(
        `TruckingCompanyNameTCI     ${userCompanyName}`, 
        leftMargin + 10
      );
      doc.fontSize(9).font('OCR-B').text(
        `VehicleID                  ${userVehicleId}`,
        leftMargin + 10
      );
      doc.moveDown(1);
    } else if (receipt.paymentMethod === 'Visa') {
      // Visa payment format - match screenshot exactly
      doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
      doc.fontSize(9).font('OCR-B').text('VISA', leftMargin + 10, doc.y, { continued: true, width: 238 });
      doc.text(total.toFixed(2), { align: 'right', width: 238 });
      doc.moveDown(0.3);
      
      // Card details
      const cardLast4 = receipt.cardLast4 || '5106';
      
      doc.fontSize(9).font('OCR-B').text(`XXXXXXXXXXXX${cardLast4} `, leftMargin + 20);
      doc.moveDown(0.3);
      
      // Transaction status
      doc.fontSize(9).font('OCR-B').text('Approved', leftMargin + 10);
      doc.moveDown(0.1);
      
      // Transaction details
      const authCode = Math.floor(Math.random() * 900000) + 100000; // 6-digit number
      const invoiceNo = Math.floor(Math.random() * 90000) + 10000; // 5-digit number
      const aid = `a${Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0')}`; // Random AID
      const tid = `*********${Math.floor(Math.random() * 9000) + 1000}`; // Random TID with masked digits
      const mid = Math.floor(Math.random() * 9000) + 1000; // Random 4-digit MID
      
      doc.fontSize(9).font('OCR-B').text(`Auth.  Code:   ${authCode}`, leftMargin + 10);
      doc.moveDown(0.1);
      doc.fontSize(9).font('OCR-B').text(`Invoice NO.   ${invoiceNo}`, leftMargin + 10);
      doc.moveDown(0.1);
      doc.fontSize(9).font('OCR-B').text(`AID: ${aid}`, leftMargin);
      doc.moveDown(0.1);  
      doc.fontSize(9).font('OCR-B').text('APP: Visa DEBIT', leftMargin);
      doc.moveDown(0.1);
      doc.fontSize(9).font('OCR-B').text('Verified by PIN', leftMargin);
      doc.moveDown(0.1);
      doc.fontSize(9).font('OCR-B').text(`TID: ${tid}`, leftMargin);
      doc.moveDown(0.1);
      doc.fontSize(9).font('OCR-B').text(`MID: ${mid}`, leftMargin);
      doc.moveDown(0.1);
      doc.fontSize(9).font('OCR-B').text('Card Entry Method:', leftMargin);
      doc.moveDown(0.1);
      doc.fontSize(9).font('OCR-B').text('Chip Read', leftMargin);
      doc.moveDown(0.1);
      doc.fontSize(9).font('OCR-B').text('Payment Network: 02', leftMargin);
      doc.moveDown(0.1);
      doc.fontSize(9).font('OCR-B').text('Authorized by Issuer', leftMargin);
      doc.moveDown(1);
      
      // PROMPTS section
      doc.fontSize(9).font('OCR-B').text('PROMPTS', leftMargin + 10);
      doc.moveDown(0.3);
      
      const vehicleId = receipt.vehicleId || '';
      const truckingCompanyName = receipt.driverCompanyName || '';
      if (truckingCompanyName) {
        doc.fontSize(9).font('OCR-B').text(`TruckingCompanyName:     ${truckingCompanyName}` , leftMargin + 20);
      }
      if (vehicleId) {
        doc.fontSize(9).font('OCR-B').text(`VehicleID:               ${vehicleId}`, leftMargin + 20);
        const entryMethod = receipt.cardEntryMethod ? receipt.cardEntryMethod.toUpperCase() : '';
        doc.fontSize(9).font('OCR-B').text(`EntryMethod:             ${entryMethod}`, leftMargin + 20);
      }
    } else {
      // Cash payment format
      doc.fontSize(9).font('OCR-B').text('Received', leftMargin);
      doc.fontSize(9).font('OCR-B').text('Cash', leftMargin + 10, doc.y, { continued: true, width: 238 });
      doc.text(total.toFixed(2), { align: 'right', width: 238 });
      doc.moveDown(1);

      // PROMPTS section for Cash
      doc.fontSize(9).font('OCR-B').text('PROMPTS', leftMargin);
      doc.moveDown(0.3);
      
      const companyName = receipt.driverCompanyName || 'MCNP LOGI';
      const vehicleId = receipt.vehicleId || '101';
      
      doc.fontSize(9).font('OCR-B').text(`TruckingCompanyName:   ${companyName}`, leftMargin + 10);
      doc.fontSize(9).font('OCR-B').text('VehicleID:', leftMargin +10, doc.y, { continued: true, width: 150 });
      doc.text(vehicleId, leftMargin + 78);
      doc.moveDown(1);
    }

    // Dashed separator
    doc.fontSize(7).font('OCR-B').text('----------------------------------------------------------', leftMargin);
    doc.moveDown(0.3);

    // Store Manager section
    doc.fontSize(9).font('OCR-B').text('Store Manager: 603-436-3636', leftMargin);
    doc.moveDown(0.5);

    // Footer section
    doc.fontSize(9).font('OCR-B').text('Please come again!', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('OCR-B').text('Your feedback matters.', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('OCR-B').text('Tell us about your visit', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('OCR-B').text('at www.tafeedback.com.', { align: 'center' });

    doc.end();
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });
  }

}

export class HuskyReceiptGenerator {
  async generate(receipt: Receipt, outputPath: string): Promise<void> {
    const doc = new PDFDocument({ size: [280, 800], margin: 15, autoFirstPage: false });
    const fontPath = path.join(__dirname, '../fonts/ocr_b_becker.ttf');
    doc.registerFont('OCR-B', fontPath);
    doc.addPage({ size: [280, 800], margin: 15 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const leftMargin = 15;

    // Load and display Husky logo at the top
    try {
      // Prefer explicit Husky logo from assets/logos
      let logoPath = path.resolve(process.cwd(), 'assets/logos/husky-logo.jpeg');

      
      if (fs.existsSync(logoPath)) {
        const logoWidth = 70;
        const logoHeight = 25;
        const logoX = (doc.page.width - logoWidth) / 2;
        const currentY = doc.y;
        
        doc.image(logoPath, logoX, currentY, {
          width: logoWidth,
          height: logoHeight,
          align: 'center'
        });
        
        doc.y = currentY + logoHeight + 10;
      } else {
        // Fallback to text
        doc.fontSize(28).font('OCR-B').text('HUSKY', { align: 'center' });
        doc.moveDown(0.5);
      }
    } catch (error) {
      console.error('Error loading Husky logo:', error);
      doc.fontSize(28).font('OCR-B').text('HUSKY', { align: 'center' });
      doc.moveDown(0.5);
    }

    // Text after logo - match screenshot
    // Show city/state prominently, as requested
    // Display dynamic city/state prominently (centered)
    doc.moveDown(1);
    const prominentCity = (receipt.companyData?.city || 'MISSISSAUGA ON L5S 1E1').split(' ')[0] + ' ' + (receipt.companyData?.city || 'MISSISSAUGA ON L5S 1E1').split(' ')[1];
    doc.fontSize(16).font('OCR-B').text(`${prominentCity} HUSKY`, { align: 'center' });
    doc.fontSize(16).font('OCR-B').text('TC/ESSO', leftMargin + 10, doc.y, { align: 'left' });

    // Store info - match screenshot exactly (center-aligned)
    const storeNumber = receipt.companyData?.storeNumber || 'DIXIE MART (MISSISSAUGA)';
    const address = receipt.companyData?.address || '7280 DIXIE RD';
    const cityState = receipt.companyData?.city || 'MISSISSAUGA ON L5S 1E1';
    const phone = receipt.companyData?.phone || '(905) 565-1476';

    doc.fontSize(10).font('OCR-B').text(address, leftMargin + 70);
    doc.fontSize(10).font('OCR-B').text(cityState, leftMargin + 70);
    doc.fontSize(10).font('OCR-B').text(phone, leftMargin + 90);
    doc.moveDown(1);

    // Transaction details - match screenshot exactly
    doc.fontSize(10).font('OCR-B').text('GST# 104885132   Merchant ID:4102536', leftMargin + 10);
    
    // Optional suspended line (hidden for Master and TCH)
    if ((receipt.paymentMethod || '').toLowerCase() !== 'master' && (receipt.paymentMethod || '').toLowerCase() !== 'tch' && (receipt.paymentMethod || '').toLowerCase() !== 'interac') {
      doc.fontSize(10).font('OCR-B').text('Receipt 71020207 ****SUSPENDED****', leftMargin);
    }

     // Show Receipt number (right-aligned) for ALL payment methods, as in screenshot
     const huskyReceiptNum = Math.floor(Math.random() * 9000000) + 1000000; // 7 digits
     doc.fontSize(10).font('OCR-B').text('Receipt:', leftMargin, doc.y, { continued: true, width: 100 });
     doc.font('OCR-B').text(`${huskyReceiptNum}`, { align: 'right', width: 100 });
    
    // Show Type for all payment methods - use copyType if provided
    const copyTypeDisplay = receipt.copyType ? ` (${receipt.copyType.toUpperCase()})` : '';
    doc.fontSize(10).font('OCR-B').text('Type:  SALE', leftMargin);
    doc.fontSize(8).font('OCR-B').text('---------------------------------------------------', leftMargin);
    doc.moveDown(0.3);
    
    // Column headers - match USA format exactly
    doc.fontSize(10).font('OCR-B').text('Qty Name               Price       Total', leftMargin);
    doc.fontSize(8).font('OCR-B').text('---------------------------------------------------', leftMargin);

    // Calculate subtotal (do not include "cash advance" items)
    const subtotal = receipt.items.reduce((sum, item) => {
      const isCashAdvance = item.name.toLowerCase().includes('cash advance');
      return isCashAdvance ? sum : sum + (item.quantity * item.price);
    }, 0);

    // Items section - conditional price/total values based on payment method
    const isTCHPayment = (receipt.paymentMethod || '').toLowerCase() === 'tch';
    receipt.items.forEach(item => {
      // Skip line total for "cash advance" in subtotal but still print in list
      const qtyDisplay = item.qty || 1;
      // Pad quantity to always be 2 chars (like Petro-Canada)
      const qtyStr = qtyDisplay.toString().padStart(2, ' ');
      const nameStr = item.name; // no forced length here, pad in the line

      // Assemble item display parts - conditional based on payment method
      let line;
      if (isTCHPayment) {
        // For TCH: only Qty and Name (no Price/Total values, but headers remain)
        line =
          qtyStr.padEnd(4) + // always 3 spaces for qty
          nameStr.padEnd(30).slice(0, 30); // force name to 30 chars
      } else {
        // For other payment methods: show Qty, Name, Price, Total values
        const total = item.quantity * item.price;
        line =
          qtyStr.padEnd(4) + // always 3 spaces for qty
          nameStr.padEnd(18).slice(0, 18) + // force name to 18 chars
          `$ ${total.toFixed(2)}`.padStart(8) + // price (3 decimals) with $ sign
          `$ ${total.toFixed(2)}`.padStart(11); // total (2 decimals) with $ sign
      }

      doc.fontSize(10).font('OCR-B').text(line, leftMargin);

      // Fuel details - conditional based on payment method
      const pumpNumber = item.pump !== undefined && item.pump !== null ? item.pump : Math.floor(Math.random() * 20) + 1;
      const liters = item.quantity.toFixed(3);

      doc.fontSize(10).font('OCR-B').text(`   Pump:        ${pumpNumber}`, leftMargin + 16);
      doc.fontSize(10).font('OCR-B').text(`   Liters:      ${liters}`, leftMargin + 16);
      doc.fontSize(10).font('OCR-B').text(`   Price/Liter: $${liters}`, leftMargin + 16);

      // Show price per liter only for non-TCH payment methods
      if (!isTCHPayment) {
        doc.fontSize(8).font('OCR-B').text('---------------------------------------------------', leftMargin);
      }
      doc.moveDown(0.3);
    });

    // Calculate total for payment sections
    const salesTax = 0.00;
    const total = subtotal + salesTax;

    // Totals - skip for TCH payment method
    if (receipt.paymentMethod !== 'TCH') {
      doc.fontSize(10).font('OCR-B').text('Subtotal', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text(`$ ${subtotal.toFixed(2)}`, { align: 'right', width: 248 });
      
      doc.fontSize(10).font('OCR-B').text('GST/HST Fuel', leftMargin, doc.y, { continued: true, width: 248 });
      // Calculate sales tax as 13% of subtotal (Petro Canada style)
      const hstRate = 1.13;
      const withoutHstAmount = subtotal / hstRate;
      const hstAmount = subtotal - withoutHstAmount;
      const computedSalesTax = hstAmount;
      doc.font('OCR-B').text(`$ ${computedSalesTax.toFixed(2)}`, { align: 'right', width: 248 });
      
      doc.fontSize(8).font('OCR-B').text('---------------------------------------------------', leftMargin);
      doc.moveDown(0.3);
    }

    // Payment section - match USA format exactly
    if (receipt.paymentMethod === 'TCH') {
      // PreAuth Completion format - match screenshot exactly
      doc.fontSize(10).font('OCR-B').text('ODOM:', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text('1234', 170);
      doc.moveDown(1.5);

      doc.fontSize(10).font('OCR-B').text('PreAuth Completion', leftMargin);

      const last4 = receipt.cardLast4 || '4577';
      // Masked card and Exp on the same line
      doc.fontSize(10).font('OCR-B').text(`#***************${last4}`, leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text('Exp */* S', 30);

      const now = new Date();

      // EFS TCH branding and right-aligned full timestamp (YYYY/MM/DD HH:MM:SS)
      const tchYear = now.getFullYear().toString();
      const tchMonth = (now.getMonth() + 1).toString().padStart(2, '0');
      const tchDay = now.getDate().toString().padStart(2, '0');
      const tchHour = now.getHours().toString().padStart(2, '0');
      const tchMin = now.getMinutes().toString().padStart(2, '0');
      const tchSec = now.getSeconds().toString().padStart(2, '0');
      doc.fontSize(10).font('OCR-B').text('EFS TCH', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text(`${tchYear}/${tchMonth}/${tchDay} ${tchHour}:${tchMin}:${tchSec}`, { align: 'right', width: 248 });

      // REG# left and AUTH # right
      const authTch = Math.floor(Math.random() * 900000) + 100000; // 6 digits
      doc.fontSize(10).font('OCR-B').text('REG#: 71', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text(`AUTH #: ${authTch}`, 60);
      doc.moveDown(1);

      // Separator line
      doc.fontSize(8).font('OCR-B').text('--------------------------------------------------', leftMargin);
      
      // Bottom section with date/time and POS details
      const bottomYear = now.getFullYear().toString().substr(-2);
      const bottomMonth = (now.getMonth() + 1).toString().padStart(2, '0');
      const bottomDay = now.getDate().toString().padStart(2, '0');
      const bottomHours = now.getHours();
      const bottomMinutes = now.getMinutes().toString().padStart(2, '0');
      const bottomSeconds = now.getSeconds().toString().padStart(2, '0');
      const ampm = bottomHours >= 12 ? 'AM' : 'AM';
      const displayHours = bottomHours % 12 || 12;
      
      doc.fontSize(10).font('OCR-B').text(`${bottomMonth}/${bottomDay}/${bottomYear}`, leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text(`${displayHours}:${bottomMinutes}:${bottomSeconds} ${ampm}`, { align: 'center', width: 248 });
      doc.moveDown(1);
      
      doc.fontSize(10).font('OCR-B').text('Pos: 71 Cashier: 60 Store: 5285', leftMargin);
      doc.moveDown(1.5);
    } else if (receipt.paymentMethod === 'Master') {
      // Totals block
      doc.fontSize(10).font('OCR-B').text('Total', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text(`$ ${total.toFixed(2)}`, { align: 'right', width: 248 });
      doc.fontSize(10).font('OCR-B').text('Pre Auth Completion', leftMargin, doc.y, { continued: true, width: 200 });
      doc.font('OCR-B').text(`$ ${total.toFixed(2)}`, { align: 'right', width: 200 });
      doc.moveDown(0.5);

      // Card and brand lines
      const last4 = receipt.cardLast4 || '9015';
      doc.fontSize(10).font('OCR-B').text(`************${last4}`, leftMargin, doc.y, { continued: true, width: 190 });
      doc.font('OCR-B').text('Exp **/** C', { align: 'right', width: 190 });
      doc.fontSize(10).font('OCR-B').text('MASTERCARD', leftMargin);

      // Date/time
      const now = new Date();
      const mm = (now.getMonth() + 1).toString().padStart(2, '0');
      const dd = now.getDate().toString().padStart(2, '0');
      const yyyy = now.getFullYear();
      const hh = now.getHours().toString().padStart(2, '0');
      const mi = now.getMinutes().toString().padStart(2, '0');
      const ss = now.getSeconds().toString().padStart(2, '0');
      doc.fontSize(10).font('OCR-B').text(`${mm}/${dd}/${yyyy} ${hh}:${mi}:${ss}`, leftMargin);

      // REG/RESP/ISO row
      // Generate random REG/RESP/ISO/LANE values and output as one row
      // Use static/deterministic values instead of randomly generated numbers
      const regNum = 528571; // 7 digit number (fixed)
      const regAlpha = 'EK'; // single uppercase letter (fixed)
      const reg = `${regNum}${regAlpha}`; // e.g., 1234567A
      const lane = '71'; // lane 10-99 (fixed)
      const resp = '000'; // response code (fixed 3 digits)
      const iso = '00';   // ISO code (fixed 2 digits)
      doc.fontSize(10).font('OCR-B').text(
        `${reg}   ${lane}     RESP:${resp}    ISO:${iso}`,
        leftMargin
      );

      // Ref/Auth row
      const ref = Math.floor(Math.random() * 900000000000) + 100000000000; // 12 digits
      const auth = Math.floor(Math.random() * 900000) + 100000; // 6 random digits
      doc.fontSize(10).font('OCR-B').text(`Ref:${ref}`, leftMargin, doc.y, { continued: true, width: 170 });
      doc.font('OCR-B').text(`Auth:${auth}`, { align: 'right', width: 170 });

      // AID / TVR / TSI (randomized AID and TVR)
      const huskyMasterAid = 'A' + Array.from({ length: 13 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
      // Generate a 10-digit random number (digits only, not hex)
      const huskyMasterTvr = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
      doc.fontSize(10).font('OCR-B').text(`AID: ${huskyMasterAid}`, leftMargin);
      doc.fontSize(10).font('OCR-B').text(`TVR: ${huskyMasterTvr}`, leftMargin, doc.y, { continued: true, width: 170 });
      // Generate random 4-character hex for TSI
      const huskyMasterTsi = Array.from({length: 4}, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
      doc.font('OCR-B').text(`TSI: ${huskyMasterTsi}`, { align: 'right', width: 170 });

      // Approved centered
      doc.moveDown(0.8);
      doc.fontSize(10).font('OCR-B').text('Approved', { align: 'center' });
      doc.moveDown(2);

      // Separator and footer date/pos section
      doc.fontSize(8).font('OCR-B').text('--------------------------------------------------', leftMargin);
      const yy2 = yyyy.toString().slice(-2);
      doc.fontSize(10).font('OCR-B').text(`${mm}/${dd}/${yy2}`, leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text(`${hh}:${mi}:${ss} AM`, { align: 'center', width: 248 });
      doc.moveDown(1);
      doc.fontSize(10).font('OCR-B').text('Pos:71 Cashier:184 Store:5285', leftMargin);
    } else if (receipt.paymentMethod === 'Interac') {
      // Same layout as Master, but branded as Interac
      doc.fontSize(10).font('OCR-B').text('Total', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text(`$ ${total.toFixed(2)}`, { align: 'right', width: 248 });
      doc.fontSize(10).font('OCR-B').text('Pre Auth Completion', leftMargin, doc.y, { continued: true, width: 220 });
      doc.font('OCR-B').text(`$ ${total.toFixed(2)}`, { align: 'right', width: 220 });

      // Card and brand lines
      const last4I = receipt.cardLast4 || '9211';
      doc.fontSize(10).font('OCR-B').text('Chequing', leftMargin);
      doc.fontSize(10).font('OCR-B').text(`************${last4I}`, leftMargin, doc.y, { continued: true, width: 180 });
      doc.font('OCR-B').text('Exp **/** C', { align: 'right', width: 180 });
      doc.fontSize(10).font('OCR-B').text('Interac', leftMargin);

      // Date/time
      const nowI = new Date();
      const mmI = (nowI.getMonth() + 1).toString().padStart(2, '0');
      const ddI = nowI.getDate().toString().padStart(2, '0');
      const yyyyI = nowI.getFullYear();
      const hhI = nowI.getHours().toString().padStart(2, '0');
      const miI = nowI.getMinutes().toString().padStart(2, '0');
      const ssI = nowI.getSeconds().toString().padStart(2, '0');
      doc.fontSize(10).font('OCR-B').text(`${mmI}/${ddI}/${yyyyI} ${hhI}:${miI}:${ssI}`, leftMargin);

      // REG/RESP/ISO row (reuse Master fixed values look)
      const regI = '711371ED';
      const laneI = '71';
      doc.fontSize(10).font('OCR-B').text(
        `${regI}   ${laneI}    RESP:001   ISO:00`,
        leftMargin
      );

      // Ref/Auth row
      const refI = Math.floor(Math.random() * 900000000000) + 100000000000;
      const authI = Math.random().toString(36).slice(2, 8).toUpperCase();
      doc.fontSize(10).font('OCR-B').text(`Ref:${refI}`, leftMargin, doc.y, { continued: true, width: 170 });
      doc.font('OCR-B').text(`Auth:${authI}`, { align: 'right', width: 170 });

      // AID / TVR / TSI (use Interac-style randoms)
      const aidI = 'A' + Array.from({ length: 13 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
      const tvrI = Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
      doc.fontSize(10).font('OCR-B').text(`AID: ${aidI}`, leftMargin);
      doc.fontSize(10).font('OCR-B').text(`TVR: ${tvrI}`, leftMargin, doc.y, { continued: true, width: 170 });
      doc.font('OCR-B').text('TSI: E800', { align: 'right', width: 170 });

      // Approved centered
      doc.moveDown(0.8);
      doc.fontSize(10).font('OCR-B').text('Approved', { align: 'center' });
      doc.moveDown(1.5);

      // Separator and footer date/pos section
      doc.fontSize(8).font('OCR-B').text('--------------------------------------------------', leftMargin);
      const yy2I = yyyyI.toString().slice(-2);
      doc.fontSize(10).font('OCR-B').text(`${mmI}/${ddI}/${yy2I}`, leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text(`${hhI}:${miI}:${ssI} AM`, { align: 'center', width: 248 });
      doc.moveDown(1);
      doc.fontSize(10).font('OCR-B').text('Pos:71 Cashier:258 Store:7113', leftMargin);
    } else if (receipt.paymentMethod === 'Visa') {
      // Pre-authorization section - match screenshot exactly
      doc.fontSize(10).font('OCR-B').text('Total', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text(`$ ${total.toFixed(2)}`, { align: 'right', width: 248 });
      
      doc.fontSize(10).font('OCR-B').text('PreAuthorization', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text(`$ ${total.toFixed(2)}`, { align: 'right', width: 248 });
      
      doc.fontSize(10).font('OCR-B').text('Chequing', leftMargin);
      
      const last4 = receipt.cardLast4 || '9653';
      doc.fontSize(10).font('OCR-B').text(`************${last4}`, leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text('Exp **/** C', { align: 'right', width: 248 });
      
      doc.fontSize(10).font('OCR-B').text('Interac', leftMargin);
      
      // Date and time - match screenshot format
      const now = new Date();
      const visaDay = now.getDate().toString().padStart(2, '0');
      const visaMonth = (now.getMonth() + 1).toString().padStart(2, '0');
      const visaYear = now.getFullYear();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      doc.fontSize(10).font('OCR-B').text(`${visaMonth}/${visaDay}/${visaYear} ${hours}:${minutes}:${seconds}`, leftMargin);
      
      // Transaction details - match screenshot exactly
      const transactionId = '366571ED 71';
      doc.fontSize(10).font('OCR-B').text(transactionId, leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text('RESP:001', { align: 'right', width: 248 });
      doc.fontSize(10).font('OCR-B').text('', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text('ISO:00', { align: 'right', width: 248 });
      
      doc.fontSize(10).font('OCR-B').text('Ref: 530001001009', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text('Auth: 015854', { align: 'right', width: 248 });
      
      doc.fontSize(10).font('OCR-B').text('AID: A0000002771010', leftMargin);
      
      doc.fontSize(10).font('OCR-B').text('TVR: 0080008000', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text('TSI: E800', { align: 'right', width: 248 });
      
      // Approved status - centered
      doc.fontSize(10).font('OCR-B').text('Approved', { align: 'center' });
      doc.moveDown(1);
    } else if (receipt.paymentMethod === 'EFS') {
      // Pre-authorization section - match Husky Visa format exactly
      doc.fontSize(10).font('OCR-B').text('Total', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text(`$ ${total.toFixed(2)}`, { align: 'right', width: 248 });
      
      doc.fontSize(10).font('OCR-B').text('PreAuthorization', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text(`$ ${total.toFixed(2)}`, { align: 'right', width: 248 });
      
      doc.fontSize(10).font('OCR-B').text('Chequing', leftMargin);
      
      const last4 = receipt.cardLast4 || '9653';
      doc.fontSize(10).font('OCR-B').text(`************${last4}`, leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text('Exp **/** C', { align: 'right', width: 248 });
      
      doc.fontSize(10).font('OCR-B').text('Interac', leftMargin);
      
      // Date and time - match screenshot format
      const now = new Date();
      const efsDay = now.getDate().toString().padStart(2, '0');
      const efsMonth = (now.getMonth() + 1).toString().padStart(2, '0');
      const efsYear = now.getFullYear();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      doc.fontSize(10).font('OCR-B').text(`${efsMonth}/${efsDay}/${efsYear} ${hours}:${minutes}:${seconds}`, leftMargin);
      
      // Transaction details - match screenshot exactly
      const transactionId = '366571ED 71';
      doc.fontSize(10).font('OCR-B').text(transactionId, leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text('RESP:001', { align: 'right', width: 248 });
      doc.fontSize(10).font('OCR-B').text('', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text('ISO:00', { align: 'right', width: 248 });
      
      doc.fontSize(10).font('OCR-B').text('Ref: 530001001009', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text('Auth: 015854', { align: 'right', width: 248 });
      
      doc.fontSize(10).font('OCR-B').text('AID: A0000002771010', leftMargin);
      
      doc.fontSize(10).font('OCR-B').text('TVR: 0080008000', leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text('TSI: E800', { align: 'right', width: 248 });
      
      // Approved status - centered
      doc.fontSize(10).font('OCR-B').text('Approved', { align: 'center' });
      doc.moveDown(1);
    }

 

    // Bottom section - skip for TCH (handled above) and Master (handled above with screenshot layout)
    if (receipt.paymentMethod !== 'TCH' && receipt.paymentMethod !== 'Master' && receipt.paymentMethod !== 'Interac') {
      doc.fontSize(8).font('OCR-B').text('----------------------------------------------------', leftMargin);
      
      // Date and time in bottom section
      const now = new Date();
      const bottomDay = now.getDate().toString().padStart(2, '0');
      const bottomMonth = (now.getMonth() + 1).toString().padStart(2, '0');
      const bottomYear = now.getFullYear().toString().substr(-2);
      const hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      
      doc.fontSize(10).font('OCR-B').text(`${bottomMonth}/${bottomDay}/${bottomYear}`, leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text(`${displayHours}:${minutes}:${seconds} ${ampm}`, { align: 'center', width: 248 });
      
      doc.fontSize(10).font('OCR-B').text('Pos: 71 Cashier: 50 Store: 3665', leftMargin);
    }

    doc.end();
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });
  }
}

export class CanadianFlyingJReceiptGenerator {
  async generate(receipt: Receipt, outputPath: string): Promise<void> {
    const doc = new PDFDocument({ size: [280, 800], margin: 15, autoFirstPage: false });
    const fontPath = path.join(__dirname, '../fonts/ocr_b_becker.ttf');
    doc.registerFont('OCR-B', fontPath);
    doc.addPage({ size: [280, 800], margin: 15 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const leftMargin = 15;

    // Load and display Flying J logo at the top
    try {
      const logoPath = path.resolve(process.cwd(), 'assets/logos/flying-logo.jpeg');
      
      if (fs.existsSync(logoPath)) {
        const logoWidth = 150;
        const logoHeight = 70;
        const logoX = (doc.page.width - logoWidth) / 2;
        const currentY = doc.y;
        
        doc.image(logoPath, logoX, currentY, {
          width: logoWidth,
          height: logoHeight,
          align: 'center'
        });
        
        doc.y = currentY + logoHeight;
      } else {
        // Fallback to text - match USA format exactly
        doc.fontSize(28).font('OCR-B').text('FLYING', { align: 'center' });
        doc.moveDown(0.5);
      }
    } catch (error) {
      console.error('Error loading Flying J logo:', error);
      doc.fontSize(28).font('OCR-B').text('FLYING', { align: 'center' });
      doc.moveDown(0.5);
    }

    // Store info - use dynamic data from selected store or fallback to hardcoded
    const storeNumber = receipt.companyData?.storeNumber || '1001';
    const address = receipt.companyData?.address || '1637 Pettit Road';
    const cityState = receipt.companyData?.city || 'Ft.Erie, ON L2A 1A1';
    const phone = receipt.companyData?.phone || '(905) 991-1800';
    
    doc.fontSize(10).font('OCR-B').text(`STORE ${storeNumber}`, { align: 'center' });
    doc.fontSize(10).font('OCR-B').text(address, { align: 'center' });
    doc.fontSize(10).font('OCR-B').text(cityState, { align: 'center' });
    doc.fontSize(10).font('OCR-B').text(phone, { align: 'center' });
    doc.moveDown(1);
    
    
    // Date format: 10/24/2025 - match USA format exactly
    const month = String(receipt.date.getMonth() + 1).padStart(2, '0');
    const day = String(receipt.date.getDate()).padStart(2, '0');
    const year = receipt.date.getFullYear();
    doc.fontSize(10).font('OCR-B').text(`${month}/${day}/${year}`, { align: 'center' });
    doc.moveDown(0.8);

    // SALE header - match USA format exactly
    doc.fontSize(10).font('OCR-B').text('SALE', leftMargin);
    
    // Transaction number - match USA format exactly
    const transactionNum = `${Math.floor(Math.random() * 9000000) + 1000000}`;
    doc.fontSize(10).font('OCR-B').text(`Transaction #:  ${transactionNum}`, leftMargin, doc.y, { continued: true, width: 220 })
    doc.fontSize(8).font('OCR-B').text('---------------------------------------------------', leftMargin);
    
    // Column headers - match USA format exactly
    doc.fontSize(10).font('OCR-B').text('Qty Name                Price      Total', leftMargin);
    doc.fontSize(8).font('OCR-B').text('---------------------------------------------------', leftMargin);

    // Calculate subtotal
    const subtotal = receipt.items.reduce((sum, item) => {
      const isCashAdvance = item.name.toLowerCase().includes('cash advance');
      return isCashAdvance ? sum : sum + (item.quantity * item.price);
    }, 0);

    // Items section - use Petro-Canada style alignment/padding for product details
    receipt.items.forEach(item => {
      const isCashAdvance = item.name.toLowerCase().includes('cash advance');
      const qtyDisplay = item.qty || 1;
      const qtyStr = qtyDisplay.toString().padStart(2, ' ');
      const nameStr = item.name;
      const lineTotal = isCashAdvance ? 0 : (item.quantity * item.price);
      const pricePerUnit = lineTotal.toFixed(2);
      const totalStr = lineTotal.toFixed(2);

      // [QTY] [NAME..............] [PRICE] [TOTAL]
      const line =
        qtyStr.padEnd(4) +
        nameStr.padEnd(18).slice(0, 18) +
        pricePerUnit.padStart(8) +
        totalStr.padStart(11);
      doc.fontSize(10).font('OCR-B').text(line, leftMargin);

      // Fuel details: Pump / Liters / $/L underneath (same indent as Petro-Canada/Husky style)
      const pumpNumber = item.pump !== undefined && item.pump !== null ? item.pump : Math.floor(Math.random() * 20) + 1;
      const liters = item.quantity.toFixed(3);
      const pricePerLiter = item.price.toFixed(3);
      doc.fontSize(10).font('OCR-B').text(`   Pump:        ${pumpNumber}`, leftMargin + 24);
      doc.fontSize(10).font('OCR-B').text(`   Liters:      ${liters}`, leftMargin + 22);
      doc.fontSize(10).font('OCR-B').text(`   $/L:         ${pricePerLiter}`, leftMargin + 26);

      doc.moveDown(0.3);
    });

    // Separator - match USA format exactly
    doc.fontSize(8).font('OCR-B').text('---------------------------------------------------', leftMargin);
    
    // Totals - match USA format exactly
    const salesTax = 0.00;
    const total = subtotal + salesTax;

    doc.fontSize(10).font('OCR-B').text('Subtotal', leftMargin, doc.y, { continued: true, width: 247 });
    doc.font('OCR-B').text(subtotal.toFixed(2), { align: 'right', width: 247 });
    
    doc.fontSize(10).font('OCR-B').text('Sales Tax', leftMargin, doc.y, { continued: true, width: 247 });
    doc.font('OCR-B').text(salesTax.toFixed(2), { align: 'right', width: 247 });
    
    doc.fontSize(8).font('OCR-B').text('---------------------------------------------------', leftMargin);
    
    doc.fontSize(10).font('OCR-B').text('Total $', leftMargin, doc.y, { continued: true, width: 247 });
    doc.font('OCR-B').text(total.toFixed(2), { align: 'right', width: 247 });
    
    doc.fontSize(8).font('OCR-B').text('---------------------------------------------------', leftMargin);
    doc.moveDown(0.3);

    // Payment section - match USA format exactly
    if (receipt.paymentMethod === 'TCH') {
      // Add "Received" text for TCH payment
      doc.fontSize(10).font('OCR-B').text('Received', leftMargin);
      doc.fontSize(10).font('OCR-B').text(`  TCH Card`, leftMargin, doc.y, { continued: true, width: 248 });
      doc.font('OCR-B').text(total.toFixed(2), { align: 'right', width: 248 });
      
      const last4 = receipt.cardLast4 || '4551';
      const entryMethod = receipt.cardEntryMethod === 'INSERT' ? 'INSERT' : 
                          receipt.cardEntryMethod === 'TAP' ? 'TAP' : 'SWIPE';
      doc.fontSize(10).font('OCR-B').text(`  XXXXXXXXXXXXXXX${last4} ${entryMethod}`, leftMargin);
      doc.fontSize(10).font('OCR-B').text(`  Approved`, leftMargin);
      
      // Generate random authorization number (6 digits for TCH)
      const authNum = Math.floor(Math.random() * 900000) + 100000;
      doc.fontSize(10).font('OCR-B').text(`  Auth #:  ${authNum}`, leftMargin);
      doc.moveDown(1.5);
     
    } else if (receipt.paymentMethod === 'Master') {
      // Match screenshot for Canadian Flying J + Master
      const amountStr = total.toFixed(2);
      // Put 'Received' on its own line; start 'MC' on the next line with amount on the right
      doc.fontSize(10).font('OCR-B').text('Received', leftMargin);
      doc.fontSize(10).font('OCR-B').text('MC', leftMargin+10, doc.y, { continued: true, width: 238 });
      doc.font('OCR-B').text(amountStr, { align: 'right', width: 238 });
      const last4 = receipt.cardLast4 || '5703';
      const entryMethod = receipt.cardEntryMethod === 'INSERT' ? 'INSERT' : 
                          receipt.cardEntryMethod === 'TAP' ? 'TAP' : 'SWIPED';
      doc.fontSize(10).font('OCR-B').text(`XXXXXXXXXXXXXXX${last4} ${entryMethod}`, leftMargin + 10);
      doc.fontSize(10).font('OCR-B').text('Approved', leftMargin + 10);
      const auth = Math.random().toString(36).slice(2, 8).toUpperCase();
      doc.fontSize(10).font('OCR-B').text(`Auth #:    ${auth}`, leftMargin + 10);
      doc.fontSize(9).font('OCR-B').text('=========== TRANSACTION RECORD ===========', leftMargin + 10);
      doc.moveDown(1);
      // Address block
      const addr = receipt.companyData?.address || '1400 BRITANNIA RD E';
      const city = receipt.companyData?.city || 'MISSISSAUGA ON';
      doc.fontSize(10).font('OCR-B').text('Pilot Flying J', leftMargin);
      doc.fontSize(10).font('OCR-B').text(addr, leftMargin);
      doc.fontSize(10).font('OCR-B').text(city, leftMargin);
      doc.moveDown(1);
      // Type and account
      doc.fontSize(10).font('OCR-B').text('TYPE:  COMPLETION', leftMargin);
      doc.fontSize(10).font('OCR-B').text('ACCT:  MASTERCARD', leftMargin);
      doc.moveDown(0.5);
      doc.fontSize(8).font('OCR-B').text('------------', leftMargin);
      doc.fontSize(10).font('OCR-B').text(`$  ${amountStr}`, leftMargin);
      doc.fontSize(8).font('OCR-B').text('------------', leftMargin);
      doc.moveDown(1);
      // Card and vehicle details
      const vid = receipt.vehicleId || '101';
      const dl = receipt.dlNumber || 'B32565814001222';
      const comp = receipt.driverCompanyName || 'MCMP';
      doc.fontSize(10).font('OCR-B').text(`CARD NO : ************${receipt.cardLast4 || '5703'}` , leftMargin);
      doc.fontSize(10).font('OCR-B').text(`  VehicleID      ${vid}`, leftMargin);
      doc.fontSize(10).font('OCR-B').text(`  DLNumber       ${dl}`, leftMargin);
      doc.fontSize(10).font('OCR-B').text(`  CompanyName    ${comp}`, leftMargin);
      doc.fontSize(10).font('OCR-B').text('  Odometer', leftMargin);
      doc.moveDown(2);
    } else if (receipt.paymentMethod === 'Visa') {
      // Add "Received" text for Visa payment
      doc.fontSize(10).font('OCR-B').text('Received', leftMargin);
      // Visa payment section - exactly as in screenshot
      doc.fontSize(10).font('OCR-B').text('Visa', leftMargin + 10, doc.y, { continued: true, width: 238 });
      doc.fontSize(10).font('OCR-B').text(total.toFixed(2), { align: 'right', width: 238 });
      
      const last4 = receipt.cardLast4 || '3212';
      const entryMethod = receipt.cardEntryMethod === 'INSERT' ? 'INSERT' : 
                          receipt.cardEntryMethod === 'TAP' ? 'TAP' : 'SWIPE';
      doc.fontSize(10).font('OCR-B').text(`XXXXXXXXXXXXXXX${last4} ${entryMethod}`, leftMargin + 10);
      doc.fontSize(10).font('OCR-B').text('Approved', leftMargin + 10);
      
      // Generate random authorization number (5 characters for Visa)
      const authNum = 'S' + Math.floor(Math.random() * 90000) + 10000;
      doc.fontSize(10).font('OCR-B').text(`Auth #: ${authNum}`, leftMargin + 10);
      
      // Transaction record separator
      doc.fontSize(9).font('OCR-B').text('============ TRANSACTION RECORD ============', leftMargin + 10);
      doc.moveDown(1.5);

      // Pilot Flying J address - use dynamic data from selected store
      const address = receipt.companyData?.address || '4939 WEST CHESTNUT EXPRESSWAY';
      const cityState = receipt.companyData?.city || 'SPRINGFIELD, MO 65802';
      doc.fontSize(10).font('OCR-B').text('Pilot Flying J', leftMargin);
      doc.fontSize(10).font('OCR-B').text(address.toUpperCase(), leftMargin);
      // Show only the part before the comma (e.g., "Etobicoke, 0N9W" => "Etobicoke")
      const cityLine = cityState.includes(',') ? cityState.split(',')[0].trim() : cityState;
      doc.fontSize(10).font('OCR-B').text(cityLine, leftMargin);
      doc.moveDown(0.8);

      // Payment details section
      doc.fontSize(10).font('OCR-B').text('TYPE: COMPLETION', leftMargin);
      doc.fontSize(10).font('OCR-B').text('ACCT: VISA', leftMargin);
      doc.fontSize(10).font('OCR-B').text('----------', leftMargin);
      doc.fontSize(10).font('OCR-B').text(`$   ${total.toFixed(2)}`, leftMargin);
      doc.fontSize(10).font('OCR-B').text('----------', leftMargin);
      doc.moveDown(0.5);

      // Additional details section
      doc.fontSize(10).font('OCR-B').text(`CARD NO : xxxxxxxxxxxxx${last4}`, leftMargin);
      
      // Vehicle and driver details
      const vehicleId = receipt.vehicleId || 'weew3223';
      const dlNumber = receipt.dlNumber || '222aa';
      const companyName = receipt.driverCompanyName || 'Devsloop';
      
      doc.fontSize(10).font('OCR-B').text(`VehicleID             ${vehicleId}`, leftMargin);
      doc.fontSize(10).font('OCR-B').text(`DLNumber              ${dlNumber}`, leftMargin);
      doc.fontSize(10).font('OCR-B').text(`CompanyName           ${companyName}`, leftMargin);
      doc.fontSize(10).font('OCR-B').text('Odometer', leftMargin);
    }

    // TCH payment method - show "TruckingCompanyNameTCI" + user company name - match USA format exactly
    if (receipt.paymentMethod === 'TCH') {
      const userCompanyName = receipt.driverCompanyName || 'ACG';
      const truckingCompany = `TruckingCompanyNameTCI ${userCompanyName}`;
      doc.fontSize(10).font('OCR-B').text(truckingCompany, leftMargin);
      doc.moveDown(1.5);
    }

    doc.end();
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });
  }
}

export class PetroCanadaReceiptGenerator {
  async generate(receipt: Receipt, outputPath: string): Promise<void> {
    const doc = new PDFDocument({ size: [280, 800], margin: 15, autoFirstPage: false });
    const fontPath = path.join(__dirname, '../fonts/ocr_b_becker.ttf');
    doc.registerFont('OCR-B', fontPath);
    doc.addPage({ size: [280, 800], margin: 15 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const leftMargin = 15;

    // Header Section - match screenshot exactly
    console.log('Generating Petro-Canada header...');
    doc.fontSize(12).font('OCR-B').text('TRANSACTION RECORD', { align: 'center' });
    doc.moveDown(0.5);
    
    doc.fontSize(16).font('OCR-B').text('PETRO-CANADA', { align: 'center' });
    
    // Store address - match screenshot format (split into separate lines)
    const storeAddress = receipt.companyData?.address || '495 YORK RD';
    const storeCityState = receipt.companyData?.city || 'NIAGRA, ONTARIO L0S 1J0';
    const storePhone = receipt.companyData?.phone || '(905) 684-1079';
    
    // Parse city, province, and postal code
    // Format: "BRAMPTON, ONTARIO L6T5E7" or "MISSISSAUGA, ONTARIO L5T 1A6"
    let city = 'BRAMPTON';
    let province = 'ONTARIO';
    let postalCode = 'L6T5E7';
    
    if (storeCityState) {
        // Try to parse the format: "CITY, PROVINCE POSTALCODE"
        const parts = storeCityState.split(',');
        if (parts.length >= 2) {
            city = parts[0].trim().toUpperCase();
            const rest = parts[1].trim();
            // Extract province and postal code
            // Match postal code pattern: L#A#A# or L#A #A#
            const postalMatch = rest.match(/([A-Z]\d[A-Z]\s?\d[A-Z]\d)/i);
            if (postalMatch) {
                // Extract province (everything before postal code)
                const postalIndex = rest.indexOf(postalMatch[0]);
                province = rest.substring(0, postalIndex).trim().toUpperCase();
                // Remove spaces from postal code: "L6T 5E7" -> "L6T5E7"
                postalCode = postalMatch[1].trim().replace(/\s+/g, '').toUpperCase();
            } else {
                // Fallback: try to extract province and postal code separately
                const provinceMatch = rest.match(/^([A-Z\s]+)/);
                if (provinceMatch) {
                    province = provinceMatch[1].trim().toUpperCase();
                    const postalMatchFallback = rest.match(/([A-Z]\d[A-Z0-9\s]+)$/i);
                    if (postalMatchFallback) {
                        postalCode = postalMatchFallback[1].trim().replace(/\s+/g, '').toUpperCase();
                    }
                }
            }
        } else {
            // Fallback: try to extract from single string
            city = storeCityState.split(' ')[0].toUpperCase();
            const postalMatch = storeCityState.match(/([A-Z]\d[A-Z]\s?\d[A-Z]\d)/i);
            if (postalMatch) {
                postalCode = postalMatch[1].trim().replace(/\s+/g, '').toUpperCase();
            }
        }
    }
    
    // Format phone: "(905) 684-1079" -> "(905)-684-1079"
    let formattedPhone = storePhone;
    if (formattedPhone.includes(') ')) {
        formattedPhone = formattedPhone.replace(') ', ')-');
    }
    
    // Display address format as in screenshot: each on separate line, center-aligned
    doc.fontSize(10).font('OCR-B').text(storeAddress, { align: 'center' });
    doc.fontSize(10).font('OCR-B').text(city, { align: 'center' });
    doc.fontSize(10).font('OCR-B').text(province, { align: 'center' });
    doc.fontSize(10).font('OCR-B').text(postalCode, { align: 'center' });
    doc.fontSize(10).font('OCR-B').text(formattedPhone, { align: 'center' });
    doc.moveDown(1);

    // Transaction Details Section - two items per row as requested
    const now = new Date();
    const timeStr = now.toTimeString().substr(0, 8);
    const dateStr = now.toISOString().split('T')[0];
    const invoiceNum = Math.floor(Math.random() * 900000) + 100000;
    const transNum = Math.floor(Math.random() * 900000) + 100000;
    
    // Row 1: FHST and DATE
    const row1Y = doc.y;
    doc.fontSize(10).font('OCR-B').text((receipt.paymentMethod && receipt.paymentMethod.toLowerCase() === 'interac' ? 'GST:' : 'FHST:'), leftMargin, row1Y, { continued: true, width: 100 });
    doc.font('OCR-B').text('818310427', { align: 'center', width: 100 });
    doc.fontSize(10).font('OCR-B').text('DATE:', leftMargin + 120, row1Y, { continued: true, width: 100 });
    doc.font('OCR-B').text(dateStr, { align: 'center', width: 100 });
      // For Interac: TIME section alone in one line
      const row2Y = doc.y;
      doc.fontSize(10).font('OCR-B').text('TIME:', leftMargin +10, row2Y, { continued: true, width: 100 });
      doc.font('OCR-B').text(timeStr, { align: 'center', width: 100 });

      // Next line: TERMINAL and TRANS# sections
      // For Petro-Canada with Interac: swap positions (TRANS# on right, TERMINAL on left)
      const row3Y = doc.y;
      doc.fontSize(10).font('OCR-B').text('TRANS#:', leftMargin + 120, row3Y, { continued: true, width: 100 });
      doc.font('OCR-B').text(transNum.toString(), { align: 'center', width: 100 });
      doc.fontSize(10).font('OCR-B').text('TERMINAL:', leftMargin, row3Y, { continued: true, width: 120 });
      doc.font('OCR-B').text('*****3301', { align: 'center', width: 100 });
    
    // Row 4: INVOICE NO (on new line, label and value on same line)
    const row4Y = doc.y;
    doc.fontSize(10).font('OCR-B').text(`INVOICE NO: ${invoiceNum.toString()}`, leftMargin, row4Y);
    
    // Move to next section
    doc.y = row4Y + 15;
    
    doc.moveDown(1);

    // Calculate totals
    const subtotal = receipt.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    // Headers section - PRODUCT QTY PRICE AMOUNT (Husky style)
    let headerLine;
    if ((receipt.paymentMethod || '').toLowerCase() === 'master' || (receipt.paymentMethod || '').toLowerCase() === 'interac') {
      // For Master payment method, use (L), ($/L), ($)
      headerLine = 'FUEL                (L)   ' + '($/L)   ' + '($)';
    } else {
      // For others, default Husky style
      headerLine = 'PRODUCT'.padEnd(20) + 'QTY'.padEnd(5) + 'PRICE'.padEnd(7) + 'AMOUNT';
    }
    doc.fontSize(10).font('OCR-B').text(headerLine, leftMargin);

    // Items section - Petro-Canada items only (Husky style)
    receipt.items.forEach(item => {
      // Calculate totals for all items
      const total = item.quantity * item.price;
      
      // Display item in Husky-style format with proper alignment
      const qtyDisplay = item.qty || 1;
      const qtyStr = qtyDisplay.toString();
      
      // For Interac and Master payment methods, skip this section
      if (
        (receipt.paymentMethod || '').toLowerCase() !== 'master' &&
        (receipt.paymentMethod || '').toLowerCase() !== 'interac'
      ) {
        const itemLine = item.name.padEnd(20) + qtyStr.padEnd(5) + total.toFixed(2).padEnd(7) + total.toFixed(2);
        doc.fontSize(10).font('OCR-B').text(itemLine, leftMargin);
      }
      
      // Fuel details - use Canadian units (Liters instead of Gallons)
      const pumpNumber = item.pump !== undefined && item.pump !== null ? item.pump : 18;
      const liters = item.quantity.toFixed(3);  // quantity is liters
      const pricePerLiter = item.price.toFixed(3);  // price is price per liter
      
      // Align the values by using consistent padding
      if ((receipt.paymentMethod || '').toLowerCase() === 'master' || (receipt.paymentMethod || '').toLowerCase() === 'interac') {
        doc.fontSize(10).font('OCR-B').text(`Pump ${pumpNumber}`);
        const itemLine = item.name.padEnd(20) + qtyStr.padEnd(5) + item.price.toFixed(2).padEnd(7) + total.toFixed(2);
        doc.fontSize(10).font('OCR-B').text(itemLine, leftMargin);
      } else {
        doc.fontSize(10).font('OCR-B').text(` Pump:   ${pumpNumber}`, leftMargin + 16);
        doc.fontSize(10).font('OCR-B').text(` Liters: ${liters}`, leftMargin + 16);
        doc.fontSize(10).font('OCR-B').text(` $/L:    ${pricePerLiter}`, leftMargin + 16);
      }
      
      doc.moveDown(1);
    });

    // Totals Section - match screenshot exactly (using same approach as headers)
    const totalLine = 'TOTAL'.padEnd(15) + 'CAD $'.padEnd(12) + subtotal.toFixed(2);
    doc.fontSize(12).font('OCR-B').text(totalLine, leftMargin);
    
    doc.moveDown(0.3);
    
    // Payment method specific totals
    const paymentMethod = receipt.paymentMethod || 'Visa';
    if (paymentMethod === 'Visa') {
      const visaLine = 'VISA SALE'.padStart(30) + subtotal.toFixed(2).padStart(8);
      doc.fontSize(10).font('OCR-B').text(visaLine, leftMargin);
    } else if (paymentMethod === 'Master') {
      // Match screenshot: "MASTERCARD SALE 1195.95"
      doc.fontSize(10).font('OCR-B').text(`MASTERCARD SALE ${subtotal.toFixed(2)}`, { align: 'right', width: 248 });
      
      // Show taxes section for Master
      doc.moveDown(0.3);
      doc.fontSize(10).font('OCR-B').text('Taxes are included in the price of Fuel', leftMargin);
      doc.fontSize(10).font('OCR-B').text('Tax paid by Customer:', leftMargin);
      
      // Calculate FHST and PHST (example calculations - adjust as needed)
      const fhstAmount = subtotal * 0.0442; // Approximate FHST rate
      const phstAmount = subtotal * 0.0708; // Approximate PHST rate
      doc.fontSize(10).font('OCR-B').text(`* FHST INCLUDED IN FUEL $ ${fhstAmount.toFixed(2)}`, leftMargin);
      doc.fontSize(10).font('OCR-B').text(`* PHST INCLUDED IN FUEL $ ${phstAmount.toFixed(2)}`, leftMargin);
    } else if (paymentMethod === 'Interac') {
      const couponLine = 'Gasoline Coupons'.padStart(25) + '10.00'.padStart(13);
      doc.fontSize(10).font('OCR-B').text(couponLine, leftMargin);
      const interacLine = 'INTERAC SALE'.padStart(30) + subtotal.toFixed(2).padStart(8);
      doc.fontSize(10).font('OCR-B').text(interacLine, leftMargin);
      
      // Show taxes section for Interac - match screenshot format
      doc.moveDown(0.3);
      doc.fontSize(10).font('OCR-B').text('Taxes are included in the price of Fuel', leftMargin);
      doc.fontSize(10).font('OCR-B').text('Tax paid by Customer:', leftMargin);
      
      // Calculate GST and PST (example calculations - adjust as needed)
      const gstAmount = subtotal * 0.05; // GST rate (5%)
      const pstAmount = subtotal * 0.08; // PST rate (8%) - adjust based on province
      doc.fontSize(10).font('OCR-B').text(`* GST INCLUDED IN FUEL $ ${gstAmount.toFixed(2)}`, leftMargin);
      doc.fontSize(10).font('OCR-B').text(`* PST INCLUDED IN FUEL $ ${pstAmount.toFixed(2)}`, leftMargin);
      doc.moveDown(0.8);
    }
    
    doc.moveDown(0.3);

      const purchaseLine = 'PURCHASE'.padEnd(25);
      doc.fontSize(12).font('OCR-B').text(purchaseLine, leftMargin);
      doc.fontSize(12).font('OCR-B').text('$ ' + subtotal.toFixed(2), { align: 'right', width: 248 });

    // Payment Details Section - match screenshot exactly
    const last4 = receipt.cardLast4 || '9211';
    
    if (paymentMethod === 'Master') {
      // Master payment format - match screenshot exactly
      doc.fontSize(10).font('OCR-B').text(
        'MASTERCARD',
        leftMargin, doc.y,
        { continued: true, width: 248 }
      );
      doc.font('OCR-B').text(`************${last4}`, 80);
      
      // REFERENCE # with " C" suffix
      doc.fontSize(10).font('OCR-B').text('REFERENCE #:', leftMargin, doc.y, { continued: true, width: 248 });
      const refNum = Math.floor(Math.random() * 9000000000) + 1000000000;
      doc.font('OCR-B').text(`${refNum} C`, { align: 'center', width: 248 });
      
      // AUTH # alphanumeric (6 chars, e.g., 05388Z)
      doc.fontSize(10).font('OCR-B').text('AUTH #:', leftMargin, doc.y, { continued: true, width: 248 });
      const authDigits = Math.floor(Math.random() * 90000) + 10000; // 5 digits
      const authLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // Random letter A-Z
      const authCode = `${authDigits.toString().padStart(5, '0')}${authLetter}`;
      doc.font('OCR-B').text(authCode, { align: 'center', width: 248 });
      
      doc.moveDown(0.5);
      
      // Brand and details
      doc.fontSize(10).font('OCR-B').text('Mastercard', leftMargin);
      // Randomize AID, TVR, and TSI numbers
      const aid = 'A' + Array.from({ length: 13 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
      const tvr = Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
      const tsi = Array.from({ length: 4 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
      doc.fontSize(10).font('OCR-B').text(aid, leftMargin);
      doc.fontSize(10).font('OCR-B').text(`TVR: ${tvr}`, leftMargin);
      doc.fontSize(10).font('OCR-B').text(`TSI: ${tsi}`, leftMargin);
      
      doc.moveDown(0.5);
      doc.fontSize(10).font('OCR-B').text('01/027 APPROVED - THANK YOU', leftMargin);
    } else if (paymentMethod === 'Interac') {
      // INTERAC payment method line - match screenshot format
      doc.fontSize(10).font('OCR-B').text(
        'INTERAC',
        leftMargin, doc.y,
        { continued: true, width: 190 }
      );
      doc.font('OCR-B').text(`************${last4}`, { align: 'right', width: 190 });
      doc.moveDown(0.3);
      
      // INTERAC specific layout per screenshot
      doc.fontSize(10).font('OCR-B').text('ACCT:', leftMargin, doc.y, { continued: true, width: 190 });
      doc.font('OCR-B').text('CHEQUING', { align: 'right', width: 190 });
      
      // Reference number with trailing ' C'
      doc.fontSize(10).font('OCR-B').text('REFERENCE #:', leftMargin, doc.y, { continued: true, width: 190 });
      const refNumInterac = Math.floor(Math.random() * 9000000000) + 1000000000;
      doc.font('OCR-B').text(`${refNumInterac} C`, { align: 'right', width: 190 });
      
      // AUTH # alphanumeric (6 chars)
      doc.fontSize(10).font('OCR-B').text('AUTH #:', leftMargin, doc.y, { continued: true, width: 190 });
      const authAlpha = Math.random().toString(36).slice(2, 8).toUpperCase();
      doc.font('OCR-B').text(authAlpha, { align: 'right', width: 190 });
      
      doc.moveDown(0.5);
      // Brand and kernel details
      doc.fontSize(10).font('OCR-B').text('Interac', leftMargin);
      // Generate random AID-like string: 'A' + 13 uppercase hex chars
      const interacAid = 'A' + Array.from({ length: 13 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
      // Generate TVR: 10 uppercase hex chars
      const tvr = Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
      // Generate TSI: 4 uppercase hex chars
      const tsi = Array.from({ length: 4 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
      doc.fontSize(10).font('OCR-B').text(interacAid, leftMargin);
      doc.fontSize(10).font('OCR-B').text(`TVR: ${tvr}`, leftMargin);
      doc.fontSize(10).font('OCR-B').text(`TSI: ${tsi}`, leftMargin);
      
      doc.moveDown(0.5);
      doc.fontSize(10).font('OCR-B').text('00/001 APPROVED - THANK YOU', leftMargin);
      // No signature line for Interac per screenshot
    } else {
      // Visa/Master default layout
      doc.fontSize(10).font('OCR-B').text(
        'VISA',
        leftMargin, doc.y,
        { continued: true, width: 248 }
      );
      doc.font('OCR-B').text(`************${last4}`, { align: 'right', width: 248 });
      doc.fontSize(10).font('OCR-B').text('REFERENCE #:', leftMargin, doc.y, { continued: true, width: 248 });
      const refNum = Math.floor(Math.random() * 9000000000) + 1000000000;
      doc.font('OCR-B').text(`${refNum} H`, { align: 'right', width: 248 });
      
      doc.fontSize(10).font('OCR-B').text('AUTH #:', leftMargin, doc.y, { continued: true, width: 248 });
      const authNum = Math.floor(Math.random() * 900000) + 100000;
      doc.font('OCR-B').text(`${authNum.toString(16).toUpperCase()}`, { align: 'right', width: 248 });
      
      doc.moveDown(0.5);
      // Approval and Credit Information - match screenshot exactly
      if (paymentMethod === 'Visa') {
        doc.fontSize(10).font('OCR-B').text('Visa CREDIT', leftMargin);
        doc.fontSize(10).font('OCR-B').text('A0000000031010', leftMargin);
      } else if (paymentMethod === 'Master') {
        doc.fontSize(10).font('OCR-B').text('Mastercard', leftMargin);
        doc.fontSize(10).font('OCR-B').text('A0000000041010', leftMargin);
      }
      
      doc.moveDown(0.5);
      doc.fontSize(10).font('OCR-B').text('01/027 APPROVED - THANK YOU', leftMargin);
      doc.moveDown(0.5);
      doc.fontSize(10).font('OCR-B').text('NO SIGNATURE TRANSACTION', { align: 'center' });
    }
    doc.moveDown(1);
    
    // Bottom section varies by payment method (screenshot-specific for Interac)
    if (paymentMethod === 'Interac') {
      // Interac-specific bottom section per screenshot
      doc.fontSize(15).font('OCR-B').text('FINAL SALE', { align: 'center' });
      doc.fontSize(15).font('OCR-B').text('NO REFUND', { align: 'center' });
      doc.fontSize(15).font('OCR-B').text('NO RETURNS', { align: 'center' });
      
      doc.moveDown(0.8);
      doc.fontSize(10).font('OCR-B').text('Earn, redeem, repeat', { align: 'center' });
      
      doc.moveDown(0.8);
      doc.fontSize(10).font('OCR-B').text('-- IMPORTANT --', { align: 'center' });
      doc.fontSize(9).font('OCR-B').text('Retain This Copy For Your Records', { align: 'center' });
      
      doc.moveDown(2);
      doc.fontSize(10).font('OCR-B').text("--- Customer's Copy ---", { align: 'center' });
    } else {
      // Promotional/Feedback Section - match screenshot
      doc.fontSize(15).font('OCR-B').text('Give us your feedback.', { align: 'center' });
      doc.fontSize(15).font('OCR-B').text('Chance to WIN', { align: 'center' });
      doc.fontSize(15).font('OCR-B').text('FREE gas for a year!', { align: 'center' });
      doc.fontSize(15).font('OCR-B').text('Petro-Canada.ca/hero', { align: 'center' });
      
      doc.moveDown(1);
      
      // Petro-Points Section - match screenshot
      doc.fontSize(10).font('OCR-B').text('*** PETRO-POINTS ***', { align: 'center' });
      doc.moveDown(0.3);
      
      doc.fontSize(9).font('OCR-B').text('You could have earned Petro-Points and CT Money on today\'s purchase. Sign up and link at petro-points.ca/triangle', leftMargin);
      doc.fontSize(9).font('OCR-B').text('petro-points.ca/triangle', leftMargin);
      
      doc.moveDown(1);
      
      // Footer - match screenshot
      doc.fontSize(10).font('OCR-B').text('Earn, redeem, repeat', { align: 'center' });
      doc.fontSize(10).font('OCR-B').text('-- IMPORTANT --', { align: 'center' });
      doc.fontSize(9).font('OCR-B').text('Retain This Copy For Your Records', { align: 'center' });
    }

    doc.end();
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });
  }
}

// BVD Petroleum Receipt Generator
export class BVDPetroleumReceiptGenerator {
  async generate(receipt: Receipt, outputPath: string): Promise<void> {
    const doc = new PDFDocument({ size: [280, 800], margin: 15, autoFirstPage: false });
    const fontPath = path.join(__dirname, '../fonts/ocr_b_becker.ttf');
    doc.registerFont('OCR-B', fontPath);
    doc.addPage({ size: [280, 800], margin: 15 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const leftMargin = 15;
    const pageWidth = 280;
    const centerX = pageWidth / 2;

    // Load and display BVD logo at the top (same approach as Flying J USA)
    try {
      const logoPath = path.resolve(process.cwd(), 'assets/logos/bvd-logo.jpeg');
      
      if (fs.existsSync(logoPath)) {
        const logoWidth = 150;
        const logoHeight = 80;
        const logoX = (doc.page.width - logoWidth) / 2;
        const currentY = doc.y;
        
        doc.image(logoPath, logoX, currentY, {
          width: logoWidth,
          height: logoHeight,
          align: 'center'
        });
        
        doc.y = currentY + logoHeight;
      } else {
        // Fallback to text
        doc.fontSize(10).font('OCR-B').text('BVD PETROLEUM', { align: 'center' });
        doc.moveDown(0.5);
      }
    } catch (error) {
      console.error('Error loading BVD logo:', error);
      doc.fontSize(10).font('OCR-B').text('BVD PETROLEUM', { align: 'center' });
      doc.moveDown(0.5);
    }

    // Add "BVD PETROLEUM" text below the logo in one line
    doc.fontSize(10).font('OCR-B').text('BVD PETROLEUM', { align: 'center' });
    doc.moveDown(1);
    
    // Address - match screenshot format: Street, City/Province, Postal Code
    const storeAddress = receipt.companyData?.address || '495 York Road';
    const storeCityState = receipt.companyData?.city || 'Niagara, ON L0S 1J0';
    
    // Parse address format: "Niagara, ON L0S 1J0" -> "Niagara, ON" and "L0S 1J0"
    let cityProvince = 'Niagara, ON';
    let postalCode = 'L0S 1J0';
    
    if (storeCityState) {
      // Try to extract postal code (format: L0S 1J0 or similar)
      const postalMatch = storeCityState.match(/\b([A-Z0-9]\d[A-Z0-9]\s?\d[A-Z0-9]\d)\b/i);
      if (postalMatch) {
        postalCode = postalMatch[1].toUpperCase();
        // Remove postal code from cityState to get city and province
        const cityProvincePart = storeCityState.replace(postalMatch[0], '').trim();
        if (cityProvincePart) {
          cityProvince = cityProvincePart;
        }
      } else {
        // Fallback: split by comma
        const addressParts = storeCityState.split(', ');
        if (addressParts.length >= 2) {
          const city = addressParts[0] || 'Niagara';
          const rest = addressParts[1] || 'ON L0S 1J0';
          // Extract province and postal code
          const parts = rest.split(' ');
          if (parts.length >= 2) {
            cityProvince = `${city}, ${parts[0]}`;
            postalCode = parts.slice(1).join(' ');
          } else {
            cityProvince = `${city}, ${rest}`;
          }
        } else {
          cityProvince = storeCityState;
        }
      }
    }
    
    doc.fontSize(10).font('OCR-B').text(storeAddress, { align: 'center' });
    doc.fontSize(10).font('OCR-B').text(cityProvince, { align: 'center' });
    doc.fontSize(10).font('OCR-B').text(postalCode, { align: 'center' });
    doc.moveDown(1);

    // Transaction Details Section - using Petro-Canada approach
    const pumpNumber = receipt.items[0]?.pump || Math.floor(Math.random() * 15) + 1;
    const fuelType = receipt.items[0]?.name || 'Diesel';
    const volume = receipt.items[0]?.quantity || 11.000;
    const unitPrice = receipt.items[0]?.price || 11.000;
    const total = volume * unitPrice;

    // Transaction Details - match screenshot two format
    // Generate random pump number between 1-15 for BVD Petroleum
    const randomPumpNumber = Math.floor(Math.random() * 15) + 1;
    const pumpLine = `Pump:`.padEnd(31) + `${randomPumpNumber}`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(pumpLine, leftMargin);
    doc.moveDown(0.3);

    const fuelLine = `Fuel:`.padEnd(31) + `${fuelType}`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(fuelLine, leftMargin);
    doc.moveDown(0.3);

    const volumeLine = `Volume:`.padEnd(31) + `${volume.toFixed(3)}L`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(volumeLine, leftMargin);
    doc.moveDown(0.3);

    const unitPriceLine = `UnitPrice:`.padEnd(31) + `$${unitPrice.toFixed(3)}/L`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(unitPriceLine, leftMargin);
    doc.moveDown(0.3);

    const totalLine = `Total:`.padEnd(31) + `$${total.toFixed(2)}`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(totalLine, leftMargin);
    doc.moveDown(1);

    // Taxes Section - match screenshot two format
    const taxesIncludedLine = `Taxes Included`.padEnd(25);
    doc.fontSize(10).font('OCR-B').text(taxesIncludedLine, leftMargin);
    doc.moveDown(0.3);
    
    const hstRate = 1.13;
    const withoutHstAmount = total / hstRate;
    const hstAmount = total - withoutHstAmount;
    const hstLine = `HST(13%):`.padEnd(31) + `$${hstAmount.toFixed(2)}`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(hstLine, leftMargin);
    doc.moveDown(1);

    // Pre-Authorization Completion Section - match screenshot two format
    const preAuthCompletionLine = `Pre-Auth Completion`.padEnd(25);
    doc.fontSize(10).font('OCR-B').text(preAuthCompletionLine, leftMargin);
    doc.moveDown(0.3);
    
    const approvedLine = `APPROVED`.padEnd(25);
    doc.fontSize(10).font('OCR-B').text(approvedLine, leftMargin);
    doc.moveDown(0.3);
    
    // Dashed line
    const dashedLine = `----------`;
    doc.fontSize(10).font('OCR-B').text(dashedLine, { align: 'right' });
    const totalAmountLine = `$${total.toFixed(2)}`.padStart(43);
    doc.fontSize(10).font('OCR-B').text(totalAmountLine, { align: 'right' });
    doc.fontSize(10).font('OCR-B').text(dashedLine, { align: 'right' });

    // Payment Details Section - using single-line approach with padEnd/padStart
    // Show "C" on the same line as "MasterCard", right-aligned
    // "C" should be right-aligned, "MasterCard" left side
    // Display 'MasterCard' on the left, 'C' on the far right, just like Card# and cardNumber format below
    const masterCardLeft = 'MasterCard';
    const cRight = 'C';
    // The width for this line should match the example for Card#: 43 chars, so pad end left and pad start right
    const cardTypeLine = masterCardLeft.padEnd(30) + cRight.padStart(10);
    doc.fontSize(10).font('OCR-B').text(cardTypeLine, leftMargin);
    doc.moveDown(0.3);

    // Card Number - show label and number on same line
    const last4 = receipt.cardLast4 || '3948';
    const cardNumber = `***********${last4}`;
    const cardLine = `Card#:`.padEnd(26) + cardNumber;
    doc.fontSize(10).font('OCR-B').text(cardLine, leftMargin);
    doc.moveDown(0.3);

    const aidLine = `A0000000041010`.padEnd(31);
    doc.fontSize(10).font('OCR-B').text(aidLine, leftMargin);
    doc.moveDown(0.3);
    
    const mastercardLine = `Mastercard`.padEnd(31);
    doc.fontSize(10).font('OCR-B').text(mastercardLine, leftMargin);
    doc.moveDown(0.3);

    // Auth details - using single-line approach with random values
    const authNum = Math.floor(Math.random() * 900000) + 100000;
    const authLine = `Auth#:`.padEnd(31) + `${authNum}`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(authLine, leftMargin);
    doc.moveDown(0.3);

    const isoValue = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const isoLine = `ISO:`.padEnd(31) + `${isoValue}`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(isoLine, leftMargin);
    doc.moveDown(0.3);

    const aciValue = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const aciLine = `ACI:`.padEnd(31) + `${aciValue}`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(aciLine, leftMargin);
    doc.moveDown(0.3);

    const turValue = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    const turLine = `TUR:`.padEnd(31) + `${turValue}`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(turLine, leftMargin);
    doc.moveDown(0.3);

    const tsiValue = Math.floor(Math.random() * 10000).toString(16).toUpperCase().padStart(4, '0');
    const tsiLine = `TSI:`.padEnd(31) + `${tsiValue}`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(tsiLine, leftMargin);
    doc.moveDown(0.3);

    const cumValue = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const cumLine = `CUM:`.padEnd(31) + `${cumValue}`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(cumLine, leftMargin);
    doc.moveDown(0.3);

    const seqValue = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
    const seqLine = `Seq#:`.padEnd(29) + `${seqValue}`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(seqLine, leftMargin);
    doc.moveDown(0.3);

    doc.fontSize(10).font('OCR-B').text('VERIFIED BY PIN', leftMargin);
    doc.moveDown(1);

    // Date, Time, and Transaction Number Section - using single-line approach
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString().substr(-2);
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    const dateLine = `Date:`.padEnd(31) + `${day}/${month}/${year}`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(dateLine, leftMargin);
    doc.moveDown(0.3);

    const timeLine = `Time:`.padEnd(31) + `${hours}:${minutes}:${seconds}`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(timeLine, leftMargin);
    doc.moveDown(0.3);

    const transNum = Math.floor(Math.random() * 90000) + 10000;
    const transLine = `Trans#:`.padEnd(31) + `${transNum}`.padStart(10);
    doc.fontSize(10).font('OCR-B').text(transLine, leftMargin);
    doc.moveDown(1);

    // Footer Section
    doc.fontSize(10).font('OCR-B').text('Customer Copy', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('OCR-B').text('Thank You S.U.P', { align: 'center' });

    doc.end();
    await new Promise<void>((resolve) => writeStream.on('finish', () => resolve()));
  }
}

// Factory function to get the appropriate generator
export function getUSACompanyReceiptGenerator(companyName: string): any {
  const name = companyName.toLowerCase();
  
  if (name.includes('one 9') || name.includes('one9')) {
    return new ONE9FuelReceiptGenerator();
  } else if (name.includes('pilot')) {
    return new PilotTravelCentersReceiptGenerator();
  } else if (name.includes('flying j')) {
    return new FlyingJTravelPlazaReceiptGenerator();
  } else if (name.includes('love')) {
    return new LovesTravelStopsReceiptGenerator();
  } else if (name.includes('travelcenters') || name.includes('travel centers')) {
    return new TravelCentersOfAmericaReceiptGenerator();
  }
  
  return null;
}
