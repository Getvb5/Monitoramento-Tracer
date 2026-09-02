/**
 * Google Sheets Destination Integration (Google Apps Script Webhooks)
 * Enables real-time row dispatching from Clinical Tracer Forms directly into Google Sheets.
 * Syncs webhook URLs across Firebase Firestore & LocalStorage for multi-device reliability.
 */
import { db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export interface SheetWebhookConfig {
  tracer_01: string;
  tracer_02: string;
  tracer_03: string;
}

const STORAGE_KEYS: Record<string, string> = {
  tracer_01: 'url_webhook_tracer_01',
  tracer_02: 'url_webhook_tracer_02',
  tracer_03: 'url_webhook_tracer_03'
};

const QUEUE_KEY = 'pending_google_sheet_audits';

// In-memory cache for fast, non-blocking lookup
let inMemoryUrls: SheetWebhookConfig = {
  tracer_01: typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.tracer_01) || '' : '',
  tracer_02: typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.tracer_02) || '' : '',
  tracer_03: typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.tracer_03) || '' : ''
};

// Initialize cloud sync with Firestore
let initializedCloudSync = false;
export function initWebhookCloudSync() {
  if (initializedCloudSync || typeof window === 'undefined') return;
  initializedCloudSync = true;

  try {
    const configDocRef = doc(db, 'system_config', 'webhook_urls');
    onSnapshot(configDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<SheetWebhookConfig>;
        if (data) {
          if (data.tracer_01 !== undefined) {
            inMemoryUrls.tracer_01 = data.tracer_01 || '';
            localStorage.setItem(STORAGE_KEYS.tracer_01, data.tracer_01 || '');
          }
          if (data.tracer_02 !== undefined) {
            inMemoryUrls.tracer_02 = data.tracer_02 || '';
            localStorage.setItem(STORAGE_KEYS.tracer_02, data.tracer_02 || '');
          }
          if (data.tracer_03 !== undefined) {
            inMemoryUrls.tracer_03 = data.tracer_03 || '';
            localStorage.setItem(STORAGE_KEYS.tracer_03, data.tracer_03 || '');
          }
          window.dispatchEvent(new Event('webhook-urls-updated'));
        }
      }
    }, (err) => {
      console.warn('[GoogleSheetWebhook] Cloud sync fallback to localStorage:', err?.message || err);
    });
  } catch (e) {
    console.warn('[GoogleSheetWebhook] Initialization notice:', e);
  }
}

// Auto-run cloud sync
initWebhookCloudSync();

export function getWebhookUrl(tracerId: 'tracer_01' | 'tracer_02' | 'tracer_03' | string): string {
  const normId = tracerId === '01' || tracerId === 'T01' ? 'tracer_01' : tracerId === '02' || tracerId === 'T02' ? 'tracer_02' : tracerId === '03' || tracerId === 'T03' ? 'tracer_03' : tracerId;
  const key = STORAGE_KEYS[normId] || `url_webhook_${normId}`;
  
  if (inMemoryUrls[normId as keyof SheetWebhookConfig]) {
    return inMemoryUrls[normId as keyof SheetWebhookConfig];
  }
  
  const fromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem(key) || '' : '';
  if (fromStorage && (normId in inMemoryUrls)) {
    inMemoryUrls[normId as keyof SheetWebhookConfig] = fromStorage;
  }
  return fromStorage;
}

