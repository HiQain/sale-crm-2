import { useState } from "react";
import { 
  useListActivities, 
  getListActivitiesQueryKey, 
  Activity
} from "@workspace/api-client-react";
import { DataGrid, Column } from "@/components/ui/data-grid";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

export default function Activities() {
  const [search, setSearch] = useState("");
  
  const queryKey = getListActivitiesQueryKey();
  const { data: activities = [], isLoading } = useListActivities(undefined, { query: { queryKey } });

  const filteredActivities = activities.filter(a => 
    a.title.toLowerCase().includes(search.toLowerCase()) || 
    (a.description && a.description.toLowerCase().includes(search.toLowerCase())) ||
    (a.contactName && a.contactName.toLowerCase().includes(search.toLowerCase()))
  );

  const columns: Column<Activity>[] = [
    { 
      key: "type", 
      header: "Type",
      render: (r) => (
        <span className="capitalize font-medium text-xs bg-muted px-2 py-1 rounded">
          {r.type}
        </span>
      )
    },
    { key: "title", header: "Activity", width: "w-1/3" },
    { key: "userName", header: "User", editable: false },
    { key: "contactName", header: "Contact", editable: false },
    { key: "dealTitle", header: "Deal", editable: false },
    { 
      key: "occurredAt", 
      header: "When",
      render: (r) => r.occurredAt ? (
        <span title={new Date(r.occurredAt).toLocaleString()}>
          {formatDistanceToNow(new Date(r.occurredAt), { addSuffix: true })}
        </span>
      ) : "-"
    },
  ];

  return (
    <div className="h-[calc(100vh-8rem)]">
      <DataGrid
        title="Activity Log"
        data={filteredActivities}
        columns={columns}
        keyExtractor={r => r.id}
        isLoading={isLoading}
        onSearch={setSearch}
        searchPlaceholder="Filter activities..."
      />
    </div>
  );
}
