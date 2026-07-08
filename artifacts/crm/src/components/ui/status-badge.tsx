import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status, type = "contact" }: { status: string, type?: "contact" | "deal" | "task" | "priority" }) {
  let colorClass = "bg-muted text-muted-foreground";

  if (type === "contact") {
    switch (status) {
      case "lead": colorClass = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"; break;
      case "prospect": colorClass = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"; break;
      case "customer": colorClass = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"; break;
      case "churned": colorClass = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"; break;
      case "inactive": colorClass = "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"; break;
    }
  } else if (type === "deal") {
    switch (status) {
      case "prospecting": colorClass = "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"; break;
      case "qualification": colorClass = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"; break;
      case "proposal": colorClass = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"; break;
      case "negotiation": colorClass = "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"; break;
      case "closed_won": colorClass = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"; break;
      case "closed_lost": colorClass = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"; break;
    }
  } else if (type === "task") {
    switch (status) {
      case "todo": colorClass = "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"; break;
      case "in_progress": colorClass = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"; break;
      case "done": colorClass = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"; break;
      case "cancelled": colorClass = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"; break;
    }
  } else if (type === "priority") {
    switch (status) {
      case "low": colorClass = "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"; break;
      case "medium": colorClass = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"; break;
      case "high": colorClass = "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"; break;
      case "urgent": colorClass = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"; break;
    }
  }

  const displayStatus = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <Badge variant="outline" className={`${colorClass} font-medium border-none shadow-none`}>
      {displayStatus}
    </Badge>
  );
}