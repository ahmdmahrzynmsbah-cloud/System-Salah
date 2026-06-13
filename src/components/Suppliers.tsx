import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Building, Phone, User, FileText, Pickaxe, X, Save, PackagePlus, Trash2, ShoppingCart } from 'lucide-react';
import { addRecord, getAllRecords, updateRecord, deleteRecord, subscribeToStore, Supplier, User as AppUser, Product } from '../db';

interface SuppliersProps {
  onToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  currentUser: AppUser | null;
  onAddLog: (actionType: any, desc: string, amount: number) => Promise<void>;
}

export default function Suppliers({ onToast, currentUser, onAddLog }: SuppliersProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    companyName: '',
    balance: 0,
    notes: ''
  });

  // Purchase Modal State
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState<number | ''>('');
  const [purchaseItems, setPurchaseItems] = useState<{
    productId: number;
    productName: string;
    barcode: string;
    quantity: number;
    purchasePrice: number;
  }[]>([]);
  
  const [selProductId, setSelProductId] = useState<number | ''>('');
  const [selQty, setSelQty] = useState<number>(1);
  const [selPrice, setSelPrice] = useState<number>(0);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToStore("suppliers", (data) => {
      setSuppliers(data.reverse());
    });
    return () => unsubscribe();
  }, []);

  const handleOpenPurchaseModal = async () => {
    try {
      const pds = await getAllRecords("products");
      setDbProducts(pds);
      setPurchaseSupplierId('');
      setPurchaseItems([]);
      setSelProductId('');
      setSelQty(1);
      setSelPrice(0);
      setProductSearch('');
      setIsPurchaseModalOpen(true);
    } catch (e) {
      onToast('حدث خطأ أثناء جلب المنتجات', 'error');
    }
  };

  const handleAddPurchaseItem = () => {
    if (!selProductId) {
      onToast('الرجاء اختيار صنف', 'warning');
      return;
    }
    if (selQty <= 0) {
      onToast('الكمية يجب أن تكون أكبر من صفر', 'warning');
      return;
    }
    if (selPrice < 0) {
      onToast('السعر غير صالح', 'warning');
      return;
    }

    const prod = dbProducts.find(p => p.id === selProductId);
    if (!prod) return;

    const existingIdx = purchaseItems.findIndex(i => i.productId === selProductId);
    if (existingIdx >= 0) {
      const updated = [...purchaseItems];
      updated[existingIdx].quantity += selQty;
      updated[existingIdx].purchasePrice = selPrice;
      setPurchaseItems(updated);
    } else {
      setPurchaseItems([...purchaseItems, {
        productId: prod.id!,
        productName: prod.name,
        barcode: prod.barcode,
        quantity: selQty,
        purchasePrice: selPrice
      }]);
    }

    setSelProductId('');
    setSelQty(1);
    setSelPrice(0);
    setProductSearch('');
  };

  const handleRemovePurchaseItem = (idx: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== idx));
  };

  const handleRegisterPurchase = async () => {
    if (!purchaseSupplierId) {
      onToast('الرجاء اختيار المورد', 'error');
      return;
    }
    if (purchaseItems.length === 0) {
      onToast('الرجاء إضافة أصناف للفاتورة', 'error');
      return;
    }

    const supplier = suppliers.find(s => s.id === purchaseSupplierId);
    if (!supplier) return;

    const totalValue = purchaseItems.reduce((acc, item) => acc + (item.quantity * item.purchasePrice), 0);

    try {
      await updateRecord("suppliers", supplier.id!, {
        ...supplier,
        balance: supplier.balance + totalValue
      });

      const latestProducts = await getAllRecords("products");
      
      for (const item of purchaseItems) {
        const dbProd = latestProducts.find((p: Product) => p.id === item.productId);
        if (dbProd) {
          await updateRecord("products", dbProd.id!, {
            ...dbProd,
            quantity: dbProd.quantity + item.quantity,
            purchasePrice: item.purchasePrice
          });
        }
      }

      await onAddLog('system', `فاتورة واردة من المورد (${supplier.name}) بقيمة ${totalValue.toLocaleString('en-US')} ج.م`, totalValue);
      
      onToast('تم تسجيل الفاتورة وتحديث المخزون بنجاح!', 'success');
      setIsPurchaseModalOpen(false);
      loadSuppliers();
    } catch (e) {
      console.error(e);
      onToast('حدث خطأ أثناء تسجيل الفاتورة', 'error');
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await getAllRecords("suppliers");
      setSuppliers(data.reverse());
    } catch (e) {
      console.error(e);
      onToast("حدث خطأ أثناء تحميل بيانات الموردين", "error");
    }
  };

  const handleOpenAddModal = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      phone: '',
      companyName: '',
      balance: 0,
      notes: ''
    });
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim() || !formData.companyName.trim()) {
      onToast("الرجاء تعبئة الحقول الأساسية (الاسم، الجوال، الشركة)", "error");
      return;
    }

    try {
      const dbEntry: Supplier = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        companyName: formData.companyName.trim(),
        balance: Number(formData.balance) || 0,
        notes: formData.notes.trim()
      };

      if (editingSupplier && editingSupplier.id) {
        await updateRecord("suppliers", editingSupplier.id, dbEntry);
        await onAddLog('system', `تعديل بيانات المورد: ${dbEntry.name}`, 0);
        onToast("تم تعديل بيانات المورد بنجاح", "success");
      } else {
        await addRecord("suppliers", dbEntry);
        await onAddLog('system', `إضافة مورد جديد: ${dbEntry.name}`, 0);
        onToast("تمت إضافة المورد بنجاح", "success");
      }

      setIsAddModalOpen(false);
      loadSuppliers();
    } catch (e: any) {
      console.error(e);
      if (e.name === 'ConstraintError') {
        onToast("رقم الجوال مسجل لمورد آخر", "error");
      } else {
        onToast("حدث خطأ أثناء حفظ المورد", "error");
      }
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.includes(searchQuery) ||
    s.phone.includes(searchQuery) ||
    s.companyName.includes(searchQuery)
  );

  return (
    <div className="space-y-6 relative">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Truck className="text-[#2E86AB]" size={28} />
            سجل الموردين
          </h2>
          <p className="text-sm text-gray-500 font-medium mt-1">
            إدارة بيانات الموردين وحساباتهم
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleOpenPurchaseModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
          >
            <PackagePlus size={18} />
            بضاعة واردة
          </button>
          <button
            onClick={handleOpenAddModal}
            className="bg-[#2E86AB] hover:bg-[#236a87] text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
          >
            <Plus size={18} />
            إضافة مورد جديد
          </button>
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="البحث باسم المورد أو رقم الهاتف أو الشركة..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 transition-all font-medium"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>
        </div>

        {suppliers.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-600 mb-2">لا يوجد موردين مضافين</h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              قم بإضافة الموردين الذين تتعامل معهم لتتبع فواتير المشتريات وحساباتهم المالية بسهولة.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-gray-500 text-sm border-b border-gray-100">
                  <th className="py-4 px-6 font-semibold w-12">#</th>
                  <th className="py-4 px-6 font-semibold">المورد</th>
                  <th className="py-4 px-6 font-semibold">الشركة</th>
                  <th className="py-4 px-6 font-semibold">الجوال</th>
                  <th className="py-4 px-6 font-semibold">الرصيد المتبقي له</th>
                  <th className="py-4 px-6 font-semibold">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier, idx) => (
                  <tr 
                    key={supplier.id} 
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setEditingSupplier(supplier);
                      setFormData({
                        name: supplier.name,
                        phone: supplier.phone,
                        companyName: supplier.companyName,
                        balance: supplier.balance,
                        notes: supplier.notes
                      });
                      setIsAddModalOpen(true);
                    }}
                  >
                    <td className="py-4 px-6 text-gray-400 font-mono text-sm">{idx + 1}</td>
                    <td className="py-4 px-6 font-bold text-[#2E86AB]">{supplier.name}</td>
                    <td className="py-4 px-6 text-gray-700 font-medium">{supplier.companyName}</td>
                    <td className="py-4 px-6 text-gray-600 font-mono">{supplier.phone}</td>
                    <td className="py-4 px-6 font-bold">
                      <span className={supplier.balance > 0 ? "text-rose-500" : "text-emerald-500"}>
                        {supplier.balance.toLocaleString('en-US')} ج.م
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-500 text-sm truncate max-w-[200px]">{supplier.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredSuppliers.length === 0 && (
               <div className="p-8 text-center text-gray-500 font-medium">
                 لا توجد نتائج مطابقة لبحثك "{searchQuery}"
               </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Supplier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Building className="text-[#2E86AB]" size={20} />
                {editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-rose-500 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">اسم المورد</label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-3 pr-9 text-sm focus:ring-2 focus:ring-[#2E86AB]/30 focus:border-[#2E86AB]"
                      placeholder="اسم المورد أو المندوب"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">اسم الشركة/المؤسسة</label>
                  <div className="relative">
                    <Building className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="text" 
                      required
                      value={formData.companyName}
                      onChange={e => setFormData({...formData, companyName: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-3 pr-9 text-sm focus:ring-2 focus:ring-[#2E86AB]/30 focus:border-[#2E86AB]"
                      placeholder="الشركة الموردة"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">رقم الجوال</label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="tel" 
                      required
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-3 pr-9 text-sm focus:ring-2 focus:ring-[#2E86AB]/30 focus:border-[#2E86AB] text-left"
                      placeholder="مثال: 0500000000"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600">الرصيد الافتتاحي له (مديونيتك له)</label>
                  <input 
                    type="number" 
                    value={formData.balance === 0 ? '' : formData.balance}
                    onChange={e => setFormData({...formData, balance: Number(e.target.value)})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-[#2E86AB]/30 focus:border-[#2E86AB]"
                    placeholder="0 ج.م"
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">ملاحظات (اختياري)</label>
                <div className="relative">
                  <FileText className="absolute right-3 top-3 text-gray-400" size={16} />
                  <textarea 
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-3 pr-9 text-sm focus:ring-2 focus:ring-[#2E86AB]/30 focus:border-[#2E86AB] h-20 resize-none"
                    placeholder="أي ملاحظات إضافية عن المورد..."
                  ></textarea>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-[#2E86AB] text-white py-2.5 rounded-xl font-bold hover:bg-[#236a87] transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  حفظ البيانات
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchase Invoice Modal */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white max-w-4xl w-full rounded-2xl shadow-xl flex flex-col max-h-[90vh] min-h-[500px] animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50/50">
              <h3 className="font-bold text-emerald-800 flex items-center gap-2 text-lg">
                <PackagePlus className="text-emerald-600" size={22} />
                تسجيل بضاعة واردة (فاتورة مشتريات)
              </h3>
              <button 
                onClick={() => setIsPurchaseModalOpen(false)}
                className="text-gray-400 hover:text-rose-500 transition-colors p-1"
              >
                <X size={22} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              {/* Supplier Selection */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="text-sm font-bold text-gray-700 block mb-2">اختر المورد</label>
                <select 
                  value={purchaseSupplierId} 
                  onChange={e => setPurchaseSupplierId(Number(e.target.value))}
                  className="w-full bg-white border border-gray-300 rounded-xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-emerald-500/30 outline-none"
                >
                  <option value="">-- يرجى اختيار المورد --</option>
                  {suppliers.map(s => (
                    <option value={s.id} key={s.id}>{s.name} - {s.companyName}</option>
                  ))}
                </select>
              </div>

              {/* Add Product Section */}
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                <h4 className="font-bold text-[#2E86AB] flex items-center gap-2">
                  <ShoppingCart size={18} />
                  إضافة عناصر للفاتورة
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-gray-600 flex justify-between">
                      <span>الصنف</span>
                      <input 
                        type="text" 
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        className="bg-white border text-xs px-2 py-0.5 rounded w-32 outline-none focus:border-[#2E86AB]"
                        placeholder="بحث سريـع..."
                      />
                    </label>
                    <select 
                      value={selProductId} 
                      onChange={e => {
                        const val = Number(e.target.value);
                        setSelProductId(val);
                        const prod = dbProducts.find(p => p.id === val);
                        if (prod) setSelPrice(prod.purchasePrice);
                      }}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-sm outline-none focus:border-[#2E86AB]"
                    >
                      <option value="">-- اختر من المستودع --</option>
                      {dbProducts.filter(p => p.name.includes(productSearch) || p.barcode.includes(productSearch)).map(p => (
                        <option value={p.id} key={p.id}>{p.name} ({p.barcode})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600">الكمية الواردة</label>
                    <input 
                      type="number" 
                      min="1"
                      value={selQty} 
                      onChange={e => setSelQty(Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-center text-sm outline-none focus:border-[#2E86AB]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600">سعر الإفراد (شراء)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={selPrice} 
                      onChange={e => setSelPrice(Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-xl py-2 px-3 text-center text-sm outline-none focus:border-[#2E86AB]"
                    />
                  </div>
                </div>
                <button 
                  onClick={handleAddPurchaseItem}
                  className="w-full bg-[#2E86AB] hover:bg-[#236a87] text-white py-2 rounded-xl text-sm font-bold mt-2 flex justify-center items-center gap-1 transition-all"
                >
                  <Plus size={16} />
                  إدراج الصنف للقائمة
                </button>
              </div>

              {/* Items list */}
              <div className="border border-gray-200 rounded-xl overflow-y-auto flex-1 bg-white min-h-[150px]">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-100/80 text-gray-600 sticky top-0 shadow-sm">
                    <tr>
                      <th className="py-3 px-4 font-bold border-b">م</th>
                      <th className="py-3 px-4 font-bold border-b">شريط الباركود</th>
                      <th className="py-3 px-4 font-bold border-b">الصنف</th>
                      <th className="py-3 px-4 text-center font-bold border-b">الكمية</th>
                      <th className="py-3 px-4 text-center font-bold border-b">سعر الشراء</th>
                      <th className="py-3 px-4 text-center font-bold border-b">الإجمالي</th>
                      <th className="py-3 px-4 text-center border-b"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {purchaseItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-400 font-medium bg-gray-50/30">الرجاء إدراج أصناف לעرضها هنا</td>
                      </tr>
                    ) : (
                      purchaseItems.map((item, idx) => (
                        <tr key={idx} className="bg-white hover:bg-gray-50/50 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-gray-500">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-mono text-gray-600 text-xs">{item.barcode}</td>
                          <td className="py-2.5 px-4 font-bold text-gray-800">{item.productName}</td>
                          <td className="py-2.5 px-4 text-center font-mono">{item.quantity}</td>
                          <td className="py-2.5 px-4 text-center font-mono">{item.purchasePrice}</td>
                          <td className="py-2.5 px-4 text-center font-bold text-[#2E86AB]">
                            {(item.quantity * item.purchasePrice).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button 
                              onClick={() => handleRemovePurchaseItem(idx)}
                              className="text-gray-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between mt-auto gap-4">
              <div className="flex gap-4 items-center flex-1 w-full justify-between md:justify-start">
                <span className="text-gray-600 font-bold">إجمالي المطالبة للمورد:</span>
                <span className="text-xl font-black text-rose-600 bg-white px-4 py-2 rounded-xl border border-rose-100 shadow-sm font-mono">
                  {purchaseItems.reduce((acc, item) => acc + (item.quantity * item.purchasePrice), 0).toLocaleString()} ج.م
                </span>
              </div>
              <button 
                onClick={handleRegisterPurchase}
                className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-xl font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={purchaseItems.length === 0 || !purchaseSupplierId}
              >
                <Save size={20} />
                اعتماد وترحيل للمستودع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
