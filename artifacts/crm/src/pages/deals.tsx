import { useState } from "react";
import { 
  useListDeals, useCreateDeal, useUpdateDeal, useDeleteDeal,
  getListDealsQueryKey, Deal, DealStage, DealInput
} from "@workspace/api-client-react";
import { DataGrid, Column } from "@/components/ui/data-grid";
import { StatusBadge } from "@/components/ui/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import { DollarSign, LayoutList, Table as TableIcon, Loader2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const STAGES: DealStage[] = ["prospecting","qualification","proposal","negotiation","closed_won","closed_lost"];
const STAGE_NAMES: Record<string, string> = {
  prospecting: "Prospecting", qualification: "Qualification", proposal: "Proposal",
  negotiation: "Negotiation", closed_won: "Closed Won", closed_lost: "Closed Lost",
};

const KanbanBoard = ({ deals, onStageChange }: { deals: Deal[], onStageChange: (id: number, stage: DealStage) => void }) => (
  <div className="flex gap-4 h-full overflow-x-auto pb-4 pt-2 px-2">
    {STAGES.map(stage => (
      <div key={stage} className="min-w-[280px] w-[280px] flex flex-col bg-muted/30 rounded-xl border border-border shadow-sm">
        <div className="p-3 border-b border-border flex items-center justify-between bg-card rounded-t-xl">
          <h3 className="font-semibold text-sm">{STAGE_NAMES[stage]}</h3>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{deals.filter(d => d.stage === stage).length}</span>
        </div>
        <div className="flex-1 p-2 flex flex-col gap-2 overflow-y-auto min-h-[200px]">
          {deals.filter(d => d.stage === stage).map(deal => (
            <div key={deal.id} className="bg-card p-3 rounded-lg shadow-sm border border-border hover:border-primary/50 transition-colors cursor-grab active:cursor-grabbing">
              <div className="font-medium text-sm mb-1">{deal.title}</div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground truncate mr-2">{deal.companyName || deal.contactName || "No contact"}</span>
                <span className="font-semibold text-green-600 dark:text-green-400 shrink-0">${deal.value?.toLocaleString() || "0"}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="bg-primary h-full" style={{ width: `${deal.probability || 0}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">{deal.probability || 0}%</span>
              </div>
            </div>
          ))}
          {deals.filter(d => d.stage === stage).length === 0 && (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground/50 border-2 border-dashed border-border/50 rounded-lg p-4">
              No deals in this stage
            </div>
          )}
        </div>
      </div>
    ))}
  </div>
);

const createSchema = z.object({
  title:       z.string().min(1, "Title is required"),
  stage:       z.enum(["prospecting","qualification","proposal","negotiation","closed_won","closed_lost"]).default("prospecting"),
  value:       z.coerce.number().optional(),
  probability: z.coerce.number().min(0).max(100).optional(),
});

export default function Deals() {
  const [search, setSearch]       = useState("");
  const [view,   setView]         = useState<"table" | "kanban">("table");
  const [isCreateOpen, setCreate] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const queryKey = getListDealsQueryKey(search ? { search } : undefined);
  const { data: deals = [], isLoading } = useListDeals(search ? { search } : undefined, { query: { queryKey } });

  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: "", stage: "prospecting", value: 0, probability: 10 },
  });

  const onSubmitCreate = (values: z.infer<typeof createSchema>) => {
    createDeal.mutate({ data: values as DealInput }, {
      onSuccess: (newDeal) => {
        qc.setQueryData(queryKey, (old: Deal[]) => old ? [newDeal, ...old] : [newDeal]);
        setCreate(false);
        form.reset();
        toast({ title: "Deal created" });
      },
    });
  };

  const handleEdit = (row: Deal, key: keyof Deal, value: string) => {
    let v: any = value;
    if (key === "value" || key === "probability") v = value ? Number(value) : null;
    updateDeal.mutate({ id: row.id, data: { [key]: v } }, {
      onSuccess: (updated) => qc.setQueryData(queryKey, (old: Deal[]) => old?.map(d => d.id === updated.id ? updated : d)),
    });
  };

  const handleDelete = (row: Deal) => {
    deleteDeal.mutate({ id: row.id }, {
      onSuccess: () => {
        qc.setQueryData(queryKey, (old: Deal[]) => old?.filter(d => d.id !== row.id));
        toast({ title: "Deal deleted" });
      },
    });
  };

  const handleAddInline = (data: Record<string, string>) => {
    const payload: DealInput = {
      title:       data.title || "New Deal",
      stage:       (data.stage as DealStage) || "prospecting",
      value:       data.value ? Number(data.value) : 0,
      probability: data.probability ? Number(data.probability) : 10,
    };
    createDeal.mutate({ data: payload }, {
      onSuccess: (newDeal) => {
        qc.setQueryData(queryKey, (old: Deal[]) => old ? [...old, newDeal] : [newDeal]);
        toast({ title: "Deal added" });
      },
      onError: () => toast({ title: "Failed to add deal", variant: "destructive" }),
    });
  };

  const handleStageChange = (id: number, stage: DealStage) => {
    updateDeal.mutate({ id, data: { stage } }, {
      onSuccess: (updated) => qc.setQueryData(queryKey, (old: Deal[]) => old?.map(d => d.id === updated.id ? updated : d)),
    });
  };

  const columns: Column<Deal>[] = [
    { key: "title",    header: "Deal Name" },
    { key: "stage",    header: "Stage",       render: (r) => <StatusBadge status={r.stage} type="deal" /> },
    { key: "value",    header: "Amount",      inputType: "number", render: (r) => <span className="font-medium text-green-600 dark:text-green-400">${r.value?.toLocaleString() || "0"}</span> },
    { key: "probability", header: "Probability", inputType: "number", render: (r) => <span>{r.probability}%</span> },
    { key: "companyName", header: "Company",  editable: false },
    { key: "contactName", header: "Contact",  editable: false },
    { key: "expectedCloseDate", header: "Close Date", inputType: "date", render: (r) => r.expectedCloseDate ? new Date(r.expectedCloseDate).toLocaleDateString() : "-" },
    { key: "ownerName",  header: "Owner",     editable: false },
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Deals Pipeline</h1>
        <div className="flex items-center gap-4">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "table" | "kanban")}>
            <ToggleGroupItem value="table"><TableIcon className="w-4 h-4 mr-2" />Table</ToggleGroupItem>
            <ToggleGroupItem value="kanban"><LayoutList className="w-4 h-4 mr-2" />Kanban</ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={() => setCreate(true)} className="h-9">New Deal</Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        {view === "table" ? (
          <DataGrid
            data={deals}
            columns={columns}
            keyExtractor={r => r.id}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSearch={setSearch}
            searchPlaceholder="Search deals..."
            onAdd={() => setCreate(true)}
            onAddInline={handleAddInline}
            addRowDefaults={{ stage: "prospecting", probability: "10" }}
          />
        ) : (
          <KanbanBoard deals={deals} onStageChange={handleStageChange} />
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setCreate}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Add New Deal</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-4 pt-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Deal Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="stage" render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {STAGES.map(s => <SelectItem key={s} value={s}>{STAGE_NAMES[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="value" render={({ field }) => (
                  <FormItem><FormLabel>Amount ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="probability" render={({ field }) => (
                  <FormItem><FormLabel>Probability (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setCreate(false)}>Cancel</Button>
                <Button type="submit" disabled={createDeal.isPending}>
                  {createDeal.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Create Deal
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
