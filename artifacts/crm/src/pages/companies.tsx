import { useState } from "react";
import { 
  useListCompanies, 
  useCreateCompany,
  useUpdateCompany, 
  useDeleteCompany, 
  getListCompaniesQueryKey, 
  Company,
  CompanyInput
} from "@workspace/api-client-react";
import { DataGrid, Column } from "@/components/ui/data-grid";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, Users, DollarSign, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const createSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  industry: z.string().optional().or(z.literal("")),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

export default function Companies() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const queryKey = getListCompaniesQueryKey(search ? { search } : undefined);
  const { data: companies = [], isLoading } = useListCompanies(
    search ? { search } : undefined, 
    { query: { queryKey } }
  );
  
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      industry: "",
      website: "",
    },
  });

  const onSubmitCreate = (values: z.infer<typeof createSchema>) => {
    createCompany.mutate({ data: values as CompanyInput }, {
      onSuccess: (newCompany) => {
        queryClient.setQueryData(queryKey, (old: Company[]) => old ? [newCompany, ...old] : [newCompany]);
        setIsCreateOpen(false);
        form.reset();
      }
    });
  };

  const handleEdit = (row: Company, key: keyof Company, value: string) => {
    let processedValue: any = value;
    if (key === "employeeCount" || key === "annualRevenue") {
      processedValue = value ? Number(value) : null;
    }

    updateCompany.mutate({ id: row.id, data: { [key]: processedValue } }, {
      onSuccess: (updated) => {
         queryClient.setQueryData(queryKey, (old: Company[]) =>
           old?.map(c => c.id === updated.id ? updated : c)
         );
      }
    });
  };

  const handleDelete = (row: Company) => {
    deleteCompany.mutate({ id: row.id }, {
      onSuccess: () => {
         queryClient.setQueryData(queryKey, (old: Company[]) =>
           old?.filter(c => c.id !== row.id)
         );
      }
    });
  };

  const columns: Column<Company>[] = [
    { key: "name", header: "Company Name", width: "w-1/4" },
    { key: "industry", header: "Industry" },
    { 
      key: "website", 
      header: "Website", 
      render: (r) => r.website ? (
        <a href={r.website.startsWith('http') ? r.website : `https://${r.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
          <Globe className="w-3 h-3" /> {r.website.replace(/^https?:\/\//, '')}
        </a>
      ) : <span className="text-muted-foreground">-</span>
    },
    { 
      key: "employeeCount", 
      header: "Employees",
      render: (r) => r.employeeCount ? (
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-muted-foreground" /> {r.employeeCount.toLocaleString()}
        </div>
      ) : "-"
    },
    { 
      key: "annualRevenue", 
      header: "Revenue",
      render: (r) => r.annualRevenue ? (
        <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
          <DollarSign className="w-3 h-3" /> {r.annualRevenue.toLocaleString()}
        </div>
      ) : "-"
    },
    { key: "address", header: "Location" },
  ];

  return (
    <div className="h-[calc(100vh-8rem)]">
      <DataGrid
        title="Companies Directory"
        data={companies}
        columns={columns}
        keyExtractor={r => r.id}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSearch={setSearch}
        searchPlaceholder="Search companies..."
        onAdd={() => setIsCreateOpen(true)}
      />

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-4 pt-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="industry" render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="website" render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl><Input type="url" placeholder="https://" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createCompany.isPending}>
                  {createCompany.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create Company
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
