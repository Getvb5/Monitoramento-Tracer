import React, { useState } from 'react';
import { 
  FileText, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  Copy, 
  ShieldCheck, 
  UserCheck, 
  BookOpen, 
  Share2,
  Sparkles
} from 'lucide-react';
import { createGuideGoogleDoc, GoogleDocResult } from '../lib/googleDocsService';

interface GoogleDocsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleDocsGuideModal: React.FC<GoogleDocsGuideModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [createdDoc, setCreatedDoc] = useState<GoogleDocResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'both' | 'auditor' | 'admin'>('both');

  if (!isOpen) return null;

  const handleGenerateDoc = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await createGuideGoogleDoc();
      setCreatedDoc(result);
      // Auto open in new tab
      if (typeof window !== 'undefined') {
        window.open(result.documentUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      console.error('[GoogleDocs] Erro ao gerar doc:', err);
      setError(err?.message || 'Falha ao criar o documento no Google Docs. Verifique as permissões de sua conta Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdDoc) return;
    navigator.clipboard.writeText(createdDoc.documentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-left">
        
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-400/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black uppercase tracking-tight text-white">
                  Manual do Sistema
                </h2>
                <span className="bg-blue-400/20 text-blue-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-blue-300/30">
                  Google Docs
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                Guia operacional dos perfis Administrador e Auditor pronto para leitura e exportação
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Banner for Google Docs */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 uppercase">
                Exportar para seu Google Docs
              </div>
              <div className="text-[11px] text-slate-600 font-medium">
                Cria um novo documento oficial diretamente no seu Google Drive com formatação editável.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {createdDoc ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <a
                  href={createdDoc.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir no Google Docs</span>
                </a>
                <button
                  onClick={handleCopyLink}
                  className="p-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-all cursor-pointer"
                  title="Copiar Link"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerateDoc}
                disabled={loading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md hover:shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gerando Documento...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Criar e Editar no Google Docs</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong>Atenção:</strong> {error}
            </div>
          </div>
        )}

        {/* Success notification */}
        {createdDoc && !error && (
          <div className="mx-6 mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Documento criado com sucesso! Ele foi aberto em uma nova aba do seu navegador.</span>
            </div>
            <a 
              href={createdDoc.documentUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-emerald-700 hover:text-emerald-900 font-bold underline text-[11px] shrink-0"
            >
              Acessar agora
            </a>
          </div>
        )}

        {/* Tab Filters for Interactive Preview */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-100 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
              activeTab === 'both' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Visão Geral & Matriz
          </button>
          <button
            onClick={() => setActiveTab('auditor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
              activeTab === 'auditor' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Perfil Auditor</span>
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
              activeTab === 'admin' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Perfil Administrador</span>
          </button>
        </div>

        {/* Preview Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-grow text-slate-800 text-xs leading-relaxed">
          
          {(activeTab === 'both' || activeTab === 'auditor') && (
            <section className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-4.5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-black text-xs uppercase tracking-wide">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <h3>1. Perfil Auditor (Operações em Campo & Qualidade)</h3>
              </div>
              <p className="text-slate-600">
                O <strong>Auditor</strong> é responsável pela coleta ativa de dados diretamente nos postos de internação, centros cirúrgicos e unidades de atendimento.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                  <div className="font-bold text-emerald-900 uppercase text-[11px] mb-1">Tracer 01 - Beira Leito</div>
                  <p className="text-[11px] text-slate-500">
                    Conferência da identificação na pulseira, placa de leito, alergias, riscos e checagem verbal ativa.
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                  <div className="font-bold text-emerald-900 uppercase text-[11px] mb-1">Tracer 02 - Cirurgia Segura</div>
                  <p className="text-[11px] text-slate-500">
                    Auditoria das 3 etapas da Lista de Verificação Cirúrgica: Sign-In, Time-Out cirúrgico e Sign-Out.
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                  <div className="font-bold text-emerald-900 uppercase text-[11px] mb-1">Tracer 03 - Proc. Medicação</div>
                  <p className="text-[11px] text-slate-500">
                    Prescrição, identificação de ampolas/soros, dupla checagem, preparo e higiene de mãos antes da administração.
                  </p>
                </div>
              </div>
            </section>
          )}

          {(activeTab === 'both' || activeTab === 'admin') && (
            <section className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-4.5 space-y-3">
              <div className="flex items-center gap-2 text-indigo-800 font-black text-xs uppercase tracking-wide">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <h3>2. Perfil Administrador (Governança, Estatística & Gestão)</h3>
              </div>
              <p className="text-slate-600">
                O <strong>Administrador</strong> tem acesso pleno a todos os indicadores, diagnósticos automatizados, exportação global e gestão da base de dados.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-2xs">
                  <div className="font-bold text-indigo-900 uppercase text-[11px] mb-1">Painel Executivo & Metas</div>
                  <p className="text-[11px] text-slate-500">
                    Filtros multidimensionais por período, unidade e Tracer. Insights inteligentes de conformidade crítica (&lt;80%).
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-2xs">
                  <div className="font-bold text-indigo-900 uppercase text-[11px] mb-1">Conformidade por Item</div>
                  <p className="text-[11px] text-slate-500">
                    Gráficos empilhados detalhados de cada pergunta, permitindo mapear a exata causa-raiz das falhas operacionais.
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-2xs">
                  <div className="font-bold text-indigo-900 uppercase text-[11px] mb-1">Gestão de Dados & Sync</div>
                  <p className="text-[11px] text-slate-500">
                    Sincronização em tempo real com Google Sheets, integridade no Firestore e auditoria cadastral da equipe.
                  </p>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'both' && (
            <section className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-3">
              <div className="font-black text-slate-900 text-xs uppercase tracking-wide">
                Matriz Resumida de Permissões
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-500 uppercase font-black">
                      <th className="py-2 px-3">Funcionalidade</th>
                      <th className="py-2 px-3 text-center">Auditor</th>
                      <th className="py-2 px-3 text-center">Administrador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-800">Iniciar Tracer (Coleta Digital)</td>
                      <td className="py-2 px-3 text-center text-emerald-700 font-bold">Criação / Edição</td>
                      <td className="py-2 px-3 text-center text-blue-700 font-bold">Total + Exclusão</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-800">Painel de Indicadores</td>
                      <td className="py-2 px-3 text-center text-slate-600">Apenas sua Unidade</td>
                      <td className="py-2 px-3 text-center text-blue-700 font-bold">Todas as Unidades</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-800">Análise por Item (Gráficos Empilhados)</td>
                      <td className="py-2 px-3 text-center text-slate-600">Visualização Local</td>
                      <td className="py-2 px-3 text-center text-blue-700 font-bold">Exportação CSV e Global</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-800">Gestão de Sincronização & Fontes</td>
                      <td className="py-2 px-3 text-center text-slate-400">Restrito</td>
                      <td className="py-2 px-3 text-center text-blue-700 font-bold">Controle Total</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            Secretaria de Saúde do Recife • Núcleo de Segurança do Paciente
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
