// Real Local Storage & Fallback Management
// All synthetic mock audits (f_*) have been permanently removed to reflect 100% real data
import preloadedAuditsData from './preloadedAudits.json';

export interface LocalAudit {
  id: string;
  unitId: string;
  auditorId: string;
  tracerNumber: string;
  tracerName: string;
  type: string;
  externalSource?: boolean;
  competencia: string;
  timestamp: { toDate: () => Date; seconds: number; nanoseconds: number };
  [key: string]: any;
}

export const FALLBACK_PATIENT_AUDITS: LocalAudit[] = [];
export const FALLBACK_SURGERY_AUDITS: LocalAudit[] = [];
export const FALLBACK_HAND_AUDITS: LocalAudit[] = [];

// In-memory cache to guarantee fast access and low memory usage
let inMemoryAudits: LocalAudit[] | null = null;

export function getAuditFingerprint(a: any): string {
  if (!a) return '';

  const normalizeStr = (val: any) => {
    if (val === undefined || val === null) return '';
    return String(val).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  };

  const rawType = (a.type || a.tracerNumber || '').toString().trim().toUpperCase().replace(/^TRACER\s*/, 'T');
  const type = rawType.includes('01') || rawType === 'T01' ? 'T01' : rawType.includes('02') || rawType === 'T02' ? 'T02' : rawType.includes('03') || rawType === 'T03' ? 'T03' : rawType;
  
  const unit = normalizeStr(a.unitId || a.hospitalId || a.unidadeId || a.unitName || '');

  // 1. If the record has an ID, use it as primary key
  if (a.id) {
    return `${type}__${unit}__${a.id}`;
  }

  const raw = a.rawData || (a.sourceRowHash ? (typeof a.sourceRowHash === 'object' ? a.sourceRowHash : (typeof a.sourceRowHash === 'string' ? (() => { try { return JSON.parse(a.sourceRowHash); } catch { return {}; } })() : {})) : {});
  
  const carimbo = normalizeStr(
    raw['Carimbo de data/hora'] || raw['CARIMBO DE DATA/HORA'] || raw['Data do Tracer:'] || raw['03- Data do Tracer:'] || raw['Data da Coleta:'] || a.timestampStr || ''
  );

  const patient = normalizeStr(
    a.patientName || raw['Nome Completo do Paciente:'] || raw['Nome Completo do Paciente'] || raw['07- Nome do paciente:'] || raw['07- Nome Completo do Paciente:'] || raw['07- Nome da paciente:'] || raw['Nome Completo da Paciente:'] || raw['Nome do paciente:'] || raw['Paciente:'] || raw['Paciente'] || ''
  );

  const mrn = normalizeStr(
    a.medicalRecordNumber || raw['Nº do Prontuário do Paciente:'] || raw['Nº do Prontuário do Paciente'] || raw['08- Nº do Prontuário do Paciente:'] || raw['Nº do Prontuário da Paciente:'] || raw['08- Nº do Prontuário da Paciente:'] || raw['Prontuário:'] || raw['Prontuário'] || ''
  );

  const auditor = normalizeStr(
    a.auditorName || raw['Nome Completo do Auditor:'] || raw['Nome Completo do Auditor'] || raw['06- Nome Completo do Auditor:'] || raw['05- Nome Completo do Auditor:'] || raw['Auditor'] || ''
  );

  const sector = normalizeStr(
    a.sector || raw['Setor Auditado:'] || raw['Setor Auditado'] || raw['05- Setor Auditado:'] || raw['04- Setor Auditado:'] || raw['Setor:'] || raw['Setor'] || ''
  );

  return `${type}__${unit}__${carimbo}__${patient}__${mrn}__${auditor}__${sector}`;
}

export function deduplicateAudits(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  const deletedIds = getDeletedAuditIds();
  const idMap = new Map<string, any>();
  const fpMap = new Map<string, any>();

  for (const item of list) {
    if (!item || !item.id || item.id.startsWith('f_') || deletedIds.includes(item.id)) {
      continue;
    }

    const fp = getAuditFingerprint(item);
    
    // Check if we already have this record by ID or by Fingerprint
    let existing = idMap.get(item.id) || fpMap.get(fp);

    if (existing) {
      const existingRawKeys = existing.rawData ? Object.keys(existing.rawData).length : 0;
      const itemRawKeys = item.rawData ? Object.keys(item.rawData).length : 0;
      
      // Determine which version to keep: prefer user-created or record with richer data
      let keepItem = false;
      if (!item.externalSource && existing.externalSource) {
        keepItem = true;
      } else if (item.externalSource && !existing.externalSource) {
        keepItem = false;
      } else if (itemRawKeys > existingRawKeys) {
        keepItem = true;
      } else if (item.updatedAt && (!existing.updatedAt || item.updatedAt > existing.updatedAt)) {
        keepItem = true;
      }

      const winner = keepItem ? item : existing;
      idMap.set(item.id, winner);
      if (existing.id && existing.id !== item.id) {
        idMap.delete(existing.id);
      }
      fpMap.set(fp, winner);
    } else {
      idMap.set(item.id, item);
      fpMap.set(fp, item);
    }
  }

  return Array.from(fpMap.values());
}

