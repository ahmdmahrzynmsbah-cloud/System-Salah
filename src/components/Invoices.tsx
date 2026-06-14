import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Printer, 
  Trash2, 
  Receipt, 
  Calculator, 
  User, 
  Phone, 
  CreditCard, 
  ArrowLeft,
  X,
  Eye,
  Settings as SettingsIcon,
  CheckCircle,
  FileText,
  Camera,
  Car,
  ShieldAlert,
  BadgeInfo,
  Check,
  ShoppingBag,
  Edit
} from 'lucide-react';
import { 
  getAllRecords, 
  addRecord, 
  updateRecord, 
  deleteRecord,
  getByIndex,
  Product, 
  Invoice, 
  InvoiceItem, 
  Debt, 
  AppSettings 
} from '../db';
import * as LucideIcons from 'lucide-react';
import { CameraScanner } from './CameraScanner';
import { Barcode } from './Barcode';

interface InvoicesProps {
  onAddLog: (type: 'sale' | 'debt_payment' | 'add_stock' | 'edit_price' | 'system', description: string, amount: number) => Promise<void>;
  currentUser: { username: string; role: 'admin' | 'employee' } | null;
  onToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  shopSettings: AppSettings;
}

export default function Invoices({ onAddLog, currentUser, onToast, shopSettings }: InvoicesProps) {
  const StoreIcon = (LucideIcons as any)[shopSettings.storeLogoText || 'Car'] || LucideIcons.Car;
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [viewMode, setViewMode] = useState<'create' | 'list'>('create');

  // Input ref to keep browser focus on scanner field
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Search invoice state
  const [searchInvoiceQuery, setSearchInvoiceQuery] = useState('');

  // active POS invoice draft
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cartItems, setCartItems] = useState<InvoiceItem[]>([]);
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'partial'>('cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Barcode / Name searching within POS cart
  const [productSearchInput, setProductSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  // Print/Inspect active target receipt
  const [activeReceipt, setActiveReceipt] = useState<Invoice | null>(null);

  // Auto-scanning & Quick Product registration state variables
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [scannedBarcodeNotFound, setScannedBarcodeNotFound] = useState<string>('');
  const [popupQuantityToAdd, setPopupQuantityToAdd] = useState<number>(1);
  const [viewingBarcodeProduct, setViewingBarcodeProduct] = useState<Product | null>(null);
  const [openDetailsOnScan, setOpenDetailsOnScan] = useState<boolean>(true);

  // Quick product registration parameters
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState('قطع ميكانيكية');
  const [quickAddBrand, setQuickAddBrand] = useState('أصلي');
  const [quickAddCarCompatibility, setQuickAddCarCompatibility] = useState('عام');
  const [quickAddPurchasePrice, setQuickAddPurchasePrice] = useState<string>('');
  const [quickAddSellingPrice, setQuickAddSellingPrice] = useState<string>('');
  const [quickAddQuantity, setQuickAddQuantity] = useState<string>('');
  const [quickAddMinStock, setQuickAddMinStock] = useState<string>('');
  const [quickAddLocation, setQuickAddLocation] = useState('المستودع الرئيسي');

  // Auto generated Invoice Number state
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState('SA-1');

  // Confirmation modals state
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);

  useEffect(() => {
    loadInitialData();
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'create') {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    }
  }, [viewMode]);

  // Global Physical Barcode Scanner Focus Binder & Keystroke Redirector
  // This is the absolute standard and most robust solution for high-efficiency POS systems.
  // It guarantees that whenever a physical scan gun is triggered anywhere, the keyboard strokes
  // are safely captured by the main search barcode field, bypassing temporal lag problems.
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier/system keys
      if (e.key === 'Escape' || e.key === 'Tab' || e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        return;
      }

      const target = e.target as HTMLElement;
      const isInputActive = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'SELECT' ||
        target.getAttribute('contenteditable') === 'true'
      );

      // If the user is actively typing in another form field (e.g., Client Name, Quick registration price, notes, etc.)
      // do not disrupt the typing focus.
      if (isInputActive && target !== searchInputRef.current) {
        return;
      }

      // If search input exists and is not already focused, give it focus immediately before key repeats
      if (searchInputRef.current && document.activeElement !== searchInputRef.current) {
        searchInputRef.current.focus();
      }
    };

    // Auto-focus on start
    if (viewMode === 'create' && searchInputRef.current) {
      searchInputRef.current.focus();
    }

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [viewMode, viewingBarcodeProduct, scannedProduct]);

  // Periodic fallback and user-click focus retention
  useEffect(() => {
    if (viewMode !== 'create') return;

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = target.closest('input, textarea, select, button, [role="button"], a, [onclick]');
      
      // If the click is on a blank space or static element, return focus back to the barcode scan input
      if (!isInteractive && searchInputRef.current) {
        // Short timeout to let other UI handlers complete first
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 60);
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [viewMode, viewingBarcodeProduct, scannedProduct]);

  useEffect(() => {
    // Recalculate automatic paidAmount default on paymentType switch or totals change
    const t = calculateGrandTotal();
    if (paymentType === 'cash') {
      setPaidAmount(t);
    } else if (paymentType === 'credit') {
      setPaidAmount(0);
    }
  }, [paymentType, cartItems, discountType, discountValue]);

  const loadInitialData = async () => {
    try {
      const allSpecs = await getAllRecords("products");
      const allBills = await getAllRecords("invoices");
      setProducts(allSpecs);
      setInvoices(allBills);

      // Generate simple sequential invoice number
      const numCode = allBills.length + 1;
      setNextInvoiceNumber(`SA-${numCode}`);
    } catch (e) {
      console.error(e);
    }
  };

  // Searching items live in Cashier POS
  const handleProductSearch = (value: string) => {
    setProductSearchInput(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    const valLower = value.toLowerCase();
    const matches = products.filter(p => 
      p.barcode.toLowerCase().includes(valLower) || 
      p.name.toLowerCase().includes(valLower) ||
      p.brand.toLowerCase().includes(valLower)
    );
    setSearchResults(matches.slice(0, 5)); // Limit preview to 5 items
  };

  const playScanBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime); // Crisp scan tone
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08); // Short fade-out
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (err) {
      console.log("Audio play blocked by browser constraints");
    }
  };

  const handleCameraScanSuccess = (decodedBarcode: string) => {
    setIsCameraOpen(false);
    
    // Find matching product
    const matched = products.find(p => p.barcode === decodedBarcode || p.barcode.toLowerCase() === decodedBarcode.toLowerCase().trim());
    if (matched) {
      playScanBeep();
      setScannedProduct(matched);
      setPopupQuantityToAdd(1);
      setScannedBarcodeNotFound('');
      onToast(`تم التعرف على المنتج: ${matched.name}`, "success");
    } else {
      setScannedProduct(null);
      setScannedBarcodeNotFound(decodedBarcode);
      // Reset quick add fields for easy creation
      setQuickAddName('');
      setQuickAddCategory('قطع ميكانيكية');
      setQuickAddBrand('أصلي');
      setQuickAddCarCompatibility('عام');
      setQuickAddPurchasePrice('');
      setQuickAddSellingPrice('');
      setQuickAddQuantity('');
      setQuickAddMinStock('');
      setQuickAddLocation('المستودع الرئيسي');
      
      onToast(`الباركود الممسوح غير مسجل بالمنظومة: ${decodedBarcode}`, "warning");
    }
  };

  const handleQuickAddProduct = async () => {
    if (!quickAddName.trim()) {
      onToast("الرجاء كتابة اسم المنتج أولاً!", "error");
      return;
    }
    
    const sellPrice = Number(quickAddSellingPrice);
    const buyPrice = Number(quickAddPurchasePrice);
    const qty = Number(quickAddQuantity);
    const minStk = Number(quickAddMinStock);

    if (isNaN(sellPrice) || sellPrice <= 0) {
      onToast("سعر البيع يجب أن يكون رقماً أكبر من صفر!", "error");
      return;
    }
    
    const newProduct: Product = {
      barcode: scannedBarcodeNotFound,
      name: quickAddName.trim(),
      category: quickAddCategory,
      brand: quickAddBrand.trim() || 'أصلي',
      carCompatibility: quickAddCarCompatibility.trim() || 'عام',
      purchasePrice: isNaN(buyPrice) ? 0 : buyPrice,
      sellingPrice: sellPrice,
      quantity: isNaN(qty) ? 5 : qty,
      minStock: isNaN(minStk) ? 1 : minStk,
      location: quickAddLocation.trim() || 'المستودع الرئيسي'
    };

    try {
      // 1. Add record to indexedDB
      const addedId = await addRecord("products", newProduct);
      
      // Log event
      await onAddLog('system', `تم تسجيل قطعة جديدة سريعة بالماسح: ${newProduct.name} (ID: ${addedId})`, 0);
      
      // 2. Play Scan Beep
      playScanBeep();

      // 3. Add to Pos Cart immediately with qty 1
      const newItem: InvoiceItem = {
        barcode: newProduct.barcode,
        name: newProduct.name,
        quantity: 1,
        sellingPrice: newProduct.sellingPrice,
        total: newProduct.sellingPrice
      };
      
      setCartItems([...cartItems, newItem]);
      onToast("تم تسجيل المنتج بنجاح وإضافته للفاتورة الحالية!", "success");
      
      // 4. Reload initial data to synchronize POS listing
      await loadInitialData();

      // Clear scanned search state
      setScannedBarcodeNotFound('');
    } catch (err) {
      console.error(err);
      onToast("فشل حفظ المنتج. قد يكون الباركود مكرراً!", "error");
    }
  };

  const addToCart = (product: Product) => {
    if (product.quantity <= 0) {
      onToast("عذراً، المنتج الّذي اخترته نفذ من المخزون تماماً!", "error");
      return;
    }

    playScanBeep();

    // Check if already in draft cart
    const existing = cartItems.find(item => item.barcode === product.barcode);
    if (existing) {
      if (existing.quantity >= product.quantity) {
        onToast(`لا عِندنا سوى ${product.quantity} حبات فقط في المخزن`, "warning");
        return;
      }
      setCartItems(cartItems.map(item => 
        item.barcode === product.barcode
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.sellingPrice }
          : item
      ));
    } else {
      const newItem: InvoiceItem = {
        barcode: product.barcode,
        name: product.name,
        quantity: 1,
        sellingPrice: product.sellingPrice,
        total: product.sellingPrice
      };
      setCartItems([...cartItems, newItem]);
    }

    setProductSearchInput('');
    setSearchResults([]);
    onToast("تمت إضافة القطعة للفاتورة", "success");

    // Automatically retain focus on the barcode scanning field
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = e.currentTarget.value.trim();
      if (!query) return;

      // Reset the search state and clear input value
      setProductSearchInput('');
      e.currentTarget.value = '';
      setSearchResults([]);

      // 0. Check if the scanned barcode is actually an Invoice Number (e.g. SA-1)
      const matchedInvoice = invoices.find(inv => inv.invoiceNumber.toLowerCase() === query.toLowerCase());
      if (matchedInvoice) {
        setViewingBarcodeProduct(null);
        playScanBeep();
        setActiveReceipt(matchedInvoice);
        onToast(`تم العثور على الفاتورة وتفاصيلها: ${matchedInvoice.invoiceNumber}`, "success");
        return;
      }

      // 1. Exact match barcode or product name
      const exactMatch = products.find(p => p.barcode.toLowerCase() === query.toLowerCase());
      if (exactMatch) {
        setViewingBarcodeProduct(null); // Close preview popup immediately
        if (openDetailsOnScan) {
          playScanBeep();
          setScannedProduct(exactMatch);
          setPopupQuantityToAdd(1);
          onToast(`تم التعرف على السلعة: ${exactMatch.name}`, "success");
        } else {
          addToCart(exactMatch);
        }
        return;
      }

      // 2. Exact match on numeric/alphabetic barcode representation
      const startsWithMatch = products.find(p => p.barcode.toLowerCase().startsWith(query.toLowerCase()));
      if (startsWithMatch) {
        setViewingBarcodeProduct(null); // Close preview popup immediately
        if (openDetailsOnScan) {
          playScanBeep();
          setScannedProduct(startsWithMatch);
          setPopupQuantityToAdd(1);
          onToast(`تم التعرف على السلعة: ${startsWithMatch.name}`, "success");
        } else {
          addToCart(startsWithMatch);
        }
        return;
      }

      // 3. Match from search results list if any are found
      if (searchResults.length > 0) {
        const firstSearchMatch = searchResults[0];
        setViewingBarcodeProduct(null); // Close preview popup immediately
        if (openDetailsOnScan) {
          playScanBeep();
          setScannedProduct(firstSearchMatch);
          setPopupQuantityToAdd(1);
        } else {
          addToCart(firstSearchMatch);
        }
      } else {
        // Barcode or search name of unknown product scanned/typed
        // Automatically open quick add with this scanned code, like we do globally!
        setViewingBarcodeProduct(null);
        setScannedProduct(null);
        setScannedBarcodeNotFound(query);
        setQuickAddName('');
        setQuickAddCategory('قطع ميكانيكية');
        setQuickAddBrand('أصلي');
        setQuickAddCarCompatibility('عام');
        setQuickAddPurchasePrice('');
        setQuickAddSellingPrice('');
        setQuickAddQuantity('');
        setQuickAddMinStock('');
        setQuickAddLocation('المستودع الرئيسي');
        onToast(`الباركود الممسوح غير مسجل بالمنظومة: ${query}`, "warning");
      }
    }
  };

  const updateCartQuantity = (barcode: string, qty: number) => {
    const originalProd = products.find(p => p.barcode === barcode);
    if (!originalProd) return;

    if (qty > originalProd.quantity) {
      onToast(`أقصى كمية متاحة: ${originalProd.quantity}`, "warning");
      qty = originalProd.quantity;
    }

    if (qty <= 0) {
      setCartItems(cartItems.filter(item => item.barcode !== barcode));
      onToast("تم إزالة القطعة", "warning");
      return;
    }

    setCartItems(cartItems.map(item => 
      item.barcode === barcode
        ? { ...item, quantity: qty, total: qty * item.sellingPrice }
        : item
    ));
  };

  const updateCartPrice = (barcode: string, newPrice: number) => {
    if (newPrice < 0) return;
    setCartItems(cartItems.map(item => 
      item.barcode === barcode
        ? { ...item, sellingPrice: newPrice, total: item.quantity * newPrice }
        : item
    ));
  };

  const removeFromCart = (barcode: string) => {
    setCartItems(cartItems.filter(item => item.barcode !== barcode));
    onToast("تم حذف العنصر من الفاتورة", "warning");
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((acc, item) => acc + item.total, 0);
  };

  const calculateDiscountAmount = () => {
    const sub = calculateSubtotal();
    if (discountType === 'percentage') {
      return Number(((sub * discountValue) / 100).toFixed(2));
    } else {
      return Number(discountValue);
    }
  };

  const calculateGrandTotal = () => {
    const sub = calculateSubtotal();
    const disc = calculateDiscountAmount();
    return Math.max(0, sub - disc);
  };

  const handleSaveInvoice = async () => {
    if (cartItems.length === 0) {
      onToast("سلتك فارغة تماماً. يرجى إضافة قطعة واحدة على الأقل", "warning");
      return;
    }

    const subtotal = calculateSubtotal();
    const discountAmount = calculateDiscountAmount();
    const total = calculateGrandTotal();

    let finalPaid = Number(paidAmount);
    if (paymentType === 'cash') {
      finalPaid = total;
    }

    const remainingAmount = Math.max(0, total - finalPaid);

    if ((paymentType === 'credit' || paymentType === 'partial') && !customerName.trim()) {
      onToast("الفواتير الآجلة أو الجزئية تتطلب إدخال اسم العميل أولاً", "error");
      return;
    }

    // 1. Get Date String: DD/MM/YYYY
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const dateStr = `${dd}/${mm}/${yyyy} ${hh}:${min}`;

    const newInvoice: Invoice = {
      invoiceNumber: nextInvoiceNumber,
      date: dateStr,
      customerName: customerName.trim() || 'عميل نقدي مميز',
      customerPhone: customerPhone.trim(),
      items: cartItems,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      total,
      paymentType,
      paidAmount: finalPaid,
      remainingAmount,
      notes: notes.trim(),
      username: currentUser?.username || 'admin'
    };

    try {
      // A. Add Invoice record
      await addRecord("invoices", newInvoice);

      // B. Post-update of inventory stock levels
      for (const item of cartItems) {
        const prod = products.find(p => p.barcode === item.barcode);
        if (prod) {
          const updatedStock = Math.max(0, prod.quantity - item.quantity);
          await updateRecord("products", prod.id, {
            ...prod,
            quantity: updatedStock
          });
        }
      }

      // C. Manage Debt ledger if remaining amount is positive
      if (remainingAmount > 0 && customerName.trim()) {
        const debtRecords = await getAllRecords("debtLedger");
        const cleanPhone = customerPhone.trim();
        const existingDebt = debtRecords.find(d => 
          (cleanPhone && d.customerPhone === cleanPhone) || 
          d.customerName.toLowerCase() === customerName.trim().toLowerCase()
        );

        if (existingDebt) {
          const updatedDebt = existingDebt.totalDebt + remainingAmount;
          await updateRecord("debtLedger", existingDebt.id, {
            ...existingDebt,
            totalDebt: updatedDebt,
            lastInvoiceDate: dateStr
          });
        } else {
          const newDebt: Debt = {
            customerName: customerName.trim(),
            customerPhone: cleanPhone,
            totalDebt: remainingAmount,
            lastInvoiceDate: dateStr
          };
          await addRecord("debtLedger", newDebt);
        }
      }

      // D. Register a transaction log entry
      let txDescription = `بيع فاتورة رقم ${nextInvoiceNumber}`;
      if (paymentType === 'credit') {
        txDescription += ` آجل غير مسدد بقيمة ${total} ج.م للعميل ${customerName}`;
      } else if (paymentType === 'partial') {
        txDescription += ` جزئي (دفع: ${finalPaid}، والمتبقي: ${remainingAmount}) للعميل ${customerName}`;
      } else {
        txDescription += ` نقدي بقيمة ${total} ج.م`;
      }

      await onAddLog('sale', txDescription, total);

      onToast(`تم حفظ الفاتورة بنجاح برقم ${nextInvoiceNumber}`, "success");

      // Auto set print receipt viewable
      setActiveReceipt(newInvoice);

      // Clear terminal form state
      setCustomerName('');
      setCustomerPhone('');
      setCartItems([]);
      setDiscountValue(0);
      setPaymentType('cash');
      setPaidAmount(0);
      setNotes('');

      // Reload
      loadInitialData();
    } catch (e) {
      console.error(e);
      onToast("خطأ أثناء تسجيل الفاتورة", "error");
    }
  };

  const handleInspectReceipt = (inv: Invoice) => {
    setActiveReceipt(inv);
  };

  const confirmDeleteInvoice = async (inv: Invoice) => {
    try {
      // 1. Return items to inventory
      for (const item of inv.items) {
        const prod = products.find(p => p.barcode === item.barcode);
        if (prod && prod.id) {
          await updateRecord("products", prod.id, {
            ...prod,
            quantity: prod.quantity + item.quantity
          });
        }
      }

      // 2. Reverse debt if applicable
      if (inv.remainingAmount > 0) {
        const allDebts = await getAllRecords("debtLedger");
        const existingDebt = allDebts.find((d: any) => d.customerName.toLowerCase() === inv.customerName.trim().toLowerCase());
        if (existingDebt && existingDebt.id) {
          const updatedDebt = Math.max(0, existingDebt.totalDebt - inv.remainingAmount);
          if (updatedDebt === 0) {
            await deleteRecord("debtLedger", existingDebt.id);
          } else {
            await updateRecord("debtLedger", existingDebt.id, {
              ...existingDebt,
              totalDebt: updatedDebt
            });
          }
        }
      }

      // 3. Delete the invoice itself
      if (inv.id) {
        await deleteRecord("invoices", inv.id);
      }
      
      await onAddLog('sale', `حذف فاتورة رقم ${inv.invoiceNumber} بقيمة ${inv.total} ج.م`, 0);
      onToast("تم حذف الفاتورة وإرجاع الكميات بنجاح", "success");
      loadInitialData(); // Refresh list and inventory
      setInvoiceToDelete(null);
      return true;
    } catch (e: any) {
      console.error(e);
      onToast(`حدث خطأ أثناء حذف الفاتورة: ${e.message}`, "error");
      return false;
    }
  };

  const handleDeleteInvoice = (inv: Invoice) => {
    setInvoiceToDelete(inv);
  };

  const confirmEditInvoice = async (inv: Invoice) => {
    // Temporarily delete it so we can remake it, skip confirm
    const success = await confirmDeleteInvoice(inv);
    
    if (!success) return;

    // Set cart and customer info
    setCartItems(inv.items);
    setCustomerName(inv.customerName);
    setCustomerPhone(inv.customerPhone || '');
    setDiscountType(inv.discountType);
    setDiscountValue((inv.discountValue || 0).toString());
    setPaymentType(inv.paymentType || 'cash');
    setPaidAmount((inv.paidAmount || 0).toString());
    setNextInvoiceNumber(inv.invoiceNumber); // Keep the exact same invoice number
    
    setInvoiceToEdit(null);
    setViewMode('create');
  };

  const handleEditInvoice = (inv: Invoice) => {
    setInvoiceToEdit(inv);
  };

  // Filtered invoices listing
  const searchedInvoices = invoices.filter(inv => 
    inv.invoiceNumber.toLowerCase().includes(searchInvoiceQuery.toLowerCase()) ||
    inv.customerName.toLowerCase().includes(searchInvoiceQuery.toLowerCase()) ||
    (inv.customerPhone && inv.customerPhone.includes(searchInvoiceQuery))
  );

  return (
    <div className="space-y-6">
      {/* Tab Selectors (Create / History List) */}
      <div className="bg-white p-3 rounded-2xl shadow-xs border border-gray-100 flex gap-2 no-print">
        <button
          onClick={() => setViewMode('create')}
          className={`flex-1 py-3 px-4 font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${viewMode === 'create' ? 'bg-[#2E86AB] text-white shadow-sm' : 'hover:bg-neutral-50 text-gray-500 bg-white'}`}
        >
          <Receipt size={17} />
          إنشاء فاتورة بيع جديدة
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`flex-1 py-3 px-4 font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${viewMode === 'list' ? 'bg-[#2E86AB] text-white shadow-sm' : 'hover:bg-neutral-50 text-gray-500 bg-white'}`}
        >
          <FileText size={17} />
          سجل المبيعات وقائمة الفواتير
        </button>
      </div>

      {viewMode === 'create' ? (
        // POS Cashier GUI
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print" id="pos-billing-area">
          
          {/* Right Part: Cart and Items Selector */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Search Products Segment */}
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-gray-50 pb-2">
                <label className="block text-[#2D3142] text-sm font-black">إضافة السلع بالاسم أو الباركود</label>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Custom Behavior Control Toggle */}
                  <div className="flex bg-neutral-100 rounded-lg p-0.5 border border-gray-250/20 text-[10px] sm:text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDetailsOnScan(true);
                        onToast("تم تفعيل وضع: عرض نافذة التفاصيل والأسعار عن السلعة عند المسح", "success");
                      }}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${openDetailsOnScan ? 'bg-white text-emerald-800 shadow-3xs font-black' : 'text-gray-400 font-medium'}`}
                    >
                      عَرض التفاصيل والأسعار 📋
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDetailsOnScan(false);
                        onToast("تم تفعيل وضع: إضافة فورية سريعة للفاتورة بدفعة واحدة", "success");
                      }}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${!openDetailsOnScan ? 'bg-white text-[#2E86AB] shadow-3xs font-black' : 'text-gray-400 font-medium'}`}
                    >
                      إضافة فورية للفاتورة ⚡
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 rounded-full border border-emerald-100/40 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    القارئ الآلي نشط
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={productSearchInput}
                    onChange={(e) => handleProductSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="ابحث بمسح الباركود، أدخل الرقم أو اسم القطعة..."
                    className="w-full pr-10 pl-4 py-3 border border-gray-200 outline-hidden rounded-xl text-sm focus:border-[#2E86AB] focus:ring-1 focus:ring-[#2E86AB] transition-all"
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center text-gray-400">
                    <Search size={18} />
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (searchInputRef.current) {
                      searchInputRef.current.focus();
                      onToast("تم تثبيت مؤشر الكتابة بخلية الباركود! جاهز للمسح الآن 🔌", "success");
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-3 sm:py-0 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs shrink-0 active:scale-95 cursor-pointer"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  <span>توجيه قارئ الباركود اليدوي 🔌</span>
                </button>
              </div>

              {/* Dynamic Live drop selector results */}
              {searchResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-lg divide-y divide-gray-50 overflow-hidden">
                  {searchResults.map(p => (
                    <div
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="p-3 hover:bg-neutral-50 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-[#2D3142] text-sm">{p.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">التصنيف: {p.category} | الماركة: {p.brand}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <div className="text-sm font-bold font-mono text-[#2E86AB]">{p.sellingPrice} ج.م</div>
                          <div className="text-xs text-gray-400">المخزن متاح: {p.quantity} قطع</div>
                        </div>
                        <button
                          type="button"
                          title="عرض ومعاينة الباركود للمسح السريع"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingBarcodeProduct(p);
                          }}
                          className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg border border-gray-100 transition-colors cursor-pointer active:scale-95 shrink-0"
                        >
                          <Eye size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Current cart items list */}
            <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-neutral-50/50">
                <span className="font-bold text-[#2D3142]">مكونات الفاتورة الحالية</span>
                <span className="text-xs text-gray-400 font-mono font-bold">طُراز: {nextInvoiceNumber}</span>
              </div>

              <div className="divide-y divide-gray-100 min-h-[250px]">
                {cartItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-20 text-gray-400">
                    <Receipt size={48} className="text-gray-300 stroke-1 mb-2 animate-pulse" />
                    <p className="text-sm">الفاتورة فارغة حالياً. ابحث عن منتج بالمنشور أعلاه وأضفه.</p>
                  </div>
                ) : (
                  cartItems.map((item, idx) => (
                    <div key={idx} className="p-4 hover:bg-gray-50/20 transition-all flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm truncate">{item.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded-sm">{item.barcode}</span>
                          <span>|</span>
                          <span className="flex items-center gap-1.5 bg-emerald-50/50 px-2.5 py-1 rounded-lg border border-emerald-100 hover:border-emerald-300 transition-colors group">
                            <span className="text-emerald-700 font-medium flex items-center gap-1"><Edit size={12} className="text-emerald-500" /> السعر:</span> 
                            <div className="relative flex items-center shadow-xs">
                              <input 
                                type="number" 
                                value={item.sellingPrice || ''}
                                onChange={(e) => updateCartPrice(item.barcode, Number(e.target.value))}
                                className="w-20 text-center bg-white border border-emerald-200 focus:border-emerald-500 rounded-md font-mono text-emerald-900 font-black focus:outline-none focus:ring-2 focus:ring-emerald-500/20 py-0.5 transition-all"
                                min={0}
                                step="any"
                              />
                            </div>
                            <span className="text-emerald-600 font-bold text-[10px]">ج.م</span>
                          </span>
                        </div>
                      </div>

                      {/* Quantity Selector */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => updateCartQuantity(item.barcode, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateCartQuantity(item.barcode, Number(e.target.value))}
                          className="w-12 text-center font-mono font-bold focus:outline-hidden text-sm"
                          min={1}
                        />
                        <button
                          onClick={() => updateCartQuantity(item.barcode, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      {/* Total and delete */}
                      <div className="text-left min-w-[90px] shrink-0">
                        <span className="font-mono font-bold text-sm text-gray-800 ml-4">
                          {item.total} ج.م
                        </span>
                        <button
                          onClick={() => removeFromCart(item.barcode)}
                          className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg cursor-pointer transition-colors align-middle"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Left Part: Client information and payment calculations */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 h-fit space-y-4">
            <h3 className="font-bold text-[#2D3142] border-b border-gray-50 pb-2 flex items-center gap-2">
              <Calculator size={18} className="text-[#2E86AB]" />
              الحساب وإتمام الدفعية
            </h3>

            {/* Customer Information (Optional for Cash, required for Debts) */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                  <User size={12} className="text-gray-400" />
                  اسم العميل
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: خالد الحربي"
                  className="w-full px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                  <Phone size={12} className="text-gray-400" />
                  رقم الهاتف (جوال)
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="مثال: 055xxxxxxx"
                  className="w-full px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm font-mono text-right"
                  maxLength={12}
                />
              </div>
            </div>

            {/* Calculations Panel */}
            <div className="space-y-2.5 pt-3 border-t border-gray-50">
              <div className="flex justify-between text-sm text-gray-500">
                <span>المجموع الأولي:</span>
                <span className="font-mono">{calculateSubtotal()} ج.م</span>
              </div>

              {/* Discount selection */}
              <div className="flex items-center gap-2 py-1">
                <span className="text-xs text-gray-500 shrink-0">تطبيق خصم:</span>
                <select
                  value={discountType}
                  onChange={(e: any) => setDiscountType(e.target.value)}
                  className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white text-right cursor-pointer"
                >
                  <option value="percentage">% نسبة مئوية</option>
                  <option value="flat">مبلغ ثابت (ج.م)</option>
                </select>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                  className="w-16 px-2 py-1 border border-gray-200 text-xs font-mono rounded-lg outline-hidden text-center"
                  min={0}
                />
              </div>

              {discountValue > 0 && (
                <div className="flex justify-between text-xs text-rose-500 bg-rose-50 px-2 py-1 rounded-md">
                  <span>قيمة الخصم المستقطع:</span>
                  <span className="font-mono">-{calculateDiscountAmount()} ج.م</span>
                </div>
              )}

              <div className="flex justify-between text-base font-extrabold text-[#2D3142] border-t border-dashed border-gray-100 pt-3">
                <span>الإجمالي النهائي:</span>
                <span className="font-mono text-xl text-[#2E86AB]">{calculateGrandTotal()} ج.م</span>
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div className="space-y-3 pt-3 border-t border-gray-50">
              <span className="block text-xs font-semibold text-gray-500">طريقة الدفع الفاتورة:</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentType('cash')}
                  className={`py-2 px-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${paymentType === 'cash' ? 'bg-[#4CAF50] text-white' : 'bg-neutral-50 text-gray-600 hover:bg-neutral-100'}`}
                >
                  نقدي (كاش)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('credit')}
                  className={`py-2 px-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${paymentType === 'credit' ? 'bg-[#E63946] text-white' : 'bg-neutral-50 text-gray-600 hover:bg-neutral-100'}`}
                >
                  آجل بالكامل
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('partial')}
                  className={`py-2 px-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${paymentType === 'partial' ? 'bg-[#FF9800] text-white' : 'bg-neutral-50 text-gray-600 hover:bg-neutral-100'}`}
                >
                  جزئي / عربون
                </button>
              </div>

              {/* Paid in cash amount input for partial */}
              {paymentType === 'partial' && (
                <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 space-y-2">
                  <label className="block text-xs font-bold text-amber-800">المبلغ المدفوع حالياً:</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-1.5 border border-amber-200 outline-hidden bg-white text-sm font-mono"
                    min={0}
                  />
                  <div className="text-xs text-gray-500 font-medium">
                    المبلغ المتبقي المعلق: {(calculateGrandTotal() - paidAmount) > 0 ? (calculateGrandTotal() - paidAmount).toFixed(2) : 0} ج.م
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">ملاحظات الفاتورة</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أكتب شروط خاصة أو ملاحظات الصانع..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-xs resize-none"
              />
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleSaveInvoice}
                className="w-full bg-[#2E86AB] hover:bg-[#1E2A3A] text-white py-3 transition-colors rounded-xl text-center font-bold text-sm cursor-pointer shadow-xs active:scale-98 flex items-center justify-center gap-1.5"
              >
                <CheckCircle size={18} />
                حفظ وتسجيل الفاتورة
              </button>
            </div>
          </div>
        </div>
      ) : (
        // INVOICES HISTORIC LIST
        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden no-print" id="invoice-history-container">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/50">
            <h3 className="font-bold text-[#2D3142] flex items-center gap-2">
              <Receipt size={18} className="text-[#2E86AB]" />
              أرشيف المبيعات التاريخية
            </h3>
            
            {/* Search filter for past invoices */}
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="ابحث بالرقم، أو اسم المشتري..."
                value={searchInvoiceQuery}
                onChange={(e) => setSearchInvoiceQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 border border-gray-200 outline-hidden bg-white text-xs rounded-xl"
              />
              <span className="absolute inset-y-0 right-3 flex items-center text-gray-300">
                <Search size={14} />
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-neutral-50 text-gray-500 font-semibold border-b border-gray-100">
                <tr>
                  <th className="p-4">رقم الفاتورة (العميل)</th>
                  <th className="p-4">اسم العميل</th>
                  <th className="p-4">التاريخ والوقت</th>
                  <th className="p-4 text-center">طريقة الدفع</th>
                  <th className="p-4 text-left">خصم</th>
                  <th className="p-4 text-left">الخصم الإجمالي</th>
                  <th className="p-4 text-center">خدمة الكاشير</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {searchedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-gray-400">
                      لا تتوفر فواتير مسجلة مطابقة لبحثك.
                    </td>
                  </tr>
                ) : (
                  [...searchedInvoices].reverse().map((inv) => (
                    <tr key={inv.id} className="hover:bg-neutral-50/40 transition-colors">
                      <td className="p-4 font-mono font-bold text-[#2E86AB]">{inv.invoiceNumber}</td>
                      <td className="p-4">
                        <div className="font-bold text-gray-800">{inv.customerName}</div>
                        {inv.customerPhone && <div className="text-xs font-mono text-gray-400 mt-0.5">{inv.customerPhone}</div>}
                      </td>
                      <td className="p-4 text-xs font-mono text-gray-500">{inv.date}</td>
                      <td className="p-4 text-center">
                        {inv.paymentType === 'cash' && (
                          <span className="text-xs bg-emerald-50 text-[#4CAF50] px-2 py-1 rounded-md">نقدي</span>
                        )}
                        {inv.paymentType === 'credit' && (
                          <span className="text-xs bg-rose-100/50 text-[#E63946] px-2 py-1 rounded-md">آجل</span>
                        )}
                        {inv.paymentType === 'partial' && (
                          <span className="text-xs bg-amber-50 text-[#FF9800] px-2 py-1 rounded-md">جزئي</span>
                        )}
                      </td>
                      <td className="p-4 text-left font-mono text-xs text-rose-500">
                        {inv.discountValue > 0 ? (inv.discountType === 'percentage' ? `%${inv.discountValue}` : `${inv.discountValue} .ج.م`) : '0'}
                      </td>
                      <td className="p-4 text-left font-mono text-[#2D3142] font-bold">
                        {inv.total.toLocaleString('en-US')} ج.م
                      </td>
                      <td className="p-4 text-center text-xs text-gray-400">
                        {inv.username}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleInspectReceipt(inv)}
                            title="معاينة وطباعة"
                            className="p-1.5 hover:bg-[#2E86AB]/10 text-[#2E86AB] rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleEditInvoice(inv)}
                            title="تعديل الفاتورة"
                            className="p-1.5 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit size={16} />
                          </button>
                          {currentUser?.role === 'admin' && (
                            <button
                              onClick={() => handleDeleteInvoice(inv)}
                              title="حذف الفاتورة"
                              className="p-1.5 hover:bg-rose-100 text-rose-500 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL / OVERLAY: Active Printable Invoice Receipt */}
      {activeReceipt && (
        <div 
          onClick={() => setActiveReceipt(null)}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 no-print"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 text-right animate-in fade-in duration-150"
          >
            {/* Modal Actions Bar */}
            <div className="bg-[#1E2A3A] p-4 text-white flex items-center justify-between">
              <span className="font-bold flex items-center gap-1">
                <Receipt size={18} className="text-[#A8DADC]" />
                تفاصيل الفاتورة ومُعاينتها {activeReceipt.invoiceNumber}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-[#2E86AB] hover:bg-[#2E86AB]/80 text-white rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1 shadow-sm transition-all"
                >
                  <Printer size={14} />
                  طباعة الفاتورة
                </button>
                <button
                  onClick={() => setActiveReceipt(null)}
                  className="p-1 px-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-all text-xs"
                >
                  إغلاق
                </button>
              </div>
            </div>

            {/* Simulated Receipt Preview for user inspection */}
            <div className="p-4 sm:p-8 space-y-6 overflow-y-auto max-h-[75vh]" style={{ direction: 'rtl' }}>
              <div className="border border-neutral-100 p-4 sm:p-6 rounded-xl bg-neutral-50 space-y-6">
                
                {/* Store Branding Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-gray-200 pb-4">
                  <div>
                    <div className="flex items-center gap-2 text-[#2D3142]">
                      <div className="bg-[#2D3142] text-white p-1.5 rounded-lg shadow-sm">
                        <StoreIcon size={20} />
                      </div>
                      <h2 className="font-black text-2xl tracking-tighter">{shopSettings.storeName}</h2>
                    </div>
                    {shopSettings.invoiceSubtitle && (
                      <p className="font-bold text-sm mt-1 text-gray-700">
                        {shopSettings.invoiceSubtitle} 
                        {shopSettings.invoiceSubtitle2 && <span className="font-normal text-xs"> ({shopSettings.invoiceSubtitle2})</span>}
                      </p>
                    )}
                    
                    <div className="text-gray-600 font-mono text-xs mt-3 space-y-1">
                      {shopSettings.invoicePhone1 && <div>{shopSettings.invoicePhone1}</div>}
                      {shopSettings.invoicePhone2 && <div>{shopSettings.invoicePhone2}</div>}
                      {shopSettings.storeAddress && <div className="text-gray-500 font-sans mt-1">العنوان: {shopSettings.storeAddress}</div>}
                    </div>
                  </div>
                  <div className="text-left bg-white p-3 rounded-xl border border-gray-100 shadow-xs font-mono text-[11px] text-gray-500">
                    <div className="mb-2 text-[#2E86AB] font-bold text-xs font-sans text-center border-b border-gray-100 pb-2">معاينة فاتورة المبيعات</div>
                    <div className="mt-2">رقم الحساب: <span className="font-bold text-gray-900">{activeReceipt.invoiceNumber}</span></div>
                    <div>التاريخ: {activeReceipt.date}</div>
                    <div>المسؤول: {activeReceipt.username}</div>
                  </div>
                </div>

                {/* Client info box */}
                <div className="bg-white p-3 rounded-xl border border-gray-100 text-xs text-gray-600 space-y-1">
                  <div><b>باسم السادة (العميل):</b> {activeReceipt.customerName}</div>
                  {activeReceipt.customerPhone && (
                    <div><b>رقم هاتف العميل:</b> <span className="font-mono">{activeReceipt.customerPhone}</span></div>
                  )}
                  <div><b>طريقة الدفع:</b> {
                    activeReceipt.paymentType === 'cash' ? 'سداد نقدي مسبق (كامل)' : 
                    activeReceipt.paymentType === 'credit' ? 'آجل على دفتر المديونيات' : 'دَفعة جزئية وباقي المديونية'
                  }</div>
                </div>

                {/* Itemized Grid */}
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-400 font-bold">
                      <th className="py-2">اسم قطعة الغيار</th>
                      <th className="py-2 text-center">الكمية</th>
                      <th className="py-2 text-left">سعر الوحدة</th>
                      <th className="py-2 text-left">المجموع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-[#2D3142]">
                    {activeReceipt.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5">
                          <p className="font-bold">{item.name}</p>
                          <span className="font-mono text-[10px] text-gray-400">{item.barcode}</span>
                        </td>
                        <td className="py-2.5 text-center font-mono">{item.quantity}</td>
                        <td className="py-2.5 text-left font-mono">{item.sellingPrice} ج.م</td>
                        <td className="py-2.5 text-left font-mono font-bold">{item.total} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals box */}
                <div className="border-t border-gray-200 pt-3 space-y-1.5 text-xs text-[#2D3142]">
                  <div className="flex justify-between">
                    <span className="text-gray-400">إجمالي السلع الأولي:</span>
                    <span className="font-mono">{activeReceipt.subtotal} ج.م</span>
                  </div>
                  {activeReceipt.discountAmount > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>الخصم المطبق:</span>
                      <span className="font-mono">-{activeReceipt.discountAmount} ج.م</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm border-t border-dashed border-gray-200 pt-2 text-[#2E86AB]">
                    <span>صافي القيمة المستحقة:</span>
                    <span className="font-mono text-base">{activeReceipt.total} ج.م</span>
                  </div>

                  {activeReceipt.paymentType !== 'cash' && (
                    <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-100 mt-2 text-[11px] space-y-1">
                      <div className="flex justify-between text-amber-900 font-semibold">
                        <span>المبلغ المدفوع:</span>
                        <span className="font-mono">{activeReceipt.paidAmount} ج.م</span>
                      </div>
                      <div className="flex justify-between text-[#E63946] font-bold">
                        <span>المبلغ المعلق (المتبقي):</span>
                        <span className="font-mono">{activeReceipt.remainingAmount} ج.م</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Print Welcome text */}
                <div className="border-t border-gray-200 pt-4 text-center text-gray-400 text-[10px] space-y-1">
                  <p>{shopSettings.welcomeText}</p>
                  <p className="font-bold">نظام دقيق لإدارة المبيعات وفواتير قطع الغيار</p>
                </div>

                {/* Signature space */}
                <div className="flex justify-between pt-6 text-[10px] text-gray-400 px-6">
                  <div className="text-center font-bold">
                    <span>توقيع العميل المستلم</span>
                    <div className="h-10 w-24 border-b border-gray-200 mt-2" />
                  </div>
                  <div className="text-center font-bold">
                    <span>ختم وتوقيع المحل</span>
                    <div className="h-10 w-24 border-b border-gray-200 mt-2" />
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
                     ACTUAL WEB PRINT TEMPLATE (HIDDEN UNTIL PRINTING IS ACTIVATED)
         ========================================================================= */}
      {activeReceipt && (
        <div className="print-only" style={{ direction: 'rtl', padding: '10px' }}>
          {shopSettings.paperSize === '80mm' ? (
            // 80mm Receipt layout
            <div style={{ width: '74mm', margin: '0 auto', fontFamily: 'Tajawal, sans-serif', fontSize: '11px', color: '#000000' }}>
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <div style={{ backgroundColor: '#000', color: '#fff', padding: '4px', borderRadius: '4px' }}>
                      <StoreIcon size={16} strokeWidth={2.5} />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: '900', margin: '0' }}>{shopSettings.storeName}</h2>
                  </div>
                  {shopSettings.invoiceSubtitle && (
                    <h3 style={{ fontSize: '12px', fontWeight: 'bold', margin: '0' }}>{shopSettings.invoiceSubtitle} {shopSettings.invoiceSubtitle2 && <span style={{ fontWeight: 'normal', fontSize: '10px' }}>({shopSettings.invoiceSubtitle2})</span>}</h3>
                  )}
                </div>
                <div style={{ fontSize: '10px', marginBottom: '8px', lineHeight: '1.4' }}>
                  {(shopSettings.invoicePhone1 || shopSettings.invoicePhone2) && (
                    <div>{shopSettings.invoicePhone1} {shopSettings.invoicePhone1 && shopSettings.invoicePhone2 ? ' | ' : ''} {shopSettings.invoicePhone2}</div>
                  )}
                  {shopSettings.storeAddress && <div style={{ marginTop: '2px' }}>العنوان: {shopSettings.storeAddress}</div>}
                </div>
                <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }}></div>
                <h3 style={{ fontSize: '12px', fontWeight: 'bold', margin: '4px 0' }}>فاتورة مبيعات مبسطة</h3>
                <p style={{ margin: '2px 0', fontSize: '10px', fontFamily: 'monospace' }}>رقم الفاتورة: {activeReceipt.invoiceNumber}</p>
                <p style={{ margin: '2px 0', fontSize: '10px', fontFamily: 'monospace' }}>التاريخ: {activeReceipt.date}</p>
                <p style={{ margin: '2px 0', fontSize: '10px' }}>الكاشير: {activeReceipt.username}</p>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }}></div>

              {/* Client info */}
              <div style={{ marginBottom: '8px', fontSize: '10px' }}>
                <div><strong>العميل:</strong> {activeReceipt.customerName}</div>
                {activeReceipt.customerPhone && <div><strong>هاتف:</strong> {activeReceipt.customerPhone}</div>}
                <div><strong>نوع الدفع:</strong> {
                  activeReceipt.paymentType === 'cash' ? 'نقدي' : 
                  activeReceipt.paymentType === 'credit' ? 'آجل ذمة' : 'جزئي (عربون)'
                }</div>
              </div>

              <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <th style={{ padding: '4px 0' }}>البيان</th>
                    <th style={{ padding: '4px 0', textCenter: 'center' }}>الكمية</th>
                    <th style={{ padding: '4px 0', textAlign: 'left' }}>المجموع</th>
                  </tr>
                </thead>
                <tbody>
                  {activeReceipt.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px 0' }}>
                        <div><strong>{item.name}</strong></div>
                        <div style={{ fontSize: '8px', color: '#555' }}>{item.barcode} × {item.sellingPrice} ج.م</div>
                      </td>
                      <td style={{ padding: '6px 0', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '6px 0', textAlign: 'left' }}>{item.total} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }}></div>

              <div style={{ fontSize: '10px', spaceY: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>المجموع الفرعي:</span>
                  <span>{activeReceipt.subtotal} ج.م</span>
                </div>
                {activeReceipt.discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e53e3e' }}>
                    <span>الخصم المطبق:</span>
                    <span>-{activeReceipt.discountAmount} ج.م</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', marginTop: '4px' }}>
                  <span>الإجمالي الصافي:</span>
                  <span>{activeReceipt.total} ج.م</span>
                </div>

                {activeReceipt.paymentType !== 'cash' && (
                  <div style={{ border: '1px solid #000', padding: '4px', marginTop: '6px', fontSize: '9px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>المبلغ دُفِع:</span>
                      <span>{activeReceipt.paidAmount} ج.م</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <span>المتبقي الآجل:</span>
                      <span>{activeReceipt.remainingAmount} ج.م</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }}></div>

              <p style={{ textAlign: 'center', fontSize: '9px', margin: '6px 0' }}>{shopSettings.welcomeText}</p>
              <p style={{ textAlign: 'center', fontSize: '8px', color: '#333' }}>{shopSettings.storeName} - نظام نقاط البيع المتكامل</p>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '10px' }}>
                <Barcode value={activeReceipt.invoiceNumber} height={28} width={1.2} displayValue={false} />
                <span style={{ fontSize: '9px', fontFamily: 'monospace', fontWeight: 'bold', marginTop: '2px' }}>{activeReceipt.invoiceNumber}</span>
              </div>
            </div>
          ) : (
            // A4 Portrait invoice layout
            <div style={{ width: '100%', maxWidth: '210mm', padding: '20px', fontFamily: 'Tajawal, sans-serif' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: '15px', marginBottom: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ backgroundColor: '#000', color: '#fff', padding: '6px', borderRadius: '6px' }}>
                      <StoreIcon size={24} strokeWidth={2.5} />
                    </div>
                    <h1 style={{ fontSize: '32px', fontWeight: '900', margin: '0', letterSpacing: '-0.5px' }}>{shopSettings.storeName}</h1>
                  </div>
                  {shopSettings.invoiceSubtitle && (
                    <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#333' }}>{shopSettings.invoiceSubtitle}</h2>
                  )}
                  {shopSettings.invoiceSubtitle2 && (
                    <p style={{ fontSize: '14px', margin: '0 0 8px 0', fontWeight: 'bold', color: '#555' }}>{shopSettings.invoiceSubtitle2}</p>
                  )}
                  
                  <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                    {(shopSettings.invoicePhone1 || shopSettings.invoicePhone2) && (
                      <div><strong>التواصل:</strong> {shopSettings.invoicePhone1} {shopSettings.invoicePhone1 && shopSettings.invoicePhone2 ? ' | ' : ''} {shopSettings.invoicePhone2}</div>
                    )}
                    {shopSettings.storeAddress && <div><strong>العنوان:</strong> {shopSettings.storeAddress}</div>}
                  </div>
                </div>
                
                <div style={{ textAlign: 'left', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', margin: '0 0 10px 0', textAlign: 'center' }}>فاتورة المبيعات</h2>
                  <p style={{ margin: '4px 0', fontSize: '12px' }}><strong>رقم الفاتورة:</strong> <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>{activeReceipt.invoiceNumber}</span></p>
                  <p style={{ margin: '4px 0', fontSize: '12px' }}><strong>التاريخ والوقت:</strong> {activeReceipt.date}</p>
                  <p style={{ margin: '4px 0', fontSize: '12px' }}><strong>الكاشير المسؤول:</strong> {activeReceipt.username}</p>
                </div>
              </div>

              <div style={{ borderTop: '2px solid #1e2a3a', borderBottom: '2px solid #1e2a3a', padding: '10px 0', marginBottom: '20px' }}>
                <table style={{ width: '100%', fontSize: '12px' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '50%' }}><strong>الفاتورة صادرة للسادة:</strong> {activeReceipt.customerName}</td>
                      <td><strong>هاتف العميل:</strong> {activeReceipt.customerPhone || 'غير متوفر'}</td>
                    </tr>
                    <tr>
                      <td><strong>طريقة الدفع:</strong> {
                        activeReceipt.paymentType === 'cash' ? 'نقدي بالكامل' : 
                        activeReceipt.paymentType === 'credit' ? 'آجل (ذمم)' : 'جزئي وسحب المتبقي آجل'
                      }</td>
                      <td><strong>حالة التحصيل:</strong> {activeReceipt.remainingAmount > 0 ? 'معلقة السداد' : 'مدفوعة بالكامل'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '25px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e2a3a', color: '#ffffff', textAlign: 'right' }}>
                    <th style={{ padding: '8px', border: '1px solid #ddd' }}>الباركود</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd' }}>اسم قطعة الغيار كود الصنع</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>الكمية المطلوبة</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>سعر الوحدة</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {activeReceipt.items.map((item, index) => (
                    <tr key={index}>
                      <td style={{ padding: '8px', border: '1px solid #ddd', fontFamily: 'monospace' }}>{item.barcode}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.name}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>{item.sellingPrice} ج.م</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left', fontWeight: 'bold' }}>{item.total} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <table style={{ width: '300px', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '6px 0', borderBottom: '1px solid #eee' }}>المجموع الأولي:</td>
                      <td style={{ padding: '6px 0', textAlign: 'left', borderBottom: '1px solid #eee' }}>{activeReceipt.subtotal} ج.م</td>
                    </tr>
                    {activeReceipt.discountAmount > 0 && (
                      <tr>
                        <td style={{ padding: '6px 0', borderBottom: '1px solid #eee', color: '#e63946' }}>الخصم المستقطع:</td>
                        <td style={{ padding: '6px 0', textAlign: 'left', borderBottom: '1px solid #eee', color: '#e63946' }}>-{activeReceipt.discountAmount} ج.م</td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: '8px 0', fontWeight: 'bold', fontSize: '14px' }}>صافي إجمالي المستحق:</td>
                      <td style={{ padding: '8px 0', textAlign: 'left', fontWeight: 'bold', fontSize: '16px', color: '#2e86ab' }}>{activeReceipt.total} ج.م</td>
                    </tr>
                    {activeReceipt.paymentType !== 'cash' && (
                      <>
                        <tr style={{ color: '#555' }}>
                          <td style={{ padding: '4px 0' }}>المبلغ المدفوع:</td>
                          <td style={{ padding: '4px 0', textAlign: 'left' }}>{activeReceipt.paidAmount} ج.م</td>
                        </tr>
                        <tr style={{ color: '#e63946', fontWeight: 'bold' }}>
                          <td style={{ padding: '4px 0' }}>المتبقي في الدفتر الآجل:</td>
                          <td style={{ padding: '4px 0', textAlign: 'left' }}>{activeReceipt.remainingAmount} ج.م</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ borderTop: '1px solid #eee', marginTop: '30px', paddingTop: '15px', color: '#777', fontSize: '10px', textAlign: 'center' }}>
                <p>{shopSettings.welcomeText}</p>
                <p>الأنظمة البرمجية المتكاملة لإدارة قطع غيار ومستلزمات السيارات</p>
              </div>

              <table style={{ width: '100%', marginTop: '50px', fontSize: '11px', textAlign: "center" }}>
                <tbody>
                  <tr>
                    <td style={{ width: '50%' }}>
                      <div>توقيع العميل المستلم</div>
                      <div style={{ borderBottom: '1px solid #ddd', width: '150px', margin: '20px auto 0 auto', height: '10px' }}></div>
                    </td>
                    <td>
                      <div>ختم وتوقيع محل قطع الغيار</div>
                      <div style={{ borderBottom: '1px solid #ddd', width: '150px', margin: '20px auto 0 auto', height: '10px' }}></div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '30px' }}>
                <Barcode value={activeReceipt.invoiceNumber} height={36} width={1.5} displayValue={false} />
                <span style={{ fontSize: '10.5px', fontFamily: 'monospace', fontWeight: 'bold', marginTop: '3px', letterSpacing: '2px' }}>{activeReceipt.invoiceNumber}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. Camera Barcode scanner view */}
      {isCameraOpen && (
        <CameraScanner
          onScanSuccess={handleCameraScanSuccess}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {/* 2. Product Detail Viewer popup on scan */}
      {scannedProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs no-print" dir="rtl">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full border border-gray-100 flex flex-col transform transition-all">
            
            {/* Header banner */}
            <div className="bg-linear-to-r from-emerald-600 to-[#2E86AB] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BadgeInfo size={22} className="text-emerald-200" />
                <div>
                  <h3 className="font-extrabold text-white text-base">سلعة ممسوحة ضوئياً</h3>
                  <p className="text-white/80 text-[11px] font-medium">تفاصيل السلعة المذكورة ببطاقة الباركود</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScannedProduct(null)}
                className="bg-white/15 hover:bg-white/25 rounded-full p-1.5 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              
              {/* Product title & code */}
              <div className="border-b border-gray-150 pb-4 text-center">
                <span className="bg-[#2E86AB]/10 text-[#2E86AB] px-3 py-1 rounded-full text-xs font-bold inline-block mb-2">
                  {scannedProduct.category || 'مستلزمات عامة'}
                </span>
                <h4 className="text-lg font-black text-gray-800 leading-tight">{scannedProduct.name}</h4>
                <div className="mt-3 flex justify-center">
                  <Barcode value={scannedProduct.barcode} height={42} width={1.6} displayValue={true} />
                </div>
              </div>

              {/* Grid specifications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-neutral-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-500 block">العلامة التجارية / الماركة</span>
                  <span className="font-bold text-gray-800 text-sm">{scannedProduct.brand || 'غير محدد'}</span>
                </div>
                <div className="bg-neutral-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-500 block">التوافق مع السيارات</span>
                  <span className="font-bold text-[#2E86AB] text-xs">{scannedProduct.carCompatibility || 'جميع السيارات'}</span>
                </div>
                <div className="bg-neutral-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-500 block">موقع الرف في المحل</span>
                  <span className="font-bold text-gray-800 text-sm">{scannedProduct.location || 'المستودع الرئيسي'}</span>
                </div>
                <div className="bg-neutral-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-500 block">المخزون المتوفر لدينا</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${scannedProduct.quantity <= 0 ? 'bg-red-500' : scannedProduct.quantity <= scannedProduct.minStock ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                    <span className="font-bold text-gray-800 text-sm">
                      {scannedProduct.quantity} قطعة
                    </span>
                    {scannedProduct.quantity <= 0 && <span className="text-[9px] text-red-500 font-extrabold">(نفذ!)</span>}
                  </div>
                </div>
              </div>

              {/* Financial Box */}
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-800 font-bold block">سعر البيع للقطعة</span>
                  <span className="text-2xl font-black text-emerald-700">
                    {scannedProduct.sellingPrice} <span className="text-xs font-bold">ج.م</span>
                  </span>
                </div>
                
                {currentUser?.role === 'admin' && (
                  <div className="text-left border-r border-emerald-200/50 pr-4">
                    <span className="text-[10px] text-gray-500 block">سعر الشراء (تكلفتها)</span>
                    <span className="text-sm font-bold text-gray-700">
                      {scannedProduct.purchasePrice} ج.م
                    </span>
                  </div>
                )}
              </div>

              {/* Add quantites to current sales cart */}
              {scannedProduct.quantity > 0 ? (
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-blue-900 block">الكمية المطلوبة للبيع ومصادقتها للفاتورة:</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPopupQuantityToAdd(prev => Math.max(1, prev - 1))}
                        className="w-7 h-7 bg-white border border-gray-200 text-gray-600 rounded-lg flex items-center justify-center font-bold text-lg active:scale-95 cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={scannedProduct.quantity}
                        value={popupQuantityToAdd}
                        onChange={(e) => setPopupQuantityToAdd(Math.min(scannedProduct.quantity, Math.max(1, Number(e.target.value) || 1)))}
                        className="w-14 text-center font-bold bg-white border border-gray-200 rounded-lg py-1 text-sm outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setPopupQuantityToAdd(prev => Math.min(scannedProduct.quantity!, prev + 1))}
                        className="w-7 h-7 bg-white border border-gray-200 text-gray-600 rounded-lg flex items-center justify-center font-bold text-lg active:scale-95 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between text-xs text-blue-900 border-t border-blue-100/50 pt-2 font-bold">
                    <span>إجمالي حساب القطعة:</span>
                    <span>{scannedProduct.sellingPrice * popupQuantityToAdd} ج.م</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 text-center font-bold text-xs">
                  عذراً، لا يمكن البيع بسبب عدم توفر كمية بالمخزون! قم بزيادة كمية السلعة أولاً.
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="bg-neutral-50 p-4 border-t border-gray-100 flex gap-2">
              <button
                type="button"
                onClick={() => setScannedProduct(null)}
                className="flex-1 py-3 bg-white hover:bg-neutral-100 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                رجوع وإغلاق
              </button>

              {scannedProduct.quantity > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const qty = popupQuantityToAdd;
                    const existing = cartItems.find(item => item.barcode === scannedProduct.barcode);
                    if (existing) {
                      setCartItems(cartItems.map(item => 
                        item.barcode === scannedProduct.barcode 
                          ? { ...item, quantity: Math.min(scannedProduct.quantity, item.quantity + qty), total: Math.min(scannedProduct.quantity, item.quantity + qty) * item.sellingPrice }
                          : item
                      ));
                    } else {
                      const newItem: InvoiceItem = {
                        barcode: scannedProduct.barcode,
                        name: scannedProduct.name,
                        quantity: qty,
                        sellingPrice: scannedProduct.sellingPrice,
                        total: scannedProduct.sellingPrice * qty
                      };
                      setCartItems([...cartItems, newItem]);
                    }
                    setScannedProduct(null);
                    onToast(`تم إضافة ${qty} من [${scannedProduct.name}] للفاتورة`, "success");
                    playScanBeep();
                  }}
                  className="flex-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <ShoppingBag size={15} />
                  <span>تأكيد الإضافة للفاتورة ({scannedProduct.sellingPrice * popupQuantityToAdd} ج.م)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Barcode Not Found - Quick Product Registration on sales page */}
      {scannedBarcodeNotFound && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs no-print" dir="rtl">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-xl w-full border border-gray-100 flex flex-col transform transition-all">
            
            {/* Header banner */}
            <div className="bg-linear-to-r from-orange-500 to-amber-600 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={22} className="text-orange-200" />
                <div>
                  <h3 className="font-extrabold text-white text-base">الباركود غير مسجل في مستودعك!</h3>
                  <p className="text-white/80 text-[11px] font-medium">هل ترغب في تسجيل قطعة جديدة سريعة وتثبيتها الآن مباشرة للبيعة؟</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScannedBarcodeNotFound('')}
                className="bg-white/15 hover:bg-white/25 rounded-full p-1.5 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Context/Form Body */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              
              {/* Highlight scanned Barcode info */}
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100/70 text-right space-y-1">
                <span className="text-[10px] text-amber-800 font-extrabold block">رقم كود الباركود الملتقط الكاميرا:</span>
                <span className="font-mono text-base font-black text-amber-700 tracking-wider inline-block">
                  {scannedBarcodeNotFound}
                </span>
                <p className="text-[10px] text-gray-500">منظومة قطع الغيار لا تحتوي على قطعة مرتبطة برقم الباركود هذا مسبقاً.</p>
              </div>

              {/* Simple grid fields */}
              <div className="space-y-3.5">
                <div>
                  <label className="block text-gray-750 text-xs font-extrabold mb-1">اسم قطعة الغيار / المنتج الجديد *</label>
                  <input
                    type="text"
                    required
                    value={quickAddName}
                    onChange={(e) => setQuickAddName(e.target.value)}
                    placeholder="مثال: فحمات فرامل أمامية كورولا 2018..."
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs outline-hidden focus:border-orange-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-750 text-xs font-extrabold mb-1">الماركة / العلامة التجارية</label>
                    <input
                      type="text"
                      value={quickAddBrand}
                      onChange={(e) => setQuickAddBrand(e.target.value)}
                      placeholder="امثلة: تويوتا، بوش، كوري..."
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs outline-hidden focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-750 text-xs font-extrabold mb-1">السيارات المتوافقة</label>
                    <input
                      type="text"
                      value={quickAddCarCompatibility}
                      onChange={(e) => setQuickAddCarCompatibility(e.target.value)}
                      placeholder="امثلة: كورولا 2014-2019"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs outline-hidden focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-750 text-xs font-extrabold mb-1">تصنيف القطعة رئيسياً</label>
                    <select
                      value={quickAddCategory}
                      onChange={(e) => setQuickAddCategory(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs outline-hidden bg-white focus:border-orange-500"
                    >
                      <option value="قطع ميكانيكية">قطع ميكانيكية</option>
                      <option value="فرامل وهوب">فرامل وهوب</option>
                      <option value="فلاتر وزيوت">فلاتر وزيوت</option>
                      <option value="كهرباء وحساسات">كهرباء وحساسات</option>
                      <option value="قطع تبريد ومكيف">قطع تبريد ومكيف</option>
                      <option value="شاسيه ومساعدات">شاسيه ومساعدات</option>
                      <option value="إكسسوارات وعمومي">إكسسوارات وعمومي</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-750 text-xs font-extrabold mb-1">موقع تخزين الرف</label>
                    <input
                      type="text"
                      value={quickAddLocation}
                      onChange={(e) => setQuickAddLocation(e.target.value)}
                      placeholder="امثلة: رف م-5، درج ب-1"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs outline-hidden focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-neutral-50 rounded-2xl border border-gray-100 space-y-3">
                  <span className="text-[10px] text-gray-500 font-extrabold block">الأسعار والكميات المخزنية:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-gray-650 text-[10px] font-bold mb-1">سعر التكلفة الشراء</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={quickAddPurchasePrice}
                        onChange={(e) => setQuickAddPurchasePrice(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-hidden focus:border-orange-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-650 text-[10px] font-bold mb-1">سعر البيع الاجباري *</label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.01"
                        required
                        value={quickAddSellingPrice}
                        onChange={(e) => setQuickAddSellingPrice(e.target.value)}
                        className="w-full px-2 py-1.5 border border-orange-200 rounded-lg text-xs bg-orange-50/20 font-bold focus:border-orange-500 text-orange-900"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-650 text-[10px] font-bold mb-1">عدد مخزون البداية</label>
                      <input
                        type="number"
                        min="1"
                        value={quickAddQuantity}
                        onChange={(e) => setQuickAddQuantity(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-hidden focus:border-orange-500 text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-650 text-[10px] font-bold mb-1">حد المخزون الأدنى</label>
                      <input
                        type="number"
                        min="1"
                        value={quickAddMinStock}
                        onChange={(e) => setQuickAddMinStock(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-hidden focus:border-orange-500 text-center font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fast actions */}
            <div className="bg-neutral-50 p-4 border-t border-gray-100 flex gap-2">
              <button
                type="button"
                onClick={() => setScannedBarcodeNotFound('')}
                className="flex-1 py-3 bg-white hover:bg-neutral-100 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                تخطي وإغلاق
              </button>
              <button
                type="button"
                onClick={handleQuickAddProduct}
                className="flex-2 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-extrabold transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus size={15} />
                <span>تسجيل السلعة فوراً وإضافتها للبيع</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. POPUP: Proportional Barcode Projection for Screen Scanning */}
      {viewingBarcodeProduct && (
        <div 
          onClick={() => {
            setViewingBarcodeProduct(null);
            setTimeout(() => searchInputRef.current?.focus(), 80);
          }}
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-55 p-4 backdrop-blur-xs no-print" dir="rtl"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full border border-gray-100 flex flex-col transform transition-all animate-in fade-in zoom-in duration-150"
          >
            {/* Header banner */}
            <div className="bg-linear-to-r from-[#205072] to-[#2E86AB] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-white/10 p-2 rounded-xl">
                  <Eye className="text-emerald-300 animate-pulse" size={20} />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">معاينة الباركود للمسح السريع</h3>
                  <p className="text-white/80 text-[11px] font-medium">وجه قارئ الباركود اليدوي لشاشة الكومبيوتر مباشرة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewingBarcodeProduct(null);
                  setTimeout(() => searchInputRef.current?.focus(), 85);
                }}
                className="bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 text-center space-y-5">
              <div>
                <span className="bg-[#2E86AB]/10 text-[#2E86AB] px-3 py-1 rounded-full text-[10px] font-extrabold inline-block mb-1.5">
                  فئة {viewingBarcodeProduct.category || 'مستلزمات عامة'}
                </span>
                <h4 className="text-base font-black text-gray-800 leading-tight">{viewingBarcodeProduct.name}</h4>
                <p className="text-[11px] text-gray-400 mt-1">الماركة: {viewingBarcodeProduct.brand || 'أصلي'} | توافق السيارات: {viewingBarcodeProduct.carCompatibility || 'عام'}</p>
              </div>

              {/* Barcode SVG Projector */}
              <div className="bg-white border border-neutral-100 p-5 sm:p-8 rounded-2xl shadow-inner flex flex-col items-center justify-center">
                <div className="bg-white p-3 rounded-xl border border-dashed border-neutral-200 scale-110">
                  <Barcode value={viewingBarcodeProduct.barcode} height={65} width={2.2} displayValue={false} />
                </div>
                <span className="font-mono text-sm tracking-widest text-[#2D3142] bg-neutral-100 px-3 py-1 rounded-md mt-4 font-black border border-neutral-200 shadow-2xs">
                  {viewingBarcodeProduct.barcode}
                </span>
                <p className="mt-3 text-[10.5px] text-emerald-600 font-extrabold animate-pulse bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-500/10">
                  ⚡ بمجرد رصد المسدس للرمز، ستفتح فوراً نافذة تعيين الكمية والبيع!
                </p>
              </div>

              {/* Meta price info */}
              <div className="bg-neutral-50 p-3 rounded-xl border border-gray-100 flex justify-between items-center text-right text-xs">
                <div>
                  <span className="text-gray-400 block font-bold">سعر البيع المعتمد</span>
                  <span className="text-base font-black text-emerald-600">{viewingBarcodeProduct.sellingPrice} ج.م</span>
                </div>
                <div className="text-left">
                  <span className="text-gray-400 block font-bold font-sans">الكمية المتوفرة حالياً</span>
                  <span className={`text-xs font-black ${viewingBarcodeProduct.quantity <= 0 ? 'text-red-500' : 'text-gray-700'}`}>{viewingBarcodeProduct.quantity} حبة بالرف</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-neutral-50 p-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setViewingBarcodeProduct(null);
                  setTimeout(() => searchInputRef.current?.focus(), 80);
                }}
                className="w-full py-3 bg-white hover:bg-neutral-105 border border-gray-200 text-gray-750 font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إغلاق نافذة المعاينة والمسح
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: Delete Invoice Confirmation */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100 flex flex-col">
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
              <Trash2 className="text-rose-500" size={20} />
              <h3 className="font-bold text-rose-700">تأكيد حذف الفاتورة</h3>
            </div>
            <div className="p-5 text-sm text-gray-600 font-medium leading-relaxed">
              هل أنت متأكد من حذف الفاتورة رقم <span className="font-bold text-gray-900">{invoiceToDelete.invoiceNumber}</span> بشكل نهائي؟
              <br /><br />
              - سيتم إرجاع كميات المخزون للرفوف.
              <br />
              - سيتم تصحيح وتعديل المديونية إن وجدت.
            </div>
            <div className="p-4 bg-neutral-50 flex gap-2 justify-end">
              <button
                onClick={() => setInvoiceToDelete(null)}
                className="px-4 py-2 border border-gray-200 text-gray-500 font-bold rounded-lg text-sm hover:bg-white transition-colors cursor-pointer"
              >
                إلغاء التراجع
              </button>
              <button
                onClick={() => confirmDeleteInvoice(invoiceToDelete)}
                className="px-4 py-2 bg-rose-500 text-white font-bold rounded-lg text-sm hover:bg-rose-600 shadow-md shadow-rose-500/20 transition-all cursor-pointer"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Invoice Confirmation */}
      {invoiceToEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100 flex flex-col">
            <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
              <Edit className="text-amber-600" size={20} />
              <h3 className="font-bold text-amber-700">تأكيد التعديل والإرجاع</h3>
            </div>
            <div className="p-5 text-sm text-gray-600 font-medium leading-relaxed">
              تعديل الفاتورة سيقوم بإلغائها وإرجاع منتجاتها لشاشة البيع مرة أخرى لتتمكن من التعديل عليها وحفظها، هل توافق؟
            </div>
            <div className="p-4 bg-neutral-50 flex gap-2 justify-end">
              <button
                onClick={() => setInvoiceToEdit(null)}
                className="px-4 py-2 border border-gray-200 text-gray-500 font-bold rounded-lg text-sm hover:bg-white transition-colors cursor-pointer"
              >
                إلغاء التراجع
              </button>
              <button
                onClick={() => confirmEditInvoice(invoiceToEdit)}
                className="px-4 py-2 bg-amber-500 text-white font-bold rounded-lg text-sm hover:bg-amber-600 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                موافق، قم بالتعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
