import React, { useState, useEffect } from 'react';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  Receipt, 
  CreditCard,
  History,
  TrendingDown,
  UserCheck
} from 'lucide-react';
import { subscribeToStore, Product, Invoice, Transaction, Debt } from '../db';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  currentUser: { username: string; role: 'admin' | 'employee' } | null;
}

export default function Dashboard({ onNavigate, currentUser }: DashboardProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  // Stats
  const [totalProducts, setTotalProducts] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [totalDebts, setTotalDebts] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    const unsubProducts = subscribeToStore("products", (data: Product[]) => {
      setProducts(data);
      setTotalProducts(data.length);
      setLowStockCount(data.filter((p) => p.quantity < 5).length);
    });

    const unsubInvoices = subscribeToStore("invoices", (data: Invoice[]) => {
      setInvoices(data);
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const todayStr = `${dd}/${mm}/${yyyy}`;
      const salesToday = data
        .filter((inv) => inv.date.startsWith(todayStr))
        .reduce((sum, inv) => sum + inv.total, 0);
      setTodaySales(salesToday);
    });

    const unsubTransactions = subscribeToStore("transactions", (data: Transaction[]) => {
      setTransactions(data);
    });

    const unsubDebts = subscribeToStore("debtLedger", (data: Debt[]) => {
      setDebts(data);
      setTotalDebts(data.reduce((sum, d) => sum + d.totalDebt, 0));
    });

    return () => {
      unsubProducts();
      unsubInvoices();
      unsubTransactions();
      unsubDebts();
    };
  }, []);

  // Get products with stock less than 5
  const dangerProducts = products.filter(p => p.quantity < 5);

  // Get last 5 invoices
  const lastInvoices = [...invoices].reverse().slice(0, 5);

  // Get last 5 transactions
  const lastTransactions = [...transactions].reverse().slice(0, 5);

  return (
    <div className="space-y-6" id="dashboard-container">
      {/* Welcome Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2D3142]">مرحباً بك، {currentUser?.username || 'المستخدم'} 👋</h1>
          <p className="text-gray-500 mt-1">نظام إدارة الأوراق المالية والمخازن لقطع غيار السيارات والميكانيكا</p>
        </div>
        <div className="flex gap-2">
          <button 
            id="quick-sell-btn"
            onClick={() => onNavigate('invoices')}
            className="px-5 py-2.5 bg-[#2E86AB] hover:bg-[#1E2A3A] transition-all text-white font-medium rounded-xl flex items-center gap-2 cursor-pointer shadow-sm text-sm"
          >
            <Receipt size={18} />
            فاتورة بيع جديدة
          </button>
          <button 
            id="quick-add-product-btn"
            onClick={() => onNavigate('products')}
            className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-[#2D3142] font-medium rounded-xl flex items-center gap-2 cursor-pointer transition-all text-sm"
          >
            <Package size={18} />
            المستودع
          </button>
        </div>
      </div>

      {/* Grid of 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Products */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">إجمالي القطع بالمستودع</p>
            <h3 className="text-3xl font-extrabold text-[#2D3142] mt-2 font-mono">{totalProducts}</h3>
            <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-sm mt-2 inline-block font-medium">
              مختلف التصنيفات
            </span>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-[#2E86AB] rounded-xl flex items-center justify-center">
            <Package size={24} />
          </div>
        </div>

        {/* Card 2: Today Sales */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">مبيعات اليوم</p>
            <h3 className="text-3xl font-extrabold text-[#4CAF50] mt-2 font-mono">
              {todaySales.toLocaleString('en-US')} <span className="text-xs text-gray-500 font-sans font-normal">ج.م</span>
            </h3>
            <span className="text-xs text-[#4CAF50] bg-emerald-50 px-2 py-0.5 rounded-sm mt-2 inline-block font-medium">
              سداد نقدي وآجل
            </span>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-[#4CAF50] rounded-xl flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Card 3: Pending Debt */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">إجمالي الديون المعلقة</p>
            <h3 className="text-3xl font-extrabold text-[#E63946] mt-2 font-mono">
              {totalDebts.toLocaleString('en-US')} <span className="text-xs text-gray-500 font-sans font-normal">ج.م</span>
            </h3>
            <span className="text-xs text-[#E63946] bg-rose-50 px-2 py-0.5 rounded-sm mt-2 inline-block font-medium">
              ذمم العملاء المستحقة
            </span>
          </div>
          <div className="w-12 h-12 bg-rose-50 text-[#E63946] rounded-xl flex items-center justify-center">
            <CreditCard size={24} />
          </div>
        </div>

        {/* Card 4: Low Stock Products */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">أوشكت على النفاد</p>
            <h3 className="text-3xl font-extrabold text-[#FF9800] mt-2 font-mono">{lowStockCount}</h3>
            <span className="text-xs text-[#FF9800] bg-amber-50 px-2 py-0.5 rounded-sm mt-2 inline-block font-medium">
              أقل من 5 قطع بالمخزن
            </span>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-[#FF9800] rounded-xl flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Alerts and Low Stock Notification */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 lg:col-span-1 flex flex-col h-full max-h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#2D3142] flex items-center gap-2">
              <AlertTriangle className="text-[#FF9800]" size={20} />
              تنبيهات المخزون الحرج
            </h2>
            <span className="text-xs bg-amber-100 text-[#FF9800] px-2 py-1 rounded-full font-bold">
              {dangerProducts.length} قطع
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto pr-1 flex-1 no-scrollbar">
            {dangerProducts.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                👍 جميع السلع متوفرة بكمية ممتازة (أعلى من 5 حبات).
              </div>
            ) : (
              dangerProducts.map((p) => (
                <div 
                  key={p.id} 
                  className="p-3 bg-amber-50/50 hover:bg-amber-50 border border-amber-100 rounded-xl transition-all flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{p.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span>الرف: {p.location || 'غير محدد'}</span>
                      <span>•</span>
                      <span>الماركة: {p.brand}</span>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <span className="text-xs text-amber-800 font-bold bg-amber-100/80 px-2.5 py-1 rounded-lg">
                      {p.quantity} قطع متبقية
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Last 5 Invoices */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 lg:col-span-2 flex flex-col h-full max-h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#2D3142] flex items-center gap-2">
              <Receipt className="text-[#2E86AB]" size={20} />
              آخر الفواتير الصادرة
            </h2>
            <button 
              onClick={() => onNavigate('invoices')}
              className="text-xs text-[#2E86AB] hover:underline hover:text-[#1E2A3A] font-bold cursor-pointer"
            >
              عرض المبيعات ←
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-medium">
                  <th className="py-2.5">رقم الفاتورة</th>
                  <th className="py-2.5">العميل</th>
                  <th className="py-2.5">التاريخ</th>
                  <th className="py-2.5 text-center">طريقة الدفع</th>
                  <th className="py-2.5 text-left">المبلغ الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lastInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400">
                      لا توجد فواتير مسجلة حتى الآن.
                    </td>
                  </tr>
                ) : (
                  lastInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 transition-all font-medium text-[#2D3142]">
                      <td className="py-3 font-mono font-bold text-[#2E86AB]">{inv.invoiceNumber}</td>
                      <td className="py-3">{inv.customerName || 'عميل نقدي'}</td>
                      <td className="py-3 font-mono text-xs text-gray-500">{inv.date}</td>
                      <td className="py-3 text-center">
                        {inv.paymentType === 'cash' && (
                          <span className="text-xs bg-emerald-50 text-[#4CAF50] px-2 py-1 rounded-md">نقدي</span>
                        )}
                        {inv.paymentType === 'credit' && (
                          <span className="text-xs bg-rose-50 text-[#E63946] px-2 py-1 rounded-md">آجل</span>
                        )}
                        {inv.paymentType === 'partial' && (
                          <span className="text-xs bg-amber-50 text-[#FF9800] px-2 py-1 rounded-md">جزئي</span>
                        )}
                      </td>
                      <td className="py-3 text-left font-mono text-[#2D3142]">
                        {inv.total.toLocaleString('en-US')} ج.م
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Activity Logs */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#2D3142] flex items-center gap-2">
            <History className="text-[#1E2A3A]" size={20} />
            سجل حركة المعاملات الأخيرة
          </h2>
          <button 
            onClick={() => onNavigate('transactions')}
            className="text-xs text-[#2E86AB] hover:underline hover:text-[#1E2A3A] font-bold cursor-pointer"
          >
            السجل الكامل ←
          </button>
        </div>

        <div className="space-y-3">
          {lastTransactions.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              لا توجد معاملات مسجلة في السجل.
            </div>
          ) : (
            lastTransactions.map((tx) => (
              <div 
                key={tx.id} 
                className="flex items-center justify-between p-3 border-r-3 border-gray-300 bg-gray-50/50 hover:bg-gray-50 rounded-l-xl transition-all"
                style={{ 
                  borderColor: 
                    tx.type === 'sale' ? '#4CAF50' : 
                    tx.type === 'debt_payment' ? '#2E86AB' : 
                    tx.type === 'add_stock' ? '#FF9800' : '#2D3142'
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="text-xs font-mono text-gray-400 truncate shrink-0">
                    {tx.date}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-800 text-sm">{tx.description}</span>
                    <span className="mx-2 text-gray-300">•</span>
                    <span className="text-xs text-gray-500 bg-gray-200/60 px-2 py-0.5 rounded-md flex-inline items-center gap-1">
                      <UserCheck size={10} className="inline mr-0.5 -mt-0.5" />
                      {tx.username}
                    </span>
                  </div>
                </div>
                <div className="font-mono font-bold text-sm text-[#2D3142] shrink-0 mr-4">
                  {tx.amount > 0 ? `+${tx.amount}` : tx.amount} ج.م
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
