import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, DragEndEvent, PointerSensor,
  useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable,
  horizontalListSortingStrategy, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/hooks/use-toast";
import { StatCard, formatCurrency } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  LayoutGrid, Clock, CheckCircle2, DollarSign, TrendingUp,
  Search, Trash2, Columns, GripVertical, Plus, Pencil, Check, X, Settings2,
} from "lucide-react";
import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeadRecord {
  id: number;
  contact: string | null;
  email: string | null;
  businessOwner: string | null;
  businessName: string | null;
  service: string | null;
  response: string | null;
  followUp: string | null;
  leadValue: number;
  leadAssignee: string | null;
  status: string;
  customData: Record<string, string | number | null>;
  createdAt: string;
}

interface LeadsStats {
  totalLeads: number; activeLeads: number; paidLeads: number;
  paidRevenue: number; totalRevenue: number;
}

interface LeadsPrefs {
  columnOrder: string[]; hiddenColumns: string[]; rowOrder: number[];
}

interface CustomColRecord {
  id: number;
  name: string;
  fieldKey: string;
  position: number;
}

interface ColumnDef {
  key: string;           // used in prefs / drag IDs
  label: string;
  isCustom?: boolean;
  fieldKey?: string;     // customData key for custom columns
  customId?: number;     // DB id for custom columns
}

// ─── Built-in columns ────────────────────────────────────────────────────────

const BUILTIN_COLUMNS: ColumnDef[] = [
  { key: "contact",       label: "Contact" },
  { key: "email",         label: "Email" },
  { key: "businessOwner", label: "Business Owner" },
  { key: "businessName",  label: "Business Name" },
  { key: "service",       label: "Service" },
  { key: "response",      label: "Response" },
  { key: "followUp",      label: "Follow Up" },
  { key: "leadValue",     label: "Lead Value" },
  { key: "leadAssignee",  label: "Lead" },
  { key: "status",        label: "Status" },
];

const STATUS_OPTIONS = ["pending", "contacted", "paid"];

// ─── API helpers ──────────────────────────────────────────────────────────────

const api = {
  fetchLeads: (s: string): Promise<LeadRecord[]> =>
    fetch(`/api/leads${s ? `?search=${encodeURIComponent(s)}` : ""}`, { credentials: "include" }).then(r => r.json()),
  fetchStats: (): Promise<LeadsStats> =>
    fetch("/api/leads/stats", { credentials: "include" }).then(r => r.json()),
  fetchPrefs: (): Promise<LeadsPrefs | null> =>
    fetch("/api/preferences/leads", { credentials: "include" }).then(r => r.json()),
  savePrefs: (p: LeadsPrefs) =>
    fetch("/api/preferences/leads", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }).then(r => r.json()),
  patchLead: ({ id, data }: { id: number; data: Partial<LeadRecord> }) =>
    fetch(`/api/leads/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
  deleteLead: (id: number) =>
    fetch(`/api/leads/${id}`, { method: "DELETE", credentials: "include" }),
  createLead: (data: Partial<LeadRecord>) =>
    fetch("/api/leads", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
  fetchCustomCols: (): Promise<CustomColRecord[]> =>
    fetch("/api/leads/columns", { credentials: "include" }).then(r => r.json()),
  createCustomCol: (name: string): Promise<CustomColRecord> =>
    fetch("/api/leads/columns", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).then(r => r.json()),
  renameCustomCol: (id: number, name: string) =>
    fetch(`/api/leads/columns/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).then(r => r.json()),
  deleteCustomCol: (id: number) =>
    fetch(`/api/leads/columns/${id}`, { method: "DELETE", credentials: "include" }),
};

// ─── Inline Cell Editor ───────────────────────────────────────────────────────

function CellEditor({ colKey, value, onSave, onCancel }: { colKey: string; value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const commit = () => onSave(val);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    e.stopPropagation();
  };
  if (colKey === "status") {
    return (
      <select autoFocus value={val}
        className="w-full text-xs font-bold uppercase border border-primary/40 rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary px-1.5 py-0.5 cursor-pointer"
        onChange={e => { setVal(e.target.value); onSave(e.target.value); }}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Escape") onCancel(); e.stopPropagation(); }}
      >
        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  }
  return (
    <input ref={ref} type={colKey === "leadValue" ? "number" : "text"} value={val}
      className="w-full min-w-[80px] text-sm border border-primary/40 rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary px-1.5 py-0.5"
      onChange={e => setVal(e.target.value)} onBlur={commit} onKeyDown={onKey}
    />
  );
}

// ─── Sortable Column Header ───────────────────────────────────────────────────

function SortableColHeader({ col }: { col: ColumnDef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key });
  return (
    <TableHead ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, cursor: isDragging ? "grabbing" : "grab", userSelect: "none", position: "relative", whiteSpace: "nowrap" }}
      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground h-10 px-1 select-none"
      {...attributes} {...listeners}
    >
      <span className="flex items-center gap-1">
        <GripVertical className="w-3 h-3 opacity-30 rotate-90 shrink-0" />
        {col.label}
      </span>
    </TableHead>
  );
}

