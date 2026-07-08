import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { StatCard, formatCurrency } from "@/components/ui/stat-card";
import { ColumnsToggle, ColumnDef } from "@/components/ui/columns-toggle";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  LayoutGrid, Clock, CheckCircle2, DollarSign, TrendingUp,
  Search, Plus, Trash2, Loader2
} from "lucide-react";
import React from "react";

// ── Types ──────────────────────────────────────────────────────────
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

// ── Column definitions ─────────────────────────────────────────────
const COLUMNS: ColumnDef[] = [
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

// ── Fetchers ───────────────────────────────────────────────────────
const fetchLeads = (search: string): Promise<LeadRecord[]> =>
  fetch(`/api/leads${search ? `?search=${encodeURIComponent(search)}` : ""}`, { credentials: "include" }).then(r => r.json());

const fetchStats = (): Promise<LeadsStats> =>
  fetch("/api/leads/stats", { credentials: "include" }).then(r => r.json());

const deleteLead = (id: number) =>
  fetch(`/api/leads/${id}`, { method: "DELETE", credentials: "include" });

const createLead = (data: Partial<LeadRecord>) =>
  fetch("/api/leads", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json());

// ── Page ───────────────────────────────────────────────────────────
export default function Leads() {
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState<Set<string>>(new Set(COLUMNS.map(c => c.key)));
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<Partial<LeadRecord>>({ status: "pending", leadValue: 0 });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({ queryKey: ["leads", search], queryFn: () => fetchLeads(search) });
  const { data: stats } = useQuery({ queryKey: ["leads-stats"], queryFn: fetchStats });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteLead(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["leads-stats"] }); toast({ title: "Lead deleted" }); },
  });

  const createMut = useMutation({
    mutationFn: createLead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["leads-stats"] }); setIsCreateOpen(false); setForm({ status: "pending", leadValue: 0 }); toast({ title: "Lead added" }); },
  });

  const toggleCol = (key: string) => setVisible(prev => {
    const next = new Set(prev);
    if (next.has(key)) { if (next.size === 1) return prev; next.delete(key); } else { next.add(key); }
    return next;
  });

  const visibleCols = COLUMNS.filter(c => visible.has(c.key));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Global Leads Database</h1>
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
            <Input placeholder="Search leads…" className="pl-8 h-9 w-48" onChange={e => setSearch(e.target.value)} />
          </div>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4" /> New Lead
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={<LayoutGrid className="w-5 h-5" />} label="Total Leads" value={stats?.totalLeads ?? 0} />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Active Leads" value={stats?.activeLeads ?? 0} iconBg="bg-amber-100 text-amber-600" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Paid Leads" value={stats?.paidLeads ?? 0} iconBg="bg-green-100 text-green-600" />
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Paid Revenue" value={formatCurrency(stats?.paidRevenue ?? 0)} iconBg="bg-green-100 text-green-700" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Total Revenue" value={formatCurrency(stats?.totalRevenue ?? 0)} iconBg="bg-blue-100 text-blue-600" />
      </div>

      {/* Table */}
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
              ) : leads.length === 0 ? (
                <TableRow><TableCell colSpan={visibleCols.length + 1} className="h-32 text-center text-muted-foreground">No leads yet. Add your first lead.</TableCell></TableRow>
              ) : leads.map((row, i) => (
                <TableRow key={row.id} className={i % 2 === 1 ? "bg-muted/10" : ""}>
                  {visibleCols.map(col => (
                    <TableCell key={col.key} className="px-4 py-2.5 text-sm border-r border-border/30 last:border-r-0 max-w-[160px]">
                      {col.key === "status" ? (
                        <LeadStatusBadge status={row.status} />
                      ) : col.key === "leadValue" ? (
                        <span className="font-medium">{formatCurrency(row.leadValue)}</span>
                      ) : (
                        <span className="truncate block">{(row as any)[col.key] ?? ""}</span>
                      )}
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
              {/* Footer totals row */}
              {leads.length > 0 && (
                <TableRow className="bg-muted/20 font-medium border-t-2 border-border">
                  {visibleCols.map(col => (
                    <TableCell key={col.key} className="px-4 py-2.5 text-sm border-r border-border/30 last:border-r-0">
                      {col.key === "leadValue" ? formatCurrency(leads.reduce((s, r) => s + (r.leadValue || 0), 0)) : ""}
                      {col.key === "status" ? <LeadStatusBadge status="pending" /> : null}
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
              { id: "contact", label: "Contact (Phone)" },
              { id: "email", label: "Email" },
              { id: "businessOwner", label: "Business Owner" },
              { id: "businessName", label: "Business Name" },
              { id: "service", label: "Service" },
              { id: "response", label: "Response" },
              { id: "followUp", label: "Follow Up" },
              { id: "leadAssignee", label: "Lead Assignee" },
            ].map(f => (
              <div key={f.id} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input value={(form as any)[f.id] ?? ""} onChange={e => setForm(p => ({ ...p, [f.id]: e.target.value }))} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Lead Value ($)</Label>
              <Input type="number" value={form.leadValue ?? 0} onChange={e => setForm(p => ({ ...p, leadValue: parseFloat(e.target.value) || 0 }))} />
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
              {createMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Add Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeadStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    contacted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}
