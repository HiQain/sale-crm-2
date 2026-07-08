import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/hooks/use-toast";
import { StatCard, formatCurrency } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  LayoutGrid, Clock, CheckCircle2, DollarSign, TrendingUp,
  Search, Plus, Trash2, Loader2, Columns, GripVertical,
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
  totalLeads: number;
  activeLeads: number;
  paidLeads: number;
  paidRevenue: number;
  totalRevenue: number;
}

interface LeadsPrefs {
  columnOrder: string[];
  hiddenColumns: string[];
  rowOrder: number[];
}

interface ColumnDef {
  key: string;
  label: string;
}

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

const DEFAULT_PREFS: LeadsPrefs = {
  columnOrder:   ALL_COLUMNS.map(c => c.key),
  hiddenColumns: [],
  rowOrder:      [],
};

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

  deleteLead: (id: number) =>
    fetch(`/api/leads/${id}`, { method: "DELETE", credentials: "include" }),

  createLead: (data: Partial<LeadRecord>) =>
    fetch("/api/leads", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
};

// ─── Sortable Column Header ───────────────────────────────────────────────────

function SortableColHeader({ col }: { col: ColumnDef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.key });

  return (
    <TableHead
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        zIndex: isDragging ? 10 : undefined,
        position: "relative",
        whiteSpace: "nowrap",
      }}
      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground h-10 px-4 select-none"
      {...attributes}
      {...listeners}
    >
      <span className="flex items-center gap-1">
        <GripVertical className="w-3 h-3 opacity-30 rotate-90 shrink-0" />
        {col.label}
      </span>
    </TableHead>
  );
}

// ─── Sortable Row ─────────────────────────────────────────────────────────────

interface SortableRowProps {
  lead: LeadRecord;
  index: number;
  visibleCols: ColumnDef[];
  onDelete: (id: number) => void;
  isDeleting: boolean;
}

