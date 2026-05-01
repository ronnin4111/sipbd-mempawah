'use client';

import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFishFarmStats } from '@/hooks/use-fish-farms';

const CHART_COLORS = [
  '#0d9488', '#059669', '#14b8a6', '#34d399', '#6ee7b7',
  '#2dd4bf', '#10b981', '#a7f3d0',
];

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);

function ChartCard({ title, children, index }: { title: string; children: React.ReactNode; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
    >
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-sm sm:text-base font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TrendChart() {
  const { data: stats } = useFishFarmStats();
  if (!stats) return null;

  const data = Object.entries(stats.trend5Year)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, val]) => ({
      year,
      Pembesaran: val.pembesaran,
      Pembenihan: val.pembenihan,
      Total: val.pembesaran + val.pembenihan,
    }));

  return (
    <ChartCard title="Tren Produksi 5 Tahun" index={0}>
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number) => formatNumber(value) + ' kg'}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Pembesaran" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="Pembenihan" stroke="#059669" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="Total" stroke="#14b8a6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function FishTypePieChart() {
  const { data: stats } = useFishFarmStats();
  if (!stats) return null;

  const data = Object.entries(stats.productionByFishType).map(([name, value]) => ({
    name,
    value,
  }));

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ChartCard title="Produksi per Jenis Ikan" index={1}>
      <div className="h-64 sm:h-72 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }: { name: string; percent: number }) =>
                `${name} (${(percent * 100).toFixed(0)}%)`
              }
              labelLine={{ strokeWidth: 1 }}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatNumber(value) + ' kg'}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function KecamatanBarChart() {
  const { data: stats } = useFishFarmStats();
  if (!stats) return null;

  const data = Object.entries(stats.productionByKecamatan)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <ChartCard title="Produksi per Kecamatan" index={2}>
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number) => formatNumber(value) + ' kg'}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="value" name="Produksi (kg)" radius={[4, 4, 0, 0]}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function ContainerBarChart() {
  const { data: stats } = useFishFarmStats();
  if (!stats) return null;

  const data = Object.entries(stats.productionByContainer)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <ChartCard title="Produksi per Wadah Budidaya" index={3}>
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number) => formatNumber(value) + ' kg'}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="value" name="Produksi (kg)" fill="#059669" radius={[4, 4, 0, 0]}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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
