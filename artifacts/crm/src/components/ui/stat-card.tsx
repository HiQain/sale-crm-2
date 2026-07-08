import { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  iconBg?: string;
}

export function StatCard({ icon, label, value, iconBg = "bg-primary/10 text-primary" }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-4 shadow-sm">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
          {label}
        </p>
        <p className="text-xl font-bold text-foreground mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
