import Papa from 'papaparse';
import { db } from './firebase';
import { collection, doc, getDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { HEALTH_UNITS } from './utils';

export const TRACER_CONFIGS = [
  { 
    id: 'tracer_01', 
    name: 'TRACER 01 - Beira Leito', 
    collection: 'audits_patient_id',
    defaultUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSC60psAKcfv3iaypiyAh5jGoNKQJE0VgsZyLnAiWqeJrJEMrTHqel-Y4UWw2XUmWKfn8fxrQDZDXhK/pub?gid=322028166&single=true&output=csv'
  },
  { 
    id: 'tracer_02', 
    name: 'TRACER 02 - Proc. Cirúrgicos', 
    collection: 'audits_safe_surgery',
    defaultUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQPHGA77UVgNeDPZtg_7YXqLKFJE3Fezfr2Oy2Xl02eXwLr0ZbdkqjxPdhJv0AXFI8DJWJQoMTRpgQw/pub?gid=836928129&single=true&output=csv'
  },
  { 
    id: 'tracer_03', 
    name: 'TRACER 03 - Proc. Medicação', 
    collection: 'audits_hand_hygiene',
    defaultUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT8pDmvLv8C5Ikqj4-5O8XBOax4YUUliyh8IlyuHM8UugyGUN8URqSs7V-BH7BPwmFzFsrUZQvPGXBw/pub?gid=842761097&single=true&output=csv'
  }
];

const checkYes = (val: any) => {
  if (val === undefined || val === null) return false;
  if (typeof val === 'boolean') return val;
  const lower = val.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return (
    lower === 'sim' || 
    lower === 's' || 
    lower === 'yes' || 
    lower === 'conforme' || 
    lower === 'true' || 
    lower === 'adequado' || 
    lower === 'c' || 
    lower === '1' || 
    lower === 'ok' ||
    lower === '✔' ||
    lower.startsWith('sim') ||
    lower.startsWith('conforme') ||
    lower.startsWith('adequado')
  );
};

export async function syncSingleTracer(tracerId: string, url: string, competencia = 'mai./2026') {
  const config = TRACER_CONFIGS.find(c => c.id === tracerId);
  if (!config || !url) return { success: false, error: 'Invalid config or URL' };

  try {
    const response = await fetch(url);
    const csvText = await response.text();
    
    // Simple fast string hashing for CSV comparison
    let csvHash = 0;
    for (let i = 0; i < csvText.length; i++) {
      const char = csvText.charCodeAt(i);
      csvHash = ((csvHash << 5) - csvHash) + char;
      csvHash = (csvHash & csvHash);
    }
    const csvHashStr = Math.abs(csvHash).toString(16);
    const lastHash = localStorage.getItem(`last_hash_${tracerId}`);
    
    if (lastHash === csvHashStr) {
      console.log(`[AutoSync] CSV hash unchanged for ${tracerId}. Skipping DB sync.`);
      return { success: true, imported: 0, updated: 0, skipped: 0, errors: 0 };
    }

    return new Promise<{ success: boolean; imported: number; updated: number; skipped: number; errors: number }>((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const data = results.data as any[];
          if (!data || data.length === 0) {
            resolve({ success: false, imported: 0, updated: 0, skipped: 0, errors: 1 });
            return;
          }

          let imported = 0;
          let updated = 0;
          let skipped = 0;
          let errors = 0;
          const localRecordsToSave: any[] = [];

          // Fetch all existing document IDs from the collection once to avoid N getDoc reads
          const existingIds = new Set<string>();
          try {
            if (localStorage.getItem('firestore_quota_exceeded') !== 'true') {
              const querySnapshot = await getDocs(collection(db, config.collection));
              querySnapshot.docs.forEach(d => existingIds.add(d.id));
            }
          } catch (e: any) {
            console.error(`[AutoSync] Failed to fetch existing document IDs for ${config.collection}:`, e);
            if (e?.message && (e.message.includes('Quota') || e.message.includes('resource-exhausted') || e.message.includes('quota') || e.message.includes('limit'))) {
              localStorage.setItem('firestore_quota_exceeded', 'true');
              window.dispatchEvent(new Event('firestore-quota-exceeded'));
            }
          }

          for (const row of data) {
            const keys = Object.keys(row);
            const removeAccents = (str: string) => 
               str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

            const findValue = (keywords: string[]) => {
               const cleanKeywords = keywords.map(kw => removeAccents(kw));
               const key = keys.find(k => {
                 const cleanKey = removeAccents(k);
                 return cleanKeywords.some(kw => cleanKey.includes(kw));
               });
               return key ? row[key] : null;
            };

            const findSpecificValue = (includesAll: string[], excludesAny: string[] = []) => {
               const cleanExcludes = excludesAny.map(e => removeAccents(e));
               const cleanIncludes = includesAll.map(i => removeAccents(i));
               const key = keys.find(k => {
                 const cleanKey = removeAccents(k);
                 const hasAll = cleanIncludes.every(inc => cleanKey.includes(inc));
                 const hasAnyExclude = cleanExcludes.some(exc => cleanKey.includes(exc));
                 return hasAll && !hasAnyExclude;
               });
               return key ? row[key] : null;
            };

            const hospitalName = row['Unidade de Saúde'] || row['UNIDADE'] || row['HOSPITAL'] || row['ESTABELECIMENTO'] || 
                                 findValue(['unidade', 'hospital', 'maternidade']);

            if (!hospitalName || hospitalName.toString().trim() === '') {
              skipped++;
              continue;
            }

            const hNameClean = removeAccents(hospitalName.toString());
            const unit = HEALTH_UNITS.find(u => {
              const uNameClean = removeAccents(u.name);
              const hasAliasMatch = u.aliases?.some(alias => {
                const aliasClean = removeAccents(alias);
                return hNameClean.includes(aliasClean) || aliasClean.includes(hNameClean);
              });
              return uNameClean.includes(hNameClean) || hNameClean.includes(uNameClean) || hasAliasMatch;
            });

            if (!unit) {
              skipped++;
              continue;
            }

            const keyMap: Record<string, string> = {};
            Object.keys(row).forEach(k => {
              const cleanKey = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
              if (cleanKey) {
                keyMap[cleanKey] = row[k]?.toString().normalize('NFC').trim().toLowerCase() || '';
              }
            });
            
            const sortedKeys = Object.keys(keyMap).sort();
            const rowContent = sortedKeys.map(k => keyMap[k]).join('|');
            const rowString = rowContent + tracerId;
            
            let hash = 0;
            for (let i = 0; i < rowString.length; i++) {
              const char = rowString.charCodeAt(i);
              hash = ((hash << 5) - hash) + char;
              hash = (hash & hash);
            }
            const deterministicId = `sync_${tracerId}_${Math.abs(hash).toString(16)}`;

            // Dynamically compute the month and year of the row date to place it in the correct competence bucket
            let derivedCompetencia = competencia;
            let rowDateStr = String(
              row['03- Data do Tracer:'] ||
              row['03- Data do Tracer'] ||
              row['Data do Tracer:'] ||
              row['Data do Tracer'] ||
              row['DATA DO TRACER'] ||
              row['DATA'] ||
              row['Carimbo de data/hora'] ||
              row['CARIMBO DE DATA/HORA']
            ).trim();

            if (rowDateStr && rowDateStr !== '-') {
              const datePart = rowDateStr.split(' ')[0];
              const parts = datePart.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
              if (parts) {
                const monthsAbbr = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
                const mIdx = parseInt(parts[2]) - 1;
                const year = parts[3];
                if (mIdx >= 0 && mIdx < 12) {
                  derivedCompetencia = `${monthsAbbr[mIdx]}/${year}`;
                }
              }
            }
            
            let auditData: any = {
              unitId: unit.id,
              auditorId: 'SYSTEM_SYNC',
              tracerNumber: tracerId.split('_')[1],
              tracerName: config.name.split(' - ')[1],
              externalSource: true,
              competencia: derivedCompetencia,
              rawData: row,
              sourceRowHash: JSON.stringify(row)
            };

            if (tracerId === 'tracer_01') {
              auditData.hasWristband = checkYes(
                findSpecificValue(['pulseira', 'branca']) ||
                findValue(['pulseira', 'identificação'])
              );
              auditData.wristbandLegible = checkYes(
                findSpecificValue(['pulseira', 'legivel']) ||
                findSpecificValue(['legivel'], ['prescrição', 'medicação']) ||
                findValue(['legíveis', 'legibilidade', 'legivel'])
              );
              auditData.correctData = checkYes(
                findSpecificValue(['pulseira', 'preenchida']) ||
                findSpecificValue(['pulseira', 'adequada']) ||
                findSpecificValue(['pulseira', 'confere']) ||
                findSpecificValue(['pulseira', 'dados']) ||
                findSpecificValue(['identificação', 'preenchida']) ||
                findSpecificValue(['identificação', 'adequada'])
              );
            } else if (tracerId === 'tracer_02') {
              auditData.signIIn = checkYes(
                findSpecificValue(['check', 'inducao']) ||
                findSpecificValue(['segura', 'inducao']) ||
                findSpecificValue(['antes', 'inducao']) ||
                findSpecificValue(['sign', 'in']) ||
                findValue(['sign in', 'indução'])
              );
              auditData.timeOut = checkYes(
                findSpecificValue(['check', 'incisao']) ||
                findSpecificValue(['segura', 'incisao']) ||
                findSpecificValue(['time', 'out']) ||
                findSpecificValue(['antes', 'incisao'], ['antibiotico', 'compressas', 'instrumentais']) ||
                findValue(['time out', 'incisão'])
              );
              auditData.signOut = checkYes(
                findSpecificValue(['check', 'sair']) ||
                findSpecificValue(['segura', 'sair']) ||
                findSpecificValue(['sair', 'sala']) ||
                findSpecificValue(['antes', 'sair']) ||
                findSpecificValue(['sign', 'out']) ||
                findValue(['sign out', 'saída'])
              );
            } else {
              auditData.compliant = checkYes(
                findSpecificValue(['higienizacao', 'maos']) ||
                findSpecificValue(['higienizou', 'maos']) ||
                findSpecificValue(['higiene', 'maos']) ||
                findValue(['higiene', 'higienização', 'conformidade', 'lavadora', 'pia', 'higienizou', 'mãos'])
              );
            }

            const localAudit = {
              ...auditData,
              id: deterministicId,
              type: tracerId === 'tracer_01' ? 'T01' : tracerId === 'tracer_02' ? 'T02' : 'T03'
            };
            localRecordsToSave.push(localAudit);

            const isQuotaExceededAtm = localStorage.getItem('firestore_quota_exceeded') === 'true';
            if (!isQuotaExceededAtm) {
              if (existingIds.has(deterministicId)) {
                skipped++;
              } else {
                try {
                  const docRef = doc(db, config.collection, deterministicId);
                  await setDoc(docRef, { ...auditData, timestamp: serverTimestamp() });
                  imported++;
                  existingIds.add(deterministicId);
                } catch (e: any) {
                  console.error(`[AutoSync] Error writing doc ${deterministicId}:`, e);
                  if (e?.message && (e.message.includes('Quota') || e.message.includes('resource-exhausted') || e.message.includes('quota') || e.message.includes('limit') || e.message === 'quota-exceeded')) {
                    localStorage.setItem('firestore_quota_exceeded', 'true');
                    window.dispatchEvent(new Event('firestore-quota-exceeded'));
                    // Count local representation
                    imported++;
                    existingIds.add(deterministicId);
                  } else {
                    errors++;
                  }
                }
              }
            } else {
              // Just count as dynamic import locally
              imported++;
              existingIds.add(deterministicId);
            }
          }

          // Replace synced records in local storage to match the spreadsheet exactly
          try {
            const { replaceSyncedLocalAudits } = await import('./fallbackData');
            const targetType = tracerId === 'tracer_01' ? 'T01' : tracerId === 'tracer_02' ? 'T02' : 'T03';
            replaceSyncedLocalAudits(targetType, tracerId, localRecordsToSave);
          } catch (e) {
            console.error("[AutoSync] Error replacing local audits:", e);
          }

          if (errors === 0) {
            localStorage.setItem(`last_hash_${tracerId}`, csvHashStr);
          }
          const now = new Date().toLocaleString('pt-BR');
          localStorage.setItem(`last_sync_${tracerId}`, now);
          resolve({ success: true, imported, updated, skipped, errors });
        },
        error: (err) => {
          reject(err);
        }
      });
    });
  } catch (err: any) {
    return { success: false, error: err.message, imported: 0, updated: 0, skipped: 0, errors: 1 };
  }
}

export async function runAllSyncs(competencia = 'mai./2026') {
  const promises = TRACER_CONFIGS.map(async (config) => {
    const savedUrl = localStorage.getItem(`url_sync_${config.id}`) || config.defaultUrl;
    try {
      return await syncSingleTracer(config.id, savedUrl, competencia);
    } catch (e) {
      console.error(`Error auto-syncing ${config.id}:`, e);
      return { success: false, error: String(e) };
    }
  });
  return await Promise.all(promises);
}
