'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Scale,
  Save,
  Download,
  RotateCcw,
  CheckCircle2,
  Layers,
  FolderTree,
  Plus,
  X,
  Info,
  Zap,
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
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DimensionKey = 'kecamatan' | 'desa' | 'kelompok' | 'ikan' | 'wadah';

interface BalanceNode {
  id: string;
  label: string;
  value: number;
  isManual: boolean;
  childDimension?: DimensionKey;
  children?: BalanceNode[];
}

interface BalanceTreeState {
  root: BalanceNode;
}

interface BalanceEditorProps {
  farmers: FarmerForBalance[];
  totalQty: number;
  unitLabel: string;
  formKey: string;
  onApply: (allocations: { farmerId: string; finalQty: number }[]) => void;
}

export interface FarmerForBalance {
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
  finalQty: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtNum = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  kecamatan: 'Kecamatan',
  desa: 'Desa',
  kelompok: 'Kelompok',
  ikan: 'Jenis Ikan',
  wadah: 'Jenis Wadah',
};

const ALL_DIMENSIONS: DimensionKey[] = ['kecamatan', 'desa', 'kelompok', 'ikan', 'wadah'];

function getFarmerDimensionValue(farmer: FarmerForBalance, dim: DimensionKey): string {
  switch (dim) {
    case 'kecamatan': return farmer.kecamatan;
    case 'desa': return farmer.desa;
    case 'kelompok': return farmer.groupName || '(Tanpa Kelompok)';
    case 'ikan': return farmer.fishType;
    case 'wadah': return farmer.containerType;
  }
}

function getUniqueDimensionValues(farmers: FarmerForBalance[], dim: DimensionKey): string[] {
  const set = new Set<string>();
  for (const f of farmers) {
    const v = getFarmerDimensionValue(f, dim);
    if (v) set.add(v);
  }
  return Array.from(set).sort();
}

function filterFarmers(farmers: FarmerForBalance[], filters: Record<string, string>): FarmerForBalance[] {
  return farmers.filter((f) => {
    for (const [dim, val] of Object.entries(filters)) {
      if (getFarmerDimensionValue(f, dim as DimensionKey) !== val) return false;
    }
    return true;
  });
}

function getUsedDimensions(node: BalanceNode): DimensionKey[] {
  const dims: DimensionKey[] = [];
  if (node.childDimension) {
    dims.push(node.childDimension);
    if (node.children) {
      for (const child of node.children) {
        dims.push(...getUsedDimensions(child));
      }
    }
  }
  return dims;
}

function computeChildrenSum(node: BalanceNode): number {
  if (!node.children || node.children.length === 0) return 0;
  return node.children.reduce((s, c) => s + c.value, 0);
}

function isBalanced(node: BalanceNode): boolean {
  if (!node.children || node.children.length === 0) return true;
  return Math.abs(node.value - computeChildrenSum(node)) < 0.01;
}

// ─── Tree manipulation helpers (pure functions) ──────────────────────────────

function updateNodeById(root: BalanceNode, nodeId: string, update: (node: BalanceNode) => BalanceNode): BalanceNode {
  if (root.id === nodeId) return update(root);
  if (root.children) {
    return {
      ...root,
      children: root.children.map((c) => updateNodeById(c, nodeId, update)),
    };
  }
  return root;
}

function findNodeById(root: BalanceNode, nodeId: string): BalanceNode | null {
  if (root.id === nodeId) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeById(child, nodeId);
      if (found) return found;
    }
  }
  return null;
}

// ─── Force Balance (Proportional) ────────────────────────────────────────────

