'use client';

import { useState, useEffect } from 'react';
import { Menu, Moon, Sun, Lock } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useFilterStore } from '@/store/filter-store';
import { useMounted } from '@/hooks/use-mounted';

interface HeaderProps {
  onMenuClick: () => void;
}

const NAV_TABS = [
  { id: 'dashboard', label: 'Dashboard', adminOnly: false },
  { id: 'data-produksi', label: 'Data Produksi', adminOnly: false },
  { id: 'peta-lokasi', label: 'Peta Lokasi', adminOnly: false },
  { id: 'tren-laporan', label: 'Tren & Laporan', adminOnly: false },
  { id: 'tren-v2', label: 'Tren V2', adminOnly: false },
  { id: 'harga-komoditas', label: 'Harga Komoditas', adminOnly: false },
  { id: 'disagregasi', label: 'Disagregasi', adminOnly: true },
  { id: 'import-export', label: 'Import / Export', adminOnly: false },
];

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const mounted = useMounted();
  const activeSection = useFilterStore((s) => s.activeSection);
  const setActiveSection = useFilterStore((s) => s.setActiveSection);
  const isAdmin = useFilterStore((s) => s.isAdmin);

  const isDark = mounted ? theme === 'dark' : true;

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleTabClick = (tab: typeof NAV_TABS[number]) => {
    if (tab.adminOnly && !isAdmin) {
      // Open sidebar for login
      onMenuClick();
      return;
    }
    setActiveSection(tab.id);
  };

  return (
    <header
      className="sticky top-0 z-40 transition-all duration-300"
      style={{
        background: scrolled
          ? isDark
            ? 'rgba(7,14,26,0.97)'
            : 'rgba(240,246,255,0.97)'
          : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        boxShadow: scrolled
          ? isDark
            ? '0 2px 24px rgba(0,0,0,0.25)'
            : '0 2px 24px rgba(0,0,0,0.08)'
          : 'none',
      }}
    >
      {/* Hero Title Section */}
      <div className="px-4 pt-4 pb-2 max-w-screen-2xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Hamburger + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuClick}
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-all lg:hidden"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(6,182,212,0.08)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(6,182,212,0.15)'}`,
              }}
              aria-label="Buka menu navigasi"
            >
              <div className="flex flex-col gap-1.5 w-5">
                <span className="block h-0.5 rounded-full" style={{ background: isDark ? '#7DD3FC' : '#0891B2' }} />
                <span className="block h-0.5 rounded-full" style={{ background: isDark ? '#7DD3FC' : '#0891B2' }} />
                <span className="block h-0.5 rounded-full" style={{ background: isDark ? '#7DD3FC' : '#0891B2' }} />
              </div>
            </button>
            <div className="relative">
              <img
                src="/logo-mempawah.png"
                alt="Logo Kabupaten Mempawah"
                className="w-10 h-10 rounded-xl object-contain shadow-lg"
                style={{
                  background: 'rgba(255,255,255,0.9)',
                  padding: 2,
                  boxShadow: '0 4px 16px rgba(6,182,212,0.35)',
                }}
              />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--foreground)' }}>
                SIPBD
              </div>
              <div className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#06B6D4' }}>
                Dinas Perikanan Kab. Mempawah
              </div>
            </div>
          </div>

          {/* Center Title - hidden on mobile */}
          <div className="hidden md:flex flex-col items-center">
            <h1 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--foreground)' }}>
              Sistem Informasi{' '}
              <span className="glow-text" style={{ color: '#06B6D4' }}>Perikanan Budidaya</span>
            </h1>
          </div>

          {/* Dark/Light toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all"
            title={isDark ? 'Mode Terang' : 'Mode Gelap'}
            style={{
              background: isDark ? 'rgba(234,179,8,0.12)' : 'rgba(6,182,212,0.12)',
              border: `1px solid ${isDark ? 'rgba(234,179,8,0.25)' : 'rgba(6,182,212,0.25)'}`,
            }}
          >
            {isDark
              ? <Sun size={16} style={{ color: '#EAB308' }} />
              : <Moon size={16} style={{ color: '#0891B2' }} />
            }
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-4 pb-0 max-w-screen-2xl mx-auto">
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0">
          {NAV_TABS.map((tab) => {
            const isActive = activeSection === tab.id;
            const isLocked = tab.adminOnly && !isAdmin;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className="relative px-3 py-2 text-xs font-medium whitespace-nowrap transition-all rounded-t-lg flex items-center gap-1"
                style={{
                  color: isActive ? '#06B6D4' : isLocked ? 'var(--muted-foreground)' : 'var(--muted-foreground)',
                  background: isActive
                    ? isDark ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.08)'
                    : 'transparent',
                  opacity: isLocked ? 0.5 : 1,
                }}
              >
                {tab.label}
                {isLocked && <Lock className="h-2.5 w-2.5" />}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: 'linear-gradient(90deg, #06B6D4, #0891B2)' }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom divider */}
      <div
        className="h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.3), transparent)' }}
      />
    </header>
  );
}
