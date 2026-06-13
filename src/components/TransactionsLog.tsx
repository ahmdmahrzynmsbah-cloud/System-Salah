import React, { useState, useEffect } from 'react';
import { 
  Search, 
  History, 
  Download, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertCircle,
  Database,
  Calendar,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { getAllRecords, Transaction } from '../db';

interface TransactionsLogProps {
  onToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function TransactionsLog({ onToast }: TransactionsLogProps) {
  const [logs, setLogs] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState<string>('الكل');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const data = await getAllRecords("transactions");
      setLogs(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Convert English tags to Arabic displays
  const getArabicTypeLabel = (type: string) => {
    switch (type) {
      case 'sale': return 'فاتورة بيع';
      case 'debt_payment': return 'سداد مديونية';
      case 'add_stock': return 'إضافة مخزون';
      case 'edit_price': return 'تعديل أسعار';
      case 'system': return 'عملية نظام';
      default: return type;
    }
  };

  // Clear filters
  const resetFilters = () => {
    setFilterType('الكل');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  // Export to CSV function (including UTF-8 BOM so MS Excel renders Arabic correctly)
  const handleExportCSV = () => {
    if (logs.length === 0) {
      onToast("لا توجد سجلات للتصدير حالياً", "warning");
      return;
    }

    const headers = ["المعرف", "التاريخ والوقت", "النوع", "الوصف", "المبلغ (ج.م)", "المسؤول"];
    
    const rows = filteredLogs.map(log => [
      log.id || '',
      log.date,
      getArabicTypeLabel(log.type),
      log.description.replace(/,/g, ' - '), // avoid separating cells early
      log.amount,
      log.username
    ]);

    // Construct comma-separated text
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    // Add UTF-8 BOM prefix (\uFEFF)
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `سجل_معاملات_المخازن_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    onToast("تم تصدير ملف الـ CSV بنجاح!", "success");
  };

  // Parsing dates and filtering helper
  const filteredLogs = logs.filter(log => {
    // Type filter
    if (filterType !== 'الكل' && log.type !== filterType) {
      return false;
    }

    // Date filters (Log dates are in format DD/MM/YYYY HH:MM)
    // Extract DD/MM/YYYY
    const logDatePart = log.date.split(' ')[0]; // DD/MM/YYYY
    const [day, month, year] = logDatePart.split('/');
    // Formulate JS Date objects
    const logJsDate = new Date(Number(year), Number(month) - 1, Number(day));

    if (filterStartDate) {
      const startObj = new Date(filterStartDate);
      startObj.setHours(0,0,0,0);
      if (logJsDate < startObj) return false;
    }

    if (filterEndDate) {
      const endObj = new Date(filterEndDate);
      endObj.setHours(23,59,59,999);
      if (logJsDate > endObj) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Filtering Box Card */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-4">
        <h3 className="font-bold text-[#2D3142] text-sm flex items-center gap-2">
          <Filter size={16} className="text-[#2E86AB]" />
          فلترة وعرض سجل المعاملات والعمليات
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          {/* Type filter */}
          <div className="flex flex-col gap-1.5 text-xs text-gray-500 font-semibold">
            <span>نوع المعاملة:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-200 bg-white font-medium rounded-xl text-xs sm:text-sm focus:border-[#2E86AB] cursor-pointer"
            >
              <option value="الكل">كل المعاملات الإطارية</option>
              <option value="sale">فاتورة مبيعات بيع (Sale)</option>
              <option value="debt_payment">تلقي سداد مديونية (Debt Pay)</option>
              <option value="add_stock">إضافة مخزون للمستودع (Inventory)</option>
              <option value="edit_price">تعديل أسعار قطع (Pricing)</option>
              <option value="system">عمليات النظام العامة (System)</option>
            </select>
          </div>

          {/* Start date */}
          <div className="flex flex-col gap-1.5 text-xs text-gray-500 font-semibold">
            <span>التاريخ من:</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 font-medium rounded-xl text-xs sm:text-sm focus:border-[#2E86AB] cursor-pointer"
            />
          </div>

          {/* End date */}
          <div className="flex flex-col gap-1.5 text-xs text-gray-500 font-semibold">
            <span>التاريخ إلى:</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 font-medium rounded-xl text-xs sm:text-sm focus:border-[#2E86AB] cursor-pointer"
            />
          </div>

          {/* Buttons action */}
          <div className="flex gap-2">
            <button
              onClick={resetFilters}
              className="flex-1 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-gray-600 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
            >
              إعادة تعيين الفلاتر
            </button>
            <button
              onClick={handleExportCSV}
              className="flex-1 px-3 py-2 bg-[#1E2A3A] hover:bg-[#2E86AB] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-xs"
            >
              <FileSpreadsheet size={13} />
              تصدير CSV
            </button>
          </div>
        </div>
      </div>

      {/* Main Table logs list */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-neutral-50/50">
          <h2 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
            <History size={16} className="text-[#2E86AB]" />
            الأرشيف المرجعي للمعاملات الفورية
          </h2>
          <span className="text-xs bg-gray-200 text-gray-700 px-3 py-0.5 rounded-full font-bold">
            عدد السجلات: {filteredLogs.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-gray-500 font-semibold">
              <tr className="border-b border-gray-100">
                <th className="p-4">تاريخ المرجعية</th>
                <th className="p-4">نوع العملية</th>
                <th className="p-4">تفاصيل العملية / الوصف</th>
                <th className="p-4 text-center">الكاشير / المسؤول</th>
                <th className="p-4 text-left">مجموع القيمة المالية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-20 text-gray-400 text-sm">
                    لا توجد معاملات مسجلة بالفترات المختارة.
                  </td>
                </tr>
              ) : (
                [...filteredLogs].reverse().map((log) => {
                  let typeColor = 'bg-blue-50 text-blue-700 border border-blue-100';
                  if (log.type === 'sale') typeColor = 'bg-emerald-50 text-emerald-800 border border-emerald-100';
                  if (log.type === 'debt_payment') typeColor = 'bg-blue-50 text-[#2E86AB] border border-[#2E86AB]/10';
                  if (log.type === 'add_stock') typeColor = 'bg-amber-50 text-amber-700 border border-amber-100';
                  if (log.type === 'edit_price') typeColor = 'bg-purple-50 text-purple-700 border border-purple-100';
                  if (log.type === 'system') typeColor = 'bg-neutral-50 text-neutral-800 border border-neutral-100';

                  return (
                    <tr key={log.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="p-4 font-mono text-xs text-gray-500">{log.date}</td>
                      <td className="p-4">
                        <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${typeColor}`}>
                          {getArabicTypeLabel(log.type)}
                        </span>
                      </td>
                      <td className="p-4 text-gray-800 max-w-sm font-semibold text-xs leading-5">
                        {log.description}
                      </td>
                      <td className="p-4 text-center text-xs text-gray-400">
                        {log.username}
                      </td>
                      <td className="p-4 text-left font-mono font-bold text-sm text-[#2D3142]">
                        {log.amount > 0 ? (
                          <span className="text-[#4CAF50]">{log.amount.toLocaleString('en-US')} ج.م</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
