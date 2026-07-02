'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  Circle,
  Users,
  Fish,
  Loader2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Layers,
  MapPin,
  Building2,
  Droplets,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TriwulanStatus {
  hasData: boolean;
  batchCount: number;
  totalQty: number;
  farmerCount: number;
  businessTypes: string[];
  kecamatanList: string[];
  fishTypes: string[];
  containerTypes: string[];
  lastBatchAt: string | null;
}

interface SemesterStatus {
  hasData: boolean;
  totalQty: number;
  farmerCount: number;
  triwulansWithData: string[];
}

interface TriwulanData {
  year: number;
  triwulans: Record<string, TriwulanStatus>;
  semesters: Record<string, SemesterStatus>;
}

interface TriwulanOverviewProps {
  year: string;
  selectedTriwulan: string;
  onTriwulanSelect: (triwulan: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtNum = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);

const TRIWULAN_META: Record<string, { label: string; months: string; color: string; iconBg: string }> = {
  Q1: { label: 'Q1', months: 'Jan – Mar', color: '#10B981', iconBg: 'rgba(16,185,129,0.12)' },
  Q2: { label: 'Q2', months: 'Apr – Jun', color: '#06B6D4', iconBg: 'rgba(6,182,212,0.12)' },
  Q3: { label: 'Q3', months: 'Jul – Sep', color: '#F59E0B', iconBg: 'rgba(245,158,11,0.12)' },
  Q4: { label: 'Q4', months: 'Okt – Des', color: '#8B5CF6', iconBg: 'rgba(139,92,246,0.12)' },
};

const SEMESTER_META: Record<string, { label: string; months: string; color: string }> = {
  S1: { label: 'Semester 1', months: 'Jan – Jun', color: '#14B8A6' },
  S2: { label: 'Semester 2', months: 'Jul – Des', color: '#A78BFA' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function TriwulanOverview({ year, selectedTriwulan, onTriwulanSelect }: TriwulanOverviewProps) {
  const [data, setData] = useState<TriwulanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedTriwulan, setExpandedTriwulan] = useState<string | null>(null);
  const [expandedSemester, setExpandedSemester] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'triwulan' | 'semester'>('triwulan');

  const fetchData = useCallback(async () => {
    if (!year || parseInt(year) < 2000 || parseInt(year) > 2100) {
      setData(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/disagregasi/triwulan-status?year=${year}`);
      if (res.ok) {
        const json = await res.json();
        setData(json as TriwulanData);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Count how many triwulan have data
  const triwulansWithData = data
    ? Object.entries(data.triwulans).filter(([, v]) => v.hasData).length
    : 0;

  const totalYearQty = data
    ? Object.values(data.triwulans).reduce((sum, v) => sum + v.totalQty, 0)
    : 0;

  const totalYearFarmers = data
    ? Object.values(data.triwulans).reduce((sum, v) => sum + v.farmerCount, 0)
    : 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
              boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
            }}
          >
            <Calendar className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Ringkasan Triwulan</h3>
            <p className="text-[10px] text-muted-foreground">
              Status disagregasi tahun {year || '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* View mode toggle */}
          <div
            className="flex gap-0.5 p-0.5 rounded-md"
            style={{
              background: 'rgba(6,182,212,0.06)',
              border: '1px solid rgba(6,182,212,0.12)',
            }}
          >
            <button
              onClick={() => setViewMode('triwulan')}
              className="px-2 py-1 rounded text-[10px] font-medium transition-all"
              style={{
                background: viewMode === 'triwulan' ? 'linear-gradient(135deg, #06B6D4, #0891B2)' : 'transparent',
                color: viewMode === 'triwulan' ? 'white' : 'var(--muted-foreground)',
                boxShadow: viewMode === 'triwulan' ? '0 1px 4px rgba(6,182,212,0.3)' : 'none',
              }}
            >
              Triwulan
            </button>
            <button
              onClick={() => setViewMode('semester')}
              className="px-2 py-1 rounded text-[10px] font-medium transition-all"
              style={{
                background: viewMode === 'semester' ? 'linear-gradient(135deg, #06B6D4, #0891B2)' : 'transparent',
                color: viewMode === 'semester' ? 'white' : 'var(--muted-foreground)',
                boxShadow: viewMode === 'semester' ? '0 1px 4px rgba(6,182,212,0.3)' : 'none',
              }}
            >
              Semester
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Loader2 className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Year summary bar */}
      {data && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs"
          style={{
            background: 'rgba(6,182,212,0.06)',
            border: '1px solid rgba(6,182,212,0.12)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" style={{ color: '#06B6D4' }} />
            <span className="text-muted-foreground">Tahun {year}:</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="font-bold"
              style={{ color: triwulansWithData === 4 ? '#22C55E' : triwulansWithData > 0 ? '#F59E0B' : '#EF4444' }}
            >
              {triwulansWithData}/4
            </span>
            <span className="text-muted-foreground">triwulan</span>
          </div>
          <span className="opacity-30">·</span>
          <div className="flex items-center gap-1">
            <Layers className="h-3 w-3" style={{ color: '#06B6D4' }} />
            <span className="font-semibold" style={{ color: '#06B6D4' }}>
              {fmtNum(totalYearQty)}
            </span>
            <span className="text-muted-foreground">Kg total</span>
          </div>
          <span className="opacity-30">·</span>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" style={{ color: '#06B6D4' }} />
            <span className="font-semibold">{totalYearFarmers}</span>
            <span className="text-muted-foreground">petani</span>
          </div>

          {/* Progress bar */}
          <div className="flex-1 h-1.5 rounded-full overflow-hidden ml-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(triwulansWithData / 4) * 100}%`,
                background: triwulansWithData === 4
                  ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                  : triwulansWithData > 0
                    ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                    : 'transparent',
              }}
            />
          </div>
        </motion.div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#06B6D4' }} />
          <span className="ml-2 text-xs text-muted-foreground">Memuat data triwulan...</span>
        </div>
      )}

      {/* No year */}
      {!year && (
        <div className="text-center py-6 text-xs text-muted-foreground">
          Masukkan tahun untuk melihat status triwulan
        </div>
      )}

      {/* Triwulan View */}
      {year && !loading && data && viewMode === 'triwulan' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((tw) => {
            const meta = TRIWULAN_META[tw];
            const status = data.triwulans[tw];
            const isSelected = selectedTriwulan === tw;
            const isExpanded = expandedTriwulan === tw;

            return (
              <motion.div
                key={tw}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                <button
                  onClick={() => {
                    onTriwulanSelect(tw);
                    setExpandedTriwulan(isExpanded ? null : tw);
                  }}
                  className="w-full text-left rounded-xl p-3 transition-all"
                  style={{
                    background: isSelected
                      ? `rgba(${hexToRgb(meta.color)}, 0.08)`
                      : 'rgba(255,255,255,0.02)',
                    border: `1.5px solid ${isSelected ? meta.color : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: isSelected ? `0 0 16px rgba(${hexToRgb(meta.color)}, 0.15)` : 'none',
                  }}
                >
                  {/* Top: Label + Status */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
                        style={{
                          background: meta.iconBg,
                          color: meta.color,
                        }}
                      >
                        {tw}
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground leading-tight">{meta.months}</p>
                      </div>
                    </div>
                    {status?.hasData ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#22C55E' }} />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30" />
                    )}
                  </div>

                  {/* Data or Empty */}
                  {status?.hasData ? (
                    <div className="space-y-1">
                      <div>
                        <p className="text-sm font-bold" style={{ color: meta.color }}>
                          {fmtNum(status.totalQty)}
                        </p>
                        <p className="text-[9px] text-muted-foreground">Kg</p>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Users className="h-2.5 w-2.5" />
                          {status.farmerCount}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Layers className="h-2.5 w-2.5" />
                          {status.batchCount} batch
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground/50 italic">Belum ada data</p>
                      <p className="text-[9px]" style={{ color: meta.color }}>
                        Klik untuk input →
                      </p>
                    </div>
                  )}

                  {/* Expand indicator */}
                  {status?.hasData && (
                    <div className="absolute bottom-1.5 right-1.5">
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3 text-muted-foreground/40" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
                      )}
                    </div>
                  )}
                </button>

                {/* Expanded details */}
                <AnimatePresence>
                  {isExpanded && status?.hasData && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden mt-1"
                    >
                      <div
                        className="rounded-lg p-2.5 space-y-1.5 text-[10px]"
                        style={{
                          background: `rgba(${hexToRgb(meta.color)}, 0.04)`,
                          border: `1px solid rgba(${hexToRgb(meta.color)}, 0.12)`,
                        }}
                      >
                        {status.businessTypes.length > 0 && (
                          <div className="flex items-start gap-1.5">
                            <Building2 className="h-3 w-3 shrink-0 mt-0.5" style={{ color: meta.color }} />
                            <span className="text-muted-foreground">
                              {status.businessTypes.join(', ')}
                            </span>
                          </div>
                        )}
                        {status.kecamatanList.length > 0 && (
                          <div className="flex items-start gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0 mt-0.5" style={{ color: meta.color }} />
                            <span className="text-muted-foreground">
                              {status.kecamatanList.join(', ')}
                            </span>
                          </div>
                        )}
                        {status.fishTypes.length > 0 && (
                          <div className="flex items-start gap-1.5">
                            <Fish className="h-3 w-3 shrink-0 mt-0.5" style={{ color: meta.color }} />
                            <span className="text-muted-foreground">
                              {status.fishTypes.join(', ')}
                            </span>
                          </div>
                        )}
                        {status.containerTypes.length > 0 && (
                          <div className="flex items-start gap-1.5">
                            <Droplets className="h-3 w-3 shrink-0 mt-0.5" style={{ color: meta.color }} />
                            <span className="text-muted-foreground">
                              {status.containerTypes.join(', ')}
                            </span>
                          </div>
                        )}
                        {status.lastBatchAt && (
                          <div className="flex items-center gap-1.5 pt-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                            <Calendar className="h-3 w-3" style={{ color: meta.color }} />
                            <span className="text-muted-foreground/60">
                              Terakhir: {new Date(status.lastBatchAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Semester View */}
      {year && !loading && data && viewMode === 'semester' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(['S1', 'S2'] as const).map((sem) => {
            const meta = SEMESTER_META[sem];
            const status = data.semesters[sem];
            const isExpanded = expandedSemester === sem;
            const childTriwulans = sem === 'S1' ? ['Q1', 'Q2'] : ['Q3', 'Q4'];

            return (
              <motion.div
                key={sem}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  onClick={() => setExpandedSemester(isExpanded ? null : sem)}
                  className="w-full text-left rounded-xl p-4 transition-all"
                  style={{
                    background: status?.hasData
                      ? `rgba(${hexToRgb(meta.color)}, 0.06)`
                      : 'rgba(255,255,255,0.02)',
                    border: `1.5px solid ${status?.hasData ? meta.color : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: status?.hasData ? `0 0 16px rgba(${hexToRgb(meta.color)}, 0.1)` : 'none',
                  }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{
                          background: `rgba(${hexToRgb(meta.color)}, 0.12)`,
                          color: meta.color,
                        }}
                      >
                        {sem}
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: meta.color }}>
                          {meta.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{meta.months}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {status?.hasData ? (
                        <CheckCircle2 className="h-4 w-4" style={{ color: '#22C55E' }} />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/30" />
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground/40" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </div>
                  </div>

                  {/* Sub-triwulans pills */}
                  <div className="flex gap-1.5 mb-3">
                    {childTriwulans.map((tw) => {
                      const twStatus = data.triwulans[tw];
                      const twMeta = TRIWULAN_META[tw];
                      return (
                        <div
                          key={tw}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-all"
                          style={{
                            background: twStatus?.hasData ? twMeta.iconBg : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${twStatus?.hasData ? twMeta.color + '30' : 'rgba(255,255,255,0.06)'}`,
                            color: twStatus?.hasData ? twMeta.color : 'var(--muted-foreground)',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTriwulanSelect(tw);
                          }}
                        >
                          {twStatus?.hasData ? (
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          ) : (
                            <Circle className="h-2.5 w-2.5" />
                          )}
                          {tw}
                          {twStatus?.hasData && (
                            <span className="opacity-60">{fmtNum(twStatus.totalQty)}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Stats */}
                  {status?.hasData ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-lg font-bold" style={{ color: meta.color }}>
                          {fmtNum(status.totalQty)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Total Produksi (Kg)</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold" style={{ color: meta.color }}>
                          {status.farmerCount}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Jumlah Petani</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/50 italic">
                      Belum ada data untuk semester ini
                    </p>
                  )}
                </button>

                {/* Expanded: comparison between triwulans */}
                <AnimatePresence>
                  {isExpanded && status?.hasData && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden mt-1"
                    >
                      <div
                        className="rounded-lg p-3 space-y-2"
                        style={{
                          background: `rgba(${hexToRgb(meta.color)}, 0.04)`,
                          border: `1px solid rgba(${hexToRgb(meta.color)}, 0.12)`,
                        }}
                      >
                        <p className="text-[10px] font-semibold" style={{ color: meta.color }}>
                          Perbandingan Triwulan
                        </p>
                        {childTriwulans.map((tw) => {
                          const twStatus = data.triwulans[tw];
                          const twMeta = TRIWULAN_META[tw];
                          const pctOfSemester = status.totalQty > 0 && twStatus?.hasData
                            ? (twStatus.totalQty / status.totalQty) * 100
                            : 0;

                          return (
                            <div key={tw} className="space-y-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="flex items-center gap-1 font-medium" style={{ color: twMeta.color }}>
                                  {tw} — {twMeta.months}
                                </span>
                                {twStatus?.hasData ? (
                                  <span className="text-muted-foreground">
                                    {fmtNum(twStatus.totalQty)} Kg ({pctOfSemester.toFixed(1)}%)
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/50 italic">Kosong</span>
                                )}
                              </div>
                              {twStatus?.hasData && (
                                <div
                                  className="h-1.5 rounded-full overflow-hidden"
                                  style={{ background: 'rgba(255,255,255,0.04)' }}
                                >
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{
                                      width: `${pctOfSemester}%`,
                                      background: `linear-gradient(90deg, ${twMeta.color}, ${twMeta.color}88)`,
                                    }}
                                  />
                                </div>
                              )}
                              {twStatus?.hasData && (
                                <div className="flex items-center gap-3 text-[9px] text-muted-foreground pl-1">
                                  <span className="flex items-center gap-0.5">
                                    <Users className="h-2 w-2" />
                                    {twStatus.farmerCount} petani
                                  </span>
                                  <span className="flex items-center gap-0.5">
                                    <Layers className="h-2 w-2" />
                                    {twStatus.batchCount} batch
                                  </span>
                                  {twStatus.fishTypes.length > 0 && (
                                    <span className="flex items-center gap-0.5">
                                      <Fish className="h-2 w-2" />
                                      {twStatus.fishTypes.slice(0, 2).join(', ')}
                                      {twStatus.fishTypes.length > 2 && ` +${twStatus.fishTypes.length - 2}`}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* No data state */}
      {year && !loading && data && triwulansWithData === 0 && (
        <div
          className="text-center py-4 px-3 rounded-lg text-xs text-muted-foreground"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.08)',
          }}
        >
          <p className="font-medium mb-1">Belum ada data disagregasi untuk tahun {year}</p>
          <p className="text-[10px]">Mulai dengan memilih triwulan dan mengisi form di bawah</p>
        </div>
      )}
    </div>
  );
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '6,182,212'; // fallback to cyan
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}
