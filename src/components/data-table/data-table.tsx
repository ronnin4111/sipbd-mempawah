'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ArrowUpDown, Eye, Lock, Unlock, Pencil, Trash2, Plus, X, Check, Loader2,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFishFarms, useCreateFishFarm, useUpdateFishFarm, useDeleteFishFarm, type FishFarm } from '@/hooks/use-fish-farms';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  KECAMATAN_LIST,
  ALL_DESA,
  FISH_TYPES,
  CONTAINER_TYPES,
  BUSINESS_TYPES,
} from '@/lib/constants';
import { toast } from 'sonner';

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);
const formatCurrency = (num: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

interface DataTableProps {
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

// Column label mapping
const COLUMN_LABELS: Record<string, string> = {
  no: 'No',
  year: 'Tahun',
  kecamatan: 'Kecamatan',
  desa: 'Desa',
  fishType: 'Jenis Ikan',
  containerType: 'Jenis Wadah',
  businessType: 'Jenis Usaha',
  farmerName: 'Nama Pembudidaya',
  groupName: 'Nama Kelompok',
  productionQty: 'Produksi',
  rtpCount: 'RTP',
  farmerCount: 'Pembudidaya',
  groupCount: 'Kelompok',
  targetQty: 'Target',
  productionValue: 'Nilai Produksi',
  kusuka: 'KUSUKA',
  cpib: 'CPIB',
  cbib: 'CBIB',
  actions: 'Aksi',
};

export function DataTable({ page, pageSize, onPageChange, onPageSizeChange }: DataTableProps) {
  const { data, isLoading, isError } = useFishFarms(page, pageSize);
  const createMutation = useCreateFishFarm();
  const updateMutation = useUpdateFishFarm();
  const deleteMutation = useDeleteFishFarm();
  const isMobile = useIsMobile();

  // Default column visibility for mobile — hide less important columns
  const MOBILE_HIDDEN_COLUMNS: VisibilityState = {
    desa: false,
    containerType: false,
    farmerName: false,
    groupName: false,
    rtpCount: false,
    farmerCount: false,
    groupCount: false,
    targetQty: false,
    productionValue: false,
    kusuka: false,
    cpib: false,
    cbib: false,
  };

  // Get initial column visibility: saved preference > mobile default > all visible
  const getInitialVisibility = (): VisibilityState => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('fishFarm_columnVisibility');
        if (saved) return JSON.parse(saved) as VisibilityState;
      } catch {}
      // No saved preference — apply mobile defaults if on mobile
      if (window.innerWidth < 768) {
        return { ...MOBILE_HIDDEN_COLUMNS };
      }
    }
    return {};
  };

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(getInitialVisibility);

  // Track whether user has manually customized columns (via Kolom popover)
  const [userCustomized, setUserCustomized] = useState(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('fishFarm_columnVisibility_userSet');
    }
    return false;
  });

  // When viewport changes between mobile/desktop and user hasn't customized, apply defaults
  useEffect(() => {
    if (userCustomized) return; // Respect user's explicit choices
    if (isMobile) {
      setColumnVisibility({ ...MOBILE_HIDDEN_COLUMNS });
    } else {
      setColumnVisibility({});
    }
  }, [isMobile, userCustomized]);

  // Save to localStorage whenever columnVisibility changes
  useEffect(() => {
    try {
      localStorage.setItem('fishFarm_columnVisibility', JSON.stringify(columnVisibility));
    } catch {}
  }, [columnVisibility]);

  // Wrapper for setColumnVisibility that marks user customization
  const handleColumnVisibilityChange = useCallback((updaterOrValue: VisibilityState | ((old: VisibilityState) => VisibilityState)) => {
    setColumnVisibility(updaterOrValue);
    setUserCustomized(true);
    try {
      localStorage.setItem('fishFarm_columnVisibility_userSet', '1');
    } catch {}
  }, []);

  const [sorting, setSorting] = useState<SortingState>([]);

  // Password protection state
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordPurpose, setPasswordPurpose] = useState<'columns' | 'edit'>('columns');

  // Edit/Add dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<FishFarm | null>(null);
  const [formData, setFormData] = useState<Partial<FishFarm>>({});

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<FishFarm | null>(null);

  // Verify password
  const handleVerifyPassword = useCallback(async (purpose: 'columns' | 'edit') => {
    if (!adminPassword.trim()) {
      toast.error('Masukkan password terlebih dahulu');
      return;
    }
    setVerifyingPassword(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      const result = await res.json();
      if (result.valid) {
        setIsAdminUnlocked(true);
        setShowPasswordDialog(false);
        toast.success('Password benar');
        if (purpose === 'edit') {
          // If purpose was to edit/add, the dialog will open after unlock
        }
      } else {
        toast.error('Password salah');
      }
    } catch {
      toast.error('Gagal memverifikasi password');
    } finally {
      setVerifyingPassword(false);
    }
  }, [adminPassword]);

  // Request access for a protected feature
  const requestAccess = useCallback((purpose: 'columns' | 'edit') => {
    if (isAdminUnlocked) return true;
    setPasswordPurpose(purpose);
    setAdminPassword('');
    setShowPasswordDialog(true);
    return false;
  }, [isAdminUnlocked]);

  // Handle column visibility toggle
  const handleColumnToggle = useCallback(() => {
    if (!requestAccess('columns')) return;
  }, [requestAccess]);

  // Handle edit row
  const handleEditRow = useCallback((row: FishFarm) => {
    if (!isAdminUnlocked) {
      setPasswordPurpose('edit');
      setAdminPassword('');
      setShowPasswordDialog(true);
      return;
    }
    setEditingRow(row);
    setFormData({
      year: row.year,
      kecamatan: row.kecamatan,
      desa: row.desa,
      fishType: row.fishType,
      containerType: row.containerType,
      businessType: row.businessType,
      farmerName: row.farmerName,
      groupName: row.groupName,
      productionQty: row.productionQty,
      rtpCount: row.rtpCount,
      farmerCount: row.farmerCount,
      groupCount: row.groupCount,
      targetQty: row.targetQty,
      productionValue: row.productionValue,
      latitude: row.latitude,
      longitude: row.longitude,
      kusuka: row.kusuka ?? '',
      cpib: row.cpib ?? false,
      cbib: row.cbib ?? false,
    });
    setEditDialogOpen(true);
  }, [isAdminUnlocked]);

  // Handle add row
  const handleAddRow = useCallback(() => {
    if (!isAdminUnlocked) {
      setPasswordPurpose('edit');
      setAdminPassword('');
      setShowPasswordDialog(true);
      return;
    }
    setEditingRow(null);
    setFormData({
      year: new Date().getFullYear(),
      kecamatan: '',
      desa: '',
      fishType: '',
      containerType: '',
      businessType: 'Pembesaran',
      farmerName: '',
      groupName: '',
      productionQty: 0,
      rtpCount: 0,
      farmerCount: 0,
      groupCount: 0,
      targetQty: 0,
      productionValue: 0,
      latitude: 0,
      longitude: 0,
      kusuka: '',
      cpib: false,
      cbib: false,
    });
    setEditDialogOpen(true);
  }, [isAdminUnlocked]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!deleteConfirm || !isAdminUnlocked) return;
    try {
      await deleteMutation.mutateAsync({ password: adminPassword, id: deleteConfirm.id });
      toast.success('Data berhasil dihapus');
      setDeleteConfirm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus data');
    }
  }, [deleteConfirm, isAdminUnlocked, adminPassword, deleteMutation]);

  // Handle save (create or update)
  const handleSave = useCallback(async () => {
    // Validate required fields
    if (!formData.year || !formData.kecamatan || !formData.desa ||
        !formData.fishType || !formData.containerType || !formData.businessType) {
      toast.error('Lengkapi field wajib: Tahun, Kecamatan, Desa, Jenis Ikan, Jenis Wadah, Jenis Usaha');
      return;
    }

    try {
      if (editingRow) {
        // Update
        await updateMutation.mutateAsync({
          password: adminPassword,
          id: editingRow.id,
          data: formData,
        });
        toast.success('Data berhasil diperbarui');
      } else {
        // Create
        await createMutation.mutateAsync({
          password: adminPassword,
          data: formData,
        });
        toast.success('Data berhasil ditambahkan');
      }
      setEditDialogOpen(false);
      setEditingRow(null);
      setFormData({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan data');
    }
  }, [formData, editingRow, adminPassword, updateMutation, createMutation]);

  // Filter desa based on selected kecamatan
  const filteredDesaOptions = useMemo(() => {
    if (!formData.kecamatan) return ALL_DESA.map(d => d.desa);
    return ALL_DESA.filter(d => d.kecamatan === formData.kecamatan).map(d => d.desa);
  }, [formData.kecamatan]);

  // Get unit based on business type
  const productionUnit = formData.businessType === 'Pembesaran' ? 'Kg' : 'Ekor';
  const targetUnit = formData.businessType === 'Pembesaran' ? 'Kg' : 'Ekor';

  const columns = useMemo<ColumnDef<FishFarm>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        cell: ({ row }) => {
          return (page - 1) * pageSize + row.index + 1;
        },
        size: 50,
      },
      {
        accessorKey: 'year',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Tahun <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        size: 70,
      },
      {
        accessorKey: 'kecamatan',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Kecamatan <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        size: 120,
      },
      {
        accessorKey: 'desa',
        header: 'Desa',
        size: 120,
      },
      {
        accessorKey: 'fishType',
        header: 'Jenis Ikan',
        size: 100,
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10px] whitespace-nowrap">
            {row.getValue('fishType')}
          </Badge>
        ),
      },
      {
        accessorKey: 'containerType',
        header: 'Jenis Wadah',
        size: 110,
        cell: ({ row }) => (
          <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
            {row.getValue('containerType')}
          </Badge>
        ),
      },
      {
        accessorKey: 'businessType',
        header: 'Jenis Usaha',
        size: 100,
        cell: ({ row }) => (
          <Badge
            className={`text-[10px] whitespace-nowrap badge-${row.getValue('businessType') === 'Pembesaran' ? 'pembesaran' : 'pembenihan'}`}
          >
            {row.getValue('businessType')}
          </Badge>
        ),
      },
      {
        accessorKey: 'farmerName',
        header: 'Nama Pembudidaya',
        size: 150,
        cell: ({ row }) => {
          const val = row.getValue('farmerName') as string;
          return val ? <span className="text-xs">{val}</span> : <span className="text-xs text-muted-foreground">-</span>;
        },
      },
      {
        accessorKey: 'groupName',
        header: 'Nama Kelompok',
        size: 150,
        cell: ({ row }) => {
          const val = row.getValue('groupName') as string;
          return val ? <span className="text-xs">{val}</span> : <span className="text-xs text-muted-foreground">-</span>;
        },
      },
      {
        accessorKey: 'productionQty',
        header: ({ column }) => {
          return (
            <button
              className="flex items-center gap-1"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Produksi <ArrowUpDown className="h-3 w-3" />
            </button>
          );
        },
        size: 110,
        cell: ({ row }) => {
          const qty = row.getValue('productionQty') as number;
          const bt = row.original.businessType;
          const unit = bt === 'Pembesaran' ? 'Kg' : 'Ekor';
          return <span className="text-xs">{formatNumber(qty)} <span className="text-muted-foreground text-[10px]">{unit}</span></span>;
        },
      },
      {
        accessorKey: 'rtpCount',
        header: 'RTP',
        size: 60,
        cell: ({ row }) => formatNumber(row.getValue('rtpCount') as number),
      },
      {
        accessorKey: 'farmerCount',
        header: 'Pembudidaya',
        size: 100,
        cell: ({ row }) => formatNumber(row.getValue('farmerCount') as number),
      },
      {
        accessorKey: 'groupCount',
        header: 'Kelompok',
        size: 80,
        cell: ({ row }) => formatNumber(row.getValue('groupCount') as number),
      },
      {
        accessorKey: 'targetQty',
        header: 'Target',
        size: 100,
        cell: ({ row }) => {
          const qty = row.getValue('targetQty') as number;
          const bt = row.original.businessType;
          const unit = bt === 'Pembesaran' ? 'Kg' : 'Ekor';
          return <span className="text-xs">{formatNumber(qty)} <span className="text-muted-foreground text-[10px]">{unit}</span></span>;
        },
      },
      {
        accessorKey: 'productionValue',
        header: 'Nilai Produksi (Rp)',
        size: 140,
        cell: ({ row }) => formatCurrency(row.getValue('productionValue') as number),
      },
      {
        accessorKey: 'kusuka',
        header: 'KUSUKA',
        size: 140,
        cell: ({ row }) => {
          const val = String(row.getValue('kusuka') || '').trim();
          if (!val) return <span className="text-xs text-muted-foreground">-</span>;
          const isValid = /^\d{16}$/.test(val);
          return isValid ? (
            <span className="text-[10px] font-mono bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded whitespace-nowrap">{val}</span>
          ) : (
            <span className="text-[10px] text-muted-foreground">{val}</span>
          );
        },
      },
      {
        accessorKey: 'cpib',
        header: 'CPIB',
        size: 70,
        cell: ({ row }) => {
          const val = row.getValue('cpib') as boolean;
          return val ? (
            <Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800 whitespace-nowrap">Ya</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          );
        },
      },
      {
        accessorKey: 'cbib',
        header: 'CBIB',
        size: 70,
        cell: ({ row }) => {
          const val = row.getValue('cbib') as boolean;
          return val ? (
            <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 whitespace-nowrap">Ya</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          );
        },
      },
      // Actions column - only visible when admin is unlocked
      ...(isAdminUnlocked ? [{
        id: 'actions',
        header: 'Aksi',
        size: 90,
        cell: ({ row }: { row: { original: FishFarm } }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleEditRow(row.original)}
            >
              <Pencil className="h-3 w-3 text-teal-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setDeleteConfirm(row.original)}
            >
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          </div>
        ),
      }] : []),
    ],
    [page, pageSize, isAdminUnlocked, handleEditRow]
  );

  const tableData = data?.data ?? [];
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: totalPages || -1,
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">
          {isLoading ? 'Memuat data...' :
           isError ? 'Gagal memuat data' :
           data ? `${formatNumber(data.total)} data ditemukan` : 'Memuat...'}
        </p>
        <div className="flex items-center gap-2">
          {/* Add button - requires password */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleAddRow}
          >
            <Plus className="h-3 w-3" />
            Tambah
          </Button>

          {/* Column visibility - requires password */}
          {isAdminUnlocked ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <Eye className="h-3 w-3" />
                  Kolom
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="end">
                <div className="space-y-1">
                  {table
                    .getAllColumns()
                    .filter((col) => col.getCanHide() && col.id !== 'actions')
                    .map((col) => (
                      <label
                        key={col.id}
                        className="flex items-center gap-2 text-xs cursor-pointer py-1 px-2 rounded hover:bg-accent"
                      >
                        <Checkbox
                          checked={col.getIsVisible()}
                          onCheckedChange={(checked) => col.toggleVisibility(!!checked)}
                          className="h-3.5 w-3.5"
                        />
                        {COLUMN_LABELS[col.id] || col.id}
                      </label>
                    ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleColumnToggle}
            >
              <Lock className="h-3 w-3" />
              Kolom
            </Button>
          )}

          {/* Admin lock/unlock */}
          <Button
            variant={isAdminUnlocked ? 'default' : 'outline'}
            size="sm"
            className={`h-7 text-xs gap-1 ${isAdminUnlocked ? 'bg-teal-600 hover:bg-teal-700' : ''}`}
            onClick={() => {
              if (isAdminUnlocked) {
                setIsAdminUnlocked(false);
                setAdminPassword('');
                toast.info('Mode admin dikunci');
              } else {
                setPasswordPurpose('edit');
                setAdminPassword('');
                setShowPasswordDialog(true);
              }
            }}
          >
            {isAdminUnlocked ? (
              <>
                <Unlock className="h-3 w-3" />
                Admin
              </>
            ) : (
              <>
                <Lock className="h-3 w-3" />
                Admin
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto custom-scrollbar">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="text-xs font-semibold whitespace-nowrap px-3 py-2"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j} className="px-3 py-2">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-destructive text-sm">
                    Gagal memuat data. Silakan coba lagi.
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-accent/50">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-xs px-3 py-2 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground text-sm">
                    Tidak ada data ditemukan
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {data && totalPages > 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Baris per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="h-7 text-xs border rounded px-1 bg-background"
            >
              {[10, 20, 50, 100].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              Menampilkan {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, data.total)} dari {formatNumber(data.total)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPageChange(1)}
              disabled={page <= 1}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPageChange(totalPages)}
              disabled={page >= totalPages}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Password Dialog */}
      <Dialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-teal-600" />
              Verifikasi Password
            </DialogTitle>
            <DialogDescription>
              {passwordPurpose === 'columns'
                ? 'Masukkan password admin untuk mengubah tampilan kolom'
                : 'Masukkan password admin untuk mengubah data'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              type="password"
              placeholder="Masukkan password admin..."
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword(passwordPurpose)}
              className="text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPasswordDialog(false)}
              >
                Batal
              </Button>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700"
                onClick={() => handleVerifyPassword(passwordPurpose)}
                disabled={verifyingPassword}
              >
                {verifyingPassword ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Memverifikasi...</>
                ) : (
                  <><Check className="h-3 w-3 mr-1" /> Verifikasi</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit/Add Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-teal-600" />
              {editingRow ? 'Edit Data Produksi' : 'Tambah Data Produksi'}
            </DialogTitle>
            <DialogDescription>
              {editingRow ? 'Ubah data produksi perikanan budidaya' : 'Tambah data produksi perikanan budidaya baru'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Row 1: Year, Business Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Tahun *</label>
                <Input
                  type="number"
                  value={formData.year || ''}
                  onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Jenis Usaha *</label>
                <Select
                  value={formData.businessType || ''}
                  onValueChange={(v) => setFormData({ ...formData, businessType: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Pilih jenis usaha" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Kecamatan, Desa */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Kecamatan *</label>
                <Select
                  value={formData.kecamatan || ''}
                  onValueChange={(v) => setFormData({ ...formData, kecamatan: v, desa: '' })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Pilih kecamatan" />
                  </SelectTrigger>
                  <SelectContent>
                    {KECAMATAN_LIST.map((k) => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Desa *</label>
                <Select
                  value={formData.desa || ''}
                  onValueChange={(v) => setFormData({ ...formData, desa: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Pilih desa" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDesaOptions.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Fish Type, Container Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Jenis Ikan *</label>
                <Select
                  value={formData.fishType || ''}
                  onValueChange={(v) => setFormData({ ...formData, fishType: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Pilih jenis ikan" />
                  </SelectTrigger>
                  <SelectContent>
                    {FISH_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Jenis Wadah *</label>
                <Select
                  value={formData.containerType || ''}
                  onValueChange={(v) => setFormData({ ...formData, containerType: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Pilih jenis wadah" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTAINER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 4: Farmer Name, Group Name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Nama Pembudidaya</label>
                <Input
                  value={formData.farmerName || ''}
                  onChange={(e) => setFormData({ ...formData, farmerName: e.target.value })}
                  placeholder="Nama pembudidaya"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Nama Kelompok</label>
                <Input
                  value={formData.groupName || ''}
                  onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                  placeholder="Nama kelompok"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Row 5: Production, RTP */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Produksi ({productionUnit})</label>
                <Input
                  type="number"
                  value={formData.productionQty || ''}
                  onChange={(e) => setFormData({ ...formData, productionQty: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">RTP</label>
                <Input
                  type="number"
                  value={formData.rtpCount || ''}
                  onChange={(e) => setFormData({ ...formData, rtpCount: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Row 6: Farmer Count, Group Count */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Jumlah Pembudidaya</label>
                <Input
                  type="number"
                  value={formData.farmerCount || ''}
                  onChange={(e) => setFormData({ ...formData, farmerCount: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Jumlah Kelompok</label>
                <Input
                  type="number"
                  value={formData.groupCount || ''}
                  onChange={(e) => setFormData({ ...formData, groupCount: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Row 7: Target, Production Value */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Target ({targetUnit})</label>
                <Input
                  type="number"
                  value={formData.targetQty || ''}
                  onChange={(e) => setFormData({ ...formData, targetQty: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Nilai Produksi (Rp)</label>
                <Input
                  type="number"
                  value={formData.productionValue || ''}
                  onChange={(e) => setFormData({ ...formData, productionValue: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Row 8: Latitude, Longitude */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Latitude</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={formData.latitude || ''}
                  onChange={(e) => setFormData({ ...formData, latitude: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Longitude</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={formData.longitude || ''}
                  onChange={(e) => setFormData({ ...formData, longitude: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Row 9: KUSUKA, CPIB, CBIB */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">No. KUSUKA</label>
                <Input
                  type="text"
                  placeholder="16 digit angka"
                  maxLength={16}
                  value={formData.kusuka || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, ''); // hanya angka
                    setFormData({ ...formData, kusuka: val });
                  }}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-2">
                  <Checkbox
                    checked={!!formData.cpib}
                    onCheckedChange={(checked) => setFormData({ ...formData, cpib: !!checked })}
                    className="h-4 w-4"
                  />
                  CPIB
                </label>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-2">
                  <Checkbox
                    checked={!!formData.cbib}
                    onCheckedChange={(checked) => setFormData({ ...formData, cbib: !!checked })}
                    className="h-4 w-4"
                  />
                  CBIB
                </label>
              </div>
            </div>

            {/* Save button */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(false)}
              >
                Batal
              </Button>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Menyimpan...</>
                ) : (
                  <><Check className="h-3 w-3 mr-1" /> {editingRow ? 'Simpan Perubahan' : 'Tambah Data'}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Hapus Data?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm && (
                <>
                  Apakah Anda yakin ingin menghapus data produksi
                  <strong> {deleteConfirm.fishType} - {deleteConfirm.kecamatan} - {deleteConfirm.desa} ({deleteConfirm.year})</strong>?
                  Tindakan ini tidak dapat dibatalkan.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Menghapus...' : 'Ya, Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
