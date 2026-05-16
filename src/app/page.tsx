'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { AppShell } from '@/components/layout/app-shell';
import { DashboardCharts } from '@/components/dashboard/charts';
import { DataTable } from '@/components/data-table/data-table';
import { MapView } from '@/components/map/map-view';
import { ReportTables } from '@/components/tables/report-tables';
import { ImportDialog } from '@/components/import-export/import-dialog';
import { ExportSection } from '@/components/import-export/export-section';
import { DisagregasiSection } from '@/components/disaggregation/disagregasi-section';
import { KusukaSection } from '@/components/kusuka/kusuka-section';
import { KnowledgeBaseSection } from '@/components/knowledge-base/knowledge-base-section';
import { AdminPanel } from '@/components/dashboard/admin-panel';
import { useFilterStore } from '@/store/filter-store';
import { HeroBanner } from '@/components/layout/hero-banner';
import { CommodityPricesTable } from '@/components/commodity-prices/commodity-prices-table';
import { ExternalIframe } from '@/components/external-iframe';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Upload, Lock, Shield, Loader2, LogOut, Brain, FileSpreadsheet, Split, CreditCard, LayoutDashboard } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';
import { SmartNarrator } from '@/components/ai/smart-narrator';
import { MediaSosialSection } from '@/components/social-media/media-sosial-section';
import { LayananSection } from '@/components/layanan/layanan-section';

// Dynamic import PdfDashboardCharts with ssr:false to avoid recharts SSR crash on Vercel
const PdfDashboardCharts = dynamic(
  () => import('@/components/dashboard/charts').then((m) => ({ default: m.PdfDashboardCharts })),
  { ssr: false }
);

function DashboardSection() {
  return (
    <div className="space-y-6">
      <HeroBanner />
      <DashboardCharts />
      <AdminPanel />
      <SmartNarrator />
    </div>
  );
}

function DataProduksiSection() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const years = useFilterStore((s) => s.years);
  const kecamatan = useFilterStore((s) => s.kecamatan);
  const desa = useFilterStore((s) => s.desa);
  const groupName = useFilterStore((s) => s.groupName);
  const fishType = useFilterStore((s) => s.fishType);
  const containerType = useFilterStore((s) => s.containerType);
  const businessType = useFilterStore((s) => s.businessType);
  const search = useFilterStore((s) => s.search);

  // Compute a filter key to detect changes — used for derived page reset
  const filterKey = useMemo(() =>
    `${years.join(',')}|${kecamatan.join(',')}|${desa.join(',')}|${groupName.join(',')}|${fishType.join(',')}|${containerType.join(',')}|${businessType.join(',')}|${search}`,
    [years, kecamatan, desa, groupName, fishType, containerType, businessType, search]
  );

  // Derive page from filterKey to reset on filter change
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  const currentPage = prevFilterKey !== filterKey ? 1 : page;
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <DataTable
        page={page}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
}

function PetaLokasiSection() {
  return (
    <div className="space-y-4">
      <MapView />
    </div>
  );
}

function TrenLaporanSection() {
  return (
    <div className="space-y-4">
      <ReportTables />
    </div>
  );
}

function TrenV2Section() {
  return (
    <ExternalIframe
      src="https://sipbd-mempawah-v2.vercel.app/?section=tren-laporan&embedded=true"
      title="Tren & Laporan V2"
      badge="V2 — Triwulan"
    />
  );
}

function HargaKomoditasSection() {
  return (
    <div className="space-y-4">
      <CommodityPricesTable />
    </div>
  );
}

function KusukaDataSection() {
  const setActiveSection = useFilterStore((s) => s.setActiveSection);
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  return (
    <div className="space-y-6">
      {/* Page Header Banner */}
      <div
        className="rounded-xl p-5 sm:p-6"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(124,58,237,0.08))'
            : 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(124,58,237,0.04))',
          border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)'}`,
        }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
              }}
            >
              <CreditCard className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
                Data Registrasi KUSUKA
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kartu Identitas Usaha Perikanan — Data publik pembudidaya ikan Kab. Mempawah
              </p>
            </div>
          </div>
          <Button
            onClick={() => setActiveSection('dashboard')}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs shrink-0"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Ke Dashboard
          </Button>
        </div>
      </div>

      {/* KUSUKA Content */}
      <KusukaSection hideHeader />
    </div>
  );
}

function KnowledgeBasePageSection() {
  return (
    <div className="space-y-4">
      <KnowledgeBaseSection />
    </div>
  );
}