export function purgeSyntheticData() {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem('custom_local_audits');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((item: any) => item && item.id && !item.id.startsWith('f_'));
        if (cleaned.length !== parsed.length) {
          localStorage.setItem('custom_local_audits', JSON.stringify(cleaned));
          inMemoryAudits = null;
        }
      }
    }
  } catch (e) {
    console.warn('Could not purge synthetic data from localStorage:', e);
  }
}

// Automatically purge synthetic records on module import
purgeSyntheticData();

export function sanitizeAuditForStorage(audit: any, compact = true) {
  const clean: any = { ...audit };

  delete clean.timestamp;
  delete clean.sourceRowHash;

  if (!clean.timestampStr) {
    if (audit.timestamp?.toDate) {
      clean.timestampStr = audit.timestamp.toDate().toISOString();
    } else if (audit.timestamp?.seconds) {
      clean.timestampStr = new Date(audit.timestamp.seconds * 1000).toISOString();
    } else {
      clean.timestampStr = new Date().toISOString();
    }
  }

  // To save memory, when storing synced spreadsheet audits, omit unnecessary raw question copies if core indicators are already parsed
  if (compact && clean.externalSource && clean.rawData) {
    // Keep only compact necessary rawData fields
    const essentialRaw: Record<string, any> = {};
    for (const [k, v] of Object.entries(clean.rawData)) {
      if (v !== undefined && v !== null && v !== '') {
        essentialRaw[k] = v;
      }
    }
    clean.rawData = essentialRaw;
  }

  return clean;
}

export function safeSaveCustomLocalAudits(items: any[]) {
  // Purge any synthetic mock items
  const realOnly = items.filter((item: any) => item && item.id && !item.id.startsWith('f_'));

  // 1. Maintain in-memory state with complete objects
  inMemoryAudits = realOnly.map((item: any) => ({
    ...item,
    timestamp: {
      toDate: () => new Date(item.timestampStr || (item.timestamp?.seconds ? item.timestamp.seconds * 1000 : Date.now())),
      seconds: Math.floor(new Date(item.timestampStr || (item.timestamp?.seconds ? item.timestamp.seconds * 1000 : Date.now())).getTime() / 1000),
      nanoseconds: 0
    }
  }));

  // 2. Safely attempt localStorage persistence with compaction
  try {
    const sanitized = realOnly.map(a => sanitizeAuditForStorage(a, true));
    localStorage.setItem('custom_local_audits', JSON.stringify(sanitized));
  } catch (e: any) {
    console.warn('[LocalStorage] Storage compact fallback active:', e?.message || e);
    try {
      // Keep all user-created records and most recent synced records (up to 300)
      const userCreated = realOnly.filter(a => !a.externalSource).map(a => sanitizeAuditForStorage(a, false));
      const synced = realOnly.filter(a => a.externalSource).slice(-300).map(a => sanitizeAuditForStorage(a, true));
      const finalFallback = [...userCreated, ...synced];
      localStorage.setItem('custom_local_audits', JSON.stringify(finalFallback));
    } catch (err3) {
      console.warn('[LocalStorage] Memory-only mode active:', err3);
    }
  }
}

export function getCustomLocalAudits(): LocalAudit[] {
  if (inMemoryAudits && inMemoryAudits.length > 0) {
    return inMemoryAudits;
  }
  try {
    const raw = localStorage.getItem('custom_local_audits');
    let sourceList: any[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        sourceList = parsed;
      }
    }
    
    // Always combine with preloaded audits and deduplicate by fingerprint
    const combined = [...(Array.isArray(preloadedAuditsData) ? preloadedAuditsData : []), ...sourceList];
    const deduplicated = deduplicateAudits(combined);

    const hydrated = deduplicated
      .map((item: any) => ({
        ...item,
        timestamp: {
          toDate: () => new Date(item.timestampStr || (item.timestamp?.seconds ? item.timestamp.seconds * 1000 : Date.now())),
          seconds: Math.floor(new Date(item.timestampStr || (item.timestamp?.seconds ? item.timestamp.seconds * 1000 : Date.now())).getTime() / 1000),
          nanoseconds: 0
        }
      }));
    inMemoryAudits = hydrated;
    return hydrated;
  } catch (e) {
    console.error('Error parsing custom local audits:', e);
    return inMemoryAudits || [];
  }
}

