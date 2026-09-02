import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Copy, Check, ExternalLink, ArrowRight, 
  Send, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, X 
} from 'lucide-react';
import { 
  getAllWebhookUrls, setWebhookUrl, getAppsScriptCode, 
  getPendingQueue, flushPendingQueue, sendAuditToGoogleSheet 
} from '../lib/googleSheetWebhook';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function GoogleSheetWebhookModal({ isOpen, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [webhookUrls, setWebhookUrls] = useState({
    tracer_01: '',
    tracer_02: '',
    tracer_03: ''
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingTracer, setTestingTracer] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ msg: string; success: boolean } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setWebhookUrls(getAllWebhookUrls());
      setPendingCount(getPendingQueue().length);
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getAppsScriptCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSaveUrls = () => {
    setWebhookUrl('tracer_01', webhookUrls.tracer_01);
    setWebhookUrl('tracer_02', webhookUrls.tracer_02);
    setWebhookUrl('tracer_03', webhookUrls.tracer_03);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleTest = async (tracerId: 'tracer_01' | 'tracer_02' | 'tracer_03', tracerName: string) => {
    setTestingTracer(tracerId);
    setTestResult(null);
    try {
      const result = await sendAuditToGoogleSheet({
        id: 'test_' + Date.now(),
        tracerId,
        type: tracerId === 'tracer_01' ? 'T01' : tracerId === 'tracer_02' ? 'T02' : 'T03',
        rawData: {
          'Carimbo de data/hora': new Date().toLocaleString('pt-BR'),
          'Unidade de Saúde': 'Hospital Geral (Teste de Conexão)',
          'Auditor': 'Teste do Sistema',
          'Status do Teste': 'Conexão Estabelecida com Sucesso!'
        },
        patientName: 'Paciente Teste',
        unitName: 'Hospital Geral'
      });
      setTestResult({
        success: result.success,
        msg: result.success 
          ? `Sucesso: Linha de teste enviada para ${tracerName}!` 
          : result.message
      });
      setPendingCount(getPendingQueue().length);
    } catch (e: any) {
      setTestResult({
        success: false,
        msg: `Erro no teste: ${e.message || 'Falha de conexão'}`
      });
    } finally {
      setTestingTracer(null);
    }
  };

  const handleFlush = async () => {
    setFlushing(true);
    try {
      const res = await flushPendingQueue();
      setPendingCount(getPendingQueue().length);
      setTestResult({
        success: res.sent > 0,
        msg: `Fila processada: ${res.sent} enviadas, ${res.errors} pendentes.`
      });
    } catch (e: any) {
      setTestResult({
        success: false,
        msg: `Falha ao processar fila: ${e.message}`
      });
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Configuração da Planilha Destino (Google Sheets)</h2>
              <p className="text-xs text-emerald-100 font-medium">
                Sincronização bidirecional: gravação em tempo real e exclusão automática de linhas na planilha
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Instructions Step-by-Step */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Como ativar a gravação direta no Google Sheets (1 Minuto):
            </h3>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed font-medium">
              <li>Abra sua planilha do Google Sheets onde deseja receber os dados.</li>
              <li>No menu superior, vá em <strong>Extensões → Apps Script</strong>.</li>
              <li>Apague o código de exemplo e <strong>cole o código abaixo</strong>.</li>
              <li>Clique em <strong>Implantar → Nova Implantação</strong>.</li>
              <li>Selecione tipo <strong>App da Web</strong>, configure <em>"Quem tem acesso: Qualquer pessoa"</em> e clique em Implantar.</li>
              <li>Copie a <strong>URL do App da Web</strong> (termina com <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">/exec</code>) e cole nos campos abaixo.</li>
            </ol>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={handleCopyCode}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm active:scale-95"
              >
                {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Código Copiado com Sucesso!' : 'Copiar Código do Google Apps Script'}
              </button>
              <span className="text-[11px] text-slate-400">Compatível com Google Sheets oficial</span>
            </div>
          </div>

          {/* Webhook URLs per Tracer */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              URLs de Destino (Webhooks / Apps Script):
            </h3>

            {/* Tracer 01 */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-red-600 flex items-center gap-1.5 uppercase">
                  <span className="w-2 h-2 rounded-full bg-red-600"></span>
                  Tracer 01 - Beira Leito (Destino)
                </label>
                <button
                  onClick={() => handleTest('tracer_01', 'Tracer 01')}
                  disabled={!webhookUrls.tracer_01 || testingTracer !== null}
                  className="text-[11px] font-bold text-slate-600 hover:text-emerald-700 flex items-center gap-1 disabled:opacity-40 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  {testingTracer === 'tracer_01' ? 'Testando...' : 'Testar Envio'}
                </button>
              </div>
              <input
                type="text"
                value={webhookUrls.tracer_01}
                onChange={(e) => setWebhookUrls(prev => ({ ...prev, tracer_01: e.target.value }))}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            {/* Tracer 02 */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-600 flex items-center gap-1.5 uppercase">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Tracer 02 - Proc. Cirúrgicos (Destino)
                </label>
                <button
                  onClick={() => handleTest('tracer_02', 'Tracer 02')}
                  disabled={!webhookUrls.tracer_02 || testingTracer !== null}
                  className="text-[11px] font-bold text-slate-600 hover:text-emerald-700 flex items-center gap-1 disabled:opacity-40 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  {testingTracer === 'tracer_02' ? 'Testando...' : 'Testar Envio'}
                </button>
              </div>
              <input
                type="text"
                value={webhookUrls.tracer_02}
                onChange={(e) => setWebhookUrls(prev => ({ ...prev, tracer_02: e.target.value }))}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            {/* Tracer 03 */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-600 flex items-center gap-1.5 uppercase">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  Tracer 03 - Proc. Medicação (Destino)
                </label>
                <button
                  onClick={() => handleTest('tracer_03', 'Tracer 03')}
                  disabled={!webhookUrls.tracer_03 || testingTracer !== null}
                  className="text-[11px] font-bold text-slate-600 hover:text-emerald-700 flex items-center gap-1 disabled:opacity-40 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  {testingTracer === 'tracer_03' ? 'Testando...' : 'Testar Envio'}
                </button>
              </div>
              <input
                type="text"
                value={webhookUrls.tracer_03}
                onChange={(e) => setWebhookUrls(prev => ({ ...prev, tracer_03: e.target.value }))}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Test & Queue feedback */}
          {testResult && (
            <div className={`p-3 rounded-lg flex items-center gap-2 text-xs font-semibold ${
              testResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {testResult.msg}
            </div>
          )}

          {/* Pending offline queue */}
          {pendingCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-800 block">Fila de Envios Pendentes</span>
                <span className="text-[11px] text-amber-600">
                  Existem {pendingCount} coletas guardadas aguardando envio para a planilha destino.
                </span>
              </div>
              <button
                onClick={handleFlush}
                disabled={flushing}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${flushing ? 'animate-spin' : ''}`} />
                {flushing ? 'Enviando...' : 'Reenviar Agora'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" /> Configurações salvas com sucesso!
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handleSaveUrls}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded-lg transition-all shadow-sm active:scale-95 flex items-center gap-2"
            >
              Salvar URLs de Destino
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
