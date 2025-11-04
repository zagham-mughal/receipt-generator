import fs from 'fs';
import path from 'path';
import { ReceiptGenerator } from './receiptGenerator';
import { CSVReader } from './csvReader';
import { Receipt, ReceiptItem } from './types';
import { getDesignForCompany, DESIGNS } from './designs';

// Dummy receipt items - realistic product examples
const SAMPLE_ITEMS: ReceiptItem[] = [
  { name: 'Professional Services', quantity: 1, price: 500.00 },
  { name: 'Consulting Hours', quantity: 5, price: 150.00 },
  { name: 'Software License', quantity: 1, price: 299.99 }
];

async function main() {
  console.log('🧾 Multi-Design Receipt Generator\n');
  console.log('✨ 10 Unique Receipt Designs with Dummy Data\n');

  // Create receipts directory if it doesn't exist
  const receiptsDir = path.join(__dirname, '../receipts');
  if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
  }

  // Read companies from CSV
  const csvReader = new CSVReader();
  const csvPath = path.join(__dirname, '../companies.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ companies.csv not found!');
    console.log('Please create a CSV file with columns: name, address, email');
    return;
  }

  const companies = await csvReader.readCompanies(csvPath);
  console.log(`📋 Found ${companies.length} companies`);
  console.log(`🎨 Available designs: ${DESIGNS.length} unique styles\n`);
  console.log('Generating receipts...\n');

  // Generate receipts for each company with different designs
  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const design = getDesignForCompany(i);
    
    // Create generator with specific design
    const generator = new ReceiptGenerator(design);
    
    const receipt: Receipt = {
      receiptNumber: `REC-${String(i + 1).padStart(4, '0')}-2025`,
      companyName: company.name,
      companyAddress: company.address,
      companyEmail: company.email,
      date: new Date(),
      items: SAMPLE_ITEMS,
      notes: 'Thank you for your business'
    };

    const fileName = `receipt-${company.name.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    const outputPath = path.join(receiptsDir, fileName);

    try {
      await generator.generate(receipt, outputPath);
      const designName = design.name.padEnd(20);
      console.log(`✅ ${fileName.substring(0, 35).padEnd(35)} → ${designName} (${design.businessType})`);
    } catch (error) {
      console.error(`❌ Failed to generate receipt for ${company.name}:`, error);
    }
  }

  console.log(`\n✨ Done! Generated ${companies.length} receipts with unique designs!`);
  console.log(`📁 Location: ./receipts/\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎨 DESIGN CATALOG:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  DESIGNS.forEach((design, index) => {
    const features = [];
    if (design.showElements.barcode) features.push('Barcode');
    if (design.showElements.paymentDetails) features.push('Payment Info');
    if (design.showElements.cashier) features.push('Cashier');
    
    console.log(`${index + 1}. ${design.name} (${design.businessType})`);
    console.log(`   Layout: ${design.itemLayout} | Separator: ${design.separatorStyle}`);
    console.log(`   Features: ${features.join(', ')}`);
    console.log('');
  });
}

main().catch(console.error);