function AdminLoginSection() {
  const isAdmin = useFilterStore((s) => s.isAdmin);
  const setIsAdmin = useFilterStore((s) => s.setIsAdmin);
  const setActiveSection = useFilterStore((s) => s.setActiveSection);
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const handleAdminLogin = async () => {
    if (!adminPassword.trim()) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, type: 'admin' }),
      });
      const data = await res.json();
      if (data.valid) {
        setIsAdmin(true);
        setAdminPassword('');
        setLoginError('');
      } else {
        setLoginError('Password salah!');
      }
    } catch {
      setLoginError('Gagal memverifikasi password');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setAdminPassword('');
  };

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)', boxShadow: '0 4px 20px rgba(6,182,212,0.4)' }}
          >
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>Admin Aktif</h2>
            <p className="text-xs text-muted-foreground">Anda sudah login sebagai admin</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { id: 'knowledge-base', title: 'Basis Pengetahuan AI', desc: 'Upload & kelola dokumen', icon: Brain, gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)' },
            { id: 'import-export', title: 'Import / Export', desc: 'Import Excel atau export data', icon: FileSpreadsheet, gradient: 'linear-gradient(135deg, #10B981, #059669)' },
            { id: 'disagregasi', title: 'Disagregasi Data', desc: 'Pecah data agregat per desa', icon: Split, gradient: 'linear-gradient(135deg, #F59E0B, #D97706)' },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.id}
                className={`group hover:border-cyan-500/30 transition-all cursor-pointer ${isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}`}
                onClick={() => setActiveSection(feature.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: feature.gradient }}
                    >
                      <Icon className="h-4.5 w-4.5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm">{feature.title}</h4>
                      <p className="text-[10px] text-muted-foreground">{feature.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => setActiveSection('dashboard')}
            variant="outline"
            className="gap-2"
          >
            <LayoutDashboard className="h-4 w-4" />
            Ke Dashboard
          </Button>
          <Button
            onClick={handleAdminLogout}
            variant="destructive"
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout Admin
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className={`w-full max-w-md ${isDark ? 'bg-gradient-to-br from-[#0D1B2E] to-[#0A1628] border-cyan-500/10' : 'bg-white border-gray-200'}`}>
        <CardContent className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)', boxShadow: '0 8px 32px rgba(6,182,212,0.4)' }}
            >
              <Lock className="h-8 w-8 text-white" />
            </div>
            <h2 className="font-bold text-xl mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              Login Admin
            </h2>
            <p className="text-xs text-muted-foreground">
              Masukkan password untuk mengakses fitur admin
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Password Admin
              </label>
              <Input
                type="password"
                placeholder="Masukkan password admin..."
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value);
                  setLoginError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdminLogin();
                }}
                className="h-11"
                autoFocus
              />
            </div>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <span className="text-sm">⚠️</span>
                  {loginError}
                </p>
              </div>
            )}

            <Button
              onClick={handleAdminLogin}
              disabled={loginLoading || !adminPassword.trim()}
              className="w-full h-11 gap-2"
              style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
            >
              {loginLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Masuk sebagai Admin
                </>
              )}
            </Button>
          </div>

          <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              Fitur admin: Import/Export data, Basis Pengetahuan AI,<br />
              Disagregasi Data, dan pengaturan sistem
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ImportExportSection() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Import data dari Excel (memerlukan password) atau export ke Excel/PDF
          </p>
        </div>
        <Button
          onClick={() => setImportOpen(true)}
          className="gap-2"
          style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Import Excel</span>
        </Button>
      </div>
      <ExportSection />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

export default function Home() {
  const activeSection = useFilterStore((s) => s.activeSection);

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardSection />;
      case 'data-produksi':
        return <DataProduksiSection />;
      case 'peta-lokasi':
        return <PetaLokasiSection />;
      case 'tren-laporan':
        return <TrenLaporanSection />;
      case 'tren-v2':
        return <TrenV2Section />;
      case 'harga-komoditas':
        return <HargaKomoditasSection />;
      case 'data-kusuka':
        return <KusukaDataSection />;
      case 'knowledge-base':
        return <KnowledgeBasePageSection />;
      case 'disagregasi':
        return <DisagregasiSection />;
      case 'admin-login':
        return <AdminLoginSection />;
      case 'import-export':
        return <ImportExportSection />;
      case 'media-sosial':
        return <MediaSosialSection />;
      case 'layanan-ekusuka':
      case 'layanan-nib':
      case 'layanan-cpib':
      case 'layanan-cbib':
        return <LayananSection />;
      default:
        return <DashboardSection />;
    }
  };

  return (
    <AppShell>
      {/* Always-rendered PDF chart container (off-screen) for PDF export capture */}
      <PdfDashboardCharts />
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {renderSection()}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