// ─── Sortable Lead Row ────────────────────────────────────────────────────────

interface RowProps {
  lead: LeadRecord; index: number; visibleCols: ColumnDef[];
  editingCell: { rowId: number; colKey: string } | null;
  onCellDoubleClick: (rowId: number, colKey: string, val: string) => void;
  onCellSave: (rowId: number, col: ColumnDef, val: string) => void;
  onCellCancel: () => void;
  onDelete: (id: number) => void; isDeleting: boolean;
}

function SortableLeadRow({ lead, index, visibleCols, editingCell, onCellDoubleClick, onCellSave, onCellCancel, onDelete, isDeleting }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
  const rowClass = lead.status === "paid" ? "bg-green-50/60 dark:bg-green-900/10" : index % 2 === 1 ? "bg-muted/10" : "";

  return (
    <TableRow ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: "relative" }}
      className={rowClass}
    >
      <TableCell className="w-6 px-0.5 py-2 text-center">
        <button className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted/60 text-muted-foreground transition-colors"
          {...attributes} {...listeners} tabIndex={-1}>
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </TableCell>

      {visibleCols.map(col => {
        const isEditing = editingCell?.rowId === lead.id && editingCell?.colKey === col.key;
        const rawVal = col.isCustom
          ? (lead.customData?.[col.fieldKey!] ?? "")
          : (lead as any)[col.key];
        const displayStr = rawVal == null ? "" : String(rawVal);

        return (
          <TableCell key={col.key}
            className="px-1 py-1.5 text-sm border-r border-border/30 last:border-r-0 max-w-[160px]"
            onDoubleClick={() => !isEditing && onCellDoubleClick(lead.id, col.key, displayStr)}
            title="Double-click to edit"
          >
            {isEditing ? (
              <CellEditor colKey={col.key} value={displayStr}
                onSave={v => onCellSave(lead.id, col, v)} onCancel={onCellCancel} />
            ) : col.key === "status" ? (
              <LeadStatusBadge status={lead.status} />
            ) : col.key === "leadValue" ? (
              <span className="font-medium">{formatCurrency(lead.leadValue)}</span>
            ) : (
              <span className="truncate block">{displayStr}</span>
            )}
          </TableCell>
        );
      })}

      <TableCell className="px-1 py-1.5 text-right w-8">
        <button className="p-1 rounded text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors" disabled={isDeleting} onClick={() => onDelete(lead.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </TableCell>
    </TableRow>
  );
}

// ─── New Row (inline) ─────────────────────────────────────────────────────────

function NewLeadRow({ visibleCols, onSave, onCancel }: { visibleCols: ColumnDef[]; onSave: (d: Partial<LeadRecord>) => void; onCancel: () => void }) {
  const [data, setData] = useState<Record<string, string>>({ status: "pending", leadValue: "0" });
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);

  const commit = () => {
    const payload: any = { ...data };
    // separate customData from regular fields
    const builtinKeys = new Set(BUILTIN_COLUMNS.map(c => c.key));
    const customData: Record<string, string> = {};
    Object.keys(payload).forEach(k => { if (!builtinKeys.has(k)) { customData[k] = payload[k]; delete payload[k]; } });
    if (Object.keys(customData).length) payload.customData = customData;
    if (data.leadValue !== undefined) payload.leadValue = parseFloat(data.leadValue) || 0;
    onSave(payload);
  };

  const onKey = (e: React.KeyboardEvent, idx: number) => {
    e.stopPropagation();
    if (e.key === "Escape") { onCancel(); return; }
    if (e.key === "Enter" && idx === visibleCols.length - 1) commit();
    if (e.key === "Tab" && idx === visibleCols.length - 1 && !e.shiftKey) { e.preventDefault(); commit(); }
  };

  return (
    <TableRow className="bg-primary/5 border border-primary/20">
      <TableCell className="w-6 px-0.5 py-1.5" />
      {visibleCols.map((col, idx) => (
        <TableCell key={col.key} className="px-1 py-1 border-r border-border/30 last:border-r-0">
          {col.key === "status" ? (
            <select value={data[col.key] ?? "pending"}
              className="w-full text-xs font-bold uppercase border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary px-1.5 py-0.5 cursor-pointer"
              onChange={e => setData(d => ({ ...d, [col.key]: e.target.value }))}
              onKeyDown={e => onKey(e, idx)}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input ref={idx === 0 ? firstRef : undefined}
              type={col.key === "leadValue" ? "number" : "text"}
              placeholder={col.label}
              value={data[col.isCustom ? col.fieldKey! : col.key] ?? ""}
              className="w-full min-w-[60px] text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary px-1.5 py-0.5 placeholder:text-muted-foreground/50"
              onChange={e => setData(d => ({ ...d, [col.isCustom ? col.fieldKey! : col.key]: e.target.value }))}
              onKeyDown={e => onKey(e, idx)}
            />
          )}
        </TableCell>
      ))}
      <TableCell className="px-1 py-1 text-right w-8">
        <button className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors" onClick={onCancel} title="Cancel">
          <X className="w-3.5 h-3.5" />
        </button>
      </TableCell>
    </TableRow>
  );
}

