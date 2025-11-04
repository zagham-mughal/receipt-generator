# 🗄️ Database Guide

## ✅ SQLite Database Integrated!

Your POS system now uses a **SQLite database** to store companies!

---

## 📊 Database Features

### **What's Stored:**
- ✅ **20 Dummy Companies** - Pre-loaded with realistic data
- ✅ **Company Names** - Actual business names
- ✅ **Contact Information** - Address, email, phone
- ✅ **Receipt Designs** - Each company has an assigned design
- ✅ **Timestamps** - When companies were added

---

## 🏢 Pre-loaded Dummy Companies

### **20 Companies Across 10 Business Types:**

1. **Sunshine Supermarket** - Grocery Store design
2. **Brew & Bean Cafe** - Coffee Shop design
3. **QuickFuel Gas Station** - Gas Station design
4. **HealthPlus Pharmacy** - Pharmacy design
5. **TechWorld Electronics** - Electronics design
6. **Burger Palace** - Fast Food design
7. **Fashion Forward Boutique** - Clothing Store design
8. **BuildIt Hardware** - Hardware Store design
9. **Page Turner Books** - Bookstore design
10. **24/7 Express Store** - Convenience Store design
11. **Fresh Market Grocery** - Grocery Store design
12. **Espresso House** - Coffee Shop design
13. **Metro Gas & Go** - Gas Station design
14. **Wellness Pharmacy** - Pharmacy design
15. **Gadget Galaxy** - Electronics design
16. **Pizza Paradise** - Fast Food design
17. **Elegant Threads** - Clothing Store design
18. **Home Depot Pro** - Hardware Store design
19. **Novel Nook Bookstore** - Bookstore design
20. **QuickStop Convenience** - Convenience Store design

---

## 🎯 How It Works

### **In the Web App:**

1. **Select Company Dropdown** shows actual company names
2. **Auto-fill Feature** - Select a company and their info auto-fills
3. **Assigned Design** - Each company has their own receipt design
4. **Database-driven** - All companies stored in SQLite

### **Flow:**
```
Select Company → Auto-fill Info → Generate Receipt
   ↓                    ↓                  ↓
Database lookup    Name, Address      Uses company's
                   Email filled        design style
```

---

## 💾 Database Schema

### **companies Table:**
```sql
CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  designId INTEGER NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
)
```

### **Fields:**
- `id` - Unique company ID (auto-increment)
- `name` - Company name
- `address` - Full address
- `email` - Email address
- `phone` - Phone number
- `designId` - Receipt design (0-9)
- `createdAt` - Timestamp

---

## 🔧 Database Location

**File:** `data/companies.db`

**Location:** `/Users/usman/Documents/point of sale/data/companies.db`

**Type:** SQLite3 database file

---

## 📡 API Endpoints

### **Get All Companies:**
```
GET /api/companies
```

**Response:**
```json
{
  "companies": [
    {
      "id": 1,
      "name": "Sunshine Supermarket",
      "address": "123 Grocery Lane",
      "email": "info@sunshinemarket.com",
      "phone": "(555) 100-1001",
      "designId": 0,
      "designName": "Grocery Store",
      "businessType": "Supermarket"
    },
    ...
  ]
}
```

### **Get Company by ID:**
```
GET /api/companies/:id
```

### **Add New Company:**
```
POST /api/companies
Body: {
  "name": "New Company",
  "address": "123 Street",
  "email": "email@company.com",
  "phone": "(555) 000-0000",
  "designId": 0
}
```

### **Update Company:**
```
PUT /api/companies/:id
Body: { "name": "Updated Name", ... }
```

### **Delete Company:**
```
DELETE /api/companies/:id
```

---

## 🛠️ Database Functions

Located in `src/database.ts`:

```typescript
// Initialize database and create tables
initializeDatabase()

// Seed with 20 dummy companies
seedDummyCompanies()

// Get all companies
getAllCompanies(): Company[]

// Get company by ID
getCompanyById(id: number): Company

// Add new company
addCompany(company): Company

// Update company
updateCompany(id, updates): Company

// Delete company
deleteCompany(id): boolean
```

---

## 💡 Usage Examples

### **In the Web App:**

1. Open http://localhost:3000
2. See dropdown: **"Select Company from Database"**
3. Click dropdown → Shows all 20 companies
4. Select "Sunshine Supermarket"
5. Watch as customer info auto-fills!
6. Add items and generate receipt
7. Receipt uses company's assigned design

### **Adding New Company via API:**

```bash
curl -X POST http://localhost:3000/api/companies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My New Store",
    "address": "456 New Street",
    "email": "info@mynewstore.com",
    "phone": "(555) 999-9999",
    "designId": 5
  }'
```

---

## 🎨 Design Assignment

Each company has a `designId` (0-9) that determines their receipt style:

| designId | Receipt Design |
|----------|---------------|
| 0 | Grocery Store |
| 1 | Coffee Shop |
| 2 | Gas Station |
| 3 | Pharmacy |
| 4 | Electronics Store |
| 5 | Fast Food |
| 6 | Clothing Store |
| 7 | Hardware Store |
| 8 | Bookstore |
| 9 | Convenience Store |

---

## 📊 Database Management

### **View Database:**
```bash
sqlite3 data/companies.db
.tables
SELECT * FROM companies;
.quit
```

### **Reset Database:**
Delete `data/companies.db` and restart server - it will auto-create and seed!

### **Backup Database:**
```bash
cp data/companies.db data/companies_backup.db
```

---

## 🔐 Database Features

✅ **Auto-initialization** - Creates tables on first run  
✅ **Auto-seeding** - Adds 20 companies if database is empty  
✅ **Transaction support** - Safe bulk operations  
✅ **Foreign keys** - Proper data integrity  
✅ **Type-safe** - Full TypeScript interfaces  
✅ **Fast queries** - SQLite is super fast  
✅ **No external server** - File-based database  

---

## 🚀 Advantages

### **Why SQLite?**
- ✅ **No setup** - Just a file, no server needed
- ✅ **Fast** - Lightning-fast queries
- ✅ **Reliable** - Rock-solid data storage
- ✅ **Portable** - Single file database
- ✅ **TypeScript** - Full type safety
- ✅ **Production-ready** - Used by many apps

### **Why This Approach?**
- ✅ **Real company names** instead of categories
- ✅ **Auto-fill** - Saves time entering data
- ✅ **Persistent** - Companies saved between restarts
- ✅ **Expandable** - Easy to add more companies
- ✅ **Professional** - Real database, real data

---

## 📈 Future Enhancements

You can easily add:
- Customer management
- Sales history
- Inventory tracking
- User accounts
- Analytics
- More company fields

---

## 🎉 Summary

```
✅ SQLite Database    - companies.db
✅ 20 Dummy Companies - Pre-loaded
✅ Auto-fill Feature  - Select & fill
✅ Full CRUD API      - Create, Read, Update, Delete
✅ Type-safe          - TypeScript interfaces
✅ Fast & Reliable    - SQLite performance
✅ Easy to Manage     - Simple file-based
```

**Your POS system now has a real database! 🗄️✨**

