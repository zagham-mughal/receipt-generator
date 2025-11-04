import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { ReceiptGenerator } from './receiptGenerator';
import { Receipt, ReceiptItem } from './types';
import { getDesignForCompany, DESIGNS } from './designs';
import { getUSACompanyReceiptGenerator, CanadianFlyingJReceiptGenerator, HuskyReceiptGenerator, PetroCanadaReceiptGenerator, BVDPetroleumReceiptGenerator } from './usaReceiptDesigns';
import { 
  initializeDatabase, 
  seedDummyCompanies,
  seedLovesStores,
  seedFlyingJStores,
  seedPilotStores,
  seedOne9Stores,
  seedTravelcentersStores,
  seedCanadianStores,
  getAllCompanies, 
  getCompanyById,
  addCompany,
  getStoresByCompanyId,
  getStoreById,
  getItemsByCompanyId,
  updateCompany,
  deleteCompany,
  Company 
} from './database';

const app = express();
const PORT = 3000;

// Initialize database
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
initializeDatabase();
seedDummyCompanies();
seedLovesStores();
seedFlyingJStores();
seedPilotStores();
seedOne9Stores();
seedTravelcentersStores();
seedCanadianStores();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Serve receipts folder
app.use('/receipts', express.static(path.join(__dirname, '../receipts')));

