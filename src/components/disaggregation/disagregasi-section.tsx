'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Split,
  Search,
  Plus,
  RotateCcw,
  CheckCircle2,
  Loader2,
  Lock,
  Save,
  Trash2,
  FileSpreadsheet,
  Scale,
  AlertTriangle,
  Shield,
  ArrowLeft,
  Info,
  KeyRound,
  Upload,
  FileUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MultiSelect } from '@/components/ui/multi-select';
import { Progress } from '@/components/ui/progress';
import {
  KECAMATAN_LIST,
  KECAMATAN_DESA,
  FISH_TYPES,
  CONTAINER_TYPES,
} from '@/lib/constants';
import { PasswordSettings } from './password-settings';
import { BalanceEditor, FarmerForBalance } from './balance-editor';
import { TriwulanOverview } from './triwulan-overview';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FarmerAllocation {
  farmerId: string;
  farmerName: string;
  groupName: string;
  desa: string;
  kecamatan: string;
  fishType: string;
  containerType: string;
  referenceQty: number;
  proportion: number;
  allocatedQty: number;
  adjustmentPct: number;
  finalQty: number;
  isNew: boolean;
  rtpCount: number;
  farmerCount: number;
  groupCount: number;
  latitude: number;
  longitude: number;
  kusuka: string;
  cpib: boolean;
  cbib: boolean;
}

interface AgregatForm {
  year: string;
  triwulan: string;
  kecamatan: string[];
  businessType: string;
  fishType: string[];
  containerType: string[];
  groupName: string[];
  totalQty: string;
}

interface NewFarmerForm {
  farmerName: string;
  groupName: string;
  desa: string;
  allocatedQty: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtNum = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);

