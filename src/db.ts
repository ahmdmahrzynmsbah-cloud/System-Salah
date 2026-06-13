/**
 * IndexedDB Driver for Auto Parts DB (AutoPartsDB)
 */

export interface Product {
  id?: number;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  carCompatibility: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  minStock: number;
  location: string;
  imageUrl?: string;
}

export interface InvoiceItem {
  barcode: string;
  name: string;
  quantity: number;
  sellingPrice: number;
  total: number;
}

export interface Invoice {
  id?: number;
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  items: InvoiceItem[];
  subtotal: number;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  discountAmount: number;
  total: number;
  paymentType: 'cash' | 'credit' | 'partial';
  paidAmount: number;
  remainingAmount: number;
  notes: string;
  username: string; // The user who made the invoice
}

export interface Debt {
  id?: number;
  customerName: string;
  customerPhone: string;
  totalDebt: number;
  lastInvoiceDate: string;
}

export interface Transaction {
  id?: number;
  date: string;
  type: 'sale' | 'debt_payment' | 'add_stock' | 'edit_price' | 'system';
  description: string;
  amount: number;
  username: string;
}

export interface AppSettings {
  id?: string; // e.g. "main"
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeLogoText: string;
  welcomeText: string;
  paperSize: 'A4' | '80mm';
}

export interface User {
  id?: number;
  username: string;
  password?: string; // standard password (unencrypted as per simple requirements)
  role: 'admin' | 'employee';
}

const DB_NAME = "AutoPartsDB";
const DB_VERSION = 1;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB generic error:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;

      // Create Stores
      if (!db.objectStoreNames.contains("products")) {
        const productStore = db.createObjectStore("products", { keyPath: "id", autoIncrement: true });
        productStore.createIndex("barcode", "barcode", { unique: true });
        productStore.createIndex("name", "name", { unique: false });
        productStore.createIndex("category", "category", { unique: false });
      }

      if (!db.objectStoreNames.contains("invoices")) {
        const invoiceStore = db.createObjectStore("invoices", { keyPath: "id", autoIncrement: true });
        invoiceStore.createIndex("invoiceNumber", "invoiceNumber", { unique: true });
        invoiceStore.createIndex("customerName", "customerName", { unique: false });
      }

      if (!db.objectStoreNames.contains("debtLedger")) {
        const debtStore = db.createObjectStore("debtLedger", { keyPath: "id", autoIncrement: true });
        debtStore.createIndex("customerPhone", "customerPhone", { unique: true });
        debtStore.createIndex("customerName", "customerName", { unique: false });
      }

      if (!db.objectStoreNames.contains("transactions")) {
        db.createObjectStore("transactions", { keyPath: "id", autoIncrement: true });
      }

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("users")) {
        const userStore = db.createObjectStore("users", { keyPath: "id", autoIncrement: true });
        userStore.createIndex("username", "username", { unique: true });
      }
    };
  });
}

// Helper methods as requested
export function addRecord(store: string, data: any): Promise<any> {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const objStore = tx.objectStore(store);
      const request = objStore.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export function getAllRecords(store: string): Promise<any[]> {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const objStore = tx.objectStore(store);
      const request = objStore.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  });
}

export function updateRecord(store: string, id: any, data: any): Promise<any> {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const objStore = tx.objectStore(store);
      // Ensure id is kept correctly in payload
      const payload = { ...data };
      if (id !== undefined && id !== null) {
        payload.id = id;
      }
      const request = objStore.put(payload);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export function deleteRecord(store: string, id: any): Promise<any> {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const objStore = tx.objectStore(store);
      const request = objStore.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  });
}

