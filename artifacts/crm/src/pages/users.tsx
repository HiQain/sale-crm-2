import { useState } from "react";
import { 
  useListUsers, 
  useCreateUser, 
  useUpdateUser, 
  useDeleteUser, 
  getListUsersQueryKey, 
  User
} from "@workspace/api-client-react";
import { DataGrid, Column } from "@/components/ui/data-grid";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, User as UserIcon } from "lucide-react";

export default function Users() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  
  const queryKey = getListUsersQueryKey();
  const { data: users = [], isLoading } = useListUsers({ query: { queryKey } });
  
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const handleEdit = (row: User, key: keyof User, value: string) => {
    updateUser.mutate({ id: row.id, data: { [key]: value } }, {
      onSuccess: (updated) => {
         queryClient.setQueryData(queryKey, (old: User[]) =>
           old?.map(u => u.id === updated.id ? updated : u)
         );
      }
    });
  };

  const handleDelete = (row: User) => {
    deleteUser.mutate({ id: row.id }, {
      onSuccess: () => {
         queryClient.setQueryData(queryKey, (old: User[]) =>
           old?.filter(u => u.id !== row.id)
         );
      }
    });
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<User>[] = [
    { 
      key: "name", 
      header: "Name",
      render: (r) => (
        <div className="flex items-center gap-2 font-medium">
          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">
            {r.name.charAt(0).toUpperCase()}
          </div>
          {r.name}
        </div>
      )
    },
    { key: "email", header: "Email Address" },
    { 
      key: "role", 
      header: "Role",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {r.role === "admin" ? <Shield className="w-3.5 h-3.5 text-indigo-500" /> : <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className="capitalize">{r.role}</span>
        </div>
      )
    },
    { 
      key: "isActive", 
      header: "Status",
      render: (r) => (
        <Badge variant={r.isActive ? "default" : "secondary"} className={r.isActive ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
          {r.isActive ? "Active" : "Inactive"}
        </Badge>
      )
    },
    { 
      key: "createdAt", 
      header: "Joined Date", 
      editable: false,
      render: (r) => new Date(r.createdAt).toLocaleDateString()
    },
  ];

  return (
    <div className="h-[calc(100vh-8rem)]">
      <DataGrid
        title="Team Members"
        data={filteredUsers}
        columns={columns}
        keyExtractor={r => r.id}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSearch={setSearch}
        searchPlaceholder="Search users..."
        onAdd={() => {}}
      />
    </div>
  );
}