function forceBalanceNode(node: BalanceNode): BalanceNode {
  if (!node.children || node.children.length === 0) return node;

  const childSum = computeChildrenSum(node);
  const diff = node.value - childSum;

  if (Math.abs(diff) < 0.01) {
    return {
      ...node,
      children: node.children.map((c) => forceBalanceNode(c)),
    };
  }

  const newChildren = node.children.map((c, i) => {
    if (childSum === 0) {
      const evenAmount = node.value / node.children!.length;
      const val = i === 0
        ? Math.round((node.value - evenAmount * (node.children!.length - 1)) * 100) / 100
        : Math.round(evenAmount * 100) / 100;
      return { ...c, value: val, isManual: false };
    }
    const proportion = c.value / childSum;
    const newValue = c.value + diff * proportion;
    return { ...c, value: Math.round(newValue * 100) / 100, isManual: false };
  });

  // Fix rounding
  const newSum = newChildren.reduce((s, c) => s + c.value, 0);
  const roundingDiff = Math.round((node.value - newSum) * 100) / 100;
  if (Math.abs(roundingDiff) > 0.001) {
    newChildren[0] = {
      ...newChildren[0],
      value: Math.round((newChildren[0].value + roundingDiff) * 100) / 100,
    };
  }

  return {
    ...node,
    children: newChildren.map((c) => forceBalanceNode(c)),
  };
}

// ─── localStorage helpers ────────────────────────────────────────────────────

function saveDraft(key: string, state: BalanceTreeState) {
  try {
    localStorage.setItem(`balance-draft-${key}`, JSON.stringify(state));
  } catch {
    // Silently fail
  }
}

