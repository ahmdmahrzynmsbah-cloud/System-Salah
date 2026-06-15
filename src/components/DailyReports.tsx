import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarDays, 
  ChevronDown, 
  ChevronUp,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
  Search,
  Banknote
} from 'lucide-react';
import { 
  subscribeToStore, 
  Invoice,
  Expense
} from '../db';

interface DailyReportsProps {
  onToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  currentUser: { username: string; role: 'admin' | 'employee' } | null;
}

interface DayStats {
  date: string; // dd/mm/yyyy
  totalSales: number; // total field
  totalCash: number; // paidAmount field
  totalDebt: number; // remainingAmount field
  totalExpenses: number; // amount field
  invoices: Invoice[];
  expenses: Expense[];
}

export default function DailyReports({ onToast, currentUser }: DailyReportsProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubInvoices = subscribeToStore("invoices", (data: Invoice[]) => {
      setInvoices(data);
    });

    const unsubExpenses = subscribeToStore("expenses", (data: Expense[]) => {
      setExpenses(data);
    });

    return () => {
      unsubInvoices();
      unsubExpenses();
    };
  }, []);

  const groupedData = useMemo(() => {
    const groups: Record<string, DayStats> = {};

    invoices.forEach(inv => {
      const datePart = inv.date.split(' ')[0]; 
      if (!groups[datePart]) {
        groups[datePart] = { date: datePart, totalSales: 0, totalCash: 0, totalDebt: 0, totalExpenses: 0, invoices: [], expenses: [] };
      }
      groups[datePart].invoices.push(inv);
      groups[datePart].totalSales += inv.total;
      groups[datePart].totalCash += inv.paidAmount;
      groups[datePart].totalDebt += inv.remainingAmount;
    });

    expenses.forEach(exp => {
      const datePart = exp.date.split(' ')[0]; 
      if (!groups[datePart]) {
        groups[datePart] = { date: datePart, totalSales: 0, totalCash: 0, totalDebt: 0, totalExpenses: 0, invoices: [], expenses: [] };
      }
      groups[datePart].expenses.push(exp);
      groups[datePart].totalExpenses += exp.amount;
    });

    const sortedArray = Object.values(groups).sort((a, b) => {
      const [d1, m1, y1] = a.date.split('/');
      const [d2, m2, y2] = b.date.split('/');
      const dateA = new Date(Number(y1), Number(m1) - 1, Number(d1)).getTime();
      const dateB = new Date(Number(y2), Number(m2) - 1, Number(d2)).getTime();
      return dateB - dateA; // newest first
    });

    return sortedArray;
  }, [invoices, expenses]);

  useEffect(() => {
    // Auto expand the first day (today usually)
    if (groupedData.length > 0 && Object.keys(expandedDays).length === 0) {
      setExpandedDays({ [groupedData[0].date]: true });
    }
  }, [groupedData]);

  const toggleDayRow = (date: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const filteredData = groupedData.filter(dayInfo => {
    if (!searchQuery) return true;
    const [y, m, d] = searchQuery.split('-');
    const formattedDate = `${d}/${m}/${y}`;
    return dayInfo.date === formattedDate;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100">
        <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <CalendarDays size={24} />
          </div>
          التقارير اليومية (المبيعات والمصروفات)
        </h2>
        <p className="text-sm text-gray-500 font-medium pr-12 mt-1">
          إجمالي المبيعات، المحصلات النقدية، الديون، والمصروفات لكل يوم مع التفاصيل كاملة.
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-sm font-bold text-gray-700 whitespace-nowrap">تحديد التاريخ:</label>
          <input 
            type="date" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-48 bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono"
            dir="rtl"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="px-3 py-2 bg-gray-100 hover:bg-rose-50 text-gray-600 hover:text-rose-600 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              إلغاء التصفية
            </button>
          )}
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 flex flex-col items-center justify-center p-12 text-gray-400">
          <CalendarDays size={48} className="text-gray-300 stroke-1 mb-4" />
          <p className="text-base font-medium text-gray-500 text-center">لا توجد تقارير مطابقة للبحث</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredData.map(dayInfo => (
            <div key={dayInfo.date} className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden text-right">
              
              {/* Day Header */}
              <div 
                onClick={() => toggleDayRow(dayInfo.date)}
                className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors border-b border-transparent"
                style={{ borderBottomColor: expandedDays[dayInfo.date] ? '#f3f4f6' : 'transparent' }}
              >
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className={`p-2 rounded-lg transition-transform ${expandedDays[dayInfo.date] ? 'rotate-180 bg-gray-100' : 'bg-gray-50'}`}>
                    <ChevronDown className="text-gray-500" size={18} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 font-mono tracking-tight">{dayInfo.date}</h3>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-6 w-full sm:w-auto">
                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <TrendingUp className="text-emerald-500" size={18} />
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold leading-none mb-1">المبيعات الكلية</p>
                      <p className="text-sm font-black font-mono text-emerald-600 leading-none">{dayInfo.totalSales.toLocaleString()} <span className="text-[10px] font-sans font-normal text-emerald-500">ج.م</span></p>
                    </div>
                  </div>
                  
                  <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>

                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <Wallet className="text-blue-500" size={18} />
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold leading-none mb-1">الدخل النقدي</p>
                      <p className="text-sm font-black font-mono text-blue-600 leading-none">{dayInfo.totalCash.toLocaleString()} <span className="text-[10px] font-sans font-normal text-blue-500">ج.م</span></p>
                    </div>
                  </div>

                  <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>

                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <TrendingDown className="text-rose-500" size={18} />
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold leading-none mb-1">ديون المعاملات</p>
                      <p className="text-sm font-black font-mono text-rose-600 leading-none">{dayInfo.totalDebt.toLocaleString()} <span className="text-[10px] font-sans font-normal text-rose-500">ج.م</span></p>
                    </div>
                  </div>

                  <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>

                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <Banknote className="text-orange-500" size={18} />
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold leading-none mb-1">المصروفات اليومية</p>
                      <p className="text-sm font-black font-mono text-orange-600 leading-none">{dayInfo.totalExpenses.toLocaleString()} <span className="text-[10px] font-sans font-normal text-orange-500">ج.م</span></p>
                    </div>
                  </div>

                  <div className="w-px h-8 bg-gray-200 hidden md:block"></div>
                  
                  <div className="mt-2 md:mt-0 px-2.5 py-1 bg-slate-100 rounded-md shadow-inner text-center">
                    <p className="text-[10px] text-gray-500 font-bold leading-none mb-1">صافي الدرج الفعلي</p>
                    <p className="text-sm font-black font-mono text-slate-700 leading-none">{(dayInfo.totalCash - dayInfo.totalExpenses).toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-500">ج.م</span></p>
                  </div>
                </div>
              </div>

              {/* Day Details (Invoices and Expenses) */}
              {expandedDays[dayInfo.date] && (
                <div className="bg-slate-50/50 p-4 border-t border-gray-100 flex flex-col gap-6">
                  {/* Invoices */}
                  {dayInfo.invoices.length > 0 ? (
                    <div>
                      <h4 className="font-bold text-sm text-gray-600 mb-2 flex items-center gap-1"><Receipt size={16} /> الفواتير ({dayInfo.invoices.length})</h4>
                      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                        <table className="w-full text-right text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3 font-semibold text-gray-600">رقم وساعات الفاتورة</th>
                              <th className="px-4 py-3 font-semibold text-gray-600">العميل</th>
                              <th className="px-4 py-3 font-semibold text-gray-600 text-center">عناصر</th>
                              <th className="px-4 py-3 font-semibold text-gray-600">الإجمالي</th>
                              <th className="px-4 py-3 font-semibold text-gray-600">المدفوع نقداً</th>
                              <th className="px-4 py-3 font-semibold text-gray-600">المتبقي (آجل)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {dayInfo.invoices.map(inv => (
                              <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Receipt className="text-gray-400" size={14} />
                                    <span className="font-mono font-bold text-gray-700">{inv.invoiceNumber}</span>
                                    <span className="text-xs text-gray-400">({inv.date.split(' ')[1]} {inv.date.split(' ')[2]})</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-800">
                                  {inv.customerName || 'عميل نقدي (بدون اسم)'}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-500 font-mono">
                                  {inv.items.length}
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-gray-900">
                                  {inv.total.toLocaleString()} <span>ج.م</span>
                                </td>
                                <td className="px-4 py-3 font-mono text-emerald-600 font-semibold">
                                  {inv.paidAmount > 0 ? `${inv.paidAmount.toLocaleString()} ج.م` : '-'}
                                </td>
                                <td className="px-4 py-3 font-mono text-rose-500 font-semibold">
                                  {inv.remainingAmount > 0 ? `${inv.remainingAmount.toLocaleString()} ج.م` : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 font-medium">لا توجد مبيعات في هذا اليوم.</p>
                  )}

                  {/* Expenses */}
                  {dayInfo.expenses.length > 0 && (
                    <div>
                      <h4 className="font-bold text-sm text-gray-600 mb-2 flex items-center gap-1"><Banknote size={16} /> المصروفات ({dayInfo.expenses.length})</h4>
                      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                        <table className="w-full text-right text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3 font-semibold text-gray-600 w-1/4">الوقت</th>
                              <th className="px-4 py-3 font-semibold text-gray-600 w-2/4">الوصف</th>
                              <th className="px-4 py-3 font-semibold text-gray-600 w-1/4">المبلغ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {dayInfo.expenses.map(exp => (
                              <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2 text-gray-500 font-mono">
                                    <span>{exp.date.split(' ')[1]} {exp.date.split(' ')[2]}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-bold text-gray-800">
                                  {exp.description}
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-orange-600">
                                  {exp.amount.toLocaleString()} <span>ج.م</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                </div>
              )}

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
