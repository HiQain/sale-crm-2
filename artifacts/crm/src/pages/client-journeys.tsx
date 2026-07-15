import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, CheckCircle2, DollarSign, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DataGrid, type Column } from "@/components/ui/data-grid";
import { StatCard, formatCurrency } from "@/components/ui/stat-card";
import { formatPhoneNumber, isValidPhoneNumber } from "@/lib/utils";

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

interface JourneysStats {
  totalJourneys: number;
  paidJourneys: number;
  paidRevenue: number;
  totalRevenue: number;
}

const api = {
  list: (search: string): Promise<JourneyRecord[]> =>
    fetch(`/api/client-journeys${search ? `?search=${encodeURIComponent(search)}` : ""}`, {
      credentials: "include",
    }).then((response) => response.json()),
  stats: (): Promise<JourneysStats> =>
    fetch("/api/client-journeys/stats", { credentials: "include" }).then((response) => response.json()),
  patch: (id: number, data: Partial<JourneyRecord>) =>
    fetch(`/api/client-journeys/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((response) => response.json()),
  remove: (id: number) =>
    fetch(`/api/client-journeys/${id}`, { method: "DELETE", credentials: "include" }),
  create: (data: Partial<JourneyRecord>) =>
    fetch("/api/client-journeys", {
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

function JourneyStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "border border-gray-300 text-gray-600 bg-transparent",
    contacted: "bg-blue-500 text-white border border-blue-500",
    paid: "bg-green-500 text-white border border-green-500",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

export default function ClientJourneys() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: journeys = [], isLoading } = useQuery({
    queryKey: ["client-journeys", search],
    queryFn: () => api.list(search),
  });

  const { data: stats } = useQuery({
    queryKey: ["client-journeys-stats"],
    queryFn: api.stats,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["client-journeys"] });
    queryClient.invalidateQueries({ queryKey: ["client-journeys-stats"] });
  };

  const patchMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<JourneyRecord> }) => api.patch(id, data),
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
      toast({ title: "Record added" });
    },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  const handleEdit = (row: JourneyRecord, key: keyof JourneyRecord, value: string) => {
    const numericKeys = new Set<keyof JourneyRecord>(["paidAmount", "balance", "total"]);

    if (key === "phone" && value && !isValidPhoneNumber(value)) {
      toast({ title: "Invalid phone number", description: "Use format (201) 000-9090", variant: "destructive" });
      return;
    }

    const payload: Partial<JourneyRecord> = {
      [key]:
        key === "phone"
          ? formatPhoneNumber(value)
          : numericKeys.has(key)
            ? Number(value || 0)
            : value,
    } as Partial<JourneyRecord>;

    patchMutation.mutate({ id: row.id, data: payload });
  };

  const handleDelete = (row: JourneyRecord) => {
    deleteMutation.mutate(row.id);
  };

  const handleAddInline = (data: Record<string, string>) => {
    if (data.phone && !isValidPhoneNumber(data.phone)) {
      toast({ title: "Invalid phone number", description: "Use format (201) 000-9090", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      date: data.date || null,
      clientName: data.clientName || null,
      businessName: data.businessName || null,
      creditCard: data.creditCard || null,
      email: data.email || null,
      phone: data.phone ? formatPhoneNumber(data.phone) : null,
      sales: data.sales || null,
      leadAssignee: data.leadAssignee || null,
      service: data.service || null,
      status: data.status || "pending",
      paidAmount: Number(data.paidAmount || 0),
      balance: Number(data.balance || 0),
      total: Number(data.total || 0),
    });
  };

  const columns: Column<JourneyRecord>[] = [
    { key: "date", header: "Date", render: (row) => formatDate(row.date) },
    { key: "clientName", header: "Client Name" },
    { key: "businessName", header: "Business Name" },
    { key: "creditCard", header: "Credit Card" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone", render: (row) => (row.phone ? formatPhoneNumber(row.phone) : "-") },
    { key: "sales", header: "Sales" },
    { key: "leadAssignee", header: "Lead" },
    { key: "service", header: "Service" },
    { key: "status", header: "Status", render: (row) => <JourneyStatusBadge status={row.status} /> },
    { key: "paidAmount", header: "Paid", inputType: "number", render: (row) => formatCurrency(row.paidAmount || 0) },
    { key: "balance", header: "Balance", inputType: "number", render: (row) => formatCurrency(row.balance || 0) },
    { key: "total", header: "Total", inputType: "number", render: (row) => formatCurrency(row.total || 0) },
  ];

  return (
    <div className="space-y-5 px-[10px]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<LayoutGrid className="h-5 w-5" />} label="Total Journeys" value={stats?.totalJourneys ?? 0} />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Paid Journeys" value={stats?.paidJourneys ?? 0} iconBg="bg-green-100 text-green-600" />
        <StatCard icon={<DollarSign className="h-5 w-5" />} label="Paid Revenue" value={formatCurrency(stats?.paidRevenue ?? 0)} iconBg="bg-green-100 text-green-700" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Total Revenue" value={formatCurrency(stats?.totalRevenue ?? 0)} iconBg="bg-blue-100 text-blue-600" />
      </div>

      <div className="h-[calc(100vh-18rem)]">
        <DataGrid
          title="Client Journey"
          data={journeys}
          columns={columns}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSearch={setSearch}
          searchPlaceholder="Search journeys..."
          onAddInline={handleAddInline}
          addRowDefaults={{ status: "pending", paidAmount: "0", balance: "0", total: "0" }}
        />
      </div>
    </div>
  );
}
