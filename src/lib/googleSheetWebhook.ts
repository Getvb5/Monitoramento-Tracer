/**
 * Google Sheets Destination Integration (Google Apps Script Webhooks)
 * Enables real-time row dispatching from Clinical Tracer Forms directly into Google Sheets.
 */

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

export function getWebhookUrl(tracerId: 'tracer_01' | 'tracer_02' | 'tracer_03' | string): string {
  const key = STORAGE_KEYS[tracerId] || `url_webhook_${tracerId}`;
  return localStorage.getItem(key) || '';
}

export function setWebhookUrl(tracerId: 'tracer_01' | 'tracer_02' | 'tracer_03' | string, url: string): void {
  const key = STORAGE_KEYS[tracerId] || `url_webhook_${tracerId}`;
  if (!url || url.trim() === '') {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, url.trim());
  }
}

export function getAllWebhookUrls(): SheetWebhookConfig {
  return {
    tracer_01: localStorage.getItem('url_webhook_tracer_01') || '',
    tracer_02: localStorage.getItem('url_webhook_tracer_02') || '',
    tracer_03: localStorage.getItem('url_webhook_tracer_03') || ''
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
  const webhookUrl = getWebhookUrl(audit.tracerId);

  if (!webhookUrl) {
    // Webhook not configured yet; save in pending queue in case user configures it later
    saveToQueue({
      id: audit.id,
      tracerId: audit.tracerId,
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
    tracerId: audit.tracerId,
    type: audit.type,
    patientName: audit.patientName || '',
    unitName: audit.unitName || '',
    createdAt: new Date().toISOString(),
    data: audit.rawData
  };

  try {
    // We send payload as JSON string using POST
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors', // Essential for Google Apps Script Web Apps to prevent CORS blockage in browser
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
      tracerId: audit.tracerId,
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
  const webhookUrl = getWebhookUrl(audit.tracerId);

  if (!webhookUrl) {
    return {
      success: false,
      message: 'Webhook da planilha não configurado.'
    };
  }

  const payload = {
    action: 'delete_row',
    id: audit.id,
    tracerId: audit.tracerId,
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

/**
 * Generates ready-to-copy Google Apps Script code for destination spreadsheets.
 */
export function getAppsScriptCode(): string {
  return `/**
 * CÓDIGO DO GOOGLE APPS SCRIPT PARA SINCRONIZAÇÃO COMPLETA DOS TRACERS
 * (INSERÇÃO EM TEMPO REAL + EXCLUSÃO AUTOMÁTICA)
 * 
 * INSTRUÇÕES:
 * 1. Abra sua Planilha no Google Sheets (Ex: Respostas do Tracer).
 * 2. No menu superior, clique em: Extensões > Apps Script.
 * 3. Apague qualquer código existente e COLE o código abaixo.
 * 4. Clique no botão azul "Implantar" (Deploy) > "Gerenciar Implantações" ou "Nova Implantação".
 * 5. Tipo: Selecione "App da Web" (Web App).
 * 6. Configuração da Implantação:
 *    - Descrição: "Webhook Tracers Clínicos - Inserir e Excluir"
 *    - Executar como: "Eu" (seu e-mail)
 *    - Quem tem acesso: "Qualquer pessoa" (Anyone) -> ESSENCIAL!
 * 7. Clique em "Implantar" / "Salvar", copie a URL (termina com /exec) e cole no sistema.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action || 'add_row';
    
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
      
      // Identificar índices de colunas relevantes
      var idColIdx = -1;
      var patientColIdx = -1;
      var unitColIdx = -1;
      var timeColIdx = -1;
      
      for (var h = 0; h < headers.length; h++) {
        var hName = String(headers[h]).toLowerCase();
        if (hName.indexOf('id_sistema') !== -1 || hName === 'id' || hName.indexOf('id da coleta') !== -1 || hName.indexOf('código') !== -1) {
          idColIdx = h;
        }
        if (hName.indexOf('paciente') !== -1 || hName.indexOf('prontuário') !== -1 || hName.indexOf('prontuario') !== -1) {
          patientColIdx = h;
        }
        if (hName.indexOf('unidade') !== -1 || hName.indexOf('setor') !== -1) {
          unitColIdx = h;
        }
        if (hName.indexOf('carimbo') !== -1 || hName.indexOf('data e hora') !== -1 || hName.indexOf('timestamp') !== -1) {
          timeColIdx = h;
        }
      }
      
      // Percorrer as linhas de baixo para cima para deleção segura
      for (var r = values.length - 1; r >= 1; r--) {
        var row = values[r];
        var isMatch = false;
        
        // 1. Correspondência exata por ID se a coluna de ID existir
        if (targetId && idColIdx !== -1 && String(row[idColIdx]).trim() === targetId) {
          isMatch = true;
        }
        
        // 2. Se não encontrou, verificar se qualquer célula da linha contém o ID exato
        if (!isMatch && targetId) {
          for (var c = 0; c < row.length; c++) {
            if (String(row[c]).trim() === targetId) {
              isMatch = true;
              break;
            }
          }
        }
        
        // 3. Correspondência por múltiplos identificadores (Paciente + Unidade ou Timestamp)
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
        
        // Se deu match, apagar a linha da planilha
        if (isMatch) {
          sheet.deleteRow(r + 1); // sheet é 1-indexed
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
    
    // Garantir que o ID do sistema também fique registrado para deleção 100% precisa
    if (postData.id && !rowData['ID_SISTEMA']) {
      rowData['ID_SISTEMA'] = postData.id;
    }
    
    // Obter todos os cabeçalhos existentes na linha 1
    var headers = [];
    var lastColumn = sheet.getLastColumn();
    if (lastColumn > 0) {
      headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    }
    
    // Se a planilha estiver vazia, criar cabeçalhos com base nas chaves do envio
    if (headers.length === 0 || (headers.length === 1 && headers[0] === '')) {
      headers = Object.keys(rowData);
      sheet.appendRow(headers);
    } else {
      // Verificar se há novas colunas no formulário e adicioná-las
      var newHeaders = Object.keys(rowData);
      for (var i = 0; i < newHeaders.length; i++) {
        if (headers.indexOf(newHeaders[i]) === -1) {
          headers.push(newHeaders[i]);
          sheet.getRange(1, headers.length).setValue(newHeaders[i]);
        }
      }
    }
    
    // Construir a nova linha na ordem exata das colunas
    var newRow = [];
    for (var j = 0; j < headers.length; j++) {
      var headerName = headers[j];
      var cellValue = rowData[headerName];
      if (cellValue === undefined || cellValue === null) {
        // Campos de carimbo caso a coluna seja de timestamp
        if (headerName.toLowerCase().indexOf('carimbo') !== -1 || headerName.toLowerCase().indexOf('data e hora') !== -1) {
          cellValue = new Date().toLocaleString('pt-BR');
        } else {
          cellValue = '';
        }
      }
      newRow.push(cellValue);
    }
    
    // Adicionar a linha na planilha
    sheet.appendRow(newRow);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      message: 'Linha adicionada com sucesso!' 
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
  return ContentService.createTextOutput("Webhook de Sincronização e Exclusão do Tracer está ativo e funcionando perfeitamente!");
}`;
}
