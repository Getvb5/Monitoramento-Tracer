import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { calculateSectorDistribution, SectorShareResult } from '../lib/itemComplianceHelper';
import { Building2, Search, ArrowUpDown, Layers, PieChart, BarChart2 } from 'lucide-react';

interface Props {
  patientAudits: any[];
  surgeryAudits: any[];
  handAudits: any[];
  unitName?: string;
  selectedMonthName?: string;
  globalTracer?: string;
}

export default function SectorDistribution({
  patientAudits,
  surgeryAudits,
  handAudits,
  unitName,
  selectedMonthName,
  globalTracer
}: Props) {
  const [tracerFilter, setTracerFilter] = useState<'ALL' | 'T01' | 'T02' | 'T03'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'volume_desc' | 'volume_asc' | 'alphabetical'>('volume_desc');

  useEffect(() => {
    if (globalTracer === 'T01' || globalTracer === 'T02' || globalTracer === 'T03') {
      setTracerFilter(globalTracer);
    } else if (globalTracer === '') {
      setTracerFilter('ALL');
    }
  }, [globalTracer]);

  // Calculate sector distribution based on active tracer filter
  const allSectors: SectorShareResult[] = useMemo(() => {
    const patients = (tracerFilter === 'ALL' || tracerFilter === 'T01') ? patientAudits : [];
    const surgeries = (tracerFilter === 'ALL' || tracerFilter === 'T02') ? surgeryAudits : [];
    const hands = (tracerFilter === 'ALL' || tracerFilter === 'T03') ? handAudits : [];
    return calculateSectorDistribution(patients, surgeries, hands);
  }, [tracerFilter, patientAudits, surgeryAudits, handAudits]);

  const totalAudits = useMemo(() => {
    if (tracerFilter === 'T01') return patientAudits.length;
    if (tracerFilter === 'T02') return surgeryAudits.length;
    if (tracerFilter === 'T03') return handAudits.length;
    return patientAudits.length + surgeryAudits.length + handAudits.length;
  }, [tracerFilter, patientAudits, surgeryAudits, handAudits]);

  // Filter and sort sectors
  const filteredSectors = useMemo(() => {
    let list = [...allSectors];

    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      list = list.filter(s => s.sectorName.toLowerCase().includes(q));
    }

    if (sortBy === 'volume_desc') {
      list.sort((a, b) => b.count - a.count);
    } else if (sortBy === 'volume_asc') {
      list.sort((a, b) => a.count - b.count);
    } else if (sortBy === 'alphabetical') {
      list.sort((a, b) => a.sectorName.localeCompare(b.sectorName));
    }

    return list;
  }, [allSectors, searchTerm, sortBy]);

  const topSector = allSectors[0];

  const formatPct = (val: number) => {
    return val.toFixed(1).replace('.', ',') + '%';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-violet-50 text-violet-600 border border-violet-100 rounded-lg">
              <Building2 className="w-4 h-4" />
            </span>
            <h3 className="text-sm md:text-base font-black text-slate-900 uppercase tracking-tight">
              Distribuição Percentual do Total de Auditorias por Setor
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Concentração de registros por setor hospitalar e área assistencial
            {unitName ? ` • ${unitName}` : ''}
            {selectedMonthName ? ` • ${selectedMonthName}` : ''}
          </p>
        </div>

        {/* Global Summary Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 rounded-xl border border-slate-200 text-xs font-black text-slate-700 self-start lg:self-auto">
          <span>{allSectors.length} Setores Mapeados</span>
          <span>•</span>
          <span className="text-blue-700">{totalAudits} Auditorias</span>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Setores Auditados</span>
          <p className="text-xl font-black text-slate-900">{allSectors.length}</p>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Setor Líder</span>
          <p className="text-xs font-black text-violet-700 truncate" title={topSector?.sectorName}>
            {topSector ? topSector.sectorName : 'Nenhum'}
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Volume no Líder</span>
          <p className="text-xl font-black text-violet-900">
            {topSector ? `${topSector.count} (${formatPct(topSector.percentage)})` : '0%'}
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Média / Setor</span>
          <p className="text-xl font-black text-slate-700">
            {allSectors.length > 0 ? (totalAudits / allSectors.length).toFixed(1) : 0}
          </p>
        </div>
      </div>

      {/* Tracer Tabs Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTracerFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            tracerFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          }`}
        >
          Todos os Tracers ({patientAudits.length + surgeryAudits.length + handAudits.length})
        </button>
        <button
          onClick={() => setTracerFilter('T01')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            tracerFilter === 'T01'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
          }`}
        >
          T01 - Beira Leito ({patientAudits.length})
        </button>
        <button
          onClick={() => setTracerFilter('T02')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            tracerFilter === 'T02'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-amber-50 hover:bg-amber-100 text-amber-700'
          }`}
        >
          T02 - Proc. Cirúrgicos ({surgeryAudits.length})
        </button>
        <button
          onClick={() => setTracerFilter('T03')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            tracerFilter === 'T03'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
          }`}
        >
          T03 - Higiene / Medicação ({handAudits.length})
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-150">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar por nome do setor (ex: UTI, Enfermaria, CC)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 self-start sm:self-auto">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-transparent outline-none cursor-pointer text-slate-700 text-xs font-bold"
          >
            <option value="volume_desc">Maior Volume (%)</option>
            <option value="volume_asc">Menor Volume (%)</option>
            <option value="alphabetical">Ordem Alfabética</option>
          </select>
        </div>
      </div>

      {/* Sector Rows List */}
      {filteredSectors.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/40 space-y-2">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-black uppercase text-slate-400">
            Nenhum setor encontrado para os critérios selecionados
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSectors.map((sec, index) => {
            return (
              <motion.div
                key={sec.sectorName}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="p-3.5 rounded-xl border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/40 bg-white transition-all space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  
                  {/* Sector Name and Tracer Badges */}
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-violet-100 text-violet-800 flex items-center justify-center text-xs font-black shrink-0">
                      {index + 1}
                    </span>
                    <div>
                      <span className="text-xs md:text-sm font-black text-slate-900 tracking-tight block">
                        {sec.sectorName}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {sec.t01Count > 0 && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            T01: {sec.t01Count}
                          </span>
                        )}
                        {sec.t02Count > 0 && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            T02: {sec.t02Count}
                          </span>
                        )}
                        {sec.t03Count > 0 && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            T03: {sec.t03Count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Percentage and count */}
                  <div className="text-right shrink-0">
                    <span className="text-sm md:text-base font-black text-slate-900">
                      {formatPct(sec.percentage)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 block">
                      {sec.count} {sec.count === 1 ? 'auditoria' : 'auditorias'}
                    </span>
                  </div>
                </div>

                {/* Progress bar representing sector share of total audits */}
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                  <div 
                    style={{ width: `${Math.min(100, sec.percentage)}%` }}
                    className="h-full bg-violet-600 transition-all duration-500 rounded-full"
                    title={`${sec.sectorName}: ${sec.count} auditorias (${formatPct(sec.percentage)})`}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400">
        <span>Distribuição percentual normalizada sobre a base filtrada</span>
        <span>Total: {totalAudits} registros</span>
      </div>

    </div>
  );
}
