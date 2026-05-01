'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppShell } from '@/components/layout/app-shell';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { DashboardCharts } from '@/components/dashboard/charts';
import { FilterBar } from '@/components/data-table/filter-bar';
import { DataTable } from '@/components/data-table/data-table';
import { MapView } from '@/components/map/map-view';
import { ReportTables } from '@/components/tables/report-tables';
import { ImportDialog } from '@/components/import-export/import-dialog';
import { ExportSection } from '@/components/import-export/export-section';
import { useFilterStore } from '@/store/filter-store';
import { Button } from '@/components/ui/button';
import { Upload, Database, MapPin, TrendingUp, FileSpreadsheet, LayoutDashboard } from 'lucide-react';

const sectionMeta: Record<string, { title: string; description: string; icon: React.ReactNode }> = {
  'dashboard': {
    title: 'Dashboard',
    description: 'Ringkasan data perikanan budidaya Kabupaten Mempawah',
    icon: <LayoutDashboard className="h-5 w-5 text-teal-600" />,
  },
  'data-produksi': {
    title: 'Data Produksi',
    description: 'Data lengkap produksi perikanan budidaya dengan filter multi-kolom',
    icon: <Database className="h-5 w-5 text-teal-600" />,
  },
  'peta-lokasi': {
    title: 'Peta Lokasi',
    description: 'Sebaran lokasi budidaya perikanan di Kabupaten Mempawah',
    icon: <MapPin className="h-5 w-5 text-teal-600" />,
  },
  'tren-laporan': {
    title: 'Tren & Laporan',
    description: 'Analisis tren dan laporan perikanan budidaya',
    icon: <TrendingUp className="h-5 w-5 text-teal-600" />,
  },
  'import-export': {
    title: 'Import / Export',
    description: 'Kelola data melalui import dan export Excel/PDF',
    icon: <FileSpreadsheet className="h-5 w-5 text-teal-600" />,
  },
};

function DashboardSection() {
  return (
    <div className="space-y-6">
      <StatsCards />
      <DashboardCharts />
    </div>
  );
}

function DataProduksiSection() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  return (
    <div className="space-y-4">
      <FilterBar />
      <DataTable
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}

function PetaLokasiSection() {
  return (
    <div className="space-y-4">
      <FilterBar />
      <MapView />
    </div>
  );
}

function TrenLaporanSection() {
  return (
    <div className="space-y-4">
      <FilterBar />
      <ReportTables />
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
          className="bg-teal-600 hover:bg-teal-700 gap-2"
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
  const meta = sectionMeta[activeSection] || sectionMeta['dashboard'];

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
      case 'import-export':
        return <ImportExportSection />;
      default:
        return <DashboardSection />;
    }
  };

  return (
    <AppShell>
      {/* Section Header */}
      <div className="mb-4 sm:mb-6 animate-fade-in-up">
        <div className="flex items-center gap-2.5 mb-1">
          {meta.icon}
          <h2 className="text-lg sm:text-xl font-bold text-foreground">{meta.title}</h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground ml-8">
          {meta.description}
        </p>
      </div>

      {/* Section Content */}
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
