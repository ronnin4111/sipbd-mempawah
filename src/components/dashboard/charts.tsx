'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import { useFishFarmStats } from '@/hooks/use-fish-farms';
import { useFilterStore } from '@/store/filter-store';
import { BarChart3, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';

const CHART_COLORS = [
  '#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#A855F7',
  '#EC4899', '#F97316', '#14B8A6', '#6366F1', '#84CC16',
  '#E11D48', '#0891B2',
];

const PEMBESARAN_COLOR = '#3B82F6';
const PEMBENIHAN_COLOR = '#22C55E';

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);

// Theme-aware tooltip style
const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  background: 'rgba(13,27,46,0.95)',
  border: '1px solid rgba(6,182,212,0.3)',
  color: '#E2EDF5',
  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
};

const tooltipStyleSmall = {
  ...tooltipStyle,
  fontSize: 11,
};

// === TYPE DEFINITIONS ===

type TrendViewBy = 'jenis-usaha' | 'jenis-ikan' | 'kecamatan' | 'wadah';
type ProduksiViewBy = 'jenis-ikan' | 'kecamatan' | 'wadah';
type KecamatanViewBy = 'produksi' | 'jenis-usaha' | 'jenis-ikan' | 'wadah' | 'pelaku-usaha' | 'kelompok';
type ChartType = 'bar' | 'line' | 'pie';

const TREND_VIEWS: { id: TrendViewBy; label: string }[] = [
  { id: 'jenis-usaha', label: 'Jenis Usaha' },
  { id: 'jenis-ikan', label: 'Jenis Ikan' },
  { id: 'kecamatan', label: 'Kecamatan' },
  { id: 'wadah', label: 'Wadah Budidaya' },
];

const PRODUKSI_VIEWS: { id: ProduksiViewBy; label: string }[] = [
  { id: 'jenis-ikan', label: 'Jenis Ikan' },
  { id: 'kecamatan', label: 'Kecamatan' },
  { id: 'wadah', label: 'Wadah Budidaya' },
];

const KECAMATAN_VIEWS: { id: KecamatanViewBy; label: string }[] = [
  { id: 'produksi', label: 'Produksi' },
  { id: 'jenis-usaha', label: 'Jenis Usaha' },
  { id: 'jenis-ikan', label: 'Jenis Ikan' },
  { id: 'wadah', label: 'Wadah' },
  { id: 'pelaku-usaha', label: 'Pelaku Usaha' },
  { id: 'kelompok', label: 'Kelompok' },
];

