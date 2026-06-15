/**
 * Firebase Firestore Driver for Auto Parts DB (AutoPartsDB)
 */

import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export function subscribeToStore(store: string, callback: (data: any[]) => void): () => void {
  const colRef = collection(db, store);
  return onSnapshot(colRef, (snapshot) => {
    const data = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    callback(data);
  });
}

export interface Product {
  id?: string;
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
  id?: string;
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
  id?: string;
  customerName: string;
  customerPhone: string;
  totalDebt: number;
  lastInvoiceDate: string;
}

export interface Supplier {
  id?: string;
  name: string;
  phone: string;
  companyName: string;
  balance: number;
  notes: string;
}

export interface Transaction {
  id?: string;
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
  invoiceSubtitle?: string;
  invoiceSubtitle2?: string;
  invoicePhone1?: string;
  invoicePhone2?: string;
  systemName?: string;
  categories?: string[];
}

export interface User {
  id?: string;
  username: string;
  password?: string; // standard password (unencrypted as per simple requirements)
  role: 'admin' | 'employee';
}

// Helper methods mapped to Firestore

export async function addRecord(store: string, data: any): Promise<any> {
  const colRef = collection(db, store);
  const docRef = await addDoc(colRef, data);
  return docRef.id;
}

export async function getAllRecords(store: string): Promise<any[]> {
  const colRef = collection(db, store);
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateRecord(store: string, id: any, data: any): Promise<any> {
  if (!id) throw new Error("Document ID missing for update");
  const docRef = doc(db, store, String(id));
  const payload = { ...data };
  delete payload.id; // avoid overwriting id inline if it exists
  await setDoc(docRef, payload, { merge: true });
  return true;
}

export async function deleteRecord(store: string, id: any): Promise<any> {
  if (!id) throw new Error("Document ID missing for delete");
  const docRef = doc(db, store, String(id));
  await deleteDoc(docRef);
  return true;
}

export async function getByIndex(store: string, indexName: string, value: any): Promise<any> {
  // Simple fallback for indexedDB queries since we don't have indexes explicitly required dynamically here
  // A slightly inefficient but functional shim for porting:
  const all = await getAllRecords(store);
  return all.find(item => item[indexName] === value);
}

export interface Expense {
  id?: string;
  date: string;
  description: string;
  amount: number;
  username: string;
}

export async function clearAllCollections(): Promise<void> {
  const stores = ["products", "invoices", "debtLedger", "transactions", "suppliers", "expenses"];
  
  for (const store of stores) {
    const colRef = collection(db, store);
    const snapshot = await getDocs(colRef);
    for (const doc of snapshot.docs) {
      await deleteDoc(doc.ref);
    }
  }
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
        storeName: "الـعُـمـدة",
        storeAddress: "مطروح ك3",
        storePhone: "01004244528",
        storeLogoText: "Car",
        welcomeText: "نشكركم لزيارتكم وثقتكم بنا - البضاعة المباعة لا ترد ولا تستبدل بعد 3 أيام",
        paperSize: "80mm",
        invoiceSubtitle: "لقطع غيار السيارات",
        invoiceSubtitle2: "تويوتا ودبابة",
        invoicePhone1: "عماد إبراهيم: 01000543001",
        invoicePhone2: "عماد: 01004244528",
        systemName: "نظام المبيعات والمخزون"
      };
      await setDoc(doc(db, "settings", "main"), defaultSettings);
      itemsAdded = true;
    }

    // 3. Realistic Products seeding with genuine valid EAN-13 barcodes for testing
    // Only seed if settings are brand new, to prevent re-seeding when user deletes all products.
    if (settings.length === 0) {
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
    }

    return itemsAdded;
  } catch (error) {
    console.error("Error seeding initial data:", error);
    return false;
  }
}


