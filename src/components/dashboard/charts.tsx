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
  '#0891B2', '#14B8A6', '#38BDF8', '#2DD4BF', '#7DD3FC',
  '#0EA5E9', '#0D9488', '#5EEAD4',
];

const PEMBESARAN_COLOR = '#0891B2';
const PEMBENIHAN_COLOR = '#14B8A6';

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);

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
  if (!stats) return null;

  const data = Object.entries(stats.trend5Year)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, val]) => ({
      year,
      'Pembesaran (Kg)': val.pembesaran,
      'Pembenihan (Ekor)': val.pembenihan,
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
              formatter={(value: number, name: string) => {
                const unit = name.includes('Pembesaran') ? ' Kg' : ' Ekor';
                return formatNumber(value) + unit;
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Pembesaran (Kg)" stroke={PEMBESARAN_COLOR} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="Pembenihan (Ekor)" stroke={PEMBENIHAN_COLOR} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
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
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Pembenihan Pie */}
        <div>
          <p className="text-xs text-center font-medium text-muted-foreground mb-1">Pembenihan (Ekor)</p>
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
                  formatter={(value: number) => formatNumber(value) + ' Ekor'}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

function KecamatanBarChart() {
  const { data: stats } = useFishFarmStats();
  if (!stats) return null;

  const data = Object.entries(stats.productionByKecamatan)
    .map(([name, val]) => ({
      name,
      'Pembesaran (Kg)': val.pembesaran,
      'Pembenihan (Ekor)': val.pembenihan,
    }))
    .sort((a, b) => (b['Pembesaran (Kg)'] + b['Pembenihan (Ekor)']) - (a['Pembesaran (Kg)'] + a['Pembenihan (Ekor)']));

  return (
    <ChartCard title="Produksi per Kecamatan" index={2}>
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number, name: string) => {
                const unit = name.includes('Pembesaran') ? ' Kg' : ' Ekor';
                return formatNumber(value) + unit;
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Pembesaran (Kg)" fill={PEMBESARAN_COLOR} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Pembenihan (Ekor)" fill={PEMBENIHAN_COLOR} radius={[4, 4, 0, 0]} />
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
    .map(([name, val]) => ({
      name,
      'Pembesaran (Kg)': val.pembesaran,
      'Pembenihan (Ekor)': val.pembenihan,
    }))
    .sort((a, b) => (b['Pembesaran (Kg)'] + b['Pembenihan (Ekor)']) - (a['Pembesaran (Kg)'] + a['Pembenihan (Ekor)']));

  return (
    <ChartCard title="Produksi per Wadah Budidaya" index={3}>
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number, name: string) => {
                const unit = name.includes('Pembesaran') ? ' Kg' : ' Ekor';
                return formatNumber(value) + unit;
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Pembesaran (Kg)" fill={PEMBESARAN_COLOR} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Pembenihan (Ekor)" fill={PEMBENIHAN_COLOR} radius={[4, 4, 0, 0]} />
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
