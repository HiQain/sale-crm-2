import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, CreditCard, DollarSign, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StatCard, formatCurrency } from "@/components/ui/stat-card";
import { DataGrid, type Column } from "@/components/ui/data-grid";

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

interface BillingsStats {
  totalBillings: number;
  paymentsReceived: number;
  grossAmount: number;
  netCurrency: number;
}

const api = {
  list: (search: string): Promise<BillingRecord[]> =>
    fetch(`/api/billings${search ? `?search=${encodeURIComponent(search)}` : ""}`, {
      credentials: "include",
    }).then((response) => response.json()),
  stats: (): Promise<BillingsStats> =>
    fetch("/api/billings/stats", { credentials: "include" }).then((response) => response.json()),
  patch: (id: number, data: Partial<BillingRecord>) =>
    fetch(`/api/billings/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((response) => response.json()),
  remove: (id: number) =>
    fetch(`/api/billings/${id}`, { method: "DELETE", credentials: "include" }),
  create: (data: Partial<BillingRecord>) =>
    fetch("/api/billings", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((response) => response.json()),
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function Billings() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: billings = [], isLoading } = useQuery({
    queryKey: ["billings", search],
    queryFn: () => api.list(search),
  });

  const { data: stats } = useQuery({
    queryKey: ["billings-stats"],
    queryFn: api.stats,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["billings"] });
    queryClient.invalidateQueries({ queryKey: ["billings-stats"] });
  };

  const patchMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BillingRecord> }) => api.patch(id, data),
    onSuccess: () => {
      invalidate();
      toast({ title: "Saved" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.remove(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "Deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: api.create,
    onSuccess: () => {
      invalidate();
      toast({ title: "Billing added" });
    },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  const handleEdit = (row: BillingRecord, key: keyof BillingRecord, value: string) => {
    const numericKeys = new Set<keyof BillingRecord>(["amount", "feeDeducted", "netCurrency"]);
    const payload: Partial<BillingRecord> = {
      [key]: numericKeys.has(key) ? Number(value || 0) : value,
    } as Partial<BillingRecord>;

    patchMutation.mutate({ id: row.id, data: payload });
  };

  const handleDelete = (row: BillingRecord) => {
    deleteMutation.mutate(row.id);
  };

  const handleAddInline = (data: Record<string, string>) => {
    createMutation.mutate({
      invoiceDate: data.invoiceDate || null,
      paymentDate: data.paymentDate || null,
      clientName: data.clientName || null,
      businessName: data.businessName || null,
      paymentMethod: data.paymentMethod || null,
      service: data.service || null,
      amount: Number(data.amount || 0),
      feeDeducted: Number(data.feeDeducted || 0),
      netCurrency: Number(data.netCurrency || 0),
      leadAssignee: data.leadAssignee || null,
    });
  };

  const columns: Column<BillingRecord>[] = [
    { key: "invoiceDate", header: "Invoice Date", render: (row) => formatDate(row.invoiceDate) },
    { key: "paymentDate", header: "Payment Date", render: (row) => formatDate(row.paymentDate) },
    { key: "clientName", header: "Client Name" },
    { key: "businessName", header: "Business Name" },
    { key: "paymentMethod", header: "Payment Method" },
    { key: "service", header: "Service" },
    { key: "amount", header: "Amount", inputType: "number", render: (row) => formatCurrency(row.amount || 0) },
    { key: "feeDeducted", header: "Fee Deducted", inputType: "number", render: (row) => formatCurrency(row.feeDeducted || 0) },
    { key: "netCurrency", header: "Net Currency", inputType: "number", render: (row) => formatCurrency(row.netCurrency || 0) },
    { key: "leadAssignee", header: "Lead" },
  ];

  return (
    <div className="space-y-5 px-[10px]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<LayoutGrid className="h-5 w-5" />} label="Total Billings" value={stats?.totalBillings ?? 0} />
        <StatCard icon={<CreditCard className="h-5 w-5" />} label="Payments Received" value={stats?.paymentsReceived ?? 0} iconBg="bg-blue-100 text-blue-600" />
        <StatCard icon={<DollarSign className="h-5 w-5" />} label="Gross Amount" value={formatCurrency(stats?.grossAmount ?? 0)} iconBg="bg-green-100 text-green-700" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Net Currency" value={formatCurrency(stats?.netCurrency ?? 0)} iconBg="bg-emerald-100 text-emerald-600" />
      </div>

      <div className="h-[calc(100vh-18rem)]">
        <DataGrid
          title="Billings"
          data={billings}
          columns={columns}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSearch={setSearch}
          searchPlaceholder="Search billings..."
          onAddInline={handleAddInline}
        />
      </div>
    </div>
  );
}
