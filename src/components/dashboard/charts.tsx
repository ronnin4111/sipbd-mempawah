'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import { useFishFarmStats } from '@/hooks/use-fish-farms';
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
type KecamatanViewBy = 'jenis-usaha' | 'jenis-ikan' | 'wadah';
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
  { id: 'jenis-usaha', label: 'Jenis Usaha' },
  { id: 'jenis-ikan', label: 'Jenis Ikan' },
  { id: 'wadah', label: 'Wadah Budidaya' },
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

const renderBarLabel = (props: Record<string, unknown>) => {
  const x = props.x as number;
  const y = props.y as number;
  const width = props.width as number;
  const value = props.value as number;
  if (!value || value === 0) return <g />;
  const formatted = value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : value.toFixed(0);
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
  const formatted = value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : value.toFixed(0);
  return (
    <text x={x + width / 2} y={y - 4} fill="#1A2332" textAnchor="middle" fontSize={9} fontWeight={600} opacity={0.9}>
      {formatted}
    </text>
  );
};

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
  if (!stats) return null;

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
      name: cat,
    }));
    data = sortedYears.map(year => {
      const row: Record<string, unknown> = { year };
      categories.forEach(cat => {
        const val = trendData[cat]?.[year];
        row[cat] = val ? val.pembesaran + val.pembenihan : 0;
      });
      return row;
    });
  }

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
                  return formatNumber(value);
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

  if (!stats) return null;

  const data = getProduksiData(stats, viewBy);
  const title = `Produksi per ${PRODUKSI_VIEWS.find(v => v.id === viewBy)?.label ?? ''}`;

  // Pie chart data
  const pembesaranPieData = data
    .filter(d => (d['Pembesaran (Kg)'] as number) > 0)
    .map(d => ({ name: d.name, value: d['Pembesaran (Kg)'] as number }));

  const pembenihanPieData = data
    .filter(d => (d['Pembenihan (Ekor)'] as number) > 0)
    .map(d => ({ name: d.name, value: d['Pembenihan (Ekor)'] as number }));

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

// === 3. PRODUKSI KECAMATAN CHART ===

