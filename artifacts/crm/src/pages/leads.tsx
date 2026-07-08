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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  LayoutGrid, Clock, CheckCircle2, DollarSign, TrendingUp,
  Search, Trash2, Columns, GripVertical, Plus,
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
  createdAt: string;
}

interface LeadsStats {
  totalLeads: number; activeLeads: number; paidLeads: number;
  paidRevenue: number; totalRevenue: number;
}

interface LeadsPrefs {
  columnOrder: string[]; hiddenColumns: string[]; rowOrder: number[];
}

interface ColumnDef { key: string; label: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_COLUMNS: ColumnDef[] = [
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
  fetchLeads: (search: string): Promise<LeadRecord[]> =>
    fetch(`/api/leads${search ? `?search=${encodeURIComponent(search)}` : ""}`, { credentials: "include" }).then(r => r.json()),
  fetchStats: (): Promise<LeadsStats> =>
    fetch("/api/leads/stats", { credentials: "include" }).then(r => r.json()),
  fetchPrefs: (): Promise<LeadsPrefs | null> =>
    fetch("/api/preferences/leads", { credentials: "include" }).then(r => r.json()),
  savePrefs: (prefs: LeadsPrefs) =>
    fetch("/api/preferences/leads", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    }).then(r => r.json()),
  patchLead: ({ id, data }: { id: number; data: Partial<LeadRecord> }) =>
    fetch(`/api/leads/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  deleteLead: (id: number) =>
    fetch(`/api/leads/${id}`, { method: "DELETE", credentials: "include" }),
  createLead: (data: Partial<LeadRecord>) =>
    fetch("/api/leads", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
};

// ─── Inline Cell Editor ───────────────────────────────────────────────────────

interface CellEditorProps {
  colKey: string;
  value: string;
  onSave: (val: string) => void;
  onCancel: () => void;
}

function CellEditor({ colKey, value, onSave, onCancel }: CellEditorProps) {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const commit = () => onSave(val);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    e.stopPropagation(); // don't bubble to DnD
  };

  if (colKey === "status") {
    return (
      <select
        autoFocus
        value={val}
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
    <input
      ref={ref}
      type={colKey === "leadValue" ? "number" : "text"}
      value={val}
      className="w-full min-w-[80px] text-sm border border-primary/40 rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary px-1.5 py-0.5"
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
    />
  );
}

// ─── Sortable Column Header ───────────────────────────────────────────────────

function SortableColHeader({ col }: { col: ColumnDef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.key });
  return (
    <TableHead
      ref={setNodeRef}
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
  lead: LeadRecord;
  index: number;
  visibleCols: ColumnDef[];
  editingCell: { rowId: number; colKey: string } | null;
  onCellDoubleClick: (rowId: number, colKey: string, val: string) => void;
  onCellSave: (rowId: number, colKey: string, val: string) => void;
  onCellCancel: () => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}

function SortableLeadRow({
  lead, index, visibleCols, editingCell,
  onCellDoubleClick, onCellSave, onCellCancel, onDelete, isDeleting,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lead.id });

  const rowClass = lead.status === "paid"
    ? "bg-green-50/60 dark:bg-green-900/10"
    : index % 2 === 1 ? "bg-muted/10" : "";

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: "relative" }}
      className={rowClass}
    >
      {/* Row drag handle */}
      <TableCell className="w-6 px-0.5 py-2 text-center">
        <button
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
          {...attributes} {...listeners} tabIndex={-1}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </TableCell>

      {visibleCols.map(col => {
        const isEditing = editingCell?.rowId === lead.id && editingCell?.colKey === col.key;
        const rawVal = (lead as any)[col.key];
        const displayStr = rawVal == null ? "" : String(rawVal);

        return (
          <TableCell
            key={col.key}
            className="px-1 py-1.5 text-sm border-r border-border/30 last:border-r-0 max-w-[160px]"
            onDoubleClick={() => !isEditing && onCellDoubleClick(lead.id, col.key, displayStr)}
            title={isEditing ? undefined : "Double-click to edit"}
          >
            {isEditing ? (
              <CellEditor
                colKey={col.key}
                value={displayStr}
                onSave={val => onCellSave(lead.id, col.key, val)}
                onCancel={onCellCancel}
              />
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
        <button
          className="p-1 rounded text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
          disabled={isDeleting}
          onClick={() => onDelete(lead.id)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </TableCell>
    </TableRow>
  );
}

// ─── New Row (inline) ─────────────────────────────────────────────────────────

interface NewRowProps {
  visibleCols: ColumnDef[];
  onSave: (data: Partial<LeadRecord>) => void;
  onCancel: () => void;
}

function NewLeadRow({ visibleCols, onSave, onCancel }: NewRowProps) {
  const [data, setData] = useState<Record<string, string>>({ status: "pending", leadValue: "0" });
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstInputRef.current?.focus(); }, []);

  const commit = () => {
    const payload: Partial<LeadRecord> = { ...data } as any;
    if (data.leadValue !== undefined) payload.leadValue = parseFloat(data.leadValue) || 0;
    onSave(payload);
  };

  const handleKeyDown = (e: React.KeyboardEvent, colIdx: number) => {
    e.stopPropagation();
    if (e.key === "Escape") { onCancel(); return; }
    if (e.key === "Enter") {
      if (colIdx === visibleCols.length - 1) commit();
    }
    if (e.key === "Tab" && colIdx === visibleCols.length - 1 && !e.shiftKey) {
      e.preventDefault();
      commit();
    }
  };

  return (
    <TableRow className="bg-primary/5 border border-primary/20">
      <TableCell className="w-6 px-0.5 py-1.5" />
      {visibleCols.map((col, idx) => (
        <TableCell key={col.key} className="px-1 py-1 border-r border-border/30 last:border-r-0">
          {col.key === "status" ? (
            <select
              value={data[col.key] ?? "pending"}
              className="w-full text-xs font-bold uppercase border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary px-1.5 py-0.5 cursor-pointer"
              onChange={e => setData(d => ({ ...d, [col.key]: e.target.value }))}
              onKeyDown={e => handleKeyDown(e, idx)}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input
              ref={idx === 0 ? firstInputRef : undefined}
              type={col.key === "leadValue" ? "number" : "text"}
              placeholder={col.label}
              value={data[col.key] ?? ""}
              className="w-full min-w-[60px] text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary px-1.5 py-0.5 placeholder:text-muted-foreground/50"
              onChange={e => setData(d => ({ ...d, [col.key]: e.target.value }))}
              onKeyDown={e => handleKeyDown(e, idx)}
            />
          )}
        </TableCell>
      ))}
      <TableCell className="px-1 py-1 text-right w-8">
        <button
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          onClick={onCancel}
          title="Cancel"
        >
          ✕
        </button>
      </TableCell>
    </TableRow>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Leads() {
  const [search,     setSearch]     = useState("");
  const [timeFilter, setTimeFilter] = useState("all");

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ rowId: number; colKey: string } | null>(null);
  const [showNewRow,  setShowNewRow]  = useState(false);

  // Preferences
  const [columnOrder,   setColumnOrder]   = useState<string[]>(ALL_COLUMNS.map(c => c.key));
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [rowOrder,      setRowOrder]      = useState<number[]>([]);
  const prefsReady = useRef(false);

  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: rawLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads", search],
    queryFn: () => api.fetchLeads(search),
  });

  const { data: stats } = useQuery({
    queryKey: ["leads-stats"],
    queryFn: api.fetchStats,
  });

  const { data: savedPrefs } = useQuery({
    queryKey: ["leads-prefs"],
    queryFn: api.fetchPrefs,
  });

  useEffect(() => {
    if (savedPrefs === undefined || prefsReady.current) return;
    prefsReady.current = true;
    if (!savedPrefs) return;
    if (savedPrefs.columnOrder?.length) setColumnOrder(savedPrefs.columnOrder);
    if (savedPrefs.hiddenColumns)       setHiddenColumns(new Set(savedPrefs.hiddenColumns));
    if (savedPrefs.rowOrder)            setRowOrder(savedPrefs.rowOrder);
  }, [savedPrefs]);

  // ── Prefs save ───────────────────────────────────────────────────────────────

  const savePrefs = useCallback(
    (patch: Partial<LeadsPrefs>) => {
      api.savePrefs({ columnOrder, hiddenColumns: [...hiddenColumns], rowOrder, ...patch }).catch(() => {});
    },
    [columnOrder, hiddenColumns, rowOrder],
  );

  // ── Mutations ────────────────────────────────────────────────────────────────

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

  // ── Computed columns ─────────────────────────────────────────────────────────

  const orderedAllCols = React.useMemo(() => {
    const ordered = columnOrder
      .map(key => ALL_COLUMNS.find(c => c.key === key))
      .filter(Boolean) as ColumnDef[];
    ALL_COLUMNS.forEach(c => { if (!ordered.find(x => x.key === c.key)) ordered.push(c); });
    return ordered;
  }, [columnOrder]);

  const visibleCols = orderedAllCols.filter(c => !hiddenColumns.has(c.key));

  // ── Leads in row order ───────────────────────────────────────────────────────

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

  // ── Cell edit handlers ───────────────────────────────────────────────────────

  const handleCellDoubleClick = (rowId: number, colKey: string, _val: string) => {
    setEditingCell({ rowId, colKey });
  };

  const handleCellSave = (rowId: number, colKey: string, val: string) => {
    setEditingCell(null);
    const data: Partial<LeadRecord> = { [colKey]: colKey === "leadValue" ? parseFloat(val) || 0 : val } as any;
    patchMut.mutate({ id: rowId, data });
  };

  const handleCellCancel = () => setEditingCell(null);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Global Leads Database</h1>
        <div className="flex items-center gap-2">

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 border-border">
                <Columns className="w-4 h-4" /> Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Show Columns</p>
              <div className="space-y-1">
                {orderedAllCols.map(col => (
                  <div key={col.key} className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50">
                    <span className="text-sm font-medium">{col.label}</span>
                    <Switch checked={!hiddenColumns.has(col.key)} onCheckedChange={() => toggleColumn(col.key)} />
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all","7d","3m","6m","this_month","last_month","this_year","last_year"].map(v => (
                <SelectItem key={v} value={v}>{v === "all" ? "All time" : v}</SelectItem>
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
        <StatCard icon={<LayoutGrid  className="w-5 h-5" />} label="Total Leads"    value={stats?.totalLeads ?? 0} />
        <StatCard icon={<Clock       className="w-5 h-5" />} label="Active Leads"   value={stats?.activeLeads ?? 0}           iconBg="bg-amber-100 text-amber-600" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Paid Leads"   value={stats?.paidLeads ?? 0}             iconBg="bg-green-100 text-green-600" />
        <StatCard icon={<DollarSign  className="w-5 h-5" />} label="Paid Revenue"  value={formatCurrency(stats?.paidRevenue ?? 0)} iconBg="bg-green-100 text-green-700" />
        <StatCard icon={<TrendingUp  className="w-5 h-5" />} label="Total Revenue" value={formatCurrency(stats?.totalRevenue ?? 0)} iconBg="bg-blue-100 text-blue-600" />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>

            {/* Column drag context */}
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

            {/* Row drag context */}
            <TableBody>
              {leadsLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleCols.length + 2} className="h-24 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRowDragEnd}>
                  <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                    {leads.map((lead, i) => (
                      <SortableLeadRow
                        key={lead.id}
                        lead={lead} index={i}
                        visibleCols={visibleCols}
                        editingCell={editingCell}
                        onCellDoubleClick={handleCellDoubleClick}
                        onCellSave={handleCellSave}
                        onCellCancel={handleCellCancel}
                        onDelete={id => deleteMut.mutate(id)}
                        isDeleting={deleteMut.isPending}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}

              {/* Inline new row */}
              {showNewRow && (
                <NewLeadRow
                  visibleCols={visibleCols}
                  onSave={data => createMut.mutate(data)}
                  onCancel={() => setShowNewRow(false)}
                />
              )}

              {/* Footer totals */}
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

        {/* ── + Add row button ── */}
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

    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function LeadStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   "border border-gray-300 text-gray-600 bg-transparent dark:border-gray-600 dark:text-gray-400",
    contacted: "bg-blue-500 text-white border border-blue-500",
    paid:      "bg-green-500 text-white border border-green-500",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}
