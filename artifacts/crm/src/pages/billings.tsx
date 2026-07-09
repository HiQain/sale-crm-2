import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { StatCard, formatCurrency } from "@/components/ui/stat-card";
import { ColumnsToggle, ColumnDef } from "@/components/ui/columns-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutGrid, CreditCard, DollarSign, TrendingUp, Search, Trash2, Plus, X } from "lucide-react";
import React from "react";

interface BillingRecord {
  id: number;
  invoiceDate: string | null;
  paymentDate: string | null;
  clientName: string | null;
  businessName: string | null;
  paymentMethod: string | null;
  service: string | null;
  amount: number;
  feeDeducted: number;
  netCurrency: number;
  leadAssignee: string | null;
}
interface BillingsStats { totalBillings: number; paymentsReceived: number; grossAmount: number; netCurrency: number; }

const COLUMNS: ColumnDef[] = [
  { key: "invoiceDate",   label: "Invoice Date" },
  { key: "paymentDate",   label: "Payment Date" },
  { key: "clientName",    label: "Client Name" },
  { key: "businessName",  label: "Business Name" },
  { key: "paymentMethod", label: "Payment Method" },
  { key: "service",       label: "Service" },
  { key: "amount",        label: "Amount" },
  { key: "feeDeducted",   label: "Fee Deducted" },
  { key: "netCurrency",   label: "Net Currency" },
  { key: "leadAssignee",  label: "Lead" },
];

const moneyKeys = new Set(["amount", "feeDeducted", "netCurrency"]);
const dateKeys  = new Set(["invoiceDate", "paymentDate"]);

