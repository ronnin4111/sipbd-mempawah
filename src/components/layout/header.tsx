'use client';

import { useState, useEffect } from 'react';
import { Menu, Moon, Sun, Fish } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useFilterStore } from '@/store/filter-store';
import { useMounted } from '@/hooks/use-mounted';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const mounted = useMounted();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const isDark = mounted ? theme === 'dark' : true;

  const headerBg = scrolled
    ? isDark
      ? 'rgba(7,14,26,0.97)'
      : 'rgba(240,246,255,0.97)'
    : 'transparent';

  return (
    <header
      className="sticky top-0 z-40 transition-all duration-300"
      style={{
        background: headerBg,
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        boxShadow: scrolled
          ? isDark
            ? '0 2px 24px rgba(0,0,0,0.25)'
            : '0 2px 24px rgba(0,0,0,0.08)'
          : 'none',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 max-w-screen-2xl mx-auto">
        {/* Hamburger */}
        <button
          onClick={onMenuClick}
          className="w-10 h-10 flex items-center justify-center rounded-xl transition-all"
          style={{
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(8,145,178,0.08)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(8,145,178,0.15)'}`,
          }}
          aria-label="Buka menu navigasi"
        >
          <div className="flex flex-col gap-1.5 w-5">
            <span className="block h-0.5 rounded-full transition-all duration-300"
              style={{ background: isDark ? '#7DD3FC' : '#0891B2' }} />
            <span className="block h-0.5 rounded-full transition-all duration-300"
              style={{ background: isDark ? '#7DD3FC' : '#0891B2' }} />
            <span className="block h-0.5 rounded-full transition-all duration-300"
              style={{ background: isDark ? '#7DD3FC' : '#0891B2' }} />
          </div>
        </button>

        {/* Logo + Title */}
        <div className="flex items-center gap-3 flex-1 justify-center">
          <div className="relative">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #0891B2, #14B8A6)',
                boxShadow: '0 4px 16px rgba(8,145,178,0.35)',
              }}
            >
              <Fish size={20} color="white" />
            </div>
            <div
              className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 animate-pulse"
              style={{
                background: '#2DD4BF',
                borderColor: isDark ? '#070E1A' : '#F0F6FF',
              }}
            />
          </div>
          <div className="hidden sm:block">
            <div
              className="font-bold text-sm leading-tight"
              style={{ fontFamily: 'Syne, sans-serif', color: 'var(--foreground)' }}
            >
              SIPBUDIK
            </div>
            <div className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#0891B2' }}>
              Dinas Perikanan Kab. Mempawah
            </div>
          </div>
          <div className="sm:hidden">
            <div className="font-bold text-xs" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--foreground)' }}>
              SIPBUDIK
            </div>
            <div className="text-[9px] tracking-wider uppercase" style={{ color: '#0891B2' }}>Mempawah</div>
          </div>
        </div>

        {/* Dark/Light toggle */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="w-10 h-10 flex items-center justify-center rounded-xl transition-all"
          title={isDark ? 'Mode Terang' : 'Mode Gelap'}
          style={{
            background: isDark ? 'rgba(234,179,8,0.12)' : 'rgba(8,145,178,0.12)',
            border: `1px solid ${isDark ? 'rgba(234,179,8,0.25)' : 'rgba(8,145,178,0.25)'}`,
          }}
        >
          {isDark
            ? <Sun size={16} style={{ color: '#EAB308' }} />
            : <Moon size={16} style={{ color: '#0891B2' }} />
          }
        </button>
      </div>
      <div
        className="h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(8,145,178,0.3), transparent)' }}
      />
    </header>
  );
}
