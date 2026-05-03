'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppShell } from '@/components/layout/app-shell';
import { DashboardCharts } from '@/components/dashboard/charts';
import { FilterBar } from '@/components/data-table/filter-bar';
import { DataTable } from '@/components/data-table/data-table';
import { MapView } from '@/components/map/map-view';
import { ReportTables } from '@/components/tables/report-tables';
import { ImportDialog } from '@/components/import-export/import-dialog';
import { ExportSection } from '@/components/import-export/export-section';
import { useFilterStore } from '@/store/filter-store';
import { HeroBanner } from '@/components/layout/hero-banner';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

function DashboardSection() {
  return (
    <div className="space-y-6">
      <HeroBanner />
      <FilterBar />
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
      case 'import-export':
        return <ImportExportSection />;
      default:
        return <DashboardSection />;
    }
  };

  return (
    <AppShell>
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
