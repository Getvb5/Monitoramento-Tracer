// Helper for calculating item-by-item compliance for Tracers (T01, T02, T03)
// and Auditor participation & Sector distribution

export interface ItemComplianceResult {
  id: string;
  name: string;
  simCount: number;
  naoCount: number;
  naoSeAplicaCount: number;
  total: number;
  simPct: number;
  naoPct: number;
  naoSeAplicaPct: number;
}

export interface AuditorShareResult {
  auditorId: string;
  auditorName: string;
  professionalCategory: string;
  unitName: string;
  t01Count: number;
  t02Count: number;
  t03Count: number;
  totalCount: number;
  percentage: number;
}

export interface SectorShareResult {
  sectorName: string;
  count: number;
  percentage: number;
  t01Count: number;
  t02Count: number;
  t03Count: number;
}

// Normalizer for "Sim", "Não", "Não se aplica"
export function normalizeAnswer(value: any): 'sim' | 'nao' | 'na' | null {
  if (value === true || value === 1) return 'sim';
  if (value === false || value === 0) return 'nao';
  if (typeof value !== 'string') return null;

  const v = value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // 1. Check "Não se aplica" first so phrases with "não" + "aplica" are never marked as "não"
  if (
    v.includes('nao se aplica') || 
    v.includes('nao aplicavel') || 
    v.includes('nao se aplic') || 
    v === 'n/a' || 
    v === 'na' || 
    v === 'dispensado' || 
    v === 'sem indicacao' || 
    v === 'sem indicacao clinica' ||
    v === '-'
  ) {
    return 'na';
  }

  // 2. Check "Sim" / Conforme / Adequado / Realizado
  if (
    v === 'sim' || 
    v === 's' || 
    v === 'true' || 
    v === 'conforme' || 
    v === 'adequado' || 
    v === 'realizado' || 
    v === 'presente' || 
    v === 'simples' || 
    v === 'correto' ||
    v.startsWith('sim ')
  ) {
    return 'sim';
  }

  // 3. Check "Não" / Não Conforme / Inadequado / Não Realizado
  if (
    v === 'nao' || 
    v === 'n' || 
    v === 'false' || 
    v === 'nao conforme' || 
    v === 'inadequado' || 
    v === 'nao realizado' || 
    v === 'ausente' || 
    v === 'incorreto' ||
    v.startsWith('nao ')
  ) {
    return 'nao';
  }

  return null;
}

// Extracts value from audit searching rawData, sourceRowHash, direct fields
function extractAuditValue(audit: any, directKey: string, searchTerms: string[]): 'sim' | 'nao' | 'na' | null {
  // 1. Direct field
  if (audit[directKey] !== undefined && audit[directKey] !== null && audit[directKey] !== '') {
    const directAns = normalizeAnswer(audit[directKey]);
    if (directAns !== null) return directAns;
  }

  // 2. Check rawData
  const raw = audit.rawData || (audit.sourceRowHash ? (typeof audit.sourceRowHash === 'string' ? JSON.parse(audit.sourceRowHash) : audit.sourceRowHash) : null);
  if (raw && typeof raw === 'object') {
    for (const term of searchTerms) {
      const lowerTerm = term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (const [k, v] of Object.entries(raw)) {
        if (!v) continue;
        const lowerKey = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        // Ignore justification text fields!
        if (lowerKey.includes('justifique') || lowerKey.includes('se nao') || lowerKey.includes('se nao,')) {
          continue;
        }
        if (lowerKey.includes(lowerTerm)) {
          const ans = normalizeAnswer(v);
          if (ans !== null) return ans;
        }
      }
    }
  }

  return null;
}

