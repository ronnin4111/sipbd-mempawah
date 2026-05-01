'use client';

import {
  LayoutDashboard,
  Database,
  Map,
  TrendingUp,
  FileSpreadsheet,
  Fish,
} from 'lucide-react';
import { useFilterStore } from '@/store/filter-store';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Ringkasan & statistik' },
  { id: 'data-produksi', label: 'Data Produksi', icon: Database, description: 'Tabel data lengkap' },
  { id: 'peta-lokasi', label: 'Peta Lokasi', icon: Map, description: 'Sebaran lokasi budidaya' },
  { id: 'tren-laporan', label: 'Tren & Laporan', icon: TrendingUp, description: 'Analisis tren produksi' },
  { id: 'import-export', label: 'Import / Export', icon: FileSpreadsheet, description: 'Kelola data Excel/PDF' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const activeSection = useFilterStore((s) => s.activeSection);
  const setActiveSection = useFilterStore((s) => s.setActiveSection);

  const handleMenuClick = (section: string) => {
    setActiveSection(section);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shrink-0 shadow-md">
              <Fish className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base font-bold text-left">SIPBUDIK</SheetTitle>
              <p className="text-[10px] text-muted-foreground truncate">Dinas Perikanan Kab. Mempawah</p>
            </div>
          </div>
        </SheetHeader>

        <Separator />

        <ScrollArea className="flex-1 px-2 py-3">
          <nav className="flex flex-col gap-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleMenuClick(item.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 w-full text-left group',
                    isActive
                      ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className={cn(
                    'h-5 w-5 shrink-0 transition-transform duration-200',
                    isActive ? 'text-white' : 'group-hover:scale-110'
                  )} />
                  <div className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    <span className={cn(
                      'block text-[10px] truncate',
                      isActive ? 'text-white/70' : 'text-muted-foreground/60'
                    )}>
                      {item.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>
        </ScrollArea>

        <Separator />

        <div className="p-4">
          <div className="rounded-lg bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30 p-3">
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              Sistem Informasi Perikanan Budidaya<br />
              Kabupaten Mempawah<br />
              <span className="text-teal-600 dark:text-teal-400">&copy; {new Date().getFullYear()}</span>
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
