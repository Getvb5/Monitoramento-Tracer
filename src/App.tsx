import React, { useState, useEffect, useMemo } from 'react';
import { auth, signInWithGoogle, logout, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { 
  LayoutDashboard, ClipboardList, LogOut, ShieldCheck, 
  HeartPulse, Activity, UserCircle, Database, 
  FileStack, Building2, CalendarDays, Bell, HelpCircle, 
  User as UserIcon, ChevronDown, Menu, X, SlidersHorizontal,
  FolderLock, RefreshCw, UserCheck, ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import DataManagement from './components/DataManagement';
import AuditExplorer, { MONTH_NAMES } from './components/AuditExplorer';
import SchedulesSync from './components/SchedulesSync';
import UnitExplorer from './components/UnitExplorer';
import ColetaDigital from './components/ColetaDigital';
import { ADMIN_EMAILS, USER_UNIT_MAPPING, HEALTH_UNITS } from './lib/utils';
import loginBg from './assets/images/recife_login_bg_1780339628886.png';

type View = 'dashboard' | 'schedules' | 'data_mgmt' | 'explorer' | 'explorer_units' | 'coleta';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('dashboard');
  const [autoSyncState, setAutoSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('firestore_quota_exceeded') === 'true') {
      setIsQuotaExceeded(true);
      import('firebase/firestore').then(({ disableNetwork }) => {
        disableNetwork(db).catch((e) => {
          console.error("Erro ao desativar rede no início após cota excedida:", e);
        });
      });
    }
    const handleQuota = () => {
      setIsQuotaExceeded(true);
      import('firebase/firestore').then(({ disableNetwork }) => {
        disableNetwork(db).catch((e) => {
          console.error("Erro ao desativar rede após cota excedida:", e);
        });
      });
    };
    window.addEventListener('firestore-quota-exceeded', handleQuota);
    return () => {
      window.removeEventListener('firestore-quota-exceeded', handleQuota);
    };
  }, []);

  const [checkingConnection, setCheckingConnection] = useState(false);
  const [reconnectError, setReconnectError] = useState('');

  const handleTryReconnect = async () => {
    setCheckingConnection(true);
    setReconnectError('');
    try {
      const { getDocs, collection, query, limit: fLimit, enableNetwork } = await import('firebase/firestore');
      // Enable network temporarily to test connection
      await enableNetwork(db);
      
      // Minimal test query to see if Firestore is reading/working or still blocked by Quota
      await getDocs(query(collection(db, 'audits_hand_hygiene'), fLimit(1)));
      
      // If successful, reset and reload
      localStorage.removeItem('firestore_quota_exceeded');
      setIsQuotaExceeded(false);
      window.location.reload();
    } catch (err: any) {
      console.error("Tentativa de reconexão falhou:", err);
      try {
        const { disableNetwork } = await import('firebase/firestore');
        await disableNetwork(db);
      } catch (_) {}

      if (err?.message && (err.message.includes('Quota') || err.message.includes('resource-exhausted') || err.message.includes('quota') || err.message.includes('limit') || err.message === 'quota-exceeded')) {
        setReconnectError('O limite de cota ainda está excedido no Firestore.');
      } else {
        localStorage.removeItem('firestore_quota_exceeded');
        setIsQuotaExceeded(false);
        window.location.reload();
      }
    } finally {
      setCheckingConnection(false);
    }
  };

  // Unified global filters
  const [selectedProfile, setSelectedProfile] = useState<'ADMINISTRADOR' | 'AUDITOR'>(() => {
    const saved = localStorage.getItem('selected_profile_role');
    return (saved === 'AUDITOR' || saved === 'ADMINISTRADOR') ? saved : 'ADMINISTRADOR';
  });

  const handleToggleProfile = (newProfile: 'ADMINISTRADOR' | 'AUDITOR') => {
    setSelectedProfile(newProfile);
    localStorage.setItem('selected_profile_role', newProfile);
    if (newProfile === 'ADMINISTRADOR' && view === 'coleta') {
      setView('dashboard');
    }
  };

  const [globalMonth, setGlobalMonth] = useState<string>('');
  const [globalQuarter, setGlobalQuarter] = useState<string>('');
  const [globalDay, setGlobalDay] = useState<string>('');
  const [globalUnit, setGlobalUnit] = useState<string>('');
  const [globalType, setGlobalType] = useState<string>('');
  const [explorerFilter, setExplorerFilter] = useState<string>('');

  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [lastMonthPrompted, setLastMonthPrompted] = useState<string>('');

  // Open day selector pop-up whenever globalMonth changes to a non-empty value
  useEffect(() => {
    if (globalMonth !== '' && globalMonth !== lastMonthPrompted) {
      setIsDayModalOpen(true);
      setLastMonthPrompted(globalMonth);
    } else if (globalMonth === '') {
      setGlobalDay('');
      setLastMonthPrompted('');
    }
  }, [globalMonth, lastMonthPrompted]);

  // Support opening day filter selector from anywhere with standard dispatch
  useEffect(() => {
    const handleOpenDayModal = () => {
      if (globalMonth !== '') {
        setIsDayModalOpen(true);
      }
    };
    window.addEventListener('open-day-selector-modal', handleOpenDayModal);
    return () => {
      window.removeEventListener('open-day-selector-modal', handleOpenDayModal);
    };
  }, [globalMonth]);

  // UI state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const { currentProfile, isAdmin, userUnit } = useMemo(() => {
    if (!user || !user.email) return { currentProfile: 'AUDITOR' as const, isAdmin: false, userUnit: null };
    
    const userEmail = user.email.trim().toLowerCase();
    const adminList = ADMIN_EMAILS.map(e => e.trim().toLowerCase());
    const isBaseAdmin = adminList.some(email => email === userEmail) || userEmail === 'getvb98@gmail.com';
    
    const unit = Object.entries(USER_UNIT_MAPPING).find(
      ([email]) => email.trim().toLowerCase() === userEmail
    )?.[1] || null;
    
    let profile: 'ADMINISTRADOR' | 'AUDITOR' = 'AUDITOR';
    if (isBaseAdmin) {
      if (userEmail === 'getvb98@gmail.com') {
        profile = selectedProfile;
      } else {
        profile = 'ADMINISTRADOR';
      }
    }
    
    return { 
      currentProfile: profile,
      isAdmin: profile === 'ADMINISTRADOR', 
      userUnit: unit 
    };
  }, [user, selectedProfile]);

  const forceSync = async () => {
    if (autoSyncState === 'syncing') return;
    
    try {
      setAutoSyncState('syncing');
      console.log("[AutoSync] Forced manual refresh started...");
      // Reset local hash values to force sheet parsing and check against DB entries
      localStorage.removeItem('last_hash_tracer_01');
      localStorage.removeItem('last_hash_tracer_02');
      localStorage.removeItem('last_hash_tracer_03');
      localStorage.removeItem('last_autosync_global');
      
      const { runAllSyncs } = await import('./lib/autoSync');
      const results = await runAllSyncs('mai./2026');
      console.log("[AutoSync] Force sync results:", results);
      
      // Dispatch custom event to notify all components to re-read their data
      window.dispatchEvent(new Event('local-data-updated'));
      
      setAutoSyncState('success');
      setTimeout(() => setAutoSyncState('idle'), 6000);
    } catch (err) {
      console.error("[AutoSync] Forced manual refresh failed:", err);
      setAutoSyncState('error');
      setTimeout(() => setAutoSyncState('idle'), 6000);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    let lastSyncTime = 0;

    const runBackgroundSync = async () => {
      const now = Date.now();
      
      // 1. Check local variable guard (5 seconds for high responsiveness)
      if (now - lastSyncTime < 5 * 1000) {
        return;
      }
      
      // 2. Check global browser tab guard (5 seconds for high responsiveness)
      const lastGlobal = localStorage.getItem('last_autosync_global');
      if (lastGlobal) {
        const lastTime = parseInt(lastGlobal, 10);
        if (now - lastTime < 5 * 1000) {
          console.log("[AutoSync] Skipping background sync: completed less than 5 seconds ago.");
          return;
        }
      }

      lastSyncTime = now;
      localStorage.setItem('last_autosync_global', now.toString());

      try {
        if (!isMounted) return;
        setAutoSyncState('syncing');
        console.log("[AutoSync] Automatic background sync started...");
        const { runAllSyncs } = await import('./lib/autoSync');
        await runAllSyncs('mai./2026');
        
        // Notify components of updated local values
        window.dispatchEvent(new Event('local-data-updated'));

        if (isMounted) {
          setAutoSyncState('success');
          setTimeout(() => {
            if (isMounted) setAutoSyncState('idle');
          }, 6000);
        }
      } catch (err) {
        console.error("[AutoSync] Background sync failed:", err);
        if (isMounted) {
          setAutoSyncState('error');
          setTimeout(() => {
            if (isMounted) setAutoSyncState('idle');
          }, 6000);
        }
      }
    };

    const timer = setTimeout(() => {
      runBackgroundSync();
    }, 1500);

    const interval = setInterval(() => {
      runBackgroundSync();
    }, 15 * 1000); // 15 segundos de intervalo para sincronização em tempo real de altíssima resposta

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runBackgroundSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Sync globalUnit to user limit if not admin
  useEffect(() => {
    if (!isAdmin && userUnit) {
      setGlobalUnit(userUnit);
    }
  }, [isAdmin, userUnit]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-neutral-50">
        <Activity className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div 
        className="min-h-screen w-full relative flex flex-col items-center justify-center p-4 overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${loginBg})` }}
      >
        {/* Immersive background image overlay for absolute positioning and visual crispness */}
        <img 
          src={loginBg} 
          alt="Recife Prefeitura Wave Background" 
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none z-0 opacity-100"
        />

        {/* Floating Glassmorphism Login Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.55 }}
          className="max-w-md w-full bg-white/95 backdrop-blur-md p-8 rounded-3xl shadow-2xl shadow-blue-950/40 border border-white/25 relative z-10 flex flex-col items-center"
        >
          {/* Official Recife Cuida Mais / SESAU presentation logo block */}
          <div className="w-full flex flex-col items-center mb-6 select-none">
            
            {/* Main Logo and Branding Row */}
            <div className="flex items-center gap-3.5 justify-center">
              
              {/* High-fidelity Vector Representation of the Recife Cuida Mais emblem */}
              <svg className="w-14 h-14 filter drop-shadow-sm shrink-0" viewBox="0 0 100 100" fill="none">
                <defs>
                  {/* Linear Gradient for Cross (Green/Yellow-Green) */}
                  <linearGradient id="crossGrad" x1="10" y1="50" x2="60" y2="20" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#4ADE80" /> {/* vibrant light green */}
                    <stop offset="50%" stopColor="#A3E635" /> {/* yellow green */}
                    <stop offset="100%" stopColor="#EAB308" /> {/* amber yellow */}
                  </linearGradient>
                  
                  {/* Linear Gradient for Heart (Yellow/Orange/Red) */}
                  <linearGradient id="heartGrad" x1="40" y1="70" x2="90" y2="30" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#EAB308" />
                    <stop offset="50%" stopColor="#F97316" />
                    <stop offset="100%" stopColor="#EA580C" />
                  </linearGradient>
                </defs>

                {/* Styled medical cross interlocking with heart */}
                <path 
                  d="M 32 15 
                     C 32 10, 42 10, 42 15 
                     L 42 30 
                     L 57 30 
                     C 62 30, 62 40, 57 40 
                     L 42 40 
                     L 42 55 
                     C 42 60, 32 60, 32 55 
                     L 32 40 
                     L 17 40 
                     C 12 40, 12 30, 17 30 
                     L 32 30 
                     Z" 
                  fill="url(#crossGrad)" 
                />

                {/* Outer stylized looping heart wave in gradient */}
                <path 
                  d="M 40 35 
                     C 48 18, 65 12, 75 25 
                     C 85 12, 98 18, 95 38 
                     C 90 58, 68 75, 52 88 
                     C 36 75, 28 62, 30 48" 
                  stroke="url(#heartGrad)" 
                  strokeWidth="6" 
                  strokeLinecap="round"
                  strokeLinejoin="round" 
                  fill="none"
                />

                {/* Linking ribbon curve details */}
                <path 
                  d="M 52 88 C 36 75, 28 62, 30 48" 
                  stroke="#4ADE80" 
                  strokeWidth="3.5" 
                  strokeLinecap="round" 
                  fill="none" 
                />
              </svg>

              {/* Side Text Typography styling for the branding */}
              <div className="flex flex-col text-left leading-none font-sans">
                <span className="text-[17px] font-black tracking-tight text-slate-800 uppercase leading-none">RECIFE</span>
                <span className="text-[15px] font-black tracking-tighter text-[#EA580C] uppercase leading-none mt-0.5">CUIDA</span>
                <span className="text-[14px] font-extrabold tracking-tight text-emerald-600 italic lowercase leading-none ml-1">mais</span>
              </div>
            </div>

            {/* Partner badges row (SUS | Secretaria de Saúde | Recife Prefeitura) */}
            <div className="w-full border-t border-slate-200/70 pt-3 mt-4 flex items-center justify-between px-2 gap-2 text-slate-600">
              
              {/* SUS */}
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-4 h-4 bg-[#1E3A8A] rounded-full flex items-center justify-center p-0.5 shrink-0 shadow-sm">
                  <span className="text-[7px] text-white font-extrabold leading-none">SUS</span>
                </div>
                <span className="text-[9px] font-black tracking-wider text-slate-700">SUS</span>
              </div>

              <div className="h-4 w-px bg-slate-300" />

              {/* Secretaria de Saúde */}
              <div className="text-left leading-none shrink-0">
                <p className="text-[6px] font-bold text-slate-500 uppercase tracking-tighter">Secretaria de</p>
                <p className="text-[9px] font-black text-slate-700 tracking-wider uppercase">Saúde</p>
              </div>

              <div className="h-4 w-px bg-slate-300" />

              {/* Recife Prefeitura Crest Header */}
              <div className="flex items-center gap-1.5 shrink-0">
                <svg className="w-3.5 h-3.5 text-[#1E3A8A] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2L3 7v9c0 5.5 4.5 10 9 10s9-4.5 9-10V7l-9-5z" />
                  <path d="M12 6v12M8 10h8" />
                </svg>
                <div className="flex flex-col text-left leading-none">
                  <span className="text-[9px] font-black text-slate-700 tracking-tight leading-none uppercase">RECIFE</span>
                  <span className="text-[5.5px] font-black text-slate-500 tracking-widest leading-none uppercase mt-0.5">PREFEITURA</span>
                </div>
              </div>

            </div>
          </div>
          
          <div className="text-center space-y-1 mb-8">
            <h1 className="text-xs font-black text-slate-400 uppercase tracking-widest">Painel Municipal</h1>
            <p className="text-2xl font-black text-slate-800 tracking-tight">Monitoramento Tracer</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Qualidade e Segurança Assistencial</p>
            
            <div className="flex items-center justify-center gap-2 pt-3">
              <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wider">Secretaria de Saúde</span>
              <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wider">Recife</span>
            </div>
          </div>

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white py-4 px-4 rounded-2xl font-extrabold uppercase tracking-wider text-[10px] transition-all duration-200 shadow-lg shadow-slate-900/10 border border-slate-950 cursor-pointer"
          >
            <UserCircle className="w-5 h-5 text-blue-400" />
            Acessar com Google
          </button>
        </motion.div>
      </div>
    );
  }

  // Active Title computations
  const primaryTitle = view === 'dashboard' ? 'Visão Geral' : 
                       view === 'explorer_units' ? 'Unidades de Saúde' :
                       view === 'explorer' ? 'Explorador de Auditorias' :
                       view === 'schedules' ? 'Referência (Mês)' : 
                       view === 'coleta' ? 'INICIAR TRACER' : 'Admin de Cadastros';

  const secondaryTitle = view === 'dashboard' ? 'Painel executivo de indicadores da saúde' :
                         view === 'explorer_units' ? 'Acompanhamento consolidado por estabelecimento de saúde' :
                         view === 'explorer' ? `Filtro atual: ${explorerFilter || 'Todos os registros'}` :
                         view === 'schedules' ? 'Painel de controle de cronogramas por mês' : 
                         view === 'coleta' ? 'Instrumento digital para auditorias de campo' : 'Manipulação e manutenção de dados';

  const isFilterActive = explorerFilter || globalMonth !== '' || globalQuarter !== '' || globalDay !== '' || globalUnit !== '' || globalType !== '';

  return (
    <div className="flex min-h-screen bg-[#f8fafc] font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* 1. LEFT SIDEBAR - Desktop */}
      <aside className="w-64 bg-[#0a0b9e] text-white shrink-0 hidden lg:flex flex-col border-r border-white/10 relative z-20">
        
        {/* Brand Header */}
        <div className="p-5 border-b border-white/10 flex flex-col gap-4">
          {/* Official Recife Cuida Mais / SESAU presentation logo block */}
          <div className="w-full flex flex-col items-center select-none">
            
            {/* Main Logo and Branding Row */}
            <div className="flex items-center gap-3 justify-center">
              
              {/* High-fidelity Vector Representation of the Recife Cuida Mais emblem */}
              <svg className="w-12 h-12 filter drop-shadow-sm shrink-0" viewBox="0 0 100 100" fill="none">
                <defs>
                  {/* Linear Gradient for Cross (Green/Yellow-Green) */}
                  <linearGradient id="sidebarCrossGrad" x1="10" y1="50" x2="60" y2="20" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#4ADE80" /> {/* vibrant light green */}
                    <stop offset="50%" stopColor="#A3E635" /> {/* yellow green */}
                    <stop offset="100%" stopColor="#EAB308" /> {/* amber yellow */}
                  </linearGradient>
                  
                  {/* Linear Gradient for Heart (Yellow/Orange/Red) */}
                  <linearGradient id="sidebarHeartGrad" x1="40" y1="70" x2="90" y2="30" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#EAB308" />
                    <stop offset="50%" stopColor="#F97316" />
                    <stop offset="100%" stopColor="#EA580C" />
                  </linearGradient>
                </defs>

                {/* Styled medical cross interlocking with heart */}
                <path 
                  d="M 32 15 
                     C 32 10, 42 10, 42 15 
                     L 42 30 
                     L 57 30 
                     C 62 30, 62 40, 57 40 
                     L 42 40 
                     L 42 55 
                     C 42 60, 32 60, 32 55 
                     L 32 40 
                     L 17 40 
                     C 12 40, 12 30, 17 30 
                     L 32 30 
                     Z" 
                  fill="url(#sidebarCrossGrad)" 
                />

                {/* Outer stylized looping heart wave in gradient */}
                <path 
                  d="M 40 35 
                     C 48 18, 65 12, 75 25 
                     C 85 12, 98 18, 95 38 
                     C 90 58, 68 75, 52 88 
                     C 36 75, 28 62, 30 48" 
                  stroke="url(#sidebarHeartGrad)" 
                  strokeWidth="6" 
                  strokeLinecap="round"
                  strokeLinejoin="round" 
                  fill="none"
                />

                {/* Linking ribbon curve details */}
                <path 
                  d="M 52 88 C 36 75, 28 62, 30 48" 
                  stroke="#4ADE80" 
                  strokeWidth="3.5" 
                  strokeLinecap="round" 
                  fill="none" 
                />
              </svg>

              {/* Side Text Typography styling for the branding */}
              <div className="flex flex-col text-left leading-none font-sans">
                <span className="text-[15px] font-black tracking-tight text-white uppercase leading-none">RECIFE</span>
                <span className="text-[13px] font-black tracking-tighter text-amber-300 uppercase leading-none mt-0.5">CUIDA</span>
                <span className="text-[12px] font-extrabold tracking-tight text-emerald-400 italic lowercase leading-none ml-1">mais</span>
              </div>
            </div>

            {/* Partner badges row (SUS | Secretaria de Saúde | Recife Prefeitura) */}
            <div className="w-full border-t border-white/10 pt-3 mt-3 flex items-center justify-between px-1 gap-1.5 text-blue-200">
              
              {/* SUS */}
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-3.5 h-3.5 bg-white text-[#0a0b9e] rounded-full flex items-center justify-center p-0.5 shrink-0 shadow-sm">
                  <span className="text-[6px] font-extrabold leading-none">SUS</span>
                </div>
                <span className="text-[8px] font-black tracking-wider text-white">SUS</span>
              </div>

              <div className="h-3.5 w-px bg-white/10" />

              {/* Secretaria de Saúde */}
              <div className="text-left leading-none shrink-0">
                <p className="text-[5.5px] font-bold text-blue-200/70 uppercase tracking-tighter">Secretaria de</p>
                <p className="text-[8px] font-black text-white tracking-wider uppercase">Saúde</p>
              </div>

              <div className="h-3.5 w-px bg-white/10" />

              {/* Recife Prefeitura Crest Header */}
              <div className="flex items-center gap-1 shrink-0">
                <svg className="w-3 h-3 text-blue-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2L3 7v9c0 5.5 4.5 10 9 10s9-4.5 9-10V7l-9-5z" />
                  <path d="M12 6v12M8 10h8" />
                </svg>
                <div className="flex flex-col text-left leading-none">
                  <span className="text-[8px] font-black text-white tracking-tight leading-none uppercase">RECIFE</span>
                  <span className="text-[5px] font-black text-blue-200/70 tracking-widest leading-none uppercase mt-0.5">PREFEITURA</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-grow px-3 py-6 space-y-4 overflow-y-auto scrollbar-hide">
          <SidebarButton 
            active={view === 'dashboard'} 
            onClick={() => { setView('dashboard'); setExplorerFilter(''); }}
            icon={<LayoutDashboard className="w-4 h-4" />}
            label="Visão Geral"
          />
          {currentProfile === 'AUDITOR' && (
            <SidebarButton 
              active={view === 'coleta'} 
              onClick={() => { setView('coleta'); setExplorerFilter(''); }}
              icon={<ClipboardCheck className="w-4 h-4" />}
              label="INICIAR TRACER"
            />
          )}
          <SidebarButton 
            active={view === 'explorer'} 
            onClick={() => { setView('explorer'); setExplorerFilter(''); }}
            icon={<ClipboardList className="w-4 h-4" />}
            label="Explorar Dados"
          />
          <SidebarButton 
            active={view === 'explorer_units'} 
            onClick={() => { setView('explorer_units'); setExplorerFilter(''); }}
            icon={<Building2 className="w-4 h-4" />}
            label="Unidades de Saúde"
          />
        </nav>

        {/* Clear Filters Action */}
        <div className="p-4 border-t border-white/10 space-y-2">
          {isFilterActive && (
            <button 
              onClick={() => {
                setView('dashboard');
                setExplorerFilter('');
                setGlobalMonth('');
                setGlobalQuarter('');
                setGlobalDay('');
                setGlobalUnit('');
                setGlobalType('');
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm shadow-amber-500/10"
            >
              <X className="w-3.5 h-3.5" />
              Limpar filtros
            </button>
          )}

          <div className="py-2 text-center text-[8px] font-bold text-white/40 uppercase tracking-widest select-none">
            Painel Tracer • v2.0
          </div>
        </div>
      </aside>

      {/* 2. MOBILE SIDEBAR DRAWER */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black z-30 lg:hidden"
            />
            {/* Drawer */}
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed top-0 bottom-0 left-0 w-64 bg-[#0a0b9e] text-white z-40 lg:hidden flex flex-col border-r border-white/10"
            >
              <div className="p-5 border-b border-white/10 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 select-none">
                    <svg className="w-10 h-10 filter drop-shadow-sm shrink-0" viewBox="0 0 100 100" fill="none">
                      <rect x="32" y="15" width="10" height="30" rx="3" fill="#A3E635" />
                      <rect x="17" y="30" width="30" height="10" rx="3" fill="#A3E635" />
                      <path d="M 40 35 C 48 18, 65 12, 75 25 C 85 12, 98 18, 95 38 C 90 58, 68 75, 52 88 C 36 75, 28 62, 30 48" stroke="#F97316" strokeWidth="5" fill="none" />
                    </svg>
                    <div className="flex flex-col text-left leading-none font-sans">
                      <span className="text-[13px] font-black tracking-tight text-white uppercase">RECIFE</span>
                      <span className="text-[12px] font-black tracking-tight text-amber-300 uppercase mt-0.5">CUIDA</span>
                      <span className="text-[11px] font-bold text-emerald-400 italic lowercase ml-0.5">mais</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setMobileSidebarOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-white/15"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>

                {/* Sub-logos in mobile */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 opacity-90 text-[8px] font-black tracking-wider text-blue-200">
                  <span className="bg-white/10 text-white px-1.5 py-0.5 rounded">SUS</span>
                  <span className="opacity-70 leading-none">Secr. de Saúde</span>
                  <span className="border border-white/20 px-1 py-0.5 rounded leading-none text-white/90">RECIFE</span>
                </div>
              </div>

              {/* Navigation in Mobile Drawer */}
              <nav className="flex-grow px-3 py-4 space-y-4 overflow-y-auto">
                <SidebarButton 
                  active={view === 'dashboard'} 
                  onClick={() => { setView('dashboard'); setExplorerFilter(''); setMobileSidebarOpen(false); }}
                  icon={<LayoutDashboard className="w-4 h-4" />}
                  label="Visão Geral"
                />
                {currentProfile === 'AUDITOR' && (
                  <SidebarButton 
                    active={view === 'coleta'} 
                    onClick={() => { setView('coleta'); setExplorerFilter(''); setMobileSidebarOpen(false); }}
                    icon={<ClipboardCheck className="w-4 h-4" />}
                    label="INICIAR TRACER"
                  />
                )}
                <SidebarButton 
                  active={view === 'explorer'} 
                  onClick={() => { setView('explorer'); setExplorerFilter(''); setMobileSidebarOpen(false); }}
                  icon={<ClipboardList className="w-4 h-4" />}
                  label="Explorar Dados"
                />
                <SidebarButton 
                  active={view === 'explorer_units'} 
                  onClick={() => { setView('explorer_units'); setExplorerFilter(''); setMobileSidebarOpen(false); }}
                  icon={<Building2 className="w-4 h-4" />}
                  label="Unidades de Saúde"
                />
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 3. RIGHT CONTENT AREA */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        
        {/* Main top bar */}
        <header className="h-[76px] px-4 md:px-8 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 relative z-10 gap-4">
          
          <div className="flex items-center gap-3">
            {/* Hamburger Button for Mobile */}
            <button 
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 flex lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* View Title */}
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{primaryTitle}</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">{secondaryTitle}</p>
            </div>
          </div>

          {/* Centralized filters (Month and Health Unit only) */}
          <div className="hidden md:flex items-center gap-3">
            
            {/* Selector 1: Mês (Calendar) */}
            <div className="flex items-center gap-2 bg-[#f8fafc] hover:bg-slate-100/80 border border-slate-200/60 rounded-xl px-3 py-2 cursor-pointer transition-colors shadow-sm">
              <CalendarDays className="w-4 h-4 text-slate-500 shrink-0" />
              <select 
                value={globalMonth}
                onChange={(e) => {
                  setGlobalMonth(e.target.value);
                  if (e.target.value !== '') {
                    setGlobalQuarter('');
                  }
                }}
                className="bg-transparent text-[10px] font-black uppercase text-slate-700 outline-none cursor-pointer pr-1"
              >
                <option value="">Mês</option>
                {MONTH_NAMES.map((m, idx) => (
                  <option key={idx} value={String(idx)}>{m}</option>
                ))}
              </select>
            </div>

            {/* Selector 1.2: Trimestre */}
            <div className="flex items-center gap-2 bg-[#f8fafc] hover:bg-slate-100/80 border border-slate-200/60 rounded-xl px-3 py-2 cursor-pointer transition-colors shadow-sm">
              <CalendarDays className="w-4 h-4 text-slate-500 shrink-0" />
              <select 
                value={globalQuarter}
                onChange={(e) => {
                  setGlobalQuarter(e.target.value);
                  if (e.target.value !== '') {
                    setGlobalMonth('');
                    setGlobalDay('');
                  }
                }}
                className="bg-transparent text-[10px] font-black uppercase text-slate-700 outline-none cursor-pointer pr-1"
              >
                <option value="">Trimestre</option>
                <option value="1">1º Trimestre</option>
                <option value="2">2º Trimestre</option>
                <option value="3">3º Trimestre</option>
                <option value="4">4º Trimestre</option>
              </select>
            </div>

            {/* Selector 1.5: Dia Filter chip next to month if selected */}
            {globalMonth !== '' && (
              <div 
                onClick={() => setIsDayModalOpen(true)}
                className={`flex items-center gap-1.5 border rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer shadow-sm ${
                  globalDay !== '' 
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' 
                    : 'bg-[#f8fafc] hover:bg-slate-100/80 border border-slate-200/60 text-slate-500'
                }`}
                title="Clique para filtrar por dia do mês"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{globalDay !== '' ? `Dia: ${globalDay}` : 'Filtrar por Dia'}</span>
                {globalDay !== '' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setGlobalDay('');
                    }} 
                    className="p-0.5 hover:bg-indigo-200 rounded shrink-0 ml-1 cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5 text-indigo-500" />
                  </button>
                )}
              </div>
            )}

            {/* Selector 2: Unidade de Saúde */}
            <div className="flex items-center gap-2 bg-[#f8fafc] hover:bg-slate-100/80 border border-slate-200/60 rounded-xl px-4 py-2 cursor-pointer transition-colors shadow-sm">
              <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[7.5px] font-semibold text-slate-400 leading-none uppercase">Unidade de Saúde</span>
                <select 
                  value={globalUnit}
                  onChange={(e) => setGlobalUnit(e.target.value)}
                  disabled={!isAdmin && !!userUnit}
                  className="bg-transparent text-[10px] font-black uppercase text-slate-700 outline-none cursor-pointer pr-1 mt-0.5"
                >
                  <option value="">Todas</option>
                  {HEALTH_UNITS.map(u => (
                    <option key={u.id} value={u.id}>{u.name.replace('Hospital de Pediatria ', '').replace('Policlínica e Maternidade ', '')}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          {/* User Profile Area (Notification & Help buttons removed as requested) */}
          <div className="flex items-center gap-2 md:gap-4.5">
            
            {/* Real-time Sync Button */}
            <button 
              onClick={forceSync}
              disabled={autoSyncState === 'syncing'}
              className="flex items-center gap-2 bg-[#ef5d00] hover:bg-[#d65300] text-white disabled:opacity-50 border border-[#b24500] rounded-xl px-3.5 py-2 cursor-pointer transition-all active:scale-95 shadow-sm select-none"
              title="Forçar atualização e sincronizar planilhas em tempo real"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoSyncState === 'syncing' ? 'animate-spin' : ''}`} />
              <span className="text-[9px] font-black uppercase tracking-wider hidden md:inline-block">Sincronizar</span>
            </button>

            {/* User Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 p-1 px-2.5 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200/60"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 shadow-inner">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-blue-500" />
                  )}
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-[10px] font-extrabold text-slate-700 leading-none">Olá, {user.displayName?.split(' ')[0] || 'gestor'}</p>
                  <p className="text-[8px] font-bold uppercase text-slate-400 tracking-wider mt-0.5">
                    {currentProfile === 'ADMINISTRADOR' ? 'Administrador' : 'Auditor'}
                  </p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {userDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserDropdownOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-200/80 p-1.5 z-20 space-y-1"
                    >
                      <div className="px-3 py-2 border-b border-slate-100 text-left">
                        <p className="text-[10px] font-black text-slate-800 leading-none">{user.displayName}</p>
                        <p className="text-[8px] font-bold text-slate-400 font-mono tracking-tighter mt-1 truncate">{user.email}</p>
                      </div>

                      {user.email?.toLowerCase().trim() === 'getvb98@gmail.com' && (
                        <div className="px-3 py-2 border-b border-slate-100 space-y-1.5">
                          <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Alternar Perfil</p>
                          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <button
                              onClick={() => handleToggleProfile('ADMINISTRADOR')}
                              className={`flex-1 text-[8px] font-black uppercase tracking-wider py-1 rounded-md transition-all cursor-pointer ${
                                currentProfile === 'ADMINISTRADOR' 
                                  ? 'bg-white text-slate-900 shadow-xs' 
                                  : 'text-slate-500 hover:text-slate-850'
                              }`}
                            >
                              Admin
                            </button>
                            <button
                              onClick={() => handleToggleProfile('AUDITOR')}
                              className={`flex-1 text-[8px] font-black uppercase tracking-wider py-1 rounded-md transition-all cursor-pointer ${
                                currentProfile === 'AUDITOR' 
                                  ? 'bg-white text-slate-900 shadow-xs' 
                                  : 'text-slate-500 hover:text-slate-850'
                              }`}
                            >
                              Auditor
                            </button>
                          </div>
                        </div>
                      )}

                      {currentProfile === 'AUDITOR' && (
                        <button 
                          onClick={() => {
                            setUserDropdownOpen(false);
                            setView('coleta');
                          }}
                          className="w-full px-3 py-2 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-[10px] font-extrabold uppercase tracking-wide rounded-lg text-left flex items-center gap-2 cursor-pointer"
                        >
                          <UserCheck className="w-4 h-4 text-slate-400" />
                          Perfil & INICIAR TRACER
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setView('explorer');
                        }}
                        className="w-full px-3 py-2 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-[10px] font-extrabold uppercase tracking-wide rounded-lg text-left flex items-center gap-2 cursor-pointer"
                      >
                        <ClipboardList className="w-4 h-4 text-slate-400" />
                        Minhas Auditorias
                      </button>
                      <button 
                        onClick={() => {
                          setUserDropdownOpen(false);
                          logout();
                        }}
                        className="w-full px-3 py-2 hover:bg-red-50 text-red-600 font-extrabold uppercase tracking-wide text-[10px] rounded-lg text-left flex items-center gap-2 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        Sair do Painel
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

          </div>
        </header>

        {/* 4. MAIN CONTENT CONTAINER CONTAINER (Saves standard margins & max width) */}
        <main className="flex-grow p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8">
          
          {isQuotaExceeded && (
            <div className="bg-amber-50/95 border border-amber-300 rounded-2xl p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 shadow-sm">
              <div className="flex items-start md:items-center gap-3.5 flex-grow">
                <div className="p-2.5 bg-amber-100/80 rounded-xl border border-amber-200 shrink-0 text-amber-700">
                  <Database className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 text-left flex-grow">
                  <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider">Modo de Exibição Local de Contingência Ativo</h4>
                  <p className="text-[11px] text-amber-700/90 font-bold leading-normal">
                    O banco de dados em nuvem do Google Cloud (Firestore) atingiu o limite de cota de gravação gratuita diária do projeto. Para manter todas as telas e painéis totalmente operacionais com gráficos completos, o sistema ativou o sincronizador de contingência comercial com hidratação de banco de dados em cache local para as unidades de saúde de Recife.
                  </p>
                  {reconnectError && (
                    <p className="text-[10px] text-red-600 font-extrabold uppercase bg-red-50 border border-red-200 px-2 py-1 rounded inline-block">
                      {reconnectError}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-amber-200">
                <button
                  onClick={handleTryReconnect}
                  disabled={checkingConnection}
                  className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-white hover:bg-neutral-50 active:bg-neutral-100 disabled:opacity-50 text-amber-800 border border-amber-300 rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingConnection ? 'animate-spin' : ''}`} />
                  {checkingConnection ? 'Verificando...' : 'Testar Conexão'}
                </button>
                <span className="text-[9px] bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-black uppercase tracking-widest border border-amber-200 select-none">
                  Limites de Cota Excedidos
                </span>
              </div>
            </div>
          )}

          {/* Quick Alert Warning (if user lacks data / isAdmin toggle) */}
          {!isAdmin && userUnit && (
            <div className="bg-blue-50/50 border border-blue-200/60 rounded-2xl p-4.5 flex items-center gap-3.5">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <p className="text-xs text-blue-800 font-bold uppercase tracking-tight">
                Identificação segura de unidade: <span className="underline">{HEALTH_UNITS.find(u => u.id === userUnit)?.name}</span>. Você possui permissão para visualizar e consolidar os relatórios da sua respectiva unidade.
              </p>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={`${view}-${explorerFilter}-${globalMonth}-${globalQuarter}-${globalDay}-${globalUnit}-${globalType}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="min-h-[500px]"
            >
              {view === 'dashboard' && (
                <Dashboard 
                  onExplore={() => setView('explorer_units')} 
                  userUnit={userUnit} 
                  isAdmin={isAdmin}
                  globalMonth={globalMonth}
                  globalQuarter={globalQuarter}
                  globalDay={globalDay}
                  globalUnit={globalUnit}
                  globalType={globalType}
                  onSetMonth={setGlobalMonth}
                  onSetQuarter={setGlobalQuarter}
                  onSetDay={setGlobalDay}
                  onSetUnit={setGlobalUnit}
                  onSetType={setGlobalType}
                  subFilter={explorerFilter}
                />
              )}
              {view === 'explorer_units' && <UnitExplorer />}
              {view === 'schedules' && <SchedulesSync />}
              {view === 'data_mgmt' && <DataManagement />}
              {view === 'coleta' && <ColetaDigital user={user} />}
              {view === 'explorer' && (
                <AuditExplorer 
                  userUnit={userUnit} 
                  isAdmin={isAdmin} 
                  globalMonth={globalMonth}
                  globalQuarter={globalQuarter}
                  globalDay={globalDay}
                  globalUnit={globalUnit}
                  globalType={globalType}
                  onSetMonth={setGlobalMonth}
                  onSetQuarter={setGlobalQuarter}
                  onSetDay={setGlobalDay}
                  onSetUnit={setGlobalUnit}
                  onSetType={setGlobalType}
                  sidebarFilter={explorerFilter}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* 5. BRAND FOOTER (Styled exactly like mockup bottom bar) */}
        <footer className="h-14 border-t border-slate-200/80 bg-white/75 backdrop-blur-sm px-6 md:px-8 mt-12 flex items-center justify-between text-[9px] uppercase font-bold text-slate-400 select-none">
          <div className="flex items-center gap-4">
            {autoSyncState === 'syncing' ? (
              <span className="text-amber-600 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-500 shrink-0" />
                Sincronizando planilhas automaticamente...
              </span>
            ) : autoSyncState === 'success' ? (
              <span className="text-emerald-600 flex items-center gap-1.5 animate-pulse bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                Planilhas sincronizadas automaticamente
              </span>
            ) : autoSyncState === 'error' ? (
              <span className="text-red-500 flex items-center gap-1 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                Falha no sincronismo automático
              </span>
            ) : (
              <span className="text-indigo-600 flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                Sincronismo automático ativo
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-blue-500">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Os indicadores podem sofrer alterações conforme atualização dos sistemas.</span>
          </div>
          <div className="font-mono text-slate-400">
            VER. 1.0.0
          </div>
        </footer>

      </div>

      <AnimatePresence>
        {isDayModalOpen && globalMonth !== '' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] cursor-default"
            onClick={() => setIsDayModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 text-indigo-600">
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <CalendarDays className="w-5 h-5 shrink-0 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 leading-none">
                      Filtrar por Dia?
                    </h3>
                    <p className="text-[9px] font-bold text-indigo-600 mt-1 uppercase tracking-wider leading-none">
                      Mês: {MONTH_NAMES[parseInt(globalMonth)]}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-slate-600 text-[11px] leading-relaxed">
                  <p>
                    Escolha um dia específico abaixo para detalhar ainda mais os seus indicadores ou continue para ver o mês completo:
                  </p>

                  {/* 31-day selector grid */}
                  <div className="grid grid-cols-7 gap-1 pt-1.5">
                    {Array.from({ length: 31 }, (_, i) => {
                      const dayNum = i + 1;
                      const isSelected = String(dayNum) === globalDay;
                      return (
                        <button
                          key={dayNum}
                          onClick={() => {
                            setGlobalDay(String(dayNum));
                            setIsDayModalOpen(false);
                          }}
                          className={`
                            h-7 text-[10px] font-black rounded-md transition-all flex items-center justify-center cursor-pointer select-none border border-slate-200/40
                            ${isSelected 
                              ? 'bg-[#0a0b9e] text-white border-[#0a0b9e] shadow-xs shadow-[#0a0b9e]/20' 
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                            }
                          `}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-1 justify-end">
                  <button
                    onClick={() => {
                      setGlobalDay('');
                      setIsDayModalOpen(false);
                    }}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                  >
                    Ver Mês Inteiro
                  </button>
                  <button
                    onClick={() => setIsDayModalOpen(false)}
                    className="px-3.5 py-2 bg-[#0a0b9e] hover:bg-[#080980] text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-xs shadow-blue-200"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

interface SidebarButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function SidebarButton({ active, onClick, icon, label }: SidebarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 group text-left cursor-pointer
        ${active 
          ? 'bg-white text-slate-900 shadow-md shadow-[#0a0b9e]/30' 
          : 'text-blue-100 hover:text-white hover:bg-white/10'
        }
      `}
    >
      <span className={`transition-colors duration-200 ${active ? 'text-blue-600' : 'text-blue-200 group-hover:text-white'}`}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
