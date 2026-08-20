import { HEALTH_UNITS } from './utils';

// Helper to create timestamp object mimicking Firestore Timestamp
const makeTimestamp = (dateStr: string) => {
  const d = new Date(dateStr);
  return {
    toDate: () => d,
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0
  };
};

export const FALLBACK_PATIENT_AUDITS = [
  {
    id: 'f_p_1',
    unitId: 'hosp_helena_moura',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '01',
    tracerName: 'Beira Leito',
    type: 'T01',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-15T10:30:00Z'),
    hasWristband: true,
    wristbandLegible: true,
    correctData: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Hospital de Pediatria Helena Moura',
      '03- Data do Tracer:': '15/05/2026',
      '05- Setor Auditado:': 'Enfermaria A',
      '06- Nome Completo do Auditor:': 'Dra. Ana Flávia Silva',
      '07- Nome Completo do Paciente:': 'Carlos Eduardo Menezes',
      '08- Nº do Prontuário do Paciente:': '209384/2026',
      '09- Paciente identificado com pulseira branca?': 'Sim',
      '11- A pulseira de identificação está legível?': 'Sim',
      '13- A pulseira de identificação preenchida adequadamente?': 'Sim',
      '23- No momento da administração da medicação foi conferida a identificação do paciente com a pulseira?': 'Sim'
    }
  },
  {
    id: 'f_p_2',
    unitId: 'hosp_maria_cravo',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '01',
    tracerName: 'Beira Leito',
    type: 'T01',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-14T14:15:00Z'),
    hasWristband: true,
    wristbandLegible: true,
    correctData: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Hospital de Pediatria Maria Cravo Gama',
      '03- Data do Tracer:': '14/05/2026',
      '05- Setor Auditado:': 'Pediatria Clínca',
      '06- Nome Completo do Auditor:': 'Enf. Marcos Barbosa',
      '07- Nome Completo do Paciente:': 'Mariana Lima Santos',
      '08- Nº do Prontuário do Paciente:': '104857/2026',
      '09- Paciente identificado com pulseira branca?': 'Sim',
      '11- A pulseira de identificação está legível?': 'Sim',
      '13- A pulseira de identificação preenchida adequadamente?': 'Sim',
      '23- No momento da administração da medicação foi conferida a identificação do paciente com a pulseira?': 'Sim'
    }
  },
  {
    id: 'f_p_3',
    unitId: 'policlinica_barros_lima',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '01',
    tracerName: 'Beira Leito',
    type: 'T01',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-18T09:00:00Z'),
    hasWristband: true,
    wristbandLegible: false,
    correctData: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Policlínica e Maternidade Prof. Barros Lima',
      '03- Data do Tracer:': '18/05/2026',
      '05- Setor Auditado:': 'Maternidade Ala B',
      '06- Nome Completo do Auditor:': 'Dra. Cláudia Rodrigues',
      '07- Nome Completo do Paciente:': 'Aline Souza Cabral',
      '08- Nº do Prontuário do Paciente:': '884931/2026',
      '09- Paciente identificado com pulseira branca?': 'Sim',
      '11- A pulseira de identificação está legível?': 'Não',
      '12- Se não, justifique:': 'Houve desgaste na impressão da tinta da fita plástica',
      '13- A pulseira de identificação preenchida adequadamente?': 'Sim',
      '23- No momento da administração da medicação foi conferida a identificação do paciente com a pulseira?': 'Sim'
    }
  },
  {
    id: 'f_p_4',
    unitId: 'policlinica_arnaldo_marques',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '01',
    tracerName: 'Beira Leito',
    type: 'T01',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-20T11:45:00Z'),
    hasWristband: true,
    wristbandLegible: true,
    correctData: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Policlínica e Maternidade Arnaldo Marques',
      '03- Data do Tracer:': '20/05/2026',
      '05- Setor Auditado:': 'Posto 2 Obstétrico',
      '06- Nome Completo do Auditor:': 'Enf. Carla Albuquerque',
      '07- Nome Completo do Paciente:': 'Juliana Pereira Lins',
      '08- Nº do Prontuário do Paciente:': '338294/2026',
      '09- Paciente identificado com pulseira branca?': 'Sim',
      '11- A pulseira de identificação está legível?': 'Sim',
      '13- A pulseira de identificação preenchida adequadamente?': 'Sim',
      '23- No momento da administração da medicação foi conferida a identificação do paciente com a pulseira?': 'Sim'
    }
  },
  {
    id: 'f_p_5',
    unitId: 'maternidade_bandeira_filho',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '01',
    tracerName: 'Beira Leito',
    type: 'T01',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-12T16:20:00Z'),
    hasWristband: true,
    wristbandLegible: true,
    correctData: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Maternidade Bandeira Filho',
      '03- Data do Tracer:': '12/05/2026',
      '05- Setor Auditado:': 'Bloco de Parto',
      '06- Nome Completo do Auditor:': 'Dra. Gabriela Vasconcelos',
      '07- Nome Completo do Paciente:': 'Letícia Maria da Silva',
      '08- Nº do Prontuário do Paciente:': '994029/2026',
      '09- Paciente identificado com pulseira branca?': 'Sim',
      '11- A pulseira de identificação está legível?': 'Sim',
      '13- A pulseira de identificação preenchida adequadamente?': 'Sim',
      '23- No momento da administração da medicação foi conferida a identificação do paciente com a pulseira?': 'Sim'
    }
  },
  {
    id: 'f_p_6',
    unitId: 'policlinica_amaury_coutinho',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '01',
    tracerName: 'Beira Leito',
    type: 'T01',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-19T08:30:00Z'),
    hasWristband: false,
    wristbandLegible: false,
    correctData: false,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Policlínica Amaury Coutinho',
      '03- Data do Tracer:': '19/05/2026',
      '05- Setor Auditado:': 'Urgência Clínca',
      '06- Nome Completo do Auditor:': 'Dra. Cláudia Rodrigues',
      '07- Nome Completo do Paciente:': 'Roberta Gouveia Torres',
      '08- Nº do Prontuário do Paciente:': '729485/2026',
      '09- Paciente identificado com pulseira branca?': 'Não',
      '10- Se não, justifique:': 'Paciente admitida em caráter de urgência sem emissão imediata da etiqueta',
      '11- A pulseira de identificação está legível?': 'Não',
      '13- A pulseira de identificação preenchida adequadamente?': 'Não'
    }
  },
  {
    id: 'f_p_7',
    unitId: 'policlinica_agamenon_magalhaes',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '01',
    tracerName: 'Beira Leito',
    type: 'T01',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-22T15:10:00Z'),
    hasWristband: true,
    wristbandLegible: true,
    correctData: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Policlínica Agamenon Magalhães',
      '03- Data do Tracer:': '22/05/2026',
      '05- Setor Auditado:': 'Enfermaria Feminina',
      '06- Nome Completo do Auditor:': 'Dr. Alan Cunha',
      '07- Nome Completo do Paciente:': 'Francisca Severina Gomes',
      '08- Nº do Prontuário do Paciente:': '110294/2026',
      '09- Paciente identificado com pulseira branca?': 'Sim',
      '11- A pulseira de identificação está legível?': 'Sim',
      '13- A pulseira de identificação preenchida adequadamente?': 'Sim'
    }
  },
  {
    id: 'f_p_8',
    unitId: 'hosp_helena_moura',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '01',
    tracerName: 'Beira Leito',
    type: 'T01',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-25T13:40:00Z'),
    hasWristband: true,
    wristbandLegible: true,
    correctData: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Hospital de Pediatria Helena Moura',
      '03- Data do Tracer:': '25/05/2026',
      '05- Setor Auditado:': 'Enfermaria B',
      '06- Nome Completo do Auditor:': 'Dra. Ana Flávia Silva',
      '07- Nome Completo do Paciente:': 'Arthur Miguel Fernandes',
      '08- Nº do Prontuário do Paciente:': '209485/2026',
      '09- Paciente identificado com pulseira branca?': 'Sim',
      '11- A pulseira de identificação está legível?': 'Sim',
      '13- A pulseira de identificação preenchida adequadamente?': 'Sim'
    }
  }
];