// Definition of items for T01 - Beira Leito (Identificação do Paciente)
export const T01_ITEMS_CONFIG = [
  {
    id: 't01_pulseira_branca',
    name: 'Identificado com pulseira branca',
    directKey: 'hasWristband',
    searchTerms: ['pulseira branca', 'identificado com pulseira branca', 'q10_pulseira_branca', '09- paciente identificado com pulseira branca', '10- paciente identificado']
  },
  {
    id: 't01_pulseira_legivel',
    name: 'Pulseira legível',
    directKey: 'wristbandLegible',
    searchTerms: ['pulseira legivel', 'pulseira esta legivel', 'pulseira de identificacao esta legivel', 'q12_pulseira_legivel', '11- a pulseira de identificacao', '12- a pulseira']
  },
  {
    id: 't01_pulseira_preenchida',
    name: 'Pulseira preenchida adequadamente',
    directKey: 'correctData',
    searchTerms: ['pulseira preenchida', 'preenchida adequadamente', 'pulseira de identificacao preenchida', 'q14_pulseira_preenchida', '13- a pulseira de identificacao preenchida', '14- a pulseira']
  },
  {
    id: 't01_alergia_sinalizada',
    name: 'Alergia sinalizada com pulseira rosa (quando aplicável)',
    directKey: 'alergiaSinalizada',
    searchTerms: ['pulseira especifica (cor rosa)', 'pulseira rosa', 'alergia sinalizada', 'q17_alergia_sinalizada', '17- se tem alergia, esta sinalizado']
  },
  {
    id: 't01_plano_terapeutico',
    name: 'Paciente/responsável compreende plano terapêutico',
    directKey: 'compreendePlano',
    searchTerms: ['plano terapeutico', 'compreende o plano', 'q8_compreende_plano', '09- paciente ou responsavel compreende']
  },
  {
    id: 't01_placa_leito',
    name: 'Placa de identificação do leito afixada',
    directKey: 'placaLeito',
    searchTerms: ['placa de identificacao do leito afixada', 'placa afixada', 'q19_placa_leito', '19- placa de identificacao']
  },
  {
    id: 't01_placa_preenchida',
    name: 'Placa de identificação preenchida adequadamente',
    directKey: 'placaPreenchida',
    searchTerms: ['placa de identificacao preenchida', 'q21_placa_preenchida', '21- placa de identificacao preenchida']
  },
  {
    id: 't01_placa_riscos',
    name: 'Placa do leito com riscos sinalizados',
    directKey: 'placaRiscos',
    searchTerms: ['riscos sinalizados', 'com os riscos sinalizados', 'q23_placa_riscos', '23- placa de identificacao do leito com os riscos']
  },
  {
    id: 't01_rotulos_dieta',
    name: 'Rótulos da dieta com identificadores obrigatórios',
    directKey: 'rotulosDieta',
    searchTerms: ['rotulos da dieta', 'q25_rotulos_dieta', '25- os rotulos da dieta']
  },
  {
    id: 't01_rotulos_medicamento',
    name: 'Rótulo de medicamentos com identificadores obrigatórios',
    directKey: 'rotulosMedicamento',
    searchTerms: ['rotulo de medicamentos', 'q27_rotulo_medicamento', '27- o rotulo de medicamentos']
  },
  {
    id: 't01_higiene_maos',
    name: 'Higienização das mãos realizada',
    directKey: 'higieneMaos',
    searchTerms: ['higienizacao das maos foi realizada', 'higienizacao das maos', 'q28_higienizacao_maos', '28- a higienizacao das maos']
  },
  {
    id: 't01_acesso_venoso',
    name: 'Acesso venoso identificado adequadamente',
    directKey: 'acessoVenoso',
    searchTerms: ['acesso venoso foi identificado', 'acesso venoso', 'q30_acesso_venoso', '30- acesso venoso foi']
  },
  {
    id: 't01_curativo',
    name: 'Curativo da ferida identificado, válido e íntegro',
    directKey: 'curativoFerida',
    searchTerms: ['curativo da ferida identificado', 'curativo da ferida', 'q32_curativo_ferida', '32- curativo da ferida']
  },
  {
    id: 't01_decubito',
    name: 'Paciente no decúbito correto (relógio da pele)',
    directKey: 'decubitoCorreto',
    searchTerms: ['decubito correto', 'relogio da pele', 'q34_decubito_correto', '34- paciente esta no decubito']
  },
  {
    id: 't01_grades',
    name: 'Grades do leito elevadas',
    directKey: 'gradesElevadas',
    searchTerms: ['grades do leito estao elevadas', 'grades elevadas', 'q37_grades_elevadas', '37- grades do leito']
  },
  {
    id: 't01_sbar',
    name: 'Passagem de plantão com ferramenta SBAR',
    directKey: 'sbar',
    searchTerms: ['ferramenta sbar', 'passagem de plantao com a ferramenta sbar', 'q42_SBAR', '42- foi realizada a passagem de plantao']
  }
];