export function getByIndex(store: string, indexName: string, value: any): Promise<any> {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const objStore = tx.objectStore(store);
      const index = objStore.index(indexName);
      const request = index.get(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * Seed database with initial demo data if it is empty.
 */
export async function seedDemoDataIfNeeded(): Promise<boolean> {
  try {
    const users = await getAllRecords("users");
    const settings = await getAllRecords("settings");

    let itemsAdded = false;

    // 1. Users seeding (Essential for system login)
    if (users.length === 0) {
      await addRecord("users", { username: "admin", password: "1234", role: "admin" });
      await addRecord("users", { username: "user", password: "1234", role: "employee" });
      itemsAdded = true;
    }

    // 2. Settings seeding (Essential store configuration)
    if (settings.length === 0) {
      const defaultSettings: AppSettings = {
        id: "main",
        storeName: "مركز قطع غيار السيارات والميكانيكا",
        storeAddress: "الرياض - حي الروضة - طريق الملك عبدالله",
        storePhone: "0501234567",
        storeLogoText: "Modern Parts Auto",
        welcomeText: "نشكركم لزيارتكم وثقتكم بنا - قطع الغيار المباعة لا ترد ولا تستبدل بعد 3 أيام",
        paperSize: "80mm"
      };
      await updateRecord("settings", "main", defaultSettings);
      itemsAdded = true;
    } else {
      // Auto-Migration step: if settings exist but still contain the old default "اليمامة" or "الشبكة" or "الحديث" names, forcefully update it
      const mainSettings = settings.find(s => s.id === "main");
      if (mainSettings && (
        mainSettings.storeName.includes("اليمامة") || 
        mainSettings.storeName.includes("اليمامه") || 
        mainSettings.storeName.includes("الحديث")
      )) {
        mainSettings.storeName = "مركز قطع غيار السيارات والميكانيكا";
        await updateRecord("settings", "main", mainSettings);
        itemsAdded = true;
      }
    }

    // 3. Realistic Products seeding with genuine valid EAN-13 barcodes for testing
    const products = await getAllRecords("products");
    if (products.length === 0) {
      const realProducts: Product[] = [
        {
          barcode: "6281100115021",
          name: "بواجي دينسو أصلية تويوتا (طقم 4 حبات)",
          category: "كهرباء",
          brand: "Denso",
          carCompatibility: "كامري / كورولا 2015-2023",
          purchasePrice: 110,
          sellingPrice: 160,
          quantity: 15,
          minStock: 3,
          location: "رف أ-1"
        },
        {
          barcode: "6281100223047",
          name: "قماش فرامل أمامي هايلوكس الأصلي",
          category: "فرامل",
          brand: "Toyota Genuine",
          carCompatibility: "هايلوكس دبل 2016-2022",
          purchasePrice: 180,
          sellingPrice: 245,
          quantity: 8,
          minStock: 2,
          location: "رف ب-3"
        },
        {
          barcode: "6281100331018",
          name: "زيت تويوتا الأصلي 10W30 (4 لتر)",
          category: "زيوت",
          brand: "Toyota",
          carCompatibility: "جميع المحركات البنزين",
          purchasePrice: 95,
          sellingPrice: 130,
          quantity: 20,
          minStock: 5,
          location: "رف ج-1"
        },
        {
          barcode: "6281100445029",
          name: "فلتر هواء كورولا الأصلي ياباني",
          category: "فلاتر",
          brand: "Toyota Genuine",
          carCompatibility: "كورولا 2014-2021",
          purchasePrice: 45,
          sellingPrice: 70,
          quantity: 12,
          minStock: 4,
          location: "رف ج-2"
        },
        {
          barcode: "6281100557029",
          name: "مساعد هيدروليكي خلفي ياباني",
          category: "تعليق",
          brand: "KYB",
          carCompatibility: "كامري 2012-2017",
          purchasePrice: 190,
          sellingPrice: 270,
          quantity: 6,
          minStock: 2,
          location: "رف د-4"
        }
      ];

      for (const prod of realProducts) {
        await addRecord("products", prod);
      }
      itemsAdded = true;
    }

    return itemsAdded;
  } catch (error) {
    console.error("Error seeding initial data:", error);
    return false;
  }
}

/**
 * Fully reset or partially clear tables in IndexedDB
 */
export async function clearOfficeDatabase(mode: 'partial' | 'full' | 'pure_empty'): Promise<void> {
  const db = await initDB();
  const targetStores = mode === 'partial'
    ? ["invoices", "debtLedger", "transactions"]
    : ["products", "invoices", "debtLedger", "transactions", "settings", "users"];
  
  // Clear all target stores within a single atomic write transaction
  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(targetStores, "readwrite");
      
      tx.oncomplete = () => {
        resolve();
      };
      tx.onerror = () => {
        reject(tx.error || new Error("Transaction error while clearing"));
      };
      tx.onabort = () => {
        reject(new Error("Transaction aborted while clearing"));
      };

      for (const storeName of targetStores) {
        tx.objectStore(storeName).clear();
      }
    } catch (e) {
      reject(e);
    }
  });

  // Re-seed or insert essential fallback records after transaction completes fully
  if (mode === 'full') {
    // Re-seed all demo products, demo invoices, demo customers
    await seedDemoDataIfNeeded();
  } else if (mode === 'pure_empty') {
    // Complete reset to 100% clean blank database - but preserve default login user credentials and settings so they remain functional
    await addRecord("users", { username: "admin", password: "1234", role: "admin" });
    await addRecord("users", { username: "user", password: "1234", role: "employee" });
    
    const defaultSettings: AppSettings = {
      id: "main",
      storeName: "مركز قطع غيار السيارات والميكانيكا",
      storeAddress: "الرياض - حي الروضة - طريق الملك عبدالله",
      storePhone: "0501234567",
      storeLogoText: "Modern Parts Auto",
      welcomeText: "نشكركم لزيارتكم وثقتكم بنا - قطع الغيار المباعة لا ترد ولا تستبدل بعد 3 أيام",
      paperSize: "80mm"
    };
    await updateRecord("settings", "main", defaultSettings);
  }
}

