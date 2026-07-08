import { useState } from "react";
import { Bell, Phone, Mail, Users, FileText, CheckSquare, X, Clock } from "lucide-react";
import {
  useGetRecentActivities,
  useGetTasksDue,
  getGetRecentActivitiesQueryKey,
  getGetTasksDueQueryKey,
} from "@workspace/api-client-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

const activityIcon: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: FileText,
  task: CheckSquare,
};

const activityColor: Record<string, string> = {
  call: "bg-blue-100 text-blue-600",
  email: "bg-violet-100 text-violet-600",
  meeting: "bg-emerald-100 text-emerald-600",
  note: "bg-amber-100 text-amber-600",
  task: "bg-rose-100 text-rose-600",
};

const priorityColor: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

export function NotificationsPanel() {
  const [open, setOpen] = useState(false);

  const { data: recentActivities = [] } = useGetRecentActivities({
    query: { queryKey: getGetRecentActivitiesQueryKey(), enabled: open },
  });
  const { data: tasksDue = [] } = useGetTasksDue({
    query: { queryKey: getGetTasksDueQueryKey(), enabled: open },
  });

  const totalCount = recentActivities.slice(0, 5).length + tasksDue.slice(0, 3).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-card" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[380px] p-0 shadow-xl border border-border rounded-xl overflow-hidden"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Notifications</span>
            {totalCount > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-5">
                {totalCount}
              </Badge>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ScrollArea className="max-h-[420px]">
          {/* Tasks Due Section */}
          {tasksDue.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Tasks Due Soon
                </p>
              </div>
              {tasksDue.slice(0, 3).map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                >
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mt-0.5">
                    <CheckSquare className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-snug truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-xs px-1.5 py-0 h-4 font-medium border-0 ${priorityColor[task.priority] ?? priorityColor.medium}`}>
                        {task.priority}
                      </Badge>
                      {task.dueDate && (
                        <span className="text-xs text-muted-foreground">
                          Due {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Activity Section */}
          {recentActivities.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Recent Activity
                </p>
              </div>
              {recentActivities.slice(0, 5).map((activity: any) => {
                const Icon = activityIcon[activity.type] ?? FileText;
                const colorClass = activityColor[activity.type] ?? activityColor.note;
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                  >
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${colorClass}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground leading-snug truncate">{activity.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground capitalize">{activity.type}</span>
                        {activity.contactName && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground truncate">{activity.contactName}</span>
                          </>
                        )}
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.occurredAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {recentActivities.length === 0 && tasksDue.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No notifications yet</p>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border bg-muted/30">
          <p className="text-xs text-center text-muted-foreground">
            Showing recent activity and upcoming tasks
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
