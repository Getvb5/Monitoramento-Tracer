import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { HEALTH_UNITS, TRACER_01_UNITS } from '../../lib/utils';
import { Save, ChevronLeft, ChevronRight, AlertCircle, Sparkles, CheckCircle2, ClipboardCheck, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  user: User;
  onComplete: () => void;
  editingAudit?: any;
  isAdmin?: boolean;
  userUnit?: string | null;
}

export default function PatientIdForm({ user, onComplete, editingAudit, isAdmin = true, userUnit = null }: Props) {
  const [unitId, setUnitId] = useState(userUnit || '');
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCurrentTimeStr = () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // State mimicking ALL 43 questions of the PDF
  const [formData, setFormData] = useState({
    // Section 1: Identificação
    q1_hospital: '',
    q2_data: getTodayDateStr(),
    q3_horario: getCurrentTimeStr(),
    q4_setor: '',
    q5_auditor: user.displayName || '',
    q6_paciente: '',
    q7_prontuario: '',

    // Section 2: Plano Terapêutico e Pulseiras
    q8_compreende_plano: '',
    q9_compreende_plano_justificativa: '',
    q10_pulseira_branca: '',
    q11_pulseira_branca_justificativa: '',
    q12_pulseira_legivel: '',
    q13_pulseira_legivel_justificativa: '',
    q14_pulseira_preenchida: '',
    q15_pulseira_preenchida_justificativa: '',
    q16_alergia: '',
    q17_alergia_sinalizada: '',
    q18_alergia_justificativa: '',

    // Section 3: Identificação do Leito e Dietas
    q19_placa_leito: '',
    q20_placa_leito_justificativa: '',
    q21_placa_preenchida: '',
    q22_placa_preenchida_justificativa: '',
    q23_placa_riscos: '',
    q24_placa_riscos_justificativa: '',
    q25_rotulos_dieta: '',
    q26_rotulos_dieta_justificativa: '',
    q27_rotulo_medicamento: '',

    // Section 4: Higienização e Acessos
    q28_higienizacao_maos: '',
    q29_higienizacao_maos_justificativa: '',
    q30_acesso_venoso: '',
    q31_acesso_venoso_justificativa: '',
    q32_curativo_ferida: '',
    q33_curativo_ferida_justificativa: '',

    // Section 5: Decúbito, Quedas, Passagem de Plantão e Transferências
    q34_decubito_correto: '',
    q35_decubito_correto_justificativa: '',
    q36_orientacao_lesao: '',
    q37_grades_elevadas: '',
    q38_grades_elevadas_justificativa: '',
    q39_orientacao_queda: '',
    q40_passagem_plantao: '',
    q41_passagem_plantao_justificativa: '',
    q42_SBAR: '',
    q43_SBAR_justificativa: '',
  });

  useEffect(() => {
    if (editingAudit) {
      let rData: Record<string, string> = editingAudit.rawData || {};
      if (!editingAudit.rawData && editingAudit.sourceRowHash) {
        try {
          rData = JSON.parse(editingAudit.sourceRowHash);
        } catch (e) {
          console.error("Failed to parse sourceRowHash in form", e);
        }
      }
      
      setUnitId(editingAudit.unitId || '');
      setFormData({
        q1_hospital: rData['02- Nome do Hospital/Maternidade:'] || '',
        q2_data: rData['03- Data do Tracer:'] || getTodayDateStr(),
        q3_horario: rData['04- Horário do Início do Tracer:'] || rData['03- Data do Tracer:'] || getCurrentTimeStr(),
        q4_setor: rData['05- Setor Auditado:'] || '',
        q5_auditor: rData['06- Nome Completo do Auditor:'] || user.displayName || '',
        q6_paciente: rData['07- Nome do paciente:'] || rData['07- Nome Completo do Paciente:'] || '',
        q7_prontuario: rData['08- Nº do Prontuário do Paciente:'] || '',
        q8_compreende_plano: rData['09- Paciente ou responsável compreende o plano terapêutico?'] || '',
        q9_compreende_plano_justificativa: rData['09- Se não, justifique:'] || rData['09- Se não, justifique: '] || '',
        q10_pulseira_branca: rData['10- Paciente identificado com pulseira branca?'] || '',
        q11_pulseira_branca_justificativa: rData['11- Se não, justifique:'] || rData['11- Se não, justifique: '] || '',
        q12_pulseira_legivel: rData['12- A pulseira de identificação está legível?'] || '',
        q13_pulseira_legivel_justificativa: rData['13- Se não, justifique:'] || rData['13- Se não, justifique: '] || '',
        q14_pulseira_preenchida: rData['14- A pulseira de identificação preenchida adequadamente?'] || '',
        q15_pulseira_preenchida_justificativa: rData['15- Se não, justifique:'] || rData['15- Se não, justifique: '] || '',
        q16_alergia: rData['16- O paciente tem alergia alimentar/medicamentosa?'] || '',
        q17_alergia_sinalizada: rData['17- Se tem alergia, está sinalizado com pulseira específica (Cor Rosa)?'] || '',
        q18_alergia_justificativa: rData['18- Se não, justifique:'] || rData['18- Se não, justifique: '] || '',
        q19_placa_leito: rData['19- Placa de identificação do leito afixada?'] || '',
        q20_placa_leito_justificativa: rData['20- Se não, justifique:'] || rData['20- Se não, justifique: '] || '',
        q21_placa_preenchida: rData['21- Placa de identificação preenchida adequadamente?'] || '',
        q22_placa_preenchida_justificativa: rData['22- Se não, justifique:'] || rData['22- Se não, justifique: '] || '',
        q23_placa_riscos: rData['23- Placa de identificação do leito com os riscos sinalizados?'] || '',
        q24_placa_riscos_justificativa: rData['24- Se não, justifique:'] || rData['24- Se não, justifique: '] || '',
        q25_rotulos_dieta: rData['25- Os rótulos da dieta estão com todos os identificadores obrigatórios?'] || '',
        q26_rotulos_dieta_justificativa: rData['26- Se não, justifique:'] || rData['26- Se não, justifique: '] || '',
        q27_rotulo_medicamento: rData['27- O rótulo de medicamentos está com todos os identificadores obrigatórios?'] || '',
        q28_higienizacao_maos: rData['28- A higienização das mãos foi realizada?'] || '',
        q29_higienizacao_maos_justificativa: rData['29- Se não, justifique:'] || rData['29- Se não, justifique: '] || '',
        q30_acesso_venoso: rData['30- Acesso venoso foi identificado adequadamente (Nº do jelco/Data da punção/Nome do profissional)?'] || '',
        q31_acesso_venoso_justificativa: rData['31- Se não, justifique:'] || rData['31- Se não, justifique: '] || '',
        q32_curativo_ferida: rData['32- Curativo da ferida identificado, válido e íntegro? (Cirurgias, Lesões, Drenos..)'] || '',
        q33_curativo_ferida_justificativa: rData['33- Se não, justifique:'] || rData['33- Se não, justifique: '] || '',
        q34_decubito_correto: rData['34- Paciente está no decúbito correto de acordo com o relógio da pele no momento da visita?'] || '',
        q35_decubito_correto_justificativa: rData['35- Se não, justifique:'] || rData['35- Se não, justifique: '] || '',
        q36_orientacao_lesao: rData['36- Paciente recebeu orientação de prevenção de lesão por pressão?'] || '',
        q37_grades_elevadas: rData['37- Grades do leito elevadas?'] || '',
        q38_grades_elevadas_justificativa: rData['38- Se não, justifique:'] || rData['38- Se não, justifique: '] || '',
        q39_orientacao_queda: rData['39- O paciente recebeu orientação sobre as medidas de prevenção de queda?'] || '',
        q40_passagem_plantao: rData['40- Passagem de plantão da enfermagem com formulário padrão preenchido?'] || '',
        q41_passagem_plantao_justificativa: rData['41- Se não, justifique:'] || rData['41- Se não, justifique: '] || '',
        q42_SBAR: rData['42- Em caso de transferência (interna/externa) o formulário de transferência/SBAR preenchido adequadamente?'] || '',
        q43_SBAR_justificativa: rData['43- Se não, justifique:'] || rData['43- Se não, justifique: '] || '',
      });
    } else {
      const effectiveUnit = !isAdmin && userUnit ? userUnit : null;
      if (effectiveUnit) {
        setUnitId(effectiveUnit);
        const found = HEALTH_UNITS.find(u => u.id === effectiveUnit);
        setFormData(prev => ({
          ...prev,
          q1_hospital: found ? found.name : ''
        }));
      }

      const savedProfileStr = localStorage.getItem(`auditor_profile_${user.uid}`);
      if (savedProfileStr) {
        try {
          const profile = JSON.parse(savedProfileStr);
          if (profile.defaultUnitId && !effectiveUnit) {
            setUnitId(profile.defaultUnitId);
            const found = HEALTH_UNITS.find(u => u.id === profile.defaultUnitId);
            setFormData(prev => ({
              ...prev,
              q1_hospital: found ? found.name : '',
              q5_auditor: profile.name || prev.q5_auditor
            }));
          } else if (profile.name) {
            setFormData(prev => ({
              ...prev,
              q5_auditor: profile.name || prev.q5_auditor
            }));
          }
        } catch (e) {
          console.error('Error parsing auditor profile for form:', e);
        }
      }
    }
  }, [user.uid, editingAudit, isAdmin, userUnit]);

  const filteredUnits = HEALTH_UNITS.filter(u => TRACER_01_UNITS.includes(u.id));

  const handleUnitSelect = (val: string) => {
    setUnitId(val);
    const found = HEALTH_UNITS.find(u => u.id === val);
    setFormData(prev => ({
      ...prev,
      q1_hospital: found ? found.name : ''
    }));
  };

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      
      // Clear secondary conditional question fields if parent choice changes
      if (field === 'q8_compreende_plano' && value === 'Sim') next.q9_compreende_plano_justificativa = '';
      if (field === 'q10_pulseira_branca' && value === 'Sim') next.q11_pulseira_branca_justificativa = '';
      if (field === 'q12_pulseira_legivel' && value === 'Sim') next.q13_pulseira_legivel_justificativa = '';
      if (field === 'q14_pulseira_preenchida' && value === 'Sim') next.q15_pulseira_preenchida_justificativa = '';
      if (field === 'q16_alergia' && value === 'Não') {
        next.q17_alergia_sinalizada = '';
        next.q18_alergia_justificativa = '';
      }
      if (field === 'q17_alergia_sinalizada' && value !== 'Não') next.q18_alergia_justificativa = '';
      if (field === 'q19_placa_leito' && value === 'Sim') next.q20_placa_leito_justificativa = '';
      if (field === 'q21_placa_preenchida' && value === 'Sim') next.q22_placa_preenchida_justificativa = '';
      if (field === 'q23_placa_riscos' && value === 'Sim') next.q24_placa_riscos_justificativa = '';
      if (field === 'q25_rotulos_dieta' && value !== 'Não') next.q26_rotulos_dieta_justificativa = '';
      if (field === 'q28_higienizacao_maos' && value !== 'Não') next.q29_higienizacao_maos_justificativa = '';
      if (field === 'q30_acesso_venoso' && value !== 'Não') next.q31_acesso_venoso_justificativa = '';
      if (field === 'q32_curativo_ferida' && value !== 'Não') next.q33_curativo_ferida_justificativa = '';
      if (field === 'q34_decubito_correto' && value !== 'Não') next.q35_decubito_correto_justificativa = '';
      if (field === 'q37_grades_elevadas' && value !== 'Não') next.q38_grades_elevadas_justificativa = '';
      if (field === 'q40_passagem_plantao' && value === 'Sim') next.q41_passagem_plantao_justificativa = '';
      if (field === 'q42_SBAR' && value !== 'Não') next.q43_SBAR_justificativa = '';

      return next;
    });
  };

  // Step names
  const steps = [
    { id: 1, title: 'Identificação' },
    { id: 2, title: 'Pulseiras' },
    { id: 3, title: 'Leito & Dieta' },
    { id: 4, title: 'Procedimentos' },
    { id: 5, title: 'Segurança & Quedas' }
  ];

  const validateStep = (step: number): string | null => {
    if (step === 1) {
      if (!unitId) return 'Por favor, selecione a unidade de saúde.';
      if (!formData.q2_data) return 'Preencha a data do Tracer.';
      if (!formData.q3_horario) return 'Preencha o horário de início do Tracer.';
      if (!formData.q4_setor.trim()) return 'Preencha o setor auditado.';
      if (!formData.q5_auditor.trim()) return 'Preencha o nome completo do auditor.';
      if (!formData.q6_paciente.trim()) return 'Preencha o nome completo do paciente.';
      if (!formData.q7_prontuario.trim()) return 'Preencha o número do prontuário do paciente.';
    }
    if (step === 2) {
      if (!formData.q8_compreende_plano) return 'Responda se o paciente compreende o plano terapêutico.';
      if (formData.q8_compreende_plano === 'Não' && !formData.q9_compreende_plano_justificativa.trim()) return 'Preencha a justificativa do plano terapêutico.';
      if (!formData.q10_pulseira_branca) return 'Responda se o paciente está identificado com pulseira branca.';
      if (formData.q10_pulseira_branca === 'Não' && !formData.q11_pulseira_branca_justificativa.trim()) return 'Preencha a justificativa da pulseira branca.';
      if (!formData.q12_pulseira_legivel) return 'Responda se a pulseira de identificação está legível.';
      if (formData.q12_pulseira_legivel === 'Não' && !formData.q13_pulseira_legivel_justificativa.trim()) return 'Preencha a justificativa da legibilidade.';
      if (!formData.q14_pulseira_preenchida) return 'Responda se a pulseira está preenchida adequadamente.';
      if (formData.q14_pulseira_preenchida === 'Não' && !formData.q15_pulseira_preenchida_justificativa.trim()) return 'Preencha a justificativa do preenchimento da pulseira.';
      if (!formData.q16_alergia) return 'Responda se o paciente tem alguma alergia alimentar ou medicamentosa.';
      if (formData.q16_alergia === 'Sim') {
        if (!formData.q17_alergia_sinalizada) return 'Responda se a alergia está sinalizada com a pulseira específica rosa.';
        if (formData.q17_alergia_sinalizada === 'Não' && !formData.q18_alergia_justificativa.trim()) return 'Preencha a justificativa da cor de indicação de alergia.';
      }
    }
    if (step === 3) {
      if (!formData.q19_placa_leito) return 'Responda se a placa de identificação do leito está afixada.';
      if (formData.q19_placa_leito === 'Não' && !formData.q20_placa_leito_justificativa.trim()) return 'Preencha a justificativa da placa do leito.';
      if (!formData.q21_placa_preenchida) return 'Responda se a placa de identificação está preenchida adequadamente.';
      if (formData.q21_placa_preenchida === 'Não' && !formData.q22_placa_preenchida_justificativa.trim()) return 'Preencha a justificativa da placa preenchida.';
      if (!formData.q23_placa_riscos) return 'Responda se a placa possui riscos sinalizados.';
      if (formData.q23_placa_riscos === 'Não' && !formData.q24_placa_riscos_justificativa.trim()) return 'Preencha a justificativa da placa sem riscos.';
      if (!formData.q25_rotulos_dieta) return 'Responda se os rótulos de dieta contêm os identificadores obrigatórios.';
      if (formData.q25_rotulos_dieta === 'Não' && !formData.q26_rotulos_dieta_justificativa.trim()) return 'Preencha a justificativa do rótulo da dieta.';
      if (!formData.q27_rotulo_medicamento) return 'Responda se o rótulo de medicamentos está completo.';
    }
    if (step === 4) {
      if (!formData.q28_higienizacao_maos) return 'Responda se houve a higienização das mãos.';
      if (formData.q28_higienizacao_maos === 'Não' && !formData.q29_higienizacao_maos_justificativa.trim()) return 'Preencha a justificativa da higienização das mãos.';
      if (!formData.q30_acesso_venoso) return 'Responda se o acesso venoso está identificado adequadamente.';
      if (formData.q30_acesso_venoso === 'Não' && !formData.q31_acesso_venoso_justificativa.trim()) return 'Preencha a justificativa da identificação de punção.';
      if (!formData.q32_curativo_ferida) return 'Responda sobre a integridade e identificação do curativo de ferida.';
      if (formData.q32_curativo_ferida === 'Não' && !formData.q33_curativo_ferida_justificativa.trim()) return 'Preencha a justificativa sobre o curativo da ferida.';
    }
    if (step === 5) {
      if (!formData.q34_decubito_correto) return 'Responda sobre o decúbito de acordo com o relógio de pele.';
      if (formData.q34_decubito_correto === 'Não' && !formData.q35_decubito_correto_justificativa.trim()) return 'Preencha a justificativa do decúbito.';
      if (!formData.q36_orientacao_lesao) return 'Responda se o paciente recebeu orientação de prevenção de LPP.';
      if (!formData.q37_grades_elevadas) return 'Responda se as grades do leito estão elevadas.';
      if (formData.q37_grades_elevadas === 'Não' && !formData.q38_grades_elevadas_justificativa.trim()) return 'Preencha a justificativa das grades do leito.';
      if (!formData.q39_orientacao_queda) return 'Responda se o paciente recebeu orientação sobre prevenção de quedas.';
      if (!formData.q40_passagem_plantao) return 'Responda sobre a passagem de plantão com formulário padrão preenchido.';
      if (formData.q40_passagem_plantao === 'Não' && !formData.q41_passagem_plantao_justificativa.trim()) return 'Preencha a justificativa da passagem de plantão.';
      if (!formData.q42_SBAR) return 'Responda se o formulário SBAR foi preenchido na transferência.';
      if (formData.q42_SBAR === 'Não' && !formData.q43_SBAR_justificativa.trim()) return 'Preencha a justificativa sobre o formulário SBAR.';
    }
    return null;
  };

  const handleNext = () => {
    const validationError = validateStep(currentStep);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setCurrentStep(prev => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setError('');
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const validationError = validateStep(5);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');

    // Construct rawData EXACTLY as it appears in Google Forms matching PDF
    const unitName = HEALTH_UNITS.find(u => u.id === unitId)?.name || '';
    const rawData: Record<string, string> = {
      '02- Nome do Hospital/Maternidade:': unitName,
      '03- Data do Tracer:': formData.q2_data,
      '04- Horário do Início do Tracer:': formData.q3_horario,
      '05- Setor Auditado:': formData.q4_setor,
      '06- Nome Completo do Auditor:': formData.q5_auditor,
      '07- Nome do paciente:': formData.q6_paciente,
      '08- Nº do Prontuário do Paciente:': formData.q7_prontuario,
      '09- Paciente ou responsável compreende o plano terapêutico?': formData.q8_compreende_plano,
      ...(formData.q8_compreende_plano === 'Não' && { '09- Se não, justifique:': formData.q9_compreende_plano_justificativa }),
      '10- Paciente identificado com pulseira branca?': formData.q10_pulseira_branca,
      ...(formData.q10_pulseira_branca === 'Não' && { '11- Se não, justifique:': formData.q11_pulseira_branca_justificativa }),
      '12- A pulseira de identificação está legível?': formData.q12_pulseira_legivel,
      ...(formData.q12_pulseira_legivel === 'Não' && { '13- Se não, justifique:': formData.q13_pulseira_legivel_justificativa }),
      '14- A pulseira de identificação preenchida adequadamente?': formData.q14_pulseira_preenchida,
      ...(formData.q14_pulseira_preenchida === 'Não' && { '15- Se não, justifique:': formData.q15_pulseira_preenchida_justificativa }),
      '16- O paciente tem alergia alimentar/medicamentosa?': formData.q16_alergia,
      ...(formData.q16_alergia === 'Sim' && { '17- Se tem alergia, está sinalizado com pulseira específica (Cor Rosa)?': formData.q17_alergia_sinalizada }),
      ...(formData.q17_alergia_sinalizada === 'Não' && { '18- Se não, justifique:': formData.q18_alergia_justificativa }),
      '19- Placa de identificação do leito afixada?': formData.q19_placa_leito,
      ...(formData.q19_placa_leito === 'Não' && { '20- Se não, justifique:': formData.q20_placa_leito_justificativa }),
      '21- Placa de identificação preenchida adequadamente?': formData.q21_placa_preenchida,
      ...(formData.q21_placa_preenchida === 'Não' && { '22- Se não, justifique:': formData.q22_placa_preenchida_justificativa }),
      '23- Placa de identificação do leito com os riscos sinalizados?': formData.q23_placa_riscos,
      ...(formData.q23_placa_riscos === 'Não' && { '24- Se não, justifique:': formData.q24_placa_riscos_justificativa }),
      '25- Os rótulos da dieta estão com todos os identificadores obrigatórios?': formData.q25_rotulos_dieta,
      ...(formData.q25_rotulos_dieta === 'Não' && { '26- Se não, justifique:': formData.q26_rotulos_dieta_justificativa }),
      '27- O rótulo de medicamentos está com todos os identificadores obrigatórios?': formData.q27_rotulo_medicamento,
      '28- A higienização das mãos foi realizada?': formData.q28_higienizacao_maos,
      ...(formData.q28_higienizacao_maos === 'Não' && { '29- Se não, justifique:': formData.q29_higienizacao_maos_justificativa }),
      '30- Acesso venoso foi identificado adequadamente (Nº do jelco/Data da punção/Nome do profissional)?': formData.q30_acesso_venoso,
      ...(formData.q30_acesso_venoso === 'Não' && { '31- Se não, justifique:': formData.q31_acesso_venoso_justificativa }),
      '32- Curativo da ferida identificado, válido e íntegro? (Cirurgias, Lesões, Drenos..)': formData.q32_curativo_ferida,
      ...(formData.q32_curativo_ferida === 'Não' && { '33- Se não, justifique:': formData.q33_curativo_ferida_justificativa }),
      '34- Paciente está no decúbito correto de acordo com o relógio da pele no momento da visita?': formData.q34_decubito_correto,
      ...(formData.q34_decubito_correto === 'Não' && { '35- Se não, justifique:': formData.q35_decubito_correto_justificativa }),
      '36- Paciente recebeu orientação de prevenção de lesão por pressão?': formData.q36_orientacao_lesao,
      '37- Grades do leito elevadas?': formData.q37_grades_elevadas,
      ...(formData.q37_grades_elevadas === 'Não' && { '38- Se não, justifique:': formData.q38_grades_elevadas_justificativa }),
      '39- O paciente recebeu orientação sobre as medidas de prevenção de queda?': formData.q39_orientacao_queda,
      '40- Passagem de plantão da enfermagem com formulário padrão preenchido?': formData.q40_passagem_plantao,
      ...(formData.q40_passagem_plantao === 'Não' && { '41- Se não, justifique:': formData.q41_passagem_plantao_justificativa }),
      '42- Em caso de transferência (interna/externa) o formulário de transferência/SBAR preenchido adequadamente?': formData.q42_SBAR,
      ...(formData.q42_SBAR === 'Não' && { '43- Se não, justifique:': formData.q43_SBAR_justificativa })
    };

    // Calculate legacy boolean scores for summary charts alignment
    const scorePayload = {
      hasWristband: formData.q10_pulseira_branca === 'Sim',
      wristbandLegible: formData.q12_pulseira_legivel === 'Sim',
      correctData: formData.q14_pulseira_preenchida === 'Sim',
    };

    try {
      const activeDocId = editingAudit?.id || ('aud_p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8));

      // 1. Immediately persist locally (instantaneous - zero lag)
      try {
        const { saveCustomLocalAudit } = await import('../../lib/fallbackData');
        saveCustomLocalAudit({
          id: activeDocId,
          unitId,
          auditorId: user.uid,
          tracerNumber: '01',
          tracerName: 'Beira Leito',
          type: 'T01',
          ...scorePayload,
          rawData,
          sourceRowHash: JSON.stringify(rawData),
          timestampStr: editingAudit?.timestampStr || new Date().toISOString(),
          competencia: editingAudit?.competencia || 'mai./2026'
        });
      } catch (saveLocalErr) {
        console.error("Local shadow save failed", saveLocalErr);
      }

      // 2. Synchronize to Firestore in non-blocking / fast-timeout manner
      const syncToFirestore = async () => {
        if (localStorage.getItem('firestore_quota_exceeded') === 'true') return;
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          await setDoc(doc(db, 'audits_patient_id', activeDocId), {
            unitId,
            auditorId: user.uid,
            ...scorePayload,
            rawData,
            sourceRowHash: JSON.stringify(rawData),
            tracerNumber: '01',
            tracerName: 'Beira Leito',
            timestamp: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (err: any) {
          console.warn('[PatientIdForm] Firestore save notice:', err?.message || err);
          if (err?.message && (err.message.includes('Quota') || err.message.includes('resource-exhausted'))) {
            localStorage.setItem('firestore_quota_exceeded', 'true');
            window.dispatchEvent(new Event('firestore-quota-exceeded'));
          }
        }
      };

      // Ensure user doesn't wait more than 600ms even on slow network
      await Promise.race([
        syncToFirestore(),
        new Promise(resolve => setTimeout(resolve, 600))
      ]);

      onComplete();
    } catch (err: any) {
      console.error('Error in save:', err);
      onComplete();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Stepper Header in style of Tracer 03 */}
      <header className="mb-8 p-6 bg-white border-l-4 border-red-600 shadow-sm rounded-r-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
            <ClipboardCheck className="w-5 h-5 text-red-600" />
            Tracer 01 • Coleta Beira Leito
          </h1>
          <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider leading-relaxed">
            Segurança & Qualidade Hospitalar
          </p>
        </div>
        <div className="flex items-center gap-1 bg-red-50 border border-red-100/50 px-3 py-1 text-[9px] text-red-700 font-extrabold uppercase tracking-widest rounded-full shrink-0 h-fit self-start">
          <Sparkles className="w-3.5 h-3.5" />
          Passo {currentStep} de 5
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 w-full bg-slate-100 rounded-full mb-8 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-red-500 to-rose-600 transition-all duration-300"
          style={{ width: `${(currentStep / 5) * 100}%` }}
        />
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Navigation Sidebar Drawer */}
        <div className="w-full md:w-56 shrink-0 space-y-1">
          {steps.map((s) => (
            <button
              key={s.id}
              disabled={submitting}
              onClick={() => {
                if (s.id < currentStep) setCurrentStep(s.id);
                else if (s.id > currentStep) {
                  let canGo = true;
                  for (let check = currentStep; check < s.id; check++) {
                    const validationErr = validateStep(check);
                    if (validationErr) {
                      setError(validationErr);
                      canGo = false;
                      break;
                    }
                  }
                  if (canGo) {
                    setError('');
                    setCurrentStep(s.id);
                  }
                }
              }}
              className={`w-full flex items-center justify-between p-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                s.id === currentStep
                  ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-100'
                  : s.id < currentStep
                  ? 'bg-white border-emerald-100 text-emerald-600 hover:bg-emerald-50/50'
                  : 'bg-white border-slate-100 text-slate-400 opacity-60'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${
                  s.id === currentStep 
                    ? 'bg-white text-red-600' 
                    : s.id < currentStep 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {s.id < currentStep ? '✓' : s.id}
                </span>
                {s.title}
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            </button>
          ))}
        </div>

        {/* Main Panel Form */}
        <form onSubmit={handleSubmit} className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[460px] flex flex-col justify-between p-6 sm:p-8 space-y-6">
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* STEP 1: IDENTIFICATION */}
                {currentStep === 1 && (
                  <div className="space-y-5">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="font-black text-xs text-slate-800 uppercase tracking-widest">Informações de Identificação (Q1 - Q7)</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Defina a unidade operacional e preencha as referências de prontuário.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                          01. Nome do Hospital/Maternidade * {!isAdmin && userUnit && <span className="text-blue-600 font-black">(Vinculado ao seu perfil)</span>}
                        </label>
                        <select
                          value={unitId}
                          onChange={(e) => handleUnitSelect(e.target.value)}
                          disabled={!isAdmin && !!userUnit}
                          className={`w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-md outline-none text-slate-800 transition-all ${!isAdmin && userUnit ? 'bg-slate-100 cursor-not-allowed opacity-90 text-blue-900 font-black' : 'focus:ring-2 focus:ring-blue-500'}`}
                        >
                          <option value="">Selecione a unidade...</option>
                          {filteredUnits.filter(u => isAdmin || !userUnit || u.id === userUnit).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">02. Data do Tracer *</label>
                        <input
                          type="date"
                          value={formData.q2_data}
                          onChange={(e) => handleFieldChange('q2_data', e.target.value)}
                          className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">03. Horário do Início *</label>
                        <input
                          type="time"
                          value={formData.q3_horario}
                          onChange={(e) => handleFieldChange('q3_horario', e.target.value)}
                          className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">04. Setor Auditado *</label>
                        <input
                          type="text"
                          placeholder="Ex: UTI Neonatal, Enfermaria B"
                          value={formData.q4_setor}
                          onChange={(e) => handleFieldChange('q4_setor', e.target.value)}
                          className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                        />
                      </div>

                      <div className="col-span-1 md:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">05. Nome Completo do Auditor *</label>
                        <input
                          type="text"
                          placeholder="Nome do profissional coletor"
                          value={formData.q5_auditor}
                          onChange={(e) => handleFieldChange('q5_auditor', e.target.value)}
                          className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">06. Nome do paciente *</label>
                        <input
                          type="text"
                          placeholder="Nome do paciente"
                          value={formData.q6_paciente}
                          onChange={(e) => handleFieldChange('q6_paciente', e.target.value)}
                          className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">07. Nº do Prontuário do Paciente *</label>
                        <input
                          type="text"
                          placeholder="Identificador ou Código"
                          value={formData.q7_prontuario}
                          onChange={(e) => handleFieldChange('q7_prontuario', e.target.value)}
                          className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: PATIENT UNDERSTANDING & WRISTBANDS */}
                {currentStep === 2 && (
                  <div className="space-y-5">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="font-black text-xs text-slate-800 uppercase tracking-widest">Plano Terapêutico e Pulseiras de Identificação (Q8 - Q18)</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Audite a pulseira operacional e segurança de alergias.</p>
                    </div>

                    <div className="space-y-4">
                      <ChoiceRow
                        index="08"
                        label="Paciente ou responsável compreende o plano terapêutico?"
                        value={formData.q8_compreende_plano}
                        options={['Sim', 'Não']}
                        onChange={(val) => handleFieldChange('q8_compreende_plano', val)}
                      />
                      {formData.q8_compreende_plano === 'Não' && (
                        <TextJustifyField
                          index="09"
                          value={formData.q9_compreende_plano_justificativa}
                          onChange={(val) => handleFieldChange('q9_compreende_plano_justificativa', val)}
                        />
                      )}

                      <ChoiceRow
                        index="10"
                        label="Paciente identificado com pulseira branca?"
                        value={formData.q10_pulseira_branca}
                        options={['Sim', 'Não']}
                        onChange={(val) => handleFieldChange('q10_pulseira_branca', val)}
                      />
                      {formData.q10_pulseira_branca === 'Não' && (
                        <TextJustifyField
                          index="11"
                          value={formData.q11_pulseira_branca_justificativa}
                          onChange={(val) => handleFieldChange('q11_pulseira_branca_justificativa', val)}
                        />
                      )}

                      <ChoiceRow
                        index="12"
                        label="A pulseira de identificação está legível?"
                        value={formData.q12_pulseira_legivel}
                        options={['Sim', 'Não']}
                        onChange={(val) => handleFieldChange('q12_pulseira_legivel', val)}
                      />
                      {formData.q12_pulseira_legivel === 'Não' && (
                        <TextJustifyField
                          index="13"
                          value={formData.q13_pulseira_legivel_justificativa}
                          onChange={(val) => handleFieldChange('q13_pulseira_legivel_justificativa', val)}
                        />
                      )}

                      <ChoiceRow
                        index="14"
                        label="A pulseira de identificação preenchida adequadamente?"
                        value={formData.q14_pulseira_preenchida}
                        options={['Sim', 'Não']}
                        onChange={(val) => handleFieldChange('q14_pulseira_preenchida', val)}
                      />
                      {formData.q14_pulseira_preenchida === 'Não' && (
                        <TextJustifyField
                          index="15"
                          value={formData.q15_pulseira_preenchida_justificativa}
                          onChange={(val) => handleFieldChange('q15_pulseira_preenchida_justificativa', val)}
                        />
                      )}

                      <ChoiceRow
                        index="16"
                        label="O paciente tem alergia alimentar/medicamentosa?"
                        value={formData.q16_alergia}
                        options={['Sim', 'Não']}
                        onChange={(val) => handleFieldChange('q16_alergia', val)}
                      />

                      {formData.q16_alergia === 'Sim' && (
                        <div className="pl-4 border-l-2 border-red-200 space-y-4">
                          <ChoiceRow
                            index="17"
                            label="Se tem alergia, está sinalizado com pulseira específica (Cor Rosa)?"
                            value={formData.q17_alergia_sinalizada}
                            options={['Sim', 'Não', 'Não se aplica']}
                            onChange={(val) => handleFieldChange('q17_alergia_sinalizada', val)}
                          />
                          {formData.q17_alergia_sinalizada === 'Não' && (
                            <TextJustifyField
                              index="18"
                              value={formData.q18_alergia_justificativa}
                              onChange={(val) => handleFieldChange('q18_alergia_justificativa', val)}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 3: BEDPLATE SIGNS & DIETS */}
                {currentStep === 3 && (
                  <div className="space-y-5">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="font-black text-xs text-slate-800 uppercase tracking-widest">Identificação do Leito e Dieta (Q19 - Q27)</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Confira as placas visuais, riscos biológicos e dietas estruturadas.</p>
                    </div>

                    <div className="space-y-4">
                      <ChoiceRow
                        index="19"
                        label="Placa de identificação do leito afixada?"
                        value={formData.q19_placa_leito}
                        options={['Sim', 'Não']}
                        onChange={(val) => handleFieldChange('q19_placa_leito', val)}
                      />
                      {formData.q19_placa_leito === 'Não' && (
                        <TextJustifyField
                          index="20"
                          value={formData.q20_placa_leito_justificativa}
                          onChange={(val) => handleFieldChange('q20_placa_leito_justificativa', val)}
                        />
                      )}

                      <ChoiceRow
                        index="21"
                        label="Placa de identificação preenchida adequadamente?"
                        value={formData.q21_placa_preenchida}
                        options={['Sim', 'Não']}
                        onChange={(val) => handleFieldChange('q21_placa_preenchida', val)}
                      />
                      {formData.q21_placa_preenchida === 'Não' && (
                        <TextJustifyField
                          index="22"
                          value={formData.q22_placa_preenchida_justificativa}
                          onChange={(val) => handleFieldChange('q22_placa_preenchida_justificativa', val)}
                        />
                      )}

                      <ChoiceRow
                        index="23"
                        label="Placa de identificação do leito com os riscos sinalizados?"
                        value={formData.q23_placa_riscos}
                        options={['Sim', 'Não']}
                        onChange={(val) => handleFieldChange('q23_placa_riscos', val)}
                      />
                      {formData.q23_placa_riscos === 'Não' && (
                        <TextJustifyField
                          index="24"
                          value={formData.q24_placa_riscos_justificativa}
                          onChange={(val) => handleFieldChange('q24_placa_riscos_justificativa', val)}
                        />
                      )}

                      <ChoiceRow
                        index="25"
                        label="Os rótulos da dieta estão com todos os identificadores obrigatórios?"
                        value={formData.q25_rotulos_dieta}
                        options={['Sim', 'Não', 'Não se aplica']}
                        onChange={(val) => handleFieldChange('q25_rotulos_dieta', val)}
                      />
                      {formData.q25_rotulos_dieta === 'Não' && (
                        <TextJustifyField
                          index="26"
                          value={formData.q26_rotulos_dieta_justificativa}
                          onChange={(val) => handleFieldChange('q26_rotulos_dieta_justificativa', val)}
                        />
                      )}

                      <ChoiceRow
                        index="27"
                        label="O rótulo de medicamentos está com todos os identificadores obrigatórios?"
                        value={formData.q27_rotulo_medicamento}
                        options={['Sim', 'Não', 'Não se aplica']}
                        onChange={(val) => handleFieldChange('q27_rotulo_medicamento', val)}
                      />
                    </div>
                  </div>
                )}

                {/* STEP 4: HAND HYGIENE & VENOUS ACCESS */}
                {currentStep === 4 && (
                  <div className="space-y-5">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="font-black text-xs text-slate-800 uppercase tracking-widest">Higienização e Dispositivos Invasivos (Q28 - Q33)</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Inspecione a lavagem das mãos pré-procedimento e marcações de cateteres.</p>
                    </div>

                    <div className="space-y-4">
                      <ChoiceRow
                        index="28"
                        label="A higienização das mãos foi realizada?"
                        value={formData.q28_higienizacao_maos}
                        options={['Sim', 'Não', 'Não se aplica']}
                        onChange={(val) => handleFieldChange('q28_higienizacao_maos', val)}
                      />
                      {formData.q28_higienizacao_maos === 'Não' && (
                        <TextJustifyField
                          index="29"
                          value={formData.q29_higienizacao_maos_justificativa}
                          onChange={(val) => handleFieldChange('q29_higienizacao_maos_justificativa', val)}
                        />
                      )}

                      <ChoiceRow
                        index="30"
                        label="Acesso venoso foi identificado adequadamente (Nº do jelco/Data da punção/Nome do profissional)?"
                        value={formData.q30_acesso_venoso}
                        options={['Sim', 'Não', 'Não se aplica']}
                        onChange={(val) => handleFieldChange('q30_acesso_venoso', val)}
                      />
                      {formData.q30_acesso_venoso === 'Não' && (
                        <TextJustifyField
                          index="31"
                          value={formData.q31_acesso_venoso_justificativa}
                          onChange={(val) => handleFieldChange('q31_acesso_venoso_justificativa', val)}
                        />
                      )}

                      <ChoiceRow
                        index="32"
                        label="Curativo da ferida identificado, válido e íntegro? (Cirurgias, Lesões, Drenos..)"
                        value={formData.q32_curativo_ferida}
                        options={['Sim', 'Não', 'Não se aplica']}
                        onChange={(val) => handleFieldChange('q32_curativo_ferida', val)}
                      />
                      {formData.q32_curativo_ferida === 'Não' && (
                        <TextJustifyField
                          index="33"
                          value={formData.q33_curativo_ferida_justificativa}
                          onChange={(val) => handleFieldChange('q33_curativo_ferida_justificativa', val)}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 5: DECUBITUS, FALLS, HANDOFFS & SBAR */}
                {currentStep === 5 && (
                  <div className="space-y-5">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="font-black text-xs text-slate-800 uppercase tracking-widest">Segurança Proativa e Passagem de Plantão (Q34 - Q43)</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Última etapa: avalie decúbitos, leitos de contenção e prontidão SBAR.</p>
                    </div>

                    <div className="space-y-4">
                      <ChoiceRow
                        index="34"
                        label="Paciente está no decúbito correto de acordo com o relógio da pele no momento da visita?"
                        value={formData.q34_decubito_correto}
                        options={['Sim', 'Não', 'Não se aplica']}
                        onChange={(val) => handleFieldChange('q34_decubito_correto', val)}
                      />
                      {formData.q34_decubito_correto === 'Não' && (
                        <TextJustifyField
                          index="35"
                          value={formData.q35_decubito_correto_justificativa}
                          onChange={(val) => handleFieldChange('q35_decubito_correto_justificativa', val)}
                        />
                      )}

                      <ChoiceRow
                        index="36"
                        label="Paciente recebeu orientação de prevenção de lesão por pressão?"
                        value={formData.q36_orientacao_lesao}
                        options={['Sim', 'Não', 'Não se aplica']}
                        onChange={(val) => handleFieldChange('q36_orientacao_lesao', val)}
                      />

                      <ChoiceRow
                        index="37"
                        label="Grades do leito elevadas?"
                        value={formData.q37_grades_elevadas}
                        options={['Sim', 'Não', 'Paciente fora do leito no momento da visita']}
                        onChange={(val) => handleFieldChange('q37_grades_elevadas', val)}
                      />
                      {formData.q37_grades_elevadas === 'Não' && (
                        <TextJustifyField
                          index="38"
                          value={formData.q38_grades_elevadas_justificativa}
                          onChange={(val) => handleFieldChange('q38_grades_elevadas_justificativa', val)}
                        />
                      )}

                      <ChoiceRow
                        index="39"
                        label="O paciente recebeu orientação sobre as medidas de prevenção de queda?"
                        value={formData.q39_orientacao_queda}
                        options={['Sim', 'Não']}
                        onChange={(val) => handleFieldChange('q39_orientacao_queda', val)}
                      />

                      <ChoiceRow
                        index="40"
                        label="Passagem de plantão da enfermagem com formulário padrão preenchido?"
                        value={formData.q40_passagem_plantao}
                        options={['Sim', 'Não']}
                        onChange={(val) => handleFieldChange('q40_passagem_plantao', val)}
                      />
                      {formData.q40_passagem_plantao === 'Não' && (
                        <TextJustifyField
                          index="41"
                          value={formData.q41_passagem_plantao_justificativa}
                          onChange={(val) => handleFieldChange('q41_passagem_plantao_justificativa', val)}
                        />
                      )}

                      <ChoiceRow
                        index="42"
                        label="Em caso de transferência (interna/externa) o formulário de transferência/SBAR preenchido adequadamente?"
                        value={formData.q42_SBAR}
                        options={['Sim', 'Não', 'Não se aplica']}
                        onChange={(val) => handleFieldChange('q42_SBAR', val)}
                      />
                      {formData.q42_SBAR === 'Não' && (
                        <TextJustifyField
                          index="43"
                          value={formData.q43_SBAR_justificativa}
                          onChange={(val) => handleFieldChange('q43_SBAR_justificativa', val)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Validation Error Banner */}
          {error && (
            <div className="flex items-center gap-2 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold uppercase tracking-wide animate-pulse">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="flex-1 leading-snug">{error}</span>
            </div>
          )}

          {/* Footer Navigation Bar */}
          <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
            <div className="hidden sm:flex items-center gap-1.5 text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              Preenchimento assistido inteligente
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end sm:ml-auto">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-black uppercase rounded-lg tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
              )}

              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 sm:flex-initial px-6 py-2.5 bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 text-xs font-black uppercase rounded-lg tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer ml-auto sm:ml-0"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 sm:flex-initial px-6 py-2.5 text-white text-xs font-black uppercase rounded-lg tracking-wider flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ml-auto sm:ml-0 ${
                    submitting
                      ? 'bg-red-400 cursor-not-allowed opacity-90'
                      : 'bg-red-600 hover:bg-red-700 active:scale-[0.98]'
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 shrink-0" />
                      <span>Registrar Auditoria</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Custom internal components to maintain stellar design standards */

interface ChoiceRowProps {
  index: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function ChoiceRow({ index, label, value, options, onChange }: ChoiceRowProps) {
  return (
    <div className="bg-slate-50/50 p-4 rounded-lg border border-slate-100 space-y-3 hover:border-slate-200 hover:bg-slate-50/70 transition-all">
      <div className="flex gap-2">
        <span className="text-[10px] font-black text-rose-500 shrink-0 mt-0.5">{index}.</span>
        <span className="text-xs font-bold text-slate-700 leading-relaxed uppercase tracking-tight">{label} *</span>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {options.map((opt) => {
          const isSelected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3.5 py-2 text-[10.5px] font-black uppercase tracking-wider rounded-md border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-red-500 border-red-500 text-white shadow-sm scale-[1.02]'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface TextJustifyFieldProps {
  index: string;
  value: string;
  onChange: (value: string) => void;
}

function TextJustifyField({ index, value, onChange }: TextJustifyFieldProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="pl-4 border-l-2 border-red-200 space-y-1.5"
    >
      <label className="text-[10px] font-black uppercase text-red-500 tracking-wider">
        {index}. Se não, justifique *
      </label>
      <textarea
        placeholder="Descreva detalhadamente a não conformidade para melhoria..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 focus:border-red-400 rounded-md outline-none text-slate-800 transition-colors"
      />
    </motion.div>
  );
}