// Ensure receipts directory exists
const receiptsDir = path.join(__dirname, '../receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

// API Routes

// Get all companies (replaces designs endpoint)
app.get('/api/companies', (req: Request, res: Response) => {
  try {
    const companies = getAllCompanies();
    const companiesWithDesigns = companies.map(company => ({
      id: company.id,
      name: company.name,
      address: company.address,
      email: company.email,
      phone: company.phone,
      country: company.country,
      designId: company.designId,
      designName: DESIGNS[company.designId]?.name || 'Default',
      businessType: DESIGNS[company.designId]?.businessType || 'General'
    }));
    
    res.json({ companies: companiesWithDesigns });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get company by ID
app.get('/api/companies/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const company = getCompanyById(id);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    res.json({ company });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Get stores by company ID
app.get('/api/companies/:companyId/stores', (req: Request, res: Response) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const stores = getStoresByCompanyId(companyId);
    res.json({ stores });
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// Get items by company ID
app.get('/api/companies/:companyId/items', (req: Request, res: Response) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const items = getItemsByCompanyId(companyId);
    res.json({ items });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Add new company
app.post('/api/companies', (req: Request, res: Response) => {
  try {
    const { name, address, email, phone, country, designId } = req.body;
    
    if (!name || !country || designId === undefined) {
      return res.status(400).json({ error: 'Name, country, and designId are required' });
    }
    
    const newCompany = addCompany({
      name,
      address: address || '',
      email: email || '',
      phone: phone || '',
      country,
      designId
    });
    
    res.json({ success: true, company: newCompany });
  } catch (error) {
    console.error('Error adding company:', error);
    res.status(500).json({ error: 'Failed to add company' });
  }
});

// Update company
app.put('/api/companies/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    
    const updatedCompany = updateCompany(id, updates);
    
    if (!updatedCompany) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    res.json({ success: true, company: updatedCompany });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// Delete company
app.delete('/api/companies/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = deleteCompany(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    res.json({ success: true, message: 'Company deleted' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

// Get all available designs (for reference)
app.get('/api/designs', (req: Request, res: Response) => {
  const designList = DESIGNS.map((design, index) => ({
    id: index,
    name: design.name,
    businessType: design.businessType,
    features: {
      barcode: design.showElements.barcode,
      paymentDetails: design.showElements.paymentDetails,
      cashier: design.showElements.cashier
    }
  }));
  
  res.json({ designs: designList });
});

// Generate receipt endpoint
app.post('/api/generate-receipt', async (req: Request, res: Response) => {
  try {
    const {
      companyId,
      companyName,
      companyAddress,
      companyEmail,
      country,
      items,
      paymentMethod,
      cardLast4,
      cardEntryMethod,
      copyType,
      vehicleId,
      dlNumber,
      driverCompanyName,
      checkNumber,
      checkNumberConfirm,
      driverFirstName,
      driverLastName,
      date,
      designId,
      storeData,
      includeSignature
    } = req.body;
    
    // If companyId is provided, get company from database
    let selectedCompany = null;
    let finalDesignId = designId;
    
    if (companyId) {
      selectedCompany = getCompanyById(companyId);
      if (selectedCompany) {
        finalDesignId = selectedCompany.designId;
      }
    }

    // Validation
    const customerName = selectedCompany?.name || companyName;
    if (!customerName || !items || items.length === 0) {
      return res.status(400).json({ 
        error: 'Missing required fields: company/customer name and items are required' 
      });
    }
    
    if (!country) {
      return res.status(400).json({ 
        error: 'Missing required field: country is required' 
      });
    }

    // Parse items
    const receiptItems: ReceiptItem[] = items.map((item: any) => ({
      name: item.name,
      quantity: parseFloat(item.quantity) || 1,
      price: parseFloat(item.price) || 0,
      pump: item.pump !== undefined ? parseInt(item.pump) : undefined,
      qty: item.qty !== undefined ? parseInt(item.qty) : undefined
    }));

    // Generate receipt number
    const timestamp = Date.now();
    const receiptNumber = `REC-${timestamp.toString().slice(-8)}`;

    // Parse company data for store number and phone
    // Use storeData if provided, otherwise use company data
    const companyData = storeData ? {
      storeNumber: storeData.storeCode.replace('Store ', ''),
      phone: storeData.phone,
      address: storeData.address,
      city: storeData.cityState
    } : {
      storeNumber: Math.floor(Math.random() * 900 + 100).toString(),
      phone: selectedCompany?.phone || '',
      address: selectedCompany?.address || companyAddress || '',
      city: '' // Will be extracted from address if needed
    };

    // Create receipt data (use selected company data if available)
    const receipt: Receipt = {
      receiptNumber,
      companyName: customerName,
      companyAddress: selectedCompany?.address || companyAddress || '',
      companyEmail: selectedCompany?.email || companyEmail || '',
      country: country,
      date: date ? new Date(date) : new Date(),
      items: receiptItems,
      notes: `Payment: ${paymentMethod || 'Cash'}`,
      paymentMethod: paymentMethod || 'Cash',
      cardLast4: cardLast4 || (paymentMethod !== 'Cash' ? '3948' : undefined),
      cardEntryMethod: cardEntryMethod || (paymentMethod !== 'Cash' ? 'INSERT' : undefined),
      copyType: copyType || 'Original',
      vehicleId: vehicleId || '',
      dlNumber: dlNumber || '',
      driverCompanyName: driverCompanyName || '',
      checkNumber: checkNumber || '',
      checkNumberConfirm: checkNumberConfirm || '',
      driverFirstName: driverFirstName || '',
      driverLastName: driverLastName || '',
      companyData: companyData,
      includeSignature: includeSignature || false
    };

    // Generate PDF
    const fileName = `receipt-${receiptNumber}.pdf`;
    const outputPath = path.join(receiptsDir, fileName);

    // Check which generator to use based on country and company
    const isUSACompany = country === 'United States of America';
    const isCanadianFlyingJ = country === 'Canada' && selectedCompany?.name === 'Flying J';
    const isHusky = country === 'Canada' && selectedCompany?.name === 'Husky';
    const isPetroCanada = country === 'Canada' && selectedCompany?.name === 'Petro-Canada';
    const isBVDPetroleum = country === 'Canada' && selectedCompany?.name === 'BVD Petroleum';
    let designName = 'Default';
    
    console.log('🔍 DEBUG - Country:', country);
    console.log('🔍 DEBUG - isUSACompany:', isUSACompany);
    console.log('🔍 DEBUG - isCanadianFlyingJ:', isCanadianFlyingJ);
    console.log('🔍 DEBUG - isHusky:', isHusky);
    console.log('🔍 DEBUG - isPetroCanada:', isPetroCanada);
    console.log('🔍 DEBUG - isBVDPetroleum:', isBVDPetroleum);
    console.log('🔍 DEBUG - selectedCompany:', selectedCompany?.name);
    console.log('🔍 DEBUG - customerName:', customerName);
    
    if (isHusky) {
      // Use dedicated Husky generator
      console.log('✅ Using Husky generator for:', customerName);
      const huskyGenerator = new HuskyReceiptGenerator();
      await huskyGenerator.generate(receipt, outputPath);
      designName = 'Husky Receipt';
      console.log('✅ Generated Husky receipt');
    } else if (isPetroCanada) {
      // Use dedicated Petro-Canada generator
      console.log('✅ Using Petro-Canada generator for:', customerName);
      const petroCanadaGenerator = new PetroCanadaReceiptGenerator();
      await petroCanadaGenerator.generate(receipt, outputPath);
      designName = 'Petro-Canada Receipt';
      console.log('✅ Generated Petro-Canada receipt');
    } else if (isBVDPetroleum) {
      // Use dedicated BVD Petroleum generator
      console.log('✅ Using BVD Petroleum generator for:', customerName);
      const bvdPetroleumGenerator = new BVDPetroleumReceiptGenerator();
      await bvdPetroleumGenerator.generate(receipt, outputPath);
      designName = 'BVD Petroleum Receipt';
      console.log('✅ Generated BVD Petroleum receipt');
    } else if (isCanadianFlyingJ) {
      // Use dedicated Canadian Flying J generator
      console.log('✅ Using Canadian Flying J generator for:', customerName);
      const canadianFlyingJGenerator = new CanadianFlyingJReceiptGenerator();
      await canadianFlyingJGenerator.generate(receipt, outputPath);
      designName = 'Canadian Flying J Receipt';
      console.log('✅ Generated Canadian Flying J receipt');
    } else if (isUSACompany && selectedCompany) {
      // Use USA company generators
      console.log('✅ Using custom USA generator for:', customerName);
      const usaGenerator = getUSACompanyReceiptGenerator(customerName);
      console.log('🔍 DEBUG - usaGenerator:', usaGenerator ? 'Found' : 'NULL');
      
      if (usaGenerator) {
        await usaGenerator.generate(receipt, outputPath);
        designName = customerName + ' Receipt';
        console.log('✅ Generated custom USA receipt');
      } else {
        console.log('⚠️  No custom USA generator found, using fallback');
        // Fallback to regular generator
        const design = finalDesignId !== undefined ? DESIGNS[finalDesignId % DESIGNS.length] : DESIGNS[0];
        const generator = new ReceiptGenerator(design);
        await generator.generate(receipt, outputPath);
        designName = design.name;
      }
    } else {
      console.log('ℹ️  Using regular generator (not USA/Canadian Flying J or no selected company)');
      // Use regular generator for other companies
      const design = finalDesignId !== undefined ? DESIGNS[finalDesignId % DESIGNS.length] : DESIGNS[0];
      const generator = new ReceiptGenerator(design);
      await generator.generate(receipt, outputPath);
      designName = design.name;
    }

    // Return success with download link
    res.json({
      success: true,
      receiptNumber,
      fileName,
      downloadUrl: `/receipts/${fileName}`,
      design: designName
    });

  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({ 
      error: 'Failed to generate receipt',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Receipt Generator API is running' });
});

// Serve main page
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  const companiesCount = getAllCompanies().length;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧾  RECEIPT GENERATOR WEB APP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`✅  Server running at: http://localhost:${PORT}`);
  console.log(`📁  Receipts saved to: ./receipts/`);
  console.log(`🏢  Companies in database: ${companiesCount}`);
  console.log(`🎨  Available designs: ${DESIGNS.length}`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('👉  Open your browser and go to:');
  console.log(`    http://localhost:${PORT}`);
  console.log('');
});

