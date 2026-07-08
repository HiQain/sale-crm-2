import { Columns } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ColumnDef {
  key: string;
  label: string;
}

interface ColumnsToggleProps {
  columns: ColumnDef[];
  visible: Set<string>;
  onToggle: (key: string) => void;
}

export function ColumnsToggle({ columns, visible, onToggle }: ColumnsToggleProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 border-border">
          <Columns className="w-4 h-4" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Show Columns
        </p>
        <div className="space-y-1">
          {columns.map((col) => (
            <div
              key={col.key}
              className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50"
            >
              <span className="text-sm font-medium">{col.label}</span>
              <Switch
                checked={visible.has(col.key)}
                onCheckedChange={() => onToggle(col.key)}
              />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function useColumnVisibility(columns: ColumnDef[]) {
  const allKeys = columns.map((c) => c.key);
  const [visible, setVisible] = React.useState<Set<string>>(new Set(allKeys));

  const toggle = (key: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return { visible, toggle };
}

import React from "react";
