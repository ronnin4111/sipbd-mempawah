'use client';
import { useState, useEffect } from 'react';
import {
  Menu, X, Fish, BarChart3, Map, Table, Target, TrendingUp,
  FileSpreadsheet, Upload, ChevronRight, Waves, Sun, Moon
} from 'lucide-react';

const NAV_ITEMS = [
  { icon: BarChart3,    label: 'Ringkasan Produksi',     href: '#summary' },
  { icon: Fish,         label: 'Produksi per Jenis Ikan', href: '#ikan' },
  { icon: BarChart3,    label: 'Produksi per Kecamatan',  href: '#kecamatan' },
  { icon: BarChart3,    label: 'Produksi per Wadah',      href: '#wadah' },
  { icon: TrendingUp,   label: 'Trend 5 Tahunan',         href: '#trend' },
  { icon: Target,       label: 'Target vs Realisasi',      href: '#target' },
  { icon: Map,          label: 'Peta Sebaran',             href: '#peta' },
  { icon: Table,        label: 'Data Pembudidaya',         href: '#tabel' },
  { icon: FileSpreadsheet, label: 'Export Data',           href: '#export' },
  { icon: Upload,       label: 'Import Data',              href: '#import' },
];

export default function Header() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrolled, setScrolled]       = useState(false);
  const [darkMode, setDarkMode]       = useState(true);

  // Persist theme preference
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') setDarkMode(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.style.setProperty('--color-bg',       '#070E1A');
      document.documentElement.style.setProperty('--color-surface',  '#0D1B2E');
      document.documentElement.style.setProperty('--color-surface2', '#112240');
      document.documentElement.style.setProperty('--color-border',   'rgba(255,255,255,0.07)');
      document.documentElement.style.setProperty('--color-text',     '#E2EDF5');
      document.documentElement.style.setProperty('--color-muted',    '#6B8FAE');
      document.body.style.background = '#070E1A';
      document.body.style.color      = '#E2EDF5';
    } else {
      document.documentElement.style.setProperty('--color-bg',       '#F0F6FF');
      document.documentElement.style.setProperty('--color-surface',  '#FFFFFF');
      document.documentElement.style.setProperty('--color-surface2', '#EAF2FF');
      document.documentElement.style.setProperty('--color-border',   'rgba(0,0,0,0.08)');
      document.documentElement.style.setProperty('--color-text',     '#0F2942');
      document.documentElement.style.setProperty('--color-muted',    '#5A7FA0');
      document.body.style.background = '#F0F6FF';
      document.body.style.color      = '#0F2942';
    }
  }, [darkMode]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navigate = (href) => {
    setSidebarOpen(false);
    setTimeout(() => {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const headerBg = scrolled
    ? (darkMode ? 'rgba(7,14,26,0.97)' : 'rgba(240,246,255,0.97)')
    : 'transparent';

  return (
    <>
      {/* ── HEADER ── */}
      <header
        className="fixed top-0 left-0 right-0 z-30 transition-all duration-300"
        style={{
          background: headerBg,
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          boxShadow: scrolled ? '0 2px 24px rgba(0,0,0,0.25)' : 'none',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 max-w-screen-2xl mx-auto">
          {/* Hamburger */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all"
            style={{
              background: sidebarOpen ? 'rgba(8,145,178,0.2)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${sidebarOpen ? 'rgba(8,145,178,0.4)' : 'rgba(255,255,255,0.1)'}`,
            }}
            aria-label="Menu"
          >
            <div className="flex flex-col gap-1.5 w-5">
              <span className="block h-0.5 rounded-full transition-all duration-300"
                style={{ background: '#7DD3FC', transform: sidebarOpen ? 'rotate(45deg) translateY(8px)' : 'none' }} />
              <span className="block h-0.5 rounded-full transition-all duration-300"
                style={{ background: '#7DD3FC', opacity: sidebarOpen ? 0 : 1 }} />
              <span className="block h-0.5 rounded-full transition-all duration-300"
                style={{ background: '#7DD3FC', transform: sidebarOpen ? 'rotate(-45deg) translateY(-8px)' : 'none' }} />
            </div>
          </button>

          {/* Logo + Title */}
          <div className="flex items-center gap-3 flex-1 justify-center">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                style={{ background: 'linear-gradient(135deg, #0891B2, #14B8A6)', boxShadow: '0 4px 16px rgba(8,145,178,0.35)' }}>
                <Fish size={20} color="white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 animate-pulse"
                style={{ background: '#2DD4BF', borderColor: darkMode ? '#070E1A' : '#F0F6FF' }} />
            </div>
            <div className="hidden sm:block">
              <div className="font-bold text-sm leading-tight" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--color-text)' }}>
                SIPBD MEMPAWAH
              </div>
              <div className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#0891B2' }}>
                Dinas Perikanan Kab. Mempawah
              </div>
            </div>
            <div className="sm:hidden">
              <div className="font-bold text-xs" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--color-text)' }}>SIPBD</div>
              <div className="text-[9px] tracking-wider uppercase" style={{ color: '#0891B2' }}>Mempawah</div>
            </div>
          </div>

          {/* Dark/Light toggle */}
          <button
            onClick={() => setDarkMode(v => !v)}
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all"
            title={darkMode ? 'Mode Terang' : 'Mode Gelap'}
            style={{
              background: darkMode ? 'rgba(234,179,8,0.12)' : 'rgba(8,145,178,0.12)',
              border: `1px solid ${darkMode ? 'rgba(234,179,8,0.25)' : 'rgba(8,145,178,0.25)'}`,
            }}
          >
            {darkMode
              ? <Sun size={16} style={{ color: '#EAB308' }} />
              : <Moon size={16} style={{ color: '#0891B2' }} />
            }
          </button>
        </div>
        <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(8,145,178,0.3), transparent)' }} />
      </header>

      {/* ── SIDEBAR OVERLAY ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 transition-opacity"
          style={{ background: 'rgba(7,14,26,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className="fixed top-0 left-0 h-full z-50 overflow-y-auto transition-transform duration-300"
        style={{
          width: 290,
          background: darkMode
            ? 'linear-gradient(160deg, #0D1B2E 0%, #091525 100%)'
            : 'linear-gradient(160deg, #FFFFFF 0%, #EAF2FF 100%)',
          borderRight: `1px solid ${darkMode ? 'rgba(8,145,178,0.2)' : 'rgba(8,145,178,0.15)'}`,
          boxShadow: sidebarOpen ? '8px 0 40px rgba(0,0,0,0.4)' : 'none',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Sidebar header */}
        <div className="p-5" style={{ borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #0891B2, #14B8A6)' }}>
                <Fish size={17} color="white" />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--color-text)' }}>
                  SIPBD
                </div>
                <div className="text-[10px]" style={{ color: '#0891B2' }}>Perikanan Budidaya</div>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <X size={14} style={{ color: 'var(--color-muted)' }} />
            </button>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>
            Sistem Informasi Perikanan Budidaya<br />
            <span style={{ color: '#0891B2' }}>Dinas Perikanan Kab. Mempawah</span>
          </p>
        </div>

        {/* Nav */}
        <nav className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2"
            style={{ color: 'var(--color-muted)', opacity: 0.6 }}>
            Navigasi
          </div>
          {NAV_ITEMS.map((item, i) => (
            <button
              key={i}
              onClick={() => navigate(item.href)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left mb-0.5 group transition-all"
              style={{ color: 'var(--color-muted)' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(8,145,178,0.1)';
                e.currentTarget.style.color = '#38BDF8';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--color-muted)';
              }}
            >
              <item.icon size={15} className="shrink-0" />
              <span className="text-sm font-medium flex-1">{item.label}</span>
              <ChevronRight size={12} style={{ opacity: 0.4 }} />
            </button>
          ))}
        </nav>

        {/* Theme toggle in sidebar */}
        <div className="px-4 pb-2">
          <button
            onClick={() => setDarkMode(v => !v)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-sm font-medium"
            style={{
              background: darkMode ? 'rgba(234,179,8,0.08)' : 'rgba(8,145,178,0.08)',
              border: `1px solid ${darkMode ? 'rgba(234,179,8,0.2)' : 'rgba(8,145,178,0.2)'}`,
              color: darkMode ? '#EAB308' : '#0891B2',
            }}
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            {darkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          </button>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4"
          style={{ borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
          <div className="text-[10px] text-center" style={{ color: 'var(--color-muted)', opacity: 0.5 }}>
            © 2024 Dinas Perikanan Kab. Mempawah<br />
            <span style={{ color: '#0891B2' }}>Kalimantan Barat</span>
          </div>
        </div>
      </aside>
    </>
  );
}
