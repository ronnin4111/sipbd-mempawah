'use client';

import {
  LayoutDashboard,
  Database,
  Map,
  TrendingUp,
  DollarSign,
  FileSpreadsheet,
  ExternalLink,
  ChevronRight,
  X,
} from 'lucide-react';
import { useFilterStore } from '@/store/filter-store';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';

const menuItems = [
  { id: 'dashboard', label: 'Ringkasan Produksi', icon: LayoutDashboard, description: 'Ringkasan & statistik' },
  { id: 'data-produksi', label: 'Data Produksi', icon: Database, description: 'Tabel data lengkap' },
  { id: 'peta-lokasi', label: 'Peta Lokasi', icon: Map, description: 'Sebaran lokasi budidaya' },
  { id: 'tren-laporan', label: 'Tren & Laporan', icon: TrendingUp, description: 'Analisis tren produksi' },
  { id: 'tren-v2', label: 'Tren V2 (Triwulan)', icon: ExternalLink, description: 'Data tren versi triwulan' },
  { id: 'harga-komoditas', label: 'Harga Komoditas', icon: DollarSign, description: 'Daftar harga ikan' },
  { id: 'import-export', label: 'Import / Export', icon: FileSpreadsheet, description: 'Kelola data Excel/PDF' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const activeSection = useFilterStore((s) => s.activeSection);
  const setActiveSection = useFilterStore((s) => s.setActiveSection);
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  const handleMenuClick = (section: string) => {
    setActiveSection(section);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 transition-opacity"
          style={{ background: 'rgba(7,14,26,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className="fixed top-0 left-0 h-full z-50 overflow-y-auto transition-transform duration-300"
        style={{
          width: 290,
          background: isDark
            ? 'linear-gradient(160deg, #070E1A 0%, #0D1B2E 100%)'
            : 'linear-gradient(160deg, #FFFFFF 0%, #EAF2FF 100%)',
          borderRight: `1px solid ${isDark ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.15)'}`,
          boxShadow: open ? '8px 0 40px rgba(0,0,0,0.4)' : 'none',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Sidebar header */}
        <div
          className="p-5"
          style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo-mempawah.png"
                alt="Logo Kabupaten Mempawah"
                className="w-9 h-9 rounded-xl object-contain"
                style={{ background: 'rgba(255,255,255,0.9)', padding: 2 }}
              />
              <div>
                <div className="text-sm font-bold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--foreground)' }}>
                  SIPBD
                </div>
                <div className="text-[10px]" style={{ color: '#06B6D4' }}>Perikanan Budidaya</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
            >
              <X size={14} style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            Sistem Informasi Perikanan Budidaya<br />
            <span style={{ color: '#06B6D4' }}>Dinas Perikanan Kab. Mempawah</span>
          </p>
        </div>

        {/* Nav */}
        <nav className="p-3">
          <div
            className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2"
            style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}
          >
            Navigasi
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left mb-0.5 group transition-all"
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, #06B6D4, #0891B2)'
                    : 'transparent',
                  color: isActive ? 'white' : 'var(--muted-foreground)',
                  boxShadow: isActive ? '0 4px 16px rgba(6,182,212,0.3)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(6,182,212,0.1)';
                    e.currentTarget.style.color = '#22D3EE';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--muted-foreground)';
                  }
                }}
              >
                <Icon size={15} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium block truncate">{item.label}</span>
                  <span className="block text-[10px] truncate" style={{ opacity: 0.6 }}>
                    {item.description}
                  </span>
                </div>
                <ChevronRight size={12} style={{ opacity: 0.4 }} />
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          className="absolute bottom-0 left-0 right-0 p-4"
          style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}
        >
          <div className="text-[10px] text-center" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>
            &copy; {new Date().getFullYear()} Dinas Perikanan Kab. Mempawah<br />
            <span style={{ color: '#06B6D4' }}>Kalimantan Barat</span>
          </div>
        </div>
      </aside>
    </>
  );
}
