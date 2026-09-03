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

/**
 * Formats ISO or YYYY-MM-DD string into standard Brazilian Date (DD/MM/YYYY)
 */
export function formatBrDate(isoOrDateStr?: string): string {
  if (!isoOrDateStr) return '';
  const clean = String(isoOrDateStr).trim();
  if (clean.includes('/')) return clean;
  const parts = clean.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
}

/**
 * Formats time string into standard Brazilian Time (HH:mm:ss)
 */
export function formatBrTime(timeStr?: string): string {
  if (!timeStr) return '';
  const clean = String(timeStr).trim();
  if (clean.length === 5) return `${clean}:00`;
  return clean;
}

/**
 * Formats current Date into standard Google Sheets Timestamp: "DD/MM/YYYY HH:mm:ss" (no comma)
 */
export function formatBrTimestamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
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
  auditorName?: string;
  medicalRecordNumber?: string;
  tracerDate?: string;
  tracerTime?: string;
  sector?: string;
}): Promise<{ success: boolean; message: string; queued?: boolean }> {
  const normTracerId = audit.tracerId === '01' || audit.tracerId === 'T01' ? 'tracer_01' : audit.tracerId === '02' || audit.tracerId === 'T02' ? 'tracer_02' : audit.tracerId === '03' || audit.tracerId === 'T03' ? 'tracer_03' : audit.tracerId;
  const webhookUrl = getWebhookUrl(normTracerId);

  // Normalize rawData with standard headers and timestamps
  const enrichedData: Record<string, any> = { ...audit.rawData };

  // Timestamp format: "DD/MM/YYYY HH:mm:ss" without comma
  if (!enrichedData['Carimbo de data/hora']) {
    enrichedData['Carimbo de data/hora'] = formatBrTimestamp(new Date());
  }

  // Ensure standard fields are available with canonical keys
  if (audit.unitName && !enrichedData['Nome do Hospital/Maternidade']) {
    enrichedData['Nome do Hospital/Maternidade'] = audit.unitName;
    enrichedData['Nome do Hospital/Maternidade:'] = audit.unitName;
  }
  if (audit.patientName && !enrichedData['Nome Completo do Paciente:']) {
    enrichedData['Nome Completo do Paciente:'] = audit.patientName;
    enrichedData['Nome Completo do Paciente'] = audit.patientName;
  }
  if (audit.auditorName && !enrichedData['Nome Completo do Auditor:']) {
    enrichedData['Nome Completo do Auditor:'] = audit.auditorName;
    enrichedData['Nome Completo do Auditor'] = audit.auditorName;
  }
  if (audit.medicalRecordNumber && !enrichedData['Nº do Prontuário do Paciente:']) {
    enrichedData['Nº do Prontuário do Paciente:'] = audit.medicalRecordNumber;
    enrichedData['Nº do Prontuário do Paciente'] = audit.medicalRecordNumber;
  }
  if (audit.tracerDate && !enrichedData['Data do Tracer:']) {
    enrichedData['Data do Tracer:'] = formatBrDate(audit.tracerDate);
  }
  if (audit.tracerTime && !enrichedData['Horário do Início do Tracer:']) {
    enrichedData['Horário do Início do Tracer:'] = formatBrTime(audit.tracerTime);
  }
  if (audit.sector && !enrichedData['Setor Auditado:']) {
    enrichedData['Setor Auditado:'] = audit.sector;
  }

  if (!webhookUrl) {
    // Webhook not configured yet; save in pending queue in case user configures it later
    saveToQueue({
      id: audit.id,
      tracerId: normTracerId,
      type: audit.type,
      timestamp: new Date().toISOString(),
      rawData: enrichedData,
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
    auditorName: audit.auditorName || '',
    medicalRecordNumber: audit.medicalRecordNumber || '',
    tracerDate: formatBrDate(audit.tracerDate) || '',
    tracerTime: formatBrTime(audit.tracerTime) || '',
    sector: audit.sector || '',
    createdAt: new Date().toISOString(),
    data: enrichedData
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
      rawData: enrichedData,
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
 * 4. Clique no botão azul "Implantar" (Deploy) no canto superior direito > "Gerenciar Implantações" ou "Nova Implantação".
 * 5. Se for Nova Implantação, escolha "App da Web" (Web App).
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
    
    // Identificação inteligente da aba de respostas do formulário
    var sheet = ss.getSheetByName("Form_Responses") || 
                ss.getSheetByName("Form Responses 1") || 
                ss.getSheetByName("Respostas ao formulário 1") || 
                ss.getSheetByName("Respostas ao formulario 1") || 
                ss.getSheetByName("Respostas") || 
                ss.getSheetByName("Tracer 01") || 
                ss.getSheetByName("Tracer 02") || 
                ss.getSheetByName("Tracer 03") || 
                ss.getActiveSheet() || 
                ss.getSheets()[0];
                
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'error', 
        message: 'Conteúdo da requisição vazio ou inválido.' 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action || 'add_row';
    
    // Helper para formatar data/hora nativa do Google Sheets: "DD/MM/YYYY HH:mm:ss"
    function formatDateTime(d) {
      var pad = function(n) { return (n < 10 ? '0' : '') + n; };
      return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + 
             pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }
    
    // Helper de limpeza e normalização de cabeçalhos
    function cleanStr(val) {
      if (!val) return '';
      return String(val)
        .replace(/^[0-9]+[\\.\\s\\-]+/g, '')  // remove prefixos numéricos ("02-", "01. ")
        .replace(/[:\\?\\*\\n\\r\\t_]/g, ' ')   // remove pontuação, quebras de linha e underscores
        .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '') // remove acentuação
        .toLowerCase()
        .replace(/\\s+/g, ' ')
        .trim();
    }
    
    // ==========================================
    // AÇÃO 1: EXCLUIR LINHA DA PLANILHA (DELETE)
    // ==========================================
    if (action === 'delete_row' || action === 'delete') {
      var targetId = String(postData.id || '').trim();
      var targetPatient = cleanStr(postData.patientName || '');
      var targetUnit = cleanStr(postData.unitName || '');
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
      var patientColIdx = -1;
      var unitColIdx = -1;
      var timeColIdx = -1;
      
      for (var h = 0; h < headers.length; h++) {
        var nH = cleanStr(headers[h]);
        if (patientColIdx === -1 && (nH.indexOf('paciente') !== -1 || nH.indexOf('prontuario') !== -1)) {
          patientColIdx = h;
        }
        if (unitColIdx === -1 && (nH.indexOf('hospital') !== -1 || nH.indexOf('unidade') !== -1 || nH.indexOf('maternidade') !== -1)) {
          unitColIdx = h;
        }
        if (timeColIdx === -1 && (nH.indexOf('carimbo') !== -1 || nH.indexOf('data e hora') !== -1 || nH.indexOf('timestamp') !== -1)) {
          timeColIdx = h;
        }
      }
      
      for (var r = values.length - 1; r >= 1; r--) {
        var row = values[r];
        var isMatch = false;
        
        // Match por ID se existir em qualquer coluna da linha
        if (targetId) {
          for (var c = 0; c < row.length; c++) {
            if (String(row[c]).trim() === targetId) {
              isMatch = true;
              break;
            }
          }
        }
        
        // Match por Paciente + Unidade
        if (!isMatch && targetPatient && patientColIdx !== -1) {
          var rowPat = cleanStr(row[patientColIdx]);
          if (rowPat && (rowPat.indexOf(targetPatient) !== -1 || targetPatient.indexOf(rowPat) !== -1)) {
            if (targetUnit && unitColIdx !== -1) {
              var rowUn = cleanStr(row[unitColIdx]);
              if (rowUn && (rowUn.indexOf(targetUnit) !== -1 || targetUnit.indexOf(rowUn) !== -1)) {
                isMatch = true;
              }
            } else {
              isMatch = true;
            }
          }
        }
        
        if (isMatch) {
          sheet.deleteRow(r + 1);
          deletedRowsCount++;
        }
      }
      
      SpreadsheetApp.flush();
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
    
    // Garante Carimbo de data/hora no formato limpo padrão
    if (!rowData['Carimbo de data/hora'] && !rowData['Data e Hora']) {
      rowData['Carimbo de data/hora'] = formatDateTime(new Date());
    }
    
    var lastCol = sheet.getLastColumn();
    var headers = [];
    if (lastCol > 0) {
      headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }
    
    // Se a planilha estiver completamente vazia, inicializar cabeçalhos da primeira linha
    if (headers.length === 0 || (headers.length === 1 && String(headers[0]).trim() === '')) {
      headers = Object.keys(rowData);
      sheet.appendRow(headers);
    }
    
    var normHeaders = headers.map(cleanStr);
    var newRow = [];
    
    // Mapeamento coluna a coluna rigoroso para cada cabeçalho existente na planilha
    for (var c = 0; c < headers.length; c++) {
      var header = String(headers[c] || '').trim();
      var normH = normHeaders[c];
      var val = undefined;
      
      // 1. Busca direta exata pelo nome do cabeçalho
      if (rowData[header] !== undefined && rowData[header] !== null && String(rowData[header]).trim() !== '') {
        val = rowData[header];
      }
      
      // 2. Busca exata com/sem dois-pontos final
      if (val === undefined) {
        if (header.slice(-1) === ':') {
          var withoutColon = header.slice(0, -1).trim();
          if (rowData[withoutColon] !== undefined && String(rowData[withoutColon]).trim() !== '') {
            val = rowData[withoutColon];
          }
        } else {
          var withColon = header + ':';
          if (rowData[withColon] !== undefined && String(rowData[withColon]).trim() !== '') {
            val = rowData[withColon];
          }
        }
      }
      
      // 3. Busca normalizada inteligente em todas as chaves enviadas
      if (val === undefined) {
        for (var k in rowData) {
          if (rowData[k] !== undefined && rowData[k] !== null && String(rowData[k]).trim() !== '') {
            if (cleanStr(k) === normH) {
              val = rowData[k];
              break;
            }
          }
        }
      }
      
      // 4. Fallbacks semânticos baseados no tipo da coluna
      if (val === undefined || val === null || val === '') {
        if (normH.indexOf('carimbo') !== -1 || normH.indexOf('data e hora') !== -1 || normH.indexOf('timestamp') !== -1) {
          val = rowData['Carimbo de data/hora'] || formatDateTime(new Date());
        } else if (normH.indexOf('hospital') !== -1 || normH.indexOf('maternidade') !== -1 || normH.indexOf('unidade') !== -1) {
          val = postData.unitName || rowData['Nome do Hospital/Maternidade'] || rowData['Nome do Hospital/Maternidade:'] || '';
        } else if (normH.indexOf('data') !== -1 && normH.indexOf('tracer') !== -1) {
          val = postData.tracerDate || rowData['Data do Tracer:'] || rowData['Data do Tracer'] || rowData['Data'] || '';
        } else if (normH.indexOf('horario') !== -1 || (normH.indexOf('hora') !== -1 && normH.indexOf('inicio') !== -1)) {
          val = postData.tracerTime || rowData['Horário do Início do Tracer:'] || rowData['Horário do Início do Tracer'] || rowData['Horario'] || '';
        } else if (normH.indexOf('setor') !== -1) {
          val = postData.sector || rowData['Setor Auditado:'] || rowData['Setor Auditado'] || rowData['Setor'] || '';
        } else if (normH.indexOf('auditor') !== -1) {
          val = postData.auditorName || rowData['Nome Completo do Auditor:'] || rowData['Nome Completo do Auditor'] || rowData['Auditor'] || '';
        } else if (normH.indexOf('paciente') !== -1 && (normH.indexOf('nome') !== -1 || normH.indexOf('completo') !== -1)) {
          val = postData.patientName || rowData['Nome Completo do Paciente:'] || rowData['Nome Completo do Paciente'] || rowData['Nome do paciente:'] || '';
        } else if (normH.indexOf('prontuario') !== -1) {
          val = postData.medicalRecordNumber || rowData['Nº do Prontuário do Paciente:'] || rowData['Nº do Prontuário do Paciente'] || '';
        } else {
          val = '';
        }
      }
      
      newRow.push(val);
    }
    
    // Grava a linha completa na planilha
    sheet.appendRow(newRow);
    SpreadsheetApp.flush();
    
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
