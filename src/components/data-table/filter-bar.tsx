'use client';

import { Search, X, RotateCcw, ChevronDown } from 'lucide-react';
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
  YEARS,
  KECAMATAN_LIST,
  ALL_DESA,
  FISH_TYPES,
  CONTAINER_TYPES,
  BUSINESS_TYPES,
} from '@/lib/constants';
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
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-dashed">
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px] rounded-sm">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
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
  );
}

export function FilterBar() {
  const {
    years, kecamatan, desa, fishType, containerType, businessType, search,
    setYears, setKecamatan, setDesa, setFishType, setContainerType, setBusinessType, setSearch,
    resetFilters,
  } = useFilterStore();

  const filteredDesaOptions = useMemo(() => {
    if (kecamatan.length === 0) {
      return ALL_DESA.map((d) => d.desa);
    }
    return ALL_DESA
      .filter((d) => kecamatan.includes(d.kecamatan))
      .map((d) => d.desa);
  }, [kecamatan]);

  const yearOptions = YEARS.map(String);

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative w-full sm:w-48">
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

        {/* Filter Dropdowns */}
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
            // Clear desa that are not in selected kecamatan
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

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={resetFilters}
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
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
  );
}