function loadDraft(key: string): BalanceTreeState | null {
  try {
    const raw = localStorage.getItem(`balance-draft-${key}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Silently fail
  }
  return null;
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(`balance-draft-${key}`);
  } catch {
    // Silently fail
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BalanceEditor({ farmers, totalQty, unitLabel, formKey, onApply }: BalanceEditorProps) {
  // ─── State ──────────────────────────────────────────────────────────────

  const [tree, setTree] = useState<BalanceTreeState>(() => {
    const draft = loadDraft(formKey);
    if (draft) return draft;
    return {
      root: {
        id: 'root',
        label: 'Total Agregat',
        value: totalQty,
        isManual: true,
        childDimension: undefined,
        children: undefined,
      },
    };
  });

  const [path, setPath] = useState<{ nodeId: string; filters: Record<string, string> }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // ─── Root value synced with totalQty ────────────────────────────────────

  const effectiveTree = useMemo<BalanceTreeState>(() => ({
    root: { ...tree.root, value: totalQty },
  }), [tree, totalQty]);

  // Resolve current node by ID from effectiveTree (avoids stale references)
  const currentNode = useMemo(() => {
    if (path.length === 0) return effectiveTree.root;
    const targetId = path[path.length - 1].nodeId;
    const found = findNodeById(effectiveTree.root, targetId);
    return found || effectiveTree.root;
  }, [path, effectiveTree]);

  const currentFilters = useMemo(() => {
    if (path.length === 0) return {};
    return path[path.length - 1].filters;
  }, [path]);

  const currentFarmers = useMemo(
    () => filterFarmers(farmers, currentFilters),
    [farmers, currentFilters],
  );

  // Available dimensions (not yet used anywhere in the tree)
  const availableDimensions = useMemo(() => {
    const usedDims = new Set(getUsedDimensions(effectiveTree.root));
    return ALL_DIMENSIONS.filter((d) => !usedDims.has(d));
  }, [effectiveTree]);

  // ─── Auto-save draft ────────────────────────────────────────────────────

  useEffect(() => {
    saveDraft(formKey, tree);
  }, [tree, formKey]);

  // ─── Actions ────────────────────────────────────────────────────────────

  const updateTree = useCallback((updater: (root: BalanceNode) => BalanceNode) => {
    setTree((prev) => ({
      ...prev,
      root: updater(prev.root),
    }));
  }, []);

  // Add dimension to current node
  const handleAddDimension = useCallback((dimension: DimensionKey) => {
    updateTree((root) => {
      const targetId = currentNode.id;
      return updateNodeById(root, targetId, (node) => {
        const relevantFarmers = filterFarmers(farmers, currentFilters);
        const values = getUniqueDimensionValues(relevantFarmers, dimension);
        const totalRefQty = relevantFarmers.reduce((s, f) => s + (f.referenceQty || f.allocatedQty || 1), 0);

        let remaining = node.value;
        const children: BalanceNode[] = values.map((val, i) => {
          const matchingFarmers = relevantFarmers.filter((f) => getFarmerDimensionValue(f, dimension) === val);
          const refTotal = matchingFarmers.reduce((s, f) => s + (f.referenceQty || f.allocatedQty || 1), 0);
          const proportion = totalRefQty > 0 ? refTotal / totalRefQty : 1 / values.length;
          let value = Math.round(node.value * proportion * 100) / 100;
          if (i === values.length - 1) {
            value = Math.round(remaining * 100) / 100;
          } else {
            remaining -= value;
          }
          return {
            id: `${node.id}-${val}`,
            label: val,
            value,
            isManual: false,
            childDimension: undefined,
            children: undefined,
          };
        });

        return { ...node, childDimension: dimension, children };
      });
    });
  }, [currentNode, farmers, currentFilters, updateTree]);

  // Edit a child's value
  const handleValueChange = useCallback((nodeId: string, newValue: number) => {
    updateTree((root) =>
      updateNodeById(root, nodeId, (node) => ({
        ...node,
        value: newValue,
        isManual: true,
      }))
    );
  }, [updateTree]);

  // Force balance at current level
  const handleForceBalance = useCallback(() => {
    updateTree((root) =>
      updateNodeById(root, currentNode.id, (node) => forceBalanceNode(node))
    );
    toast.success('Balance diterapkan secara proporsional');
  }, [currentNode, updateTree]);

  // Force balance entire tree
  const handleForceBalanceAll = useCallback(() => {
    updateTree((root) => forceBalanceNode(root));
    toast.success('Seluruh tree di-balance secara proporsional');
  }, [updateTree]);

  // Drill down into a child
  const handleDrillDown = useCallback((child: BalanceNode) => {
    const dim = currentNode.childDimension;
    if (!dim) return;
    setPath((prev) => [
      ...prev,
      {
        nodeId: child.id,
        filters: { ...currentFilters, [dim]: child.label },
      },
    ]);
  }, [currentFilters, currentNode]);

  // Navigate back via breadcrumb
  const handleNavigateBack = useCallback((index: number) => {
    if (index === -1) {
      setPath([]);
    } else {
      setPath((prev) => prev.slice(0, index + 1));
    }
  }, []);

  // Remove dimension from a node
  const handleRemoveDimension = useCallback((nodeId: string) => {
    updateTree((root) =>
      updateNodeById(root, nodeId, (node) => ({
        ...node,
        childDimension: undefined,
        children: undefined,
      }))
    );
  }, [updateTree]);

  // Reset entire tree
  const handleReset = useCallback(() => {
    setTree({
      root: {
        id: 'root',
        label: 'Total Agregat',
        value: totalQty,
        isManual: true,
        childDimension: undefined,
        children: undefined,
      },
    });
    setPath([]);
    clearDraft(formKey);
    toast.success('Balance editor direset');
  }, [totalQty, formKey]);

  // Apply to farmer table
  const handleApply = useCallback(() => {
    // Build a map of dimension combination → value from the tree
    const leafValues = new Map<string, number>();

    function collectLeaves(node: BalanceNode, filters: Record<string, string>) {
      if (!node.children || node.children.length === 0) {
        const key = Object.entries(filters)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join('|');
        leafValues.set(key, node.value);
        return;
      }
      if (node.childDimension) {
        for (const child of node.children) {
          collectLeaves(child, { ...filters, [node.childDimension]: child.label });
        }
      }
    }

    collectLeaves(effectiveTree.root, {});

    // Map leaf values to farmers
    const allocations: { farmerId: string; finalQty: number }[] = [];

    if (leafValues.size === 0) {
      // No dimensions used — distribute proportionally
      const totalRefQty = farmers.reduce((s, f) => s + (f.referenceQty || f.allocatedQty || 1), 0);
      let remaining = totalQty;
      for (let i = 0; i < farmers.length; i++) {
        const f = farmers[i];
        const refQty = f.referenceQty || f.allocatedQty || 1;
        const proportion = totalRefQty > 0 ? refQty / totalRefQty : 1 / farmers.length;
        let value = Math.round(totalQty * proportion * 100) / 100;
        if (i === farmers.length - 1) {
          value = Math.round(remaining * 100) / 100;
        } else {
          remaining -= value;
        }
        allocations.push({ farmerId: f.farmerId, finalQty: value });
      }
    } else {
      // Group farmers by their matching leaf
      for (const f of farmers) {
        let matched = false;
        for (const [key, value] of leafValues.entries()) {
          const parts = key.split('|');
          const filters: Record<string, string> = {};
          for (const part of parts) {
            const [k, v] = part.split('=');
            filters[k] = v;
          }

          const matches = Object.entries(filters).every(
            ([dim, val]) => getFarmerDimensionValue(f, dim as DimensionKey) === val,
          );

          if (matches) {
            const matchingFarmers = farmers.filter((ff) =>
              Object.entries(filters).every(
                ([dim, val]) => getFarmerDimensionValue(ff, dim as DimensionKey) === val,
              ),
            );
            const totalRefQty = matchingFarmers.reduce((s, ff) => s + (ff.referenceQty || ff.allocatedQty || 1), 0);
            const refQty = f.referenceQty || f.allocatedQty || 1;
            const proportion = totalRefQty > 0 ? refQty / totalRefQty : 1 / matchingFarmers.length;
            const farmerValue = Math.round(value * proportion * 100) / 100;
            allocations.push({ farmerId: f.farmerId, finalQty: farmerValue });
            matched = true;
            break;
          }
        }

        if (!matched) {
          allocations.push({ farmerId: f.farmerId, finalQty: f.finalQty });
        }
      }

      // Fix rounding at leaf level
      for (const [key, leafValue] of leafValues.entries()) {
        const parts = key.split('|');
        const filters: Record<string, string> = {};
        for (const part of parts) {
          const [k, v] = part.split('=');
          filters[k] = v;
        }

        const matchingAllocations = allocations.filter((a) => {
          const farmer = farmers.find((f) => f.farmerId === a.farmerId);
          if (!farmer) return false;
          return Object.entries(filters).every(
            ([dim, val]) => getFarmerDimensionValue(farmer, dim as DimensionKey) === val,
          );
        });

        if (matchingAllocations.length > 0) {
          const allocSum = matchingAllocations.reduce((s, a) => s + a.finalQty, 0);
          const roundingDiff = Math.round((leafValue - allocSum) * 100) / 100;
          if (Math.abs(roundingDiff) > 0.001) {
            const firstIdx = allocations.findIndex((a) => a.farmerId === matchingAllocations[0].farmerId);
            if (firstIdx >= 0) {
              allocations[firstIdx].finalQty = Math.round((allocations[firstIdx].finalQty + roundingDiff) * 100) / 100;
            }
          }
        }
      }
    }

    // Verify total
    const totalAllocated = allocations.reduce((s, a) => s + a.finalQty, 0);
    const diff = Math.abs(totalQty - totalAllocated);
    if (diff > 0.01 && allocations.length > 0) {
      allocations[0].finalQty = Math.round((allocations[0].finalQty + (totalQty - totalAllocated)) * 100) / 100;
    }

    onApply(allocations);
    toast.success(`Distribusi diterapkan ke ${allocations.length} pembudidaya`);
  }, [effectiveTree, farmers, totalQty, onApply]);

  // ─── Derived values ─────────────────────────────────────────────────────

  const childSum = useMemo(() => computeChildrenSum(currentNode), [currentNode]);
  const balanceDiff = useMemo(() => currentNode.value - childSum, [currentNode, childSum]);
  const balancePct = useMemo(
    () => currentNode.value > 0 ? (childSum / currentNode.value) * 100 : 0,
    [currentNode, childSum],
  );
  const isCurrentBalanced = Math.abs(balanceDiff) < 0.01;

  // Check if entire tree is balanced
  const isTreeBalanced = useMemo(() => {
    function check(node: BalanceNode): boolean {
      if (!node.children || node.children.length === 0) return true;
      if (Math.abs(node.value - computeChildrenSum(node)) >= 0.01) return false;
      return node.children.every((c) => check(c));
    }
    return check(effectiveTree.root);
  }, [effectiveTree]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(6,182,212,0.04)',
        border: '1px solid rgba(6,182,212,0.15)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(6,182,212,0.08)',
          borderBottom: '1px solid rgba(6,182,212,0.12)',
        }}
      >
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold">Hierarki Balance</span>
          <span className="text-xs text-muted-foreground">
            — {fmtNum(totalQty)} {unitLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isTreeBalanced ? (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}
            >
              ✓ Balance
            </span>
          ) : (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(234,179,8,0.15)', color: '#EAB308' }}
            >
              ⚠ Belum Balance
            </span>
          )}
        </div>
      </div>

      {/* Breadcrumb */}
      <div
        className="px-4 py-2 flex items-center gap-1 text-xs overflow-x-auto"
        style={{ borderBottom: '1px solid rgba(6,182,212,0.08)' }}
      >
        <button
          onClick={() => handleNavigateBack(-1)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-cyan-500/10 text-cyan-400 font-medium shrink-0"
        >
          <Layers className="h-3 w-3" />
          Root ({fmtNum(effectiveTree.root.value)})
        </button>
        {path.map((p, i) => {
          // Find the node in effectiveTree for label
          const pathNode = findNodeById(effectiveTree.root, p.nodeId);
          const label = pathNode?.label || '...';
          const val = pathNode?.value || 0;
          // Find parent dimension label
          let dimLabel = '';
          if (i === 0) {
            dimLabel = effectiveTree.root.childDimension ? DIMENSION_LABELS[effectiveTree.root.childDimension] : '';
          } else {
            const parentNode = findNodeById(effectiveTree.root, path[i - 1].nodeId);
            dimLabel = parentNode?.childDimension ? DIMENSION_LABELS[parentNode.childDimension] : '';
          }
          return (
            <div key={i} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground text-[10px]">{dimLabel}:</span>
              <button
                onClick={() => handleNavigateBack(i)}
                className={`px-1.5 py-0.5 rounded hover:bg-cyan-500/10 ${
                  i === path.length - 1 ? 'text-cyan-400 font-medium' : 'text-foreground'
                }`}
              >
                {label} ({fmtNum(val)})
              </button>
            </div>
          );
        })}
      </div>

      {/* Current level content */}
      <div className="p-4 space-y-3">
        {/* Current level info */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {currentNode.childDimension ? (
              <span>
                Distribusi per <strong className="text-foreground">{DIMENSION_LABELS[currentNode.childDimension]}</strong>
                {' '}— {currentFarmers.length} pembudidaya
              </span>
            ) : (
              <span>Belum ada dimensi — tambahkan dimensi untuk mulai distribusi</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {/* Add dimension button */}
            {availableDimensions.length > 0 && (
              <Select onValueChange={(v) => handleAddDimension(v as DimensionKey)}>
                <SelectTrigger className="h-7 w-44 text-xs">
                  <SelectValue placeholder="+ Tambah Dimensi" />
                </SelectTrigger>
                <SelectContent>
                  {availableDimensions.map((dim) => (
                    <SelectItem key={dim} value={dim} className="text-xs">
                      {DIMENSION_LABELS[dim]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Remove dimension button */}
            {currentNode.childDimension && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                onClick={() => handleRemoveDimension(currentNode.id)}
                title="Hapus dimensi ini"
              >
                <X className="h-3 w-3" />
                Hapus Dimensi
              </Button>
            )}
          </div>
        </div>

        {/* Balance indicator for current level */}
        {currentNode.children && currentNode.children.length > 0 && (
          <div
            className="rounded-lg p-2.5 space-y-1.5"
            style={{
              background: isCurrentBalanced ? 'rgba(34,197,94,0.06)' : 'rgba(234,179,8,0.06)',
              border: `1px solid ${isCurrentBalanced ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)'}`,
            }}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Balance Level Ini</span>
              <span className="font-semibold" style={{ color: isCurrentBalanced ? '#22C55E' : '#EAB308' }}>
                {fmtNum(childSum)} / {fmtNum(currentNode.value)} {unitLabel}
                {!isCurrentBalanced && (
                  <span className="ml-1.5 text-[10px] font-normal">
                    ({balanceDiff > 0 ? '+' : ''}{fmtNum(balanceDiff)} {unitLabel})
                  </span>
                )}
                {isCurrentBalanced && ' ✓'}
              </span>
            </div>
            <Progress
              value={Math.min(balancePct, 100)}
              className="h-1.5"
              style={{
                // @ts-expect-error CSS custom property
                '--progress-background': isCurrentBalanced
                  ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                  : 'linear-gradient(90deg, #EAB308, #CA8A04)',
              }}
            />
            {!isCurrentBalanced && (
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={handleForceBalance}
                >
                  <Zap className="h-3 w-3" />
                  Force Balance (Proporsional)
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Children table */}
        {currentNode.children && currentNode.children.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow style={{ background: 'rgba(6,182,212,0.08)' }}>
                    <TableHead className="w-8 text-center text-xs">#</TableHead>
                    <TableHead className="text-xs">
                      {currentNode.childDimension ? DIMENSION_LABELS[currentNode.childDimension] : 'Nama'}
                    </TableHead>
                    <TableHead className="text-xs text-right w-32">Nilai ({unitLabel})</TableHead>
                    <TableHead className="text-xs text-right w-20">% Proporsi</TableHead>
                    <TableHead className="text-xs text-center w-20">Status</TableHead>
                    <TableHead className="text-xs w-20 text-center">Sub-Dimensi</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentNode.children.map((child, i) => {
                    const proportion = currentNode.value > 0 ? (child.value / currentNode.value) * 100 : 0;
                    const childBalanced = !child.children || child.children.length === 0 || isBalanced(child);
                    const isEditing = editingId === child.id;
                    const hasChildren = !!child.childDimension;

                    return (
                      <TableRow
                        key={child.id}
                        className={`${child.isManual ? 'bg-cyan-500/5' : ''} cursor-pointer hover:bg-cyan-500/5`}
                        onClick={() => handleDrillDown(child)}
                      >
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {child.isManual && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1" />
                          )}
                          {i + 1}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          <div className="flex items-center gap-1.5">
                            {child.label}
                            {hasChildren ? (
                              <ChevronRight className="h-3 w-3 text-cyan-400" />
                            ) : (
                              <Plus className="h-2.5 w-2.5 text-muted-foreground/40" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => {
                                const val = parseFloat(editValue) || 0;
                                handleValueChange(child.id, val);
                                setEditingId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = parseFloat(editValue) || 0;
                                  handleValueChange(child.id, val);
                                  setEditingId(null);
                                }
                                if (e.key === 'Escape') {
                                  setEditingId(null);
                                }
                              }}
                              className="h-7 w-28 text-xs text-right ml-auto"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span
                              className="text-xs font-semibold cursor-pointer hover:text-cyan-400 transition-colors"
                              style={{ color: child.isManual ? '#06B6D4' : 'inherit' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(child.id);
                                setEditValue(child.value.toString());
                              }}
                              title="Klik untuk edit"
                            >
                              {fmtNum(child.value)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">
                          {proportion.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center">
                          {child.children && child.children.length > 0 ? (
                            childBalanced ? (
                              <span className="text-[10px] text-green-400 font-medium">✓ Balance</span>
                            ) : (
                              <span className="text-[10px] text-amber-400 font-medium">⚠ Imbang</span>
                            )
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {child.childDimension ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                              {DIMENSION_LABELS[child.childDimension]}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasChildren && (
                            <ChevronRight className="h-3 w-3 text-cyan-400" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="text-xs font-semibold">
                      Total
                    </TableCell>
                    <TableCell
                      className="text-xs text-right font-bold"
                      style={{ color: isCurrentBalanced ? '#22C55E' : '#EAB308' }}
                    >
                      {fmtNum(childSum)}
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      100%
                    </TableCell>
                    <TableCell className="text-center">
                      {isCurrentBalanced ? (
                        <span className="text-[10px] text-green-400">✓</span>
                      ) : (
                        <span className="text-[10px] text-amber-400">⚠ {fmtNum(balanceDiff)}</span>
                      )}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        ) : (
          /* No children - show empty state */
          <div
            className="rounded-lg p-6 text-center"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(6,182,212,0.2)',
            }}
          >
            <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              Pilih dimensi untuk mulai membagi nilai <strong>{fmtNum(currentNode.value)} {unitLabel}</strong>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Gunakan dropdown &quot;Tambah Dimensi&quot; di atas, atau klik baris untuk drill-down
            </p>
          </div>
        )}

        {/* Dimension order chips */}
        {effectiveTree.root.childDimension && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground">Urutan dimensi:</span>
            <DimensionChips node={effectiveTree.root} onRemoveDimension={(nodeId) => handleRemoveDimension(nodeId)} />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleForceBalanceAll}
            disabled={isTreeBalanced}
          >
            <Zap className="h-3 w-3" />
            Force Balance Semua
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => {
              saveDraft(formKey, tree);
              toast.success('Draft tersimpan sementara');
            }}
          >
            <Save className="h-3 w-3" />
            Save Sementara
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 text-red-400 hover:text-red-500"
            onClick={handleReset}
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
          <div className="ml-auto">
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
              onClick={handleApply}
              disabled={farmers.length === 0}
            >
              <Download className="h-3 w-3" />
              Apply ke Tabel Petani
            </Button>
          </div>
        </div>

        {/* Info */}
        <div
          className="flex items-start gap-2 p-2.5 rounded-lg text-[10px] text-muted-foreground"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Info className="h-3 w-3 shrink-0 mt-0.5 text-cyan-400" />
          <span>
            Klik nilai untuk edit manual. Klik baris untuk drill-down dan tambah sub-dimensi.
            &quot;Force Balance&quot; mendistribusikan selisih secara <strong>proporsional</strong>.
            Hasil &quot;Apply&quot; akan mengubah nilai di tabel distribusi petani.
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DimensionChips({ node, onRemoveDimension }: { node: BalanceNode; onRemoveDimension: (nodeId: string) => void }) {
  const chips: { nodeId: string; dim: DimensionKey }[] = [];

  function collect(n: BalanceNode) {
    if (n.childDimension) {
      chips.push({ nodeId: n.id, dim: n.childDimension });
      if (n.children) {
        for (const c of n.children) {
          collect(c);
        }
      }
    }
  }

  collect(node);

  return (
    <>
      {chips.map((chip, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />}
          <span
            className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer hover:bg-red-500/10 hover:text-red-400 transition-colors"
            style={{ background: 'rgba(6,182,212,0.1)', color: '#06B6D4' }}
            onClick={() => onRemoveDimension(chip.nodeId)}
            title="Klik untuk hapus dimensi ini"
          >
            {DIMENSION_LABELS[chip.dim]} ×
          </span>
        </span>
      ))}
    </>
  );
}
