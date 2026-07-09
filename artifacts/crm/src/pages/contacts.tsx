import { useState } from "react";
import { 
  useListContacts, useCreateContact, useUpdateContact, useDeleteContact,
  getListContactsQueryKey, Contact, ContactInput
} from "@workspace/api-client-react";
import { DataGrid, Column } from "@/components/ui/data-grid";
import { StatusBadge } from "@/components/ui/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { formatPhoneNumber, isValidPhoneNumber } from "@/lib/utils";

const createSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName:  z.string().min(1, "Last name is required"),
  email:     z.string().email("Invalid email").optional().or(z.literal("")),
  phone:     z.string().optional().or(z.literal("")).refine(isValidPhoneNumber, "Phone must be 10 digits, e.g. (201) 000-9090"),
  status:    z.enum(["lead","prospect","customer","churned","inactive"]).default("lead"),
});

export default function Contacts() {
  const [search, setSearch]       = useState("");
  const [isCreateOpen, setCreate] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast?.() || { toast: () => {} };

  const queryKey = getListContactsQueryKey(search ? { search } : undefined);
  const { data: contacts = [], isLoading } = useListContacts(search ? { search } : undefined, { query: { queryKey } });

  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", status: "lead" },
  });

  const onSubmitCreate = (values: z.infer<typeof createSchema>) => {
    createContact.mutate({ data: values as ContactInput }, {
      onSuccess: (newContact) => {
        qc.setQueryData(queryKey, (old: Contact[]) => old ? [newContact, ...old] : [newContact]);
        setCreate(false);
        form.reset();
        toast?.({ title: "Contact created" });
      },
      onError: () => toast?.({ title: "Failed to create contact", variant: "destructive" }),
    });
  };

  const handleEdit = (row: Contact, key: keyof Contact, value: string) => {
    const finalValue = key === "phone" ? formatPhoneNumber(value) : value;
    if (key === "phone" && !isValidPhoneNumber(finalValue)) {
      toast?.({ title: "Invalid phone number", description: "Use format (201) 000-9090", variant: "destructive" });
      return;
    }
    updateContact.mutate({ id: row.id, data: { [key]: finalValue } }, {
      onSuccess: (updated) => qc.setQueryData(queryKey, (old: Contact[]) => old?.map(c => c.id === updated.id ? updated : c)),
      onError: () => toast?.({ title: "Failed to update", variant: "destructive" }),
    });
  };

  const handleDelete = (row: Contact) => {
    deleteContact.mutate({ id: row.id }, {
      onSuccess: () => {
        qc.setQueryData(queryKey, (old: Contact[]) => old?.filter(c => c.id !== row.id));
        toast?.({ title: "Contact deleted" });
      },
    });
  };

  const handleAddInline = (data: Record<string, string>) => {
    const phone = data.phone ? formatPhoneNumber(data.phone) : data.phone;
    if (phone && !isValidPhoneNumber(phone)) {
      toast?.({ title: "Invalid phone number", description: "Use format (201) 000-9090", variant: "destructive" });
      return;
    }
    const payload = {
      firstName: data.firstName || "",
      lastName:  data.lastName  || "",
      email:     data.email,
      phone,
      status:    (data.status as any) || "lead",
    };
    createContact.mutate({ data: payload as ContactInput }, {
      onSuccess: (newContact) => {
        qc.setQueryData(queryKey, (old: Contact[]) => old ? [...old, newContact] : [newContact]);
        toast?.({ title: "Contact added" });
      },
      onError: () => toast?.({ title: "Failed to add contact", variant: "destructive" }),
    });
  };

  const columns: Column<Contact>[] = [
    { key: "firstName",   header: "First Name" },
    { key: "lastName",    header: "Last Name" },
    { key: "email",       header: "Email" },
    { key: "phone",       header: "Phone" },
    { key: "companyName", header: "Company",  editable: false },
    { key: "status",      header: "Status",   render: (r) => <StatusBadge status={r.status!} type="contact" /> },
    { key: "ownerName",   header: "Owner",    editable: false },
  ];

  return (
    <div className="h-[calc(100vh-8rem)]">
      <DataGrid
        title="Contacts Database"
        data={contacts}
        columns={columns}
        keyExtractor={r => r.id}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSearch={setSearch}
        searchPlaceholder="Search by name, email..."
        onAdd={() => setCreate(true)}
        onAddInline={handleAddInline}
        addRowDefaults={{ status: "lead" }}
      />

      <Dialog open={isCreateOpen} onOpenChange={setCreate}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Add New Contact</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl>
                  <Input {...field} placeholder="(201) 000-9090" onChange={e => field.onChange(formatPhoneNumber(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="churned">Churned</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setCreate(false)}>Cancel</Button>
                <Button type="submit" disabled={createContact.isPending}>
                  {createContact.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
