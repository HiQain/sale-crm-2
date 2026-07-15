import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Columns, Plus, Settings2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatPhoneNumber, isValidPhoneNumber } from "@/lib/utils";
import { formatCurrency } from "@/components/ui/stat-card";
import { DataGrid, type Column } from "@/components/ui/data-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type ColType = "text" | "number" | "date";

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
  multiValues: Record<string, string[]>;
  createdAt: string;
}

interface LeadsPrefs {
  columnOrder: string[];
  hiddenColumns: string[];
  rowOrder: number[];
  columnWidths?: Record<string, number>;
}

interface CustomColRecord {
  id: number;
  name: string;
  fieldKey: string;
  position: number;
  type: ColType;
}

interface LeadGridRow extends LeadRecord {
  [key: string]: string | number | Record<string, string | number | null> | Record<string, string[]> | null;
}

interface LeadColumnDef {
  key: string;
  label: string;
  inputType?: "text" | "number" | "date";
  isCustom?: boolean;
  fieldKey?: string;
  customId?: number;
  colType?: ColType;
}

const BUILTIN_COLUMNS: LeadColumnDef[] = [
  { key: "contact", label: "Contact" },
  { key: "email", label: "Email" },
  { key: "businessOwner", label: "Business Owner" },
  { key: "businessName", label: "Business Name" },
  { key: "service", label: "Service" },
  { key: "response", label: "Response" },
  { key: "followUp", label: "Follow Up", inputType: "date" },
  { key: "leadValue", label: "Lead Value", inputType: "number" },
  { key: "leadAssignee", label: "Lead" },
  { key: "status", label: "Status" },
];

const STATUS_OPTIONS = ["pending", "contacted", "paid"] as const;
const MULTI_VALUE_COLS = new Set(["contact", "email", "businessName", "businessOwner", "service", "response"]);

const api = {
  fetchLeads: (search: string): Promise<LeadRecord[]> =>
    fetch(`/api/leads${search ? `?search=${encodeURIComponent(search)}` : ""}`, { credentials: "include" }).then((r) => r.json()),
  fetchPrefs: (): Promise<LeadsPrefs | null> =>
    fetch("/api/preferences/leads", { credentials: "include" }).then((r) => r.json()),
  savePrefs: (prefs: LeadsPrefs) =>
    fetch("/api/preferences/leads", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    }).then((r) => r.json()),
  patchLead: ({ id, data }: { id: number; data: Partial<LeadRecord> }) =>
    fetch(`/api/leads/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  deleteLead: (id: number) =>
    fetch(`/api/leads/${id}`, { method: "DELETE", credentials: "include" }),
  createLead: (data: Partial<LeadRecord>): Promise<LeadRecord> =>
    fetch("/api/leads", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  fetchCustomCols: (): Promise<CustomColRecord[]> =>
    fetch("/api/leads/columns", { credentials: "include" }).then((r) => r.json()),
  createCustomCol: (name: string, type: ColType): Promise<CustomColRecord> =>
    fetch("/api/leads/columns", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type }),
    }).then((r) => r.json()),
  updateCustomCol: (id: number, patch: { name?: string; type?: ColType }) =>
    fetch(`/api/leads/columns/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => r.json()),
  deleteCustomCol: (id: number) =>
    fetch(`/api/leads/columns/${id}`, { method: "DELETE", credentials: "include" }),
};