export const FALLBACK_SURGERY_AUDITS = [
  {
    id: 'f_s_1',
    unitId: 'policlinica_barros_lima',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '02',
    tracerName: 'Proc. Cirúrgicos',
    type: 'T02',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-10T08:30:00Z'),
    signIIn: true,
    timeOut: true,
    signOut: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Policlínica e Maternidade Prof. Barros Lima',
      '03- Data do Tracer:': '10/05/2026',
      '05- Setor Auditado:': 'Bloco Cirúrgico',
      '06- Nome Completo do Auditor:': 'Dr. Robson Cavalcanti',
      '07- Nome Completo do Paciente:': 'Silvana Ramos Melo',
      '08- Nº do Prontuário do Paciente:': '440294/2026',
      '09- Realizado Sign In (Antes da indução anestésica)?': 'Sim',
      '11- Realizado Time Out (Antes da incisão cirúrgica)?': 'Sim',
      '13- Realizado Sign Out (Antes do paciente sair da sala)?': 'Sim'
    }
  },
  {
    id: 'f_s_2',
    unitId: 'policlinica_arnaldo_marques',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '02',
    tracerName: 'Proc. Cirúrgicos',
    type: 'T02',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-14T10:15:00Z'),
    signIIn: true,
    timeOut: true,
    signOut: false,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Policlínica e Maternidade Arnaldo Marques',
      '03- Data do Tracer:': '14/05/2026',
      '05- Setor Auditado:': 'Bloco Cirúrgico',
      '06- Nome Completo do Auditor:': 'Dr. Marcos de Holanda',
      '07- Nome Completo do Paciente:': 'Verônica Chagas',
      '08- Nº do Prontuário do Paciente:': '112394/2026',
      '09- Realizado Sign In (Antes da indução anestésica)?': 'Sim',
      '11- Realizado Time Out (Antes da incisão cirúrgica)?': 'Sim',
      '13- Realizado Sign Out (Antes do paciente sair da sala)?': 'Não',
      '14- Se não, justifique:': 'Equipe negligenciou leitura de segurança na saída apressada do anestesista'
    }
  },
  {
    id: 'f_s_3',
    unitId: 'maternidade_bandeira_filho',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '02',
    tracerName: 'Proc. Cirúrgicos',
    type: 'T02',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-16T15:40:00Z'),
    signIIn: true,
    timeOut: true,
    signOut: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Maternidade Bandeira Filho',
      '03- Data do Tracer:': '16/05/2026',
      '05- Setor Auditado:': 'Surgical Block obstétrico',
      '06- Nome Completo do Auditor:': 'Dra. Luiza Arruda',
      '07- Nome Completo do Paciente:': 'Beatriz Pinheiro de Melo',
      '08- Nº do Prontuário do Paciente:': '994803/2026',
      '09- Realizado Sign In (Antes da indução anestésica)?': 'Sim',
      '11- Realizado Time Out (Antes da incisão cirúrgica)?': 'Sim',
      '13- Realizado Sign Out (Antes do paciente sair da sala)?': 'Sim'
    }
  },
  {
    id: 'f_s_4',
    unitId: 'policlinica_barros_lima',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '02',
    tracerName: 'Proc. Cirúrgicos',
    type: 'T02',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-22T09:10:00Z'),
    signIIn: true,
    timeOut: true,
    signOut: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Policlínica e Maternidade Prof. Barros Lima',
      '03- Data do Tracer:': '22/05/2026',
      '05- Setor Auditado:': 'Bloco Cirúrgico',
      '06- Nome Completo do Auditor:': 'Dr. Robson Cavalcanti',
      '07- Nome Completo do Paciente:': 'Gisela Maria Santos',
      '08- Nº do Prontuário do Paciente:': '440938/2026',
      '09- Realizado Sign In (Antes da indução anestésica)?': 'Sim',
      '11- Realizado Time Out (Antes da incisão cirúrgica)?': 'Sim',
      '13- Realizado Sign Out (Antes do paciente sair da sala)?': 'Sim'
    }
  }
];

