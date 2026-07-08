import { useState } from "react";
import { 
  useListTasks, 
  useUpdateTask, 
  useDeleteTask, 
  getListTasksQueryKey, 
  Task
} from "@workspace/api-client-react";
import { DataGrid, Column } from "@/components/ui/data-grid";
import { StatusBadge } from "@/components/ui/status-badge";
import { useQueryClient } from "@tanstack/react-query";

export default function Tasks() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  
  // Tasks API doesn't expose a generic 'search' param in the definition, but we can do client side filter or just list all
  const queryKey = getListTasksQueryKey();
  const { data: tasks = [], isLoading } = useListTasks(undefined, { query: { queryKey } });
  
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const handleEdit = (row: Task, key: keyof Task, value: string) => {
    updateTask.mutate({ id: row.id, data: { [key]: value } }, {
      onSuccess: (updated) => {
         queryClient.setQueryData(queryKey, (old: Task[]) =>
           old?.map(t => t.id === updated.id ? updated : t)
         );
      }
    });
  };

  const handleDelete = (row: Task) => {
    deleteTask.mutate({ id: row.id }, {
      onSuccess: () => {
         queryClient.setQueryData(queryKey, (old: Task[]) =>
           old?.filter(t => t.id !== row.id)
         );
      }
    });
  };

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(search.toLowerCase()) || 
    (t.description && t.description.toLowerCase().includes(search.toLowerCase()))
  );

  const columns: Column<Task>[] = [
    { key: "title", header: "Task", width: "w-1/3" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} type="task" /> },
    { key: "priority", header: "Priority", render: (r) => <StatusBadge status={r.priority} type="priority" /> },
    { 
      key: "dueDate", 
      header: "Due Date",
      render: (r) => {
        if (!r.dueDate) return "-";
        const date = new Date(r.dueDate);
        const isOverdue = date < new Date() && r.status !== "done" && r.status !== "cancelled";
        return (
          <span className={isOverdue ? "text-destructive font-medium" : ""}>
            {date.toLocaleDateString()}
          </span>
        );
      }
    },
    { key: "contactName", header: "Related Contact", editable: false },
    { key: "dealTitle", header: "Related Deal", editable: false },
    { key: "assigneeName", header: "Assignee", editable: false },
  ];

  return (
    <div className="h-[calc(100vh-8rem)]">
      <DataGrid
        title="Tasks"
        data={filteredTasks}
        columns={columns}
        keyExtractor={r => r.id}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSearch={setSearch}
        searchPlaceholder="Filter tasks..."
        onAdd={() => {}}
      />
    </div>
  );
}