// Definition of items for T02 - Cirurgia Segura
export const T02_ITEMS_CONFIG = [
  {
    id: 't02_pulseira_branca',
    name: 'Identificado com pulseira branca',
    directKey: 'hasWristband',
    searchTerms: ['pulseira branca', 'identificado com pulseira branca', 'q8_pulseira_branca', 'paciente identificado com pulseira branca']
  },
  {
    id: 't02_pulseira_legivel',
    name: 'Pulseira legível',
    directKey: 'wristbandLegible',
    searchTerms: ['pulseira legível', 'pulseira de identificação está legível', 'q9_pulseira_legivel']
  },
  {
    id: 't02_pulseira_preenchida',
    name: 'Pulseira preenchida adequadamente',
    directKey: 'correctData',
    searchTerms: ['pulseira preenchida', 'preenchida adequadamente', 'q10_pulseira_preenchida']
  },
  {
    id: 't02_alergia_sinalizada',
    name: 'Alergia sinalizada com pulseira rosa',
    directKey: 'alergiaSinalizada',
    searchTerms: ['alergia sinalizada', 'pulseira específica (cor rosa)', 'q11_alergia_sinalizada']
  },
  {
    id: 't02_termo_cirurgico',
    name: 'Termo de consentimento cirúrgico assinado',
    directKey: 'termoCirurgico',
    searchTerms: ['termo de consentimento cirúrgico', 'termo cirurgico', 'q12_termo_cirurgico']
  },
  {
    id: 't02_termo_anestesico',
    name: 'Termo de consentimento anestésico assinado',
    directKey: 'termoAnestesico',
    searchTerms: ['termo de consentimento anestésico', 'termo anestesico', 'q13_termo_anestesico']
  },
  {
    id: 't02_visita_anestesica',
    name: 'Visita pré-anestésica realizada',
    directKey: 'visitaPreAnestesica',
    searchTerms: ['visita pré-anestésica', 'visita pre-anestesica', 'q14_visita_pre_anestesica']
  },
  {
    id: 't02_confirma_identificacao',
    name: 'Confirmação de identificação antes de entrar na sala',
    directKey: 'confirmaIdentificacao',
    searchTerms: ['confirmação de identificação', 'confirmacao de identificacao', 'q15_confirma_identificacao']
  },
  {
    id: 't02_sbar',
    name: 'Passagem de plantão com ferramenta SBAR',
    directKey: 'sbar',
    searchTerms: ['sbar', 'ferramenta sbar', 'q16_SBAR']
  },
  {
    id: 't02_riscos_informados',
    name: 'Paciente informado sobre riscos cirúrgicos',
    directKey: 'informadoRiscos',
    searchTerms: ['informado sobre os riscos', 'riscos cirúrgicos', 'q17_informado_riscos']
  },
  {
    id: 't02_retirou_adornos',
    name: 'Retirada de adornos e próteses',
    directKey: 'retirouAdornos',
    searchTerms: ['retirou adornos', 'retirada de adornos', 'q18_retirou_adornos']
  },
  {
    id: 't02_banho_clorexidina',
    name: 'Banho pré-operatório com clorexidina',
    directKey: 'banhoClorexidina',
    searchTerms: ['banho pré-operatório com clorexidina', 'banho clorexidina', 'q19_banho_clorexidina']
  },
  {
    id: 't02_degermacao',
    name: 'Degermação cirúrgica das mãos realizada',
    directKey: 'degermacao',
    searchTerms: ['degermação cirúrgica', 'degermacao', 'q20_degermacao']
  },
  {
    id: 't02_equipe_completa',
    name: 'Equipe cirúrgica completa presente',
    directKey: 'equipeCompleta',
    searchTerms: ['equipe cirúrgica completa', 'equipe completa', 'q21_equipe_completa']
  },
  {
    id: 't02_equipe_sem_adorno',
    name: 'Equipe sem adornos',
    directKey: 'semAdorno',
    searchTerms: ['sem adorno', 'equipe sem adornos', 'q22_sem_adorno']
  },
  {
    id: 't02_equipe_paramentada',
    name: 'Equipe devidamente paramentada',
    directKey: 'paramentada',
    searchTerms: ['paramentada', 'equipe paramentada', 'q23_paramentada']
  },
  {
    id: 't02_sign_in',
    name: 'Checklist de Indução Anestésica (Sign-In)',
    directKey: 'signIIn',
    searchTerms: ['sign-in', 'sign in', 'checklist de indução', 'checklist antes da indução', 'q24_checklist_inducao']
  },
  {
    id: 't02_instrumentais_antes',
    name: 'Contagem de instrumentais antes do procedimento',
    directKey: 'contagemInstrumentaisAntes',
    searchTerms: ['contagem de instrumentais antes', 'instrumentais antes', 'q25_contagem_instrumentais_antes']
  },
  {
    id: 't02_antibiotico',
    name: 'Antibiótico profilático administrado no tempo correto',
    directKey: 'antibiotico',
    searchTerms: ['antibiótico profilático', 'antibiotico profilatico', 'q26_antibiotico']
  },
  {
    id: 't02_compressas_antes',
    name: 'Contagem de compressas antes da incisão',
    directKey: 'compressasAntes',
    searchTerms: ['contagem de compressas antes', 'compressas antes', 'q27_compressas_antes']
  },
  {
    id: 't02_time_out',
    name: 'Checklist de Pausa Cirúrgica (Time-Out)',
    directKey: 'timeOut',
    searchTerms: ['time-out', 'time out', 'pausa cirúrgica', 'checklist antes da incisão', 'q28_checklist_incisao']
  },
  {
    id: 't02_material_biologico',
    name: 'Identificação correta de material biológico/peça',
    directKey: 'materialBiologico',
    searchTerms: ['material biológico', 'identificação de material biológico', 'q29_material_biologico']
  },
  {
    id: 't02_compressas_depois',
    name: 'Contagem de compressas antes do fechamento',
    directKey: 'compressasFechamento',
    searchTerms: ['compressas antes do fechamento', 'compressas fechamento', 'q30_compressas_fechamento']
  },
  {
    id: 't02_instrumentais_depois',
    name: 'Contagem de instrumentais antes do fechamento',
    directKey: 'instrumentaisFechamento',
    searchTerms: ['instrumentais antes do fechamento', 'instrumentais fechamento', 'q31_instrumentais_fechamento']
  },
  {
    id: 't02_morse',
    name: 'Avaliação de Risco de Queda (Escala de MORSE)',
    directKey: 'morse',
    searchTerms: ['escala de morse', 'morse', 'q32_MORSE']
  },
  {
    id: 't02_dor',
    name: 'Avaliação da Dor pós-operatória',
    directKey: 'dor',
    searchTerms: ['avaliação da dor', 'dor pós-operatória', 'q33_dor']
  },
  {
    id: 't02_sinais_vitais',
    name: 'Monitorização de sinais vitais na RPA',
    directKey: 'sinaisVitais',
    searchTerms: ['sinais vitais', 'monitorização de sinais vitais', 'q34_sinais_vitais']
  },
  {
    id: 't02_sign_out',
    name: 'Checklist de Saída da Sala Cirúrgica (Sign-Out)',
    directKey: 'signOut',
    searchTerms: ['sign-out', 'sign out', 'checklist de saída', 'checklist antes do paciente sair', 'q35_checklist_saida']
  },
  {
    id: 't02_rn_identificado',
    name: 'Recém-nascido identificado imediatamente (se parto)',
    directKey: 'rnIdentificado',
    searchTerms: ['recém-nascido identificado', 'rn identificado', 'q37_RN_identificado']
  },
  {
    id: 't02_vitamina_k',
    name: 'Administração de Vitamina K ao RN',
    directKey: 'vitaminaK',
    searchTerms: ['vitamina k', 'administração de vitamina k', 'q38_vitamina_K']
  }
];