export const FALLBACK_HAND_AUDITS = [
  {
    id: 'f_h_1',
    unitId: 'hosp_helena_moura',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '03',
    tracerName: 'Proc. Medicação',
    type: 'T03',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-11T14:30:00Z'),
    compliant: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Hospital de Pediatria Helena Moura',
      '03- Data do Tracer:': '11/05/2026',
      '05- Setor Auditado:': 'Enfermaria B',
      '06- Nome Completo do Auditor:': 'Dra. Ana Flávia Silva',
      '09- Profissional higienizou as mãos adequadamente?': 'Sim'
    }
  },
  {
    id: 'f_h_2',
    unitId: 'hosp_maria_cravo',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '03',
    tracerName: 'Proc. Medicação',
    type: 'T03',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-13T16:00:00Z'),
    compliant: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Hospital de Pediatria Maria Cravo Gama',
      '03- Data do Tracer:': '13/05/2026',
      '05- Setor Auditado:': 'Lactário Clínico',
      '06- Nome Completo do Auditor:': 'Enf. Marcos Barbosa',
      '09- Profissional higienizou as mãos adequadamente?': 'Sim'
    }
  },
  {
    id: 'f_h_3',
    unitId: 'policlinica_barros_lima',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '03',
    tracerName: 'Proc. Medicação',
    type: 'T03',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-15T09:20:00Z'),
    compliant: false,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Policlínica e Maternidade Prof. Barros Lima',
      '03- Data do Tracer:': '15/05/2026',
      '05- Setor Auditado:': 'Posto de Enfermagem C',
      '06- Nome Completo do Auditor:': 'Dra. Cláudia Rodrigues',
      '09- Profissional higienizou as mãos adequadamente?': 'Não',
      '10- Se não, justifique:': 'Dispensador de álcool em gel estava vazio no momento do preparo da MAV'
    }
  },
  {
    id: 'f_h_4',
    unitId: 'policlinica_arnaldo_marques',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '03',
    tracerName: 'Proc. Medicação',
    type: 'T03',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-17T11:30:00Z'),
    compliant: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Policlínica e Maternidade Arnaldo Marques',
      '03- Data do Tracer:': '17/05/2026',
      '05- Setor Auditado:': 'Maternidade Sala 3',
      '06- Nome Completo do Auditor:': 'Enf. Carla Albuquerque',
      '09- Profissional higienizou as mãos adequadamente?': 'Sim'
    }
  },
  {
    id: 'f_h_5',
    unitId: 'maternidade_bandeira_filho',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '03',
    tracerName: 'Proc. Medicação',
    type: 'T03',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-19T07:45:00Z'),
    compliant: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Maternidade Bandeira Filho',
      '03- Data do Tracer:': '19/05/2026',
      '05- Setor Auditado:': 'UTI Neonatal Sala A',
      '06- Nome Completo do Auditor:': 'Dra. Gabriela Vasconcelos',
      '09- Profissional higienizou as mãos adequadamente?': 'Sim'
    }
  },
  {
    id: 'f_h_6',
    unitId: 'policlinica_amaury_coutinho',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '03',
    tracerName: 'Proc. Medicação',
    type: 'T03',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-20T10:10:00Z'),
    compliant: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Policlínica Amaury Coutinho',
      '03- Data do Tracer:': '20/05/2026',
      '05- Setor Auditado:': 'Ambulatório de Medicação',
      '06- Nome Completo do Auditor:': 'Dra. Cláudia Rodrigues',
      '09- Profissional higienizou as mãos adequadamente?': 'Sim'
    }
  },
  {
    id: 'f_h_7',
    unitId: 'policlinica_agamenon_magalhaes',
    auditorId: 'AUDITOR_SISTEMA_LOCAL',
    tracerNumber: '03',
    tracerName: 'Proc. Medicação',
    type: 'T03',
    externalSource: true,
    competencia: 'mai./2026',
    timestamp: makeTimestamp('2026-05-21T14:40:00Z'),
    compliant: true,
    rawData: {
      '02- Nome do Hospital/Maternidade:': 'Policlínica Agamenon Magalhães',
      '03- Data do Tracer:': '21/05/2026',
      '05- Setor Auditado:': 'Observação Adulto',
      '06- Nome Completo do Auditor:': 'Dr. Alan Cunha',
      '09- Profissional higienizou as mãos adequadamente?': 'Sim'
    }
  }
];

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

