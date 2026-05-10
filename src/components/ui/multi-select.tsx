'use client';

import * as React from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Pilih...',
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((s) => s !== value));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-9 w-full justify-between text-xs font-normal',
            selected.length === 0 && 'text-muted-foreground',
            className,
          )}
        >
          <div className="flex flex-wrap gap-0.5 flex-1 overflow-hidden min-w-0">
            {selected.length === 0 ? (
              <span>{placeholder}</span>
            ) : selected.length <= 2 ? (
              selected.map((s) => (
                <Badge
                  key={s}
                  variant="secondary"
                  className="h-5 text-[10px] px-1.5 gap-0.5 shrink-0"
                  style={{
                    background: 'rgba(6,182,212,0.15)',
                    color: '#06B6D4',
                    border: 'none',
                  }}
                >
                  {s}
                  <button onClick={(e) => handleRemove(s, e)}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))
            ) : (
              <Badge
                variant="secondary"
                className="h-5 text-[10px] px-1.5 shrink-0"
                style={{
                  background: 'rgba(6,182,212,0.15)',
                  color: '#06B6D4',
                  border: 'none',
                }}
              >
                {selected.length} dipilih
              </Badge>
            )}
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2 border-b">
          <button
            onClick={handleSelectAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left px-1"
          >
            {selected.length === options.length ? 'Hapus semua' : 'Pilih semua'}
          </button>
        </div>
        <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
          {options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <button
                key={option}
                onClick={() => handleToggle(option)}
                className={cn(
                  'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-left transition-colors',
                  isSelected ? 'bg-cyan-500/10' : 'hover:bg-accent',
                )}
              >
                <Checkbox
                  checked={isSelected}
                  className="h-3.5 w-3.5 pointer-events-none"
                />
                <span className={isSelected ? 'font-medium' : ''}>{option}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
