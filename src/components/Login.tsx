import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, LogIn, User, Lock, Gauge, Keyboard, Users, Grid, HelpCircle } from 'lucide-react';
import { getAllRecords, addRecord, seedDemoDataIfNeeded, User as UserDB } from '../db';

// Helper function to normalize Arabic text (stripping diacritics, matching Alef/Teh Marbuta variants)
function normalizeArabicText(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا') // standardizes Alefs
    .replace(/[ةه]/g, 'ه')   // Teh Marbuta / Heh
    .replace(/\s+/g, '');    // removes any internal whitespaces
}

interface LoginProps {
  onLoginSuccess: (user: { username: string; role: 'admin' | 'employee' }) => void;
  onToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function Login({ onLoginSuccess, onToast }: LoginProps) {
  // Login flow choices
  const [loginMode, setLoginMode] = useState<'quick' | 'standard'>('quick');
  
  // Database state
  const [users, setUsers] = useState<UserDB[]>([]);
  const [shopName, setShopName] = useState("مركز قطع غيار السيارات والميكانيكا");
  
  // Quick-login states
  const [password, setPassword] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserDB | null>(null);
  const [ambiguousUsers, setAmbiguousUsers] = useState<UserDB[]>([]);
  
  // Standard-login states
  const [username, setUsername] = useState('');
  const [standardPassword, setStandardPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPinPad, setShowPinPad] = useState(true);

  const quickInputRef = useRef<HTMLInputElement>(null);
  const standardInputRef = useRef<HTMLInputElement>(null);
  const standardPasswordRef = useRef<HTMLInputElement>(null);

  // Load database users and store settings
  useEffect(() => {
    async function loadData() {
      try {
        let list = await getAllRecords("users");
        
        // Seeding database if users list is totally empty
        if (list.length === 0) {
          await seedDemoDataIfNeeded();
          list = await getAllRecords("users");
        }
        
        // Security safeguard: Ensure at least one admin account is present
        const hasAdmin = list.some(u => u.role === 'admin');
        if (!hasAdmin) {
          await addRecord("users", { username: "admin", password: "1234", role: "admin" });
          list = await getAllRecords("users");
        }
        
        setUsers(list);
        
        // Find first supervisor / admin user and pre-fill state
        const firstAdmin = list.find(u => u.role === 'admin');
        if (firstAdmin) {
          setUsername(firstAdmin.username);
        }
        
        const settings = await getAllRecords("settings");
        const main = settings.find(s => s.id === "main");
        if (main && main.storeName) {
          setShopName(main.storeName);
        }
      } catch (e) {
        console.error("Error loaded users log", e);
      }
    }
    loadData();
  }, []);

  // Set focus on inputs
  useEffect(() => {
    if (loginMode === 'quick') {
      setTimeout(() => {
        quickInputRef.current?.focus();
      }, 100);
    } else {
      setTimeout(() => {
        standardInputRef.current?.focus();
      }, 100);
    }
  }, [loginMode]);

  // Handle Quick Login (Only Password)
  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      onToast("يرجى إدخال الرقم السري الخاص بك أولاً", "warning");
      return;
    }

    setIsLoading(true);
    // Security delay to buffer quick brute-force attempts
    await new Promise(r => setTimeout(r, 200));