// In-memory cache to guarantee full dataset availability regardless of browser localStorage size limits
let inMemoryAudits: LocalAudit[] | null = null;

function sanitizeAuditForStorage(audit: any, compact = false) {
  const clean: any = { ...audit };

  // Remove bulky runtime objects or duplicates
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

  // If in compact mode or external spreadsheet row, omit bulky raw questionnaires if needed
  if (compact && clean.externalSource) {
    delete clean.rawData;
  }

  return clean;
}

export function safeSaveCustomLocalAudits(items: any[]) {
  // 1. Maintain in-memory state with complete objects
  inMemoryAudits = items.map((item: any) => ({
    ...item,
    timestamp: {
      toDate: () => new Date(item.timestampStr || (item.timestamp?.seconds ? item.timestamp.seconds * 1000 : Date.now())),
      seconds: Math.floor(new Date(item.timestampStr || (item.timestamp?.seconds ? item.timestamp.seconds * 1000 : Date.now())).getTime() / 1000),
      nanoseconds: 0
    }
  }));

  // 2. Safely attempt localStorage persistence with graceful tiered compaction
  try {
    const sanitized = items.map(a => sanitizeAuditForStorage(a, false));
    localStorage.setItem('custom_local_audits', JSON.stringify(sanitized));
  } catch (e: any) {
    console.warn('[LocalStorage] Quota exceeded on normal save. Attempting compact storage...');
    try {
      // Tier 1: Compact storage (strip heavy rawData from external synced rows while preserving all analytical fields)
      const compactItems = items.map(a => sanitizeAuditForStorage(a, true));
      localStorage.setItem('custom_local_audits', JSON.stringify(compactItems));
    } catch (err2: any) {
      console.warn('[LocalStorage] Quota still exceeded. Preserving user records and top recent synced records...');
      try {
        // Tier 2: Keep all user-created records and most recent synced records (up to 400)
        const userCreated = items.filter(a => !a.externalSource).map(a => sanitizeAuditForStorage(a, false));
        const synced = items.filter(a => a.externalSource).slice(-400).map(a => sanitizeAuditForStorage(a, true));
        const finalFallback = [...userCreated, ...synced];
        localStorage.setItem('custom_local_audits', JSON.stringify(finalFallback));
      } catch (err3) {
        console.warn('[LocalStorage] Could not write full cache to localStorage. Full data remains live in-memory:', err3);
      }
    }
  }
}

