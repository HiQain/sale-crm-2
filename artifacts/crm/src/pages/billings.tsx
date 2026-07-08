import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { StatCard, formatCurrency } from "@/components/ui/stat-card";
import { ColumnsToggle, ColumnDef } from "@/components/ui/columns-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LayoutGrid, CreditCard, DollarSign, TrendingUp, Search, Plus, Trash2, Loader2 } from "lucide-react";
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

const fetchBillings = (search: string): Promise<BillingRecord[]> =>
  fetch(`/api/billings${search ? `?search=${encodeURIComponent(search)}` : ""}`, { credentials: "include" }).then(r => r.json());
const fetchStats = (): Promise<BillingsStats> =>
  fetch("/api/billings/stats", { credentials: "include" }).then(r => r.json());
const deleteBilling = (id: number) =>
  fetch(`/api/billings/${id}`, { method: "DELETE", credentials: "include" });
const createBilling = (data: Partial<BillingRecord>) =>
  fetch("/api/billings", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json());

function fmtDate(d: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "2-digit" });
}

const moneyKeys = new Set(["amount", "feeDeducted", "netCurrency"]);
const dateKeys = new Set(["invoiceDate", "paymentDate"]);

export default function Billings() {
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState<Set<string>>(new Set(COLUMNS.map(c => c.key)));
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<Partial<BillingRecord>>({ amount: 0, feeDeducted: 0, netCurrency: 0 });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: billings = [], isLoading } = useQuery({ queryKey: ["billings", search], queryFn: () => fetchBillings(search) });
  const { data: stats } = useQuery({ queryKey: ["billings-stats"], queryFn: fetchStats });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteBilling(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["billings"] }); qc.invalidateQueries({ queryKey: ["billings-stats"] }); toast({ title: "Billing deleted" }); },
  });
  const createMut = useMutation({
    mutationFn: createBilling,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["billings"] }); qc.invalidateQueries({ queryKey: ["billings-stats"] }); setIsCreateOpen(false); setForm({ amount: 0, feeDeducted: 0, netCurrency: 0 }); toast({ title: "Billing added" }); },
  });

  const toggleCol = (key: string) => setVisible(prev => {
    const next = new Set(prev);
    if (next.has(key)) { if (next.size === 1) return prev; next.delete(key); } else { next.add(key); }
    return next;
  });

  const visibleCols = COLUMNS.filter(c => visible.has(c.key));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Billings</h1>
        <div className="flex items-center gap-2">
          <ColumnsToggle columns={COLUMNS} visible={visible} onToggle={toggleCol} />
          <Select defaultValue="all">
            <SelectTrigger className="h-9 w-32 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="year">This year</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search billings…" className="pl-8 h-9 w-48" onChange={e => setSearch(e.target.value)} />
          </div>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4" /> New Billing
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<LayoutGrid className="w-5 h-5" />} label="Total Billings" value={stats?.totalBillings ?? 0} />
        <StatCard icon={<CreditCard className="w-5 h-5" />} label="Payments Received" value={stats?.paymentsReceived ?? 0} iconBg="bg-blue-100 text-blue-600" />
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Gross Amount" value={formatCurrency(stats?.grossAmount ?? 0)} iconBg="bg-green-100 text-green-700" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Net Currency" value={formatCurrency(stats?.netCurrency ?? 0)} iconBg="bg-emerald-100 text-emerald-600" />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {visibleCols.map(col => (
                  <TableHead key={col.key} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground h-10 px-4 whitespace-nowrap">{col.label}</TableHead>
                ))}
                <TableHead className="w-16 px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={visibleCols.length + 1} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : billings.length === 0 ? (
                <TableRow><TableCell colSpan={visibleCols.length + 1} className="h-32 text-center text-muted-foreground">No billing records yet.</TableCell></TableRow>
              ) : billings.map((row, i) => (
                <TableRow key={row.id} className={i % 2 === 1 ? "bg-muted/10" : ""}>
                  {visibleCols.map(col => (
                    <TableCell key={col.key} className="px-4 py-2.5 text-sm border-r border-border/30 last:border-r-0 max-w-[160px]">
                      {dateKeys.has(col.key) ? <span>{fmtDate((row as any)[col.key])}</span>
                        : moneyKeys.has(col.key) ? <span className="font-medium">{formatCurrency((row as any)[col.key] ?? 0)}</span>
                        : <span className="truncate block">{(row as any)[col.key] ?? ""}</span>}
                    </TableCell>
                  ))}
                  <TableCell className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteMut.mutate(row.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {billings.length > 0 && (
                <TableRow className="bg-muted/20 font-medium border-t-2 border-border">
                  {visibleCols.map(col => (
                    <TableCell key={col.key} className="px-4 py-2.5 text-sm border-r border-border/30 last:border-r-0">
                      {col.key === "amount" ? formatCurrency(billings.reduce((s, r) => s + (r.amount || 0), 0))
                        : col.key === "feeDeducted" ? formatCurrency(billings.reduce((s, r) => s + (r.feeDeducted || 0), 0))
                        : col.key === "netCurrency" ? formatCurrency(billings.reduce((s, r) => s + (r.netCurrency || 0), 0))
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>Add New Billing</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { id: "clientName", label: "Client Name" },
              { id: "businessName", label: "Business Name" },
              { id: "paymentMethod", label: "Payment Method" },
              { id: "service", label: "Service" },
              { id: "leadAssignee", label: "Lead Assignee" },
              { id: "invoiceDate", label: "Invoice Date", type: "date" },
              { id: "paymentDate", label: "Payment Date", type: "date" },
            ].map(f => (
              <div key={f.id} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input type={f.type ?? "text"} value={(form as any)[f.id] ?? ""} onChange={e => setForm(p => ({ ...p, [f.id]: e.target.value }))} />
              </div>
            ))}
            {[
              { id: "amount", label: "Amount ($)" },
              { id: "feeDeducted", label: "Fee Deducted ($)" },
              { id: "netCurrency", label: "Net Currency ($)" },
            ].map(f => (
              <div key={f.id} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input type="number" value={(form as any)[f.id] ?? 0} onChange={e => setForm(p => ({ ...p, [f.id]: parseFloat(e.target.value) || 0 }))} />
              </div>
            ))}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>
              {createMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Add Billing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
