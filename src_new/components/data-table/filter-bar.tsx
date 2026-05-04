'use client';

import { useState } from 'react';
import { Search, X, RotateCcw, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useFilterStore } from '@/store/filter-store';
import {
  KECAMATAN_LIST,
  ALL_DESA,
  FISH_TYPES,
  CONTAINER_TYPES,
  BUSINESS_TYPES,
} from '@/lib/constants';
import { useAvailableYears } from '@/hooks/use-fish-farms';
import { useMemo } from 'react';

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onToggle,
  searchPlaceholder = 'Cari...',
  emptyText = 'Tidak ditemukan',
}: MultiSelectFilterProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#06B6D4' }}>
        {label}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs justify-between w-full"
            style={{
              background: 'var(--popover)',
              borderColor: selected.length > 0 ? 'rgba(6,182,212,0.4)' : 'var(--border)',
            }}
          >
            <span className="truncate">
              {selected.length === 0 ? `Semua ${label}` : selected.length === 1 ? selected[0] : `${selected.length} dipilih`}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} className="text-xs" />
            <CommandList className="max-h-48">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt}
                    onSelect={() => onToggle(opt)}
                    className="text-xs cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.includes(opt)}
                      className="mr-2 h-3.5 w-3.5"
                    />
                    {opt}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function FilterBar() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    years, kecamatan, desa, fishType, containerType, businessType, search,
    setYears, setKecamatan, setDesa, setFishType, setContainerType, setBusinessType, setSearch,
    resetFilters,
  } = useFilterStore();

  const { data: yearsData } = useAvailableYears();
  const yearOptions = useMemo(() => {
    if (yearsData?.years && yearsData.years.length > 0) {
      return yearsData.years.map(String);
    }
    return ['2020', '2021', '2022', '2023', '2024'];
  }, [yearsData]);

  const filteredDesaOptions = useMemo(() => {
    if (kecamatan.length === 0) {
      return ALL_DESA.map((d) => d.desa);
    }
    return ALL_DESA
      .filter((d) => kecamatan.includes(d.kecamatan))
      .map((d) => d.desa);
  }, [kecamatan]);

  const toggleValue = (current: string[], setter: (v: string[]) => void, value: string) => {
    if (current.includes(value)) {
      setter(current.filter((v) => v !== value));
    } else {
      setter([...current, value]);
    }
  };

  const hasActiveFilters = years.length > 0 || kecamatan.length > 0 || desa.length > 0 ||
    fishType.length > 0 || containerType.length > 0 || businessType.length > 0 || search.length > 0;

  return (
    <div className="glass-card overflow-hidden">
      {/* Filter Header - Toggle */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(!isOpen); } }}
        className="w-full flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-accent/50 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" style={{ color: '#06B6D4' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Filter Data</span>
          {hasActiveFilters && (
            <Badge
              className="h-5 px-1.5 text-[10px]"
              style={{ background: 'rgba(6,182,212,0.15)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.3)' }}
            >
              {years.length + kecamatan.length + desa.length + fishType.length + containerType.length + businessType.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 px-2"
              onClick={(e) => { e.stopPropagation(); resetFilters(); }}
              style={{ color: 'var(--muted-foreground)' }}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          )}
          {isOpen ? (
            <ChevronUp className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          ) : (
            <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          )}
        </div>
      </div>

      {/* Filter Content - Collapsible */}
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
          {/* Search */}
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari data..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs pl-8 pr-8"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MultiSelectFilter
              label="Tahun"
              options={yearOptions}
              selected={years}
              onToggle={(v) => toggleValue(years, setYears, v)}
              searchPlaceholder="Cari tahun..."
              emptyText="Tahun tidak ditemukan"
            />
            <MultiSelectFilter
              label="Kecamatan"
              options={KECAMATAN_LIST}
              selected={kecamatan}
              onToggle={(v) => {
                toggleValue(kecamatan, setKecamatan, v);
                const newKecamatan = kecamatan.includes(v)
                  ? kecamatan.filter((k) => k !== v)
                  : [...kecamatan, v];
                if (newKecamatan.length > 0) {
                  const validDesa = ALL_DESA
                    .filter((d) => newKecamatan.includes(d.kecamatan))
                    .map((d) => d.desa);
                  const filteredDesa = desa.filter((d) => validDesa.includes(d));
                  if (filteredDesa.length !== desa.length) {
                    setDesa(filteredDesa);
                  }
                }
              }}
              searchPlaceholder="Cari kecamatan..."
              emptyText="Kecamatan tidak ditemukan"
            />
            <MultiSelectFilter
              label="Desa"
              options={filteredDesaOptions}
              selected={desa}
              onToggle={(v) => toggleValue(desa, setDesa, v)}
              searchPlaceholder="Cari desa..."
              emptyText="Desa tidak ditemukan"
            />
            <MultiSelectFilter
              label="Jenis Ikan"
              options={FISH_TYPES}
              selected={fishType}
              onToggle={(v) => toggleValue(fishType, setFishType, v)}
              searchPlaceholder="Cari jenis ikan..."
              emptyText="Jenis ikan tidak ditemukan"
            />
            <MultiSelectFilter
              label="Jenis Wadah"
              options={CONTAINER_TYPES}
              selected={containerType}
              onToggle={(v) => toggleValue(containerType, setContainerType, v)}
              searchPlaceholder="Cari jenis wadah..."
              emptyText="Jenis wadah tidak ditemukan"
            />
            <MultiSelectFilter
              label="Jenis Usaha"
              options={BUSINESS_TYPES}
              selected={businessType}
              onToggle={(v) => toggleValue(businessType, setBusinessType, v)}
              searchPlaceholder="Cari jenis usaha..."
              emptyText="Jenis usaha tidak ditemukan"
            />
          </div>

          {/* Active filter badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {years.map((y) => (
                <Badge key={y} variant="secondary" className="text-[10px] h-5 gap-1 pr-1">
                  Tahun: {y}
                  <button onClick={() => setYears(years.filter((v) => v !== y))}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              {kecamatan.map((k) => (
                <Badge key={k} variant="secondary" className="text-[10px] h-5 gap-1 pr-1">
                  Kec: {k}
                  <button onClick={() => setKecamatan(kecamatan.filter((v) => v !== k))}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              {desa.map((d) => (
                <Badge key={d} variant="secondary" className="text-[10px] h-5 gap-1 pr-1">
                  Desa: {d}
                  <button onClick={() => setDesa(desa.filter((v) => v !== d))}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              {fishType.map((f) => (
                <Badge key={f} variant="secondary" className="text-[10px] h-5 gap-1 pr-1">
                  Ikan: {f}
                  <button onClick={() => setFishType(fishType.filter((v) => v !== f))}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              {containerType.map((c) => (
                <Badge key={c} variant="secondary" className="text-[10px] h-5 gap-1 pr-1">
                  Wadah: {c}
                  <button onClick={() => setContainerType(containerType.filter((v) => v !== c))}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              {businessType.map((b) => (
                <Badge key={b} variant="secondary" className="text-[10px] h-5 gap-1 pr-1">
                  Usaha: {b}
                  <button onClick={() => setBusinessType(businessType.filter((v) => v !== b))}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
