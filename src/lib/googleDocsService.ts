import { auth, requestGoogleDocsAccess, getCachedAccessToken } from './firebase';

export interface GoogleDocResult {
  documentId: string;
  title: string;
  documentUrl: string;
}

/**
 * Creates a comprehensive Google Doc Guide for Administrator and Auditor roles.
 */
export async function createGuideGoogleDoc(): Promise<GoogleDocResult> {
  let token = getCachedAccessToken();

  if (!token) {
    const authResult = await requestGoogleDocsAccess();
    token = authResult.accessToken || getCachedAccessToken();
  }

  if (!token) {
    throw new Error('Não foi possível obter a autorização do Google. Por favor, tente novamente.');
  }

  const docTitle = `Guia Ilustrado de Funcionalidades - Tracers Clínicos (${new Date().toLocaleDateString('pt-BR')})`;

  // 1. Create document
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: docTitle,
    }),
  });

  if (!createRes.ok) {
    if (createRes.status === 401) {
      // Re-authenticate if token expired
      const reAuth = await requestGoogleDocsAccess();
      token = reAuth.accessToken || getCachedAccessToken();
      if (!token) throw new Error('Sessão expirada. Faça login novamente para continuar.');
      
      const retryRes = await fetch('https://docs.googleapis.com/v1/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: docTitle,
        }),
      });
      if (!retryRes.ok) {
        throw new Error(`Erro ao criar documento no Google Docs: ${retryRes.statusText}`);
      }
      const data = await retryRes.json();
      return populateGoogleDoc(data.documentId, docTitle, token);
    }
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Erro ao criar documento: ${createRes.statusText}`);
  }

  const docData = await createRes.json();
  const documentId = docData.documentId;

  return populateGoogleDoc(documentId, docTitle, token);
}

async function populateGoogleDoc(documentId: string, title: string, token: string): Promise<GoogleDocResult> {
  const contentText = `MANUAL & GUIA ILUSTRADO DE FUNCIONALIDADES
SISTEMA DE AUDITORIAS CLÍNICAS (MONITORAMENTO TRACER)
Secretaria de Saúde / Núcleo de Segurança do Paciente (NSP)

================================================================================
1. VISÃO GERAL DO SISTEMA
================================================================================
O Sistema de Monitoramento Tracer é uma plataforma desenhada para garantir a adesão rigorosa aos protocolos de segurança do paciente, prevenção de eventos adversos e promoção da melhoria contínua da assistência à saúde.

O sistema divide a atuação operacional e estratégica em dois perfis de acesso bem definidos:
• PERFIL AUDITOR (Operacional & Campo): Focado na execução rápida e padronizada das auditorias clínicas nos setores, acompanhamento das metas da própria unidade e consulta ao histórico local.
• PERFIL ADMINISTRADOR (Gestão, Governança & Qualidade): Focado na consolidação dos dados de todas as unidades, diagnósticos estatísticos por critério, gestão de sincronização de dados e auditoria global.

================================================================================
2. TABELA COMPARATIVA DE PERMISSÕES
================================================================================
[FUNCIONALIDADE]                     | [AUDITOR]           | [ADMINISTRADOR]
--------------------------------------------------------------------------------
Iniciar Tracer (Coleta Digital)      | Sim (Criação/Edição)| Sim (Total + Exclusão)
Painel Geral (Dashboard)             | Apenas sua Unidade  | Todas as Unidades + Filtros
Explorador de Auditorias             | Consulta e CSV      | Edição, Exclusão e CSV
Conformidade por Item (Critérios)    | Filtro sua Unidade  | Gráficos Empilhados Globais
Auditorias por Unidade               | Desempenho Setorial | Comparativo Institucional
Participação de Auditores            | Visualização        | Ranking e Produtividade
Sincronização & Fontes de Dados      | Bloqueado           | Total (Sheets/Firestore)
Exportação de Relatórios em Planilha | Registros Filtrados | Banco Completo + Indicadores

================================================================================
3. GUIA COMPLETO: PERFIL AUDITOR (OPERAÇÃO EM CAMPO)
================================================================================
O Auditor de campo é o elo fundamental da qualidade assistencial. O fluxo foi planejado para agilidade em smartphones, tablets ou computadores à beira do leito.

A. COMO INICIAR UMA AUDITORIA (COLETA DIGITAL)
1. No menu lateral esquerdo, clique no primeiro botão de destaque: "INICIAR TRACER".
2. Selecione o formulário do Tracer correspondente à auditoria:
   • Tracer 01 (T01 - Beira Leito): Foco em pulseiras de identificação, dupla checagem na admissão, riscos assistenciais e conferência ativa com o paciente/acompanhante.
   • Tracer 02 (T02 - Cirurgia Segura): Checklist de 3 fases cirúrgicas (Sign-In antes da indução anestésica, Time-Out antes da incisão e Sign-Out antes da saída da sala).
   • Tracer 03 (T03 - Processos de Medicação): Avaliação da prescrição médica, identificação e preparo de medicamentos, dupla checagem à beira do leito e higienização das mãos antes da administração.
