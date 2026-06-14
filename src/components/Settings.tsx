import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  MapPin, 
  Phone, 
  Tag, 
  User, 
  Lock, 
  Download, 
  Trash2, 
  Plus, 
  CheckCircle,
  Clock,
  Printer,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { 
  getAllRecords, 
  addRecord, 
  deleteRecord, 
  updateRecord, 
  clearAllCollections,
  AppSettings, 
  User as UserDB
} from '../db';

interface SettingsProps {
  onAddLog: (type: 'sale' | 'debt_payment' | 'add_stock' | 'edit_price' | 'system', description: string, amount: number) => Promise<void>;
  currentUser: { username: string; role: 'admin' | 'employee' } | null;
  onToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  shopSettings: AppSettings;
  onSettingsUpdated: () => void;
}

export default function Settings({ 
  onAddLog, 
  currentUser, 
  onToast, 
  shopSettings, 
  onSettingsUpdated 
}: SettingsProps) {

  const [users, setUsers] = useState<UserDB[]>([]);

  // Store settings inputs
  const [storeName, setStoreName] = useState(shopSettings.storeName);
  const [storeAddress, setStoreAddress] = useState(shopSettings.storeAddress);
  const [storePhone, setStorePhone] = useState(shopSettings.storePhone);
  const [storeLogoText, setStoreLogoText] = useState(shopSettings.storeLogoText);
  const [welcomeText, setWelcomeText] = useState(shopSettings.welcomeText);
  const [paperSize, setPaperSize] = useState<'A4' | '80mm'>(shopSettings.paperSize);
  
  const [invoiceSubtitle, setInvoiceSubtitle] = useState(shopSettings.invoiceSubtitle || '');
  const [invoiceSubtitle2, setInvoiceSubtitle2] = useState(shopSettings.invoiceSubtitle2 || '');
  const [invoicePhone1, setInvoicePhone1] = useState(shopSettings.invoicePhone1 || '');
  const [invoicePhone2, setInvoicePhone2] = useState(shopSettings.invoicePhone2 || '');
  const [systemName, setSystemName] = useState(shopSettings.systemName || 'نظام المبيعات والمخزون');

  // User list additions
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'employee'>('employee');

  // User editing states
  const [editingUser, setEditingUser] = useState<UserDB | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editUserRole, setEditUserRole] = useState<'admin' | 'employee'>('employee');
  const [userToDelete, setUserToDelete] = useState<UserDB | null>(null);

  // Change password inputs
  const [oldPassword, setOldPassword] = useState('');
  const [newPasswordCurrent, setNewPasswordCurrent] = useState('');

  // Reset system inputs
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetCode, setResetCode] = useState('');

  useEffect(() => {
    loadSettingsData();
  }, [shopSettings]);

  const loadSettingsData = async () => {
    try {
      const allUsers = await getAllRecords("users");
      setUsers(allUsers);
      
      // Auto-prefill the current active user's existing password so they don't have to guess or manually write it
      if (currentUser?.username) {
        const me = allUsers.find(u => u.username.toLowerCase() === currentUser.username.toLowerCase());
        if (me && me.password) {
          setOldPassword(me.password);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim() || !storePhone.trim()) {
      onToast("اسم المتجر ورقم الهاتف مطلوبان دائماً", "warning");
      return;
    }

    try {
      const updated: AppSettings = {
        id: "main",
        storeName: storeName.trim(),
        storeAddress: storeAddress.trim(),
        storePhone: storePhone.trim(),
        storeLogoText: storeLogoText.trim(),
        welcomeText: welcomeText.trim(),
        paperSize: paperSize,
        invoiceSubtitle: invoiceSubtitle.trim(),
        invoiceSubtitle2: invoiceSubtitle2.trim(),
        invoicePhone1: invoicePhone1.trim(),
        invoicePhone2: invoicePhone2.trim(),
        systemName: systemName.trim()
      };

      await updateRecord("settings", "main", updated);
      await onAddLog('system', `تحديث إعدادات المتجر وبيانات الفاتورة`, 0);
      onToast("تم حفظ إعدادات المتجر بنجاح", "success");
      onSettingsUpdated(); // Notify parent to reload settings
    } catch (err) {
      console.error(err);
      onToast("فشل الحفظ لقاعدة البيانات", "error");
    }
  };

  const handleAddNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== 'admin') {
      onToast("عذراً، إضافة مستخدمين جدد متاحة للمشرفين فقط", "error");
      return;
    }

    const cleanUsername = newUsername.trim();
    if (!cleanUsername || !newPassword) {
      onToast("يرجى ملء اسم المستخدم وكلمة المرور", "warning");
      return;
    }

    if (users.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      onToast("اسم المستخدم هذا مكرر وموجود مسبقاً", "error");
      return;
    }

    try {
      await addRecord("users", {
        username: cleanUsername,
        password: newPassword,
        role: newUserRole
      });

      await onAddLog('system', `إضافة مستخدم جديد للنظام باسم: ${cleanUsername} ودور ${newUserRole}`, 0);
      onToast(`تمت إضافة المستخدم ${cleanUsername} بنجاح`, "success");
      setNewUsername('');
      setNewPassword('');
      loadSettingsData();
    } catch (err) {
      onToast("فشل تسجيل مستخدم جديد", "error");
    }
  };

  const confirmDeleteUser = async (userToDeleteParam: UserDB) => {
    try {
      await deleteRecord("users", userToDeleteParam.id);
      await onAddLog('system', `حذف المستخدم: ${userToDeleteParam.username} من طاقم العمل`, 0);
      onToast("تم حذف المستخدم بنجاح", "success");
      loadSettingsData();
    } catch (e) {
      onToast("فشل حذف المستخدم", "error");
    } finally {
      setUserToDelete(null);
    }
  };

  const handleDeleteUser = (userToDeleteParam: UserDB) => {
    if (currentUser?.role !== 'admin') {
      onToast("هذا الإجراء متاح لمدير النظام الفعلي فقط", "error");
      return;
    }

    if (userToDeleteParam.username === currentUser.username) {
      onToast("لا يمكن حذف حسابك الفعلي الّذي تسجل به الدخول حالياً!", "error");
      return;
    }

    setUserToDelete(userToDeleteParam);
  };

  const handleStartEditUser = (user: UserDB) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditPassword(user.password || '');
    setEditUserRole(user.role);
  };

  const handleCancelEditUser = () => {
    setEditingUser(null);
    setEditUsername('');
    setEditPassword('');
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== 'admin') {
      onToast("تعديل حسابات العمل متاح للمشرفين فقط", "error");
      return;
    }

    const cleanUsername = editUsername.trim();
    if (!cleanUsername || !editPassword) {
      onToast("اسم المستخدم والرقم السري لا يمكن تركهما فارغين", "warning");
      return;
    }

    // Don't allow empty password or duplicates
    if (users.some(u => u.id !== editingUser?.id && u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      onToast("اسم المستخدم هذا مكرر وموجود لحساب آخر بالفعل", "error");
      return;
    }

    try {
      await updateRecord("users", editingUser?.id, {
        ...editingUser,
        username: cleanUsername,
        password: editPassword,
        role: editUserRole
      });

      await onAddLog('system', `تعديل بيانات حساب المستخدم: ${cleanUsername} (الصلاحية: ${editUserRole})`, 0);
      onToast(`تم تحديث حساب [${cleanUsername}] بنجاح!`, "success");
      setEditingUser(null);
      loadSettingsData();
    } catch (err) {
      onToast("حدث خطأ أثناء حفظ التعديلات", "error");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword.trim() || !newPasswordCurrent.trim()) {
      onToast("يرجى إدخال كلمة المرور القديمة والحديثة", "warning");
      return;
    }

    try {
      // Find current user object
      const dbUsers = await getAllRecords("users");
      const me = dbUsers.find(u => u.username.toLowerCase() === currentUser?.username?.toLowerCase());

      if (!me) {
        onToast("فشل العثور على الحساب الخاص بك", "error");
        return;
      }

      if (me.password !== oldPassword.trim()) {
        onToast("كلمة المرور القديمة غير صحيحة مطلقاً", "error");
        return;
      }

      await updateRecord("users", me.id, {
        ...me,
        password: newPasswordCurrent.trim()
      });

      onToast("تم تحديث كلمة مرور حسابك بنجاح", "success");
      setNewPasswordCurrent('');
      await loadSettingsData(); // Refresh UI list instantly to show new keys/configs
    } catch (err) {
      onToast("خطأ أثناء تغيير المرور", "error");
    }
  };

  const handleBackupDatabase = async () => {
    try {
      const stores = ["products", "invoices", "debtLedger", "transactions", "settings", "users"];
      const backupData: Record<string, any[]> = {};

      for (const storeName of stores) {
        backupData[storeName] = await getAllRecords(storeName);
      }

      const backupString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([backupString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `AutoPartsDB_FullBackup_${dateStr}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await onAddLog('system', "إجراء نسخة احتياطية محلية لقاعدة البيانات وحملها كملف JSON", 0);
      onToast("تم إنشاء وتنزيل ملف التصدير للنسخة الاحتياطية بنجاح!", "success");
    } catch (e) {
      console.error(e);
      onToast("خطأ أثناء تجميع ملف التصدير", "error");
    }
  };

  const handleResetSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetCode !== '0000') {
      onToast("رمز التأكيد غير صحيح", "error");
      return;
    }
    
    try {
      await clearAllCollections();
      await onAddLog('system', "تصفير جميع البيانات والعمليات في النظام بناءً على طلب المشرف", 0);
      onToast("تم تصفير النظام بأكمله بنجاح", "success");
      setShowResetConfirm(false);
      setResetCode('');
      // Wait a moment then reload to make sure DB is fresh
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      console.error(e);
      onToast("حدث خطأ أثناء تصفير النظام", "error");
    }
  };

  return (
    <div className="space-y-6" id="settings-area-container">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PANEL: Store and Invoice settings */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-4">
          <h3 className="font-bold text-[#1E2A3A] text-base border-b pb-2 flex items-center gap-2">
            <SettingsIcon size={18} className="text-[#2E86AB]" />
            بيانات المتجر و الفواتير العام
          </h3>

          <form onSubmit={handleSaveStoreSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              <div className="flex flex-col gap-1">
                <label className="text-gray-500 text-xs font-bold leading-5">اسم المحل / المتجر بالعربي</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm font-semibold text-[#2D3142]"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-500 text-xs font-bold leading-5">أيقونة الشعار (نص بالانجليزي)</label>
                <input
                  type="text"
                  value={storeLogoText}
                  onChange={(e) => setStoreLogoText(e.target.value)}
                  className="px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-500 text-xs font-bold leading-5">النص تحت الشعار (مثال: لقطع غيار السيارات)</label>
                <input
                  type="text"
                  value={invoiceSubtitle}
                  onChange={(e) => setInvoiceSubtitle(e.target.value)}
                  className="px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-500 text-xs font-bold leading-5">النص الفرعي (مثال: تويوتا ودبابة)</label>
                <input
                  type="text"
                  value={invoiceSubtitle2}
                  onChange={(e) => setInvoiceSubtitle2(e.target.value)}
                  className="px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-500 text-xs font-bold leading-5">رقم التواصل الأول في الفاتورة</label>
                <input
                  type="text"
                  value={invoicePhone1}
                  onChange={(e) => setInvoicePhone1(e.target.value)}
                  className="px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm font-semibold"
                  placeholder="مثال: عماد إبراهيم: 01000543001"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-500 text-xs font-bold leading-5">رقم التواصل الثاني في الفاتورة</label>
                <input
                  type="text"
                  value={invoicePhone2}
                  onChange={(e) => setInvoicePhone2(e.target.value)}
                  className="px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm font-semibold"
                  placeholder="مثال: عماد: 01004244528"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-500 text-xs font-bold leading-5">اسم النظام</label>
                <input
                  type="text"
                  value={systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                  className="px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-500 text-xs font-bold leading-5">رقم تليفون المتجر لطبعه</label>
                <input
                  type="text"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                  className="px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm font-semibold text-[#2D3142]"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-500 text-xs font-bold leading-5">حجم ورق الطباعة الافتراضي</label>
                <select
                  value={paperSize}
                  onChange={(e: any) => setPaperSize(e.target.value)}
                  className="px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm bg-white cursor-pointer"
                >
                  <option value="80mm">طابعة إيصالات حرارية 80mm</option>
                  <option value="A4">طابعة كلاسيكية مقاس A4</option>
                </select>
              </div>

              <div className="flex flex-col col-span-1 sm:col-span-2 gap-1">
                <label className="text-gray-500 text-xs font-bold leading-5">عنوان الفرع والمكان بالتفصيل</label>
                <input
                  type="text"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-sm"
                />
              </div>

              <div className="flex flex-col col-span-1 sm:col-span-2 gap-1">
                <label className="text-gray-500 text-xs font-bold leading-5">نص الشكر المطبوع في قاع الفاتورة</label>
                <textarea
                  value={welcomeText}
                  onChange={(e) => setWelcomeText(e.target.value)}
                  rows={2}
                  className="px-3 py-2 border border-gray-200 focus:border-[#2E86AB] outline-hidden rounded-xl text-xs resize-none"
                />
              </div>

            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-[#2E86AB] hover:bg-[#1E2A3A] text-white font-bold rounded-xl text-sm cursor-pointer transition-colors shadow-sm"
            >
              حفظ وتثبيت البيانات
            </button>
          </form>
        </div>

        {/* Change password of Current active user */}
        <div className="space-y-6">
          
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-4">
            <h3 className="font-bold text-[#1E2A3A] text-base border-b pb-2 flex items-center gap-2">
              <Lock size={18} className="text-[#2E86AB]" />
              تغيير كلمة المرور الخاصة بك
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-gray-500 text-xs font-bold">كلمة المرور الحالية</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-500 text-xs font-bold">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  value={newPasswordCurrent}
                  onChange={(e) => setNewPasswordCurrent(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2 bg-[#2E86AB] hover:bg-[#1E2A3A] text-white font-bold rounded-xl text-xs cursor-pointer transition-all shadow-xs"
              >
                تحديث الرقم السري
              </button>
            </form>
          </div>

          {/* BACKUP EXPORTS PANEL */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-4">
            <h3 className="font-bold text-[#1E2A3A] text-base border-b pb-2 flex items-center gap-2">
              <Download size={18} className="text-[#2E86AB]" />
              النسخ الاحتياطي وحماية البيانات
            </h3>
            <p className="text-xs text-gray-400 leading-normal">
              يتيح لك هذا الخيار تنزيل قفص البيانات بالكامل (المنتجات، الفواتير، الديون، المعاملات، الحسابات) في ملف JSON واحد تحفظه بمكان آمن للرجوع إليه عند الفورمات.
            </p>
            <button
              onClick={handleBackupDatabase}
              className="px-5 py-3 bg-[#1E2A3A] hover:bg-[#2E86AB] text-white font-bold rounded-xl text-xs cursor-pointer transition-all shadow-md flex items-center justify-center gap-1.5 w-full"
            >
              <Download size={14} />
              استخراج النسخة الاحتياطية الكاملة (JSON)
            </button>
          </div>

          {/* SYSTEM RESET PANEL */}
          {currentUser?.role === 'admin' && (
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-rose-100 space-y-4">
              <h3 className="font-bold text-rose-600 text-base border-b border-rose-100 pb-2 flex items-center gap-2">
                <AlertTriangle size={18} />
                تصفير وإعادة ضبط النظام
              </h3>
              <p className="text-xs text-rose-500/80 leading-normal">
                حذف جميع البيانات المتعلقة بالمنتجات، المبيعات، الفواتير، الديون والموردين بشكل نهائي. تأكد من أخذ نسخة احتياطية أولاً! هذه العملية لا رجعة فيها.
              </p>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-5 py-3 bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600 font-bold rounded-xl text-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 w-full border border-rose-200"
              >
                تصفير السيستم (مسح الكاش)
              </button>
            </div>
          )}

        </div>

      </div>

      {/* ADMIN PANEL Only: Manage staff users */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 space-y-5">
        <div className="border-b pb-2">
          <h3 className="font-bold text-[#1E2A3A] text-base flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#FF9800]" />
            إدارة حسابات طاقم العمل والصلاحيات
          </h3>
          <p className="text-xs text-gray-400 mt-1">تعديل طاقم الكاشير وموظفي المبيعات والمدراء</p>
        </div>

        {currentUser?.role !== 'admin' ? (
          <div className="p-4 bg-amber-50 text-amber-800 rounded-xl text-xs font-bold border border-amber-100 flex items-center gap-2">
            <Clock size={16} />
            يرجى العلم أن صلاحية إضافة وحذف حسابات طاقم المبيعات مقصورة فقط على "مدير النظام" (Admin).
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Form Add or Edit user */}
            {editingUser ? (
              <form onSubmit={handleSaveEditUser} className="space-y-3.5 border-l md:pl-6 border-amber-200 bg-amber-50/20 p-4 rounded-2xl border">
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-bold text-xs text-amber-800">تعديل بيانات الحساب:</h4>
                  <button 
                    type="button" 
                    onClick={handleCancelEditUser}
                    className="text-gray-400 hover:text-rose-600 text-[10px] font-bold"
                  >
                    إلغاء
                  </button>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-gray-500 text-xs font-semibold">اسم المستخدم</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="px-3 py-2 border border-amber-200 outline-hidden rounded-xl text-sm bg-white"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-gray-500 text-xs font-semibold">الرمز السري (الباسورد)</label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="سر قوي"
                    className="px-3 py-2 border border-amber-200 outline-hidden rounded-xl text-sm bg-white font-semibold"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-gray-500 text-xs font-semibold">صلاحية النظام</label>
                  <select
                    value={editUserRole}
                    onChange={(e: any) => setEditUserRole(e.target.value)}
                    className="px-3 py-2 border border-amber-200 bg-white rounded-xl text-sm cursor-pointer"
                  >
                    <option value="employee">موظف مبيعات (Employee)</option>
                    <option value="admin">مدير نظام كامل (Admin)</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 transition-all text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    تحديث الحساب
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditUser}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 transition-all text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    تراجع
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddNewUser} className="space-y-3.5 border-l md:pl-6 border-gray-100">
                <h4 className="font-bold text-xs text-gray-500">إضافة مستخدم جديد:</h4>
                
                <div className="flex flex-col gap-1">
                  <label className="text-gray-500 text-xs font-semibold">اسم المستخدم بالعربي / English</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="مثال: ahmad"
                    className="px-3 py-2 border border-gray-200 outline-hidden rounded-xl text-sm"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-gray-500 text-xs font-semibold">الرقم السري</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="سر قوي"
                    className="px-3 py-2 border border-gray-200 outline-hidden rounded-xl text-sm"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-gray-500 text-xs font-semibold">صلاحية النظام</label>
                  <select
                    value={newUserRole}
                    onChange={(e: any) => setNewUserRole(e.target.value)}
                    className="px-3 py-2 border border-gray-200 bg-white rounded-xl text-sm cursor-pointer"
                  >
                    <option value="employee">موظف مبيعات (Employee)</option>
                    <option value="admin">مدير نظام كامل (Admin)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#2D3142] hover:bg-[#2E86AB] hover:text-white transition-all text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  + إضافة المستخدم الجديد
                </button>
              </form>
            )}

            {/* List current Users */}
            <div className="md:col-span-2 space-y-3">
              <h4 className="font-bold text-xs text-gray-500">الحسابات المسجلة حالياً:</h4>
              
              <div className="space-y-2 max-h-[250px] overflow-y-auto no-scrollbar">
                {users.map((u) => (
                  <div 
                    key={u.id} 
                    className="p-3 border border-gray-100 rounded-xl bg-neutral-50/50 flex justify-between items-center text-xs hover:bg-neutral-50 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-[#2E86AB] flex items-center justify-center font-bold text-sm">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-extrabold text-gray-800">{u.username}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          الدور: {u.role === 'admin' ? 'مشرف / مدير' : 'موظف مبيعات'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md font-mono font-bold" title="الرمز السري الخاص بالموظف">
                        🔑 {u.password}
                      </span>
                      <button
                        onClick={() => handleStartEditUser(u)}
                        className="p-1.5 hover:bg-amber-100 text-amber-700 rounded-lg cursor-pointer transition-colors"
                        title="تعديل حساب الموظف والرمز السري"
                      >
                        <SettingsIcon size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg cursor-pointer transition-colors"
                        title="حذف المستخدم"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* MODAL: Delete User Confirmation */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100 flex flex-col">
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
              <Trash2 className="text-rose-500" size={20} />
              <h3 className="font-bold text-rose-700">تأكيد حذف الموظف</h3>
            </div>
            <div className="p-5 text-sm text-gray-600 font-medium leading-relaxed">
              هل أنت متأكد من رغبتك في مسح حساب الموظف: <span className="font-bold text-gray-900">{userToDelete.username}</span>؟
            </div>
            <div className="p-4 bg-neutral-50 flex gap-2 justify-end">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 border border-gray-200 text-gray-500 font-bold rounded-lg text-sm hover:bg-white transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={() => confirmDeleteUser(userToDelete)}
                className="px-4 py-2 bg-rose-500 text-white font-bold rounded-lg text-sm hover:bg-rose-600 shadow-md shadow-rose-500/20 transition-all cursor-pointer"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reset System Confirmation */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center gap-2 text-rose-600">
              <AlertTriangle size={20} />
              <h3 className="font-bold">تحذير أمني خطير!</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600 font-medium leading-relaxed">
                أنت على وشك تصفير ومسح جميع بيانات قواعد داتا النظام نهائياً (الحركات والمخزون والموردين والخزنة).
                إذا كنت متأكداً يرجى إدخال الرمز السري للتأكيد: <strong className="text-gray-900 bg-gray-100 px-1 rounded">0000</strong>
              </p>
              
              <form onSubmit={handleResetSystem}>
                <input
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="أدخل الرمز للتأكيد"
                  className="w-full px-4 py-3 border border-rose-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none rounded-xl text-center font-mono text-lg font-bold"
                  dir="ltr"
                />
                
                <div className="mt-6 flex gap-2 justify-end border-t pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetConfirm(false);
                      setResetCode('');
                    }}
                    className="flex-1 py-2.5 border border-gray-200 text-gray-500 font-bold rounded-xl text-sm hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    تراجع وإلغاء
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-rose-500 text-white font-bold rounded-xl text-sm hover:bg-rose-600 shadow-md shadow-rose-500/20 transition-all cursor-pointer"
                  >
                    نعم، مسح كل شيء!
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