function SortableLeadRow({ lead, index, visibleCols, onDelete, isDeleting }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lead.id });

  const rowClass = lead.status === "paid"
    ? "bg-green-50/60 dark:bg-green-900/10"
    : index % 2 === 1 ? "bg-muted/10" : "";

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
        position: "relative",
      }}
      className={rowClass}
    >
      {/* Row drag handle */}
      <TableCell className="w-8 px-1 py-2 text-center">
        <button
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
          {...attributes}
          {...listeners}
          tabIndex={-1}
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </TableCell>

      {visibleCols.map(col => (
        <TableCell key={col.key} className="px-4 py-2.5 text-sm border-r border-border/30 last:border-r-0 max-w-[160px]">
          {col.key === "status" ? (
            <LeadStatusBadge status={lead.status} />
          ) : col.key === "leadValue" ? (
            <span className="font-medium">{formatCurrency(lead.leadValue)}</span>
          ) : (
            <span className="truncate block">{(lead as any)[col.key] ?? ""}</span>
          )}
        </TableCell>
      ))}

      <TableCell className="px-4 py-2.5 text-right">
        <Button
          variant="ghost" size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={isDeleting}
          onClick={() => onDelete(lead.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Leads() {
  const [search, setSearch]         = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm]             = useState<Partial<LeadRecord>>({ status: "pending", leadValue: 0 });

  // Preferences-driven state (initialised once prefs load)
  const [columnOrder,   setColumnOrder]   = useState<string[]>(DEFAULT_PREFS.columnOrder);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [rowOrder,      setRowOrder]      = useState<number[]>([]);
  const prefsReady = useRef(false);

  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Data queries ────────────────────────────────────────────────────────────

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

  // Apply saved prefs once loaded (only on first load)
  useEffect(() => {
    if (savedPrefs === undefined || prefsReady.current) return;
    prefsReady.current = true;
    if (!savedPrefs) return; // no prefs yet – keep defaults

    if (savedPrefs.columnOrder?.length)
      setColumnOrder(savedPrefs.columnOrder);
    if (savedPrefs.hiddenColumns)
      setHiddenColumns(new Set(savedPrefs.hiddenColumns));
    if (savedPrefs.rowOrder)
      setRowOrder(savedPrefs.rowOrder);
  }, [savedPrefs]);

  // ── Preferences save ────────────────────────────────────────────────────────

  const savePrefs = useCallback(
    (patch: Partial<LeadsPrefs>) => {
      const prefs: LeadsPrefs = {
        columnOrder,
        hiddenColumns: [...hiddenColumns],
        rowOrder,
        ...patch,
      };
      api.savePrefs(prefs).catch(() => {/* silent */});
    },
    [columnOrder, hiddenColumns, rowOrder],
  );

  // ── Mutations ───────────────────────────────────────────────────────────────

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteLead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-stats"] });
      toast({ title: "Lead deleted" });
    },
  });

  const createMut = useMutation({
    mutationFn: api.createLead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-stats"] });
      setIsCreateOpen(false);
      setForm({ status: "pending", leadValue: 0 });
      toast({ title: "Lead added" });
    },
  });

  // ── Computed display data ────────────────────────────────────────────────────

  // Columns in saved order, skipping unknowns
  const orderedAllCols = columnOrder
    .map(key => ALL_COLUMNS.find(c => c.key === key))
    .filter(Boolean) as ColumnDef[];
  // Any newly added columns not in saved order go to the end
  ALL_COLUMNS.forEach(c => { if (!orderedAllCols.find(x => x.key === c.key)) orderedAllCols.push(c); });

  const visibleCols = orderedAllCols.filter(c => !hiddenColumns.has(c.key));

  // Leads in saved row order
  const leads: LeadRecord[] = React.useMemo(() => {
    if (!Array.isArray(rawLeads)) return [];
    if (rowOrder.length === 0) return rawLeads;
    const byId = new Map(rawLeads.map(l => [l.id, l]));
    const ordered: LeadRecord[] = [];
    rowOrder.forEach(id => { const l = byId.get(id); if (l) { ordered.push(l); byId.delete(id); } });
    byId.forEach(l => ordered.push(l)); // new leads appended
    return ordered;
  }, [rawLeads, rowOrder]);

  // ── Column toggle (saves prefs) ──────────────────────────────────────────────

  const toggleColumn = (key: string) => {
    const next = new Set(hiddenColumns);
    if (next.has(key)) {
      next.delete(key);
    } else {
      if (visibleCols.length <= 1) return; // keep ≥1
      next.add(key);
    }
    setHiddenColumns(next);
    savePrefs({ hiddenColumns: [...next] });
  };

  // ── DnD sensors ─────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // ── Column drag ──────────────────────────────────────────────────────────────

  const handleColDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = columnOrder.indexOf(String(active.id));
    const newIdx = columnOrder.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(columnOrder, oldIdx, newIdx);
    setColumnOrder(next);
    savePrefs({ columnOrder: next });
  };

  // ── Row drag ─────────────────────────────────────────────────────────────────

  const handleRowDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = leads.map(l => l.id);
    const oldIdx = ids.indexOf(Number(active.id));
    const newIdx = ids.indexOf(Number(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(ids, oldIdx, newIdx);
    setRowOrder(next);
    savePrefs({ rowOrder: next });
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Global Leads Database</h1>
        <div className="flex items-center gap-2">

          {/* Column visibility toggle */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 border-border">
                <Columns className="w-4 h-4" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Show Columns
              </p>
              <div className="space-y-1">
                {orderedAllCols.map(col => (
                  <div key={col.key} className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50">
                    <span className="text-sm font-medium">{col.label}</span>
                    <Switch
                      checked={!hiddenColumns.has(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="3m">Last 3 months</SelectItem>
              <SelectItem value="6m">Last 6 months</SelectItem>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="this_year">This year</SelectItem>
              <SelectItem value="last_year">Last year</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search leads…"
              className="pl-8 h-9 w-48"
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <Button size="sm" className="h-9 gap-1.5" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4" /> New Lead
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={<LayoutGrid className="w-5 h-5" />} label="Total Leads"   value={stats?.totalLeads ?? 0} />
        <StatCard icon={<Clock       className="w-5 h-5" />} label="Active Leads"  value={stats?.activeLeads ?? 0} iconBg="bg-amber-100 text-amber-600" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Paid Leads"  value={stats?.paidLeads ?? 0}   iconBg="bg-green-100 text-green-600" />
        <StatCard icon={<DollarSign  className="w-5 h-5" />} label="Paid Revenue" value={formatCurrency(stats?.paidRevenue ?? 0)} iconBg="bg-green-100 text-green-700" />
        <StatCard icon={<TrendingUp  className="w-5 h-5" />} label="Total Revenue" value={formatCurrency(stats?.totalRevenue ?? 0)} iconBg="bg-blue-100 text-blue-600" />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>

            {/* ── Column header drag context ── */}
            <TableHeader>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleColDragEnd}
              >
                <SortableContext
                  items={orderedAllCols.map(c => c.key)}
                  strategy={horizontalListSortingStrategy}
                >
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    {/* Spacer for row-drag handle column */}
                    <TableHead className="w-8 px-1" />
                    {visibleCols.map(col => (
                      <SortableColHeader key={col.key} col={col} />
                    ))}
                    <TableHead className="w-16 px-4" />
                  </TableRow>
                </SortableContext>
              </DndContext>
            </TableHeader>

            {/* ── Row drag context ── */}
            <TableBody>
              {leadsLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleCols.length + 2} className="h-24 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleCols.length + 2} className="h-32 text-center text-muted-foreground">
                    No leads yet. Add your first lead.
                  </TableCell>
                </TableRow>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleRowDragEnd}
                >
                  <SortableContext
                    items={leads.map(l => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {leads.map((lead, i) => (
                      <SortableLeadRow
                        key={lead.id}
                        lead={lead}
                        index={i}
                        visibleCols={visibleCols}
                        onDelete={id => deleteMut.mutate(id)}
                        isDeleting={deleteMut.isPending}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}

              {/* Footer totals row */}
              {leads.length > 0 && (
                <TableRow className="bg-muted/20 font-medium border-t-2 border-border">
                  <TableCell className="w-8 px-1" />
                  {visibleCols.map(col => (
                    <TableCell key={col.key} className="px-4 py-2.5 text-sm border-r border-border/30 last:border-r-0">
                      {col.key === "leadValue"
                        ? formatCurrency(leads.reduce((s, r) => s + (r.leadValue || 0), 0))
                        : ""}
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              )}
            </TableBody>

          </Table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Add New Lead</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { id: "contact",       label: "Contact (Phone)" },
              { id: "email",         label: "Email" },
              { id: "businessOwner", label: "Business Owner" },
              { id: "businessName",  label: "Business Name" },
              { id: "service",       label: "Service" },
              { id: "response",      label: "Response" },
              { id: "followUp",      label: "Follow Up" },
              { id: "leadAssignee",  label: "Lead Assignee" },
            ].map(f => (
              <div key={f.id} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input
                  value={(form as any)[f.id] ?? ""}
                  onChange={e => setForm(p => ({ ...p, [f.id]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Lead Value ($)</Label>
              <Input
                type="number"
                value={form.leadValue ?? 0}
                onChange={e => setForm(p => ({ ...p, leadValue: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status ?? "pending"} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>
              {createMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Add Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