// ─── Manage Columns Dialog ───────────────────────────────────────────────────

function ManageColumnsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [newName, setNewName] = useState("");
  const [editId,  setEditId]  = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: cols = [] } = useQuery<CustomColRecord[]>({
    queryKey: ["lead-custom-cols"],
    queryFn: api.fetchCustomCols,
  });

  const createMut = useMutation({
    mutationFn: (name: string) => api.createCustomCol(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-custom-cols"] });
      setNewName("");
      toast({ title: "Column added" });
    },
    onError: () => toast({ title: "Failed to add column", variant: "destructive" }),
  });

  const renameMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.renameCustomCol(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-custom-cols"] });
      setEditId(null);
      toast({ title: "Column renamed" });
    },
    onError: () => toast({ title: "Failed to rename column", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteCustomCol(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-custom-cols"] });
      toast({ title: "Column deleted" });
    },
    onError: () => toast({ title: "Failed to delete column", variant: "destructive" }),
  });

  const startEdit = (col: CustomColRecord) => { setEditId(col.id); setEditVal(col.name); };
  const commitRename = (id: number) => {
    if (editVal.trim()) renameMut.mutate({ id, name: editVal.trim() });
    else setEditId(null);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Manage Columns
          </DialogTitle>
        </DialogHeader>

        {/* Built-in columns (read-only) */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Built-in</p>
          <div className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
            {BUILTIN_COLUMNS.map(col => (
              <div key={col.key} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-muted/30">
                <span className="text-sm text-muted-foreground">{col.label}</span>
                <span className="text-xs text-muted-foreground/50">built-in</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border/40 pt-3 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Custom Columns</p>
          {cols.length === 0 && <p className="text-sm text-muted-foreground py-2 text-center">No custom columns yet</p>}
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {cols.map(col => (
              <div key={col.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/40 bg-background hover:bg-muted/20 group">
                {editId === col.id ? (
                  <>
                    <input autoFocus value={editVal}
                      className="flex-1 text-sm border border-primary/40 rounded px-2 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitRename(col.id); if (e.key === "Escape") setEditId(null); }}
                    />
                    <button onClick={() => commitRename(col.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Save">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditId(null)} className="p-1 text-muted-foreground hover:bg-muted rounded" title="Cancel">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{col.name}</span>
                    <span className="text-xs text-muted-foreground/50 font-mono">{col.fieldKey}</span>
                    <button onClick={() => startEdit(col)} className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity" title="Rename">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { if (confirm(`Delete column "${col.name}"? This removes its data from all leads.`)) deleteMut.mutate(col.id); }}
                      className="p-1 text-destructive/50 hover:text-destructive hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new column */}
          <div className="flex gap-2 pt-2">
            <Input placeholder="New column name…" value={newName} className="h-8 text-sm"
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createMut.mutate(newName.trim()); }}
            />
            <Button size="sm" className="h-8 shrink-0" disabled={!newName.trim() || createMut.isPending}
              onClick={() => newName.trim() && createMut.mutate(newName.trim())}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Leads() {
  const [search,     setSearch]     = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [editingCell,  setEditingCell]  = useState<{ rowId: number; colKey: string } | null>(null);
  const [showNewRow,   setShowNewRow]   = useState(false);
  const [manageOpen,   setManageOpen]   = useState(false);

  const [columnOrder,   setColumnOrder]   = useState<string[]>(BUILTIN_COLUMNS.map(c => c.key));
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [rowOrder,      setRowOrder]      = useState<number[]>([]);
  const prefsReady = useRef(false);

  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: rawLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads", search],
    queryFn: () => api.fetchLeads(search),
  });

  const { data: stats } = useQuery({ queryKey: ["leads-stats"], queryFn: api.fetchStats });
  const { data: savedPrefs } = useQuery({ queryKey: ["leads-prefs"], queryFn: api.fetchPrefs });

  const { data: customColRecords = [] } = useQuery<CustomColRecord[]>({
    queryKey: ["lead-custom-cols"],
    queryFn: api.fetchCustomCols,
  });

  // ── Build full column list (builtin + custom) ─────────────────────────────

  const allColumns: ColumnDef[] = React.useMemo(() => {
    const custom: ColumnDef[] = customColRecords.map(c => ({
      key: `custom_${c.fieldKey}`,
      label: c.name,
      isCustom: true,
      fieldKey: c.fieldKey,
      customId: c.id,
    }));
    return [...BUILTIN_COLUMNS, ...custom];
  }, [customColRecords]);

  // ── Load saved prefs once ────────────────────────────────────────────────

  useEffect(() => {
    if (savedPrefs === undefined || prefsReady.current) return;
    prefsReady.current = true;
    if (!savedPrefs) return;
    if (savedPrefs.columnOrder?.length) setColumnOrder(savedPrefs.columnOrder);
    if (savedPrefs.hiddenColumns)       setHiddenColumns(new Set(savedPrefs.hiddenColumns));
    if (savedPrefs.rowOrder)            setRowOrder(savedPrefs.rowOrder);
  }, [savedPrefs]);

  // When new custom columns arrive, add them to columnOrder if missing
  useEffect(() => {
    const missing = allColumns.filter(c => !columnOrder.includes(c.key));
    if (missing.length) setColumnOrder(prev => [...prev, ...missing.map(c => c.key)]);
  }, [allColumns]);

  // ── Prefs save ───────────────────────────────────────────────────────────

  const savePrefs = useCallback((patch: Partial<LeadsPrefs>) => {
    api.savePrefs({ columnOrder, hiddenColumns: [...hiddenColumns], rowOrder, ...patch }).catch(() => {});
  }, [columnOrder, hiddenColumns, rowOrder]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const patchMut = useMutation({
    mutationFn: api.patchLead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-stats"] });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteLead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-stats"] });
    },
  });

  const createMut = useMutation({
    mutationFn: api.createLead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-stats"] });
      setShowNewRow(false);
      toast({ title: "Lead added" });
    },
    onError: () => toast({ title: "Failed to add lead", variant: "destructive" }),
  });

  // ── Computed columns ────────────────────────────────────────────────────────

  const orderedAllCols = React.useMemo(() => {
    const ordered = columnOrder
      .map(key => allColumns.find(c => c.key === key))
      .filter(Boolean) as ColumnDef[];
    allColumns.forEach(c => { if (!ordered.find(x => x.key === c.key)) ordered.push(c); });
    return ordered;
  }, [columnOrder, allColumns]);

  const visibleCols = orderedAllCols.filter(c => !hiddenColumns.has(c.key));

  // ── Leads in row order ──────────────────────────────────────────────────────

  const leads: LeadRecord[] = React.useMemo(() => {
    if (!Array.isArray(rawLeads)) return [];
    if (rowOrder.length === 0) return rawLeads;
    const byId = new Map(rawLeads.map(l => [l.id, l]));
    const ordered: LeadRecord[] = [];
    rowOrder.forEach(id => { const l = byId.get(id); if (l) { ordered.push(l); byId.delete(id); } });
    byId.forEach(l => ordered.push(l));
    return ordered;
  }, [rawLeads, rowOrder]);

  // ── Column toggle ────────────────────────────────────────────────────────────

  const toggleColumn = (key: string) => {
    const next = new Set(hiddenColumns);
    if (next.has(key)) { next.delete(key); }
    else { if (visibleCols.length <= 1) return; next.add(key); }
    setHiddenColumns(next);
    savePrefs({ hiddenColumns: [...next] });
  };

  // ── DnD ─────────────────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleColDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(columnOrder, columnOrder.indexOf(String(active.id)), columnOrder.indexOf(String(over.id)));
    setColumnOrder(next);
    savePrefs({ columnOrder: next });
  };

  const handleRowDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = leads.map(l => l.id);
    const next = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    setRowOrder(next);
    savePrefs({ rowOrder: next });
  };

  // ── Cell edit ────────────────────────────────────────────────────────────────

  const handleCellDoubleClick = (rowId: number, colKey: string, _val: string) => setEditingCell({ rowId, colKey });

  const handleCellSave = (rowId: number, col: ColumnDef, val: string) => {
    setEditingCell(null);
    const data: Partial<LeadRecord> = col.isCustom
      ? { customData: { [col.fieldKey!]: val } } as any
      : { [col.key]: col.key === "leadValue" ? parseFloat(val) || 0 : val } as any;
    patchMut.mutate({ id: rowId, data });
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Global Leads Database</h1>
        <div className="flex items-center gap-2">

          {/* Columns popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Columns className="w-4 h-4" /> Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Show / Hide</p>
              <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
                {orderedAllCols.map(col => (
                  <div key={col.key} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                    <span className="text-sm font-medium truncate">{col.label}</span>
                    <Switch checked={!hiddenColumns.has(col.key)} onCheckedChange={() => toggleColumn(col.key)} />
                  </div>
                ))}
              </div>
              <div className="border-t border-border/40 mt-3 pt-3">
                <button className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium w-full"
                  onClick={() => setManageOpen(true)}>
                  <Settings2 className="w-3.5 h-3.5" /> Manage custom columns
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[["all","All time"],["7d","Last 7 days"],["3m","Last 3 months"],["6m","Last 6 months"],["this_month","This month"],["last_month","Last month"],["this_year","This year"],["last_year","Last year"]].map(([v,l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search leads…" className="pl-8 h-9 w-48" onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={<LayoutGrid   className="w-5 h-5" />} label="Total Leads"    value={stats?.totalLeads ?? 0} />
        <StatCard icon={<Clock        className="w-5 h-5" />} label="Active Leads"   value={stats?.activeLeads ?? 0}           iconBg="bg-amber-100 text-amber-600" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Paid Leads"    value={stats?.paidLeads ?? 0}             iconBg="bg-green-100 text-green-600" />
        <StatCard icon={<DollarSign   className="w-5 h-5" />} label="Paid Revenue"  value={formatCurrency(stats?.paidRevenue ?? 0)}  iconBg="bg-green-100 text-green-700" />
        <StatCard icon={<TrendingUp   className="w-5 h-5" />} label="Total Revenue" value={formatCurrency(stats?.totalRevenue ?? 0)} iconBg="bg-blue-100 text-blue-600" />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleColDragEnd}>
                <SortableContext items={orderedAllCols.map(c => c.key)} strategy={horizontalListSortingStrategy}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-6 px-0.5" />
                    {visibleCols.map(col => <SortableColHeader key={col.key} col={col} />)}
                    <TableHead className="w-8 px-1" />
                  </TableRow>
                </SortableContext>
              </DndContext>
            </TableHeader>

            <TableBody>
              {leadsLoading ? (
                <TableRow><TableCell colSpan={visibleCols.length + 2} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRowDragEnd}>
                  <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                    {leads.map((lead, i) => (
                      <SortableLeadRow key={lead.id} lead={lead} index={i} visibleCols={visibleCols}
                        editingCell={editingCell}
                        onCellDoubleClick={handleCellDoubleClick}
                        onCellSave={handleCellSave}
                        onCellCancel={() => setEditingCell(null)}
                        onDelete={id => deleteMut.mutate(id)}
                        isDeleting={deleteMut.isPending}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}

              {showNewRow && (
                <NewLeadRow visibleCols={visibleCols}
                  onSave={data => createMut.mutate(data)}
                  onCancel={() => setShowNewRow(false)}
                />
              )}

              {leads.length > 0 && (
                <TableRow className="bg-muted/20 font-medium border-t-2 border-border">
                  <TableCell className="w-6 px-0.5" />
                  {visibleCols.map(col => (
                    <TableCell key={col.key} className="px-1 py-2.5 text-sm border-r border-border/30 last:border-r-0">
                      {col.key === "leadValue" ? formatCurrency(leads.reduce((s, r) => s + (r.leadValue || 0), 0)) : ""}
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="border-t border-border/60 px-3 py-2">
          <button
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            onClick={() => { setShowNewRow(true); setEditingCell(null); }}
            disabled={showNewRow}
          >
            <span className="flex items-center justify-center w-5 h-5 rounded border border-dashed border-muted-foreground/40 group-hover:border-foreground/60 transition-colors">
              <Plus className="w-3 h-3" />
            </span>
            Add row
          </button>
        </div>
      </div>

      <ManageColumnsDialog open={manageOpen} onClose={() => { setManageOpen(false); qc.invalidateQueries({ queryKey: ["lead-custom-cols"] }); }} />
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function LeadStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   "border border-gray-300 text-gray-600 bg-transparent",
    contacted: "bg-blue-500 text-white border border-blue-500",
    paid:      "bg-green-500 text-white border border-green-500",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}
