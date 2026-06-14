import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Package, 
  Receipt, 
  CreditCard, 
  History, 
  Settings as SettingsIcon, 
  LogOut, 
  Menu, 
  X, 
  User, 
  Shield, 
  HelpCircle,
  Bell,
  Gauge,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Truck
} from 'lucide-react';
import { 
  seedDemoDataIfNeeded, 
  getAllRecords, 
  addRecord, 
  AppSettings
} from './db';

// Import our beautiful sub-components
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Invoices from './components/Invoices';
import DebtLedger from './components/DebtLedger';
import TransactionsLog from './components/TransactionsLog';
import Suppliers from './components/Suppliers';
import Settings from './components/Settings';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning';
}

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  date: Date;
  isRead: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  id: "main",
  storeName: "مركز قطع غيار السيارات والميكانيكا",
  storeAddress: "الرياض - حي الروضة - طريق الملك عبدالله",
  storePhone: "0501234567",
  storeLogoText: "Modern Parts Auto",
  welcomeText: "نشكركم لزيارتكم وثقتكم بنا - قطع الغيار المباعة لا ترد ولا تستبدل بعد 3 أيام",
  paperSize: "80mm"
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ username: string; role: 'admin' | 'employee' } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [shopSettings, setShopSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false); // Mobile sidebar drawer
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isDbReady, setIsDbReady] = useState<boolean>(false);
  const [lowStockWarningCount, setLowStockWarningCount] = useState<number>(0);
  const [liveDateStr, setLiveDateStr] = useState<string>('');
  
  // App Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'welcome_sys',
      title: 'مرحباً بك في النظام',
      message: 'نظام إدارة المخزون والمبيعات يعمل بكفاءة.',
      type: 'info',
      date: new Date(),
      isRead: false
    }
  ]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Live Timer
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true 
      };
      setLiveDateStr(now.toLocaleString('ar-EG', options));
    };
    
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load user session and settings on launch
  useEffect(() => {
    initializeApp();
  }, []);

  // Sync low-stock warning count on tab change or updates
  useEffect(() => {
    if (isDbReady) {
      updateBadges();
    }
  }, [activeTab, isDbReady]);

  const initializeApp = async () => {
    try {
      // 1. Seed base data if database brand new
      await seedDemoDataIfNeeded();

      if (!localStorage.getItem("migrated_sa_invoices_v2")) {
        try {
          const invoices = await getAllRecords("invoices");
          const { updateRecord } = await import('./db');
          
          let counter = 1;
          for (const inv of invoices) {
            await updateRecord("invoices", inv.id, { invoiceNumber: `SA-${counter}` });
            counter++;
          }
          localStorage.setItem("migrated_sa_invoices_v2", "true");
        } catch (error) {
          console.error("Migration error:", error);
        }
      }

      setIsDbReady(true);

      // 2. Load shop settings
      await loadSettings();

      // 3. Restore session if stored
      const savedUser = localStorage.getItem("autoPartsUser");
      if (savedUser) {
        try {
          setCurrentUser(JSON.parse(savedUser));
        } catch (_) {
          localStorage.removeItem("autoPartsUser");
        }
      }
    } catch (err) {
      console.error("Database initialization failed:", err);
      showToast("فشلت تهيئة قاعدة البيانات المحلية للمتجر", "error");
    }
  };

  const loadSettings = async () => {
    try {
      const settingsRecords = await getAllRecords("settings");
      const mainSettings = settingsRecords.find(s => s.id === "main");
      if (mainSettings) {
        setShopSettings(mainSettings);
      } else {
        setShopSettings(DEFAULT_SETTINGS);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const updateBadges = async () => {
    try {
      const allProducts = await getAllRecords("products");
      const lowStockProducts = allProducts.filter((p) => p.quantity < 5);
      setLowStockWarningCount(lowStockProducts.length);

      // Reflect low stock in notifications safely
      if (lowStockProducts.length > 0) {
        setNotifications(prev => {
          const hasLowStock = prev.some(n => n.id === 'low-stock');
          if (hasLowStock) return prev; // Already notified
          return [{
            id: 'low-stock',
            title: 'تنبيه النواقص بالأسهم',
            message: `يوجد ${lowStockProducts.length} صنف/أصناف مخزونها أقل من الحد الأدنى.`,
            type: 'warning',
            date: new Date(),
            isRead: false
          }, ...prev];
        });
      } else {
        setNotifications(prev => prev.filter(n => n.id !== 'low-stock'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Modern Toast & Notification system
  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Automatically log serious issues into bell notifications
    if (type === 'error' || type === 'warning') {
      const notifId = Date.now().toString() + Math.random();
      setNotifications(prev => [{
        id: notifId,
        title: type === 'error' ? 'مشكلة بالعمليات' : 'تنبيه تشغيلي',
        message: message,
        type: type,
        date: new Date(),
        isRead: false
      }, ...prev].slice(0, 50));
    }

    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Handle active login
  const handleLoginSuccess = (user: { username: string; role: 'admin' | 'employee' }) => {
    setCurrentUser(user);
    localStorage.setItem("autoPartsUser", JSON.stringify(user));
  };

  // Handle logout
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("autoPartsUser");
    setActiveTab('dashboard');
    showToast("تم تسجيل الخروج بنجاح", "success");
  };

  // Standard interactive log writer passed to sub-components
  const handleAddLog = async (
    type: 'sale' | 'debt_payment' | 'add_stock' | 'edit_price' | 'system', 
    description: string, 
    amount: number
  ) => {
    try {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const hh = String(today.getHours()).padStart(2, '0');
      const min = String(today.getMinutes()).padStart(2, '0');
      const dateStr = `${dd}/${mm}/${yyyy} ${hh}:${min}`;

      await addRecord("transactions", {
        date: dateStr,
        type: type,
        description: description,
        amount: amount,
        username: currentUser?.username || 'system'
      });
      
      // Sync badge numbers immediately
      updateBadges();
    } catch (e) {
      console.error("Failed logging system transaction:", e);
    }
  };

  // Loading indicator for index initialization
  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-[#F0F4F8] flex flex-col items-center justify-center p-4" style={{ direction: 'rtl' }}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-[#1E2A3A] text-[#A8DADC] rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <Gauge size={32} className="animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1E2A3A]">جاري تهيئة قاعدة البيانات...</h2>
            <p className="text-xs text-gray-400 mt-1">يرجى الانتظار، يتم تحضير مخازن ودفاتر المتجر</p>
          </div>
        </div>
      </div>
    );
  }

  // Render POS Auth gate
  if (!currentUser) {
    return (
      <>
        <Login onLoginSuccess={handleLoginSuccess} onToast={showToast} />
        {/* Toast Notification HUD */}
        <div className="fixed top-5 left-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none" style={{ direction: 'rtl' }}>
          {toasts.map(t => (
            <div 
              key={t.id} 
              className={`p-4 rounded-xl shadow-lg border flex items-start gap-3 pointer-events-auto animate-fade-in ${
                t.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' :
                t.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-900' :
                'bg-amber-50 border-amber-100 text-amber-900'
              }`}
            >
              <div className="mt-0.5">
                {t.type === 'success' && <CheckCircle size={16} className="text-emerald-500" />}
                {t.type === 'error' && <XCircle size={16} className="text-rose-500" />}
                {t.type === 'warning' && <AlertTriangle size={16} className="text-amber-500" />}
              </div>
              <p className="text-xs font-bold leading-normal">{t.message}</p>
            </div>
          ))}
        </div>
      </>
    );
  }

  // Navigation tabs config
  const navItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: BarChart3 },
    { id: 'invoices', label: 'المبيعات و الفواتير', icon: Receipt },
    { id: 'products', label: 'مستودع المنتجات', icon: Package, badgeKey: 'products' },
    { id: 'suppliers', label: 'الموردين', icon: Truck },
    { id: 'debts', label: 'دفتر المديونيات والذمم', icon: CreditCard },
    { id: 'transactions', label: 'سجل العمليات العام', icon: History },
    { id: 'settings', label: 'إعدادات النظام والطباعة', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#F0F4F8] text-[#2D3142] flex" style={{ direction: 'rtl', fontFamily: 'var(--font-sans)' }}>
      
      {/* 1. SIDEBAR: Desktop Sidebar (fixed) & Mobile Backdrop Drawer */}
      <aside 
        className={`fixed inset-y-0 right-0 z-40 w-68 bg-[#1E2A3A] text-white flex flex-col transition-transform duration-300 transform lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
        id="side-bar-navigation"
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#2E86AB] rounded-xl text-white shadow-xs">
              <Gauge size={22} className="animate-pulse" />
            </div>
            <div>
              <h2 className="font-extrabold text-xs tracking-wide leading-tight line-clamp-2 max-w-[150px] text-gray-100" title={shopSettings.storeName}>
                {shopSettings.storeName}
              </h2>
              <span className="text-[9px] text-gray-400 font-medium">نظام المبيعات والمخزون</span>
            </div>
          </div>
          {/* Mobile close button */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 text-gray-400 hover:text-white lg:hidden cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Links */}
        <nav className="flex-1 px-3.5 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-[#2E86AB] text-white shadow-xs' 
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </div>

                {/* Sub-item notifications warnings */}
                {item.id === 'products' && lowStockWarningCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[9px] font-extrabold animate-bounce">
                    {lowStockWarningCount} ناقص
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Profile Operator Dashboard & Logged user */}
        <div className="p-4 border-t border-white/5 bg-black/10 text-right space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white/10 text-[#A8DADC] flex items-center justify-center font-bold">
              <User size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs truncate">{currentUser.username}</p>
              <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md mt-0.5 ${
                currentUser.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
              }`}>
                <Shield size={10} />
                {currentUser.role === 'admin' ? 'المدير العام' : 'موظف المبيعات'}
              </span>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full py-2 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-all text-rose-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut size={13} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Backdrop for Mobile Sidebar Drawer */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/40 z-30 transition-opacity"
        />
      )}

      {/* 2. MAIN HUB CONTENT CONTAINER */}
      <div className="flex-1 min-w-0 flex flex-col lg:mr-68 min-h-screen">
        
        {/* Top Header Controls Bar */}
        <header className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between sticky top-0 z-20 shadow-xs no-print">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger menu */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 hover:bg-neutral-100 rounded-xl lg:hidden text-gray-500 cursor-pointer"
            >
              <Menu size={20} />
            </button>

            {/* Displaying Current Active View Name */}
            <div>
              <h2 className="font-extrabold text-[#1E2A3A] text-sm sm:text-base leading-none">
                {shopSettings.storeName}
              </h2>
              <p className="text-[10px] text-gray-400 mt-1 font-semibold">
                الهاتف الداخلي: {shopSettings.storePhone} | {shopSettings.storeAddress}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Notifications Dropdown Container */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-gray-100 transition-colors cursor-pointer text-gray-500 hover:text-[#2E86AB]"
              >
                <Bell size={20} />
                {notifications.some(n => !n.isRead) && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-50 animate-pulse"></span>
                )}
              </button>

              {isNotificationsOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsNotificationsOpen(false)} 
                  />
                  <div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="px-4 py-3 bg-[#F8FAFC] border-b border-gray-100 flex items-center justify-between">
                      <h3 className="font-bold text-gray-800">الإشعارات</h3>
                      <button 
                        onClick={() => {
                          setNotifications(prev => prev.map(n => ({...n, isRead: true})));
                        }}
                        className="text-[10px] text-[#2E86AB] hover:underline font-bold bg-transparent border-none cursor-pointer"
                      >
                        تحديد الكل كمقروء
                      </button>
                    </div>
                    
                    <div className="overflow-y-auto flex-1">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm font-semibold">
                          لا توجد إشعارات حالياً
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div 
                            key={n.id} 
                            className={`p-3 border-b last:border-0 hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-blue-50/50' : ''}`}
                            onClick={() => {
                              setNotifications(prev => prev.map(item => item.id === n.id ? {...item, isRead: true} : item));
                            }}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="mt-0.5">
                                {n.type === 'info' && <Bell size={14} className="text-[#2E86AB]" />}
                                {n.type === 'success' && <CheckCircle size={14} className="text-emerald-500" />}
                                {n.type === 'warning' && <AlertTriangle size={14} className="text-amber-500" />}
                                {n.type === 'error' && <XCircle size={14} className="text-rose-500" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1 gap-2">
                                  <h4 className={`text-xs font-bold ${!n.isRead ? 'text-gray-900' : 'text-gray-700'}`}>{n.title}</h4>
                                  <span className="text-[9px] text-gray-400 whitespace-nowrap font-mono">{n.date.toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <p className="text-[11px] text-gray-500 leading-relaxed">{n.message}</p>
                              </div>
                              {!n.isRead && <div className="w-1.5 h-1.5 bg-[#2E86AB] rounded-full mt-1.5 flex-shrink-0" />}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Live Clock Component */}
            <div className="flex items-center gap-1.5 text-gray-800 pointer-events-none font-bold text-sm bg-slate-100 px-3 py-1.5 rounded-xl border border-gray-200">
              <Clock size={15} className="text-[#2E86AB]" />
              <span className="font-mono mt-0.5">{liveDateStr}</span>
            </div>
          </div>
        </header>

        {/* Dynamic component routing area */}
        <main className="flex-grow p-4 sm:p-5 md:p-6 overflow-y-auto xl:max-w-7xl xl:mx-auto w-full">
          {activeTab === 'dashboard' && (
            <Dashboard 
              onNavigate={(tab) => setActiveTab(tab)} 
              currentUser={currentUser} 
            />
          )}

          {activeTab === 'products' && (
            <Products 
              onAddLog={handleAddLog} 
              currentUser={currentUser} 
              onToast={showToast} 
            />
          )}

          {activeTab === 'invoices' && (
            <Invoices 
              onAddLog={handleAddLog} 
              currentUser={currentUser} 
              onToast={showToast} 
              shopSettings={shopSettings} 
            />
          )}

          {activeTab === 'suppliers' && (
            <Suppliers onToast={showToast} currentUser={currentUser} onAddLog={handleAddLog} />
          )}

          {activeTab === 'debts' && (
            <DebtLedger 
              onAddLog={handleAddLog} 
              currentUser={currentUser} 
              onToast={showToast} 
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsLog 
              onToast={showToast} 
            />
          )}

          {activeTab === 'settings' && (
            <Settings 
              onAddLog={handleAddLog} 
              currentUser={currentUser} 
              onToast={showToast} 
              shopSettings={shopSettings} 
              onSettingsUpdated={loadSettings} 
            />
          )}
        </main>


      </div>

      {/* Toast Notification HUD */}
      <div className="fixed top-5 left-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none" style={{ direction: 'rtl' }}>
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`p-4 rounded-xl shadow-lg border flex items-start gap-3 pointer-events-auto transition-all animate-bounce-in ${
              t.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' :
              t.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-900' :
              'bg-amber-50 border-amber-100 text-amber-950'
            }`}
          >
            <div className="mt-0.5">
              {t.type === 'success' && <CheckCircle size={16} className="text-emerald-500" />}
              {t.type === 'error' && <XCircle size={16} className="text-rose-500" />}
              {t.type === 'warning' && <AlertTriangle size={16} className="text-amber-500" />}
            </div>
            <p className="text-xs font-bold leading-normal">{t.message}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