    try {
      const allUsers = await getAllRecords("users");

      // Filter to match only employee accounts for quick login
      const matchedUsers = allUsers.filter(u => u.role === 'employee' && u.password?.trim() === password.trim());
      // Check if password matches any admin accounts
      const isAdminPassword = allUsers.some(u => u.role === 'admin' && u.password?.trim() === password.trim());

      if (matchedUsers.length === 1) {
        const matched = matchedUsers[0];
        onToast(`مرحباً بك ${matched.username}! تم تسجيل الدخول الآمن بنجاح`, "success");
        onLoginSuccess({ username: matched.username, role: matched.role });
        localStorage.setItem("autoPartsUser", JSON.stringify({ username: matched.username, role: matched.role }));
      } else if (matchedUsers.length > 1) {
        // Conflict! Two employees have the same password
        setAmbiguousUsers(matchedUsers);
        onToast("تم العثور على عدة حسابات بنفس الرمز السري، اختر حسابك للمتابعة", "warning");
      } else if (isAdminPassword) {
        // User entered admin password in the employee quick login mode
        onToast("هذا الرقم السري خاص بحساب المشرف. يرجى تسجيل الدخول من تبويب (دخول المشرف) بالأعلى باستخدام اسم المستخدم وكلمة المرور.", "warning");
        setPassword('');
      } else {
        onToast("الرمز السري غير صحيح أو غير مسجل بالمنظومة!", "error");
        setPassword('');
      }
    } catch (err) {
      console.error(err);
      onToast("عذراً، فشل التحقق من البيانات", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Standard Login (Username + Password)
  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredUser = username.trim();
    const enteredPass = standardPassword.trim();

    if (!enteredUser || !enteredPass) {
      onToast("يرجى كتابة اسم المستخدم والرقم السري", "warning");
      return;
    }

    setIsLoading(true);
    await new Promise(r => setTimeout(r, 400));

    try {
      const allUsers = await getAllRecords("users");
      const normEnteredUser = normalizeArabicText(enteredUser);

      const matched = allUsers.find(u => {
        const dbUser = u.username.toLowerCase();
        const normDbUser = normalizeArabicText(dbUser);
        
        // Direct match of normalized usernames OR admin role matched with standard keywords
        const isUserMatch = normDbUser === normEnteredUser || 
          (u.role === 'admin' && (
            normEnteredUser === 'الادمن' || 
            normEnteredUser === 'ادمن' || 
            normEnteredUser === 'المدير' || 
            normEnteredUser === 'مدير' || 
            normEnteredUser === 'المشرف' ||
            normEnteredUser === 'مشرف' ||
            normEnteredUser === 'مسؤول' ||
            normEnteredUser === 'المسؤول'
          ));
        
        return isUserMatch && u.password?.trim() === enteredPass;
      });

      if (matched) {
        onToast(`مرحباً بك مشرفنا العزيز ${matched.username}! تم الدخول بنجاح`, "success");
        onLoginSuccess({ username: matched.username, role: matched.role });
        localStorage.setItem("autoPartsUser", JSON.stringify({ username: matched.username, role: matched.role }));
      } else {
        onToast("اسم المستخدم أو كلمة المرور غير صحيحة مطلقاً!", "error");
      }
    } catch (err) {
      console.error(err);
      onToast("خطأ بقراءة البيانات المسجلة", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Log in as one of the users who share the same password
  const selectConflictingUser = (user: UserDB) => {
    onToast(`تم تسجيل الدخول بصفتك: ${user.username}`, "success");
    onLoginSuccess({ username: user.username, role: user.role });
    localStorage.setItem("autoPartsUser", JSON.stringify({ username: user.username, role: user.role }));
  };

  // Soft numeric PIN pad clicker
  const handlePinPadClick = (val: string) => {
    if (val === 'clear') {
      setPassword('');
    } else if (val === 'back') {
      setPassword(prev => prev.slice(0, -1));
    } else {
      setPassword(prev => prev + val);
    }
    // Auto focus standard input back
    setTimeout(() => {
      quickInputRef.current?.focus();
    }, 10);
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center p-4" style={{ direction: 'rtl' }}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-gray-150 overflow-hidden text-right p-6 sm:p-8 space-y-6">
        
        {/* Header Block and logo */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-[#1E2A3A] text-[#A8DADC] rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <Gauge size={32} className="text-[#FF9800]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#1E2A3A] tracking-tight">{shopName}</h1>
            <p className="text-xs text-gray-400 mt-1">بوابة الدخول الآمن للموظفين والمدير العام</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => { setLoginMode('quick'); setAmbiguousUsers([]); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loginMode === 'quick' ? 'bg-white text-[#2E86AB] shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Users size={14} />
            دخول الموظفين
          </button>
          
          <button
            type="button"
            onClick={() => { setLoginMode('standard'); setAmbiguousUsers([]); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loginMode === 'standard' ? 'bg-white text-[#2E86AB] shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ShieldCheck size={14} />
            دخول المشرف
          </button>
        </div>

        {/* Conflict popup dialogue */}
        {ambiguousUsers.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
            <span className="text-xs font-extrabold text-amber-800 leading-normal block">
              عذراً! هذا الرمز السري متطابق لعدة موظفين. يرجى الضغط على حسابك الفعلي لإتمام الدخول:
            </span>
            <div className="grid grid-cols-2 gap-2">
              {ambiguousUsers.map(user => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => selectConflictingUser(user)}
                  className="p-2.5 bg-white border border-amber-200 text-amber-950 font-bold rounded-xl text-xs hover:bg-amber-100 cursor-pointer text-center block transition-all"
                >
                  👤 {user.username} ({user.role === 'admin' ? 'مدير' : 'موظف'})
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAmbiguousUsers([])}
              className="text-[10px] text-gray-400 hover:text-gray-600 underline block text-center pt-1"
            >
              إلغاء وإعادة المحاولة
            </button>
          </div>
        )}

        {/* 1. Quick Password-Only Login */}
        {loginMode === 'quick' && ambiguousUsers.length === 0 && (
          <div className="space-y-4">
            
            <form onSubmit={handleQuickLogin} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-gray-600 text-xs font-bold leading-5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Lock size={13} className="text-[#2E86AB]" />
                    الرقم السري الخاص بك (Password)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPinPad(!showPinPad)}
                    className="text-[10px] text-[#2E86AB] hover:underline flex items-center gap-1 font-bold"
                  >
                    <Keyboard size={11} />
                    {showPinPad ? 'إخفاء أزرار الأرقام' : 'إظهار أزرار الأرقام'}
                  </button>
                </label>
                
                <input
                  ref={quickInputRef}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="اكتب رمزك السري المخصص لك للدخول..."
                  className="w-full px-4 py-3 border border-gray-200 outline-hidden rounded-2xl text-center text-base font-extrabold tracking-widest focus:border-[#2E86AB] focus:ring-4 focus:ring-blue-100/50 bg-gray-50/20"
                  required
                />
              </div>

              {/* Pin Pad */}
              {showPinPad && (
                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 grid grid-cols-3 gap-2 w-full max-w-sm mx-auto shadow-inner">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handlePinPadClick(num)}
                      className="py-2.5 bg-white border border-gray-100 hover:bg-slate-100 font-extrabold text-[#1E2A3A] rounded-xl text-sm shadow-xs cursor-pointer active:scale-95 transition-all text-center"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handlePinPadClick('clear')}
                    className="py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold rounded-xl text-xs shadow-xs cursor-pointer active:scale-95 transition-all text-center"
                  >
                    مسح الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePinPadClick('0')}
                    className="py-2.5 bg-white border border-gray-100 hover:bg-slate-100 font-extrabold text-[#1E2A3A] rounded-xl text-sm shadow-xs cursor-pointer active:scale-95 transition-all text-center"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePinPadClick('back')}
                    className="py-2.5 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold rounded-xl text-xs shadow-xs cursor-pointer active:scale-95 transition-all text-center flex items-center justify-center"
                    title="حذف رقم"
                  >
                    ⌫
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#2E86AB] hover:bg-[#1E2A3A] transition-all text-white font-extrabold rounded-2xl text-sm cursor-pointer shadow-md flex items-center justify-center gap-2 active:scale-98"
              >
                <LogIn size={16} />
                {isLoading ? 'جاري التحقق من الهوية مبيعات...' : 'دخول فوري بكلمة المرور'}
              </button>
            </form>
          </div>
        )}

        {/* 2. Standard Traditional Username/Password login login */}
        {loginMode === 'standard' && ambiguousUsers.length === 0 && (
          <form onSubmit={handleStandardLogin} className="space-y-4">
            
            {/* Quick Supervisor Profile badges */}
            {users.filter(u => u.role === 'admin').length > 0 && (
              <div className="space-y-2 bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100">
                <label className="text-[11px] text-gray-500 font-bold block mb-1">
                  اختر حساب المشرف من هنا للسرعة:
                </label>
                <div className="flex flex-wrap gap-2">
                  {users.filter(u => u.role === 'admin').map((u) => {
                    const isSelected = username.toLowerCase() === u.username.toLowerCase();
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setUsername(u.username);
                          setTimeout(() => {
                            standardPasswordRef.current?.focus();
                          }, 50);
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected 
                            ? 'border-[#2E86AB] bg-blue-50/50 text-[#2E86AB] ring-2 ring-[#2E86AB]/10 shadow-xs' 
                            : 'border-gray-200 hover:bg-gray-50 bg-white text-gray-700'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] ${
                          isSelected ? 'bg-[#2E86AB] text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <span>{u.username}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-gray-600 text-xs font-bold leading-5 flex items-center gap-1">
                <User size={13} className="text-[#2E86AB]" />
                اسم المستخدم
              </label>
              <input
                ref={standardInputRef}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم (مثال: admin)"
                className="w-full px-4 py-2.5 border border-gray-200 outline-hidden rounded-xl text-sm font-semibold focus:border-[#2E86AB]"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-gray-600 text-xs font-bold leading-5 flex items-center gap-1">
                <Lock size={13} className="text-[#2E86AB]" />
                كلمة المرور
              </label>
              <input
                ref={standardPasswordRef}
                type="password"
                value={standardPassword}
                onChange={(e) => setStandardPassword(e.target.value)}
                placeholder="أدخل الباسورد الخاص بك..."
                className="w-full px-4 py-2.5 border border-gray-200 outline-hidden rounded-xl text-sm font-semibold focus:border-[#2E86AB]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#1E2A3A] hover:bg-[#2E86AB] transition-all text-white font-extrabold rounded-xl text-sm cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <LogIn size={16} />
              {isLoading ? 'جاري التحقق من المشرف...' : 'دخول حساب المشرف'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
