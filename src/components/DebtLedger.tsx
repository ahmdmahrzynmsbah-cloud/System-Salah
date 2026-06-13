import React, { useState, useEffect } from 'react';
import { 
  Search, 
  CreditCard, 
  DollarSign, 
  Eye, 
  UserPlus, 
  BookOpen, 
  X,
  FileText,
  PlusCircle,
  Calendar,
  Check
} from 'lucide-react';
import { 
  getAllRecords, 
  updateRecord, 
  deleteRecord, 
  addRecord, 
  Debt, 
  Invoice 
} from '../db';

interface DebtLedgerProps {
  onAddLog: (type: 'sale' | 'debt_payment' | 'add_stock' | 'edit_price' | 'system', description: string, amount: number) => Promise<void>;
  currentUser: { username: string; role: 'admin' | 'employee' } | null;
  onToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function DebtLedger({ onAddLog, currentUser, onToast }: DebtLedgerProps) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedDebtor, setSelectedDebtor] = useState<Debt | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  // Register payment form
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    loadLedgerData();
  }, []);

  const loadLedgerData = async () => {
    try {
      const allDebts = await getAllRecords("debtLedger");
      const allBills = await getAllRecords("invoices");
      setDebts(allDebts);
      setInvoices(allBills);
    } catch (e) {
      console.error(e);
    }
  };

  // Sum of all outstanding debts
  const totalOutstandingDebts = debts.reduce((sum, d) => sum + d.totalDebt, 0);

  // Search filtered list
  const filteredDebts = debts.filter(d => 
    d.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.customerPhone && d.customerPhone.includes(searchQuery))
  );

  const handleOpenDetails = (debtor: Debt) => {
    setSelectedDebtor(debtor);
    setIsDetailsOpen(true);
  };

  const handleOpenPayment = (debtor: Debt) => {
    setSelectedDebtor(debtor);
    setPaymentAmount(debtor.totalDebt); // Default to full payment
    setPaymentNotes('');
    setIsPaymentOpen(true);
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtor) return;

    const payVal = Number(paymentAmount);
    if (isNaN(payVal) || payVal <= 0) {
      onToast("يرجى إدخال مبلغ دفع صالح أكبر من الصفر", "warning");
      return;
    }

    if (payVal > selectedDebtor.totalDebt) {
      onToast("المبلغ المدفوع أكبر من إجمالي الدين المسجل له!", "warning");
    }

    try {
      const remainingDebt = Math.max(0, selectedDebtor.totalDebt - payVal);
      
      // Update Debt record (or delete it if settled, or keep at 0. Let's keep it and set to 0 as requested for color indicator)
      await updateRecord("debtLedger", selectedDebtor.id, {
        ...selectedDebtor,
        totalDebt: remainingDebt
      });

      // Update historic credit invoices of this customer to record payment progress (Optional but elegant)
      // Filter invoices for this client that have a remainingAmount > 0
      const customerInvoices = invoices.filter(inv => 
        (inv.customerPhone && inv.customerPhone === selectedDebtor.customerPhone) || 
        inv.customerName.toLowerCase() === selectedDebtor.customerName.toLowerCase()
      );

      let allocatedAmount = payVal;
      for (const inv of customerInvoices) {
        if (allocatedAmount <= 0) break;
        if (inv.remainingAmount > 0) {
          const deduction = Math.min(inv.remainingAmount, allocatedAmount);
          const newRemaining = inv.remainingAmount - deduction;
          const newPaid = inv.paidAmount + deduction;

          // If settled fully, we might adjust paymentType or keep it
          await updateRecord("invoices", inv.id, {
            ...inv,
            paidAmount: newPaid,
            remainingAmount: newRemaining,
            notes: inv.notes + ` | تم سداد جزء بقيمة ${deduction} ج.م بتاريخ اليوم`
          });

          allocatedAmount -= deduction;
        }
      }

      // Log Transaction
      const description = `سداد دفعة مديونية بقيمة ${payVal} ج.م من العميل ${selectedDebtor.customerName}. المتبقي له: ${remainingDebt} ج.م`;
      await onAddLog('debt_payment', description, payVal);

      onToast(`تم تسجيل دفعة بقيمة ${payVal} ج.م لصالح ${selectedDebtor.customerName}`, "success");
      setIsPaymentOpen(false);
      setSelectedDebtor(null);
      loadLedgerData();
    } catch (err) {
      console.error(err);
      onToast("خطأ أثناء تحصيل الدفعة", "error");
    }
  };

  // Get matching invoices for selected debtor in Details modal
  const getDebtorInvoices = () => {
    if (!selectedDebtor) return [];
    return invoices.filter(inv => 
      (selectedDebtor.customerPhone && inv.customerPhone === selectedDebtor.customerPhone) || 
      inv.customerName.toLowerCase() === selectedDebtor.customerName.toLowerCase()
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner with Total Sum */}
      <div className="bg-[#1E2A3A] p-6 rounded-2xl shadow-md text-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-[#A8DADC]">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold">دفتر مديونيات العملاء الآجلة</h1>
            <p className="text-gray-300 text-sm">متابعة حسابات الدفع الآجل للأقساط وفواتير الذمم</p>
          </div>
        </div>
        <div className="bg-white/10 px-5 py-3 rounded-xl border border-white/15 text-center">
          <p className="text-xs text-[#A8DADC] font-bold">إجمالي المطالبات المستحقة للمحل</p>
          <p className="text-2xl font-extrabold font-mono mt-0.5 mt-1">
            {totalOutstandingDebts.toLocaleString('en-US')} <span className="text-xs font-sans font-normal text-gray-300">ج.م</span>
          </p>
        </div>
      </div>

      {/* Control Actions (Searching) */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="ابحث عن عميل مدين بالاسم أو رقم الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm"
          />
          <span className="absolute inset-y-0 right-3 flex items-center text-gray-400">
            <Search size={18} />
          </span>
        </div>
        <span className="text-xs font-semibold text-gray-400">
          إجمالي المسجلين بالدفتر: {debts.length} عملاء
        </span>
      </div>

      {/* Debts Table Block */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-[#F0F4F8] text-[#2D3142] font-bold">
              <tr className="border-b border-gray-100">
                <th className="p-4">اسم العميل بالكامل</th>
                <th className="p-4">رقم الجوال</th>
                <th className="p-4">آخر مطالبة مالية</th>
                <th className="p-4 text-center">حالة الحساب</th>
                <th className="p-4 text-left">قيمة المديونية الحالية</th>
                <th className="p-4 text-center">خيارات الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-[#2D3142]">
              {filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-400">
                    لا تتوفر مديونيات مسجلة مطابقة للبحث.
                  </td>
                </tr>
              ) : (
                filteredDebts.map((d) => {
                  // Color statuses: Green (settled/0), Orange (partial, but has debt), Red (high debt/no pay)
                  // Let's check status
                  let statusText = 'غير مسدد';
                  let statusColor = 'bg-rose-50 text-[#E63946] border border-rose-100';

                  if (d.totalDebt === 0) {
                    statusText = 'مسدد بالكامل';
                    statusColor = 'bg-emerald-50 text-[#4CAF50] border border-emerald-100';
                  } else {
                    // Check if they paid parts of some invoices to indicate a partial state or simple warning
                    const civs = invoices.filter(inv => 
                      inv.customerName.toLowerCase() === d.customerName.toLowerCase()
                    );
                    const hasPaidPart = civs.some(inv => inv.paymentType === 'partial' || inv.paidAmount > 0);
                    if (hasPaidPart) {
                      statusText = 'مسدد جزئي';
                      statusColor = 'bg-amber-50 text-[#FF9800] border border-amber-100';
                    }
                  }

                  return (
                    <tr key={d.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="p-4 font-bold text-gray-800">{d.customerName}</td>
                      <td className="p-4 font-mono text-gray-500">{d.customerPhone || 'غير متوفر'}</td>
                      <td className="p-4 text-xs font-mono text-gray-400">{d.lastInvoiceDate || 'غير متوفر'}</td>
                      <td className="p-4 text-center">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${statusColor}`}>
                          {statusText}
                        </span>
                      </td>
                      <td className="p-4 text-left font-mono font-bold text-base text-[#2D3142]">
                        {d.totalDebt.toLocaleString('en-US')} ج.م
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center items-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetails(d)}
                            className="px-3 py-1.5 hover:bg-neutral-100 text-[#2E86AB] hover:text-[#1E2A3A] text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-neutral-100 bg-white shadow-xs"
                          >
                            <Eye size={13} />
                            عرض السجل
                          </button>
                          {d.totalDebt > 0 && (
                            <button
                              onClick={() => handleOpenPayment(d)}
                              className="px-3 py-1.5 bg-[#4CAF50] text-white hover:bg-[#3d8c40] text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <DollarSign size={13} />
                              دفع دفعة
                            </button>
                          )}
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

      {/* MODAL: Customer Debt Invoice History Details */}
      {isDetailsOpen && selectedDebtor && (
        <div 
          onClick={() => {
            setIsDetailsOpen(false);
            setSelectedDebtor(null);
          }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-xl text-right animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="bg-[#1E2A3A] p-5 text-white flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <FileText size={18} className="text-[#A8DADC]" />
                سجل فواتير العميل المدين: {selectedDebtor.customerName}
              </h3>
              <button 
                onClick={() => {
                  setIsDetailsOpen(false);
                  setSelectedDebtor(null);
                }}
                className="text-gray-300 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[450px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-xs bg-neutral-50 p-4 border border-gray-100 rounded-xl">
                <div>
                  <span className="text-gray-400 block mb-1">اسم العميل:</span>
                  <strong className="text-gray-800 text-sm">{selectedDebtor.customerName}</strong>
                </div>
                <div>
                  <span className="text-gray-400 block mb-1">رقم الهاتف:</span>
                  <strong className="text-gray-800 text-sm font-mono">{selectedDebtor.customerPhone || 'غير مطروح'}</strong>
                </div>
              </div>

              <h4 className="font-bold text-sm text-[#2D3142] border-b pb-1.5 flex items-center gap-1.5">
                <span>الفواتير المرتبطة وحالة سدادها:</span>
              </h4>

              <div className="space-y-3">
                {getDebtorInvoices().length === 0 ? (
                  <p className="text-center text-gray-400 py-6 text-sm">لم يعثر نظام الفوترة على فواتير مسجلة باسم هذا العميل.</p>
                ) : (
                  getDebtorInvoices().map((inv) => (
                    <div 
                      key={inv.id} 
                      className="border border-gray-100 rounded-xl hover:border-gray-200 p-4 bg-white shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#2E86AB]">{inv.invoiceNumber}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-400 font-mono">{inv.date}</span>
                        </div>
                        <div className="mt-1.5 text-gray-500 font-medium">
                          السلع: {inv.items.map(it => `${it.name} (×${it.quantity})`).join('، ')}
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="font-mono font-bold text-sm text-gray-800">إجمالي: {inv.total} ج.م</div>
                        <div className="flex gap-2 text-[10px] text-gray-400 mt-1">
                          <span>المدفوع: {inv.paidAmount} ج.م</span>
                          <span>|</span>
                          <span className="text-[#E63946] font-semibold">المتبقي: {inv.remainingAmount} ج.م</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="bg-neutral-50 px-6 py-4 flex justify-between items-center border-t border-gray-100">
              <span className="text-xs text-gray-500 font-bold">
                إجمالي الدين الفعلي له: "{selectedDebtor.totalDebt} ج.م"
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsDetailsOpen(false);
                  setSelectedDebtor(null);
                }}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Record Debt Payment */}
      {isPaymentOpen && selectedDebtor && (
        <div 
          onClick={() => {
            setIsPaymentOpen(false);
            setSelectedDebtor(null);
          }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl text-right animate-in fade-in zoom-in-95 duration-150 animate-duration-100"
          >
            <div className="bg-[#4CAF50] p-5 text-white flex items-center justify-between font-bold">
              <h3 className="text-lg flex items-center gap-2">
                <DollarSign size={20} />
                تسجيل دفعة مديونية جديدة
              </h3>
              <button 
                onClick={() => {
                  setIsPaymentOpen(false);
                  setSelectedDebtor(null);
                }}
                className="text-white/80 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRegisterPayment} className="p-6 space-y-4">
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 text-xs text-[#2D3142] space-y-1.5">
                <p><b>اسم العميل المستحق:</b> {selectedDebtor.customerName}</p>
                <p><b>إجمالي المديونية الحالية:</b> <strong className="text-base text-[#4CAF50] font-mono">{selectedDebtor.totalDebt} ج.م</strong></p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-gray-600 text-sm font-semibold">المبلغ المسدد نقداً الآن (ج.م)</label>
                <input 
                  type="number" 
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-200 focus:border-[#4CAF50] outline-hidden rounded-xl text-lg font-mono text-emerald-600 font-bold"
                  max={selectedDebtor.totalDebt}
                  min={1}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-gray-600 text-sm font-semibold">ملاحظات التحصيل (اختياري)</label>
                <textarea 
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="سداد قسط العميل خالد كاش"
                  rows={2}
                  className="px-4 py-2 border border-gray-200 outline-hidden rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-start gap-2.5 pt-4 border-t border-gray-100Header justify-start">
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#4CAF50] hover:bg-emerald-600 text-white font-bold rounded-xl text-sm cursor-pointer transition-colors shadow-sm"
                >
                  تسجيل الدفعة السدادية
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPaymentOpen(false);
                    setSelectedDebtor(null);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm cursor-pointer transition-colors"
                >
                  إلغاء الأمر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
