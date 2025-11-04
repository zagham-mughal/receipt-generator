import PDFDocument from 'pdfkit';
import fs from 'fs';
import { Receipt, ReceiptItem } from './types';
import { ReceiptDesign, drawSeparator, drawBarcode } from './designs';

export class ReceiptGenerator {
  private readonly storeName = 'YOUR BRAND NAME';
  private readonly storeAddress = '123 Main Street';
  private readonly storeCity = 'City, State 12345';
  private readonly storePhone = '(555) 123-4567';
  private readonly storeNumber = 'Store #4521';
  private readonly cashierName = 'Cashier: Sarah M.';
  private design: ReceiptDesign;

  constructor(design: ReceiptDesign) {
    this.design = design;
  }

  async generate(receipt: Receipt, outputPath: string): Promise<void> {
    const doc = new PDFDocument({ 
      size: [this.design.width, 750], 
      margin: 15 
    });

    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    this.generateReceipt(doc, receipt);

    doc.end();

    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });
  }

  private generateReceipt(doc: PDFKit.PDFDocument, receipt: Receipt): void {
    // Header
    this.addHeader(doc);
    
    // Store info
    this.addStoreInfo(doc);
    
    drawSeparator(doc, this.design.separatorStyle, doc.y, this.design.width);
    doc.moveDown(0.5);

    // Receipt details
    this.addReceiptDetails(doc, receipt);
    
    drawSeparator(doc, this.design.separatorStyle, doc.y, this.design.width);
    doc.moveDown(0.5);

    // Items
    this.addItems(doc, receipt.items);
    
    doc.moveDown(0.3);
    drawSeparator(doc, this.design.separatorStyle, doc.y, this.design.width);
    doc.moveDown(0.5);

    // Totals
    this.addTotals(doc, receipt.items);
    
    drawSeparator(doc, this.design.separatorStyle, doc.y, this.design.width);
    doc.moveDown(0.5);

    // Payment info
    if (this.design.showElements.paymentDetails) {
      this.addPaymentInfo(doc);
      doc.moveDown(0.3);
    }

    // Barcode
    if (this.design.showElements.barcode) {
      drawBarcode(doc, receipt.receiptNumber.replace(/-/g, ''), 0, doc.y, this.design.width);
      doc.moveDown(3);
    }

    // Footer
    this.addFooter(doc);
    
    // Design label
    doc.moveDown(0.5);
    doc.fontSize(6).font('Helvetica-Oblique').text(`Receipt Type: ${this.design.name}`, { align: 'center' });
  }

  private addHeader(doc: PDFKit.PDFDocument): void {
    switch (this.design.headerStyle) {
      case 'centered':
        doc.fontSize(this.design.fontSize.store)
           .font('Helvetica-Bold')
           .text(this.storeName.toUpperCase(), { align: 'center' });
        break;
      
      case 'logo-top':
        doc.fontSize(this.design.fontSize.store + 2)
           .font('Helvetica-Bold')
           .text(`★ ${this.storeName} ★`, { align: 'center' });
        break;
      
      case 'left':
        doc.fontSize(this.design.fontSize.store)
           .font('Helvetica-Bold')
           .text(this.storeName.toUpperCase(), 15);
        break;
      
      case 'split':
        doc.fontSize(this.design.fontSize.store)
           .font('Helvetica-Bold')
           .text(this.storeName, 15);
        if (this.design.showElements.storeNumber) {
          doc.fontSize(8).font('Helvetica').text(this.storeNumber, 15, doc.y - 12, { align: 'right' });
        }
        break;
    }
    doc.moveDown(0.3);
  }

  private addStoreInfo(doc: PDFKit.PDFDocument): void {
    const align = this.design.headerStyle === 'left' ? 'left' : 'center';
    
    doc.fontSize(this.design.fontSize.small)
       .font('Helvetica')
       .text(this.storeAddress, { align });
    
    doc.text(this.storeCity, { align });
    doc.text(`Tel: ${this.storePhone}`, { align });
    
    if (this.design.showElements.storeNumber && this.design.headerStyle !== 'split') {
      doc.text(this.storeNumber, { align });
    }
    
    doc.moveDown(0.3);
  }

  private addReceiptDetails(doc: PDFKit.PDFDocument, receipt: Receipt): void {
    doc.fontSize(this.design.fontSize.header).font('Helvetica-Bold');
    doc.text(`RECEIPT #${receipt.receiptNumber}`, 15);
    
    doc.fontSize(this.design.fontSize.body).font('Helvetica');
    doc.text(`Date: ${receipt.date.toLocaleDateString()}  ${receipt.date.toLocaleTimeString()}`, 15);
    doc.text(`Customer: ${receipt.companyName}`, 15);
    
    if (this.design.showElements.cashier) {
      doc.text(this.cashierName, 15);
    }
    
    doc.moveDown(0.3);
  }

  private addItems(doc: PDFKit.PDFDocument, items: ReceiptItem[]): void {
    switch (this.design.itemLayout) {
      case 'compact':
        this.addItemsCompact(doc, items);
        break;
      case 'spacious':
        this.addItemsSpaciou(doc, items);
        break;
      case 'table':
        this.addItemsTable(doc, items);
        break;
      case 'description':
        this.addItemsDescription(doc, items);
        break;
    }
  }

  private addItemsCompact(doc: PDFKit.PDFDocument, items: ReceiptItem[]): void {
    doc.fontSize(this.design.fontSize.body).font('Helvetica');
    
    items.forEach(item => {
      const total = item.quantity * item.price;
      const itemName = item.name.length > 20 ? item.name.substring(0, 20) : item.name;
      doc.text(`${itemName}`, 15, doc.y, { continued: true, width: 120 });
      doc.text(`${item.quantity}x`, { continued: true, width: 30 });
      doc.text(`$${total.toFixed(2)}`, { align: 'right', width: 50 });
      doc.moveDown(0.3);
    });
  }

  private addItemsSpaciou(doc: PDFKit.PDFDocument, items: ReceiptItem[]): void {
    doc.fontSize(this.design.fontSize.body).font('Helvetica');
    
    items.forEach(item => {
      const total = item.quantity * item.price;
      doc.font('Helvetica-Bold').text(`${item.quantity}x ${item.name}`, 15);
      doc.font('Helvetica').text(`$${total.toFixed(2)}`, { align: 'right' });
      doc.moveDown(0.4);
    });
  }

  private addItemsTable(doc: PDFKit.PDFDocument, items: ReceiptItem[]): void {
    // Header
    doc.fontSize(this.design.fontSize.small).font('Helvetica-Bold');
    doc.text('ITEM', 15, doc.y, { continued: true, width: 90 });
    doc.text('QTY', { continued: true, width: 30 });
    doc.text('PRICE', { continued: true, width: 40 });
    doc.text('TOTAL', { align: 'right', width: 40 });
    doc.moveDown(0.3);
    
    // Items
    doc.font('Helvetica').fontSize(this.design.fontSize.body);
    items.forEach(item => {
      const total = item.quantity * item.price;
      const y = doc.y;
      doc.text(item.name.substring(0, 15), 15, y, { width: 90 });
      doc.text(item.quantity.toString(), 105, y, { width: 30 });
      doc.text(`$${item.price.toFixed(2)}`, 135, y, { width: 40 });
      doc.text(`$${total.toFixed(2)}`, 175, y, { align: 'right', width: 40 });
      doc.moveDown(0.5);
    });
  }

  private addItemsDescription(doc: PDFKit.PDFDocument, items: ReceiptItem[]): void {
    doc.fontSize(this.design.fontSize.body).font('Helvetica');
    
    items.forEach((item, index) => {
      const total = item.quantity * item.price;
      doc.font('Helvetica-Bold').text(`${index + 1}. ${item.name}`, 15);
      doc.font('Helvetica').text(`   Qty: ${item.quantity} x $${item.price.toFixed(2)} = $${total.toFixed(2)}`, 15);
      doc.moveDown(0.4);
    });
  }

  private addTotals(doc: PDFKit.PDFDocument, items: ReceiptItem[]): void {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    doc.fontSize(this.design.fontSize.body).font('Helvetica');
    
    // Subtotal
    doc.text('Subtotal:', 15, doc.y, { continued: true });
    doc.text(`$${subtotal.toFixed(2)}`, { align: 'right' });
    
    // Tax
    doc.text('Tax (8%):', 15, doc.y, { continued: true });
    doc.text(`$${tax.toFixed(2)}`, { align: 'right' });
    
    doc.moveDown(0.3);
    
    // Total
    doc.fontSize(this.design.fontSize.header).font('Helvetica-Bold');
    doc.text('TOTAL:', 15, doc.y, { continued: true });
    doc.text(`$${total.toFixed(2)}`, { align: 'right' });
    
    doc.moveDown(0.5);
  }

  private addPaymentInfo(doc: PDFKit.PDFDocument): void {
    doc.fontSize(this.design.fontSize.body).font('Helvetica');
    doc.text('PAYMENT METHOD: VISA ****1234', { align: 'center' });
    doc.text('AUTH CODE: 123456', { align: 'center' });
    doc.text('TRANSACTION ID: TXN-' + Date.now().toString().slice(-8), { align: 'center' });
    doc.moveDown(0.3);
  }

  private addFooter(doc: PDFKit.PDFDocument): void {
    doc.fontSize(this.design.fontSize.small).font('Helvetica');
    
    switch (this.design.businessType) {
      case 'Supermarket':
        doc.text('THANK YOU FOR SHOPPING WITH US!', { align: 'center' });
        doc.text('SAVE YOUR RECEIPT FOR RETURNS', { align: 'center' });
        doc.text('Return Policy: 30 Days with Receipt', { align: 'center' });
        break;
      
      case 'Cafe':
        doc.text('Thank you for visiting!', { align: 'center' });
        doc.text('Have a great day!', { align: 'center' });
        doc.text('www.yourcafe.com', { align: 'center' });
        break;
      
      case 'Fuel':
        doc.text('DRIVE SAFELY!', { align: 'center' });
        doc.text('Thank you for your business', { align: 'center' });
        break;
      
      case 'Medical':
        doc.text('Take care of your health', { align: 'center' });
        doc.text('Questions? Call: ' + this.storePhone, { align: 'center' });
        break;
      
      case 'Restaurant':
        doc.text('Come back soon!', { align: 'center' });
        doc.text('Rate us on Google!', { align: 'center' });
        break;
      
      default:
        doc.text('Thank you for your purchase!', { align: 'center' });
        doc.text('Please come again', { align: 'center' });
    }
  }
}
