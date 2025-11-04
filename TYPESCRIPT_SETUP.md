# 📘 TypeScript Setup

## ✅ Now Using TypeScript Throughout!

The entire project now uses TypeScript for both backend and frontend! 🎉

---

## 🗂️ Project Structure

### **Backend (TypeScript)**
```
src/
├── server.ts          # Express web server
├── receiptGenerator.ts # PDF generation
├── designs.ts         # Receipt designs
├── csvReader.ts       # CSV parsing
├── types.ts           # Type definitions
└── index.ts           # CLI script
```

**Config:** `tsconfig.json`

---

### **Frontend (TypeScript)**
```
public/
├── app.ts             # TypeScript source (you edit this)
├── app-compiled.js    # Compiled JavaScript (auto-generated)
├── index.html         # HTML interface
├── styles.css         # Main styles
└── print.css          # Print styles
```

**Config:** `tsconfig.frontend.json`

---

## 🔧 TypeScript Configuration

### **Backend TypeScript** (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  }
}
```

### **Frontend TypeScript** (`tsconfig.frontend.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2015",
    "lib": ["ES2020", "DOM"],
    "outDir": "./public",
    "strict": true
  },
  "include": ["public/app.ts"]
}
```

---

## 🎯 TypeScript Types Used

### **Frontend Types:**
```typescript
interface ReceiptItem {
    name: string;
    quantity: number;
    price: number;
}

interface ReceiptFormData {
    companyName: string;
    companyAddress: string;
    companyEmail: string;
    date: string;
    paymentMethod: string;
    designId: number;
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
```

### **Backend Types:**
Located in `src/types.ts` - shared across backend modules

---

## 🛠️ Development Workflow

### **Starting the Application:**
```bash
npm start
```

This automatically:
1. Compiles TypeScript frontend (`app.ts` → `app-compiled.js`)
2. Starts the TypeScript backend server with `ts-node`

---

### **Development Mode:**
```bash
npm run dev
```

Same as `npm start` - compiles frontend and runs server

---

### **Watch Mode (Frontend):**

To automatically recompile frontend TypeScript when you make changes:

```bash
npm run watch:frontend
```

Then in another terminal:
```bash
npm run dev
```

---

## 📝 Editing Frontend Code

### **What You Edit:**
- **`public/app.ts`** ← Your TypeScript source file

### **What Gets Generated:**
- **`public/app-compiled.js`** ← Compiled JavaScript (don't edit!)
- **`public/app-compiled.js.map`** ← Source map for debugging

### **What Gets Loaded:**
- **`index.html`** references `app-compiled.js`

---

## 🔄 Build Process

### **Manual Build:**
```bash
# Build frontend only
npm run build:frontend

# Build backend only
npm run build
```

### **Automatic Build:**
`npm start` automatically builds frontend before starting server

---

## 🎓 TypeScript Benefits

### **Type Safety:**
```typescript
// ✅ Type checking catches errors at compile time
let items: ReceiptItem[] = [];
items.push({ name: "Test", quantity: 1, price: 10 }); // OK
items.push({ name: "Test" }); // ❌ Error: missing properties

// ✅ IntelliSense and autocomplete
const item: ReceiptItem = {
    name: "Coffee",
    quantity: 2,  // IDE suggests property names
    price: 4.50
};
```

### **Better Developer Experience:**
- ✅ Autocomplete in VS Code
- ✅ Inline documentation
- ✅ Refactoring support
- ✅ Catch errors before runtime
- ✅ Better code maintainability

---

## 📂 Generated Files (Ignored in Git)

These files are auto-generated and should not be committed:
- `public/app-compiled.js`
- `public/app-compiled.js.map`
- `public/app.js` (if exists)
- `public/app.js.map` (if exists)
- `dist/` (backend compiled files)

**Check `.gitignore` for complete list**

---

## 🐛 Debugging TypeScript

### **Source Maps Enabled:**
Both frontend and backend have source maps, so you can:
- Debug TypeScript directly in browser DevTools
- See original TypeScript line numbers in errors
- Set breakpoints in `.ts` files

### **Browser DevTools:**
1. Open DevTools (F12)
2. Go to Sources tab
3. Find `app.ts` in the file tree
4. Set breakpoints and debug!

---

## 🎯 Commands Reference

| Command | Description |
|---------|-------------|
| `npm start` | Build frontend + start server |
| `npm run dev` | Same as start |
| `npm run build:frontend` | Compile TypeScript frontend only |
| `npm run watch:frontend` | Watch mode for frontend |
| `npm run build` | Build backend TypeScript |
| `npm run generate-csv` | CLI batch generation |

---

## 📦 Dependencies

### **TypeScript Related:**
```json
{
  "devDependencies": {
    "typescript": "^5.3.0",
    "ts-node": "^10.9.2",
    "@types/node": "^20.10.0",
    "@types/express": "^4.17.21",
    "@types/pdfkit": "^0.13.4"
  }
}
```

---

## ✨ Advantages of This Setup

✅ **Full Type Safety** - Frontend and backend  
✅ **Shared Types** - Consistent interfaces  
✅ **Better IDE Support** - Autocomplete everywhere  
✅ **Catch Errors Early** - At compile time  
✅ **Easy Refactoring** - TypeScript helps refactor  
✅ **Better Documentation** - Types serve as docs  
✅ **Professional Code** - Industry standard  

---

## 🔧 Customizing TypeScript

### **Stricter Type Checking:**
Edit `tsconfig.json` or `tsconfig.frontend.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### **Target Different JavaScript:**
Change `target` in config:
- `"ES5"` - Older browser support
- `"ES2015"` - Modern browsers
- `"ES2020"` - Latest features

---

## 🎉 Summary

✅ **Backend:** Full TypeScript with `ts-node`  
✅ **Frontend:** TypeScript compiled to JavaScript  
✅ **Type Safety:** Throughout the entire stack  
✅ **Auto-build:** Frontend compiles on `npm start`  
✅ **Source Maps:** Full debugging support  

**Your entire POS system is now TypeScript! 🚀**

