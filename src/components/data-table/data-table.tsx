'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, Eye } from 'lucide-react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useFishFarms, type FishFarm } from '@/hooks/use-fish-farms';

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);
const formatCurrency = (num: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

interface DataTableProps {
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function DataTable({ page, pageSize, onPageChange, onPageSizeChange }: DataTableProps) {
  const { data, isLoading, isError } = useFishFarms(page, pageSize);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

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
            className={`text-[10px] whitespace-nowrap ${
              row.getValue('businessType') === 'Pembesaran'
                ? 'bg-teal-600 text-white'
                : 'bg-emerald-600 text-white'
            }`}
          >
            {row.getValue('businessType')}
          </Badge>
        ),
      },
      {
        accessorKey: 'productionQty',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Produksi (kg) <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        size: 110,
        cell: ({ row }) => formatNumber(row.getValue('productionQty') as number),
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
        header: 'Target (kg)',
        size: 100,
        cell: ({ row }) => formatNumber(row.getValue('targetQty') as number),
      },
      {
        accessorKey: 'productionValue',
        header: 'Nilai Produksi (Rp)',
        size: 140,
        cell: ({ row }) => formatCurrency(row.getValue('productionValue') as number),
      },
    ],
    [page, pageSize]
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
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: totalPages || -1,
  });

  return (
    <div className="space-y-3">
      {/* Column visibility toggle */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isLoading ? 'Memuat data...' :
           isError ? 'Gagal memuat data' :
           data ? `${formatNumber(data.total)} data ditemukan` : 'Memuat...'}
        </p>
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
                .filter((col) => col.getCanHide())
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
                    {col.id === 'no' ? 'No' :
                     col.id === 'year' ? 'Tahun' :
                     col.id === 'kecamatan' ? 'Kecamatan' :
                     col.id === 'desa' ? 'Desa' :
                     col.id === 'fishType' ? 'Jenis Ikan' :
                     col.id === 'containerType' ? 'Jenis Wadah' :
                     col.id === 'businessType' ? 'Jenis Usaha' :
                     col.id === 'productionQty' ? 'Produksi (kg)' :
                     col.id === 'rtpCount' ? 'RTP' :
                     col.id === 'farmerCount' ? 'Pembudidaya' :
                     col.id === 'groupCount' ? 'Kelompok' :
                     col.id === 'targetQty' ? 'Target (kg)' :
                     col.id === 'productionValue' ? 'Nilai Produksi' :
                     col.id}
                  </label>
                ))}
            </div>
          </PopoverContent>
        </Popover>
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
    </div>
  );
}
