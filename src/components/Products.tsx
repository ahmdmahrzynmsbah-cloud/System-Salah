import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Printer, 
  Edit, 
  Trash2, 
  X,
  Tag,
  AlertTriangle,
  Layers,
  MapPin,
  ClipboardList,
  Eye
} from 'lucide-react';
import { 
  getAllRecords, 
  addRecord, 
  updateRecord, 
  deleteRecord, 
  subscribeToStore,
  Product, 
  Transaction 
} from '../db';
import { Barcode } from './Barcode';

interface ProductsProps {
  onAddLog: (type: 'sale' | 'debt_payment' | 'add_stock' | 'edit_price' | 'system', description: string, amount: number) => Promise<void>;
  currentUser: { username: string; role: 'admin' | 'employee' } | null;
  onToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

const CATEGORIES = [
  "فلاتر",
  "فرامل",
  "كهرباء",
  "زيوت",
  "إطارات",
  "عادم",
  "تعليق",
  "أخرى"
];

export default function Products({ onAddLog, currentUser, onToast }: ProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewBarcodeProduct, setViewBarcodeProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Form Fields
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('فلاتر');
  const [brand, setBrand] = useState('');
  const [carCompatibility, setCarCompatibility] = useState('');
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [minStock, setMinStock] = useState(5);
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Barcode Print Preview state
  const [printProduct, setPrintProduct] = useState<Product | null>(null);
  const [storeNameState, setStoreNameState] = useState("مركز قطع غيار السيارات والميكانيكا");

  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Global Physical Barcode Focus Binder & Keystroke Redirector for Products page
  useEffect(() => {
    let rawBuffer = '';
    let lastKeyTimestamp = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier/system keys except Enter
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

      const now = Date.now();
      const elapsed = now - lastKeyTimestamp;
      lastKeyTimestamp = now;

      // Barcode scanners type characters extremely fast (<50ms delay).
      if (elapsed > 50) {
        rawBuffer = '';
      }

      if (e.key === 'Enter') {
        const cleanCode = rawBuffer.trim();
        if (cleanCode.length >= 3) {
          e.preventDefault();
          e.stopPropagation();

          // Play crisp scan beep
          playScanBeep();

          // Case A: A product barcode preview modal is open
          if (viewBarcodeProduct) {
            const currentPreviewCode = viewBarcodeProduct.barcode.trim();
            setViewBarcodeProduct(null); // Close preview modal

            if (cleanCode.toLowerCase() === currentPreviewCode.toLowerCase()) {
              onToast(`تمت قراءة الباركود بنجاح من الشاشة! القارئ اليدوي يعمل بدقة ممتازة ✅🔌 (${viewBarcodeProduct.name})`, "success");
            } else {
              // Scanned code is different from the currently viewed item. Let's find it.
              const matched = products.find(p => p.barcode.toLowerCase() === cleanCode.toLowerCase());
              if (matched) {
                setSearchQuery(matched.barcode);
                onToast(`تم مسح الباركود بنجاح وتصفية المنتج: ${matched.name} ⚡`, "success");
              } else {
                setSearchQuery(cleanCode);
                onToast(`القارئ يعمل! الباركود الممسوح غير مسجل: ${cleanCode}`, "warning");
              }
            }
          } else {
            // Case B: General screen scanning, no modal active
            const matched = products.find(p => p.barcode.toLowerCase() === cleanCode.toLowerCase());
            if (matched) {
              setSearchQuery(matched.barcode);
              onToast(`تم العثور على القطعة بالمسح السريع: ${matched.name} ⚡`, "success");
            } else {
              setSearchQuery(cleanCode);
              onToast(`الباركود الممسوح غير مسجل بالمنظومة: ${cleanCode}`, "warning");
            }
          }

          rawBuffer = '';
          return;
        }
        rawBuffer = '';
      } else if (e.key.length === 1) {
        rawBuffer += e.key;
      }

      // If user is actively typing inside another input (e.g. details edit form modal), don't steal focus!
      if (isInputActive && target !== searchInputRef.current) {
        return;
      }

      if (searchInputRef.current && document.activeElement !== searchInputRef.current) {
        searchInputRef.current.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [products, viewBarcodeProduct, isModalOpen]);

  // Document Click Focus Retention
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = target.closest('input, textarea, select, button, [role="button"], a, [onclick]');
      
      // If clicked on static whitespace, refocus the barcode search input
      if (!isInteractive && !isModalOpen && searchInputRef.current) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 65);
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [viewBarcodeProduct, isModalOpen]);

  useEffect(() => {
    // Real-time listener for products
    const unsubscribe = subscribeToStore("products", (data) => {
      setProducts(data);
    });

    // Also load settings for storeNameState
    getAllRecords("settings").then(settings => {
      const main = settings.find(s => s.id === "main");
      if (main && main.storeName) {
        setStoreNameState(main.storeName);
      }
    });

    // ESC listener to close modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
        setPrintProduct(null);
        setViewBarcodeProduct(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribe();
    };
  }, []);

  const loadProducts = async () => {
    // Kept for backward compatibility if called manually
    try {
      const settings = await getAllRecords("settings");
      const main = settings.find(s => s.id === "main");
      if (main && main.storeName) {
        setStoreNameState(main.storeName);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const generateRandomBarcode = () => {
    // Generate unique 8-digit barcode
    let code = '';
    do {
      code = Math.floor(10000000 + Math.random() * 90000000).toString();
    } while (products.some(p => p.barcode === code));
    setBarcode(code);
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    setSelectedProduct(null);
    setBarcode('');
    // pre-fill a barcode
    generateRandomBarcode();
    setName('');
    setCategory('فلاتر');
    setBrand('');
    setCarCompatibility('');
    setPurchasePrice(0);
    setSellingPrice(0);
    setQuantity(10);
    setMinStock(5);
    setLocation('');
    setImageUrl('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    if (currentUser?.role !== 'admin') {
      onToast("عذراً، تعديل السلع متاح للمشرفين فقط", "error");
      return;
    }
    setModalMode('edit');
    setSelectedProduct(product);
    setBarcode(product.barcode);
    setName(product.name);
    setCategory(product.category);
    setBrand(product.brand);
    setCarCompatibility(product.carCompatibility);
    setPurchasePrice(product.purchasePrice);
    setSellingPrice(product.sellingPrice);
    setQuantity(product.quantity);
    setMinStock(product.minStock);
    setLocation(product.location);
    setImageUrl(product.imageUrl || '');
    setIsModalOpen(true);
  };

  const confirmDeleteProduct = async (product: Product) => {
    try {
      if (product.id) {
        await deleteRecord("products", product.id);
        await onAddLog('system', `حذف القطعة: ${product.name} ذات الباركود ${product.barcode}`, 0);
        onToast("تم حذف المنتج بنجاح", "success");
      }
    } catch (e) {
      onToast("فشل الحذف، يرجى المحاولة لاحقاً", "error");
    } finally {
      setProductToDelete(null);
    }
  };

  const deleteProductItem = (product: Product) => {
    if (currentUser?.role !== 'admin') {
      onToast("عذراً، صلاحية الحذف متاحة للمشرفين فقط", "error");
      return;
    }
    setProductToDelete(product);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onToast("يرجى إدخال اسم القطعة", "warning");
      return;
    }
    if (!barcode.trim()) {
      onToast("يرجى التزويد برقم الباركود", "warning");
      return;
    }

    // Check bar code uniqueness
    const barcodeDuplicate = products.find(p => p.barcode === barcode && p.id !== selectedProduct?.id);
    if (barcodeDuplicate) {
      onToast("رمز الباركود هذا مستخدم بالفعل لمنتج آخر!", "error");
      return;
    }

    const itemData: Product = {
      barcode,
      name,
      category,
      brand,
      carCompatibility,
      purchasePrice: Number(purchasePrice),
      sellingPrice: Number(sellingPrice),
      quantity: Number(quantity),
      minStock: Number(minStock),
      location,
      imageUrl
    };

    try {
      if (modalMode === 'add') {
        const id = await addRecord("products", itemData);
        await onAddLog('add_stock', `إدخال قطعة جديدة: ${name} (المخزون الداخلي: ${quantity})`, purchasePrice * quantity);
        onToast("تمت إضافة المنتج الجديد بنجاح", "success");
      } else {
        await updateRecord("products", selectedProduct?.id, itemData);
        // Detect price update
        if (selectedProduct && selectedProduct.sellingPrice !== Number(sellingPrice)) {
          await onAddLog('edit_price', `تعديل السعر لـ ${name}: من ${selectedProduct.sellingPrice} إلى ${sellingPrice} ج.م`, 0);
        } else {
          await onAddLog('system', `تعديل مستودع للقطعة: ${name}`, 0);
        }
        onToast("تم تحديث الفولدر بنجاح", "success");
      }
      setIsModalOpen(false);
      loadProducts();
    } catch (ex) {
      onToast("خطأ في تفاصيل قاعدة البيانات", "error");
    }
  };

  const handlePrintBarcodeDirectly = (product: Product) => {
    setPrintProduct(product);
  };

  const triggerPhysicalPrint = () => {
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchQuery.trim().toLowerCase();
      if (!query) return;

      const matched = products.find(p => p.barcode.toLowerCase() === query);
      if (matched) {
        playScanBeep();
        setViewBarcodeProduct(null); // Close the barcode preview popup immediately
        onToast(`تم العثور على القطعة وتصفيتها بالمسح السريع: ${matched.name}`, "success");
      }
    }
  };

  // Filter & Search Logic
  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.barcode.includes(searchQuery) ||
      p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.carCompatibility.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'الكل' || p.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Search, Filter Action Header */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 right-3 flex items-center text-gray-400 pointer-events-none">
              <Search size={18} />
            </span>
            <input 
              ref={searchInputRef}
              id="product-search-input"
              type="text"
              placeholder="البحث بالاسم، الباركود، الماركة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pr-10 pl-36 py-2 border border-gray-200 focus:border-[#2E86AB] focus:ring-1 focus:ring-[#2E86AB] outline-hidden rounded-xl text-sm"
            />
            <div className="absolute inset-y-0 left-2 flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 my-1.5 rounded-lg border border-emerald-150/40 pointer-events-none">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span>قارئ الباركود مستعد 🔌</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs shrink-0 font-medium">تصنيف الفئة:</span>
            <select
              id="category-filter-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-200 bg-white rounded-xl text-sm focus:border-[#2E86AB] outline-hidden cursor-pointer"
            >
              <option value="الكل">الكل</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <button 
            id="add-new-product-btn"
            onClick={handleOpenAddModal}
            className="w-full md:w-auto px-5 py-2.5 bg-[#2E86AB] hover:bg-[#1E2A3A] transition-colors text-white font-medium rounded-xl flex items-center justify-center gap-2 cursor-pointer text-sm shadow-xs"
          >
            <Plus size={18} />
            إضافة منتج جديد
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden no-print">
        <div className="p-5 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-lg text-[#2D3142] flex items-center gap-2">
            <ClipboardList className="text-[#2E86AB]" size={20} />
            سجل المنتجات الفعلي بالمستودع
          </h2>
          <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-bold">
            متاح: {filteredProducts.length} قطعة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-gray-500 font-semibold">
              <tr className="border-b border-gray-100">
                <th className="p-4">الباركود</th>
                <th className="p-4">اسم القطعة والماركة</th>
                <th className="p-4">السيارات المتوافقة</th>
                <th className="p-4">التصنيف</th>
                <th className="p-4">مكان التخزين</th>
                <th className="p-4 text-center">الكمية الحالية</th>
                <th className="p-4 text-left">شراء / بيع</th>
                <th className="p-4 text-center">خيارات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-20 text-gray-400">
                    لا تتوفر قطع غيار مطابقة للبحث الحالي.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.quantity < p.minStock;
                  return (
                    <tr 
                      key={p.id} 
                      className={`hover:bg-gray-50/75 transition-colors ${isLow ? 'bg-amber-50/20' : ''}`}
                    >
                      <td className="p-4">
                        <span className="font-mono bg-neutral-100 text-[#2D3142] px-2.5 py-1 rounded-md text-xs border border-neutral-200">
                          {p.barcode}
                        </span>
                      </td>
                      <td className="p-4 max-w-xs">
                        <p className="text-gray-900 font-bold truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 mt-1 font-semibold">{p.brand || 'ماركة أصلية'}</p>
                      </td>
                      <td className="p-4 text-gray-600 text-xs font-semibold">{p.carCompatibility || 'سيدان متوافق'}</td>
                      <td className="p-4">
                        <span className="text-xs bg-blue-50 text-blue-800 px-2.5 py-1 rounded-lg">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <MapPin size={14} className="text-[#2E86AB]" />
                          <span>{p.location || 'غير محدد'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1.5 justify-center">
                          <span className={`font-mono text-base font-extrabold ${p.quantity === 0 ? 'text-[#E63946]' : isLow ? 'text-[#FF9800]' : 'text-gray-800'}`}>
                            {p.quantity}
                          </span>
                          {isLow && (
                            <span className="text-[#FF9800]" title="تحت الحد الأدنى">
                              <AlertTriangle size={15} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-left font-mono">
                        <div className="text-xs text-gray-400">شراء: {p.purchasePrice} ج.م</div>
                        <div className="text-sm text-[#4CAF50] font-bold">بيع: {p.sellingPrice} ج.م</div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setViewBarcodeProduct(p)}
                            title="عرض ومعاينة الباركود للمسح بالقارئ اليدوي"
                            className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handlePrintBarcodeDirectly(p)}
                            title="طباعة ملصق باركود"
                            className="p-1.5 hover:bg-neutral-100 text-neutral-600 hover:text-black rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            title="تعديل"
                            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => deleteProductItem(p)}
                            title="حذف"
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Add / Edit Product */}
      {isModalOpen && (
        <div 
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-xl border border-gray-100 text-right animate-in fade-in zoom-in duration-150"
          >
            {/* Modal Header */}
            <div className="bg-[#1E2A3A] p-5 text-white flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Tag size={20} className="text-[#A8DADC]" />
                {modalMode === 'add' ? 'إدخال قطعة غيار جديدة' : 'تحديث بيانات قطعة غيار'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-300 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Barcode input & Generator */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-600 text-sm font-semibold">رمز الباركود الفريد</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="أدخل 8 أرقام باركود"
                      className="flex-1 px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl font-mono text-sm leading-6"
                      maxLength={14}
                      required
                    />
                    <button
                      type="button"
                      onClick={generateRandomBarcode}
                      className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-xs font-bold text-[#2D3142] rounded-xl transition-colors cursor-pointer border border-gray-200 shrink-0"
                    >
                      توليد تلقائي
                    </button>
                  </div>
                </div>

                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-600 text-sm font-semibold">اسم القطعة / المنتج</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: فلتر زيت مستدير"
                    className="px-4 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm"
                    required
                  />
                </div>

                {/* Category */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-600 text-sm font-semibold">الفئة</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-200 outline-hidden rounded-xl text-sm bg-white cursor-pointer"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Brand */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-600 text-sm font-semibold">ماركة الصنع</label>
                  <input 
                    type="text" 
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="مثال: Denso, Toyota Genuine"
                    className="px-4 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm"
                  />
                </div>

                {/* Car Compatibility */}
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-gray-600 text-sm font-semibold">السيارات المتوافقة مع القطعة</label>
                  <input 
                    type="text" 
                    value={carCompatibility}
                    onChange={(e) => setCarCompatibility(e.target.value)}
                    placeholder="تويوتا كورولا 2018-2022 / يارس ليميتد"
                    className="px-4 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm w-full"
                  />
                </div>

                {/* Prices */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-600 text-sm font-semibold">سعر الشراء (تكلفتها عليك ج.م)</label>
                  <input 
                    type="number" 
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    className="px-4 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm font-mono text-[#2D3142]"
                    min={0}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-600 text-sm font-semibold">سعر البيع للجمهور (ج.م)</label>
                  <input 
                    type="number" 
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="px-4 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm font-mono text-[#4CAF50] font-bold"
                    min={0}
                    required
                  />
                </div>

                {/* Quantities */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-600 text-sm font-semibold">الكمية البدئية المتوفرة بالمحل</label>
                  <input 
                    type="number" 
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="px-4 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm font-mono text-[#2D3142]"
                    min={0}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-600 text-sm font-semibold">الحد الأدنى للتنبيه بنفاذها</label>
                  <input 
                    type="number" 
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    className="px-4 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm font-mono text-[#FF9800]"
                    min={1}
                    required
                  />
                </div>

                {/* Storage Location */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-600 text-sm font-semibold">عنوان التخزين بالمحل (الرف)</label>
                  <input 
                    type="text" 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="مثال: رف أ-3"
                    className="px-4 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm"
                  />
                </div>

                {/* Image optional */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-600 text-sm font-semibold">رابط صورة توضيحية (اختياري)</label>
                  <input 
                    type="text" 
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/item.jpg"
                    className="px-4 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm"
                  />
                </div>

              </div>

              {/* Form Buttons */}
              <div className="flex justify-start gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#2E86AB] hover:bg-[#1E2A3A] text-white font-semibold rounded-xl text-sm cursor-pointer transition-colors shadow-xs"
                >
                  حفظ السلعة
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm cursor-pointer transition-colors"
                >
                  إلغاء الأمر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP: Barcode Tag Print Preview */}
      {printProduct && (
        <div 
          onClick={() => setPrintProduct(null)}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 no-print"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden text-right shadow-2xl p-6 relative border border-gray-100"
          >
            <button 
              onClick={() => setPrintProduct(null)}
              className="absolute top-4 left-4 text-gray-400 hover:text-black py-1 px-1.5"
            >
              <X size={20} />
            </button>

            <h3 className="font-bold text-[#2D3142] text-lg mb-4 flex items-center gap-1.5">
              <Printer size={18} className="text-[#2E86AB]" />
              ملصق تجريبي للباركود والطباعة
            </h3>

            {/* Custom Interactive Printable Tag Container */}
            <div className="border border-dashed border-gray-300 bg-neutral-50 p-6 rounded-xl flex flex-col items-center justify-center text-center my-4">
              <p className="text-xs text-gray-400 font-bold mb-1 font-sans">{storeNameState}</p>
              <h4 className="font-extrabold text-[#2D3142] text-sm max-w-[260px] truncate">{printProduct.name}</h4>
              <p className="text-xs text-gray-500 font-bold mt-1">الماركة: {printProduct.brand || 'قطع غيار أصلية'}</p>
              
              {/* Real SVG Barcode generator */}
              <div className="my-3 flex flex-col items-center gap-1">
                <Barcode value={printProduct.barcode} height={50} width={1.8} displayValue={false} />
                <span className="font-mono text-sm tracking-widest text-black font-bold">
                  {printProduct.barcode}
                </span>
              </div>

              {/* Price display tag */}
              <div className="mt-1 font-bold text-[#2D3142] text-sm">
                السعر بالضريبة: <span className="text-lg text-[#2E86AB] font-mono">{printProduct.sellingPrice}</span> ج.م
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => {
                  triggerPhysicalPrint();
                }}
                className="flex-1 bg-[#2E86AB] hover:bg-[#1E2A3A] transition-colors text-white py-2.5 rounded-xl text-center font-bold text-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <Printer size={16} />
                افتح نافذة الطباعة
              </button>
              <button 
                onClick={() => setPrintProduct(null)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP: Barcode Viewer for Physical Scanning on Screen */}
      {viewBarcodeProduct && (
        <div 
          onClick={() => setViewBarcodeProduct(null)}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          dir="rtl"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden text-right shadow-2xl border border-gray-100 flex flex-col transform transition-all animate-in fade-in zoom-in duration-150"
          >
            {/* Header */}
            <div className="bg-linear-to-r from-emerald-600 to-teal-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-white/10 p-2 rounded-xl">
                  <Eye className="text-emerald-250 animate-pulse" size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">معاينة رمز الباركود للمسح السريع</h3>
                  <p className="text-white/80 text-[11px] font-medium">سُلّط الضوء على الشاشة بمسدس الباركود اليدوي للمسح</p>
                </div>
              </div>
              <button 
                onClick={() => setViewBarcodeProduct(null)}
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content box */}
            <div className="p-6 space-y-6 text-center animate-in duration-150">
              <div>
                <span className="bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full font-black inline-block mb-1.5">
                  فئة {viewBarcodeProduct.category || 'عامة'}
                </span>
                <h4 className="font-extrabold text-[#2D3142] text-lg leading-snug">{viewBarcodeProduct.name}</h4>
                <p className="text-xs text-gray-400 mt-1 font-semibold">{viewBarcodeProduct.brand || 'قطع غيار أصلية'} | التوافق: {viewBarcodeProduct.carCompatibility || 'جميع الموديلات'}</p>
              </div>

              {/* Ultra High Contrast Barcode Container for flawless scan */}
              <div className="border border-neutral-100 bg-white p-8 rounded-2xl shadow-inner flex flex-col items-center justify-center">
                <div className="bg-white p-2.5 rounded-xl border border-dashed border-neutral-200 scale-110">
                  <Barcode value={viewBarcodeProduct.barcode} height={68} width={2.2} displayValue={false} />
                </div>
                
                <span className="font-mono text-lg font-black tracking-widest text-neutral-800 bg-neutral-100 border border-neutral-200 px-4 py-1 rounded-md mt-4 select-all shadow-2xs">
                  {viewBarcodeProduct.barcode}
                </span>
                
                <div className="mt-4 flex items-center gap-1.5 justify-center text-emerald-600 font-extrabold text-xs bg-emerald-50 px-3 py-1.5 rounded-full animate-pulse border border-emerald-500/10">
                  <span>🔌 وّجه قارئ الباركود اليدوي إلى الشاشة للمسح السريع</span>
                </div>
              </div>

              {/* Stock and pricing overview */}
              <div className="grid grid-cols-2 gap-3 mt-2 text-right">
                <div className="bg-neutral-50 p-3 rounded-xl border border-gray-100 text-center">
                  <span className="text-[10px] text-gray-400 block font-bold">سعر بيع القطعة</span>
                  <span className="font-black text-emerald-600 text-lg">{viewBarcodeProduct.sellingPrice} ج.م</span>
                </div>
                <div className="bg-neutral-50 p-3 rounded-xl border border-gray-100 text-center">
                  <span className="text-[10px] text-gray-400 block font-bold">المخزون المتوفر</span>
                  <span className={`font-black text-sm block ${viewBarcodeProduct.quantity <= 0 ? 'text-red-500' : 'text-gray-700'}`}>
                    {viewBarcodeProduct.quantity} قطعة
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-neutral-50 p-4 border-t border-gray-100 flex gap-2">
              <button 
                type="button"
                onClick={() => setViewBarcodeProduct(null)}
                className="w-full py-3 bg-white hover:bg-neutral-100 border border-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Print Layout for the browser (Invisible on screen, activated during index printing) */}
      {printProduct && (
        <div className="print-only" style={{ direction: 'rtl', textAlign: 'center', width: '60mm', margin: '0 auto', padding: '15px', border: '1px solid black' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 'bold', margin: '0 0 2px 0', fontFamily: 'Tajawal' }}>
            {storeNameState}
          </h2>
          <div style={{ fontSize: '10px', margin: '2px 0 5px 0', fontWeight: 'bold', fontFamily: 'Tajawal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {printProduct.name}
          </div>
          
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
            <Barcode value={printProduct.barcode} height={35} width={1.5} displayValue={false} />
            <div style={{ fontFamily: 'monospace', fontSize: '12px', letterSpacing: '4px', fontWeight: 'bold', color: '#000000', margin: '2px 0' }}>
              {printProduct.barcode}
            </div>
          </div>

          <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '6px', fontFamily: 'Tajawal' }}>
            السعر: <b>{printProduct.sellingPrice} ج.م</b>
          </div>
        </div>
      )}
      {/* MODAL: Delete Product Confirmation */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100 flex flex-col">
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
              <Trash2 className="text-rose-500" size={20} />
              <h3 className="font-bold text-rose-700">تأكيد حذف المنتج</h3>
            </div>
            <div className="p-5 text-sm text-gray-600 font-medium leading-relaxed">
              هل أنت متأكد من حذف المنتج: <span className="font-bold text-gray-900">{productToDelete.name}</span>؟
            </div>
            <div className="p-4 bg-neutral-50 flex gap-2 justify-end">
              <button
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 border border-gray-200 text-gray-500 font-bold rounded-lg text-sm hover:bg-white transition-colors cursor-pointer"
              >
                إلغاء التراجع
              </button>
              <button
                onClick={() => confirmDeleteProduct(productToDelete)}
                className="px-4 py-2 bg-rose-500 text-white font-bold rounded-lg text-sm hover:bg-rose-600 shadow-md shadow-rose-500/20 transition-all cursor-pointer"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
