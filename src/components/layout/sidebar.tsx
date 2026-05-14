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
  Split,
  Lock,
  LogOut,
  Shield,
  CreditCard,
  Brain,
} from 'lucide-react';
import { useFilterStore } from '@/store/filter-store';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';

const menuItems = [
  { id: 'dashboard', label: 'Ringkasan Produksi', icon: LayoutDashboard, description: 'Ringkasan & statistik', adminOnly: false },
  { id: 'data-produksi', label: 'Data Pembudidaya', icon: Database, description: 'Tabel data lengkap', adminOnly: false },
  { id: 'peta-lokasi', label: 'Peta Lokasi', icon: Map, description: 'Sebaran lokasi budidaya', adminOnly: false },
  { id: 'tren-laporan', label: 'Tren & Laporan', icon: TrendingUp, description: 'Analisis tren produksi', adminOnly: false },
  { id: 'tren-v2', label: 'Tren V2 (Triwulan)', icon: ExternalLink, description: 'Data tren versi triwulan', adminOnly: false },
  { id: 'harga-komoditas', label: 'Harga Komoditas', icon: DollarSign, description: 'Daftar harga ikan', adminOnly: false },
  { id: 'data-kusuka', label: 'Data KUSUKA', icon: CreditCard, description: 'Registrasi KUSUKA', adminOnly: false },
  { id: 'knowledge-base', label: 'Basis Pengetahuan', icon: Brain, description: 'Upload dokumen untuk AI', adminOnly: false },
  { id: 'disagregasi', label: 'Disagregasi Data', icon: Split, description: 'Distribusi data agregat', adminOnly: true },
  { id: 'import-export', label: 'Import / Export', icon: FileSpreadsheet, description: 'Kelola data Excel/PDF', adminOnly: false },
  { id: 'admin-login', label: 'Login Admin', icon: Lock, description: 'Akses fitur khusus admin', adminOnly: false },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const activeSection = useFilterStore((s) => s.activeSection);
  const setActiveSection = useFilterStore((s) => s.setActiveSection);
  const isAdmin = useFilterStore((s) => s.isAdmin);
  const setIsAdmin = useFilterStore((s) => s.setIsAdmin);
  const { theme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? theme === 'dark' : true;

  const handleMenuClick = (section: string) => {
    const item = menuItems.find((m) => m.id === section);
    if (item?.adminOnly && !isAdmin) {
      // Redirect to admin login section instead of showing inline form
      setActiveSection('admin-login');
      onClose();
      return;
    }
    setActiveSection(section);
    onClose();
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    if (activeSection === 'disagregasi' || activeSection === 'admin-login') {
      setActiveSection('dashboard');
    }
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
        className="fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-300"
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
          className="shrink-0 p-5"
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
            <span style={{ color: '#06B6D4' }}>Dinas Pertanian Ketahanan Pangan dan Perikanan Kab. Mempawah</span>
          </p>
        </div>

        {/* Admin status section */}
        <div
          className="shrink-0 px-4 py-3"
          style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          {isAdmin ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                    boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
                  }}
                >
                  <Shield className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: '#06B6D4' }}>Admin</p>
                  <p className="text-[10px] text-muted-foreground">Akses penuh aktif</p>
                </div>
              </div>
              <button
                onClick={handleAdminLogout}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-3 w-3" />
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setActiveSection('admin-login');
                onClose();
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
              style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              }}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Login Admin untuk fitur khusus</span>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="p-3 flex-1 overflow-y-auto">
          <div
            className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2"
            style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}
          >
            Navigasi
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const isLocked = item.adminOnly && !isAdmin;
            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left mb-0.5 group transition-all"
                style={{
                  background: isActive && !isLocked
                    ? 'linear-gradient(135deg, #06B6D4, #0891B2)'
                    : 'transparent',
                  color: isActive && !isLocked ? 'white' : isLocked ? 'var(--muted-foreground)' : 'var(--muted-foreground)',
                  boxShadow: isActive && !isLocked ? '0 4px 16px rgba(6,182,212,0.3)' : 'none',
                  opacity: isLocked ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isActive || isLocked) {
                    e.currentTarget.style.background = 'rgba(6,182,212,0.1)';
                    e.currentTarget.style.color = '#22D3EE';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive || isLocked) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--muted-foreground)';
                  }
                }}
              >
                <Icon size={15} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium block truncate">
                    {item.label}
                    {isLocked && <Lock className="h-3 w-3 inline ml-1.5" />}
                  </span>
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
          className="shrink-0 p-4"
          style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}
        >
          <div className="text-[10px] text-center" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>
            &copy; {new Date().getFullYear()} Dinas Pertanian Ketahanan Pangan dan Perikanan Kab. Mempawah<br />
            <span style={{ color: '#06B6D4' }}>Kalimantan Barat</span>
          </div>
        </div>
      </aside>
    </>
  );
}
