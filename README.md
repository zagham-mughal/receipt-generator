# Receipt Generator 🧾

Simple, clean receipt generator that creates PDF receipts for companies from a CSV file.

## Features

✅ Read company data from CSV  
✅ **10 Authentic Receipt Designs** - looks like real business receipts!  
✅ Generate professional PDF receipts with dummy data  
✅ **Realistic designs:** Grocery, Coffee Shop, Gas Station, Pharmacy, Electronics, Fast Food, Clothing, Hardware, Bookstore, Convenience  
✅ **Barcodes** on applicable receipts  
✅ **Payment details** (VISA card info) on selected formats  
✅ **Different layouts:** Compact, Spacious, Table, Description  
✅ **Unique separators:** Dashed, Solid, Double, Stars, Equals  
✅ Clean, simple code structure  
✅ **Full TypeScript** - Backend + Frontend type safety  
✅ **SQLite Database** - 20 dummy companies pre-loaded  
✅ **Company Management** - CRUD API for companies  
✅ Modern tech stack  

## 🌐 Web Application (NEW!)

### **Full Web Interface for Manual Input!**

Start the web application:

```bash
npm start
```

Then open your browser and go to: **http://localhost:3000**

### Features:
✅ Beautiful web interface  
✅ Manually enter items, quantities, prices  
✅ Select payment method (VISA, MasterCard, Cash, etc.)  
✅ Choose from 10 receipt designs  
✅ Real-time total preview  
✅ **🖨️ PRINT RECEIPTS** - Direct printing to any printer!  
✅ **80mm Thermal Printer Support** - POS ready!  
✅ **View Receipt Preview** - See before printing  
✅ Instant PDF generation & download  

**See [WEB_APP_GUIDE.md](WEB_APP_GUIDE.md) for complete instructions!**  
**See [POS_PRINTING_GUIDE.md](POS_PRINTING_GUIDE.md) for printing setup!**

---

## CLI Mode (Batch CSV Generation)

### 1. Install Dependencies

```bash
npm install
```

### 2. Add Companies to CSV

Edit `companies.csv`:

```csv
name,address,email
Your Company,123 Your Address,contact@yourcompany.com
```

### 3. Generate Receipts from CSV

```bash
npm run generate-csv
```

Your receipts will be generated in the `receipts/` folder! 📁

Each company automatically gets a **unique business receipt design**:
- 🛒 **Grocery Store** - Supermarket style with barcode & payment info
- ☕ **Coffee Shop** - Cafe style with star logo
- ⛽ **Gas Station** - Fuel station with stars separator
- 💊 **Pharmacy** - Medical style with detailed descriptions
- 📱 **Electronics Store** - Professional table layout
- 🍔 **Fast Food** - Restaurant quick service
- 👕 **Clothing Store** - Fashion retail with barcode
- 🔨 **Hardware Store** - Home improvement style
- 📚 **Bookstore** - Books & media format
- 🏪 **Convenience Store** - 24/7 shop compact style

**10 completely different designs** using dummy data!

See [DESIGNS.md](DESIGNS.md) for detailed information on each design!

## Project Structure

```
.
├── src/
│   ├── index.ts              # Main script
│   ├── receiptGenerator.ts   # PDF generation logic
│   ├── csvReader.ts          # CSV parsing
│   └── types.ts              # Type definitions
├── companies.csv             # Your company list
├── receipts/                 # Generated PDFs
└── package.json
```

## Customization

### Change Store Info

Edit `src/receiptGenerator.ts`:

```typescript
private readonly storeName = 'YOUR BRAND NAME';
private readonly storeAddress = '123 Main Street...';
```

### Change Items

Edit `src/index.ts`:

```typescript
const SAMPLE_ITEMS: ReceiptItem[] = [
  { name: 'Product Name', quantity: 1, price: 100.00 }
];
```

### Change Tax Rate

Edit `src/receiptGenerator.ts`:

```typescript
const tax = subtotal * 0.08; // Change 0.08 to your rate
```

### Change Design Style

Edit `src/designs.ts` to modify layouts, fonts, spacing, and divider styles for each design!

## CSV Format

Your CSV file should have these columns:

- `name` (required) - Company name
- `address` (optional) - Company address
- `email` (optional) - Company email

## License

ISC