const TRIWULAN_OPTIONS = [
  { value: 'Q1', label: 'Q1 (Jan-Mar)' },
  { value: 'Q2', label: 'Q2 (Apr-Jun)' },
  { value: 'Q3', label: 'Q3 (Jul-Sep)' },
  { value: 'Q4', label: 'Q4 (Okt-Des)' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function DisagregasiSection() {
  const [step, setStep] = useState(0); // 0 = password gate, 1 = input, 2 = distribution, 3 = save
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [adminTab, setAdminTab] = useState<'disagregasi' | 'upload' | 'password'>('disagregasi');

  // Step 1 — Aggregate input
  const [form, setForm] = useState<AgregatForm>({
    year: '',
    triwulan: '',
    kecamatan: [],
    businessType: '',
    fishType: [],
    containerType: [],
    groupName: [],
    totalQty: '',
  });

  // Step 2 — Distribution
  const [farmers, setFarmers] = useState<FarmerAllocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [referenceInfo, setReferenceInfo] = useState<{ hasReference: boolean; referenceYear: number } | null>(null);

  // Bulk adjust input
  const [bulkAdjustValue, setBulkAdjustValue] = useState('');
  const [adjustMode, setAdjustMode] = useState<'semua' | 'kecamatan' | 'desa' | 'kelompok' | 'ikan' | 'wadah'>('semua');
  const [adjustTarget, setAdjustTarget] = useState('');

  // New farmer inline form
  const [showNewFarmer, setShowNewFarmer] = useState(false);
  const [newFarmer, setNewFarmer] = useState<NewFarmerForm>({
    farmerName: '',
    groupName: '',
    desa: '',
    allocatedQty: '',
  });

  // Step 2 — Balance Editor
  const [showBalanceEditor, setShowBalanceEditor] = useState(false);

  // Step 3 — Save
  const [savePassword, setSavePassword] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ─── Derived ─────────────────────────────────────────────────────────────

  const totalQtyNum = useMemo(() => parseFloat(form.totalQty) || 0, [form.totalQty]);
  const unitLabel = form.businessType === 'Pembenihan' ? 'Ekor' : 'Kg';

  const totalFinalQty = useMemo(
    () => farmers.reduce((s, f) => s + f.finalQty, 0),
    [farmers],
  );

  const balanceDiff = useMemo(() => totalQtyNum - totalFinalQty, [totalQtyNum, totalFinalQty]);
  const balancePct = useMemo(() => totalQtyNum > 0 ? (totalFinalQty / totalQtyNum) * 100 : 0, [totalQtyNum, totalFinalQty]);

  const isFormValid = useMemo(
    () =>
      form.year &&
      parseInt(form.year) >= 2000 &&
      parseInt(form.year) <= 2100 &&
      form.triwulan &&
      form.kecamatan.length > 0 &&
      form.businessType &&
      form.fishType.length > 0 &&
      form.containerType.length > 0 &&
      form.totalQty &&
      parseFloat(form.totalQty) > 0,
    [form],
  );

  const desaOptions = useMemo(() => {
    if (form.kecamatan.length === 0) return [];
    const allDesa = form.kecamatan.flatMap((k) => KECAMATAN_DESA[k] || []);
    return allDesa;
  }, [form.kecamatan]);

  // Fetch unique group names from the DB for the multi-select
  const [groupOptions, setGroupOptions] = useState<string[]>([]);

  const fetchGroupNames = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        kecamatan: form.kecamatan.join(','),
        fishType: form.fishType.join(','),
        containerType: form.containerType.join(','),
        businessType: form.businessType,
      });
      const res = await fetch(`/api/fish-farms/disaggregate?${params}&action=groups`);
      if (res.ok) {
        const data = await res.json();
        setGroupOptions(data.groups || []);
      }
    } catch {
      // Silently fail
    }
  }, [form.kecamatan, form.fishType, form.containerType, form.businessType]);

  // ─── Password gate ──────────────────────────────────────────────────────

  const handlePasswordSubmit = async () => {
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput, type: 'admin' }),
      });
      const data = await res.json();
      if (data.valid) {
        setStep(1);
        setPasswordError('');
      } else {
        setPasswordError('Password salah!');
      }
    } catch {
      setPasswordError('Gagal memverifikasi password');
    }
  };

  // ─── Recalculation logic ────────────────────────────────────────────────

  const recalculate = useCallback(
    (currentFarmers: FarmerAllocation[], totalQty: number): FarmerAllocation[] => {
      if (currentFarmers.length === 0 || totalQty <= 0) return currentFarmers;

      const withAdjusted = currentFarmers.map((f) => ({
        ...f,
        finalQty: f.allocatedQty * (1 + f.adjustmentPct / 100),
      }));

      const sumAdjusted = withAdjusted.reduce((s, f) => s + f.finalQty, 0);

      if (Math.abs(sumAdjusted - totalQty) > 0.01) {
        const adjustedFarmers = withAdjusted.filter((f) => f.adjustmentPct !== 0);
        const neutralFarmers = withAdjusted.filter((f) => f.adjustmentPct === 0);

        const sumAdjustedAdjusted = adjustedFarmers.reduce((s, f) => s + f.finalQty, 0);
        const remainingForNeutral = totalQty - sumAdjustedAdjusted;

        if (neutralFarmers.length > 0 && remainingForNeutral > 0) {
          const sumNeutralAllocated = neutralFarmers.reduce((s, f) => s + f.allocatedQty, 0);
          const scaleFactor = sumNeutralAllocated > 0 ? remainingForNeutral / sumNeutralAllocated : 1;

          return withAdjusted.map((f) => {
            if (f.adjustmentPct === 0) {
              const newFinal = Math.round(f.allocatedQty * scaleFactor * 100) / 100;
              return { ...f, finalQty: newFinal };
            }
            return f;
          });
        }

        const scale = totalQty / sumAdjusted;
        return withAdjusted.map((f) => ({
          ...f,
          finalQty: Math.round(f.finalQty * scale * 100) / 100,
        }));
      }

      return withAdjusted;
    },
    [],
  );

  // ─── Actions ─────────────────────────────────────────────────────────────

  const handleFetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: form.year,
        triwulan: form.triwulan,
        kecamatan: form.kecamatan.join(','),
        fishType: form.fishType.join(','),
        containerType: form.containerType.join(','),
        businessType: form.businessType,
        totalQty: form.totalQty,
      });

      if (form.groupName.length > 0) {
        params.set('groupName', form.groupName.join(','));
      }

      const res = await fetch(`/api/fish-farms/disaggregate?${params}`);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Gagal memuat preview');
        return;
      }

      const mapped: FarmerAllocation[] = data.farmers.map(
        (f: Record<string, unknown>) => ({
          farmerId: f.farmerId as string,
          farmerName: f.farmerName as string,
          groupName: f.groupName as string,
          desa: f.desa as string,
          kecamatan: f.kecamatan as string,
          fishType: f.fishType as string,
          containerType: f.containerType as string,
          referenceQty: f.referenceQty as number,
          proportion: f.proportion as number,
          allocatedQty: f.allocatedQty as number,
          adjustmentPct: 0,
          finalQty: f.allocatedQty as number,
          isNew: false,
          rtpCount: (f.rtpCount as number) || 1,
          farmerCount: (f.farmerCount as number) || 1,
          groupCount: (f.groupCount as number) || 0,
          latitude: (f.latitude as number) || 0,
          longitude: (f.longitude as number) || 0,
          kusuka: (f.kusuka as string) || '',
          cpib: (f.cpib as boolean) || false,
          cbib: (f.cbib as boolean) || false,
        }),
      );

      setFarmers(mapped);
      setReferenceInfo({
        hasReference: data.hasReference,
        referenceYear: data.referenceYear,
      });
      setStep(2);
    } catch {
      toast.error('Gagal terhubung ke server');
    } finally {
      setLoading(false);
    }
  }, [form]);

  const handleAllocatedChange = useCallback(
    (index: number, value: string) => {
      const numVal = parseFloat(value) || 0;
      setFarmers((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], allocatedQty: numVal, finalQty: numVal };
        // Recalculate proportions
        const totalAlloc = updated.reduce((s, f) => s + f.allocatedQty, 0);
        return updated.map((f) => ({
          ...f,
          proportion: totalAlloc > 0 ? f.allocatedQty / totalAlloc : 0,
        }));
      });
    },
    [],
  );

  const handleAdjustmentChange = useCallback(
    (index: number, value: string) => {
      const numVal = parseFloat(value) || 0;
      setFarmers((prev) => {
        const updated = [...prev];
        // Only allow adjust if farmer has reference history
        if (updated[index].referenceQty === 0 && !updated[index].isNew) return prev;
        updated[index] = { ...updated[index], adjustmentPct: numVal };
        return recalculate(updated, totalQtyNum);
      });
    },
    [totalQtyNum, recalculate],
  );

  // Derive unique values for adjust-by targets from current farmers
  const adjustTargets = useMemo(() => {
    const keys = new Map<string, string>();
    for (const f of farmers) {
      let key = '';
      switch (adjustMode) {
        case 'kecamatan': key = f.kecamatan; break;
        case 'desa': key = f.desa; break;
        case 'kelompok': key = f.groupName; break;
        case 'ikan': key = f.fishType; break;
        case 'wadah': key = f.containerType; break;
      }
      if (key && !keys.has(key)) keys.set(key, key);
    }
    return Array.from(keys.keys()).sort();
  }, [farmers, adjustMode]);

  const handleBulkAdjust = useCallback(() => {
    const pct = parseFloat(bulkAdjustValue) || 0;
    if (pct === 0) return;
    setFarmers((prev) => {
      const updated = prev.map((f) => {
        // Only adjust farmers that have reference history
        if (f.referenceQty === 0 && !f.isNew) return f;
        // If adjust by specific dimension, check match
        if (adjustMode !== 'semua') {
          let keyValue = '';
          switch (adjustMode) {
            case 'kecamatan': keyValue = f.kecamatan; break;
            case 'desa': keyValue = f.desa; break;
            case 'kelompok': keyValue = f.groupName; break;
            case 'ikan': keyValue = f.fishType; break;
            case 'wadah': keyValue = f.containerType; break;
          }
          if (adjustTarget && keyValue !== adjustTarget) return f;
        }
        return { ...f, adjustmentPct: f.adjustmentPct + pct };
      });
      return recalculate(updated, totalQtyNum);
    });
    setBulkAdjustValue('');
  }, [bulkAdjustValue, totalQtyNum, recalculate, adjustMode, adjustTarget]);

  const handleDistributeEvenly = useCallback(() => {
    setFarmers((prev) => {
      if (prev.length === 0 || totalQtyNum <= 0) return prev;
      const evenAmount = Math.round((totalQtyNum / prev.length) * 100) / 100;
      const remainder = Math.round((totalQtyNum - evenAmount * prev.length) * 100) / 100;
      return prev.map((f, i) => ({
        ...f,
        allocatedQty: i === 0 ? evenAmount + remainder : evenAmount,
        adjustmentPct: 0,
        finalQty: i === 0 ? evenAmount + remainder : evenAmount,
        proportion: 1 / prev.length,
      }));
    });
    toast.success('Distribusi dibagi rata');
  }, [totalQtyNum]);

  const handleResetDistribution = useCallback(() => {
    setFarmers((prev) => {
      const updated = prev.map((f) => ({
        ...f,
        adjustmentPct: 0,
        finalQty: f.allocatedQty,
      }));
      return recalculate(updated, totalQtyNum);
    });
    setBulkAdjustValue('');
    setAdjustMode('semua');
    setAdjustTarget('');
  }, [totalQtyNum, recalculate]);

  // Apply balance editor results to farmer table
  const handleApplyBalance = useCallback((allocations: { farmerId: string; finalQty: number }[]) => {
    setFarmers((prev) => {
      const allocMap = new Map(allocations.map((a) => [a.farmerId, a.finalQty]));
      const updated = prev.map((f) => {
        const newQty = allocMap.get(f.farmerId);
        if (newQty !== undefined) {
          return {
            ...f,
            finalQty: newQty,
            allocatedQty: newQty,
            adjustmentPct: 0,
            proportion: totalQtyNum > 0 ? newQty / totalQtyNum : 0,
          };
        }
        return f;
      });
      return updated;
    });
    toast.success('Nilai dari Balance Editor diterapkan ke tabel');
  }, [totalQtyNum]);

  // Farmers data for BalanceEditor
  const balanceEditorFarmers = useMemo<FarmerForBalance[]>(
    () => farmers.map((f) => ({
      farmerId: f.farmerId,
      farmerName: f.farmerName,
      groupName: f.groupName,
      desa: f.desa,
      kecamatan: f.kecamatan,
      fishType: f.fishType,
      containerType: f.containerType,
      referenceQty: f.referenceQty,
      proportion: f.proportion,
      allocatedQty: f.allocatedQty,
      finalQty: f.finalQty,
    })),
    [farmers],
  );

  const balanceFormKey = useMemo(
    () => `balance-${form.year}-${form.triwulan}-${form.kecamatan.join('+')}-${form.businessType}`,
    [form],
  );

  const handleAddNewFarmer = useCallback(() => {
    if (!newFarmer.farmerName.trim() || !newFarmer.desa || !newFarmer.allocatedQty) {
      toast.error('Lengkapi data pembudidaya baru');
      return;
    }

    const allocatedQty = parseFloat(newFarmer.allocatedQty) || 0;
    if (allocatedQty <= 0) {
      toast.error('Alokasi harus lebih dari 0');
      return;
    }

    const newFarmerEntry: FarmerAllocation = {
      farmerId: '',
      farmerName: newFarmer.farmerName.trim(),
      groupName: newFarmer.groupName.trim(),
      desa: newFarmer.desa,
      kecamatan: form.kecamatan[0] || '',
      fishType: form.fishType[0] || '',
      containerType: form.containerType[0] || '',
      referenceQty: 0,
      proportion: 0,
      allocatedQty: 0,
      adjustmentPct: 0,
      finalQty: allocatedQty,
      isNew: true,
      rtpCount: 1,
      farmerCount: 1,
      groupCount: 0,
      latitude: 0,
      longitude: 0,
      kusuka: '',
      cpib: false,
      cbib: false,
    };

    const remainingTotal = totalQtyNum - allocatedQty;

    setFarmers((prev) => {
      const existingFarmers = prev.filter((f) => !f.isNew);
      const otherNewFarmers = prev.filter((f) => f.isNew);
      const otherNewTotal = otherNewFarmers.reduce((s, f) => s + f.finalQty, 0);
      const forExisting = remainingTotal - otherNewTotal;

      if (existingFarmers.length > 0 && forExisting > 0) {
        const totalExistingAllocated = existingFarmers.reduce(
          (s, f) => s + f.allocatedQty,
          0,
        );
        const scale =
          totalExistingAllocated > 0 ? forExisting / totalExistingAllocated : 1;

        const updatedExisting = existingFarmers.map((f) => ({
          ...f,
          adjustmentPct: 0,
          allocatedQty: Math.round(f.allocatedQty * scale * 100) / 100,
          finalQty: Math.round(f.allocatedQty * scale * 100) / 100,
        }));

        return [...updatedExisting, ...otherNewFarmers, newFarmerEntry];
      }

      return [...prev, newFarmerEntry];
    });

    setShowNewFarmer(false);
    setNewFarmer({ farmerName: '', groupName: '', desa: '', allocatedQty: '' });
    toast.success('Pembudidaya baru ditambahkan');
  }, [newFarmer, totalQtyNum, form.kecamatan, form.fishType, form.containerType]);

  const handleRemoveFarmer = useCallback(
    (index: number) => {
      setFarmers((prev) => {
        const updated = prev.filter((_, i) => i !== index);
        const existingNonNew = updated.filter((f) => !f.isNew);
        if (existingNonNew.length > 0) {
          const totalCurrentAllocated = existingNonNew.reduce(
            (s, f) => s + f.allocatedQty,
            0,
          );
          const newTotal = totalQtyNum - updated.filter((f) => f.isNew).reduce((s, f) => s + f.finalQty, 0);
          const scale = totalCurrentAllocated > 0 ? newTotal / totalCurrentAllocated : 1;

          return updated.map((f) => {
            if (!f.isNew) {
              const newAllocated = Math.round(f.allocatedQty * scale * 100) / 100;
              return {
                ...f,
                allocatedQty: newAllocated,
                adjustmentPct: 0,
                finalQty: newAllocated,
              };
            }
            return f;
          });
        }
        return updated;
      });
    },
    [totalQtyNum],
  );

  const handleSave = useCallback(async () => {
    if (!savePassword.trim()) {
      toast.error('Masukkan sandi untuk menyimpan');
      return;
    }

    setSaving(true);
    try {
      const body = {
        password: savePassword,
        year: parseInt(form.year),
        triwulan: form.triwulan,
        kecamatan: form.kecamatan,
        fishType: form.fishType,
        containerType: form.containerType,
        businessType: form.businessType,
        totalQty: totalQtyNum,
        notes,
        farmers: farmers.map((f) => ({
          farmerId: f.farmerId || undefined,
          farmerName: f.farmerName,
          groupName: f.groupName,
          desa: f.desa,
          kecamatan: f.kecamatan,
          fishType: f.fishType,
          containerType: f.containerType,
          allocatedQty: Math.round(f.finalQty * 100) / 100,
          rtpCount: f.rtpCount,
          farmerCount: f.farmerCount,
          groupCount: f.groupCount,
          latitude: f.latitude,
          longitude: f.longitude,
          kusuka: f.kusuka,
          cpib: f.cpib,
          cbib: f.cbib,
          isNew: f.isNew,
        })),
      };

      const res = await fetch('/api/fish-farms/disaggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Gagal menyimpan data');
        return;
      }

      toast.success(
        `Berhasil! ${data.createdCount} data disagregasi disimpan (Batch: ${data.batchId?.slice(0, 8)}...)`,
      );
      // Reset to step 1
      setStep(1);
      setFarmers([]);
      setReferenceInfo(null);
      setSavePassword('');
      setNotes('');
    } catch {
      toast.error('Gagal terhubung ke server');
    } finally {
      setSaving(false);
    }
  }, [savePassword, form, totalQtyNum, notes, farmers]);

  const handleExportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      const rows = farmers.map((f, i) => ({
        No: i + 1,
        Kecamatan: f.kecamatan,
        Desa: f.desa,
        'Nama Pembudidaya': f.farmerName,
        'Kelompok': f.groupName || '-',
        'Jenis Ikan': f.fishType,
        'Wadah Budidaya': f.containerType,
        'Jenis Usaha': form.businessType,
        'Riwayat Produksi': f.referenceQty > 0 ? f.referenceQty : '',
        'Proporsi (%)': Math.round(f.proportion * 10000) / 100,
        'Alokasi': f.allocatedQty,
        'Adjustment (%)': f.adjustmentPct || '',
        'Nilai Akhir': Math.round(f.finalQty * 100) / 100,
        'Baru': f.isNew ? 'Ya' : 'Tidak',
        RTP: f.rtpCount,
      }));

      rows.push({
        No: 0,
        Kecamatan: 'TOTAL',
        Desa: '',
        'Nama Pembudidaya': '',
        'Kelompok': '',
        'Jenis Ikan': '',
        'Wadah Budidaya': '',
        'Jenis Usaha': '',
        'Riwayat Produksi': 0,
        'Proporsi (%)': 100,
        'Alokasi': farmers.reduce((s, f) => s + f.allocatedQty, 0),
        'Adjustment (%)': '',
        'Nilai Akhir': Math.round(totalFinalQty * 100) / 100,
        'Baru': '',
        RTP: farmers.reduce((s, f) => s + f.rtpCount, 0),
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 5 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 18 },
        { wch: 15 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 6 }, { wch: 5 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Disagregasi');

      const fileName = `Disagregasi_${form.businessType}_${form.triwulan}_${form.year}_${form.kecamatan.join('+')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success(`File Excel berhasil diunduh: ${fileName}`);
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error('Gagal mengekspor ke Excel');
    } finally {
      setExporting(false);
    }
  }, [farmers, form, totalFinalQty]);

  // ─── Step indicators ─────────────────────────────────────────────────────

  const steps = [
    { num: 1, label: 'Input Agregat' },
    { num: 2, label: 'Distribusi' },
    { num: 3, label: 'Simpan' },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────

  // Step 0: Admin password gate
  if (step === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center min-h-[60vh]"
      >
        <div
          className="w-full max-w-sm rounded-2xl p-6 sm:p-8 space-y-5"
          style={{
            background: 'rgba(6,182,212,0.04)',
            border: '1px solid rgba(6,182,212,0.15)',
            boxShadow: '0 8px 32px rgba(6,182,212,0.08)',
          }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                boxShadow: '0 8px 24px rgba(6,182,212,0.35)',
              }}
            >
              <Shield className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Akses Admin</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Masukkan sandi admin untuk mengakses fitur Disagregasi Data
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sandi Admin</Label>
              <Input
                type="password"
                placeholder="Masukkan sandi..."
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePasswordSubmit();
                }}
                className="text-sm text-center"
                autoFocus
              />
              {passwordError && (
                <p className="text-[10px] text-red-400 text-center">{passwordError}</p>
              )}
            </div>

            <Button
              onClick={handlePasswordSubmit}
              className="w-full gap-2"
              style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
            >
              <Lock className="h-4 w-4" />
              Masuk
            </Button>
          </div>

          <div
            className="flex items-start gap-2 p-3 rounded-lg text-[11px] text-muted-foreground"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: '#06B6D4' }} />
            <span>
              Fitur ini hanya untuk admin Dinas Pertanian Ketahanan Pangan dan Perikanan. Hubungi administrator jika Anda memerlukan akses.
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                boxShadow: '0 4px 12px rgba(6,182,212,0.3)',
              }}
            >
              <Split className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Area Admin</h2>
              <p className="text-xs text-muted-foreground">
                Disagregasi Data & Pengaturan Password
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Admin sub-tabs */}
      <div
        className="flex gap-1 p-1 rounded-lg"
        style={{
          background: 'rgba(6,182,212,0.06)',
          border: '1px solid rgba(6,182,212,0.12)',
        }}
      >
        <button
          onClick={() => setAdminTab('disagregasi')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center"
          style={{
            background: adminTab === 'disagregasi'
              ? 'linear-gradient(135deg, #06B6D4, #0891B2)'
              : 'transparent',
            color: adminTab === 'disagregasi' ? 'white' : 'var(--muted-foreground)',
            boxShadow: adminTab === 'disagregasi' ? '0 2px 8px rgba(6,182,212,0.3)' : 'none',
          }}
        >
          <Split className="h-3.5 w-3.5" />
          Disagregasi
        </button>
        <button
          onClick={() => setAdminTab('upload')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center"
          style={{
            background: adminTab === 'upload'
              ? 'linear-gradient(135deg, #06B6D4, #0891B2)'
              : 'transparent',
            color: adminTab === 'upload' ? 'white' : 'var(--muted-foreground)',
            boxShadow: adminTab === 'upload' ? '0 2px 8px rgba(6,182,212,0.3)' : 'none',
          }}
        >
          <FileUp className="h-3.5 w-3.5" />
          Upload Excel
        </button>
        <button
          onClick={() => setAdminTab('password')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center"
          style={{
            background: adminTab === 'password'
              ? 'linear-gradient(135deg, #06B6D4, #0891B2)'
              : 'transparent',
            color: adminTab === 'password' ? 'white' : 'var(--muted-foreground)',
            boxShadow: adminTab === 'password' ? '0 2px 8px rgba(6,182,212,0.3)' : 'none',
          }}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Password
        </button>
      </div>

      {/* Tab content */}
      {adminTab === 'password' ? (
        <PasswordSettings />
      ) : adminTab === 'upload' ? (
        <UploadExcelSection />
      ) : (
        <>
          {/* Step indicators */}
          <div className="flex items-center gap-1 sm:gap-2 py-1">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center gap-1 sm:gap-2 flex-1">
                <button
                  onClick={() => {
                    if (s.num < step) setStep(s.num);
                  }}
                  className="flex items-center gap-1.5 flex-1 group"
                  disabled={s.num >= step}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                    style={{
                      background:
                        step >= s.num
                          ? 'linear-gradient(135deg, #06B6D4, #0891B2)'
                          : 'rgba(255,255,255,0.06)',
                      color: step >= s.num ? 'white' : 'var(--muted-foreground)',
                      boxShadow: step === s.num ? '0 0 12px rgba(6,182,212,0.4)' : 'none',
                    }}
                  >
                    {step > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
                  </div>
                  <span
                    className="text-xs font-medium hidden sm:block truncate"
                    style={{
                      color: step >= s.num ? '#06B6D4' : 'var(--muted-foreground)',
                    }}
                  >
                    {s.label}
                  </span>
                </button>
                {i < steps.length - 1 && (
                  <div
                    className="h-px flex-1 max-w-[40px]"
                    style={{
                      background:
                        step > s.num
                          ? 'linear-gradient(90deg, #06B6D4, #0891B2)'
                          : 'rgba(255,255,255,0.08)',
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );

  // ─── Step 1: Input Data Agregat ──────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-4">
        {/* Triwulan Overview Panel */}
        {form.year && parseInt(form.year) >= 2000 && parseInt(form.year) <= 2100 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl p-4"
            style={{
              background: 'rgba(6,182,212,0.03)',
              border: '1px solid rgba(6,182,212,0.1)',
            }}
          >
            <TriwulanOverview
              year={form.year}
              selectedTriwulan={form.triwulan}
              onTriwulanSelect={(tw) => setForm((p) => ({ ...p, triwulan: tw }))}
            />
          </motion.div>
        )}

        <div
          className="rounded-xl p-4 sm:p-5 space-y-4"
          style={{
            background: 'rgba(6,182,212,0.04)',
            border: '1px solid rgba(6,182,212,0.12)',
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tahun — flexible text input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tahun</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Contoh: 2025"
                value={form.year}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setForm((p) => ({ ...p, year: val }));
                }}
                className="text-sm"
              />
              {form.year && (parseInt(form.year) < 2000 || parseInt(form.year) > 2100) && (
                <p className="text-[10px] text-red-400">Tahun harus antara 2000-2100</p>
              )}
            </div>

            {/* Triwulan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Triwulan</Label>
              <Select
                value={form.triwulan}
                onValueChange={(v) => setForm((p) => ({ ...p, triwulan: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih triwulan" />
                </SelectTrigger>
                <SelectContent>
                  {TRIWULAN_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Kecamatan — multi-select */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Kecamatan</Label>
              <MultiSelect
                options={KECAMATAN_LIST}
                selected={form.kecamatan}
                onChange={(selected) => setForm((p) => ({ ...p, kecamatan: selected }))}
                placeholder="Pilih kecamatan..."
              />
            </div>

            {/* Jenis Usaha */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Jenis Usaha</Label>
              <RadioGroup
                value={form.businessType}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, businessType: v }))
                }
                className="flex gap-4 pt-1"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Pembesaran" id="r-pembesaran" />
                  <Label htmlFor="r-pembesaran" className="text-xs cursor-pointer">
                    Pembesaran
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Pembenihan" id="r-pembenihan" />
                  <Label htmlFor="r-pembenihan" className="text-xs cursor-pointer">
                    Pembenihan
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Jenis Ikan — multi-select */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Jenis Ikan</Label>
              <MultiSelect
                options={FISH_TYPES}
                selected={form.fishType}
                onChange={(selected) => setForm((p) => ({ ...p, fishType: selected }))}
                placeholder="Pilih jenis ikan..."
              />
            </div>

            {/* Wadah Budidaya — multi-select */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Wadah Budidaya</Label>
              <MultiSelect
                options={CONTAINER_TYPES}
                selected={form.containerType}
                onChange={(selected) => setForm((p) => ({ ...p, containerType: selected }))}
                placeholder="Pilih wadah budidaya..."
              />
            </div>

            {/* Kelompok — multi-select (optional filter) */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium">
                Kelompok{' '}
                <span className="text-muted-foreground font-normal">(opsional — filter per kelompok)</span>
              </Label>
              <div className="flex gap-2">
                <MultiSelect
                  options={groupOptions}
                  selected={form.groupName}
                  onChange={(selected) => setForm((p) => ({ ...p, groupName: selected }))}
                  placeholder="Semua kelompok..."
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs gap-1"
                  onClick={fetchGroupNames}
                  disabled={!form.businessType || form.kecamatan.length === 0}
                >
                  <Search className="h-3 w-3" />
                  Muat
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Klik "Muat" untuk mengambil daftar kelompok berdasarkan filter di atas
              </p>
            </div>

            {/* Total Produksi */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium">
                Total Produksi Agregat ({unitLabel})
              </Label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder={`Masukkan total produksi dalam ${unitLabel}`}
                value={form.totalQty}
                onChange={(e) =>
                  setForm((p) => ({ ...p, totalQty: e.target.value }))
                }
                className="text-sm"
              />
            </div>
          </div>
        </div>

        {/* Action */}
        <Button
          onClick={handleFetchPreview}
          disabled={!isFormValid || loading}
          className="w-full gap-2"
          style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Mencari Pembudidaya...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Cari Pembudidaya & Distribusikan
            </>
          )}
        </Button>
      </div>
    );
  }

  // ─── Step 2: Preview & Distribution ──────────────────────────────────────

  function renderStep2() {
    return (
      <div className="space-y-4">
        {/* Summary badge */}
        <div
          className="flex flex-wrap items-center gap-2 text-xs px-3 py-2 rounded-lg"
          style={{
            background: 'rgba(6,182,212,0.08)',
            border: '1px solid rgba(6,182,212,0.15)',
            color: '#06B6D4',
          }}
        >
          <span className="font-semibold">{form.triwulan} {form.year}</span>
          <span className="opacity-40">·</span>
          <span>{form.businessType}</span>
          <span className="opacity-40">·</span>
          <span>{form.fishType.join(', ')}</span>
          <span className="opacity-40">·</span>
          <span>{form.containerType.join(', ')}</span>
          <span className="opacity-40">·</span>
          <span>{form.kecamatan.join(', ')}</span>
          {form.groupName.length > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span>Kelompok: {form.groupName.join(', ')}</span>
            </>
          )}
          <span className="opacity-40">·</span>
          <span className="font-semibold">
            Total: {fmtNum(totalQtyNum)} {unitLabel}
          </span>
          {referenceInfo && (
            <>
              <span className="opacity-40">·</span>
              <span className="text-amber-400">
                Referensi: {referenceInfo.referenceYear}
                {referenceInfo.hasReference ? ' (triwulan sama)' : ' (tahun terakhir)'}
              </span>
            </>
          )}
        </div>

        {/* Balance indicator */}
        <div
          className="rounded-lg p-3 space-y-2"
          style={{
            background: Math.abs(balanceDiff) < 0.01
              ? 'rgba(34,197,94,0.06)'
              : 'rgba(234,179,8,0.06)',
            border: `1px solid ${Math.abs(balanceDiff) < 0.01 ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)'}`,
          }}
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Balance</span>
              <button
                onClick={() => setShowBalanceEditor(!showBalanceEditor)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all"
                style={{
                  background: showBalanceEditor ? 'rgba(6,182,212,0.15)' : 'rgba(6,182,212,0.08)',
                  color: '#06B6D4',
                  border: '1px solid rgba(6,182,212,0.2)',
                }}
              >
                <Scale className="h-3 w-3" />
                {showBalanceEditor ? 'Tutup Hierarki' : 'Hierarki Balance'}
              </button>
            </div>
            <span className="font-semibold" style={{ color: Math.abs(balanceDiff) < 0.01 ? '#22C55E' : '#EAB308' }}>
              {fmtNum(totalFinalQty)} / {fmtNum(totalQtyNum)} {unitLabel}
              {Math.abs(balanceDiff) >= 0.01 && (
                <span className="ml-1.5 text-[10px] font-normal">
                  ({balanceDiff > 0 ? '+' : ''}{fmtNum(balanceDiff)} {unitLabel})
                </span>
              )}
              {Math.abs(balanceDiff) < 0.01 && ' ✓'}
            </span>
          </div>
          <Progress
            value={Math.min(balancePct, 100)}
            className="h-1.5"
            style={{
              // @ts-expect-error CSS custom property
              '--progress-background': Math.abs(balanceDiff) < 0.01
                ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                : 'linear-gradient(90deg, #EAB308, #CA8A04)',
            }}
          />
        </div>

        {/* Balance Editor (Hierarchical) */}
        <AnimatePresence>
          {showBalanceEditor && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <BalanceEditor
                farmers={balanceEditorFarmers}
                totalQty={totalQtyNum}
                unitLabel={unitLabel}
                formKey={balanceFormKey}
                onApply={handleApplyBalance}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk adjustment + action buttons */}
        <div className="space-y-2.5 p-3 rounded-xl border border-cyan-500/10" style={{ background: 'rgba(6,182,212,0.03)' }}>
          {/* Row 1: Adjust Mode Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Adjust by:</span>
            <div className="flex flex-wrap gap-1">
              {[
                { value: 'semua', label: 'Semua' },
                { value: 'kecamatan', label: 'Kecamatan' },
                { value: 'desa', label: 'Desa' },
                { value: 'kelompok', label: 'Kelompok' },
                { value: 'ikan', label: 'Jenis Ikan' },
                { value: 'wadah', label: 'Jenis Wadah' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setAdjustMode(opt.value as typeof adjustMode);
                    setAdjustTarget('');
                  }}
                  className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-all border ${
                    adjustMode === opt.value
                      ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-sm'
                      : 'text-muted-foreground border-border hover:border-cyan-500/20 hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Target selector (only when not "semua") + Input + Apply */}
          <div className="flex flex-wrap items-center gap-2">
            {adjustMode !== 'semua' && (
              <Select
                value={adjustTarget}
                onValueChange={setAdjustTarget}
              >
                <SelectTrigger className="h-7 w-44 text-xs">
                  <SelectValue placeholder={`Pilih ${adjustMode === 'kecamatan' ? 'Kecamatan' : adjustMode === 'desa' ? 'Desa' : adjustMode === 'kelompok' ? 'Kelompok' : adjustMode === 'ikan' ? 'Jenis Ikan' : 'Jenis Wadah'}...`} />
                </SelectTrigger>
                <SelectContent>
                  {adjustTargets.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                value={bulkAdjustValue}
                onChange={(e) => setBulkAdjustValue(e.target.value)}
                placeholder="0"
                className="h-7 w-20 text-xs text-center"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleBulkAdjust();
                }}
              />
              <span className="text-xs text-muted-foreground">%</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleBulkAdjust}
                disabled={
                  !bulkAdjustValue ||
                  parseFloat(bulkAdjustValue) === 0 ||
                  (adjustMode !== 'semua' && !adjustTarget)
                }
              >
                Terapkan
              </Button>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleDistributeEvenly}
                title="Bagi rata ke semua pembudidaya"
              >
                <Scale className="h-3 w-3" />
                Bagi Rata
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleResetDistribution}
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            </div>
          </div>

          {/* Info text when adjust-by is selected */}
          {adjustMode !== 'semua' && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Info className="h-3 w-3 shrink-0" />
              {adjustTarget ? (
                <span>
                  Adjustment akan diterapkan hanya ke pembudidaya dengan{' '}
                  <strong className="text-foreground">
                    {adjustMode === 'kecamatan' ? 'Kecamatan' : adjustMode === 'desa' ? 'Desa' : adjustMode === 'kelompok' ? 'Kelompok' : adjustMode === 'ikan' ? 'Jenis Ikan' : 'Jenis Wadah'}: {adjustTarget}
                  </strong>
                  {' '}({farmers.filter((f) => {
                    const kv = adjustMode === 'kecamatan' ? f.kecamatan : adjustMode === 'desa' ? f.desa : adjustMode === 'kelompok' ? f.groupName : adjustMode === 'ikan' ? f.fishType : f.containerType;
                    return kv === adjustTarget;
                  }).length} pembudidaya)
                </span>
              ) : (
                <span>Pilih {adjustMode === 'kecamatan' ? 'kecamatan' : adjustMode === 'desa' ? 'desa' : adjustMode === 'kelompok' ? 'kelompok' : adjustMode === 'ikan' ? 'jenis ikan' : 'jenis wadah'} yang ingin di-adjust</span>
              )}
            </div>
          )}
        </div>

        {/* Distribution table */}
        <div className="border rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow
                  style={{
                    background: 'rgba(6,182,212,0.08)',
                  }}
                >
                  <TableHead className="w-10 text-center text-xs">No</TableHead>
                  <TableHead className="text-xs">Nama</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Kelompok</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Kecamatan</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Desa</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Ikan</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Wadah</TableHead>
                  <TableHead className="text-xs text-right">Riwayat</TableHead>
                  <TableHead className="text-xs text-right">Proporsi</TableHead>
                  <TableHead className="text-xs text-center w-28">Alokasi</TableHead>
                  <TableHead className="text-xs text-center w-24">Adj (%)</TableHead>
                  <TableHead className="text-xs text-right">Nilai Akhir</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {farmers.map((f, i) => {
                  const canAdjust = f.referenceQty > 0 || f.isNew;
                  // Check if this row is highlighted by current adjust-by selection
                  const isAdjustTarget = adjustMode !== 'semua' && adjustTarget && (() => {
                    const kv = adjustMode === 'kecamatan' ? f.kecamatan : adjustMode === 'desa' ? f.desa : adjustMode === 'kelompok' ? f.groupName : adjustMode === 'ikan' ? f.fishType : f.containerType;
                    return kv === adjustTarget;
                  })();
                  return (
                    <TableRow key={i} className={isAdjustTarget ? 'bg-cyan-500/5' : ''}>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        <div className="flex items-center justify-center gap-1">
                          {isAdjustTarget && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />}
                          {i + 1}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        <div className="flex items-center gap-1.5">
                          {f.farmerName}
                          {f.isNew && (
                            <Badge
                              className="h-4 text-[9px] px-1"
                              style={{
                                background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                                color: 'white',
                                border: 'none',
                              }}
                            >
                              BARU
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs hidden sm:table-cell text-muted-foreground">
                        {f.groupName || '-'}
                      </TableCell>
                      <TableCell className="text-xs hidden md:table-cell text-muted-foreground">
                        {f.kecamatan || '-'}
                      </TableCell>
                      <TableCell className="text-xs hidden md:table-cell text-muted-foreground">
                        {f.desa}
                      </TableCell>
                      <TableCell className="text-xs hidden lg:table-cell text-muted-foreground">
                        {f.fishType || '-'}
                      </TableCell>
                      <TableCell className="text-xs hidden lg:table-cell text-muted-foreground">
                        {f.containerType || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {f.referenceQty > 0 ? fmtNum(f.referenceQty) : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {(f.proportion * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          value={f.allocatedQty || ''}
                          onChange={(e) => handleAllocatedChange(i, e.target.value)}
                          className="h-7 w-24 text-xs text-center mx-auto"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          value={f.adjustmentPct || ''}
                          onChange={(e) => handleAdjustmentChange(i, e.target.value)}
                          className="h-7 w-20 text-xs text-center mx-auto"
                          placeholder={canAdjust ? '0' : '-'}
                          disabled={!canAdjust}
                          title={!canAdjust ? 'Adjust tidak berfungsi karena riwayat kosong' : ''}
                        />
                        {!canAdjust && (
                          <div className="text-[9px] text-muted-foreground mt-0.5" title="Tidak ada riwayat">
                            <AlertTriangle className="h-2.5 w-2.5 inline" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-xs text-right font-semibold"
                        style={{ color: '#06B6D4' }}
                      >
                        {fmtNum(f.finalQty)}
                      </TableCell>
                      <TableCell>
                        {farmers.length > 1 && (
                          <button
                            onClick={() => handleRemoveFarmer(i)}
                            className="p-1 rounded hover:bg-red-500/10 text-red-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Inline new farmer form */}
                {showNewFarmer && (
                  <TableRow
                    style={{
                      background: 'rgba(6,182,212,0.04)',
                    }}
                  >
                    <TableCell className="text-center text-xs text-cyan-400">
                      <Plus className="h-4 w-4 mx-auto" />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Nama pembudidaya"
                        value={newFarmer.farmerName}
                        onChange={(e) =>
                          setNewFarmer((p) => ({
                            ...p,
                            farmerName: e.target.value,
                          }))
                        }
                        className="h-7 text-xs"
                      />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Input
                        placeholder="Kelompok"
                        value={newFarmer.groupName}
                        onChange={(e) =>
                          setNewFarmer((p) => ({
                            ...p,
                            groupName: e.target.value,
                          }))
                        }
                        className="h-7 text-xs"
                      />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Select
                        value={newFarmer.desa}
                        onValueChange={(v) =>
                          setNewFarmer((p) => ({ ...p, desa: v }))
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-full">
                          <SelectValue placeholder="Desa" />
                        </SelectTrigger>
                        <SelectContent>
                          {desaOptions.map((d) => (
                            <SelectItem key={d.desa} value={d.desa}>
                              {d.desa}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      -
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      -
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        placeholder="Alokasi"
                        value={newFarmer.allocatedQty}
                        onChange={(e) =>
                          setNewFarmer((p) => ({
                            ...p,
                            allocatedQty: e.target.value,
                          }))
                        }
                        className="h-7 w-24 text-xs text-center mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      -
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="Nilai"
                        value={newFarmer.allocatedQty}
                        onChange={(e) =>
                          setNewFarmer((p) => ({
                            ...p,
                            allocatedQty: e.target.value,
                          }))
                        }
                        className="h-7 w-24 text-xs text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <button
                          onClick={handleAddNewFarmer}
                          className="p-1 rounded hover:bg-cyan-500/10 text-cyan-400 hover:text-cyan-500 transition-colors"
                          title="Tambah"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setShowNewFarmer(false);
                            setNewFarmer({
                              farmerName: '',
                              groupName: '',
                              desa: '',
                              allocatedQty: '',
                            });
                          }}
                          className="p-1 rounded hover:bg-red-500/10 text-red-400 hover:text-red-500 transition-colors"
                          title="Batal"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="text-xs font-semibold">
                    Total ({farmers.length} pembudidaya)
                  </TableCell>
                  <TableCell className="text-xs text-right text-muted-foreground">
                    100%
                  </TableCell>
                  <TableCell className="text-xs text-center">
                    {fmtNum(farmers.reduce((s, f) => s + f.allocatedQty, 0))}
                  </TableCell>
                  <TableCell className="text-xs text-center text-muted-foreground">
                    -
                  </TableCell>
                  <TableCell
                    className="text-xs text-right font-bold"
                    style={{ color: '#06B6D4' }}
                  >
                    {fmtNum(totalFinalQty)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowNewFarmer(true)}
            disabled={showNewFarmer}
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Pembudidaya Baru
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExportExcel}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              Export Excel
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
              onClick={() => setStep(3)}
            >
              <Save className="h-3.5 w-3.5" />
              Simpan ke Database
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 3: Save ────────────────────────────────────────────────────────

  function renderStep3() {
    return (
      <div className="space-y-4">
        {/* Summary */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: 'rgba(6,182,212,0.04)',
            border: '1px solid rgba(6,182,212,0.12)',
          }}
        >
          <h3 className="text-sm font-semibold">Ringkasan Disagregasi</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground">Periode</p>
              <p className="text-xs font-semibold">{form.triwulan} {form.year}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Jenis Usaha</p>
              <p className="text-xs font-semibold">{form.businessType}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Total Agregat</p>
              <p className="text-xs font-semibold">{fmtNum(totalQtyNum)} {unitLabel}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Jumlah Pembudidaya</p>
              <p className="text-xs font-semibold">{farmers.length}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground">Total Terdistribusi</p>
              <p className="text-xs font-semibold" style={{ color: '#06B6D4' }}>
                {fmtNum(totalFinalQty)} {unitLabel}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Selisih</p>
              <p className="text-xs font-semibold" style={{ color: Math.abs(balanceDiff) < 0.01 ? '#22C55E' : '#EAB308' }}>
                {Math.abs(balanceDiff) < 0.01 ? 'Seimbang ✓' : `${balanceDiff > 0 ? '+' : ''}${fmtNum(balanceDiff)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Farmer list summary */}
        <div className="border rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[200px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow style={{ background: 'rgba(6,182,212,0.08)' }}>
                  <TableHead className="text-xs w-10 text-center">No</TableHead>
                  <TableHead className="text-xs">Nama</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Kelompok</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Desa</TableHead>
                  <TableHead className="text-xs text-right">Nilai Akhir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {farmers.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-center text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="text-xs font-medium">
                      {f.farmerName}
                      {f.isNew && (
                        <Badge className="h-4 text-[9px] px-1 ml-1" style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)', color: 'white', border: 'none' }}>
                          BARU
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs hidden sm:table-cell text-muted-foreground">{f.groupName || '-'}</TableCell>
                    <TableCell className="text-xs hidden sm:table-cell text-muted-foreground">{f.desa}</TableCell>
                    <TableCell className="text-xs text-right font-semibold" style={{ color: '#06B6D4' }}>
                      {fmtNum(f.finalQty)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Catatan (opsional)</Label>
          <Input
            placeholder="Catatan untuk batch disagregasi ini..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-sm"
          />
        </div>

        {/* Password confirmation */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Konfirmasi Sandi Admin
          </Label>
          <Input
            type="password"
            placeholder="Masukkan sandi admin untuk konfirmasi..."
            value={savePassword}
            onChange={(e) => setSavePassword(e.target.value)}
            className="text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setStep(2)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExportExcel}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              Export Excel
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
              onClick={handleSave}
              disabled={saving || !savePassword.trim()}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saving ? 'Menyimpan...' : 'Simpan ke Database'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Upload Excel Section ──────────────────────────────────────────────

  function UploadExcelSection() {
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadPassword, setUploadPassword] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
    const [existingUploads, setExistingUploads] = useState<{ year: number; fileName: string; rows: number; createdAt: string }[]>([]);
    const [loadingUploads, setLoadingUploads] = useState(false);

    const fetchExistingUploads = useCallback(async () => {
      setLoadingUploads(true);
      try {
        // Fetch all years in parallel; availableYears is returned by every
        // per-year response, so we no longer need a separate year=0 call.
        const yearsRes = await fetch(`/api/analyze/dashboard?year=${new Date().getFullYear()}`);
        let years: number[] = [];
        if (yearsRes.ok) {
          const yearsData = await yearsRes.json();
          years = yearsData.availableYears || [];
        }
        const uploads: { year: number; fileName: string; rows: number; createdAt: string }[] = [];
        const results = await Promise.all(
          years.map((y) =>
            fetch(`/api/analyze/dashboard?year=${y}`)
              .then((r) => (r.ok ? r.json().then((d) => ({ year: y, d })) : null))
              .catch(() => null),
          ),
        );
        for (const entry of results) {
          if (entry && entry.d && entry.d.hasData) {
            const yd = entry.d;
            uploads.push({
              year: entry.year,
              fileName: yd.source === 'upload' ? 'Excel Upload' : 'Disagregasi DB',
              rows: yd.summary?.totalRtp || 0,
              createdAt: new Date().toISOString(),
            });
          }
        }
        setExistingUploads(uploads);
      } catch {
        // Silently fail
      } finally {
        setLoadingUploads(false);
      }
    }, []);

    useEffect(() => {
      fetchExistingUploads();
    }, [fetchExistingUploads]);

    const handleUpload = useCallback(async () => {
      if (!uploadFile) {
        toast.error('Pilih file Excel terlebih dahulu');
        return;
      }
      if (!uploadPassword.trim()) {
        toast.error('Masukkan sandi admin untuk konfirmasi');
        return;
      }

      setUploading(true);
      setUploadResult(null);
      try {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('password', uploadPassword);

        const res = await fetch('/api/analyze/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (res.ok) {
          setUploadResult({ success: true, message: `Berhasil! ${data.rowCount} baris data + ${data.populasiCount} data populasi untuk tahun ${data.year}` });
          toast.success(`Upload berhasil — tahun ${data.year}`);
          setUploadFile(null);
          setUploadPassword('');
          fetchExistingUploads();
        } else {
          setUploadResult({ success: false, message: data.error || 'Gagal mengunggah file' });
          toast.error(data.error || 'Gagal mengunggah');
        }
      } catch {
        setUploadResult({ success: false, message: 'Gagal terhubung ke server' });
        toast.error('Gagal terhubung ke server');
      } finally {
        setUploading(false);
      }
    }, [uploadFile, uploadPassword, fetchExistingUploads]);

    return (
      <div className="space-y-4">
        {/* Upload form */}
        <div
          className="rounded-xl p-4 sm:p-5 space-y-4"
          style={{
            background: 'rgba(6,182,212,0.04)',
            border: '1px solid rgba(6,182,212,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                boxShadow: '0 4px 12px rgba(6,182,212,0.3)',
              }}
            >
              <FileUp className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Upload Data Analisis</h3>
              <p className="text-[10px] text-muted-foreground">
                Upload file Excel SIPBD untuk dashboard analisis dinamis
              </p>
            </div>
          </div>

          {/* File input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">File Excel (.xlsx)</Label>
            <div
              className="relative rounded-lg p-4 text-center cursor-pointer transition-all hover:border-cyan-500/30"
              style={{
                border: '2px dashed rgba(6,182,212,0.2)',
                background: 'rgba(6,182,212,0.02)',
              }}
              onClick={() => document.getElementById('excel-upload-input')?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2" style={{ color: '#06B6D4', opacity: 0.6 }} />
              {uploadFile ? (
                <div>
                  <p className="text-xs font-medium">{uploadFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(uploadFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium">Klik untuk memilih file</p>
                  <p className="text-[10px] text-muted-foreground">
                    Format: SIPBD Excel (.xlsx) — berisi sheet &quot;Database&quot; dan &quot;Data Populasi&quot;
                  </p>
                </div>
              )}
              <input
                id="excel-upload-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setUploadFile(file);
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              Konfirmasi Sandi Admin
            </Label>
            <Input
              type="password"
              placeholder="Masukkan sandi admin..."
              value={uploadPassword}
              onChange={(e) => setUploadPassword(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Upload result */}
          {uploadResult && (
            <div
              className="rounded-lg p-3 text-xs"
              style={{
                background: uploadResult.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${uploadResult.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                color: uploadResult.success ? '#22C55E' : '#EF4444',
              }}
            >
              {uploadResult.message}
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleUpload}
            disabled={!uploadFile || uploading || !uploadPassword.trim()}
            className="w-full gap-2"
            style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Mengupload & Memproses...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload & Proses
              </>
            )}
          </Button>
        </div>

        {/* Format info */}
        <div
          className="rounded-xl p-4 space-y-2"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" style={{ color: '#06B6D4' }} />
            Format File Excel
          </h4>
          <div className="text-[10px] text-muted-foreground space-y-1.5">
            <p>File harus mengikuti format standar SIPBD dengan sheet:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li><strong>Rekap Produksi</strong> — judul berisi tahun (e.g. &quot;PEMBESARAN IKAN - 2026&quot;)</li>
              <li><strong>Database</strong> — data per baris: Bulan, TW, Semester, Jenis Wadah, Komoditas, Produksi, dll</li>
              <li><strong>Data Populasi</strong> — RTP, Pembudidaya, Luas Lahan per Jenis Wadah</li>
            </ul>
            <p className="pt-1">Upload baru akan <strong>mengganti</strong> data tahun yang sama.</p>
          </div>
        </div>

        {/* Existing uploads */}
        {existingUploads.length > 0 && (
          <div
            className="rounded-xl p-4 space-y-2"
            style={{
              background: 'rgba(34,197,94,0.04)',
              border: '1px solid rgba(34,197,94,0.12)',
            }}
          >
            <h4 className="text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#22C55E' }} />
              Data Tersedia
            </h4>
            <div className="space-y-1.5">
              {existingUploads.map((u) => (
                <div key={u.year} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md"
                  style={{ background: 'rgba(34,197,94,0.06)' }}
                >
                  <div>
                    <span className="font-semibold" style={{ color: '#22C55E' }}>Tahun {u.year}</span>
                    <span className="text-muted-foreground ml-2">({u.fileName})</span>
                  </div>
                  <span className="text-muted-foreground text-[10px]">
                    Lihat di tab &quot;Analisis Disagregasi S1&quot;
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
}
