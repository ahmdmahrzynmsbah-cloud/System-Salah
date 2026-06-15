import React, { useState, useEffect } from 'react';
import { 
  Banknote, 
  Search,
  Plus,
  Trash2
} from 'lucide-react';
import { 
  getAllRecords, 
  addRecord, 
  deleteRecord, 
  subscribeToStore,
  Expense,
  User
} from '../db';

interface ExpensesProps {
  onToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  currentUser: User | null;
  onAddLog: (actionType: any, desc: string, amount: number) => Promise<void>;
}

export default function Expenses({ onToast, currentUser, onAddLog }: ExpensesProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  useEffect(() => {
    const unsub = subscribeToStore("expenses", (data: Expense[]) => {
      // Sort by newest first
      data.sort((a, b) => {
        // Since dates are DD/MM/YYYY hh:mm:ss A, simple string comparison might fail. 
        // Real parsing is better but we'll try to sort roughly by length/id or rely on creation order
        return (b.id || "").localeCompare(a.id || ""); 
      });
      setExpenses(data);
    });
    return () => unsub();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      onToast('الرجاء إدخال مبلغ صحيح', 'error');
      return;
    }
    if (!description.trim()) {
      onToast('الرجاء إدخال وصف المصروف', 'error');
      return;
    }

    try {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; 
      const strTime = hours + ':' + minutes + ' ' + ampm;
      const dateStr = `${dd}/${mm}/${yyyy} ${strTime}`;

      const newExpense: Expense = {
        date: dateStr,
        amount: Number(amount),
        description: description.trim(),
        username: currentUser?.username || 'admin',
      };

      await addRecord("expenses", newExpense);
      await onAddLog('system', `تم تسجيل مصروف: ${description} بقيمة ${amount} ج.م`, Number(amount));
      onToast('تم تسجيل المصروف بنجاح', 'success');
      
      setIsAddModalOpen(false);
      setAmount('');
      setDescription('');
    } catch (err) {
      console.error(err);
      onToast('حدث خطأ أثناء حفظ المصروف', 'error');
    }
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete || !expenseToDelete.id) return;
    try {
      await deleteRecord("expenses", expenseToDelete.id);
      await onAddLog('system', `حذف مصروف: ${expenseToDelete.description} بقيمة ${expenseToDelete.amount}`, 0);
      onToast("تم حذف المصروف بنجاح", "success");
      setExpenseToDelete(null);
    } catch (err) {
      console.error(err);
      onToast("حدث خطأ أثناء الحذف", "error");
    }
  };

  const filteredExpenses = expenses.filter(exp => 
    exp.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
    exp.date.includes(searchQuery)
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header section with Stats */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Banknote size={24} />
            </div>
            المصروفات الجانبية
          </h2>
          <p className="text-sm text-gray-500 font-medium pr-12 mt-1">تتبع وإدارة جميع المصاريف (سحب درج، مصاريف نثرية، إلخ)</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
          >
            <Plus size={18} />
            إضافة مصروف جديد
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="البحث في المصروفات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50/50 border border-gray-200 rounded-xl pr-10 pl-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium"
          />
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400">
            <Banknote size={48} className="text-gray-300 stroke-1 mb-4" />
            <p className="text-base font-medium text-gray-500 text-center">لا توجد مصروفات مسجلة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="py-4 px-6 font-bold text-gray-600 text-sm whitespace-nowrap">التاريخ</th>
                  <th className="py-4 px-6 font-bold text-gray-600 text-sm">الوصف / البيان</th>
                  <th className="py-4 px-6 font-bold text-gray-600 text-sm">القيمة (ج.م)</th>
                  <th className="py-4 px-6 font-bold text-gray-600 text-sm">المستخدم</th>
                  <th className="py-4 px-6 font-bold text-gray-600 text-sm text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 border-l-[3px] border-l-transparent hover:border-l-emerald-500 transition-colors">
                    <td className="py-3 px-6 text-sm font-mono text-gray-500 whitespace-nowrap">{exp.date}</td>
                    <td className="py-3 px-6">
                      <p className="text-sm font-bold text-gray-800">{exp.description}</p>
                    </td>
                    <td className="py-3 px-6">
                      <span className="font-mono text-sm font-bold bg-neutral-100 text-neutral-800 px-2 py-1 rounded-md">
                        {exp.amount.toLocaleString('en-US')}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-sm whitespace-nowrap text-gray-500">{exp.username}</td>
                    <td className="py-3 px-6 text-center">
                      <button 
                        onClick={() => setExpenseToDelete(exp)}
                        className="p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 flex flex-col">
            <div className="p-5 bg-gradient-to-l from-emerald-50 to-white border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-black text-gray-800 flex items-center gap-2 text-lg">
                <Banknote className="text-emerald-600" size={20} />
                تسجيل مصروف جديد
              </h3>
            </div>
            
            <form onSubmit={handleCreateExpense} className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[80vh]">
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">قيمة المصروف (ج.م)</label>
                <input 
                  type="number"
                  required
                  min="0.1"
                  step="any"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-emerald-500/30 outline-none font-mono font-bold"
                  placeholder="مثال: 150"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">بيان / سبب الصرف</label>
                <textarea 
                  required
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-emerald-500/30 outline-none resize-none"
                  placeholder="مثال: مصاريف بوفيه، سحب لـ ..."
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 text-gray-500 hover:bg-gray-100 rounded-xl font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex justify-center items-center gap-2"
                >
                  <Banknote size={18} />
                  حفظ وتسجيل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-auto shadow-2xl border border-gray-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">تأكيد حذف المصروف</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              هل أنت متأكد من حذف المصروف ("{expenseToDelete.description}") بقيمة {expenseToDelete.amount} ج.م؟
            </p>
            <div className="flex w-full gap-3">
              <button 
                onClick={() => setExpenseToDelete(null)}
                className="flex-1 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-colors cursor-pointer"
              >
                تراجع
              </button>
              <button 
                onClick={confirmDeleteExpense}
                className="flex-1 py-2.5 text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-500/20 rounded-xl font-bold transition-all cursor-pointer"
              >
                نعم، احذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