// Definition of items for T03 - Processos de Medicação / Higienização das Mãos
export const T03_ITEMS_CONFIG = [
  {
    id: 't03_pulseira_branca',
    name: 'Identificado com pulseira branca',
    directKey: 'hasWristband',
    searchTerms: ['pulseira branca', 'identificado com pulseira branca', 'q8_pulseira_branca']
  },
  {
    id: 't03_pulseira_legivel',
    name: 'Pulseira legível',
    directKey: 'wristbandLegible',
    searchTerms: ['pulseira legível', 'pulseira de identificação está legível', 'q10_pulseira_legivel']
  },
  {
    id: 't03_pulseira_preenchida',
    name: 'Pulseira preenchida adequadamente',
    directKey: 'correctData',
    searchTerms: ['pulseira preenchida', 'preenchida adequadamente', 'q12_pulseira_preenchida']
  },
  {
    id: 't03_alergia_sinalizada',
    name: 'Alergia sinalizada com pulseira rosa',
    directKey: 'alergiaSinalizada',
    searchTerms: ['alergia sinalizada', 'pulseira específica (cor rosa)', 'q15_alergia_sinalizada']
  },
  {
    id: 't03_orientacao_paciente',
    name: 'Orientação prévia ao paciente sobre medicação',
    directKey: 'orientacaoPaciente',
    searchTerms: ['orientação ao paciente', 'orientacao prévia', 'q17_orientacao_paciente']
  },
  {
    id: 't03_higiene_maos',
    name: 'Higienização das mãos realizada',
    directKey: 'compliant',
    searchTerms: ['higienização das mãos', 'higienizacao das maos', 'higiene das mãos', 'q18_higienizacao_maos', 'compliant']
  },
  {
    id: 't03_acesso_venoso',
    name: 'Acesso venoso identificado adequadamente',
    directKey: 'acessoVenoso',
    searchTerms: ['acesso venoso foi identificado', 'acesso venoso', 'q20_acesso_venoso']
  },
  {
    id: 't03_conferencia_pulseira',
    name: 'Conferência da identificação na pulseira antes de medicar',
    directKey: 'conferenciaPulseira',
    searchTerms: ['conferida a identificação', 'conferência da identificação', 'conferência da pulseira', 'q22_conferencia_pulseira', '23- no momento da administração']
  },
  {
    id: 't03_conferencia_prescricao',
    name: 'Conferência com a prescrição médica',
    directKey: 'conferenciaPrescricao',
    searchTerms: ['conferência com a prescrição', 'conferencia prescricao', 'q24_conferencia_prescricao']
  },
  {
    id: 't03_dupla_checagem',
    name: 'Dupla checagem para medicamentos de alta vigilância (MAV)',
    directKey: 'duplaChecagem',
    searchTerms: ['dupla checagem', 'alta vigilância', 'mav', 'q25_dupla_checagem']
  },
  {
    id: 't03_rotulo_obrigatorio',
    name: 'Rótulo de medicamentos com identificadores obrigatórios',
    directKey: 'rotuloMedicamento',
    searchTerms: ['rótulo de medicamentos', 'rotulo de medicamentos', 'q27_rotulo_obrigatorios']
  },
  {
    id: 't03_assinatura_medico',
    name: 'Prescrição médica assinada e carimbada',
    directKey: 'assinaturaMedico',
    searchTerms: ['assinatura do médico', 'assinada pelo médico', 'q29_assinatura_medico']
  },
  {
    id: 't03_assinatura_enfermeiro',
    name: 'Prescrição checada/assinada pelo enfermeiro',
    directKey: 'assinaturaEnfermeiro',
    searchTerms: ['assinatura do enfermeiro', 'checagem do enfermeiro', 'q31_assinatura_enfermeiro']
  },
  {
    id: 't03_hora_correta',
    name: 'Horário de administração correto',
    directKey: 'horaCorreta',
    searchTerms: ['horário correto', 'hora correta', 'q33_hora_correta']
  },
  {
    id: 't03_sem_abreviaturas',
    name: 'Prescrição sem abreviaturas proibidas',
    directKey: 'semAbreviaturas',
    searchTerms: ['sem abreviaturas', 'abreviaturas proibidas', 'q35_sem_abreviaturas']
  },
  {
    id: 't03_medicamentos_semelhantes',
    name: 'Diferenciação de nomes semelhantes (Look-Alike / Sound-Alike)',
    directKey: 'diferenciarSemelhantes',
    searchTerms: ['nomes semelhantes', 'diferenciar semelhantes', 'tall man', 'q36_diferenciar_semelhantes']
  },
  {
    id: 't03_registro_alergias',
    name: 'Registro explícito de alergias na prescrição médica',
    directKey: 'registroAlergias',
    searchTerms: ['registro de alergias', 'registro explícito de alergias', 'q38_registro_alergias']
  },
  {
    id: 't03_duracao_especificada',
    name: 'Duração do tratamento especificada',
    directKey: 'duracaoEspecificada',
    searchTerms: ['duração do tratamento', 'duracao especificada', 'q40_duracao_especificada']
  },
  {
    id: 't03_se_necessario',
    name: 'Prescrições "se necessário" com dose máxima e intervalo',
    directKey: 'seNecessario',
    searchTerms: ['se necessário', 'se necessario', 'dose máxima', 'q41_se_necessario_seguranca']
  },
  {
    id: 't03_diluente_prescrito',
    name: 'Diluente prescrito adequadamente',
    directKey: 'diluentePrescrito',
    searchTerms: ['diluente prescrito', 'diluente', 'q43_diluente_prescrito']
  },
  {
    id: 't03_velocidade_prescrita',
    name: 'Velocidade de infusão prescrita',
    directKey: 'velocidadePrescrita',
    searchTerms: ['velocidade de infusão', 'velocidade prescrita', 'q44_velocidade_prescrita']
  },
  {
    id: 't03_via_prescrita',
    name: 'Via de administração prescrita',
    directKey: 'viaPrescrita',
    searchTerms: ['via prescrita', 'via de administração', 'q46_via_prescrita']
  },
  {
    id: 't03_dose_checada',
    name: 'Dose checada no prontuário imediatamente após aplicação',
    directKey: 'doseChecada',
    searchTerms: ['dose checada', 'checada no prontuário', 'q50_dose_checada']
  },
  {
    id: 't03_mav_acesso_restrito',
    name: 'Medicamentos de alta vigilância (MAV) em acesso restrito',
    directKey: 'mavAcessoRestrito',
    searchTerms: ['acesso restrito', 'mav restrito', 'q52_mav_acesso_restrito']
  },
  {
    id: 't03_temperatura_refrigeracao',
    name: 'Armazenamento em refrigeração adequada (2ºC a 8ºC)',
    directKey: 'temperaturaRefrigeracao',
    searchTerms: ['temperatura de refrigeração', 'temperatura refrigeracao', '2ºc a 8ºc', 'q56_temperatura_refrigeracao']
  }
];

