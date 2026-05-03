'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFishFarmStats } from '@/hooks/use-fish-farms';

const CHART_COLORS = [
  '#06B6D4', '#14B8A6', '#38BDF8', '#22D3EE', '#7DD3FC',
  '#0EA5E9', '#0D9488', '#5EEAD4', '#67E8F9', '#2DD4BF',
  '#A5F3FC', '#99F6E4',
];

const PEMBESARAN_COLOR = '#06B6D4';
const PEMBENIHAN_COLOR = '#14B8A6';

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

type TrendViewBy = 'jenis-usaha' | 'jenis-ikan' | 'kecamatan' | 'wadah';

const TREND_VIEWS: { id: TrendViewBy; label: string }[] = [
  { id: 'jenis-usaha', label: 'Jenis Usaha' },
  { id: 'jenis-ikan', label: 'Jenis Ikan' },
  { id: 'kecamatan', label: 'Kecamatan' },
  { id: 'wadah', label: 'Wadah Budidaya' },
];

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

function TrendChart() {
  const { data: stats } = useFishFarmStats();
  const [viewBy, setViewBy] = useState<TrendViewBy>('jenis-usaha');
  if (!stats) return null;

  // Build chart data based on view selection
  let data: Record<string, unknown>[] = [];
  let lines: { key: string; color: string; name: string }[] = [];

  if (viewBy === 'jenis-usaha') {
    // Original: Pembesaran vs Pembenihan by year
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
    // Multi-line: each category item as a separate line
    let trendData: Record<string, Record<string, { pembesaran: number; pembenihan: number }>>;

    if (viewBy === 'jenis-ikan') {
      trendData = stats.trendByFishType;
    } else if (viewBy === 'kecamatan') {
      trendData = stats.trendByKecamatan;
    } else {
      trendData = stats.trendByContainer;
    }

    // Get all years from the data
    const allYears = new Set<string>();
    Object.values(trendData).forEach(yearMap => {
      Object.keys(yearMap).forEach(y => allYears.add(y));
    });
    const sortedYears = Array.from(allYears).sort();

    // For multi-category views, combine pembesaran+pembenihan as total
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
      {/* View Selector */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {TREND_VIEWS.map((view) => (
          <button
            key={view.id}
            onClick={() => setViewBy(view.id)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
            style={{
              background: viewBy === view.id ? 'rgba(6,182,212,0.15)' : 'transparent',
              border: `1px solid ${viewBy === view.id ? 'rgba(6,182,212,0.4)' : 'var(--border)'}`,
              color: viewBy === view.id ? '#06B6D4' : 'var(--muted-foreground)',
            }}
          >
            {view.label}
          </button>
        ))}
      </div>

      <div className="h-64 sm:h-72">
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

function FishTypePieChart() {
  const { data: stats } = useFishFarmStats();
  if (!stats) return null;

  // Show two pies: Pembesaran (Kg) and Pembenihan (Ekor)
  const pembesaranData = Object.entries(stats.productionByFishType)
    .filter(([, v]) => v.pembesaran > 0)
    .map(([name, v]) => ({ name, value: v.pembesaran }));

  const pembenihanData = Object.entries(stats.productionByFishType)
    .filter(([, v]) => v.pembenihan > 0)
    .map(([name, v]) => ({ name, value: v.pembenihan }));

  return (
    <ChartCard title="Produksi per Jenis Ikan" index={1}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Pembesaran Pie */}
        <div>
          <p className="text-xs text-center font-medium text-muted-foreground mb-1">Pembesaran (Kg)</p>
          <div className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pembesaranData}
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
                  {pembesaranData.map((_, index) => (
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
        {/* Pembenihan Pie */}
        <div>
          <p className="text-xs text-center font-medium text-muted-foreground mb-1">Pembenihan (Ektor)</p>
          <div className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pembenihanData}
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
                  {pembenihanData.map((_, index) => (
                    <Cell key={`cell-b-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatNumber(value) + ' Ektor'}
                  contentStyle={tooltipStyleSmall}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

// Custom label renderer for bar charts - shows value on top of bar
const renderBarLabel = (props: Record<string, unknown>) => {
  const x = props.x as number;
  const y = props.y as number;
  const width = props.width as number;
  const value = props.value as number;
  if (!value || value === 0) return <g />;
  const formatted = value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : value.toFixed(0);
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      fill="var(--foreground)"
      textAnchor="middle"
      fontSize={9}
      fontWeight={600}
      opacity={0.8}
    >
      {formatted}
    </text>
  );
};

function KecamatanBarChart() {
  const { data: stats } = useFishFarmStats();
  if (!stats) return null;

  const data = Object.entries(stats.productionByKecamatan)
    .map(([name, val]) => ({
      name,
      'Pembesaran (Kg)': val.pembesaran,
      'Pembenihan (Ektor)': val.pembenihan,
    }))
    .sort((a, b) => (b['Pembesaran (Kg)'] + b['Pembenihan (Ektor)']) - (a['Pembesaran (Kg)'] + a['Pembenihan (Ektor)']));

  return (
    <ChartCard title="Produksi per Kecamatan" index={2}>
      <div id="chart-kecamatan">
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number, name: string) => {
                const unit = name.includes('Pembesaran') ? ' Kg' : ' Ektor';
                return formatNumber(value) + unit;
              }}
              contentStyle={tooltipStyle}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Pembesaran (Kg)" fill={PEMBESARAN_COLOR} radius={[4, 4, 0, 0]} label={renderBarLabel} />
            <Bar dataKey="Pembenihan (Ektor)" fill={PEMBENIHAN_COLOR} radius={[4, 4, 0, 0]} label={renderBarLabel} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      </div>
    </ChartCard>
  );
}

function ContainerBarChart() {
  const { data: stats } = useFishFarmStats();
  if (!stats) return null;

  const data = Object.entries(stats.productionByContainer)
    .map(([name, val]) => ({
      name,
      'Pembesaran (Kg)': val.pembesaran,
      'Pembenihan (Ektor)': val.pembenihan,
    }))
    .sort((a, b) => (b['Pembesaran (Kg)'] + b['Pembenihan (Ektor)']) - (a['Pembesaran (Kg)'] + a['Pembenihan (Ektor)']));

  return (
    <ChartCard title="Produksi per Wadah Budidaya" index={3}>
      <div id="chart-wadah-budidaya">
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number, name: string) => {
                const unit = name.includes('Pembesaran') ? ' Kg' : ' Ektor';
                return formatNumber(value) + unit;
              }}
              contentStyle={tooltipStyle}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Pembesaran (Kg)" fill={PEMBESARAN_COLOR} radius={[4, 4, 0, 0]} label={renderBarLabel} />
            <Bar dataKey="Pembenihan (Ektor)" fill={PEMBENIHAN_COLOR} radius={[4, 4, 0, 0]} label={renderBarLabel} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      </div>
    </ChartCard>
  );
}

export function DashboardCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <TrendChart />
      <FishTypePieChart />
      <KecamatanBarChart />
      <ContainerBarChart />
    </div>
  );
}