3. Preencha os campos obrigatórios (Unidade, Leito, Identificação do Paciente).
4. Responda aos critérios avaliados com "Sim", "Não" ou "Não se Aplica".
5. Quando selecionar "Não", forneça a justificativa no campo exibido automaticamente.
6. Clique em "Salvar / Concluir Coleta".

B. FUNCIONAMENTO OFFLINE E SINCRONIZAÇÃO AUTOMÁTICA
• O aplicativo possui salvamento local resiliente (IndexedDB e Cache).
• Mesmo em setores com sinal fraco ou sem Wi-Fi, a coleta é gravada instantaneamente no dispositivo.
• Assim que a conexão for restabelecida, a sincronização com a nuvem ocorre em segundo plano.

C. ACOMPANHAMENTO DE METAS DA UNIDADE
• Na tela "Visão Geral", o auditor visualiza o progresso da meta mensal da sua unidade (exemplo: meta de 30 auditorias mensais distribuídas entre os Tracers).
• Identifique em quais dias ou semanas a unidade precisa de reforço de coletas.

================================================================================
4. GUIA COMPLETO: PERFIL ADMINISTRADOR (GOVERNANÇA & QUALIDADE)
================================================================================
O Administrador possui ferramentas analíticas para transformação de dados em planos de ação de segurança.

A. PAINEL GERAL (DASHBOARD EXECUTIVO)
• Filtros Multidimensionais: Filtre simultaneamente por Período (Mês/Ano ou Trimestre), Unidade Hospitalar e Tracer Específico (T01, T02 ou T03).
• Insights Estratégicos Inteligentes: Diagnósticos automáticos que apontam itens com taxa crítica de conformidade (abaixo de 80%), alertando para intervenções prioritárias.
• Monitor de Cumprimento de Metas: Visualização instantânea em cards de cores sobre quais unidades já atingiram a meta mensal.

B. CONFORMIDADE POR ITEM (ANÁLISE DE CRITÉRIOS)
• Gráficos Empilhados Detalhados: Visualize a distribuição percentual de respostas (Conforme, Não Conforme, Não Aplicável) item por item de cada formulário.
• Identificação de Vulnerabilidades: Descubra exatamente quais etapas do protocolo sofrem mais desvios (ex: conferência de alergia na pulseira vs conferência verbal).
• Exportação CSV por Item: Gere relatórios específicos para comissões hospitalares e planos 5W2H.

C. EXPLORADOR GERAL DE AUDITORIAS
• Consulta completa a todas as coletas do hospital com busca textual dinâmica.
• Botão "Ver Detalhes": Exibe a ficha completa da auditoria com todas as respostas e justificativas preenchidas pelo auditor.
• Gestão de Registros: Permissão para editar informações digitadas incorretamente ou excluir duplicidades com confirmação de segurança.

D. PARTICIPAÇÃO DOS AUDITORES
• Tabela de engajamento da equipe: número de coletas por auditor, distribuição por tipo de Tracer e assiduidade mensal.
• Reconhecimento e direcionamento de capacitações para auditores com menor volume.

E. GESTÃO DE DADOS & SINCRONIZAÇÃO (DATA MANAGEMENT)
• Integração direta com Google Sheets e banco Firestore.
• Monitoramento do status da sincronização em tempo real e botão para forçar sincronização manual imediata.

================================================================================
5. BOAS PRÁTICAS E RECOMENDAÇÕES PARA A EQUIPE
================================================================================
1. Fidedignidade dos Dados: Registre exatamente a prática observada em campo, incluindo justificativas detalhadas quando houver não-conformidade.
2. Regularidade: Distribua as coletas ao longo de todo o mês, evitando acúmulo na última semana.
3. Feedback Imediato: Quando identificar uma não-conformidade crítica, realize a orientação educativa à equipe assistencial no momento oportuno.
4. Revisão Periódica: Os administradores devem apresentar os relatórios de itens em reuniões mensais do Núcleo de Segurança do Paciente (NSP).

---
Documento gerado automaticamente pelo Sistema de Monitoramento Tracer.
Você pode editar, formatar e adicionar logotipos institucionais diretamente neste documento do Google Docs.
`;

  // 2. Insert formatted text content via batchUpdate
  const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: {
              index: 1,
            },
            text: contentText,
          },
        },
      ],
    }),
  });

  if (!updateRes.ok) {
    console.warn('Batch update warned:', await updateRes.text());
  }

  const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  return {
    documentId,
    title,
    documentUrl: docUrl,
  };
}
