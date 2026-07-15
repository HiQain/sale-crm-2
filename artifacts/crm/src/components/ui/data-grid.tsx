import React, { useMemo, useRef, useState, type ReactNode } from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  CellClickedEvent,
  CellValueChangedEvent,
  ColDef,
  GridApi,
  ICellRendererParams,
  ValueSetterParams,
  RowClickedEvent,
} from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Plus, Trash2, X, Settings2 } from "lucide-react";

const AgGrid = AgGridReact as unknown as React.ComponentType<any>;

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  editable?: boolean;
  sortable?: boolean;
  width?: string;
  inputType?: "text" | "number" | "date";
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

interface GridColumnOption {
  id: string;
  title: string;
  visible: boolean;
  pinned: "left" | "right" | null;
}

function widthToPixels(width?: string): number {
  switch (width) {
    case "w-1/4":
      return 220;
    case "w-1/3":
      return 280;
    case "w-1/2":
      return 360;
    default:
      return 180;
  }
}

function getRawValue<T>(row: T, column: Column<T>): unknown {
  return (row as Record<string, unknown>)[String(column.key)];
}

function reactNodeToText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeToText).join(" ").trim();
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return reactNodeToText(props?.children);
  }
  return "";
}

function getDisplayText<T>(row: T, column: Column<T>): string {
  if (column.render) {
    const rendered = reactNodeToText(column.render(row));
    if (rendered) return rendered;
  }

  const raw = getRawValue(row, column);
  if (raw == null || raw === "") return "";
  if (raw instanceof Date) return raw.toLocaleDateString();
  if (typeof raw === "number") return Number.isFinite(raw) ? raw.toLocaleString() : "";
  if (typeof raw === "boolean") return raw ? "Yes" : "No";

  return String(raw);
}

function getEditableValue<T>(row: T, column: Column<T>): string {
  const raw = getRawValue(row, column);
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return getDisplayText(row, column);
}