function ProduksiKecamatanChart() {
  const { data: stats } = useFishFarmStats();
  const [viewBy, setViewBy] = useState<KecamatanViewBy>('jenis-usaha');
  const [chartType, setChartType] = useState<ChartType>('bar');

  if (!stats) return null;

  const title = `Produksi per Kecamatan (by ${KECAMATAN_VIEWS.find(v => v.id === viewBy)?.label ?? ''})`;

  // Build data based on viewBy
  let data: Record<string, unknown>[] = [];
  let series: { key: string; color: string; name: string }[] = [];

  if (viewBy === 'jenis-usaha') {
    // Show Pembesaran vs Pembenihan per kecamatan
    data = Object.entries(stats.productionByKecamatan)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kec, val]) => ({
        name: kec,
        'Pembesaran (Kg)': val.pembesaran,
        'Pembenihan (Ekor)': val.pembenihan,
      }));
    series = [
      { key: 'Pembesaran (Kg)', color: PEMBESARAN_COLOR, name: 'Pembesaran (Kg)' },
      { key: 'Pembenihan (Ekor)', color: PEMBENIHAN_COLOR, name: 'Pembenihan (Ekor)' },
    ];
  } else if (viewBy === 'jenis-ikan') {
    // Cross-tab: Kecamatan × FishType
    const crossData = stats.productionByKecamatanByFishType;
    const allFishTypes = new Set<string>();
    Object.values(crossData).forEach(ft => Object.keys(ft).forEach(f => allFishTypes.add(f)));
    const sortedFishTypes = Array.from(allFishTypes).sort();
    series = sortedFishTypes.map((ft, i) => ({
      key: ft,
      color: CHART_COLORS[i % CHART_COLORS.length],
      name: ft,
    }));
    data = Object.entries(crossData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kec, fishTypes]) => {
        const row: Record<string, unknown> = { name: kec };
        sortedFishTypes.forEach(ft => {
          const val = fishTypes[ft];
          row[ft] = val ? val.pembesaran + val.pembenihan : 0;
        });
        return row;
      });
  } else {
    // Cross-tab: Kecamatan × ContainerType
    const crossData = stats.productionByKecamatanByContainer;
    const allContainers = new Set<string>();
    Object.values(crossData).forEach(ct => Object.keys(ct).forEach(c => allContainers.add(c)));
    const sortedContainers = Array.from(allContainers).sort();
    series = sortedContainers.map((ct, i) => ({
      key: ct,
      color: CHART_COLORS[i % CHART_COLORS.length],
      name: ct,
    }));
    data = Object.entries(crossData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kec, containers]) => {
        const row: Record<string, unknown> = { name: kec };
        sortedContainers.forEach(ct => {
          const val = containers[ct];
          row[ct] = val ? val.pembesaran + val.pembenihan : 0;
        });
        return row;
      });
  }

  // Pie chart data
  const pieData = viewBy === 'jenis-usaha'
    ? [
        {
          label: 'Pembesaran (Kg)',
          items: data.filter(d => (d['Pembesaran (Kg)'] as number) > 0).map(d => ({ name: d.name as string, value: d['Pembesaran (Kg)'] as number })),
          unit: 'Kg',
        },
        {
          label: 'Pembenihan (Ekor)',
          items: data.filter(d => (d['Pembenihan (Ekor)'] as number) > 0).map(d => ({ name: d.name as string, value: d['Pembenihan (Ekor)'] as number })),
          unit: 'Ekor',
        },
      ]
    : series.map(s => ({
        label: s.name,
        items: data.filter(d => (d[s.key] as number) > 0).map(d => ({ name: d.name as string, value: d[s.key] as number })),
        unit: '',
      }));

  const renderChart = () => {
    if (chartType === 'pie') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {pieData.slice(0, 4).map((pd, idx) => (
            <div key={idx}>
              <p className="text-xs text-center font-medium text-muted-foreground mb-1">{pd.label}{pd.unit ? ` (${pd.unit})` : ''}</p>
              <div className="h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pd.items}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                      labelLine={{ strokeWidth: 1 }}
                    >
                      {pd.items.map((_, index) => (
                        <Cell key={`cell-kc-${idx}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatNumber(value) + (pd.unit ? ` ${pd.unit}` : '')}
                      contentStyle={tooltipStyleSmall}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (chartType === 'line') {
      return (
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} height={60} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const unit = viewBy === 'jenis-usaha' && name.includes('Pembesaran') ? ' Kg' : viewBy === 'jenis-usaha' && name.includes('Pembenihan') ? ' Ekor' : '';
                  return formatNumber(value) + unit;
                }}
                contentStyle={tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {series.map(s => (
                <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name={s.name} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Default: bar
    return (
      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number, name: string) => {
                const unit = viewBy === 'jenis-usaha' && name.includes('Pembesaran') ? ' Kg' : viewBy === 'jenis-usaha' && name.includes('Pembenihan') ? ' Ekor' : '';
                return formatNumber(value) + unit;
              }}
              contentStyle={tooltipStyle}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {series.map(s => (
              <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} label={renderBarLabel} name={s.name} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <ChartCard title={title} index={2}>
      <div id="chart-produksi-kecamatan">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          {/* Dimension selector */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#06B6D4' }}>
              Tampilkan berdasarkan
            </p>
            <SelectorButton
              options={KECAMATAN_VIEWS}
              value={viewBy}
              onChange={(v) => setViewBy(v as KecamatanViewBy)}
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
  const { data: stats } = useFishFarmStats();
  const [trendViewBy, setTrendViewBy] = useState<TrendViewBy>('jenis-usaha');
  const [produksiViewBy, setProduksiViewBy] = useState<ProduksiViewBy>('jenis-ikan');
  const [produksiChartType, setProduksiChartType] = useState<ChartType>('bar');
  const [kecamatanViewBy, setKecamatanViewBy] = useState<KecamatanViewBy>('jenis-usaha');
  const [kecamatanChartType, setKecamatanChartType] = useState<ChartType>('bar');

  if (!stats) return null;

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
    trendLines = categories.map((cat, i) => ({ key: cat, color: CHART_COLORS[i % CHART_COLORS.length], name: cat }));
    trendData = sortedYears.map(year => {
      const row: Record<string, unknown> = { year };
      categories.forEach(cat => {
        const val = trendDataSource[cat]?.[year];
        row[cat] = val ? val.pembesaran + val.pembenihan : 0;
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

  if (kecamatanViewBy === 'jenis-usaha') {
    kecData = Object.entries(stats.productionByKecamatan)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kec, val]) => ({ name: kec, 'Pembesaran (Kg)': val.pembesaran, 'Pembenihan (Ekor)': val.pembenihan }));
    kecSeries = [
      { key: 'Pembesaran (Kg)', color: PEMBESARAN_COLOR, name: 'Pembesaran (Kg)' },
      { key: 'Pembenihan (Ekor)', color: PEMBENIHAN_COLOR, name: 'Pembenihan (Ekor)' },
    ];
  } else if (kecamatanViewBy === 'jenis-ikan') {
    const crossData = stats.productionByKecamatanByFishType;
    const allFT = new Set<string>();
    Object.values(crossData).forEach(ft => Object.keys(ft).forEach(f => allFT.add(f)));
    const sortedFT = Array.from(allFT).sort();
    kecSeries = sortedFT.map((ft, i) => ({ key: ft, color: CHART_COLORS[i % CHART_COLORS.length], name: ft }));
    kecData = Object.entries(crossData).sort(([a], [b]) => a.localeCompare(b)).map(([kec, fishTypes]) => {
      const row: Record<string, unknown> = { name: kec };
      sortedFT.forEach(ft => { const val = fishTypes[ft]; row[ft] = val ? val.pembesaran + val.pembenihan : 0; });
      return row;
    });
  } else {
    const crossData = stats.productionByKecamatanByContainer;
    const allCT = new Set<string>();
    Object.values(crossData).forEach(ct => Object.keys(ct).forEach(c => allCT.add(c)));
    const sortedCT = Array.from(allCT).sort();
    kecSeries = sortedCT.map((ct, i) => ({ key: ct, color: CHART_COLORS[i % CHART_COLORS.length], name: ct }));
    kecData = Object.entries(crossData).sort(([a], [b]) => a.localeCompare(b)).map(([kec, containers]) => {
      const row: Record<string, unknown> = { name: kec };
      sortedCT.forEach(ct => { const val = containers[ct]; row[ct] = val ? val.pembesaran + val.pembenihan : 0; });
      return row;
    });
  }

  const kecTitle = `Produksi per Kecamatan (by ${KECAMATAN_VIEWS.find(v => v.id === kecamatanViewBy)?.label ?? ''})`;

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
    if (kecamatanChartType === 'line') {
      return (
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={kecData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid {...pdfGridStyle} />
              <XAxis dataKey="name" tick={{ ...pdfTextStyle, fontSize: 9 }} angle={-40} textAnchor="end" interval={0} height={70} />
              <YAxis tick={{ ...pdfTextStyle, fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#333' }} />
              {kecSeries.map(s => (
                <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} name={s.name} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Default: bar
    return (
      <div style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={kecData} margin={{ top: 25, right: 20, left: 10, bottom: 40 }}>
            <CartesianGrid {...pdfGridStyle} />
            <XAxis dataKey="name" tick={{ ...pdfTextStyle, fontSize: 9 }} angle={-40} textAnchor="end" interval={0} height={70} />
            <YAxis tick={{ ...pdfTextStyle, fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#333' }} />
            {kecSeries.map(s => (
              <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} label={renderBarLabelPdf} name={s.name} />
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
        <h3 style={{ color: '#1A2332', fontSize: 14, fontWeight: 'bold', marginBottom: 8, fontFamily: 'sans-serif' }}>{kecTitle}</h3>
        {renderPdfKecamatanChart()}
      </div>

      {/* Legacy IDs for backward compatibility with PDF export dialog */}
      <div id="pdf-chart-kecamatan" style={{ background: '#FFFFFF', padding: 20, width: 900, marginBottom: 16 }}>
        <h3 style={{ color: '#1A2332', fontSize: 14, fontWeight: 'bold', marginBottom: 8, fontFamily: 'sans-serif' }}>Produksi per Kecamatan</h3>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={getProduksiData(stats, 'kecamatan')} margin={{ top: 25, right: 20, left: 10, bottom: 40 }}>
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