export async function setWebhookUrl(tracerId: 'tracer_01' | 'tracer_02' | 'tracer_03' | string, url: string): Promise<void> {
  const normId = tracerId === '01' || tracerId === 'T01' ? 'tracer_01' : tracerId === '02' || tracerId === 'T02' ? 'tracer_02' : tracerId === '03' || tracerId === 'T03' ? 'tracer_03' : tracerId;
  const key = STORAGE_KEYS[normId] || `url_webhook_${normId}`;
  const cleanUrl = url ? url.trim() : '';

  // 1. Update in-memory & LocalStorage immediately
  if (!cleanUrl) {
    localStorage.removeItem(key);
    if (normId in inMemoryUrls) {
      inMemoryUrls[normId as keyof SheetWebhookConfig] = '';
    }
  } else {
    localStorage.setItem(key, cleanUrl);
    if (normId in inMemoryUrls) {
      inMemoryUrls[normId as keyof SheetWebhookConfig] = cleanUrl;
    }
  }

  window.dispatchEvent(new Event('webhook-urls-updated'));

  // 2. Persist to Firestore for all connected devices
  try {
    const configDocRef = doc(db, 'system_config', 'webhook_urls');
    await setDoc(configDocRef, {
      [normId]: cleanUrl,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('[GoogleSheetWebhook] Failed to save webhook URL to Firestore (saved locally):', err);
  }
}

export function getAllWebhookUrls(): SheetWebhookConfig {
  return {
    tracer_01: getWebhookUrl('tracer_01'),
    tracer_02: getWebhookUrl('tracer_02'),
    tracer_03: getWebhookUrl('tracer_03')
  };
}

export interface PendingAuditItem {
  id: string;
  tracerId: string;
  type: string;
  timestamp: string;
  rawData: Record<string, any>;
  patientName?: string;
  unitName?: string;
}

export function getPendingQueue(): PendingAuditItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveToQueue(item: PendingAuditItem): void {
  try {
    const queue = getPendingQueue();
    // Avoid duplicate IDs
    const filtered = queue.filter(q => q.id !== item.id);
    filtered.push(item);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('[GoogleSheetWebhook] Failed to save to pending queue:', e);
  }
}

export function removeFromQueue(id: string): void {
  try {
    const queue = getPendingQueue();
    const filtered = queue.filter(q => q.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('[GoogleSheetWebhook] Failed to remove from queue:', e);
  }
}

/**
 * Dispatches an audit record to the destination Google Sheet Webhook.
 */
export async function sendAuditToGoogleSheet(audit: {
  id: string;
  tracerId: 'tracer_01' | 'tracer_02' | 'tracer_03' | string;
  type: string;
  rawData: Record<string, any>;
  patientName?: string;
  unitName?: string;
}): Promise<{ success: boolean; message: string; queued?: boolean }> {
  const normTracerId = audit.tracerId === '01' || audit.tracerId === 'T01' ? 'tracer_01' : audit.tracerId === '02' || audit.tracerId === 'T02' ? 'tracer_02' : audit.tracerId === '03' || audit.tracerId === 'T03' ? 'tracer_03' : audit.tracerId;
  const webhookUrl = getWebhookUrl(normTracerId);

  if (!webhookUrl) {
    // Webhook not configured yet; save in pending queue in case user configures it later
    saveToQueue({
      id: audit.id,
      tracerId: normTracerId,
      type: audit.type,
      timestamp: new Date().toISOString(),
      rawData: audit.rawData,
      patientName: audit.patientName,
      unitName: audit.unitName
    });
    return {
      success: false,
      message: 'URL do Webhook da Planilha Destino não configurada. A coleta foi salva na fila pendente.',
      queued: true
    };
  }

  const payload = {
    action: 'add_row',
    id: audit.id,
    tracerId: normTracerId,
    type: audit.type,
    patientName: audit.patientName || '',
    unitName: audit.unitName || '',
    createdAt: new Date().toISOString(),
    data: audit.rawData
  };

  try {
    // Send payload as plain text / JSON string to avoid CORS preflight issues with Google Apps Script
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors', // Essential for Google Apps Script Web Apps
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    // Remove from pending queue if present
    removeFromQueue(audit.id);

    return {
      success: true,
      message: 'Coleta enviada com sucesso para a planilha destino!'
    };
  } catch (err: any) {
    console.warn('[GoogleSheetWebhook] Send failed, saving to retry queue:', err);
    saveToQueue({
      id: audit.id,
      tracerId: normTracerId,
      type: audit.type,
      timestamp: new Date().toISOString(),
      rawData: audit.rawData,
      patientName: audit.patientName,
      unitName: audit.unitName
    });
    return {
      success: false,
      message: `Erro no envio: ${err?.message || 'Falha de rede'}. Registro salvo na fila de reenvio.`,
      queued: true
    };
  }
}

/**
 * Deletes an audit record from the destination Google Sheet via Webhook.
 */
export async function deleteAuditFromGoogleSheet(audit: {
  id: string;
  tracerId: 'tracer_01' | 'tracer_02' | 'tracer_03' | string;
  type?: string;
  patientName?: string;
  unitName?: string;
  timestamp?: string;
  rawData?: Record<string, any>;
}): Promise<{ success: boolean; message: string }> {
  const normTracerId = audit.tracerId === '01' || audit.tracerId === 'T01' ? 'tracer_01' : audit.tracerId === '02' || audit.tracerId === 'T02' ? 'tracer_02' : audit.tracerId === '03' || audit.tracerId === 'T03' ? 'tracer_03' : audit.tracerId;
  const webhookUrl = getWebhookUrl(normTracerId);

  if (!webhookUrl) {
    return {
      success: false,
      message: 'Webhook da planilha não configurado.'
    };
  }

  const payload = {
    action: 'delete_row',
    id: audit.id,
    tracerId: normTracerId,
    type: audit.type || '',
    patientName: audit.patientName || '',
    unitName: audit.unitName || '',
    timestamp: audit.timestamp || '',
    data: audit.rawData || {}
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    return {
      success: true,
      message: 'Comando de exclusão transmitido para a planilha destino.'
    };
  } catch (err: any) {
    console.warn('[GoogleSheetWebhook] Delete request failed:', err);
    return {
      success: false,
      message: `Falha ao excluir na planilha: ${err?.message || 'Erro de rede'}`
    };
  }
}

/**
 * Retries sending all pending queued audits.
 */
export async function flushPendingQueue(): Promise<{ sent: number; total: number; errors: number }> {
  const queue = getPendingQueue();
  if (queue.length === 0) return { sent: 0, total: 0, errors: 0 };

  let sent = 0;
  let errors = 0;

  for (const item of queue) {
    const webhookUrl = getWebhookUrl(item.tracerId);
    if (!webhookUrl) {
      errors++;
      continue;
    }

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          action: 'add_row',
          id: item.id,
          tracerId: item.tracerId,
          type: item.type,
          patientName: item.patientName || '',
          unitName: item.unitName || '',
          createdAt: item.timestamp,
          data: item.rawData
        })
      });
      removeFromQueue(item.id);
      sent++;
    } catch {
      errors++;
    }
  }

  return { sent, total: queue.length, errors };
}

