import { useGetDashboardStats, useGetPipelineSummary, useGetRecentActivities, useGetTasksDue, getGetDashboardStatsQueryKey, getGetPipelineSummaryQueryKey, getGetRecentActivitiesQueryKey, getGetTasksDueQueryKey } from "@workspace/api-client-react";
import { Users, Building2, Target, CheckSquare, TrendingUp, DollarSign, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const XAxisComponent = XAxis as any;
  const YAxisComponent = YAxis as any;
  const TooltipComponent = Tooltip as any;
  const BarComponent = Bar as any;
  const CellComponent = Cell as any;

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() }});
  const { data: pipeline = [], isLoading: pipelineLoading } = useGetPipelineSummary({ query: { queryKey: getGetPipelineSummaryQueryKey() }});
  const { data: activities = [], isLoading: actLoading } = useGetRecentActivities({ query: { queryKey: getGetRecentActivitiesQueryKey() }});
  const { data: tasks = [], isLoading: tasksLoading } = useGetTasksDue({ query: { queryKey: getGetTasksDueQueryKey() }});

  const statCards = [
    { label: "Total Revenue", value: `$${(stats?.closedWonValue || 0).toLocaleString()}`, icon: DollarSign, trend: "+12.5%", color: "text-green-500" },
    { label: "Open Deals Pipeline", value: `$${(stats?.totalDealValue || 0).toLocaleString()}`, icon: TrendingUp, trend: `${stats?.openDeals} deals`, color: "text-blue-500" },
    { label: "Total Contacts", value: stats?.totalContacts?.toLocaleString() || "0", icon: Users, trend: `+${stats?.recentContacts} this week`, color: "text-indigo-500" },
    { label: "Total Companies", value: stats?.totalCompanies?.toLocaleString() || "0", icon: Building2, trend: "", color: "text-purple-500" },
  ];

  // Pipeline Chart configuration
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold mb-1 capitalize">{label.replace('_', ' ')}</p>
          <p className="text-sm text-primary font-medium">Value: ${payload[0].value.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Deals: {payload[0].payload.count}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-card border border-border rounded-xl p-6 shadow-sm hover-elevate transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg bg-muted/50 ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {card.trend && (
                  <span className="text-xs font-medium bg-muted px-2 py-1 rounded-full text-muted-foreground">
                    {card.trend}
                  </span>
                )}
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-1">{card.value}</h3>
              <p className="text-sm text-muted-foreground font-medium">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> Pipeline Value by Stage
          </h2>
          <div className="h-[300px] w-full">
            {pipeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipeline} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <XAxisComponent 
                    dataKey="stage" 
                    tickFormatter={(v: string) => v.replace('_', ' ')} 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxisComponent 
                    tickFormatter={(v: number) => `$${v/1000}k`} 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <TooltipComponent content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.5)' }} />
                  <BarComponent dataKey="totalValue" radius={[4, 4, 0, 0]}>
                    {pipeline.map((_, index) => (
                      <CellComponent key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                    ))}
                  </BarComponent>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">No pipeline data</div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-orange-500" /> Upcoming Tasks
          </h2>
          <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-4">
            {tasks.length > 0 ? tasks.map(task => (
              <div key={task.id} className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/20 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-medium text-sm line-clamp-2">{task.title}</span>
                  <StatusBadge status={task.priority} type="priority" />
                </div>
                <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
                  <span>{task.contactName || task.dealTitle || "General"}</span>
                  <span className={task.dueDate && new Date(task.dueDate) < new Date() ? "text-destructive font-medium" : ""}>
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date"}
                  </span>
                </div>
              </div>
            )) : (
              <div className="text-center text-muted-foreground text-sm my-auto">No upcoming tasks</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-500" /> Recent Activities
        </h2>
        <div className="flex flex-col">
          {activities.length > 0 ? activities.map((activity, i) => (
            <div key={activity.id} className="flex gap-4 py-4 border-b border-border last:border-0 relative">
              {i !== activities.length - 1 && (
                <div className="absolute left-[15px] top-[40px] bottom-[-16px] w-[2px] bg-border z-0"></div>
              )}
              <div className="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center flex-shrink-0 z-10 text-xs">
                {activity.type === 'call' && "📞"}
                {activity.type === 'email' && "✉️"}
                {activity.type === 'meeting' && "📅"}
                {activity.type === 'note' && "📝"}
                {activity.type === 'task' && "✅"}
              </div>
              <div className="flex-1 pb-1">
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-sm font-medium">
                    <span className="font-semibold">{activity.userName}</span> {activity.title}
                  </p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                    {activity.occurredAt ? formatDistanceToNow(new Date(activity.occurredAt), { addSuffix: true }) : ""}
                  </span>
                </div>
                {activity.description && (
                  <p className="text-sm text-muted-foreground mt-1 bg-muted/30 p-2 rounded border border-border/50">
                    {activity.description}
                  </p>
                )}
                <div className="flex gap-3 mt-2 text-xs text-primary/80 font-medium">
                  {activity.contactName && <span>👤 {activity.contactName}</span>}
                  {activity.dealTitle && <span>🎯 {activity.dealTitle}</span>}
                  {activity.companyName && <span>🏢 {activity.companyName}</span>}
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center text-muted-foreground text-sm py-8">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  );
}
