'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Split,
  Search,
  Users,
  Plus,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Lock,
  Save,
  Trash2,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import {
  KECAMATAN_LIST,
  KECAMATAN_DESA,
  FISH_TYPES,
  CONTAINER_TYPES,
} from '@/lib/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FarmerAllocation {
  farmerId: string;
  farmerName: string;
  groupName: string;
  desa: string;
  referenceQty: number;
  proportion: number;
  allocatedQty: number;
  adjustmentPct: number;
  finalQty: number;
  isNew: boolean;
  // metadata for save
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
  kecamatan: string;
  businessType: string;
  fishType: string;
  containerType: string;
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
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

const TRIWULAN_OPTIONS = [
  { value: 'Q1', label: 'Q1 (Jan-Mar)' },
  { value: 'Q2', label: 'Q2 (Apr-Jun)' },
  { value: 'Q3', label: 'Q3 (Jul-Sep)' },
  { value: 'Q4', label: 'Q4 (Okt-Des)' },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface DisaggregationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DisaggregationDialog({ open, onOpenChange }: DisaggregationDialogProps) {
  // Step control
  const [step, setStep] = useState(1);

  // Step 1 — Aggregate input
  const [form, setForm] = useState<AgregatForm>({
    year: '',
    triwulan: '',
    kecamatan: '',
    businessType: '',
    fishType: '',
    containerType: '',
    totalQty: '',
  });

  // Step 2 — Distribution
  const [farmers, setFarmers] = useState<FarmerAllocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [referenceInfo, setReferenceInfo] = useState<{ hasReference: boolean; referenceYear: number } | null>(null);

  // Step 3 — New farmer inline form
  const [showNewFarmer, setShowNewFarmer] = useState(false);
  const [newFarmer, setNewFarmer] = useState<NewFarmerForm>({
    farmerName: '',
    groupName: '',
    desa: '',
    allocatedQty: '',
  });

  // Step 4 — Save
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // ─── Derived ─────────────────────────────────────────────────────────────

  const totalQtyNum = useMemo(() => parseFloat(form.totalQty) || 0, [form.totalQty]);
  const unitLabel = form.businessType === 'Pembenihan' ? 'Ekor' : 'Kg';

  const totalFinalQty = useMemo(
    () => farmers.reduce((s, f) => s + f.finalQty, 0),
    [farmers],
  );

  const isFormValid = useMemo(
    () =>
      form.year &&
      parseInt(form.year) >= 2000 &&
      parseInt(form.year) <= 2099 &&
      form.triwulan &&
      form.kecamatan &&
      form.businessType &&
      form.fishType &&
      form.containerType &&
      form.totalQty &&
      parseFloat(form.totalQty) > 0,
    [form],
  );

  const desaOptions = useMemo(() => {
    if (!form.kecamatan) return [];
    return KECAMATAN_DESA[form.kecamatan] || [];
  }, [form.kecamatan]);

  // ─── Recalculation logic ────────────────────────────────────────────────

  const recalculate = useCallback(
    (currentFarmers: FarmerAllocation[], totalQty: number): FarmerAllocation[] => {
      if (currentFarmers.length === 0 || totalQty <= 0) return currentFarmers;

      // 1. Calculate adjusted values for all farmers
      const withAdjusted = currentFarmers.map((f) => ({
        ...f,
        finalQty: f.allocatedQty * (1 + f.adjustmentPct / 100),
      }));

      // 2. Sum of adjusted values
      const sumAdjusted = withAdjusted.reduce((s, f) => s + f.finalQty, 0);

      // 3. If sum ≠ totalQty, scale proportionally
      if (Math.abs(sumAdjusted - totalQty) > 0.01) {
        // Identify farmers with zero adjustment (neutral)
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

        // If no neutral farmers, scale everything proportionally
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
        kecamatan: form.kecamatan,
        fishType: form.fishType,
        containerType: form.containerType,
        businessType: form.businessType,
        totalQty: form.totalQty,
      });

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

  const handleAdjustmentChange = useCallback(
    (index: number, value: string) => {
      const numVal = parseFloat(value) || 0;
      setFarmers((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], adjustmentPct: numVal };
        return recalculate(updated, totalQtyNum);
      });
    },
    [totalQtyNum, recalculate],
  );

  const handleBulkAdjust = useCallback(
    (pct: number) => {
      setFarmers((prev) => {
        const updated = prev.map((f) => ({
          ...f,
          adjustmentPct: f.adjustmentPct + pct,
        }));
        return recalculate(updated, totalQtyNum);
      });
    },
    [totalQtyNum, recalculate],
  );

  const handleResetDistribution = useCallback(() => {
    setFarmers((prev) => {
      const updated = prev.map((f) => ({
        ...f,
        adjustmentPct: 0,
        finalQty: f.allocatedQty,
      }));
      return recalculate(updated, totalQtyNum);
    });
  }, [totalQtyNum, recalculate]);

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
      referenceQty: 0,
      proportion: 0,
      allocatedQty: 0, // Will be recalculated
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

    // Redistribute: subtract new farmer's allocation from total, redistribute remaining
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
  }, [newFarmer, totalQtyNum]);

  const handleRemoveFarmer = useCallback(
    (index: number) => {
      setFarmers((prev) => {
        const updated = prev.filter((_, i) => i !== index);
        // Redistribute the removed farmer's allocation
        const removedFinal = prev[index].finalQty;
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

  const handleClose = useCallback(() => {
    setStep(1);
    setForm({
      year: '',
      triwulan: '',
      kecamatan: '',
      businessType: '',
      fishType: '',
      containerType: '',
      totalQty: '',
    });
    setFarmers([]);
    setReferenceInfo(null);
    setShowNewFarmer(false);
    setNewFarmer({ farmerName: '', groupName: '', desa: '', allocatedQty: '' });
    setPassword('');
    setNotes('');
    setSaving(false);
    setLoading(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSave = useCallback(async () => {
    if (!password.trim()) {
      toast.error('Masukkan sandi untuk menyimpan');
      return;
    }

    setSaving(true);
    try {
      const body = {
        password,
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
      handleClose();
    } catch {
      toast.error('Gagal terhubung ke server');
    } finally {
      setSaving(false);
    }
  }, [password, form, totalQtyNum, notes, farmers, handleClose]);

  // ─── Step indicators ─────────────────────────────────────────────────────

  const steps = [
    { num: 1, label: 'Input Agregat' },
    { num: 2, label: 'Distribusi' },
    { num: 3, label: 'Tambah Baru' },
    { num: 4, label: 'Simpan' },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
        else onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Split className="h-5 w-5" style={{ color: '#06B6D4' }} />
            Disagregasi Data Agregat
          </DialogTitle>
          <DialogDescription>
            Distribusi data agregat produksi ke data individual pembudidaya
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1 sm:gap-2 py-2">
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
            {step === 4 && renderStep4()}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );

  // ─── Step 1: Input Data Agregat ──────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-4">
        <div className="rounded-xl p-4 sm:p-5 space-y-4"
          style={{
            background: 'rgba(6,182,212,0.04)',
            border: '1px solid rgba(6,182,212,0.12)',
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tahun */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tahun</Label>
              <Input
                type="number"
                min="2000"
                max="2099"
                placeholder="Contoh: 2025"
                value={form.year}
                onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
                className="text-sm"
              />
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

            {/* Kecamatan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Kecamatan</Label>
              <Select
                value={form.kecamatan}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, kecamatan: v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih kecamatan" />
                </SelectTrigger>
                <SelectContent>
                  {KECAMATAN_LIST.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {/* Jenis Ikan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Jenis Ikan</Label>
              <Select
                value={form.fishType}
                onValueChange={(v) => setForm((p) => ({ ...p, fishType: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih jenis ikan" />
                </SelectTrigger>
                <SelectContent>
                  {FISH_TYPES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Wadah Budidaya */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Wadah Budidaya</Label>
              <Select
                value={form.containerType}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, containerType: v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih wadah" />
                </SelectTrigger>
                <SelectContent>
                  {CONTAINER_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Total Produksi */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium">
                Total Produksi ({unitLabel})
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
          <span>{form.fishType}</span>
          <span className="opacity-40">·</span>
          <span>{form.containerType}</span>
          <span className="opacity-40">·</span>
          <span>{form.kecamatan}</span>
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

        {/* Quick adjustment buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Adjust semua:</span>
          {[-10, -5, 5, 10].map((pct) => (
            <Button
              key={pct}
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => handleBulkAdjust(pct)}
            >
              {pct > 0 ? '+' : ''}
              {pct}%
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 ml-auto"
            onClick={handleResetDistribution}
          >
            <RotateCcw className="h-3 w-3" />
            Reset Distribusi
          </Button>
        </div>

        {/* Distribution table */}
        <div className="border rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
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
                  <TableHead className="text-xs hidden md:table-cell">Desa</TableHead>
                  <TableHead className="text-xs text-right">Riwayat</TableHead>
                  <TableHead className="text-xs text-right">Proporsi</TableHead>
                  <TableHead className="text-xs text-right">Alokasi</TableHead>
                  <TableHead className="text-xs text-center w-24">Adj (%)</TableHead>
                  <TableHead className="text-xs text-right">Nilai Akhir</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {farmers.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {i + 1}
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
                      {f.desa}
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      {f.referenceQty > 0 ? fmtNum(f.referenceQty) : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      {(f.proportion * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {fmtNum(f.allocatedQty)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        value={f.adjustmentPct || ''}
                        onChange={(e) => handleAdjustmentChange(i, e.target.value)}
                        className="h-7 w-20 text-xs text-center mx-auto"
                        placeholder="0"
                      />
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
                ))}

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
                    <TableCell className="text-xs text-right text-muted-foreground">
                      -
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      -
                    </TableCell>
                    <TableCell>
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
                  <TableCell className="text-xs text-right font-semibold">
                    100%
                  </TableCell>
                  <TableCell className="text-xs text-right font-semibold">
                    {fmtNum(farmers.reduce((s, f) => s + f.allocatedQty, 0))}
                  </TableCell>
                  <TableCell />
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

        {/* Total validation */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{
            background:
              Math.abs(totalFinalQty - totalQtyNum) < 0.1
                ? 'rgba(16,185,129,0.08)'
                : 'rgba(245,158,11,0.08)',
            border: `1px solid ${
              Math.abs(totalFinalQty - totalQtyNum) < 0.1
                ? 'rgba(16,185,129,0.2)'
                : 'rgba(245,158,11,0.2)'
            }`,
            color:
              Math.abs(totalFinalQty - totalQtyNum) < 0.1
                ? '#10B981'
                : '#F59E0B',
          }}
        >
          {Math.abs(totalFinalQty - totalQtyNum) < 0.1 ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>
            Total Terdistribusi: {fmtNum(totalFinalQty)} {unitLabel}
            {Math.abs(totalFinalQty - totalQtyNum) < 0.1
              ? ` = Total Agregat ✅`
              : ` ≠ Total Agregat (${fmtNum(totalQtyNum)} ${unitLabel}) — selisih ${fmtNum(Math.abs(totalFinalQty - totalQtyNum))}`}
          </span>
        </div>

        {/* Add new farmer button */}
        {!showNewFarmer && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => setShowNewFarmer(true)}
            style={{ borderColor: 'rgba(6,182,212,0.3)', color: '#06B6D4' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Pembudidaya Baru
          </Button>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setStep(1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Kembali
          </Button>
          <Button
            size="sm"
            className="gap-1"
            style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
            onClick={() => setStep(4)}
            disabled={farmers.length === 0}
          >
            Lanjut Review
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ─── Step 3: (Integrated into Step 2 as inline form) ─────────────────────

  function renderStep3() {
    // Step 3 is integrated as inline form in the table
    // This is kept for the step indicator but redirects to step 2
    setStep(2);
    return null;
  }

  // ─── Step 4: Review & Save ───────────────────────────────────────────────

  function renderStep4() {
    const isTotalMatch = Math.abs(totalFinalQty - totalQtyNum) < 0.1;

    return (
      <div className="space-y-4">
        {/* Summary card */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: 'rgba(6,182,212,0.04)',
            border: '1px solid rgba(6,182,212,0.12)',
          }}
        >
          <h4 className="text-sm font-semibold" style={{ color: '#06B6D4' }}>
            Data Agregat
          </h4>
          <p className="text-sm">
            {form.triwulan} {form.year} · {form.businessType} · {form.fishType} ·{' '}
            {form.containerType} · {form.kecamatan} · Total:{' '}
            <strong>{fmtNum(totalQtyNum)} {unitLabel}</strong>
          </p>
        </div>

        {/* Farmer list */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">
            Distribusi Pembudidaya ({farmers.length})
          </h4>
          <div className="overflow-x-auto max-h-[280px] overflow-y-auto custom-scrollbar border rounded-xl">
            <Table>
              <TableHeader>
                <TableRow style={{ background: 'rgba(6,182,212,0.08)' }}>
                  <TableHead className="text-xs w-10 text-center">No</TableHead>
                  <TableHead className="text-xs">Nama</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Kelompok</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Desa</TableHead>
                  <TableHead className="text-xs text-right">Alokasi ({unitLabel})</TableHead>
                  <TableHead className="text-xs text-right">Adj</TableHead>
                  <TableHead className="text-xs text-right font-semibold">
                    Nilai Akhir
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {farmers.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {i + 1}
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
                    <TableCell className="text-xs hidden sm:table-cell text-muted-foreground">
                      {f.desa}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {fmtNum(f.allocatedQty)}
                    </TableCell>
                    <TableCell
                      className="text-xs text-right"
                      style={{
                        color:
                          f.adjustmentPct > 0
                            ? '#10B981'
                            : f.adjustmentPct < 0
                            ? '#EF4444'
                            : 'var(--muted-foreground)',
                      }}
                    >
                      {f.adjustmentPct !== 0 ? fmtPct(f.adjustmentPct) : '-'}
                    </TableCell>
                    <TableCell
                      className="text-xs text-right font-semibold"
                      style={{ color: '#06B6D4' }}
                    >
                      {fmtNum(f.finalQty)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="text-xs font-semibold">
                    Total
                  </TableCell>
                  <TableCell className="text-xs text-right font-semibold">
                    {fmtNum(farmers.reduce((s, f) => s + f.allocatedQty, 0))}
                  </TableCell>
                  <TableCell />
                  <TableCell
                    className="text-xs text-right font-bold"
                    style={{ color: '#06B6D4' }}
                  >
                    {fmtNum(totalFinalQty)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>

        {/* Total validation */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
          style={{
            background: isTotalMatch
              ? 'rgba(16,185,129,0.08)'
              : 'rgba(245,158,11,0.08)',
            border: `1px solid ${
              isTotalMatch ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'
            }`,
            color: isTotalMatch ? '#10B981' : '#F59E0B',
          }}
        >
          {isTotalMatch ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span className="font-medium">
            Total Terdistribusi = Total Agregat: {fmtNum(totalFinalQty)} {unitLabel}{' '}
            {isTotalMatch ? '✅' : '⚠️'}
          </span>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Catatan (opsional)</Label>
          <Input
            placeholder="Catatan tambahan..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-sm"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Sandi Konfirmasi
          </Label>
          <Input
            type="password"
            placeholder="Masukkan sandi admin..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="text-sm"
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setStep(2)}
          >
            <ChevronLeft className="h-4 w-4" />
            Kembali
          </Button>
          <Button
            size="sm"
            className="gap-2"
            style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
            onClick={handleSave}
            disabled={saving || !password.trim() || !isTotalMatch}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Simpan ke Database
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }
}