// Auto-flush pending queue when internet connection restores
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushPendingQueue().catch(() => {});
  });
}

/**
 * Generates ready-to-copy Google Apps Script code for destination spreadsheets.
 * Features smart column header normalization and multi-tab safety.
 */
export function getAppsScriptCode(): string {
  return `/**
 * CÓDIGO DO GOOGLE APPS SCRIPT PARA SINCRONIZAÇÃO COMPLETA DOS TRACERS
 * (GRAVAÇÃO AUTOMÁTICA EM TEMPO REAL + EXCLUSÃO INTELIGENTE DE LINHAS)
 * 
 * INSTRUÇÕES SIMPLES (1 Minuto):
 * 1. Abra a sua Planilha no Google Sheets onde deseja receber os dados.
 * 2. No menu superior da planilha, clique em: Extensões > Apps Script.
 * 3. Apague QUALQUER código existente e COLE este código completo.
 * 4. Clique no botão azul "Implantar" (Deploy) no canto superior direito > "Nova Implantação".
 * 5. Na engrenagem ao lado de "Selecionar tipo", escolha: "App da Web" (Web App).
 * 6. Configure exatamente assim:
 *    - Descrição: "Webhook Tracers Hospitalares"
 *    - Executar como: "Eu" (seu e-mail)
 *    - Quem tem acesso: "Qualquer pessoa" (Anyone) -> ESSENCIAL para receber do app!
 * 7. Clique em "Implantar" (ou "Atualizar"), copie a URL gerada (termina com /exec) e cole no sistema.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // Prioriza a aba com respostas ou primeira aba
    var sheet = ss.getSheetByName("Respostas ao formulário 1") || 
                ss.getSheetByName("Respostas") || 
                ss.getSheetByName("Tracer 01") || 
                ss.getSheetByName("Tracer 02") || 
                ss.getSheetByName("Tracer 03") || 
                ss.getSheets()[0];
                
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'error', 
        message: 'Conteúdo da requisição vazio ou inválido.' 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action || 'add_row';
    
    // Helper de normalização para comparação insensível a números/pontuação
    function normalizeHeader(str) {
      if (!str) return '';
      return String(str)
        .replace(/^[0-9]+[\\.\\-\\s]+/g, '') // remove "01.", "02-", etc.
        .replace(/[:\\?\\*]/g, '')           // remove ":", "?", "*"
        .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '') // remove acentos
        .toLowerCase()
        .replace(/\\s+/g, ' ')
        .trim();
    }
    
    // ==========================================
    // AÇÃO 1: EXCLUIR LINHA DA PLANILHA (DELETE)
    // ==========================================
    if (action === 'delete_row' || action === 'delete') {
      var targetId = String(postData.id || '').trim();
      var targetPatient = String(postData.patientName || '').trim().toLowerCase();
      var targetUnit = String(postData.unitName || '').trim().toLowerCase();
      var targetTimestamp = String(postData.timestamp || '').trim();
      
      var dataRange = sheet.getDataRange();
      var values = dataRange.getValues();
      if (values.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ 
          status: 'success', 
          message: 'Planilha sem dados para excluir.' 
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var headers = values[0];
      var deletedRowsCount = 0;
      
      var idColIdx = -1;
      var patientColIdx = -1;
      var unitColIdx = -1;
      var timeColIdx = -1;
      
      for (var h = 0; h < headers.length; h++) {
        var normH = normalizeHeader(headers[h]);
        if (normH.indexOf('id sistema') !== -1 || normH === 'id' || normH.indexOf('codigo') !== -1) {
          idColIdx = h;
        }
        if (normH.indexOf('paciente') !== -1 || normH.indexOf('prontuario') !== -1) {
          patientColIdx = h;
        }
        if (normH.indexOf('hospital') !== -1 || normH.indexOf('unidade') !== -1 || normH.indexOf('maternidade') !== -1) {
          unitColIdx = h;
        }
        if (normH.indexOf('carimbo') !== -1 || normH.indexOf('data e hora') !== -1 || normH.indexOf('timestamp') !== -1) {
          timeColIdx = h;
        }
      }
      
      for (var r = values.length - 1; r >= 1; r--) {
        var row = values[r];
        var isMatch = false;
        
        if (targetId && idColIdx !== -1 && String(row[idColIdx]).trim() === targetId) {
          isMatch = true;
        }
        
        if (!isMatch && targetId) {
          for (var c = 0; c < row.length; c++) {
            if (String(row[c]).trim() === targetId) {
              isMatch = true;
              break;
            }
          }
        }
        
        if (!isMatch && targetPatient) {
          var rowPatient = patientColIdx !== -1 ? String(row[patientColIdx]).trim().toLowerCase() : '';
          var rowUnit = unitColIdx !== -1 ? String(row[unitColIdx]).trim().toLowerCase() : '';
          var rowTime = timeColIdx !== -1 ? String(row[timeColIdx]).trim() : '';
          
          if (rowPatient && (rowPatient.indexOf(targetPatient) !== -1 || targetPatient.indexOf(rowPatient) !== -1)) {
            if (targetUnit && rowUnit && (rowUnit.indexOf(targetUnit) !== -1 || targetUnit.indexOf(rowUnit) !== -1)) {
              isMatch = true;
            } else if (targetTimestamp && rowTime && rowTime.indexOf(targetTimestamp.substring(0, 10)) !== -1) {
              isMatch = true;
            }
          }
        }
        
        if (isMatch) {
          sheet.deleteRow(r + 1);
          deletedRowsCount++;
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'success', 
        message: deletedRowsCount > 0 
          ? 'Excluída(s) ' + deletedRowsCount + ' linha(s) da planilha com sucesso!' 
          : 'Nenhuma linha correspondente encontrada na planilha.' 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ==========================================
    // AÇÃO 2: ADICIONAR NOVA LINHA (ADD_ROW)
    // ==========================================
    var rowData = postData.data || {};
    
    // Adicionar metadados automáticos
    if (!rowData['Carimbo de data/hora'] && !rowData['Data e Hora']) {
      rowData['Carimbo de data/hora'] = new Date().toLocaleString('pt-BR');
    }
    if (postData.id && !rowData['ID_SISTEMA']) {
      rowData['ID_SISTEMA'] = postData.id;
    }
    
    var lastColumn = sheet.getLastColumn();
    var headers = [];
    if (lastColumn > 0) {
      headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    }
    
    // Se a planilha estiver completamente vazia, inicializar cabeçalhos
    if (headers.length === 0 || (headers.length === 1 && String(headers[0]).trim() === '')) {
      headers = Object.keys(rowData);
      sheet.appendRow(headers);
    } else {
      // Mapeamento inteligente: verifica se alguma chave nova precisa ser adicionada como coluna
      var incomingKeys = Object.keys(rowData);
      var normalizedExisting = headers.map(normalizeHeader);
      
      for (var k = 0; k < incomingKeys.length; k++) {
        var key = incomingKeys[k];
        var normKey = normalizeHeader(key);
        var foundIndex = normalizedExisting.indexOf(normKey);
        
        if (foundIndex === -1 && key !== 'ID_SISTEMA') {
          // Coluna nova: adicionar ao final da linha 1
          headers.push(key);
          normalizedExisting.push(normKey);
          sheet.getRange(1, headers.length).setValue(key);
        }
      }
    }
    
    // Construir a nova linha com base nos cabeçalhos existentes
    var newRow = [];
    var normExistingHeaders = headers.map(normalizeHeader);
    
    for (var j = 0; j < headers.length; j++) {
      var headerName = headers[j];
      var normH = normExistingHeaders[j];
      var cellVal = undefined;
      
      // 1. Busca direta exata
      if (rowData[headerName] !== undefined) {
        cellVal = rowData[headerName];
      }
      
      // 2. Busca normalizada inteligente
      if (cellVal === undefined) {
        for (var rawK in rowData) {
          if (normalizeHeader(rawK) === normH) {
            cellVal = rowData[rawK];
            break;
          }
        }
      }
      
      // 3. Fallbacks de campos padrão
      if (cellVal === undefined || cellVal === null) {
        if (normH.indexOf('carimbo') !== -1 || normH.indexOf('data e hora') !== -1) {
          cellVal = new Date().toLocaleString('pt-BR');
        } else if (normH.indexOf('id sistema') !== -1 || normH === 'id') {
          cellVal = postData.id || '';
        } else if (normH.indexOf('hospital') !== -1 || normH.indexOf('maternidade') !== -1) {
          cellVal = postData.unitName || '';
        } else if (normH.indexOf('paciente') !== -1 && normH.indexOf('nome') !== -1) {
          cellVal = postData.patientName || '';
        } else {
          cellVal = '';
        }
      }
      
      newRow.push(cellVal);
    }
    
    // Inserir a nova linha na planilha
    sheet.appendRow(newRow);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      message: 'Linha adicionada com sucesso na planilha destino!' 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Webhook de Sincronização dos Tracers está ativo e pronto para gravação em tempo real!");
}`;
}
