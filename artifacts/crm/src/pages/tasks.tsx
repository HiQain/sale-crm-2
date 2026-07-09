import { useState } from "react";
import { 
  useListTasks, useCreateTask, useUpdateTask, useDeleteTask,
  getListTasksQueryKey, Task, TaskInput
} from "@workspace/api-client-react";
import { DataGrid, Column } from "@/components/ui/data-grid";
import { StatusBadge } from "@/components/ui/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Tasks() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const queryKey = getListTasksQueryKey();
  const { data: tasks = [], isLoading } = useListTasks(undefined, { query: { queryKey } });

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const handleEdit = (row: Task, key: keyof Task, value: string) => {
    updateTask.mutate({ id: row.id, data: { [key]: value } }, {
      onSuccess: (updated) => qc.setQueryData(queryKey, (old: Task[]) => old?.map(t => t.id === updated.id ? updated : t)),
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    });
  };

  const handleDelete = (row: Task) => {
    deleteTask.mutate({ id: row.id }, {
      onSuccess: () => {
        qc.setQueryData(queryKey, (old: Task[]) => old?.filter(t => t.id !== row.id));
        toast({ title: "Task deleted" });
      },
    });
  };

  const handleAddInline = (data: Record<string, string>) => {
    const payload: TaskInput = {
      title:    data.title || "New Task",
      status:   (data.status as any) || "todo",
      priority: (data.priority as any) || "medium",
      dueDate:  data.dueDate || undefined,
    };
    createTask.mutate({ data: payload }, {
      onSuccess: (newTask) => {
        qc.setQueryData(queryKey, (old: Task[]) => old ? [...old, newTask] : [newTask]);
        toast({ title: "Task added" });
      },
      onError: () => toast({ title: "Failed to add task", variant: "destructive" }),
    });
  };

  const filtered = tasks.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(search.toLowerCase()))
  );

  const columns: Column<Task>[] = [
    { key: "title",    header: "Task",     width: "w-1/3" },
    { key: "status",   header: "Status",   render: (r) => <StatusBadge status={r.status} type="task" /> },
    { key: "priority", header: "Priority", render: (r) => <StatusBadge status={r.priority} type="priority" /> },
    {
      key: "dueDate", header: "Due Date", inputType: "date",
      render: (r) => {
        if (!r.dueDate) return "-";
        const date = new Date(r.dueDate);
        const isOverdue = date < new Date() && r.status !== "done" && r.status !== "cancelled";
        return <span className={isOverdue ? "text-destructive font-medium" : ""}>{date.toLocaleDateString()}</span>;
      },
    },
    { key: "contactName", header: "Related Contact", editable: false },
    { key: "dealTitle",   header: "Related Deal",    editable: false },
    { key: "assigneeName",header: "Assignee",        editable: false },
  ];

  return (
    <div className="h-[calc(100vh-8rem)]">
      <DataGrid
        title="Tasks"
        data={filtered}
        columns={columns}
        keyExtractor={r => r.id}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSearch={setSearch}
        searchPlaceholder="Filter tasks..."
        onAddInline={handleAddInline}
        addRowDefaults={{ status: "todo", priority: "medium" }}
      />
    </div>
  );
}
