import { ReactNode, useState, useEffect, useRef } from "react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, ArrowUpDown, ChevronDown, ChevronUp, Search, Plus, Trash2, X } from "lucide-react";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  editable?: boolean;
  sortable?: boolean;
  width?: string;
  inputType?: "text" | "number" | "date";  // hint for inline add row
  onEdit?: (row: T, newValue: string) => void;
}

interface DataGridProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  onEdit?: (row: T, key: keyof T, value: string) => void;
  onDelete?: (row: T) => void;
  onAdd?: () => void;
  onAddInline?: (data: Record<string, string>) => void;
  addRowDefaults?: Record<string, string>;
  isLoading?: boolean;
  searchPlaceholder?: string;
  onSearch?: (term: string) => void;
  title?: string;
  emptyMessage?: string;
}

export function DataGrid<T>({ 
  data, columns, keyExtractor, onRowClick, onEdit, onDelete, onAdd, onAddInline,
  addRowDefaults = {},
  isLoading, searchPlaceholder = "Search...", onSearch, title,
  emptyMessage = "No data found."
}: DataGridProps<T>) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string | number>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: "asc" | "desc" } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowKey: string | number, colKey: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showNewRow, setShowNewRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>(addRowDefaults);
  const editInputRef = useRef<HTMLInputElement>(null);
  const firstNewInputRef = useRef<HTMLInputElement>(null);

  // Editable columns for inline add row
  const editableCols = columns.filter(c => c.editable !== false && c.header !== "");

  const toggleSelectAll = () => {
    setSelectedKeys(data.length > 0 && selectedKeys.size === data.length ? new Set() : new Set(data.map(keyExtractor)));
  };

  const toggleSelectRow = (key: string | number) => {
    const next = new Set(selectedKeys);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelectedKeys(next);
  };

  const handleSort = (key: string) => {
    setSortConfig(prev =>
      prev?.key === key && prev.direction === "asc"
        ? { key, direction: "desc" }
        : { key, direction: "asc" }
    );
  };

  const sortedData = [...data].sort((a: any, b: any) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
    if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
    return 0;
  });

  const startEdit = (row: T, colKey: string, value: any) => {
    setEditingCell({ rowKey: keyExtractor(row), colKey });
    setEditValue(value ? String(value) : "");
  };

  const commitEdit = (row: T, colKey: string) => {
    if (onEdit && editValue !== String((row as any)[colKey] || "")) {
      onEdit(row, colKey as keyof T, editValue);
    }
    setEditingCell(null);
  };

  useEffect(() => {
    if (editingCell && editInputRef.current) editInputRef.current.focus();
  }, [editingCell]);

  useEffect(() => {
    if (showNewRow) {
      setNewRowData(addRowDefaults);
      setTimeout(() => firstNewInputRef.current?.focus(), 0);
    }
  }, [showNewRow]);

  const commitNewRow = () => {
    if (onAddInline) {
      onAddInline(newRowData);
      setShowNewRow(false);
      setNewRowData(addRowDefaults);
    }
  };

  const handleNewRowKey = (e: React.KeyboardEvent, colIdx: number) => {
    e.stopPropagation();
    if (e.key === "Escape") { setShowNewRow(false); return; }
    if (e.key === "Enter") {
      if (colIdx === editableCols.length - 1) commitNewRow();
    }
    if (e.key === "Tab" && colIdx === editableCols.length - 1 && !e.shiftKey) {
      e.preventDefault();
      commitNewRow();
    }
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-4">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {onSearch && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={searchPlaceholder} className="pl-9 h-9 w-64 bg-background"
                onChange={(e) => onSearch(e.target.value)} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedKeys.size > 0 && (
            <Button variant="destructive" size="sm" className="h-9">
              <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedKeys.size})
            </Button>
          )}
          {onAdd && (
            <Button onClick={onAdd} size="sm" className="h-9 bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> New Record
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="w-12 px-4">
                <Checkbox checked={data.length > 0 && selectedKeys.size === data.length}
                  onCheckedChange={toggleSelectAll} />
              </TableHead>
              {columns.map(col => (
                <TableHead key={col.key as string}
                  className={`px-4 py-3 h-10 font-medium text-xs text-muted-foreground uppercase tracking-wider ${col.width || ""}`}
                  onClick={() => col.sortable !== false && handleSort(col.key as string)}>
                  <div className={`flex items-center gap-1 ${col.sortable !== false ? "cursor-pointer hover:text-foreground" : ""}`}>
                    {col.header}
                    {col.sortable !== false && (
                      <span className="text-muted-foreground/50">
                        {sortConfig?.key === col.key
                          ? sortConfig.direction === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-12 text-right px-4" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 2} className="h-24 text-center text-muted-foreground">Loading data...</TableCell>
              </TableRow>
            ) : sortedData.length === 0 && !showNewRow ? (
              <TableRow>
                <TableCell colSpan={columns.length + 2} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <p>{emptyMessage}</p>
                    {onAdd && <Button variant="outline" size="sm" className="mt-4" onClick={onAdd}>Add New</Button>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {sortedData.map((row, i) => {
                  const key = keyExtractor(row);
                  const isSelected = selectedKeys.has(key);
                  return (
                    <TableRow key={key}
                      className={`group transition-colors ${isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"} ${i % 2 === 0 ? "bg-transparent" : "bg-muted/10"}`}
                      onClick={() => onRowClick?.(row)}>
                      <TableCell className="px-4 py-2">
                        <Checkbox checked={isSelected}
                          onCheckedChange={() => toggleSelectRow(key)}
                          onClick={(e) => e.stopPropagation()} />
                      </TableCell>

                      {columns.map(col => {
                        const isEditing = editingCell?.rowKey === key && editingCell?.colKey === col.key;
                        const value = (row as any)[col.key];
                        return (
                          <TableCell key={col.key as string}
                            className="px-4 py-2 border-r border-border/30 last:border-r-0 relative"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (col.editable !== false && onEdit) startEdit(row, col.key as string, value);
                            }}>
                            {isEditing ? (
                              <Input ref={editInputRef} value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => commitEdit(row, col.key as string)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitEdit(row, col.key as string);
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                                className="absolute inset-0 w-full h-full border-primary rounded-none px-4 focus-visible:ring-1 bg-background z-20"
                                onClick={(e) => e.stopPropagation()} />
                            ) : (
                              <div className="truncate">{col.render ? col.render(row) : value}</div>
                            )}
                          </TableCell>
                        );
                      })}

                      <TableCell className="px-4 py-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            {onDelete && (
                              <DropdownMenuItem className="text-destructive focus:text-destructive"
                                onClick={(e) => { e.stopPropagation(); onDelete(row); }}>
                                Delete Record
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* ── Inline new row ── */}
                {showNewRow && (
                  <TableRow className="bg-primary/5 border border-primary/20">
                    <TableCell className="px-4 py-1.5">
                      <Checkbox disabled />
                    </TableCell>
                    {columns.map((col, idx) => {
                      const isEditable = col.editable !== false && col.header !== "";
                      const editableIdx = editableCols.indexOf(col);
                      return (
                        <TableCell key={col.key as string} className="px-2 py-1 border-r border-border/30 last:border-r-0">
                          {isEditable ? (
                            <input
                              ref={editableIdx === 0 ? firstNewInputRef : undefined}
                              type={col.inputType ?? "text"}
                              placeholder={col.header}
                              value={newRowData[col.key as string] ?? ""}
                              className="w-full min-w-[60px] text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary px-1.5 py-0.5 placeholder:text-muted-foreground/50"
                              onChange={e => setNewRowData(d => ({ ...d, [col.key as string]: e.target.value }))}
                              onKeyDown={e => handleNewRowKey(e, editableIdx)}
                            />
                          ) : (
                            <span className="text-muted-foreground/40 text-xs italic">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="px-2 py-1 text-right">
                      <button className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        onClick={() => setShowNewRow(false)} title="Cancel">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
        <div className="flex items-center gap-4">
          {onAddInline && (
            <button
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
              onClick={() => setShowNewRow(true)}
              disabled={showNewRow}>
              <span className="flex items-center justify-center w-5 h-5 rounded border border-dashed border-muted-foreground/40 group-hover:border-foreground/60 transition-colors">
                <Plus className="w-3 h-3" />
              </span>
              Add row
            </button>
          )}
          {!onAddInline && (
            <span>{data.length} record{data.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>{data.length} record{data.length !== 1 ? "s" : ""}</span>
          {data.length > 0 && (
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled>Previous</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled>Next</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