// Calculation function for a specific list of audits and item configs
export function calculateItemsCompliance(audits: any[], itemsConfig: typeof T01_ITEMS_CONFIG): ItemComplianceResult[] {
  const totalAudits = audits.length;
  if (totalAudits === 0) {
    return itemsConfig.map(cfg => ({
      id: cfg.id,
      name: cfg.name,
      simCount: 0,
      naoCount: 0,
      naoSeAplicaCount: 0,
      total: 0,
      simPct: 0,
      naoPct: 0,
      naoSeAplicaPct: 0
    }));
  }

  return itemsConfig.map(cfg => {
    let sim = 0;
    let nao = 0;
    let na = 0;

    audits.forEach(audit => {
      const ans = extractAuditValue(audit, cfg.directKey, cfg.searchTerms);
      if (ans === 'sim') {
        sim++;
      } else if (ans === 'nao') {
        nao++;
      } else if (ans === 'na') {
        na++;
      } else {
        // Fallback: If no explicit answer was captured, look if this is a primary question that was evaluated
        // Default to "Não se aplica" or infer from general compliance
        if (cfg.directKey === 'hasWristband' && audit.hasWristband !== undefined) {
          if (audit.hasWristband) sim++; else nao++;
        } else if (cfg.directKey === 'wristbandLegible' && audit.wristbandLegible !== undefined) {
          if (audit.wristbandLegible) sim++; else nao++;
        } else if (cfg.directKey === 'correctData' && audit.correctData !== undefined) {
          if (audit.correctData) sim++; else nao++;
        } else if (cfg.directKey === 'signIIn' && audit.signIIn !== undefined) {
          if (audit.signIIn) sim++; else nao++;
        } else if (cfg.directKey === 'timeOut' && audit.timeOut !== undefined) {
          if (audit.timeOut) sim++; else nao++;
        } else if (cfg.directKey === 'signOut' && audit.signOut !== undefined) {
          if (audit.signOut) sim++; else nao++;
        } else if (cfg.directKey === 'compliant' && audit.compliant !== undefined) {
          if (audit.compliant) sim++; else nao++;
        } else {
          // If not answered/tested in this specific audit form, count as "Não se aplica"
          na++;
        }
      }
    });

    const evaluatedTotal = sim + nao + na;
    const baseTotal = evaluatedTotal > 0 ? evaluatedTotal : totalAudits;

    const simPct = baseTotal > 0 ? Number(((sim / baseTotal) * 100).toFixed(1)) : 0;
    const naoPct = baseTotal > 0 ? Number(((nao / baseTotal) * 100).toFixed(1)) : 0;
    // Ensure exact sum to 100.0 if there are items
    let naoSeAplicaPct = baseTotal > 0 ? Number((100 - simPct - naoPct).toFixed(1)) : 0;
    if (naoSeAplicaPct < 0) naoSeAplicaPct = 0;

    return {
      id: cfg.id,
      name: cfg.name,
      simCount: sim,
      naoCount: nao,
      naoSeAplicaCount: na,
      total: baseTotal,
      simPct,
      naoPct,
      naoSeAplicaPct
    };
  });
}