const api = {
  list:   (s: string): Promise<BillingRecord[]> =>
    fetch(`/api/billings${s ? `?search=${encodeURIComponent(s)}` : ""}`, { credentials: "include" }).then(r => r.json()),
  stats:  (): Promise<BillingsStats> =>
    fetch("/api/billings/stats", { credentials: "include" }).then(r => r.json()),
  patch:  (id: number, data: Partial<BillingRecord>) =>
    fetch(`/api/billings/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
  remove: (id: number) =>
    fetch(`/api/billings/${id}`, { method: "DELETE", credentials: "include" }),
  create: (data: Partial<BillingRecord>) =>
    fetch("/api/billings", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
};

function fmtDate(d: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "2-digit" });
}

// ── Shared inline cell editor ─────────────────────────────────────────────────
function CellEditor({ colKey, value, onSave, onCancel }: { colKey: string; value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  React.useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const commit = () => onSave(val);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    e.stopPropagation();
  };
  return (
    <input ref={ref} type={moneyKeys.has(colKey) ? "number" : dateKeys.has(colKey) ? "date" : "text"} value={val}
      className="w-full min-w-[80px] text-sm border border-primary/40 rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary px-1.5 py-0.5"
      onChange={e => setVal(e.target.value)} onBlur={commit} onKeyDown={onKey} />
  );
}

// ── Inline new row ─────────────────────────────────────────────────────────────
function NewBillingRow({ visibleCols, onSave, onCancel }: { visibleCols: ColumnDef[]; onSave: (d: Partial<BillingRecord>) => void; onCancel: () => void }) {
  const [data, setData] = useState<Record<string, string>>({ amount: "0", feeDeducted: "0", netCurrency: "0" });
  const firstRef = useRef<HTMLInputElement>(null);
  React.useEffect(() => { firstRef.current?.focus(); }, []);

  const commit = () => {
    const payload: any = { ...data };
    ["amount", "feeDeducted", "netCurrency"].forEach(k => { if (data[k] !== undefined) payload[k] = parseFloat(data[k]) || 0; });
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
      {visibleCols.map((col, idx) => (
        <TableCell key={col.key} className="px-1 py-1 border-r border-border/30 last:border-r-0">
          <input ref={idx === 0 ? firstRef : undefined}
            type={moneyKeys.has(col.key) ? "number" : dateKeys.has(col.key) ? "date" : "text"}
            placeholder={col.label}
            value={data[col.key] ?? ""}
            className="w-full min-w-[60px] text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary px-1.5 py-0.5 placeholder:text-muted-foreground/50"
            onChange={e => setData(d => ({ ...d, [col.key]: e.target.value }))}
            onKeyDown={e => onKey(e, idx)} />
        </TableCell>
      ))}
      <TableCell className="px-1 py-1 text-right w-8">
        <button className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60" onClick={onCancel} title="Cancel">
          <X className="w-3.5 h-3.5" />
        </button>
      </TableCell>
    </TableRow>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Billings() {
  const [search,      setSearch]      = useState("");
  const [timeFilter,  setTimeFilter]  = useState("all");
  const [visible,     setVisible]     = useState<Set<string>>(new Set(COLUMNS.map(c => c.key)));
  const [showNewRow,  setShowNewRow]  = useState(false);
  const [editingCell, setEditingCell] = useState<{ rowId: number; colKey: string } | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: billings = [], isLoading } = useQuery({ queryKey: ["billings", search], queryFn: () => api.list(search) });
  const { data: stats } = useQuery({ queryKey: ["billings-stats"], queryFn: api.stats });

  const patchMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BillingRecord> }) => api.patch(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["billings"] }); qc.invalidateQueries({ queryKey: ["billings-stats"] }); },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["billings"] }); qc.invalidateQueries({ queryKey: ["billings-stats"] }); toast({ title: "Deleted" }); },
  });

  const createMut = useMutation({
    mutationFn: api.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["billings"] }); qc.invalidateQueries({ queryKey: ["billings-stats"] }); setShowNewRow(false); toast({ title: "Billing added" }); },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  const toggleCol = (key: string) => setVisible(prev => {
    const next = new Set(prev);
    if (next.has(key)) { if (next.size === 1) return prev; next.delete(key); } else { next.add(key); }
    return next;
  });

  const visibleCols = COLUMNS.filter(c => visible.has(c.key));

  const handleCellSave = (rowId: number, colKey: string, val: string) => {
    setEditingCell(null);
    const data: any = { [colKey]: moneyKeys.has(colKey) ? parseFloat(val) || 0 : val };
    patchMut.mutate({ id: rowId, data });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Billings</h1>
        <div className="flex items-center gap-2">
          <ColumnsToggle columns={COLUMNS} visible={visible} onToggle={toggleCol} />
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
            <Input placeholder="Search billings…" className="pl-8 h-9 w-48" onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<LayoutGrid className="w-5 h-5" />} label="Total Billings"     value={stats?.totalBillings ?? 0} />
        <StatCard icon={<CreditCard className="w-5 h-5" />} label="Payments Received"  value={stats?.paymentsReceived ?? 0}           iconBg="bg-blue-100 text-blue-600" />
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Gross Amount"       value={formatCurrency(stats?.grossAmount ?? 0)} iconBg="bg-green-100 text-green-700" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Net Currency"       value={formatCurrency(stats?.netCurrency ?? 0)} iconBg="bg-emerald-100 text-emerald-600" />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {visibleCols.map(col => (
                  <TableHead key={col.key} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground h-10 px-2 whitespace-nowrap">{col.label}</TableHead>
                ))}
                <TableHead className="w-8 px-1" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={visibleCols.length + 1} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : billings.length === 0 && !showNewRow ? (
                <TableRow><TableCell colSpan={visibleCols.length + 1} className="h-32 text-center text-muted-foreground">No billing records yet.</TableCell></TableRow>
              ) : (
                <>
                  {billings.map((row, i) => (
                    <TableRow key={row.id} className={row.paymentDate ? "bg-green-50/60 dark:bg-green-900/10" : i % 2 === 1 ? "bg-muted/10" : ""}>
                      {visibleCols.map(col => {
                        const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;
                        const raw = (row as any)[col.key];
                        const display = dateKeys.has(col.key) ? fmtDate(raw)
                          : moneyKeys.has(col.key) ? formatCurrency(raw ?? 0)
                          : raw ?? "";
                        return (
                          <TableCell key={col.key}
                            className="px-2 py-2 text-sm border-r border-border/30 last:border-r-0 max-w-[160px]"
                            onDoubleClick={() => !isEditing && setEditingCell({ rowId: row.id, colKey: col.key })}
                            title="Double-click to edit">
                            {isEditing
                              ? <CellEditor colKey={col.key} value={String(raw ?? "")}
                                  onSave={v => handleCellSave(row.id, col.key, v)}
                                  onCancel={() => setEditingCell(null)} />
                              : <span className="truncate block">{display}</span>}
                          </TableCell>
                        );
                      })}
                      <TableCell className="px-1 py-2 text-right w-8">
                        <button className="p-1 rounded text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={() => deleteMut.mutate(row.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {showNewRow && (
                    <NewBillingRow visibleCols={visibleCols}
                      onSave={data => createMut.mutate(data)}
                      onCancel={() => setShowNewRow(false)} />
                  )}
                  {billings.length > 0 && (
                    <TableRow className="bg-muted/20 font-medium border-t-2 border-border">
                      {visibleCols.map(col => (
                        <TableCell key={col.key} className="px-2 py-2.5 text-sm border-r border-border/30 last:border-r-0">
                          {col.key === "amount"      ? formatCurrency(billings.reduce((s, r) => s + (r.amount || 0), 0))
                            : col.key === "feeDeducted"  ? formatCurrency(billings.reduce((s, r) => s + (r.feeDeducted || 0), 0))
                            : col.key === "netCurrency"  ? formatCurrency(billings.reduce((s, r) => s + (r.netCurrency || 0), 0))
                            : ""}
                        </TableCell>
                      ))}
                      <TableCell />
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="border-t border-border/60 px-3 py-2">
          <button
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            onClick={() => { setShowNewRow(true); setEditingCell(null); }}
            disabled={showNewRow}>
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
