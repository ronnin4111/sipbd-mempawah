'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { VisibilityState } from '@tanstack/react-table';

const SETTINGS_KEY = 'columnVisibility';

export function useColumnVisibility() {
  return useQuery<VisibilityState>({
    queryKey: ['app-settings', SETTINGS_KEY],
    queryFn: async () => {
      const res = await fetch(`/api/settings?key=${SETTINGS_KEY}`);
      if (!res.ok) throw new Error('Failed to fetch column visibility');
      const data = await res.json();
      if (data.value) {
        try {
          return JSON.parse(data.value) as VisibilityState;
        } catch {
          return {};
        }
      }
      return {};
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export function useSaveColumnVisibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ password, visibility }: { password: string; visibility: VisibilityState }) => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, key: SETTINGS_KEY, value: visibility }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan pengaturan kolom');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings', SETTINGS_KEY] });
    },
  });
}