const CHART_TYPES: { id: ChartType; label: string; icon: React.ReactNode }[] = [
  { id: 'bar', label: 'Batang', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: 'line', label: 'Garis', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { id: 'pie', label: 'Pai', icon: <PieChartIcon className="h-3.5 w-3.5" /> },
];

// === HELPER: Selector Button ===

function SelectorButton({
  options,
  value,
  onChange,
  size = 'sm',
}: {
  options: { id: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (val: string) => void;
  size?: 'sm' | 'xs';
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
          style={{
            background: value === opt.id ? 'rgba(6,182,212,0.15)' : 'transparent',
            border: `1px solid ${value === opt.id ? 'rgba(6,182,212,0.4)' : 'var(--border)'}`,
            color: value === opt.id ? '#06B6D4' : 'var(--muted-foreground)',
          }}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// === CHART CARD WRAPPER ===

function ChartCard({ title, children, index }: { title: string; children: React.ReactNode; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
      className="glass-card animate-in"
      style={{ animationDelay: `${0.2 + index * 0.05}s` }}
    >
      <div className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
        <h3 className="section-title">{title}</h3>
      </div>
      <div className="px-4 sm:px-6 pb-4 sm:pb-6">
        {children}
      </div>
    </motion.div>
  );
}

// === BAR LABEL RENDERERS ===

// Format value for chart labels — shows readable numbers like "132K" or "1.2M"
const formatChartValue = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 100_000) return `${(value / 1_000).toFixed(0)}K`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
};

const renderBarLabel = (props: Record<string, unknown>) => {
  const x = props.x as number;
  const y = props.y as number;
  const width = props.width as number;
  const value = props.value as number;
  if (!value || value === 0) return <g />;
  const formatted = formatChartValue(value);
  return (
    <text x={x + width / 2} y={y - 4} fill="#E2EDF5" textAnchor="middle" fontSize={9} fontWeight={600} opacity={0.9}>
      {formatted}
    </text>
  );
};

const renderBarLabelPdf = (props: Record<string, unknown>) => {
  const x = props.x as number;
  const y = props.y as number;
  const width = props.width as number;
  const value = props.value as number;
  if (!value || value === 0) return <g />;
  const formatted = formatChartValue(value);
  return (
    <text x={x + width / 2} y={y - 4} fill="#1A2332" textAnchor="middle" fontSize={9} fontWeight={600} opacity={0.9}>
      {formatted}
    </text>
  );
};

// Factory: creates a label renderer for horizontal stacked bar segments that shows the
// CORRECT segment value instead of the cumulative props.value that Recharts provides.
// Recharts label props include: x, y, width, height, value (cumulative), name (dataKey), index (row index)
// We use props.index + our chartData closure to look up the real segment value.
function createStackedBarLabel(
  dataKey: string,
  displayName: string,
  _allSeriesKeys: string[],
  chartData: Record<string, unknown>[],
  fill = '#fff'
) {
  return (props: Record<string, unknown>) => {
    const x = props.x as number;
    const y = props.y as number;
    const width = props.width as number;
    const height = props.height as number;
    const cumulativeValue = props.value as number;
    const dataIndex = props.index as number;

    // Use props.index to look up the actual segment value from our chartData array.
    // Recharts gives us the cumulative value in props.value, but chartData[index][dataKey]
    // contains the real individual segment value that we built ourselves.
    let value = cumulativeValue;
    if (dataIndex !== undefined && dataIndex >= 0 && dataIndex < chartData.length) {
      const row = chartData[dataIndex];
      const segmentValue = row[dataKey] as number;
      if (segmentValue !== undefined && segmentValue !== null) {
        value = segmentValue;
      }
    }

    // Clean up display name — remove unit suffixes
    const cleanName = displayName.replace(/ \(Kg\)$/, '').replace(/ \(Ekor\)$/, '');
    if (!value || value === 0 || width < 20) return <g />;
    const formatted = formatChartValue(value);
    // Show name + value when segment is wide enough, just value when narrow
    const showName = width >= 60;
    const label = showName ? `${cleanName}: ${formatted}` : formatted;
    return (
      <text
        x={x + width / 2}
        y={y + height / 2 + 4}
        fill={fill}
        textAnchor="middle"
        fontSize={showName ? 8.5 : 8}
        fontWeight={600}
        opacity={0.95}
      >
        {label}
      </text>
    );
  };
}

// === HELPER: Get produksi data from stats ===

function getProduksiData(
  stats: NonNullable<ReturnType<typeof useFishFarmStats>['data']>,
  viewBy: ProduksiViewBy
) {
  const source = viewBy === 'jenis-ikan'
    ? stats.productionByFishType
    : viewBy === 'kecamatan'
    ? stats.productionByKecamatan
    : stats.productionByContainer;

  return Object.entries(source)
    .map(([name, val]) => ({
      name,
      'Pembesaran (Kg)': val.pembesaran,
      'Pembenihan (Ekor)': val.pembenihan,
    }))
    .sort((a, b) => (b['Pembesaran (Kg)'] + b['Pembenihan (Ekor)']) - (a['Pembesaran (Kg)'] + a['Pembenihan (Ekor)']));
}

// === 1. TREND CHART ===

function TrendChart() {
  const { data: stats } = useFishFarmStats();
  const [viewBy, setViewBy] = useState<TrendViewBy>('jenis-usaha');

  // [H-11] Wrap data + lines building in useMemo keyed on [stats, viewBy].
  // Previously this ran on every parent re-render (filter change, stats
  // refetch, sibling component state) and rebuilt the same arrays.
  const { data, lines } = useMemo(() => {
    if (!stats) return { data: [] as Record<string, unknown>[], lines: [] as { key: string; color: string; name: string }[] };

    let data: Record<string, unknown>[] = [];
    let lines: { key: string; color: string; name: string }[] = [];

    if (viewBy === 'jenis-usaha') {
      data = Object.entries(stats.trend5Year)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, val]) => ({
          year,
          'Pembesaran (Kg)': val.pembesaran,
          'Pembenihan (Ekor)': val.pembenihan,
        }));
      lines = [
        { key: 'Pembesaran (Kg)', color: PEMBESARAN_COLOR, name: 'Pembesaran (Kg)' },
        { key: 'Pembenihan (Ekor)', color: PEMBENIHAN_COLOR, name: 'Pembenihan (Ekor)' },
      ];
    } else {
      let trendData: Record<string, Record<string, { pembesaran: number; pembenihan: number }>>;
      if (viewBy === 'jenis-ikan') trendData = stats.trendByFishType;
      else if (viewBy === 'kecamatan') trendData = stats.trendByKecamatan;
      else trendData = stats.trendByContainer;

      const allYears = new Set<string>();
      Object.values(trendData).forEach(yearMap => Object.keys(yearMap).forEach(y => allYears.add(y)));
      const sortedYears = Array.from(allYears).sort();
      const categories = Object.keys(trendData).sort();
      lines = categories.map((cat, i) => ({
        key: cat,
        color: CHART_COLORS[i % CHART_COLORS.length],
        name: `${cat} (Kg)`,
      }));
      data = sortedYears.map(year => {
        const row: Record<string, unknown> = { year };
        categories.forEach(cat => {
          const val = trendData[cat]?.[year];
          // Use only pembesaran (Kg) — pembenihan (Ekor) has different units
          row[cat] = val ? val.pembesaran : 0;
        });
        return row;
      });
    }

    return { data, lines };
  }, [stats, viewBy]);

  if (!stats) return null;

  return (
    <ChartCard title="Tren Produksi" index={0}>
      <div id="chart-tren-produksi">
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#06B6D4' }}>
            Tampilkan berdasarkan
          </p>
          <SelectorButton
            options={TREND_VIEWS}
            value={viewBy}
            onChange={(v) => setViewBy(v as TrendViewBy)}
          />
          {viewBy !== 'jenis-usaha' && (
            <p className="text-[10px] mt-1.5 italic" style={{ color: 'var(--muted-foreground)' }}>
              Pembesaran (Kg) — Pembenihan (Ekor) ditampilkan terpisah
            </p>
          )}
        </div>

        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (viewBy === 'jenis-usaha') {
                    const unit = name.includes('Pembesaran') ? ' Kg' : ' Ekor';
                    return formatNumber(value) + unit;
                  }
                  return formatNumber(value) + ' Kg';
                }}
                contentStyle={tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {lines.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name={line.name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  );
}

// === 2. PRODUKSI CHART (UNIFIED) ===

function ProduksiChart() {
  const { data: stats } = useFishFarmStats();
  const [viewBy, setViewBy] = useState<ProduksiViewBy>('jenis-ikan');
  const [chartType, setChartType] = useState<ChartType>('bar');

  // [H-11] Wrap data + pie-data building in useMemo keyed on [stats, viewBy].
  // Previously these were recomputed on every render (e.g. when chartType
  // changed, even though chartType doesn't affect the underlying data).
  const { data, pembesaranPieData, pembenihanPieData } = useMemo(() => {
    if (!stats) {
      return {
        data: [] as Record<string, unknown>[],
        pembesaranPieData: [] as { name: string; value: number }[],
        pembenihanPieData: [] as { name: string; value: number }[],
      };
    }
    const d = getProduksiData(stats, viewBy);
    return {
      data: d,
      pembesaranPieData: d
        .filter(d2 => (d2['Pembesaran (Kg)'] as number) > 0)
        .map(d2 => ({ name: d2.name, value: d2['Pembesaran (Kg)'] as number })),
      pembenihanPieData: d
        .filter(d2 => (d2['Pembenihan (Ekor)'] as number) > 0)
        .map(d2 => ({ name: d2.name, value: d2['Pembenihan (Ekor)'] as number })),
    };
  }, [stats, viewBy]);

  if (!stats) return null;

  const title = `Produksi per ${PRODUKSI_VIEWS.find(v => v.id === viewBy)?.label ?? ''}`;

  const renderChart = () => {
    if (chartType === 'pie') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-center font-medium text-muted-foreground mb-1">Pembesaran (Kg)</p>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pembesaranPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name: string; percent: number }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {pembesaranPieData.map((_, index) => (
                      <Cell key={`cell-p-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatNumber(value) + ' Kg'}
                    contentStyle={tooltipStyleSmall}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="text-xs text-center font-medium text-muted-foreground mb-1">Pembenihan (Ekor)</p>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pembenihanPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name: string; percent: number }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {pembenihanPieData.map((_, index) => (
                      <Cell key={`cell-b-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatNumber(value) + ' Ekor'}
                    contentStyle={tooltipStyleSmall}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      );
    }

    if (chartType === 'line') {
      return (
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={60} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const unit = name.includes('Pembesaran') ? ' Kg' : ' Ekor';
                  return formatNumber(value) + unit;
                }}
                contentStyle={tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Pembesaran (Kg)" stroke={PEMBESARAN_COLOR} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Pembenihan (Ekor)" stroke={PEMBENIHAN_COLOR} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Default: bar chart
    return (
      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number, name: string) => {
                const unit = name.includes('Pembesaran') ? ' Kg' : ' Ekor';
                return formatNumber(value) + unit;
              }}
              contentStyle={tooltipStyle}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Pembesaran (Kg)" fill={PEMBESARAN_COLOR} radius={[4, 4, 0, 0]} label={renderBarLabel} />
            <Bar dataKey="Pembenihan (Ekor)" fill={PEMBENIHAN_COLOR} radius={[4, 4, 0, 0]} label={renderBarLabel} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <ChartCard title={title} index={1}>
      <div id="chart-produksi">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          {/* Dimension selector */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#06B6D4' }}>
              Dimensi
            </p>
            <SelectorButton
              options={PRODUKSI_VIEWS}
              value={viewBy}
              onChange={(v) => setViewBy(v as ProduksiViewBy)}
            />
          </div>
          {/* Chart type selector */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#06B6D4' }}>
              Tipe Grafik
            </p>
            <SelectorButton
              options={CHART_TYPES}
              value={chartType}
              onChange={(v) => setChartType(v as ChartType)}
            />
          </div>
        </div>

        {renderChart()}
      </div>
    </ChartCard>
  );
}

// === 3. PRODUKSI KECAMATAN CHART (Stacked Horizontal Bar) ===

function ProduksiKecamatanChart() {
  const { data: stats } = useFishFarmStats();
  const kecamatanChartSegment = useFilterStore((s) => s.kecamatanChartSegment);
  const setKecamatanChartSegment = useFilterStore((s) => s.setKecamatanChartSegment);
  const viewBy = (kecamatanChartSegment || 'produksi') as KecamatanViewBy;

  // [A-6] Wrap data/series/maxVal building in useMemo keyed on [stats, viewBy]
  const { data, series, maxVal } = useMemo(() => {
    if (!stats) return { data: [] as Record<string, unknown>[], series: [] as { key: string; color: string; name: string }[], maxVal: 1 };

    let data: Record<string, unknown>[] = [];
    let series: { key: string; color: string; name: string }[] = [];

    // Get all kecamatan sorted
    const allKecamatan = Object.keys(stats.productionByKecamatanDetail).sort();

    if (viewBy === 'produksi') {
      // Total production (pembesaran + pembenihan volume) per kecamatan
      data = allKecamatan.map(kec => {
        const val = stats.productionByKecamatanDetail[kec];
        return {
          name: kec,
          'Pembesaran': val.pembesaranProduction,
          'Pembenihan': val.pembenihanProduction,
        };
      });
      series = [
        { key: 'Pembesaran', color: '#3B82F6', name: 'Pembesaran (Kg)' },
        { key: 'Pembenihan', color: '#22C55E', name: 'Pembenihan (Ekor)' },
      ];
    } else if (viewBy === 'jenis-usaha') {
      // Same as produksi but labeled differently
      data = allKecamatan.map(kec => {
        const val = stats.productionByKecamatanDetail[kec];
        return {
          name: kec,
          'Pembesaran': val.pembesaranProduction,
          'Pembenihan': val.pembenihanProduction,
        };
      });
      series = [
        { key: 'Pembesaran', color: '#3B82F6', name: 'Pembesaran' },
        { key: 'Pembenihan', color: '#22C55E', name: 'Pembenihan' },
      ];
    } else if (viewBy === 'jenis-ikan') {
      // Cross-tab: Kecamatan x FishType (stacked) — Pembesaran (Kg) only
      // Note: Pembenihan (Ekor) cannot be stacked with Pembesaran (Kg) due to different units
      const crossData = stats.productionByKecamatanByFishType;
      const allFishTypes = new Set<string>();
      Object.values(crossData).forEach(ft => Object.keys(ft).forEach(f => allFishTypes.add(f)));
      const sortedFishTypes = Array.from(allFishTypes).sort();
      series = sortedFishTypes.map((ft, i) => ({
        key: ft,
        color: CHART_COLORS[i % CHART_COLORS.length],
        name: `${ft} (Kg)`,
      }));
      data = allKecamatan.map(kec => {
        const row: Record<string, unknown> = { name: kec };
        sortedFishTypes.forEach(ft => {
          const val = crossData[kec]?.[ft];
          row[ft] = val ? val.pembesaran : 0;
        });
        return row;
      });
    } else if (viewBy === 'wadah') {
      // Cross-tab: Kecamatan x ContainerType (stacked) — Pembesaran (Kg) only
      // Note: Pembenihan (Ekor) cannot be stacked with Pembesaran (Kg) due to different units
      const crossData = stats.productionByKecamatanByContainer;
      const allContainers = new Set<string>();
      Object.values(crossData).forEach(ct => Object.keys(ct).forEach(c => allContainers.add(c)));
      const sortedContainers = Array.from(allContainers).sort();
      series = sortedContainers.map((ct, i) => ({
        key: ct,
        color: CHART_COLORS[i % CHART_COLORS.length],
        name: `${ct} (Kg)`,
      }));
      data = allKecamatan.map(kec => {
        const row: Record<string, unknown> = { name: kec };
        sortedContainers.forEach(ct => {
          const val = crossData[kec]?.[ct];
          row[ct] = val ? val.pembesaran : 0;
        });
        return row;
      });
    } else if (viewBy === 'pelaku-usaha') {
      // Pelaku Usaha per kecamatan split by Pembesaran & Pembenihan
      data = allKecamatan.map(kec => {
        const val = stats.productionByKecamatanDetail[kec];
        return {
          name: kec,
          'Pembesaran': val.pembesaranFarmer,
          'Pembenihan': val.pembenihanFarmer,
        };
      });
      series = [
        { key: 'Pembesaran', color: '#3B82F6', name: 'Pelaku Pembesaran' },
        { key: 'Pembenihan', color: '#22C55E', name: 'Pelaku Pembenihan' },
      ];
    } else if (viewBy === 'kelompok') {
      // Kelompok per kecamatan split by Pembesaran & Pembenihan
      data = allKecamatan.map(kec => {
        const val = stats.productionByKecamatanDetail[kec];
        return {
          name: kec,
          'Pembesaran': val.pembesaranGroup,
          'Pembenihan': val.pembenihanGroup,
        };
      });
      series = [
        { key: 'Pembesaran', color: '#3B82F6', name: 'Kelompok Pembesaran' },
        { key: 'Pembenihan', color: '#22C55E', name: 'Kelompok Pembenihan' },
      ];
    }

    // Sort data by total descending for better visual
    data.sort((a, b) => {
      const totalA = series.reduce((s, ser) => s + ((a[ser.key] as number) || 0), 0);
      const totalB = series.reduce((s, ser) => s + ((b[ser.key] as number) || 0), 0);
      return totalB - totalA;
    });

    // Determine max value for x-axis
    const maxVal = Math.max(...data.map(d =>
      series.reduce((s, ser) => s + ((d[ser.key] as number) || 0), 0)
    ), 1);

    return { data, series, maxVal };
  }, [stats, viewBy]);

  // [H-12] Hoist the per-Bar label closures out of the JSX .map so the
  // `series.map(ss => ss.key)` (O(N) per Bar, O(N²) per render) runs once
  // inside a useMemo. The label array is then indexed by position in JSX.
  // Placed BEFORE the `if (!stats) return null` early return to satisfy
  // the rules-of-hooks (series/data default to [] when stats is null).
  const stackedBarLabels = useMemo(
    () => series.map(s => createStackedBarLabel(s.key, s.name, series.map(ss => ss.key), data)),
    [series, data],
  );

  if (!stats) return null;

  const title = 'Produksi per Kecamatan';

  const formatXAxis = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return v.toFixed(0);
  };

  // Unit label for subtitle
  const unitLabel = viewBy === 'jenis-ikan' || viewBy === 'wadah'
    ? 'Pembesaran (Kg) — Pembenihan (Ekor) ditampilkan terpisah'
    : viewBy === 'produksi' || viewBy === 'jenis-usaha'
    ? 'Pembesaran (Kg) & Pembenihan (Ekor)'
    : viewBy === 'pelaku-usaha'
    ? 'Jumlah Pelaku Usaha (orang)'
    : viewBy === 'kelompok'
    ? 'Jumlah Kelompok'
    : '';

  // Reference maxVal so it's "used" — keeps it part of the memoized output for future use
  void maxVal;

  return (
    <ChartCard title={title} index={2}>
      <div id="chart-produksi-kecamatan">
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#06B6D4' }}>
            Segmen
          </p>
          <SelectorButton
            options={KECAMATAN_VIEWS}
            value={viewBy}
            onChange={(v) => setKecamatanChartSegment(v)}
          />
          {unitLabel && (
            <p className="text-[10px] mt-1.5 italic" style={{ color: 'var(--muted-foreground)' }}>
              {unitLabel}
            </p>
          )}
        </div>

        <div className="h-80 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatXAxis} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
              <Tooltip
                formatter={(value: number, name: string) => formatNumber(value)}
                contentStyle={tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} fill={s.color} stackId="a" name={s.name} label={stackedBarLabels[i]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Data Summary Table — readable in PDF export */}
        {(viewBy !== 'produksi' && viewBy !== 'jenis-usaha') && series.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[10px] sm:text-[11px] border-collapse">
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th className="text-left py-1.5 px-2 font-semibold" style={{ color: 'var(--foreground)' }}>Kecamatan</th>
                  {series.map(s => (
                    <th key={s.key} className="text-right py-1.5 px-2 font-semibold whitespace-nowrap" style={{ color: s.color }}>
                      {s.name}
                    </th>
                  ))}
                  <th className="text-right py-1.5 px-2 font-bold" style={{ color: 'var(--foreground)' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => {
                  const total = series.reduce((sum, s) => sum + ((row[s.key] as number) || 0), 0);
                  return (
                    <tr key={row.name as string} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(6,182,212,0.03)' }}>
                      <td className="py-1 px-2 font-medium" style={{ color: 'var(--foreground)' }}>{row.name as string}</td>
                      {series.map(s => {
                        const val = (row[s.key] as number) || 0;
                        return (
                          <td key={s.key} className="text-right py-1 px-2 tabular-nums" style={{ color: val > 0 ? 'var(--foreground)' : 'var(--muted-foreground)', opacity: val > 0 ? 1 : 0.4 }}>
                            {val > 0 ? formatNumber(val) : '-'}
                          </td>
                        );
                      })}
                      <td className="text-right py-1 px-2 font-bold tabular-nums" style={{ color: '#06B6D4' }}>
                        {formatNumber(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ChartCard>
  );
}

// === DASHBOARD EXPORT ===

export function DashboardCharts() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <TrendChart />
        <ProduksiChart />
      </div>
      <ProduksiKecamatanChart />
    </div>
  );
}

// === PDF-OPTIMIZED CHARTS ===

export function PdfDashboardCharts() {
  // Only fetch stats when on dashboard section (avoid crashing Turso on other pages)
  const activeSection = useFilterStore((s) => s.activeSection);
  const { data: stats } = useFishFarmStats(activeSection === 'dashboard');
  const [trendViewBy, setTrendViewBy] = useState<TrendViewBy>('jenis-usaha');
  const [produksiViewBy, setProduksiViewBy] = useState<ProduksiViewBy>('jenis-ikan');
  const [produksiChartType, setProduksiChartType] = useState<ChartType>('bar');
  const kecamatanChartSegment = useFilterStore((s) => s.kecamatanChartSegment);
  const kecamatanViewBy = (kecamatanChartSegment || 'produksi') as KecamatanViewBy;

  // [A-6] Wrap all chart-data building in useMemo so it only re-runs when inputs change
  const {
    trendData, trendLines, produksiData, produksiTitle,
    pembesaranPieData, pembenihanPieData,
    kecData, kecSeries, kecTitle,
  } = useMemo(() => {
    const empty = {
      trendData: [] as Record<string, unknown>[],
      trendLines: [] as { key: string; color: string; name: string }[],
      produksiData: [] as Record<string, unknown>[],
      produksiTitle: '',
      pembesaranPieData: [] as { name: string; value: number }[],
      pembenihanPieData: [] as { name: string; value: number }[],
      kecData: [] as Record<string, unknown>[],
      kecSeries: [] as { key: string; color: string; name: string }[],
      kecTitle: 'Produksi per Kecamatan',
    };
    if (!stats) return empty;

    // Build trend chart data
    let trendData: Record<string, unknown>[] = [];
    let trendLines: { key: string; color: string; name: string }[] = [];

    if (trendViewBy === 'jenis-usaha') {
      trendData = Object.entries(stats.trend5Year)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, val]) => ({
          year,
          'Pembesaran (Kg)': val.pembesaran,
          'Pembenihan (Ekor)': val.pembenihan,
        }));
      trendLines = [
        { key: 'Pembesaran (Kg)', color: '#3B82F6', name: 'Pembesaran (Kg)' },
        { key: 'Pembenihan (Ekor)', color: '#22C55E', name: 'Pembenihan (Ekor)' },
      ];
    } else {
      let trendDataSource: Record<string, Record<string, { pembesaran: number; pembenihan: number }>>;
      if (trendViewBy === 'jenis-ikan') trendDataSource = stats.trendByFishType;
      else if (trendViewBy === 'kecamatan') trendDataSource = stats.trendByKecamatan;
      else trendDataSource = stats.trendByContainer;

      const allYears = new Set<string>();
      Object.values(trendDataSource).forEach(ym => Object.keys(ym).forEach(y => allYears.add(y)));
      const sortedYears = Array.from(allYears).sort();
      const categories = Object.keys(trendDataSource).sort();
      trendLines = categories.map((cat, i) => ({ key: cat, color: CHART_COLORS[i % CHART_COLORS.length], name: `${cat} (Kg)` }));
      trendData = sortedYears.map(year => {
        const row: Record<string, unknown> = { year };
        categories.forEach(cat => {
          const val = trendDataSource[cat]?.[year];
          // Use only pembesaran (Kg) — pembenihan (Ekor) has different units
          row[cat] = val ? val.pembesaran : 0;
        });
        return row;
      });
    }

    // Build produksi data
    const produksiData = getProduksiData(stats, produksiViewBy);
    const produksiTitle = `Produksi per ${PRODUKSI_VIEWS.find(v => v.id === produksiViewBy)?.label ?? ''}`;

    // Pie data for produksi PDF
    const pembesaranPieData = produksiData
      .filter(d => (d['Pembesaran (Kg)'] as number) > 0)
      .map(d => ({ name: d.name, value: d['Pembesaran (Kg)'] as number }));
    const pembenihanPieData = produksiData
      .filter(d => (d['Pembenihan (Ekor)'] as number) > 0)
      .map(d => ({ name: d.name, value: d['Pembenihan (Ekor)'] as number }));

    // Build kecamatan chart data
    let kecData: Record<string, unknown>[] = [];
    let kecSeries: { key: string; color: string; name: string }[] = [];
    const allKecForPdf = Object.keys(stats.productionByKecamatanDetail).sort();

    if (kecamatanViewBy === 'produksi' || kecamatanViewBy === 'jenis-usaha') {
      kecData = allKecForPdf.map(kec => {
        const val = stats.productionByKecamatanDetail[kec];
        return { name: kec, 'Pembesaran': val.pembesaranProduction, 'Pembenihan': val.pembenihanProduction };
      });
      kecSeries = [
        { key: 'Pembesaran', color: '#3B82F6', name: 'Pembesaran' },
        { key: 'Pembenihan', color: '#22C55E', name: 'Pembenihan' },
      ];
    } else if (kecamatanViewBy === 'jenis-ikan') {
      const crossData = stats.productionByKecamatanByFishType;
      const allFT = new Set<string>();
      Object.values(crossData).forEach(ft => Object.keys(ft).forEach(f => allFT.add(f)));
      const sortedFT = Array.from(allFT).sort();
      kecSeries = sortedFT.map((ft, i) => ({ key: ft, color: CHART_COLORS[i % CHART_COLORS.length], name: `${ft} (Kg)` }));
      kecData = allKecForPdf.map(kec => {
        const row: Record<string, unknown> = { name: kec };
        sortedFT.forEach(ft => { const val = crossData[kec]?.[ft]; row[ft] = val ? val.pembesaran : 0; });
        return row;
      });
    } else if (kecamatanViewBy === 'wadah') {
      const crossData = stats.productionByKecamatanByContainer;
      const allCT = new Set<string>();
      Object.values(crossData).forEach(ct => Object.keys(ct).forEach(c => allCT.add(c)));
      const sortedCT = Array.from(allCT).sort();
      kecSeries = sortedCT.map((ct, i) => ({ key: ct, color: CHART_COLORS[i % CHART_COLORS.length], name: `${ct} (Kg)` }));
      kecData = allKecForPdf.map(kec => {
        const row: Record<string, unknown> = { name: kec };
        sortedCT.forEach(ct => { const val = crossData[kec]?.[ct]; row[ct] = val ? val.pembesaran : 0; });
        return row;
      });
    } else if (kecamatanViewBy === 'pelaku-usaha') {
      kecData = allKecForPdf.map(kec => {
        const val = stats.productionByKecamatanDetail[kec];
        return { name: kec, 'Pembesaran': val.pembesaranFarmer, 'Pembenihan': val.pembenihanFarmer };
      });
      kecSeries = [
        { key: 'Pembesaran', color: '#3B82F6', name: 'Pelaku Pembesaran' },
        { key: 'Pembenihan', color: '#22C55E', name: 'Pelaku Pembenihan' },
      ];
    } else if (kecamatanViewBy === 'kelompok') {
      kecData = allKecForPdf.map(kec => {
        const val = stats.productionByKecamatanDetail[kec];
        return { name: kec, 'Pembesaran': val.pembesaranGroup, 'Pembenihan': val.pembenihanGroup };
      });
      kecSeries = [
        { key: 'Pembesaran', color: '#3B82F6', name: 'Kelompok Pembesaran' },
        { key: 'Pembenihan', color: '#22C55E', name: 'Kelompok Pembenihan' },
      ];
    }

    const kecTitle = 'Produksi per Kecamatan';

    // Sort kecData by total descending (same as visible chart)
    kecData.sort((a, b) => {
      const totalA = kecSeries.reduce((s, ser) => s + ((a[ser.key] as number) || 0), 0);
      const totalB = kecSeries.reduce((s, ser) => s + ((b[ser.key] as number) || 0), 0);
      return totalB - totalA;
    });

    return {
      trendData, trendLines, produksiData, produksiTitle,
      pembesaranPieData, pembenihanPieData,
      kecData, kecSeries, kecTitle,
    };
  }, [stats, trendViewBy, produksiViewBy, kecamatanViewBy]);

  // [H-12] Hoist the per-Bar label closures out of renderPdfKecamatanChart's
  // JSX .map. Same O(N²) pattern as ProduksiKecamatanChart — `kecSeries.map`
  // was running once per Bar per render. Now memoized on [kecSeries, kecData].
  // Placed BEFORE the `if (!stats) return null` early return to satisfy the
  // rules-of-hooks (kecSeries/kecData default to [] when stats is null).
  const pdfStackedBarLabels = useMemo(
    () => kecSeries.map(s => createStackedBarLabel(s.key, s.name, kecSeries.map(ss => ss.key), kecData)),
    [kecSeries, kecData],
  );

  if (!stats) return null;

  const pdfTextStyle = { fill: '#1A2332', fontSize: 11 };
  const pdfGridStyle = { stroke: '#E0E0E0', strokeDasharray: '3 3' };

  const renderPdfProduksiChart = () => {
    if (produksiChartType === 'pie') {
      return (
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Pembesaran (Kg)</p>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pembesaranPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={80} paddingAngle={2} dataKey="value"
                    label={({ name, percent }: { name: string; percent: number }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ strokeWidth: 1 }}>
                    {pembesaranPieData.map((_, index) => (
                      <Cell key={`cell-p-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Pembenihan (Ekor)</p>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pembenihanPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={80} paddingAngle={2} dataKey="value"
                    label={({ name, percent }: { name: string; percent: number }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ strokeWidth: 1 }}>
                    {pembenihanPieData.map((_, index) => (
                      <Cell key={`cell-b-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      );
    }

    if (produksiChartType === 'line') {
      return (
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={produksiData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid {...pdfGridStyle} />
              <XAxis dataKey="name" tick={{ ...pdfTextStyle, fontSize: 9 }} angle={-40} textAnchor="end" interval={0} height={70} />
              <YAxis tick={{ ...pdfTextStyle, fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#333' }} />
              <Line type="monotone" dataKey="Pembesaran (Kg)" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Pembenihan (Ekor)" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Default: bar
    return (
      <div style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={produksiData} margin={{ top: 25, right: 20, left: 10, bottom: 40 }}>
            <CartesianGrid {...pdfGridStyle} />
            <XAxis dataKey="name" tick={{ ...pdfTextStyle, fontSize: 9 }} angle={-40} textAnchor="end" interval={0} height={70} />
            <YAxis tick={{ ...pdfTextStyle, fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#333' }} />
            <Bar dataKey="Pembesaran (Kg)" fill="#3B82F6" radius={[4, 4, 0, 0]} label={renderBarLabelPdf} />
            <Bar dataKey="Pembenihan (Ekor)" fill="#22C55E" radius={[4, 4, 0, 0]} label={renderBarLabelPdf} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderPdfKecamatanChart = () => {
    // Horizontal stacked bar chart for PDF
    return (
      <div style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={kecData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#1A2332', fontSize: 10 }} tickFormatter={(v: number) => {
              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
              if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
              return v.toFixed(0);
            }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#1A2332', fontSize: 10 }} width={110} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}
              formatter={(value: number) => new Intl.NumberFormat('id-ID').format(value)} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#333' }} />
            {kecSeries.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} fill={s.color} stackId="a" name={s.name} label={pdfStackedBarLabels[i]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', left: 0, top: 0, width: 900, zIndex: -9999, pointerEvents: 'none' }}>
      {/* Trend Chart for PDF */}
      <div id="pdf-chart-tren-produksi" style={{ background: '#FFFFFF', padding: 20, width: 900, marginBottom: 16 }}>
        <h3 style={{ color: '#1A2332', fontSize: 14, fontWeight: 'bold', marginBottom: 8, fontFamily: 'sans-serif' }}>Tren Produksi</h3>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid {...pdfGridStyle} />
              <XAxis dataKey="year" tick={pdfTextStyle} />
              <YAxis tick={{ ...pdfTextStyle, fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#333' }} />
              {trendLines.map((line) => (
                <Line key={line.key} type="monotone" dataKey={line.key} stroke={line.color} strokeWidth={2} dot={{ r: 3 }} name={line.name} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Produksi Chart for PDF - unified */}
      <div id="pdf-chart-produksi" style={{ background: '#FFFFFF', padding: 20, width: 900, marginBottom: 16 }}>
        <h3 style={{ color: '#1A2332', fontSize: 14, fontWeight: 'bold', marginBottom: 8, fontFamily: 'sans-serif' }}>{produksiTitle}</h3>
        {renderPdfProduksiChart()}
      </div>

      {/* Produksi Kecamatan Chart for PDF */}
      <div id="pdf-chart-produksi-kecamatan" style={{ background: '#FFFFFF', padding: 20, width: 900, marginBottom: 16 }}>
        <h3 style={{ color: '#1A2332', fontSize: 14, fontWeight: 'bold', marginBottom: 8, fontFamily: 'sans-serif' }}>
          {kecTitle} — {KECAMATAN_VIEWS.find(v => v.id === kecamatanViewBy)?.label ?? kecamatanViewBy}
        </h3>
        {renderPdfKecamatanChart()}
        {/* Data Summary Table for PDF */}
        {(kecamatanViewBy !== 'produksi' && kecamatanViewBy !== 'jenis-usaha') && kecSeries.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 10, fontFamily: 'sans-serif' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: '#333' }}>Kecamatan</th>
                {kecSeries.map(s => (
                  <th key={s.key} style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600, color: s.color, whiteSpace: 'nowrap' }}>{s.name}</th>
                ))}
                <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 700, color: '#333' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {kecData.map((row, idx) => {
                const total = kecSeries.reduce((sum, s) => sum + ((row[s.key] as number) || 0), 0);
                return (
                  <tr key={row.name as string} style={{ borderBottom: '1px solid #e0e0e0', background: idx % 2 === 0 ? '#fff' : '#f8f8f8' }}>
                    <td style={{ padding: '3px 8px', fontWeight: 500, color: '#333' }}>{row.name as string}</td>
                    {kecSeries.map(s => {
                      const val = (row[s.key] as number) || 0;
                      return (
                        <td key={s.key} style={{ textAlign: 'right', padding: '3px 8px', fontVariantNumeric: 'tabular-nums', color: val > 0 ? '#333' : '#aaa' }}>
                          {val > 0 ? new Intl.NumberFormat('id-ID').format(val) : '-'}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right', padding: '3px 8px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#06B6D4' }}>
                      {new Intl.NumberFormat('id-ID').format(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Legacy IDs for backward compatibility with PDF export dialog */}
      <div id="pdf-chart-kecamatan" style={{ background: '#FFFFFF', padding: 20, width: 900, marginBottom: 16 }}>
        <h3 style={{ color: '#1A2332', fontSize: 14, fontWeight: 'bold', marginBottom: 8, fontFamily: 'sans-serif' }}>Produksi per Kecamatan</h3>
        {renderPdfKecamatanChart()}
      </div>

      <div id="pdf-chart-wadah-budidaya" style={{ background: '#FFFFFF', padding: 20, width: 900 }}>
        <h3 style={{ color: '#1A2332', fontSize: 14, fontWeight: 'bold', marginBottom: 8, fontFamily: 'sans-serif' }}>Produksi per Wadah Budidaya</h3>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={getProduksiData(stats, 'wadah')} margin={{ top: 25, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid {...pdfGridStyle} />
              <XAxis dataKey="name" tick={{ ...pdfTextStyle, fontSize: 9 }} angle={-40} textAnchor="end" interval={0} height={70} />
              <YAxis tick={{ ...pdfTextStyle, fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#333' }} />
              <Bar dataKey="Pembesaran (Kg)" fill="#3B82F6" radius={[4, 4, 0, 0]} label={renderBarLabelPdf} />
              <Bar dataKey="Pembenihan (Ekor)" fill="#22C55E" radius={[4, 4, 0, 0]} label={renderBarLabelPdf} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