export function getCustomLocalAudits(): LocalAudit[] {
  if (inMemoryAudits && inMemoryAudits.length > 0) {
    return inMemoryAudits;
  }
  try {
    const raw = localStorage.getItem('custom_local_audits');
    if (!raw) return inMemoryAudits || [];
    const parsed = JSON.parse(raw);
    const hydrated = parsed.map((item: any) => ({
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
  } catch (e) {
    console.error('Error saving custom local audit:', e);
  }
}

export function saveCustomLocalAuditsBulk(audits: any[]) {
  try {
    const current = getCustomLocalAudits();
    const map = new Map<string, any>();
    current.forEach((item: any) => {
      map.set(item.id, item);
    });

    audits.forEach((audit) => {
      const withStr = {
        ...audit,
        timestampStr: audit.timestampStr || new Date().toISOString()
      };
      if (withStr.timestamp) {
        delete withStr.timestamp;
      }
      map.set(audit.id, withStr);
    });

    const updated = Array.from(map.values());
    safeSaveCustomLocalAudits(updated);
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
    
    // Also remove from custom_local_audits if present
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
    } else {
      // If it's a fallback audit being updated, we pull the original, merge, and save it to the custom store
      const allFallbacks = [
        ...FALLBACK_PATIENT_AUDITS,
        ...FALLBACK_SURGERY_AUDITS,
        ...FALLBACK_HAND_AUDITS
      ];
      const foundFallback = allFallbacks.find(a => a.id === id);
      if (foundFallback) {
        const item = {
          ...foundFallback,
          ...updatedFields,
          timestampStr: updatedFields.timestampStr || new Date().toISOString()
        };
        if (item.timestamp) {
          delete item.timestamp;
        }
        current.push(item);
        safeSaveCustomLocalAudits(current);
      }
    }
    
    window.dispatchEvent(new Event('local-data-updated'));
  } catch (e) {
    console.error('Error updating audit locally:', e);
  }
}

export function getMergedPatientAudits(): any[] {
  const deletedIds = getDeletedAuditIds();
  const custom = getCustomLocalAudits().filter(a => a.type === 'T01' && !deletedIds.includes(a.id));
  const base = FALLBACK_PATIENT_AUDITS.filter(a => !deletedIds.includes(a.id));
  
  const mergedMap = new Map<string, any>();
  base.forEach(a => mergedMap.set(a.id, a));
  custom.forEach(a => mergedMap.set(a.id, a));
  return Array.from(mergedMap.values());
}

export function getMergedSurgeryAudits(): any[] {
  const deletedIds = getDeletedAuditIds();
  const custom = getCustomLocalAudits().filter(a => a.type === 'T02' && !deletedIds.includes(a.id));
  const base = FALLBACK_SURGERY_AUDITS.filter(a => !deletedIds.includes(a.id));
  
  const mergedMap = new Map<string, any>();
  base.forEach(a => mergedMap.set(a.id, a));
  custom.forEach(a => mergedMap.set(a.id, a));
  return Array.from(mergedMap.values());
}

export function getMergedHandAudits(): any[] {
  const deletedIds = getDeletedAuditIds();
  const custom = getCustomLocalAudits().filter(a => a.type === 'T03' && !deletedIds.includes(a.id));
  const base = FALLBACK_HAND_AUDITS.filter(a => !deletedIds.includes(a.id));
  
  const mergedMap = new Map<string, any>();
  base.forEach(a => mergedMap.set(a.id, a));
  custom.forEach(a => mergedMap.set(a.id, a));
  return Array.from(mergedMap.values());
}

export function replaceSyncedLocalAudits(type: string, tracerId: string, newAudits: any[]) {
  try {
    const current = getCustomLocalAudits();
    
    // Filter out all previous synchronized ones for this type/tracerId
    const preserved = current.filter((item: any) => {
      const isExternal = item.externalSource === true || item.id?.startsWith(`sync_${tracerId}_`);
      const isTargetType = item.type === type;
      return !(isExternal && isTargetType);
    });

    // Format new parsed spreadsheet audits
    const formattedNew = newAudits.map((audit) => {
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
  } catch (e) {
    console.error('Error replacing synced local audits:', e);
  }
}

