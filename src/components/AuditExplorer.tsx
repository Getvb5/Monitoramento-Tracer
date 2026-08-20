import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, limit, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { HEALTH_UNITS, TRACER_FIELD_ORDER } from '../lib/utils';
import { 
  FALLBACK_HAND_AUDITS, 
  FALLBACK_PATIENT_AUDITS, 
  FALLBACK_SURGERY_AUDITS, 
  getMergedHandAudits, 
  getMergedPatientAudits, 
  getMergedSurgeryAudits,
  getDeletedAuditIds,
  deleteAuditFromLocal,
  updateAuditInLocal
} from '../lib/fallbackData';
import { 
  Search, Filter, Download, ChevronRight, 
  CheckCircle2, XCircle, AlertTriangle, Building2,
  Calendar, User as UserIcon, Tag, Database,
  Table as TableIcon, LayoutList, Pencil, Trash2, X, SlidersHorizontal, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const getRowValue = (data: any, header: string) => {
  if (!data) return '-';
  if (data[header] !== undefined) return data[header];
  if (data[header + ':'] !== undefined) return data[header + ':'];
  if (data[header + ' '] !== undefined) return data[header + ' '];
  
  const h = header.trim().toLowerCase();
  const entry = Object.entries(data).find(([k]) => k.trim().toLowerCase().replace(/:$/, '') === h);
  return entry ? entry[1] : '-';
};

export function getAuditDateObj(audit: any): Date {
  if (!audit) return new Date();
  
  // Try to extract date from rawData
  const data = audit.rawData || (audit.sourceRowHash ? JSON.parse(audit.sourceRowHash) : null);
  if (data) {
    const keysToCheck = [
      '03- Data do Tracer:',
      '03- Data do Tracer',
      'Data do Tracer:',
      'Data do Tracer',
      'DATA DE INÍCIO',
      'DATA DO TRACER',
      'DATA',
      'CARIMBO DE DATA/HORA',
      'Carimbo de data/hora'
    ];
    let startDateStr = '';
    for (const key of keysToCheck) {
      const val = getRowValue(data, key);
      if (val && val !== '-' && String(val).trim() !== '') {
        startDateStr = String(val).trim();
        break;
      }
    }

    if (startDateStr) {
      const datePart = startDateStr.split(' ')[0];
      const timePart = startDateStr.split(' ')[1] || '';
      
      let parsedDate: Date | null = null;
      
      const parts = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (parts) {
        const day = parseInt(parts[1]);
        const month = parseInt(parts[2]) - 1;
        let year = parseInt(parts[3]);
        if (year < 100) year += 2000; // handle YY format
        parsedDate = new Date(year, month, day);
      } else {
        const parts2 = datePart.match(/^(\d{1,2})\/(\d{1,2})/);
        if (parts2) {
          const day = parseInt(parts2[1]);
          const month = parseInt(parts2[2]) - 1;
          parsedDate = new Date(new Date().getFullYear(), month, day);
        } else {
          const parts3 = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
          if (parts3) {
            const year = parseInt(parts3[1]);
            const month = parseInt(parts3[2]) - 1;
            const day = parseInt(parts3[3]);
            parsedDate = new Date(year, month, day);
          }
        }
      }

      if (parsedDate && !isNaN(parsedDate.getTime())) {
        if (timePart) {
          const timeMatches = timePart.match(/^(\d{1,2}):(\d{1,2})/);
          if (timeMatches) {
            parsedDate.setHours(parseInt(timeMatches[1]), parseInt(timeMatches[2]), 0, 0);
          }
        }
        return parsedDate;
      }
    }
  }

  // Fallback to timestamp
  if (audit.timestamp) {
    return audit.timestamp.toDate ? audit.timestamp.toDate() : new Date(audit.timestamp);
  }

  // Fallback to timestampStr
  if (audit.timestampStr) {
    return new Date(audit.timestampStr);
  }

  return new Date();
}

export function getTracerDateMonth(audit: any): number | null {
  const d = getAuditDateObj(audit);
  return d ? d.getMonth() : null;
}

export function getTracerDateDay(audit: any): number | null {
  const d = getAuditDateObj(audit);
  return d ? d.getDate() : null;
}

const getHeaderSortIndex = (header: string) => {
  const normalize = (s: string) => s.toLowerCase().replace(/[?:]/g, '').replace(/^[0-9]+-\s+/, '').trim();
  const rawKey = header.trim();
  const baseKey = rawKey.replace(/[:_]\d+$/, '');
  const normalizedBase = normalize(baseKey);
  
  const matchingIndices: number[] = [];
  TRACER_FIELD_ORDER.forEach((h, i) => {
    if (normalize(h) === normalizedBase) {
      matchingIndices.push(i);
    }
  });

  const suffixMatch = rawKey.match(/[_:](\d+)$/);
  const instance = suffixMatch ? parseInt(suffixMatch[1]) : 0;
  
  if (matchingIndices.length > 0) {
    return matchingIndices[instance] ?? matchingIndices[matchingIndices.length - 1];
  }
  
  // Try partial match if exact normalized match fails
  const partialMatchIndex = TRACER_FIELD_ORDER.findIndex(h => normalize(h).includes(normalizedBase));
  if (partialMatchIndex !== -1) return partialMatchIndex;
  
  return 999;
};

const computeUpdatedScores = (rawData: any) => {
  const scores: any = {};
  Object.entries(rawData || {}).forEach(([k, v]) => {
    const keyLower = k.toLowerCase();
    const valUpper = String(v).toUpperCase().trim();
    const isYes = valUpper === 'SIM';
    
    if (keyLower.includes('pulseira branca')) {
      scores.hasWristband = isYes;
    }
    if (keyLower.includes('legível')) {
      scores.wristbandLegible = isYes;
    }
    if (keyLower.includes('preenchida adequadamente')) {
      scores.correctData = isYes;
    }
    if (keyLower.includes('mãos adequadamente') || keyLower.includes('mãos foi realizada') || keyLower.includes('higienização das mãos')) {
      scores.compliant = isYes;
    }
    if (keyLower.includes('antes de marcar a indução') || keyLower.includes('antes da indução anestésica')) {
      scores.signIIn = isYes;
    }
    if (keyLower.includes('antes da incisão cirúrgica') && keyLower.includes('check list')) {
      scores.timeOut = isYes;
    }
    if (keyLower.includes('antes de sair da sala')) {
      scores.signOut = isYes;
    }
  });
  return scores;
};

interface Props {
  userUnit: string | null;
  isAdmin: boolean;
  globalMonth: string;
  globalQuarter?: string;
  globalDay?: string;
  globalUnit: string;
  globalType: string;
  globalTracer?: string;
  onSetMonth: (month: string) => void;
  onSetQuarter?: (quarter: string) => void;
  onSetDay?: (day: string) => void;
  onSetUnit: (unit: string) => void;
  onSetType: (type: string) => void;
  onSetTracer?: (tracer: string) => void;
  sidebarFilter: string;
}

export default function AuditExplorer({ 
  userUnit, 
  isAdmin,
  globalMonth,
  globalQuarter = '',
  globalDay = '',
  globalUnit,
  globalType,
  globalTracer = '',
  onSetMonth,
  onSetQuarter,
  onSetDay,
  onSetUnit,
  onSetType,
  onSetTracer,
  sidebarFilter
}: Props) {
  const [handAudits, setHandAudits] = useState<any[]>([]);
  const [patientAudits, setPatientAudits] = useState<any[]>([]);
  const [surgeryAudits, setSurgeryAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'compact' | 'integral'>('compact');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editingAudit, setEditingAudit] = useState<any | null>(null);
  const [deletingAudit, setDeletingAudit] = useState<any | null>(null);
  const [viewingAudit, setViewingAudit] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleDeleteAudit = async (audit: any) => {
    if (!audit) return;

    try {
      // 1. Delete locally (removes from localStorage and deleted ids index)
      deleteAuditFromLocal(audit.id);

      // 2. If it's a Firestore document (real document ID, doesn't start with 'f_')
      if (audit.id && !audit.id.startsWith('f_') && !audit.id.startsWith('local_')) {
        let coll = '';
        if (audit.type === 'T01') coll = 'audits_patient_id';
        else if (audit.type === 'T02') coll = 'audits_safe_surgery';
        else if (audit.type === 'T03') coll = 'audits_hand_hygiene';

        if (coll) {
          const docRef = doc(db, coll, audit.id);
          await deleteDoc(docRef);
        }
      }

      setRefreshTrigger(prev => prev + 1);
      triggerToast('Registro de auditoria excluído com sucesso!', 'success');
      setDeletingAudit(null);
    } catch (e: any) {
      console.error('Error deleting audit:', e);
      triggerToast('Erro ao excluir o registro: ' + e.message, 'error');
    }
  };

  const handleSaveEdit = async (auditId: string, updatedPayload: any) => {
    try {
      // 1. Update in local storage
      updateAuditInLocal(auditId, updatedPayload);

      // 2. If it's a real Firestore document
      if (auditId && !auditId.startsWith('f_') && !auditId.startsWith('local_')) {
        let coll = '';
        if (updatedPayload.type === 'T01') coll = 'audits_patient_id';
        else if (updatedPayload.type === 'T02') coll = 'audits_safe_surgery';
        else if (updatedPayload.type === 'T03') coll = 'audits_hand_hygiene';

        if (coll) {
          const docRef = doc(db, coll, auditId);
          
          // Compute scores for custom fields updating
          const updatedScores = computeUpdatedScores(updatedPayload.rawData);
          
          await updateDoc(docRef, {
            unitId: updatedPayload.unitId,
            auditorId: updatedPayload.auditorId,
            rawData: updatedPayload.rawData,
            sourceRowHash: JSON.stringify(updatedPayload.rawData),
            ...updatedScores
          });
        }
      }

      setEditingAudit(null);
      setRefreshTrigger(prev => prev + 1);
      triggerToast('Registro de auditoria atualizado com sucesso!', 'success');
    } catch (e: any) {
      console.error('Error updating audit:', e);
      triggerToast('Erro ao atualizar o registro: ' + e.message, 'error');
    }
  };

  useEffect(() => {
    const handleRefresh = () => {
      setRefreshTrigger(prev => prev + 1);
    };
    window.addEventListener('local-data-updated', handleRefresh);
    return () => {
      window.removeEventListener('local-data-updated', handleRefresh);
    };
  }, []);
  
  // Local sub-filters (others are synced globally)
  const [tracerFilter, setTracerFilter] = useState(globalTracer || '');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setTracerFilter(globalTracer || '');
  }, [globalTracer]);

  useEffect(() => {
    if (localStorage.getItem('firestore_quota_exceeded') === 'true') {
      setHandAudits(getMergedHandAudits());
      setPatientAudits(getMergedPatientAudits());
      setSurgeryAudits(getMergedSurgeryAudits());
      setLoading(false);
      return;
    }

    // Real-time synchronization
    const qHand = query(collection(db, 'audits_hand_hygiene'), limit(500));
    const qPatient = query(collection(db, 'audits_patient_id'), limit(500));
    const qSurgery = query(collection(db, 'audits_safe_surgery'), limit(500));

    let loadedHand = false;
    let loadedPatient = false;
    let loadedSurgery = false;

    const checkLoading = () => {
      if (loadedHand && loadedPatient && loadedSurgery) {
        setLoading(false);
      }
    };

    let unsubHand: () => void = () => {};
    let unsubPatient: () => void = () => {};
    let unsubSurgery: () => void = () => {};

    const handleQuotaFailure = () => {
      localStorage.setItem('firestore_quota_exceeded', 'true');
      window.dispatchEvent(new Event('firestore-quota-exceeded'));
      setHandAudits(getMergedHandAudits());
      setPatientAudits(getMergedPatientAudits());
      setSurgeryAudits(getMergedSurgeryAudits());
      setLoading(false);
      try { unsubHand(); } catch (e) {}
      try { unsubPatient(); } catch (e) {}
      try { unsubSurgery(); } catch (e) {}
    };

    unsubHand = onSnapshot(qHand, (s) => {
      const deletedIds = getDeletedAuditIds();
      const firestoreDocs = s.docs
        .map(d => ({ id: d.id, ...d.data(), type: 'T03' }))
        .filter(d => !deletedIds.includes(d.id));
      const mergedMap = new Map<string, any>();
      getMergedHandAudits().forEach(a => mergedMap.set(a.id, a));
      firestoreDocs.forEach(a => mergedMap.set(a.id, a));

      const allAudits = Array.from(mergedMap.values());
      const hasRealAudits = allAudits.some(a => !a.id.startsWith('f_'));
      setHandAudits(hasRealAudits ? allAudits.filter(a => !a.id.startsWith('f_')) : allAudits);
      loadedHand = true;
      checkLoading();
    }, (err) => {
      console.error("AuditExplorer hand audits loading failed:", err);
      if (err?.message && (err.message.includes('Quota') || err.message.includes('resource-exhausted') || err.message.includes('quota') || err.message.includes('limit'))) {
        handleQuotaFailure();
      } else {
        const fallbackList = getMergedHandAudits();
        const hasRealAudits = fallbackList.some(a => !a.id.startsWith('f_'));
        setHandAudits(hasRealAudits ? fallbackList.filter(a => !a.id.startsWith('f_')) : fallbackList);
        loadedHand = true;
        checkLoading();
      }
    });

    unsubPatient = onSnapshot(qPatient, (s) => {
      const deletedIds = getDeletedAuditIds();
      const firestoreDocs = s.docs
        .map(d => ({ id: d.id, ...d.data(), type: 'T01' }))
        .filter(d => !deletedIds.includes(d.id));
      const mergedMap = new Map<string, any>();
      getMergedPatientAudits().forEach(a => mergedMap.set(a.id, a));
      firestoreDocs.forEach(a => mergedMap.set(a.id, a));

      const allAudits = Array.from(mergedMap.values());
      const hasRealAudits = allAudits.some(a => !a.id.startsWith('f_'));
      setPatientAudits(hasRealAudits ? allAudits.filter(a => !a.id.startsWith('f_')) : allAudits);
      loadedPatient = true;
      checkLoading();
    }, (err) => {
      console.error("AuditExplorer patient ID loading failed:", err);
      if (err?.message && (err.message.includes('Quota') || err.message.includes('resource-exhausted') || err.message.includes('quota') || err.message.includes('limit'))) {
        handleQuotaFailure();
      } else {
        const fallbackList = getMergedPatientAudits();
        const hasRealAudits = fallbackList.some(a => !a.id.startsWith('f_'));
        setPatientAudits(hasRealAudits ? fallbackList.filter(a => !a.id.startsWith('f_')) : fallbackList);
        loadedPatient = true;
        checkLoading();
      }
    });

    unsubSurgery = onSnapshot(qSurgery, (s) => {
      const deletedIds = getDeletedAuditIds();
      const firestoreDocs = s.docs
        .map(d => ({ id: d.id, ...d.data(), type: 'T02' }))
        .filter(d => !deletedIds.includes(d.id));
      const mergedMap = new Map<string, any>();
      getMergedSurgeryAudits().forEach(a => mergedMap.set(a.id, a));
      firestoreDocs.forEach(a => mergedMap.set(a.id, a));

      const allAudits = Array.from(mergedMap.values());
      const hasRealAudits = allAudits.some(a => !a.id.startsWith('f_'));
      setSurgeryAudits(hasRealAudits ? allAudits.filter(a => !a.id.startsWith('f_')) : allAudits);
      loadedSurgery = true;
      checkLoading();
    }, (err) => {
      console.error("AuditExplorer surgery loading failed:", err);
      if (err?.message && (err.message.includes('Quota') || err.message.includes('resource-exhausted') || err.message.includes('quota') || err.message.includes('limit'))) {
        handleQuotaFailure();
      } else {
        const fallbackList = getMergedSurgeryAudits();
        const hasRealAudits = fallbackList.some(a => !a.id.startsWith('f_'));
        setSurgeryAudits(hasRealAudits ? fallbackList.filter(a => !a.id.startsWith('f_')) : fallbackList);
        loadedSurgery = true;
        checkLoading();
      }
    });

    // Global quota event listener
    const handleGlobalQuota = () => {
      setHandAudits(getMergedHandAudits());
      setPatientAudits(getMergedPatientAudits());
      setSurgeryAudits(getMergedSurgeryAudits());
      setLoading(false);
      try { unsubHand(); } catch (e) {}
      try { unsubPatient(); } catch (e) {}
      try { unsubSurgery(); } catch (e) {}
    };
    window.addEventListener('firestore-quota-exceeded', handleGlobalQuota);

    // Seguranca contra lentidao ou offline: max 3 segundos
    const timer = setTimeout(() => {
      setLoading(false);
      if (!loadedHand) setHandAudits(getMergedHandAudits());
      if (!loadedPatient) setPatientAudits(getMergedPatientAudits());
      if (!loadedSurgery) setSurgeryAudits(getMergedSurgeryAudits());
    }, 3000);

    return () => { 
      try { unsubHand(); } catch (e) {}
      try { unsubPatient(); } catch (e) {}
      try { unsubSurgery(); } catch (e) {}
      window.removeEventListener('firestore-quota-exceeded', handleGlobalQuota);
      clearTimeout(timer); 
    };
  }, [refreshTrigger]);

  const allAudits = useMemo(() => {
    const deletedIds = getDeletedAuditIds();
    let combined = [...handAudits, ...patientAudits, ...surgeryAudits].filter(a => !deletedIds.includes(a.id));
    
    // 1. Filter by Effective Unit
    const targetUnit = isAdmin ? (globalUnit || '') : (userUnit || '');
    if (targetUnit) {
      combined = combined.filter(a => a.unitId === targetUnit || a.hospitalId === targetUnit || a.unidadeId === targetUnit);
    }
    
    // 2. Filter by local Tracer selection
    if (tracerFilter) {
      combined = combined.filter(a => a.type === tracerFilter);
    }

    // 3. Filter by Month & Day & Quarter
    if (globalMonth !== '') {
      const targetMonth = parseInt(globalMonth);
      combined = combined.filter(a => getTracerDateMonth(a) === targetMonth);
      
      if (globalDay && globalDay !== '') {
        const targetDay = parseInt(globalDay);
        combined = combined.filter(a => getTracerDateDay(a) === targetDay);
      }
    } else if (globalQuarter && globalQuarter !== '') {
      const getMonthsForQuarter = (q: string): number[] => {
        if (q === '1') return [0, 1, 2];
        if (q === '2') return [3, 4, 5];
        if (q === '3') return [6, 7, 8];
        if (q === '4') return [9, 10, 11];
        return [];
      };
      const validMonths = getMonthsForQuarter(globalQuarter);
      combined = combined.filter(a => {
        const m = getTracerDateMonth(a);
        return m !== null && validMonths.includes(m);
      });
    }

    // 4. Global Type Filter
    if (globalType === 'Hospitalar' || sidebarFilter === 'Hospitalar') {
      const hospitals = HEALTH_UNITS.filter(u => u.type === 'Hospital').map(u => u.id);
      combined = combined.filter(a => hospitals.includes(a.unitId || a.hospitalId || a.unidadeId));
    } else if (globalType === 'Ambulatorial' || sidebarFilter === 'Ambulatorial') {
      const nonHospitals = HEALTH_UNITS.filter(u => u.type !== 'Hospital').map(u => u.id);
      combined = combined.filter(a => nonHospitals.includes(a.unitId || a.hospitalId || a.unidadeId));
    } else if (globalType === 'Regulação' || sidebarFilter === 'Regulação') {
      combined = combined.filter(a => {
        const u = HEALTH_UNITS.find(unit => unit.id === (a.unitId || a.hospitalId || a.unidadeId));
        return u?.name.toLowerCase().includes('regulação');
      });
    }

    // 5. Sidebar Quality Category filters (like NSP, Eventos, Protocolos, Contratos)
    if (sidebarFilter === 'NSP') {
      // NSP safety forms: T01, T02, T03
      combined = combined.filter(a => a.type === 'T01' || a.type === 'T02' || a.type === 'T03');
    } else if (sidebarFilter === 'Eventos') {
      // Adverse Events: search responses containing critical negative indicators
      combined = combined.filter(a => {
        const data = a.rawData || (a.sourceRowHash ? JSON.parse(a.sourceRowHash) : {});
        return Object.values(data).some(v => {
          const valStr = String(v).toUpperCase().trim();
          return valStr === 'NÃO' || valStr === 'INCONFORME' || valStr === 'FALSO' || valStr.includes('NÃO CONFORME');
        });
      });
    } else if (sidebarFilter === 'Protocolos') {
      // Formal Ministry protocols
      combined = combined.filter(a => a.type === 'T01' || a.type === 'T02');
    } else if (sidebarFilter === 'Contratos') {
      combined = combined.filter(a => a.externalSource || a.auditorId === 'SYSTEM_SYNC');
    }

    // 6. Search input filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      combined = combined.filter(a => {
        const uId = a.unitId || a.hospitalId || a.unidadeId;
        const unitName = HEALTH_UNITS.find(u => u.id === uId)?.name.toLowerCase() || '';
        const auditor = a.auditorId?.toLowerCase() || '';
        const category = a.professionalCategory?.toLowerCase() || '';
        return unitName.includes(lower) || 
               auditor.includes(lower) || 
               category.includes(lower) || 
               (a.tracerName?.toLowerCase().includes(lower));
      });
    }

    return combined.sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA;
    });
  }, [handAudits, patientAudits, surgeryAudits, globalUnit, tracerFilter, globalMonth, globalQuarter, globalDay, globalType, sidebarFilter, searchTerm, isAdmin, userUnit, refreshTrigger]);

  if (loading) return <div className="h-64 flex items-center justify-center text-neutral-400">Carregando base de auditorias...</div>;

  return (
    <div className="space-y-6 flex flex-col h-full">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Explorador de Auditorias</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Visualização detalhada de todas as respostas sincronizadas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white border border-slate-200 rounded-lg p-1 flex gap-1 mr-2">
            <button 
              onClick={() => setViewMode('compact')}
              className={`p-1.5 rounded-md transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight ${viewMode === 'compact' ? 'bg-[#0a0b9e] text-white' : 'text-slate-400 hover:text-slate-600'}`}
              title="Visão Executiva"
            >
              <LayoutList className="w-3.5 h-3.5" />
              Executiva
            </button>
            <button 
              onClick={() => setViewMode('integral')}
              className={`p-1.5 rounded-md transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight ${viewMode === 'integral' ? 'bg-[#0a0b9e] text-white' : 'text-slate-400 hover:text-slate-600'}`}
              title="Visualização Integral (Planilha)"
            >
              <TableIcon className="w-3.5 h-3.5" />
              Integral
            </button>
          </div>
          <button className="theme-badge bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-2 py-2 px-3">
             <Download className="w-3.5 h-3.5" />
             Exportar CSV
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="theme-card py-3 px-4 flex flex-wrap items-center gap-4 border-none shadow-sm ring-1 ring-slate-200">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Pesquisar por unidade, tracer, auditor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold outline-none focus:ring-2 focus:ring-[#0a0b9e] transition-all"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 select-none">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          
          {/* Synchronized Month Filter */}
          <div className="flex flex-col">
            <span className="text-[7px] font-black uppercase text-slate-400 mb-0.5 tracking-wider">Mês</span>
            <select 
              value={globalMonth}
              onChange={(e) => {
                onSetMonth(e.target.value);
                if (e.target.value !== '' && onSetQuarter) {
                  onSetQuarter('');
                }
              }}
              className="p-2 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-black uppercase outline-none cursor-pointer"
            >
              <option value="">Todos os Meses</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={idx} value={String(idx)}>{m}</option>
              ))}
            </select>
          </div>

          {/* Synchronized Trimestre Filter */}
          <div className="flex flex-col">
            <span className="text-[7px] font-black uppercase text-slate-400 mb-0.5 tracking-wider">Trimestre</span>
            <select 
              value={globalQuarter}
              onChange={(e) => {
                if (onSetQuarter) onSetQuarter(e.target.value);
                if (e.target.value !== '') {
                  onSetMonth('');
                  if (onSetDay) onSetDay('');
                }
              }}
              className="p-2 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-black uppercase outline-none cursor-pointer"
            >
              <option value="">Todos os Trimestres</option>
              <option value="1">1º Trimestre</option>
              <option value="2">2º Trimestre</option>
              <option value="3">3º Trimestre</option>
              <option value="4">4º Trimestre</option>
            </select>
          </div>

          {/* Synchronized Day Filter */}
          <div className="flex flex-col">
            <span className="text-[7px] font-black uppercase text-slate-400 mb-0.5 tracking-wider">Dia</span>
            <select 
              value={globalDay}
              onChange={(e) => onSetDay ? onSetDay(e.target.value) : null}
              className="p-2 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-black uppercase outline-none cursor-pointer min-w-[100px]"
            >
              <option value="">Todos os Dias</option>
              {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(day => (
                <option key={day} value={day}>Dia {day}</option>
              ))}
            </select>
          </div>

          {/* Synchronized Unit Filter */}
          <div className="flex flex-col">
            <span className="text-[7px] font-black uppercase text-slate-400 mb-0.5 tracking-wider">
              {isAdmin ? 'Unidade de Saúde' : 'Sua Unidade (Vinculada)'}
            </span>
            <select 
              value={isAdmin ? globalUnit : (userUnit || '')}
              onChange={(e) => isAdmin && onSetUnit(e.target.value)}
              disabled={!isAdmin && !!userUnit}
              className={`p-2 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-black uppercase outline-none max-w-[220px] md:max-w-xs ${!isAdmin ? 'cursor-not-allowed opacity-90 bg-slate-100 text-blue-900 font-black' : 'cursor-pointer'}`}
            >
              {isAdmin && <option value="">Todas as Unidades</option>}
              {HEALTH_UNITS.filter(u => isAdmin || !userUnit || u.id === userUnit).map(u => (
                <option key={u.id} value={u.id}>
                  {u.name.replace('Hospital de Pediatria ', '').replace('Policlínica e Maternidade ', '')}
                </option>
              ))}
            </select>
          </div>

          {/* Local Tracer Type Selector */}
          <div className="flex flex-col">
            <span className="text-[7px] font-black uppercase text-slate-400 mb-0.5 tracking-wider">Tipo do Tracer</span>
            <select 
              value={tracerFilter}
              onChange={(e) => {
                setTracerFilter(e.target.value);
                if (onSetTracer) onSetTracer(e.target.value);
              }}
              className="p-2 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-black uppercase outline-none cursor-pointer"
            >
              <option value="">Todos os Tracers</option>
              <option value="T01">Tracer 01 - Beira Leito</option>
              <option value="T02">Tracer 02 - Proc. Cirúrgicos</option>
              <option value="T03">Tracer 03 - Proc. Medicação</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col min-h-[400px]">
        {viewMode === 'compact' ? (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data/Hora</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tracer</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade de Saúde</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Auditor</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allAudits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Database className="w-8 h-8 text-slate-200" />
                        <div className="space-y-1">
                          <p className="text-slate-500 text-xs font-bold uppercase">Nenhuma auditoria encontrada</p>
                          <p className="text-slate-400 text-[10px]">Certifique-se de que realizou a sincronização na aba Administração.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  allAudits.map((audit) => (
                    <AuditRow 
                      key={audit.id} 
                      audit={audit} 
                      setViewMode={setViewMode} 
                      onEdit={setEditingAudit}
                      onDelete={setDeletingAudit}
                      onView={setViewingAudit}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <IntegralTable audits={allAudits} onView={setViewingAudit} />
        )}
      </div>

      <AnimatePresence>
        {viewingAudit && (
          <ViewAuditModal 
            audit={viewingAudit} 
            onClose={() => setViewingAudit(null)} 
          />
        )}

        {editingAudit && (
          <EditAuditModal 
            audit={editingAudit} 
            onClose={() => setEditingAudit(null)} 
            onSave={handleSaveEdit} 
          />
        )}

        {deletingAudit && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 cursor-default"
            onClick={() => setDeletingAudit(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 text-red-600">
                  <div className="p-2 bg-red-50 rounded-xl">
                    <Trash2 className="w-6 h-6 shrink-0" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-900">
                      Confirmar Exclusão
                    </h3>
                    <p className="text-[9px] font-black text-red-600 mt-0.5 uppercase tracking-wider">
                      Ação Irreversível
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-slate-600 text-xs leading-relaxed">
                  <p>
                    Deseja realmente excluir este registro de auditoria? Ele será removido permanentemente de todas as visões do sistema.
                  </p>
                  <div className="p-3 bg-slate-50 rounded-lg font-mono text-[10px] text-slate-500 border border-slate-200 flex flex-col gap-1">
                    <div><strong>ID:</strong> {deletingAudit.id}</div>
                    <div><strong>Tracer:</strong> {deletingAudit.tracerName || `Tracer ${deletingAudit.tracerNumber || ''}`}</div>
                    <div><strong>Unidade:</strong> {HEALTH_UNITS.find(u => u.id === deletingAudit.unitId)?.name || 'Desconhecida'}</div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 justify-end">
                  <button
                    onClick={() => setDeletingAudit(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleDeleteAudit(deletingAudit)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-sm shadow-red-200"
                  >
                    Confirmar Exclusão
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 z-50 border text-xs font-semibold ${
              toastMessage.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button 
              onClick={() => setToastMessage(null)} 
              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const IntegralTable: React.FC<{ audits: any[]; onView: (audit: any) => void }> = ({ audits, onView }) => {
  const dynamicHeaders = useMemo(() => {
    const headers = new Set<string>();
    audits.forEach(a => {
      const data = a.rawData || (a.sourceRowHash ? JSON.parse(a.sourceRowHash) : {});
      Object.keys(data).forEach(k => {
        // Normalize header by removing trailing colons and extra spaces
        const normalized = k.trim().replace(/:$/, '');
        headers.add(normalized);
      });
    });
    
    // Sort dynamic headers based on the canonical order
    const sortedHeaders = Array.from(headers).sort((a, b) => {
      const indexA = getHeaderSortIndex(a);
      const indexB = getHeaderSortIndex(b);
      if (indexA === indexB) return a.localeCompare(b);
      return indexA - indexB;
    });
    
    return sortedHeaders;
  }, [audits]);

  if (audits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
        <Database className="w-8 h-8 opacity-20" />
        <p className="text-xs font-black uppercase tracking-widest">Nenhum dado para exibir na planilha</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] w-full">
      <table className="min-w-full text-left border-collapse table-fixed">
        <thead className="bg-[#4a235a] sticky top-0 z-20">
          <tr>
            <th className="w-32 px-4 py-3 text-[9px] font-black text-white uppercase border-r border-[#ffffff1a] sticky left-0 z-30 bg-[#4a235a]">
              ID Sistema
            </th>
            <th className="w-16 px-4 py-3 text-[9px] font-black text-white uppercase border-r border-[#ffffff1a] text-center bg-[#4a235a]">
              Ver
            </th>
            {dynamicHeaders.map(header => (
              <th key={header} className="min-w-[200px] px-4 py-3 text-[9px] font-black text-white uppercase border-r border-[#ffffff1a] leading-tight">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {audits.map((audit, i) => {
            const data = audit.rawData || (audit.sourceRowHash ? JSON.parse(audit.sourceRowHash) : {});
            return (
              <tr key={audit.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors`}>
                <td className="px-4 py-2 text-[9px] font-mono text-slate-400 border-r border-slate-100 bg-inherit sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                  {audit.id.split('_').pop()}
                </td>
                <td className="px-4 py-2 text-center border-r border-slate-100">
                  <button
                    onClick={() => onView(audit)}
                    className="p-1 hover:bg-slate-200 rounded text-indigo-600 transition-colors cursor-pointer inline-flex items-center justify-center"
                    title="Visualizar Resposta do Formulário"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
                {dynamicHeaders.map(header => (
                  <td key={header} className="px-4 py-2 text-[10px] font-medium text-slate-600 border-r border-slate-100 whitespace-nowrap overflow-hidden text-ellipsis">
                    {getRowValue(data, header)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const AuditRow: React.FC<{ 
  audit: any; 
  setViewMode: (mode: 'compact' | 'integral') => void;
  onEdit: (audit: any) => void;
  onDelete: (audit: any) => void;
  onView: (audit: any) => void;
}> = ({ audit, setViewMode, onEdit, onDelete, onView }) => {
  const [expanded, setExpanded] = useState(false);
  const unit = HEALTH_UNITS.find(u => u.id === audit.unitId);
  
  const tracerColor = audit.type === 'T01' ? 'text-red-600 bg-red-50 ring-red-100' : 
                     audit.type === 'T02' ? 'text-amber-600 bg-amber-50 ring-amber-100' : 
                     'text-indigo-600 bg-indigo-50 ring-indigo-100';

  const getAuditDate = () => {
    return getAuditDateObj(audit);
  };
  const auditDate = getAuditDate();

  return (
    <>
      <tr className={`group hover:bg-slate-50 transition-colors cursor-pointer ${expanded ? 'bg-slate-50' : ''}`} onClick={() => setExpanded(!expanded)}>
        <td className="px-4 py-4">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-slate-900">{auditDate.toLocaleDateString()}</span>
            <span className="text-[10px] font-mono text-slate-400">{auditDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </td>
        <td className="px-4 py-4">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase ring-1 ring-inset ${tracerColor}`}>
            {audit.type} • {audit.tracerName?.split(' - ')[0] || (audit.type === 'T01' ? 'Beira Leito' : audit.type === 'T02' ? 'Cirúrgico' : 'Medicação')}
          </span>
        </td>
        <td className="px-4 py-4">
           <div className="flex items-center gap-2">
             <Building2 className="w-3.5 h-3.5 text-slate-300" />
             <span className="text-xs font-bold text-slate-700">{unit?.name || 'Unidade não mapeada'}</span>
           </div>
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
             <UserIcon className="w-3.5 h-3.5 text-slate-300" />
             <span className="text-xs font-medium text-slate-500">{audit.auditorId === 'SYSTEM_SYNC' ? 'Sistema (Planilha)' : 'Manual'}</span>
           </div>
        </td>
        <td className="px-4 py-4 text-right flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
           <button
             onClick={() => onView(audit)}
             className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-colors inline-flex items-center justify-center"
             title="Visualizar Detalhes"
           >
             <Eye className="w-4 h-4 text-indigo-600" />
           </button>
           <button
             onClick={() => setExpanded(!expanded)}
             className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors inline-flex items-center justify-center"
           >
             <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${expanded ? 'rotate-90' : ''}`} />
           </button>
        </td>
      </tr>
      <AnimatePresence>
        {expanded && (
          <motion.tr 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border-b border-slate-100"
          >
            <td colSpan={5} className="px-8 py-6">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="space-y-4">
                   <h4 className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-2">
                     <Tag className="w-3.5 h-3.5" />
                     Dados do Registro
                   </h4>
                   <div className="space-y-2">
                     <p className="text-xs">ID Documento: <span className="font-mono text-[10px] text-slate-500">{audit.id}</span></p>
                     <p className="text-xs">Fonte: <span className="font-bold text-slate-700">{audit.externalSource ? 'Planilha Integrativa' : 'Formulário App'}</span></p>
                     {audit.professionalCategory && <p className="text-xs">Profissional: <span className="font-bold text-slate-700">{audit.professionalCategory}</span></p>}
                   </div>

                   <div className="pt-4 border-t border-slate-200 flex flex-col gap-2">
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         onView(audit);
                       }}
                       className="w-full px-3 py-2 bg-[#0a0b9e] hover:bg-blue-800 text-white text-[10px] font-black uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm animate-none mb-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Visualizar Detalhes
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(audit);
                        }}
                        className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                     >
                       <Pencil className="w-3 h-3" />
                       Editar Registro
                     </button>
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         onDelete(audit);
                       }}
                       className="w-full px-3 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 text-[10px] font-black uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                     >
                       <Trash2 className="w-3.5 h-3.5 text-red-600" />
                       Excluir Registro
                     </button>
                   </div>
                 </div>
                 
                  <div className="col-span-2 space-y-4">
                    <h4 className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-2">
                      <LayoutList className="w-3.5 h-3.5" />
                      Espelho do Formulário (Respostas)
                    </h4>
                    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200">
                      {Object.entries(audit.rawData || (audit.sourceRowHash ? JSON.parse(audit.sourceRowHash) : {}))
                        .sort((a, b) => {
                          const indexA = getHeaderSortIndex(a[0]);
                          const indexB = getHeaderSortIndex(b[0]);
                          if (indexA === indexB) return a[0].localeCompare(b[0]);
                          return indexA - indexB;
                        })
                        .map(([key, value]) => (
                        <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 p-3 hover:bg-white transition-colors">
                          <span className="text-[10px] sm:w-1/3 font-black text-slate-500 uppercase tracking-tight leading-tight shrink-0">
                            {key.trim().replace(/:$/, '')}
                          </span>
                          <span className="text-xs font-bold text-slate-900 break-words">
                            {String(value || '-')}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[8px] font-bold uppercase text-slate-400">Dados brutos extraídos da planilha de integração</p>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewMode('integral');
                        }}
                        className="text-[9px] font-black uppercase text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Ver visão de planilha <ChevronRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
               </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

function CheckItem({ label, value, extra }: { label: string, value: boolean, extra?: string }) {
  return (
    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
      <div className="flex flex-col">
        <span className="text-[11px] font-bold text-slate-600">{label}</span>
        {extra && <span className="text-[9px] text-slate-400 font-medium">{extra}</span>}
      </div>
      {value ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      ) : (
        <XCircle className="w-4 h-4 text-red-500" />
      )}
    </div>
  );
}

interface EditModalProps {
  audit: any;
  onClose: () => void;
  onSave: (id: string, updatedPayload: any) => void;
}

const EditAuditModal: React.FC<EditModalProps> = ({ audit, onClose, onSave }) => {
  const [unitId, setUnitId] = useState(audit.unitId || '');
  const [auditorId, setAuditorId] = useState(audit.auditorId || '');
  const [rawData, setRawData] = useState<Record<string, any>>(() => {
    return { ...(audit.rawData || (audit.sourceRowHash ? JSON.parse(audit.sourceRowHash) : {})) };
  });

  const handleFieldChange = (key: string, value: any) => {
    setRawData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleUnitChange = (newUnitId: string) => {
    setUnitId(newUnitId);
    const unitName = HEALTH_UNITS.find(u => u.id === newUnitId)?.name || '';
    
    // Auto sync corresponding hospital/unit name key in rawData
    const updatedRaw = { ...rawData };
    const hospitalKeys = [
      '02- Nome do Hospital/Maternidade:',
      '02- Nome do Hospital/Maternidade',
      'Nome do Hospital/Maternidade',
      'HOSPITAL / MATERNIDADE'
    ];
    let found = false;
    hospitalKeys.forEach(k => {
      if (updatedRaw[k] !== undefined) {
        updatedRaw[k] = unitName;
        found = true;
      }
    });
    if (!found) {
      // Find case-insensitive or close match
      const keyEntry = Object.keys(updatedRaw).find(k => k.toLowerCase().includes('hospital') || k.toLowerCase().includes('maternidade') || k.toLowerCase().includes('unidade'));
      if (keyEntry) {
        updatedRaw[keyEntry] = unitName;
      }
    }
    setRawData(updatedRaw);
  };

  const handleSave = () => {
    // 1. Calculate compliance flags automatically from rawData
    const computedScores = computeUpdatedScores(rawData);
    
    // 2. Prepare payload
    const payload = {
      ...audit,
      unitId,
      auditorId,
      rawData,
      ...computedScores
    };

    onSave(audit.id, payload);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <Pencil className="w-4 h-4 text-[#0a0b9e]" />
              Editar Auditoria
            </h3>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              {audit.type} • {audit.id}
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Main Metadata Grid */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                Unidade de Saúde
              </label>
              <select
                value={unitId}
                onChange={(e) => handleUnitChange(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs font-bold uppercase cursor-pointer focus:ring-2 focus:ring-[#0a0b9e] outline-none"
              >
                {HEALTH_UNITS.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                Auditor
              </label>
              <input
                type="text"
                value={auditorId === 'SYSTEM_SYNC' ? 'Planilha Integrada' : auditorId}
                disabled={auditorId === 'SYSTEM_SYNC'}
                onChange={(e) => setAuditorId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs font-bold focus:ring-2 focus:ring-[#0a0b9e] outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          </div>

          {/* Dynamic Questionnaire Fields */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4" />
              Perguntas e Respostas do Espelho
            </h4>

            <div className="space-y-3.5">
              {Object.entries(rawData)
                .filter(([key]) => {
                  // Hide fields already mapped in global metadata to keep form clean
                  const k = key.toLowerCase();
                  return !k.includes('hospital') && !k.includes('maternidade') && !k.includes('unidade') && !k.includes('carimbo');
                })
                .sort((a, b) => {
                  const idxA = getHeaderSortIndex(a[0]);
                  const idxB = getHeaderSortIndex(b[0]);
                  return idxA - idxB;
                })
                .map(([key, val]) => {
                  const cleanKey = key.trim().replace(/:$/, '');
                  const currentVal = String(val || '').trim();
                  
                  // Helper to match yes/no buttons
                  const isChoice = ['SIM', 'NÃO', 'NÃO SE APLICA', 'CONFORME', 'NÃO CONFORME', 'ADEQUADO', 'INADEQUADO'].includes(currentVal.toUpperCase());
                  
                  // Options list based on the val
                  let options = ['Sim', 'Não', 'Não se aplica'];
                  if (currentVal.toUpperCase() === 'CONFORME' || currentVal.toUpperCase() === 'NÃO CONFORME') {
                    options = ['Conforme', 'Não Conforme'];
                  } else if (currentVal.toUpperCase() === 'ADEQUADO' || currentVal.toUpperCase() === 'INADEQUADO') {
                    options = ['Adequado', 'Inadequado'];
                  }

                  return (
                    <div key={key} className="p-3 bg-white border border-slate-100 hover:border-slate-300 rounded-xl space-y-2 transition-all">
                      <label className="block text-[10px] font-black uppercase text-slate-500 leading-tight">
                        {cleanKey}
                      </label>
                      
                      {isChoice ? (
                        <div className="flex flex-wrap gap-1.5">
                          {options.map(opt => {
                            const isSelected = currentVal.toUpperCase() === opt.toUpperCase();
                            const activeStyle = opt.toUpperCase() === 'SIM' || opt.toUpperCase() === 'CONFORME' || opt.toUpperCase() === 'ADEQUADO'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : opt.toUpperCase() === 'NÃO' || opt.toUpperCase() === 'NÃO CONFORME' || opt.toUpperCase() === 'INADEQUADO'
                                ? 'bg-red-650 text-white border-red-650 shadow-sm'
                                : 'bg-slate-700 text-white border-slate-700 shadow-sm';
                                
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleFieldChange(key, opt)}
                                className={`px-3 py-1 rounded text-[10px] font-black uppercase border transition-all cursor-pointer ${
                                  isSelected 
                                    ? activeStyle 
                                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <textarea
                          rows={2}
                          value={currentVal}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          className="w-full text-xs font-medium text-slate-700 p-2.5 bg-slate-50 border border-slate-200 focus:border-[#0a0b9e] outline-none rounded-md transition-all resize-none"
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-500 hover:bg-slate-200 rounded-lg text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 bg-[#0a0b9e] hover:bg-blue-800 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};

interface ViewModalProps {
  audit: any;
  onClose: () => void;
}

const ViewAuditModal: React.FC<ViewModalProps> = ({ audit, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const data = audit.rawData || (audit.sourceRowHash ? JSON.parse(audit.sourceRowHash) : {});
  const unit = HEALTH_UNITS.find(u => u.id === audit.unitId);

  const tracerColor = audit.type === 'T01' ? 'text-red-600 bg-red-50 border-red-200' : 
                     audit.type === 'T02' ? 'text-amber-600 bg-amber-50 border-amber-200' : 
                     'text-indigo-600 bg-indigo-50 border-indigo-200';

  const tracerFullTitle = audit.type === 'T01' ? 'Tracer 01 - Identificação do Paciente à Beira Leito' :
                          audit.type === 'T02' ? 'Tracer 02 - Processos de Práticas Cirúrgicas Seguras' :
                          'Tracer 03 - Processos de Higiene das Mãos';

  const getAuditDate = () => {
    return getAuditDateObj(audit);
  };
  const auditDate = getAuditDate();

  // Helper to get formatted status with badge for Sim/Não/Conforme/Adequado
  const renderValueBadge = (val: any) => {
    const s = String(val || '').trim().toUpperCase();
    if (s === 'SIM' || s === 'CONFORME' || s === 'ADEQUADO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> SIM
        </span>
      );
    }
    if (s === 'NÃO' || s === 'NÃO CONFORME' || s === 'INADEQUADO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-100">
          <XCircle className="w-3.5 h-3.5 text-rose-500" /> NÃO
        </span>
      );
    }
    if (s === 'NÃO SE APLICA' || s === 'N/A') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
          N/A
        </span>
      );
    }
    return <span className="font-bold text-slate-800 break-all text-xs">{String(val)}</span>;
  };

  // Filter raw data keys by searchTerm
  const filteredEntries = Object.entries(data)
    .filter(([key]) => {
      const cleanKey = key.trim().toLowerCase();
      return cleanKey.includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      const idxA = getHeaderSortIndex(a[0]);
      const idxB = getHeaderSortIndex(b[0]);
      return idxA - idxB;
    });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xs font-black uppercase border ${tracerColor}`}>
              {audit.type}
            </span>
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none">
                {tracerFullTitle}
              </h3>
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mt-1">
                ID Sistema (Doc): <span className="font-mono text-slate-500 select-all">{audit.id}</span>
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer animate-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Document-like Body */}
        <div className="p-6 overflow-y-auto space-y-6 bg-slate-50/50">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block leading-none mb-1">Unidade de Saúde</span>
                <span className="text-xs font-black text-slate-800 uppercase tracking-tight leading-tight block truncate">{unit?.name || 'Não Mapeada'}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block leading-none mb-1">Data / Hora</span>
                <span className="text-xs font-bold text-slate-700 block">{auditDate.toLocaleDateString()} às {auditDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                <UserIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block leading-none mb-1">Auditor Responsável</span>
                <span className="text-xs font-bold text-slate-700 block truncate">{audit.auditorId === 'SYSTEM_SYNC' ? 'Sincronizado via Planilha' : (audit.auditorName || audit.auditorId || 'Desconhecido')}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                <LayoutList className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block leading-none mb-1">Categoria Profissional</span>
                <span className="text-xs font-extrabold text-indigo-650 block uppercase tracking-wider">{audit.professionalCategory || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40 shrink-0">
              <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-[#0a0b9e]" />
                Respostas Completas do Formulário
              </h4>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Pesquisar pergunta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-white border border-slate-200 text-[11px] rounded-md w-full sm:w-48 outline-none focus:border-[#0a0b9e] focus:ring-1 focus:ring-[#0a0b9e] transition-all font-bold uppercase"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto">
              {filteredEntries.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-wide">
                  Nenhum campo corresponde à pesquisa
                </div>
              ) : (
                filteredEntries.map(([key, value]) => {
                  const cleanKey = key.trim().replace(/:$/, '');
                  return (
                    <div key={key} className="p-4 hover:bg-slate-50/50 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 transition-colors">
                      <span className="text-[10px] sm:w-[55%] font-black text-slate-500 uppercase tracking-tight leading-tight shrink-0">
                        {cleanKey}
                      </span>
                      <div className="sm:w-[45%] sm:text-right">
                        {renderValueBadge(value)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer"
          >
            Fechar Visualização
          </button>
        </div>
      </div>
    </div>
  );
};