export function DataGrid<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  onEdit,
  onDelete,
  onAdd,
  onAddInline,
  addRowDefaults = {},
  isLoading,
  searchPlaceholder = "Search...",
  onSearch,
  title,
  emptyMessage = "No data found.",
}: DataGridProps<T>) {
  const gridApiRef = useRef<GridApi<T> | null>(null);
  const [selectedRows, setSelectedRows] = useState<T[]>([]);
  const [showNewRow, setShowNewRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>(addRowDefaults);
  const [gridColumns, setGridColumns] = useState<GridColumnOption[]>([]);
  const firstNewInputRef = useRef<HTMLInputElement>(null);

  const editableColumns = useMemo(
    () => columns.filter((column) => column.editable !== false && column.header !== ""),
    [columns],
  );

  const columnDefs = useMemo<ColDef<T>[]>(() => {
    const defs: ColDef<T>[] = [
      {
        colId: "__select__",
        width: 52,
        maxWidth: 52,
        minWidth: 52,
        pinned: "left",
        editable: false,
        sortable: false,
        resizable: false,
        suppressMovable: true,
        filter: false,
        floatingFilter: false,
        checkboxSelection: true,
        headerCheckboxSelection: true,
      },
      ...columns.map((column) => {
        const colId = String(column.key);
        const renderCell = column.render;

        return {
          colId,
          field: colId as never,
          headerName: column.header || " ",
          editable: column.editable !== false && Boolean(onEdit),
          sortable: column.sortable !== false,
          resizable: true,
          singleClickEdit: column.editable !== false && Boolean(onEdit),
          width: widthToPixels(column.width),
          cellDataType: column.inputType === "number" ? "number" : column.inputType === "date" ? "text" : "text",
          valueGetter: (params) => getEditableValue(params.data as T, column),
          valueSetter: (params: ValueSetterParams<T>) => {
            if (!params.data) return false;
            (params.data as Record<string, unknown>)[colId] = params.newValue == null ? "" : params.newValue;
            return true;
          },
          cellRenderer: renderCell
            ? (params: ICellRendererParams<T>) => {
                if (!params.data) return "";
                return renderCell(params.data);
              }
            : undefined,
          onCellValueChanged: (event) => {
            if (!event.data || !onEdit || column.editable === false) return;
            const nextValue = event.newValue == null ? "" : String(event.newValue);
            onEdit(event.data, column.key as keyof T, nextValue);
          },
        } satisfies ColDef<T>;
      }),
    ];

    if (onDelete) {
      defs.push({
        colId: "__actions__",
        headerName: "",
        editable: false,
        sortable: false,
        resizable: false,
        suppressMovable: true,
        pinned: "right",
        filter: false,
        floatingFilter: false,
        width: 110,
        maxWidth: 110,
        minWidth: 110,
        cellRenderer: (params: ICellRendererParams<T>) => {
          if (!params.data) return null;

          return (
            <button
              type="button"
              className="text-sm font-medium text-destructive hover:underline"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(params.data as T);
              }}
            >
              Delete
            </button>
          );
        },
      });
    }

    return defs;
  }, [columns, onDelete, onEdit]);

  const defaultColDef = useMemo<ColDef<T>>(
    () => ({
      flex: 1,
      minWidth: 140,
      resizable: true,
      sortable: true,
      filter: true,
      floatingFilter: true,
    }),
    [],
  );

  const refreshGridColumns = (api?: GridApi<T>) => {
    const gridApi = api ?? gridApiRef.current;
    if (!gridApi) return;

    const state = new Map(
      gridApi.getColumnState().map((column) => [
        column.colId,
        { hidden: !!column.hide, pinned: (column.pinned ?? null) as "left" | "right" | null },
      ]),
    );

    const nextColumns = columns.map((column) => {
      const id = String(column.key);
      const current = state.get(id);
      return {
        id,
        title: column.header,
        visible: !(current?.hidden ?? false),
        pinned: current?.pinned ?? null,
      };
    });

    setGridColumns(nextColumns);
  };

  const commitNewRow = () => {
    if (!onAddInline) return;
    onAddInline(newRowData);
    setShowNewRow(false);
    setNewRowData(addRowDefaults);
  };

  const handleDeleteSelected = () => {
    if (!onDelete || selectedRows.length === 0) return;
    [...selectedRows].reverse().forEach((row) => onDelete(row));
    gridApiRef.current?.deselectAll();
    setSelectedRows([]);
  };

  const setColumnPinned = (columnId: string, pinned: "left" | "right" | null) => {
    gridApiRef.current?.setColumnsPinned([columnId], pinned);
    refreshGridColumns();
  };

  const toggleColumnVisibility = (columnId: string, visible: boolean) => {
    gridApiRef.current?.setColumnsVisible([columnId], visible);
    refreshGridColumns();
  };

  const autoSizeColumn = (columnId: string) => {
    gridApiRef.current?.autoSizeColumns([columnId]);
  };

  const fitColumnsToGrid = () => {
    gridApiRef.current?.sizeColumnsToFit();
  };

  const resetColumns = () => {
    gridApiRef.current?.resetColumnState();
    refreshGridColumns();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/20 p-4">
        <div className="flex items-center gap-4">
          {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
          {onSearch ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="h-9 w-64 bg-background pl-9"
                onChange={(event) => onSearch(event.target.value)}
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Settings2 className="mr-2 h-4 w-4" /> Grid
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Grid Options</DropdownMenuLabel>
              <DropdownMenuItem onSelect={fitColumnsToGrid}>Fit Columns To Grid</DropdownMenuItem>
              <DropdownMenuItem onSelect={resetColumns}>Reset Columns</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Choose Columns</DropdownMenuLabel>
              {gridColumns.map((column) => (
                <DropdownMenuSub key={column.id}>
                  <DropdownMenuSubTrigger>{column.title}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    <DropdownMenuCheckboxItem
                      checked={column.visible}
                      onCheckedChange={(checked: boolean) => toggleColumnVisibility(column.id, Boolean(checked))}
                    >
                      Visible
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setColumnPinned(column.id, "left")}>Pin Left</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setColumnPinned(column.id, "right")}>Pin Right</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setColumnPinned(column.id, null)}>Unpin</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => autoSizeColumn(column.id)}>Autosize This Column</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {selectedRows.length > 0 ? (
            <Button variant="destructive" size="sm" className="h-9" onClick={handleDeleteSelected}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({selectedRows.length})
            </Button>
          ) : null}
          {onAdd ? (
            <Button onClick={onAdd} size="sm" className="h-9">
              <Plus className="mr-2 h-4 w-4" /> New Record
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className="ag-theme-balham crm-grid h-full w-full">
          <AgGrid
            theme="legacy"
            rowData={data}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            rowHeight={30}
            headerHeight={34}
            suppressRowClickSelection
            singleClickEdit
            stopEditingWhenCellsLoseFocus
            loading={isLoading}
            overlayNoRowsTemplate={`<span class="ag-overlay-no-rows-center">${emptyMessage}</span>`}
            getRowId={(params: { data: T }) => String(keyExtractor(params.data))}
            onGridReady={(event: { api: GridApi<T> }) => {
              gridApiRef.current = event.api;
              refreshGridColumns(event.api);
            }}
            onSelectionChanged={() => {
              setSelectedRows((gridApiRef.current?.getSelectedRows() as T[]) ?? []);
            }}
            onColumnVisible={() => refreshGridColumns()}
            onColumnPinned={() => refreshGridColumns()}
            onDisplayedColumnsChanged={() => refreshGridColumns()}
            onGridColumnsChanged={() => refreshGridColumns()}
            onCellClicked={(event: CellClickedEvent<T>) => {
              if (!event.data || event.colDef.colId === "__select__" || event.colDef.colId === "__actions__") {
                return;
              }
              if (event.colDef.editable && event.rowIndex != null) {
                event.api.startEditingCell({
                  rowIndex: event.rowIndex,
                  colKey: event.column.getColId(),
                });
              }
              onRowClick?.(event.data);
            }}
            onRowClicked={(event: RowClickedEvent<T>) => {
              if (!event.data) return;
              onRowClick?.(event.data);
            }}
            onCellValueChanged={(event: CellValueChangedEvent<T>) => {
              if (event.oldValue === event.newValue) return;
            }}
          />
        </div>
      </div>

      {showNewRow ? (
        <div className="border-t border-border bg-primary/5 p-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {editableColumns.map((column, index) => (
              <input
                key={String(column.key)}
                ref={index === 0 ? firstNewInputRef : undefined}
                type={column.inputType ?? "text"}
                placeholder={column.header}
                value={newRowData[String(column.key)] ?? ""}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  setNewRowData((current) => ({
                    ...current,
                    [String(column.key)]: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setShowNewRow(false);
                  }
                  if (event.key === "Enter") {
                    commitNewRow();
                  }
                }}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowNewRow(false)}>
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button size="sm" onClick={commitNewRow}>
              Save Row
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          {onAddInline ? (
            <button
              className="flex items-center gap-1.5 text-sm transition-colors hover:text-foreground"
              onClick={() => {
                setShowNewRow(true);
                setNewRowData(addRowDefaults);
                window.setTimeout(() => firstNewInputRef.current?.focus(), 0);
              }}
              disabled={showNewRow}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded border border-dashed border-muted-foreground/40">
                <Plus className="h-3 w-3" />
              </span>
              Add row
            </button>
          ) : (
            <span>{data.length} record{data.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <span>{data.length} record{data.length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}