function getLeadMultiValues(lead: LeadRecord, key: string): string[] {
  const values = lead.multiValues?.[key];
  if (Array.isArray(values) && values.length > 0) return values;
  const primary = (lead as unknown as Record<string, unknown>)[key];
  return typeof primary === "string" && primary ? [primary] : [];
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function parseListValue(key: string, value: string) {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (key === "contact") {
    const invalid = items.find((item) => !isValidPhoneNumber(item));
    if (invalid) return { error: "Phone must be 10 digits, e.g. (201) 000-9090" };
    return { values: items.map((item) => formatPhoneNumber(item)) };
  }

  return { values: items };
}

function withinTimeFilter(value: string, filter: string) {
  if (filter === "all") return true;

  const current = new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;

  if (filter === "7d") {
    return current.getTime() - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
  }

  if (filter === "3m") {
    const min = new Date(current);
    min.setMonth(min.getMonth() - 3);
    return date >= min;
  }

  if (filter === "6m") {
    const min = new Date(current);
    min.setMonth(min.getMonth() - 6);
    return date >= min;
  }

  if (filter === "this_month") {
    return date.getMonth() === current.getMonth() && date.getFullYear() === current.getFullYear();
  }

  if (filter === "last_month") {
    const previous = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    return date.getMonth() === previous.getMonth() && date.getFullYear() === previous.getFullYear();
  }

  if (filter === "this_year") {
    return date.getFullYear() === current.getFullYear();
  }

  if (filter === "last_year") {
    return date.getFullYear() === current.getFullYear() - 1;
  }

  return true;
}

function StatusBadge({ status }: { status: string }) {
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

export default function Leads() {
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [manageOpen, setManageOpen] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>(BUILTIN_COLUMNS.map((column) => column.key));
  const [newCustomName, setNewCustomName] = useState("");
  const [newCustomType, setNewCustomType] = useState<ColType>("text");
  const [editingCustomId, setEditingCustomId] = useState<number | null>(null);
  const [editingCustomName, setEditingCustomName] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: rawLeads = [], isLoading } = useQuery({
    queryKey: ["leads", search],
    queryFn: () => api.fetchLeads(search),
  });

  const { data: savedPrefs } = useQuery({
    queryKey: ["leads-prefs"],
    queryFn: api.fetchPrefs,
  });

  const { data: customColRecords = [] } = useQuery<CustomColRecord[]>({
    queryKey: ["lead-custom-cols"],
    queryFn: api.fetchCustomCols,
  });

  useEffect(() => {
    if (!savedPrefs) return;
    if (savedPrefs.columnOrder?.length) setColumnOrder(savedPrefs.columnOrder);
    if (savedPrefs.hiddenColumns) setHiddenColumns(new Set(savedPrefs.hiddenColumns));
  }, [savedPrefs]);

  const allColumns = useMemo<LeadColumnDef[]>(() => {
    const custom: LeadColumnDef[] = customColRecords.map((column) => ({
      key: `custom_${column.fieldKey}`,
      label: column.name,
      inputType: column.type === "number" ? "number" : column.type === "date" ? "date" : "text",
      isCustom: true,
      fieldKey: column.fieldKey,
      customId: column.id,
      colType: column.type,
    }));

    return [...BUILTIN_COLUMNS, ...custom];
  }, [customColRecords]);

  useEffect(() => {
    const allKeys = allColumns.map((column) => column.key);
    setColumnOrder((current) => {
      const next = current.filter((key) => allKeys.includes(key));
      const missing = allKeys.filter((key) => !next.includes(key));
      return missing.length > 0 ? [...next, ...missing] : next;
    });
  }, [allColumns]);

  const savePrefs = (nextHiddenColumns: Set<string>, nextOrder: string[]) => {
    api.savePrefs({
      columnOrder: nextOrder,
      hiddenColumns: [...nextHiddenColumns],
      rowOrder: savedPrefs?.rowOrder ?? [],
      columnWidths: savedPrefs?.columnWidths ?? {},
    }).catch(() => {});
  };

  const orderedColumns = useMemo(() => {
    const byKey = new Map(allColumns.map((column) => [column.key, column]));
    const ordered = columnOrder.map((key) => byKey.get(key)).filter(Boolean) as LeadColumnDef[];
    allColumns.forEach((column) => {
      if (!ordered.some((item) => item.key === column.key)) {
        ordered.push(column);
      }
    });
    return ordered;
  }, [allColumns, columnOrder]);

  const visibleColumns = orderedColumns.filter((column) => !hiddenColumns.has(column.key));

  const patchMutation = useMutation({
    mutationFn: api.patchLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Saved" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Lead deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: api.createLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Lead added" });
    },
    onError: () => toast({ title: "Failed to add lead", variant: "destructive" }),
  });

  const createCustomColMutation = useMutation({
    mutationFn: ({ name, type }: { name: string; type: ColType }) => api.createCustomCol(name, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-custom-cols"] });
      setNewCustomName("");
      setNewCustomType("text");
      toast({ title: "Custom column added" });
    },
    onError: () => toast({ title: "Failed to add custom column", variant: "destructive" }),
  });

  const updateCustomColMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.updateCustomCol(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-custom-cols"] });
      setEditingCustomId(null);
      setEditingCustomName("");
      toast({ title: "Column updated" });
    },
    onError: () => toast({ title: "Failed to update column", variant: "destructive" }),
  });

  const deleteCustomColMutation = useMutation({
    mutationFn: (id: number) => api.deleteCustomCol(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-custom-cols"] });
      toast({ title: "Column deleted" });
    },
    onError: () => toast({ title: "Failed to delete column", variant: "destructive" }),
  });

  const gridRows = useMemo<LeadGridRow[]>(() => {
    return rawLeads
      .filter((lead) => withinTimeFilter(lead.createdAt, timeFilter))
      .map((lead) => {
        const row: LeadGridRow = { ...lead };

        for (const key of MULTI_VALUE_COLS) {
          row[key] = getLeadMultiValues(lead, key).join(", ");
        }

        customColRecords.forEach((column) => {
          row[`custom_${column.fieldKey}`] = lead.customData?.[column.fieldKey] ?? "";
        });

        return row;
      });
  }, [customColRecords, rawLeads, timeFilter]);

  const handleInlineEdit = (row: LeadGridRow, key: keyof LeadGridRow, value: string) => {
    const keyName = String(key);
    const column = allColumns.find((item) => item.key === keyName);
    if (!column) return;

    if (column.isCustom && column.fieldKey) {
      const parsed = column.colType === "number" ? Number(value || 0) : value;
      patchMutation.mutate({
        id: row.id,
        data: { customData: { [column.fieldKey]: parsed } } as Partial<LeadRecord>,
      });
      return;
    }

    if (MULTI_VALUE_COLS.has(keyName)) {
      const parsed = parseListValue(keyName, value);
      if ("error" in parsed) {
        toast({ title: parsed.error, variant: "destructive" });
        return;
      }

      patchMutation.mutate({
        id: row.id,
        data: {
          [keyName]: parsed.values[0] ?? null,
          multiValues: { [keyName]: parsed.values },
        } as Partial<LeadRecord>,
      });
      return;
    }

    if (keyName === "leadValue") {
      patchMutation.mutate({
        id: row.id,
        data: { leadValue: Number(value || 0) },
      });
      return;
    }

    if (keyName === "status") {
      const normalized = value.trim().toLowerCase();
      if (!STATUS_OPTIONS.includes(normalized as (typeof STATUS_OPTIONS)[number])) {
        toast({ title: "Status must be pending, contacted, or paid", variant: "destructive" });
        return;
      }

      patchMutation.mutate({
        id: row.id,
        data: { status: normalized },
      });
      return;
    }

    patchMutation.mutate({
      id: row.id,
      data: { [keyName]: keyName === "contact" ? formatPhoneNumber(value) : value } as Partial<LeadRecord>,
    });
  };

  const handleAddInline = (data: Record<string, string>) => {
    const payload: Partial<LeadRecord> = {
      status: data.status?.trim().toLowerCase() || "pending",
      leadValue: Number(data.leadValue || 0),
      customData: {},
      multiValues: {},
    };

    for (const column of allColumns) {
      const raw = (data[column.key] ?? "").trim();
      if (!raw) continue;

      if (column.isCustom && column.fieldKey) {
        (payload.customData as Record<string, string | number | null>)[column.fieldKey] =
          column.colType === "number" ? Number(raw || 0) : raw;
        continue;
      }

      if (MULTI_VALUE_COLS.has(column.key)) {
        const parsed = parseListValue(column.key, raw);
        if ("error" in parsed) {
          toast({ title: parsed.error, variant: "destructive" });
          return;
        }

        (payload as Record<string, unknown>)[column.key] = parsed.values[0] ?? null;
        (payload.multiValues as Record<string, string[]>)[column.key] = parsed.values;
        continue;
      }

      (payload as Record<string, unknown>)[column.key] = column.key === "leadValue" ? Number(raw || 0) : raw;
    }

    createMutation.mutate(payload);
  };

  const handleDelete = (row: LeadGridRow) => {
    deleteMutation.mutate(row.id);
  };

  const columns = useMemo<Column<LeadGridRow>[]>(() => {
    return visibleColumns.map((column) => {
      if (column.key === "followUp") {
        return {
          key: column.key,
          header: column.label,
          inputType: "date",
          render: (row) => formatDate(row.followUp),
        };
      }

      if (column.key === "leadValue") {
        return {
          key: column.key,
          header: column.label,
          inputType: "number",
          render: (row) => formatCurrency(Number(row.leadValue || 0)),
        };
      }

      if (column.key === "status") {
        return {
          key: column.key,
          header: column.label,
          render: (row) => <StatusBadge status={String(row.status || "pending")} />,
        };
      }

      return {
        key: column.key,
        header: column.label,
        inputType: column.inputType,
      };
    });
  }, [visibleColumns]);

  const toggleColumn = (key: string) => {
    const next = new Set(hiddenColumns);
    if (next.has(key)) {
      next.delete(key);
    } else {
      if (visibleColumns.length <= 1) return;
      next.add(key);
    }
    setHiddenColumns(next);
    savePrefs(next, columnOrder);
  };

  const totalLeadValue = gridRows.reduce((sum, row) => sum + Number(row.leadValue || 0), 0);

  return (
    <>
      <div className="space-y-4 px-[10px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Total lead value: <span className="font-semibold text-foreground">{formatCurrency(totalLeadValue)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <Columns className="h-4 w-4" /> Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Show / Hide</p>
                <div className="space-y-1">
                  {orderedColumns.map((column) => (
                    <div key={column.key} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/50">
                      <span className="text-sm font-medium">{column.label}</span>
                      <Switch checked={!hiddenColumns.has(column.key)} onCheckedChange={() => toggleColumn(column.key)} />
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => setManageOpen(true)}>
              <Settings2 className="h-4 w-4" /> Manage Custom Columns
            </Button>

            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
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
          </div>
        </div>

        <div className="h-[calc(100vh-14rem)]">
          <DataGrid
            title="Global Leads Database"
            data={gridRows}
            columns={columns}
            keyExtractor={(row) => row.id}
            isLoading={isLoading}
            onEdit={handleInlineEdit}
            onDelete={handleDelete}
            onSearch={setSearch}
            searchPlaceholder="Search leads..."
            onAddInline={handleAddInline}
            addRowDefaults={{ status: "pending", leadValue: "0" }}
          />
        </div>
      </div>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Manage Custom Columns</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <p className="mb-3 text-sm font-medium">Add Custom Column</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto]">
                <Input
                  placeholder="Column name"
                  value={newCustomName}
                  onChange={(event) => setNewCustomName(event.target.value)}
                />
                <Select value={newCustomType} onValueChange={(value: string) => setNewCustomType(value as ColType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    const name = newCustomName.trim();
                    if (!name) {
                      toast({ title: "Column name is required", variant: "destructive" });
                      return;
                    }
                    createCustomColMutation.mutate({ name, type: newCustomType });
                  }}
                  disabled={createCustomColMutation.isPending}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {customColRecords.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No custom columns yet.
                </div>
              ) : (
                customColRecords.map((column) => (
                  <div key={column.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    {editingCustomId === column.id ? (
                      <>
                        <Input
                          value={editingCustomName}
                          onChange={(event) => setEditingCustomName(event.target.value)}
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            const name = editingCustomName.trim();
                            if (!name) {
                              toast({ title: "Column name is required", variant: "destructive" });
                              return;
                            }
                            updateCustomColMutation.mutate({ id: column.id, name });
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingCustomId(null);
                            setEditingCustomName("");
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{column.name}</p>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{column.type}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingCustomId(column.id);
                            setEditingCustomName(column.name);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteCustomColMutation.mutate(column.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