export function saveCustomLocalAudit(audit: any) {
  if (!audit || !audit.id || audit.id.startsWith('f_')) return;
  try {
    const current = getCustomLocalAudits();
    const index = current.findIndex((item: any) => item.id === audit.id);
    const withStr = {
      ...audit,
      timestampStr: audit.timestampStr || new Date().toISOString()
    };
    if (withStr.timestamp) {
      delete withStr.timestamp;
    }
    if (index >= 0) {
      current[index] = withStr;
    } else {
      current.push(withStr);
    }
    safeSaveCustomLocalAudits(current);
    window.dispatchEvent(new Event('local-data-updated'));
  } catch (e) {
    console.error('Error saving custom local audit:', e);
  }
}

export function saveCustomLocalAuditsBulk(audits: any[]) {
  try {
    const current = getCustomLocalAudits();
    const map = new Map<string, any>();
    current.forEach((item: any) => {
      if (item && item.id && !item.id.startsWith('f_')) {
        map.set(item.id, item);
      }
    });

    audits.forEach((audit) => {
      if (audit && audit.id && !audit.id.startsWith('f_')) {
        const withStr = {
          ...audit,
          timestampStr: audit.timestampStr || new Date().toISOString()
        };
        if (withStr.timestamp) {
          delete withStr.timestamp;
        }
        map.set(audit.id, withStr);
      }
    });

    const updated = Array.from(map.values());
    safeSaveCustomLocalAudits(updated);
    window.dispatchEvent(new Event('local-data-updated'));
  } catch (e) {
    console.error('Error saving bulk custom local audits:', e);
  }
}

export function getDeletedAuditIds(): string[] {
  try {
    const raw = localStorage.getItem('deleted_audit_ids');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function deleteAuditFromLocal(id: string) {
  try {
    const deleted = getDeletedAuditIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      try {
        localStorage.setItem('deleted_audit_ids', JSON.stringify(deleted));
      } catch (err) {
        console.warn('Error saving deleted_audit_ids to storage:', err);
      }
    }
    
    const custom = getCustomLocalAudits();
    const updated = custom.filter((item: any) => item.id !== id);
    safeSaveCustomLocalAudits(updated);
    
    window.dispatchEvent(new Event('local-data-updated'));
  } catch (e) {
    console.error('Error deleting audit locally:', e);
  }
}

export function updateAuditInLocal(id: string, updatedFields: any) {
  try {
    const current = getCustomLocalAudits();
    const index = current.findIndex((item: any) => item.id === id);
    
    if (index >= 0) {
      current[index] = {
        ...current[index],
        ...updatedFields,
        timestampStr: updatedFields.timestampStr || current[index].timestampStr || new Date().toISOString()
      };
      if (current[index].timestamp) {
        delete current[index].timestamp;
      }
      safeSaveCustomLocalAudits(current);
    }
    
    window.dispatchEvent(new Event('local-data-updated'));
  } catch (e) {
    console.error('Error updating audit locally:', e);
  }
}

export function getMergedPatientAudits(): any[] {
  const deletedIds = getDeletedAuditIds();
  return getCustomLocalAudits().filter(a => a.type === 'T01' && !deletedIds.includes(a.id) && !a.id.startsWith('f_'));
}

export function getMergedSurgeryAudits(): any[] {
  const deletedIds = getDeletedAuditIds();
  return getCustomLocalAudits().filter(a => a.type === 'T02' && !deletedIds.includes(a.id) && !a.id.startsWith('f_'));
}

export function getMergedHandAudits(): any[] {
  const deletedIds = getDeletedAuditIds();
  return getCustomLocalAudits().filter(a => a.type === 'T03' && !deletedIds.includes(a.id) && !a.id.startsWith('f_'));
}

export function replaceSyncedLocalAudits(type: string, tracerId: string, newAudits: any[]) {
  try {
    const current = getCustomLocalAudits();
    
    const preserved = current.filter((item: any) => {
      const isExternal = item.externalSource === true || item.id?.startsWith(`sync_${tracerId}_`);
      const isTargetType = item.type === type;
      return !(isExternal && isTargetType);
    });

    const formattedNew = newAudits
      .filter((audit: any) => audit && audit.id && !audit.id.startsWith('f_'))
      .map((audit) => {
        const withStr = {
          ...audit,
          timestampStr: audit.timestampStr || new Date().toISOString()
        };
        if (withStr.timestamp) {
          delete withStr.timestamp;
        }
        return withStr;
      });

    const updated = [...preserved, ...formattedNew];
    safeSaveCustomLocalAudits(updated);
    window.dispatchEvent(new Event('local-data-updated'));
  } catch (e) {
    console.error('Error replacing synced local audits:', e);
  }
}
