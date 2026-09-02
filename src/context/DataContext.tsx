import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import {
  getMergedPatientAudits,
  getMergedSurgeryAudits,
  getMergedHandAudits,
  getDeletedAuditIds,
  deleteAuditFromLocal,
  updateAuditInLocal,
  saveCustomLocalAudit,
  getCustomLocalAudits,
  deduplicateAudits
} from '../lib/fallbackData';

export interface DataContextType {
  patientAudits: any[];
  surgeryAudits: any[];
  handAudits: any[];
  allAudits: any[];
  loading: boolean;
  isQuotaExceeded: boolean;
  refreshAudits: () => void;
  deleteAudit: (id: string, type: string) => Promise<void>;
  updateAudit: (id: string, type: string, data: any) => Promise<void>;
  saveAudit: (audit: any) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [patientAudits, setPatientAudits] = useState<any[]>(() => getMergedPatientAudits());
  const [surgeryAudits, setSurgeryAudits] = useState<any[]>(() => getMergedSurgeryAudits());
  const [handAudits, setHandAudits] = useState<any[]>(() => getMergedHandAudits());
  const [loading, setLoading] = useState(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(
    () => localStorage.getItem('firestore_quota_exceeded') === 'true'
  );
  const [version, setVersion] = useState(0);

  const loadFromLocal = useCallback(() => {
    setPatientAudits(getMergedPatientAudits());
    setSurgeryAudits(getMergedSurgeryAudits());
    setHandAudits(getMergedHandAudits());
    setLoading(false);
  }, []);

  const refreshAudits = useCallback(() => {
    loadFromLocal();
    setVersion(v => v + 1);
  }, [loadFromLocal]);

  // Listen to local storage sync events
  useEffect(() => {
    const handleLocalUpdate = () => {
      loadFromLocal();
    };
    const handleQuota = () => {
      setIsQuotaExceeded(true);
      loadFromLocal();
    };

    window.addEventListener('local-data-updated', handleLocalUpdate);
    window.addEventListener('firestore-quota-exceeded', handleQuota);
    return () => {
      window.removeEventListener('local-data-updated', handleLocalUpdate);
      window.removeEventListener('firestore-quota-exceeded', handleQuota);
    };
  }, [loadFromLocal]);

  // Single centralized Firestore synchronization
  useEffect(() => {
    let unsubHand: () => void = () => {};
    let unsubPatient: () => void = () => {};
    let unsubSurgery: () => void = () => {};

    try {
      const qHand = query(collection(db, 'audits_hand_hygiene'));
      const qPatient = query(collection(db, 'audits_patient_id'));
      const qSurgery = query(collection(db, 'audits_safe_surgery'));

      let loadedCount = 0;
      const checkDone = () => {
        loadedCount++;
        if (loadedCount >= 3) {
          setLoading(false);
        }
      };

      unsubHand = onSnapshot(qHand, (s) => {
        const deletedIds = getDeletedAuditIds();
        const firestoreDocs = s.docs
          .map(d => {
            const data = d.data();
            const timestampStr = data.timestampStr || (data.timestamp && typeof data.timestamp.toDate === 'function' ? data.timestamp.toDate().toISOString() : (data.timestamp && data.timestamp.seconds ? new Date(data.timestamp.seconds * 1000).toISOString() : new Date().toISOString()));
            return {
              id: d.id,
              ...data,
              type: data.type || 'T03',
              tracerNumber: data.tracerNumber || '03',
              timestampStr
            };
          })
          .filter(d => !deletedIds.includes(d.id) && !d.id.startsWith('f_'));
        
        const localList = getMergedHandAudits();
        const combined = deduplicateAudits([...firestoreDocs, ...localList]);
        setHandAudits(combined);
        checkDone();
      }, (err) => {
        console.warn('[DataContext] Falha na leitura T03 do Firestore:', err?.message || err);
        loadFromLocal();
        checkDone();
      });

      unsubPatient = onSnapshot(qPatient, (s) => {
        const deletedIds = getDeletedAuditIds();
        const firestoreDocs = s.docs
          .map(d => {
            const data = d.data();
            const timestampStr = data.timestampStr || (data.timestamp && typeof data.timestamp.toDate === 'function' ? data.timestamp.toDate().toISOString() : (data.timestamp && data.timestamp.seconds ? new Date(data.timestamp.seconds * 1000).toISOString() : new Date().toISOString()));
            return {
              id: d.id,
              ...data,
              type: data.type || 'T01',
              tracerNumber: data.tracerNumber || '01',
              timestampStr
            };
          })
          .filter(d => !deletedIds.includes(d.id) && !d.id.startsWith('f_'));
        
        const localList = getMergedPatientAudits();
        const combined = deduplicateAudits([...firestoreDocs, ...localList]);
        setPatientAudits(combined);
        checkDone();
      }, (err) => {
        console.warn('[DataContext] Falha na leitura T01 do Firestore:', err?.message || err);
        loadFromLocal();
        checkDone();
      });

      unsubSurgery = onSnapshot(qSurgery, (s) => {
        const deletedIds = getDeletedAuditIds();
        const firestoreDocs = s.docs
          .map(d => {
            const data = d.data();
            const timestampStr = data.timestampStr || (data.timestamp && typeof data.timestamp.toDate === 'function' ? data.timestamp.toDate().toISOString() : (data.timestamp && data.timestamp.seconds ? new Date(data.timestamp.seconds * 1000).toISOString() : new Date().toISOString()));
            return {
              id: d.id,
              ...data,
              type: data.type || 'T02',
              tracerNumber: data.tracerNumber || '02',
              timestampStr
            };
          })
          .filter(d => !deletedIds.includes(d.id) && !d.id.startsWith('f_'));
        
        const localList = getMergedSurgeryAudits();
        const combined = deduplicateAudits([...firestoreDocs, ...localList]);
        setSurgeryAudits(combined);
        checkDone();
      }, (err) => {
        console.warn('[DataContext] Falha na leitura T02 do Firestore:', err?.message || err);
        loadFromLocal();
        checkDone();
      });
    } catch (e) {
      console.warn('[DataContext] Exceção na inicialização do Firestore:', e);
      loadFromLocal();
    }

    return () => {
      try { unsubHand(); } catch (e) {}
      try { unsubPatient(); } catch (e) {}
      try { unsubSurgery(); } catch (e) {}
    };
  }, [loadFromLocal, version]);

  const deleteAudit = useCallback(async (id: string, type: string) => {
    // 1. Delete locally immediately
    deleteAuditFromLocal(id);
    loadFromLocal();

    // 2. Try Firestore deletion asynchronously
    try {
      const collName = type === 'T01' ? 'audits_patient_id' : type === 'T02' ? 'audits_safe_surgery' : 'audits_hand_hygiene';
      await deleteDoc(doc(db, collName, id));
    } catch (e: any) {
      console.warn('[DataContext] Erro ao deletar no Firestore:', e?.message || e);
    }
  }, [loadFromLocal]);

  const updateAudit = useCallback(async (id: string, type: string, data: any) => {
    // 1. Update locally immediately
    updateAuditInLocal(id, data);
    loadFromLocal();

    // 2. Try Firestore update asynchronously
    try {
      const collName = type === 'T01' ? 'audits_patient_id' : type === 'T02' ? 'audits_safe_surgery' : 'audits_hand_hygiene';
      await updateDoc(doc(db, collName, id), data);
    } catch (e: any) {
      console.warn('[DataContext] Erro ao atualizar no Firestore:', e?.message || e);
    }
  }, [loadFromLocal]);

  const saveAudit = useCallback(async (audit: any) => {
    // 1. Save locally immediately
    saveCustomLocalAudit(audit);
    loadFromLocal();

    // 2. Try Firestore save asynchronously
    try {
      const { setDoc, doc, serverTimestamp } = await import('firebase/firestore');
      const collName = audit.type === 'T01' ? 'audits_patient_id' : audit.type === 'T02' ? 'audits_safe_surgery' : 'audits_hand_hygiene';
      await setDoc(doc(db, collName, audit.id), {
        ...audit,
        timestamp: serverTimestamp()
      }, { merge: true });
    } catch (e: any) {
      console.warn('[DataContext] Erro ao salvar no Firestore:', e?.message || e);
    }
  }, [loadFromLocal]);

  const allAudits = useMemo(() => {
    return [...patientAudits, ...surgeryAudits, ...handAudits];
  }, [patientAudits, surgeryAudits, handAudits]);

  const value = useMemo(() => ({
    patientAudits,
    surgeryAudits,
    handAudits,
    allAudits,
    loading,
    isQuotaExceeded,
    refreshAudits,
    deleteAudit,
    updateAudit,
    saveAudit
  }), [patientAudits, surgeryAudits, handAudits, allAudits, loading, isQuotaExceeded, refreshAudits, deleteAudit, updateAudit, saveAudit]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export function useAuditsData(): DataContextType {
  const context = useContext(DataContext);
  if (!context) {
    // Fallback if rendered outside provider
    const p = getMergedPatientAudits();
    const s = getMergedSurgeryAudits();
    const h = getMergedHandAudits();
    return {
      patientAudits: p,
      surgeryAudits: s,
      handAudits: h,
      allAudits: [...p, ...s, ...h],
      loading: false,
      isQuotaExceeded: false,
      refreshAudits: () => {},
      deleteAudit: async () => {},
      updateAudit: async () => {},
      saveAudit: async () => {}
    };
  }
  return context;
}

export const useData = useAuditsData;
