import { useState } from "react";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  getListUsersQueryKey,
  User,
} from "@workspace/api-client-react";
import { DataGrid, Column } from "@/components/ui/data-grid";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, User as UserIcon, Pencil, Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

/* ── schemas ─────────────────────────────────────────── */
const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["user", "admin"]).default("user"),
});

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required"),
  role: z.enum(["user", "admin"]),
  isActive: z.enum(["true", "false"]),
  password: z.string().optional(),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

/* ── component ───────────────────────────────────────── */
export default function Users() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryKey = getListUsersQueryKey();
  const { data: users = [], isLoading } = useListUsers({ query: { queryKey } });

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  /* create form */
  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", email: "", password: "", role: "user" },
  });

  /* edit form */
  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", email: "", role: "user", isActive: "true", password: "" },
  });

  /* ── handlers ── */
  const openEdit = (user: User) => {
    setEditUser(user);
    editForm.reset({
      name: user.name,
      email: user.email,
      role: user.role as "user" | "admin",
      isActive: user.isActive ? "true" : "false",
      password: "",
    });
  };

  const onSubmitCreate = (values: CreateValues) => {
    createUser.mutate({ data: values as any }, {
      onSuccess: (created) => {
        queryClient.setQueryData(queryKey, (old: User[]) =>
          old ? [...old, created] : [created]
        );
        setIsCreateOpen(false);
        createForm.reset();
        toast({ title: "User created", description: `${created.name} has been added.` });
      },
      onError: (err: any) => {
        const msg = err?.data?.error || "Failed to create user.";
        toast({ title: "Error", description: msg, variant: "destructive" });
      },
    });
  };

  const onSubmitEdit = (values: EditValues) => {
    if (!editUser) return;
    const payload: Record<string, unknown> = {
      name: values.name,
      email: values.email,
      role: values.role,
      isActive: values.isActive === "true",
    };
    if (values.password && values.password.length >= 6) {
      payload.password = values.password;
    }
    updateUser.mutate({ id: editUser.id, data: payload as any }, {
      onSuccess: (updated) => {
        queryClient.setQueryData(queryKey, (old: User[]) =>
          old?.map(u => u.id === updated.id ? updated : u)
        );
        setEditUser(null);
        toast({ title: "Saved", description: `${updated.name} updated.` });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update user.", variant: "destructive" });
      },
    });
  };

  const handleDelete = (row: User) => {
    deleteUser.mutate({ id: row.id }, {
      onSuccess: () => {
        queryClient.setQueryData(queryKey, (old: User[]) =>
          old?.filter(u => u.id !== row.id)
        );
        toast({ title: "Deleted", description: "User removed." });
      },
    });
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<User>[] = [
    {
      key: "name", header: "Name",
      render: (r) => (
        <div className="flex items-center gap-2 font-medium">
          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
            {r.name.charAt(0).toUpperCase()}
          </div>
          {r.name}
        </div>
      ),
    },
    { key: "email", header: "Email" },
    {
      key: "role", header: "Role",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {r.role === "admin"
            ? <Shield className="w-3.5 h-3.5 text-indigo-500" />
            : <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className="capitalize">{r.role}</span>
        </div>
      ),
    },
    {
      key: "isActive", header: "Status",
      render: (r) => (
        <Badge
          variant={r.isActive ? "default" : "secondary"}
          className={r.isActive ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
        >
          {r.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "createdAt", header: "Joined", editable: false,
      render: (r) => new Date(r.createdAt).toLocaleDateString(),
    },
    {
      key: "id" as any, header: "", editable: false, sortable: false,
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); openEdit(r); }}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
      ),
    },
  ];

  return (
    <div className="h-[calc(100vh-8rem)]">
      <DataGrid
        title="Team Members"
        data={filtered}
        columns={columns}
        keyExtractor={r => r.id}
        isLoading={isLoading}
        onDelete={handleDelete}
        onSearch={setSearch}
        searchPlaceholder="Search users..."
        onAdd={() => setIsCreateOpen(true)}
      />

      {/* ── Create User Dialog ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add New User
            </DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onSubmitCreate)} className="space-y-4 pt-2">
              <FormField control={createForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Sarah Khan" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={createForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input placeholder="sarah@company.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={createForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl><Input type="password" placeholder="Min 6 characters" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={createForm.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createUser.isPending}>
                  {createUser.isPending ? "Creating…" : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ── */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Edit User — {editUser?.name}
            </DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4 pt-2">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="isActive" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password <span className="text-muted-foreground font-normal">(leave blank to keep current)</span></FormLabel>
                  <FormControl><Input type="password" placeholder="Min 6 characters" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
                <Button type="submit" disabled={updateUser.isPending}>
                  {updateUser.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
