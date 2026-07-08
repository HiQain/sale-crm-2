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
import { LayoutGrid, CheckCircle2, DollarSign, TrendingUp, Search, Plus, Trash2, Loader2 } from "lucide-react";
import React from "react";

interface JourneyRecord {
  id: number;
  date: string | null;
  clientName: string | null;
  businessName: string | null;
  creditCard: string | null;
  email: string | null;
  phone: string | null;
  sales: string | null;
  leadAssignee: string | null;
  service: string | null;
  status: string;
  paidAmount: number;
  balance: number;
  total: number;
}
interface JourneysStats { totalJourneys: number; paidJourneys: number; paidRevenue: number; totalRevenue: number; }

const COLUMNS: ColumnDef[] = [
  { key: "date",          label: "Date" },
  { key: "clientName",    label: "Client Name" },
  { key: "businessName",  label: "Business Name" },
  { key: "creditCard",    label: "Credit Card" },
  { key: "email",         label: "Email" },
  { key: "phone",         label: "Phone" },
  { key: "sales",         label: "Sales" },
  { key: "leadAssignee",  label: "Lead" },
  { key: "service",       label: "Service" },
  { key: "status",        label: "Status" },
  { key: "paidAmount",    label: "Paid" },
  { key: "balance",       label: "Balance" },
  { key: "total",         label: "Total" },
];

const fetchJourneys = (search: string): Promise<JourneyRecord[]> =>
  fetch(`/api/client-journeys${search ? `?search=${encodeURIComponent(search)}` : ""}`, { credentials: "include" }).then(r => r.json());
const fetchStats = (): Promise<JourneysStats> =>
  fetch("/api/client-journeys/stats", { credentials: "include" }).then(r => r.json());
const deleteJourney = (id: number) =>
  fetch(`/api/client-journeys/${id}`, { method: "DELETE", credentials: "include" });
const createJourney = (data: Partial<JourneyRecord>) =>
  fetch("/api/client-journeys", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json());

function fmtDate(d: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "2-digit" });
}

function JourneyStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    contacted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}

export default function ClientJourneys() {
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState<Set<string>>(new Set(COLUMNS.map(c => c.key)));
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<Partial<JourneyRecord>>({ status: "pending", paidAmount: 0, balance: 0, total: 0 });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: journeys = [], isLoading } = useQuery({ queryKey: ["client-journeys", search], queryFn: () => fetchJourneys(search) });
  const { data: stats } = useQuery({ queryKey: ["client-journeys-stats"], queryFn: fetchStats });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteJourney(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client-journeys"] }); qc.invalidateQueries({ queryKey: ["client-journeys-stats"] }); toast({ title: "Record deleted" }); },
  });
  const createMut = useMutation({
    mutationFn: createJourney,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client-journeys"] }); qc.invalidateQueries({ queryKey: ["client-journeys-stats"] }); setIsCreateOpen(false); setForm({ status: "pending", paidAmount: 0, balance: 0, total: 0 }); toast({ title: "Journey added" }); },
  });

  const toggleCol = (key: string) => setVisible(prev => {
    const next = new Set(prev);
    if (next.has(key)) { if (next.size === 1) return prev; next.delete(key); } else { next.add(key); }
    return next;
  });

  const moneyKeys = new Set(["paidAmount", "balance", "total"]);
  const visibleCols = COLUMNS.filter(c => visible.has(c.key));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Client Journey</h1>
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
            <Input placeholder="Search journeys…" className="pl-8 h-9 w-48" onChange={e => setSearch(e.target.value)} />
          </div>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4" /> New Record
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<LayoutGrid className="w-5 h-5" />} label="Total Journeys" value={stats?.totalJourneys ?? 0} />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Paid Journeys" value={stats?.paidJourneys ?? 0} iconBg="bg-green-100 text-green-600" />
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Paid Revenue" value={formatCurrency(stats?.paidRevenue ?? 0)} iconBg="bg-green-100 text-green-700" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Total Revenue" value={formatCurrency(stats?.totalRevenue ?? 0)} iconBg="bg-blue-100 text-blue-600" />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {visibleCols.map(col => (
                  <TableHead key={col.key} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground h-10 px-4">{col.label}</TableHead>
                ))}
                <TableHead className="w-16 px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={visibleCols.length + 1} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : journeys.length === 0 ? (
                <TableRow><TableCell colSpan={visibleCols.length + 1} className="h-32 text-center text-muted-foreground">No records yet.</TableCell></TableRow>
              ) : journeys.map((row, i) => (
                <TableRow key={row.id} className={i % 2 === 1 ? "bg-muted/10" : ""}>
                  {visibleCols.map(col => (
                    <TableCell key={col.key} className="px-4 py-2.5 text-sm border-r border-border/30 last:border-r-0 max-w-[140px]">
                      {col.key === "status" ? <JourneyStatusBadge status={row.status} />
                        : col.key === "date" ? <span>{fmtDate(row.date)}</span>
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
              {journeys.length > 0 && (
                <TableRow className="bg-muted/20 font-medium border-t-2 border-border">
                  {visibleCols.map(col => (
                    <TableCell key={col.key} className="px-4 py-2.5 text-sm border-r border-border/30 last:border-r-0">
                      {col.key === "paidAmount" ? formatCurrency(journeys.reduce((s, r) => s + (r.paidAmount || 0), 0))
                        : col.key === "balance" ? formatCurrency(journeys.reduce((s, r) => s + (r.balance || 0), 0))
                        : col.key === "total" ? formatCurrency(journeys.reduce((s, r) => s + (r.total || 0), 0))
                        : col.key === "status" ? <JourneyStatusBadge status="pending" /> : ""}
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
          <DialogHeader><DialogTitle>Add New Client Journey</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { id: "clientName", label: "Client Name" },
              { id: "businessName", label: "Business Name" },
              { id: "email", label: "Email" },
              { id: "phone", label: "Phone" },
              { id: "creditCard", label: "Credit Card" },
              { id: "sales", label: "Sales Rep" },
              { id: "leadAssignee", label: "Lead" },
              { id: "service", label: "Service" },
            ].map(f => (
              <div key={f.id} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input value={(form as any)[f.id] ?? ""} onChange={e => setForm(p => ({ ...p, [f.id]: e.target.value }))} />
              </div>
            ))}
            {[
              { id: "paidAmount", label: "Paid ($)" },
              { id: "balance", label: "Balance ($)" },
              { id: "total", label: "Total ($)" },
            ].map(f => (
              <div key={f.id} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input type="number" value={(form as any)[f.id] ?? 0} onChange={e => setForm(p => ({ ...p, [f.id]: parseFloat(e.target.value) || 0 }))} />
              </div>
            ))}
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
              {createMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Add Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