// Calculate auditor participation across tracers
export function calculateAuditorsParticipation(
  patientAudits: any[],
  surgeryAudits: any[],
  handAudits: any[],
  healthUnitsMap: Record<string, string>
): AuditorShareResult[] {
  const auditorMap = new Map<string, AuditorShareResult>();

  const processAudit = (audit: any, type: 't01' | 't02' | 't03') => {
    const raw = audit.rawData || (audit.sourceRowHash ? (typeof audit.sourceRowHash === 'string' ? JSON.parse(audit.sourceRowHash) : audit.sourceRowHash) : {});
    
    let auditorName = audit.auditorName || audit.auditor || raw['06- Nome Completo do Auditor:'] || raw['06- Nome Completo do Auditor'] || raw['Nome Completo do Auditor: '] || raw['Nome Completo do Auditor:'] || raw['04- Nome Completo do Auditor:'] || raw['05- Nome Completo do Auditor:'];
    
    if (!auditorName || auditorName.trim() === '' || auditorName === '-') {
      auditorName = audit.auditorId ? (audit.auditorId.startsWith('AUDITOR_') ? 'Auditor do Sistema' : `Auditor (${audit.auditorId.slice(0, 6)})`) : 'Auditor Não Identificado';
    }

    const key = auditorName.trim().toUpperCase();
    
    let prof = audit.professionalCategory || raw['CATEGORIA PROFISSIONAL'] || raw['CATEGORIA'] || 'Enfermagem';
    if (typeof prof === 'string') {
      const pLow = prof.toLowerCase();
      if (pLow.includes('enf') || pLow.includes('obstet')) prof = 'Enfermeiro(a)';
      else if (pLow.includes('med') || pLow.includes('cirur')) prof = 'Médico(a)';
      else if (pLow.includes('tecn') || pLow.includes('aux')) prof = 'Téc. Enfermagem';
      else if (pLow.includes('fisio')) prof = 'Fisioterapeuta';
      else prof = prof.charAt(0).toUpperCase() + prof.slice(1);
    } else {
      prof = 'Enfermeiro(a)';
    }

    const unitId = audit.unitId || audit.hospitalId || audit.unidadeId || '';
    const unitName = healthUnitsMap[unitId] || unitId || 'Unidade Geral';

    if (!auditorMap.has(key)) {
      auditorMap.set(key, {
        auditorId: audit.auditorId || key,
        auditorName: auditorName.trim(),
        professionalCategory: prof,
        unitName,
        t01Count: 0,
        t02Count: 0,
        t03Count: 0,
        totalCount: 0,
        percentage: 0
      });
    }

    const existing = auditorMap.get(key)!;
    if (type === 't01') existing.t01Count++;
    if (type === 't02') existing.t02Count++;
    if (type === 't03') existing.t03Count++;
    existing.totalCount++;
  };

  patientAudits.forEach(a => processAudit(a, 't01'));
  surgeryAudits.forEach(a => processAudit(a, 't02'));
  handAudits.forEach(a => processAudit(a, 't03'));

  const totalAllAudits = patientAudits.length + surgeryAudits.length + handAudits.length;

  const results = Array.from(auditorMap.values()).map(a => ({
    ...a,
    percentage: totalAllAudits > 0 ? Number(((a.totalCount / totalAllAudits) * 100).toFixed(1)) : 0
  }));

  return results.sort((a, b) => b.totalCount - a.totalCount);
}

const INVALID_SECTOR_VALUES = new Set([
  'nao', 'não', 'sim', 'n/a', 'na', 'null', 'undefined', '-', '--', '---', '.', '..', 'nenhum', 'nenhuma', 'outro', 'outros',
  'não se aplica', 'nao se aplica', 'dispensa', 'dispensado', 'sem indicação', 'sem indicacao', 'conforme', 'inconforme',
  'adequado', 'inadequado', 'true', 'false', '0', '1', 'ok', 'nok', 'se não, justifique', 'se nao, justifique', 'justificativa',
  'se não justifique', 'se nao justifique', 'nao conforme', 'não conforme'
]);

export function isValidSectorValue(val: any): boolean {
  if (!val || typeof val !== 'string') return false;
  const t = val.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!t || t === '-' || t === '--' || t.length < 2) return false;
  if (INVALID_SECTOR_VALUES.has(t)) return false;
  if (t.startsWith('se nao') || t.startsWith('se não') || t.startsWith('justifique') || t.includes('?')) return false;
  return true;
}

// Normalizes sector names with standard casing and accents
export function cleanSectorName(sector: string): string {
  if (!isValidSectorValue(sector)) return 'Setor Não Informado';
  const trimmed = sector.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'n/a') return 'Setor Não Informado';

  const sLower = trimmed.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove accents for matching

  if (INVALID_SECTOR_VALUES.has(sLower) || sLower.startsWith('se nao') || sLower.startsWith('se não') || sLower.startsWith('justifique') || sLower.includes('?')) {
    return 'Setor Não Informado';
  }

  // 1. Sala de Transferência
  if (sLower.includes('transferencia') || sLower.includes('transfer')) {
    return 'Sala de Transferência';
  }

  // 2. RPA (Recuperação Pós-Anestésica)
  if (sLower.includes('rpa') || sLower.includes('pos-anestes') || sLower.includes('pos anestes') || sLower.includes('recuperacao')) {
    return 'Sala de Recuperação Pós-Anestésica (RPA)';
  }

  // 3. Sala de Observação
  if (sLower.includes('observacao') || sLower.includes('obs')) {
    return 'Sala de Observação';
  }

  // 4. Centro Obstétrico / Sala de Parto / Pré-parto / PPP
  if (sLower.includes('parto') || sLower.includes('obstetr') || sLower.includes('pre-parto') || sLower.includes('ppp')) {
    return 'Centro Obstétrico / Sala de Parto';
  }

  // 5. Bloco Cirúrgico / Centro Cirúrgico
  if (sLower.includes('cirurg') || sLower.includes('bloco') || sLower === 'cc' || sLower.includes('centro cirurg')) {
    return 'Bloco Cirúrgico';
  }

  // 6. Maternidade / Alojamento Conjunto
  if (sLower.includes('matern') || sLower.includes('alojamento') || sLower.includes('alcon')) {
    return 'Maternidade / Alojamento Conjunto';
  }

  // 7. UTI Neonatal / UCIN
  if (sLower.includes('neo') || sLower.includes('ucin') || sLower.includes('ucinca')) {
    return 'UTI Neonatal / UCIN';
  }

  // 8. UTI / Terapia Intensiva
  if (sLower.includes('uti') || sLower.includes('cti') || sLower.includes('terapia intensiva')) {
    return 'UTI / Terapia Intensiva';
  }

  // 9. Emergência / Pronto Atendimento / SPA / Acolhimento
  if (sLower.includes('emerg') || sLower.includes('urgenc') || sLower.includes('acolhimento') || sLower.includes('spa') || sLower.includes('pronto atendimento') || sLower === 'pa') {
    return 'Emergência / Pronto Atendimento';
  }

  // 10. Enfermaria Pediátrica / Pediatria
  if (sLower.includes('pediat') || sLower.includes('ped')) {
    return 'Enfermaria Pediátrica';
  }

  // 11. Enfermaria Clínica / Enfermarias
  if (sLower.includes('clinica') || sLower.includes('clinico') || sLower.includes('enfermaria') || sLower.includes('posto') || sLower.includes('internamento')) {
    return 'Enfermaria Clínica';
  }

  // 12. Ambulatório / Consultórios
  if (sLower.includes('ambulator') || sLower.includes('consultorio')) {
    return 'Ambulatório';
  }

  // 13. Default format Title Case
  return trimmed.split(' ').map(w => {
    if (['de', 'da', 'do', 'dos', 'das', 'e', 'em', 'com'].includes(w.toLowerCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

// Universal sector extractor from audit record (checking direct fields and raw spreadsheet entries)
export function extractAuditSector(audit: any): string {
  if (!audit) return 'Setor Não Informado';

  // 1. Direct fields check
  let direct = audit.sector || audit.setor || audit.sectorName || audit.setorAuditado;
  let sector: string | null = null;
  if (isValidSectorValue(direct)) {
    sector = String(direct).trim();
  }

  // 2. Parse from rawData / sourceRowHash
  if (!sector) {
    const raw = audit.rawData || (audit.sourceRowHash ? (typeof audit.sourceRowHash === 'string' ? JSON.parse(audit.sourceRowHash) : audit.sourceRowHash) : null);
    if (raw && typeof raw === 'object') {
      // 1st pass: Exact sector column headers
      for (const [k, v] of Object.entries(raw)) {
        if (!isValidSectorValue(v)) continue;
        const normalizedKey = k.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/^[0-9]+[-\s]+/, '')
          .replace(/:$/, '')
          .trim();

        if (
          normalizedKey === 'setor auditado' ||
          normalizedKey === 'setor' ||
          normalizedKey === 'nome do setor' ||
          normalizedKey === 'setor / enfermaria' ||
          normalizedKey === 'setor ou enfermaria' ||
          normalizedKey === 'setor/enfermaria' ||
          normalizedKey === 'setor/leito' ||
          normalizedKey === 'qual o setor auditado' ||
          normalizedKey === 'qual setor' ||
          normalizedKey === 'setor da auditoria' ||
          normalizedKey === 'local auditado' ||
          normalizedKey === 'local da auditoria' ||
          normalizedKey === 'unidade/setor' ||
          normalizedKey === 'posto / setor' ||
          normalizedKey === 'posto/setor'
        ) {
          sector = (v as string).trim();
          break;
        }
      }

      // 2nd pass: Specific sector-starting keys (excluding question phrases with ?, possui, etc.)
      if (!sector) {
        for (const [k, v] of Object.entries(raw)) {
          if (!isValidSectorValue(v)) continue;
          const normalizedKey = k.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/^[0-9]+[-\s]+/, '')
            .replace(/:$/, '')
            .trim();

          if (
            (normalizedKey.startsWith('setor auditado') || normalizedKey.startsWith('nome do setor') || normalizedKey.startsWith('setor:')) &&
            !normalizedKey.includes('?') &&
            !normalizedKey.includes('responsavel') &&
            !normalizedKey.includes('possui') &&
            !normalizedKey.includes('identifica')
          ) {
            sector = (v as string).trim();
            break;
          }
        }
      }
    }
  }

  if (!sector || !isValidSectorValue(sector)) {
    const tType = audit.type || audit.tracerType || audit.tracerNumber;
    if (tType === 'T02' || tType === '02' || tType === 'tracer_02') {
      return 'Bloco Cirúrgico';
    }
    return 'Setor Não Informado';
  }

  return cleanSectorName(sector);
}

// Calculate Sector Distribution
export function calculateSectorDistribution(
  patientAudits: any[],
  surgeryAudits: any[],
  handAudits: any[]
): SectorShareResult[] {
  const sectorMap = new Map<string, { count: number; t01: number; t02: number; t03: number }>();

  const processAudit = (audit: any, type: 't01' | 't02' | 't03') => {
    const cleanSector = extractAuditSector(audit);
    if (!cleanSector || cleanSector === 'Setor Não Informado') return;

    if (!sectorMap.has(cleanSector)) {
      sectorMap.set(cleanSector, { count: 0, t01: 0, t02: 0, t03: 0 });
    }

    const item = sectorMap.get(cleanSector)!;
    item.count++;
    if (type === 't01') item.t01++;
    if (type === 't02') item.t02++;
    if (type === 't03') item.t03++;
  };

  patientAudits.forEach(a => processAudit(a, 't01'));
  surgeryAudits.forEach(a => processAudit(a, 't02'));
  handAudits.forEach(a => processAudit(a, 't03'));

  let totalMappedAudits = 0;
  sectorMap.forEach(v => { totalMappedAudits += v.count; });

  const results: SectorShareResult[] = Array.from(sectorMap.entries()).map(([sectorName, data]) => ({
    sectorName,
    count: data.count,
    percentage: totalMappedAudits > 0 ? Number(((data.count / totalMappedAudits) * 100).toFixed(1)) : 0,
    t01Count: data.t01,
    t02Count: data.t02,
    t03Count: data.t03
  }));

  return results.sort((a, b) => b.count - a.count);
}
