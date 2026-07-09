import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, DragEndEvent, PointerSensor,
  useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable,
  horizontalListSortingStrategy, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/hooks/use-toast";
import { formatPhoneNumber, isValidPhoneNumber } from "@/lib/utils";
import { StatCard, formatCurrency } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  LayoutGrid, Clock, CheckCircle2, DollarSign, TrendingUp,
  Search, Trash2, Columns, GripVertical, Plus, Pencil, Check, X, Settings2,
  Type, Hash, Calendar,
} from "lucide-react";
import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColType = "text" | "number" | "date";

interface LeadRecord {
  id: number;
  contact: string | null;
  email: string | null;
  businessOwner: string | null;
  businessName: string | null;
  service: string | null;
  response: string | null;
  followUp: string | null;
  leadValue: number;
  leadAssignee: string | null;
  status: string;
  customData: Record<string, string | number | null>;
  multiValues: Record<string, string[]>;
  createdAt: string;
}

interface LeadsStats {
  totalLeads: number; activeLeads: number; paidLeads: number;
  paidRevenue: number; totalRevenue: number;
}

interface LeadsPrefs {
  columnOrder: string[]; hiddenColumns: string[]; rowOrder: number[];
}

interface CustomColRecord {
  id: number;
  name: string;
  fieldKey: string;
  position: number;
  type: ColType;
}

interface ColumnDef {
  key: string;
  label: string;
  isCustom?: boolean;
  fieldKey?: string;
  customId?: number;
  colType?: ColType;    // "text" | "number" | "date"
  inputType?: string;   // HTML <input type="…"> override (email, tel, number, date…)
}

// ─── Built-in columns ────────────────────────────────────────────────────────

const BUILTIN_COLUMNS: ColumnDef[] = [
  { key: "contact",       label: "Contact",       inputType: "tel"    },
  { key: "email",         label: "Email",         inputType: "email"  },
  { key: "businessOwner", label: "Business Owner" },
  { key: "businessName",  label: "Business Name"  },
  { key: "service",       label: "Service"        },
  { key: "response",      label: "Response"       },
  { key: "followUp",      label: "Follow Up",     colType: "date",   inputType: "date"   },
  { key: "leadValue",     label: "Lead Value",    colType: "number", inputType: "number" },
  { key: "leadAssignee",  label: "Lead"           },
  { key: "status",        label: "Status"         },
];

const STATUS_OPTIONS = ["pending", "contacted", "paid"];

// Columns that support storing multiple values per cell
const MULTI_VALUE_COLS = new Set(["contact", "email", "businessName", "businessOwner", "service", "response"]);

/** Get all values for a multi-value column — merges multiValues array + primary column */
function getLeadMultiValues(lead: LeadRecord, colKey: string): string[] {
  const mv = lead.multiValues?.[colKey];
  if (Array.isArray(mv) && mv.length > 0) return mv;
  const primary = (lead as any)[colKey];
  return primary ? [primary] : [];
}

const TYPE_ICONS: Record<ColType, React.ReactNode> = {
  text:   <Type     className="w-3 h-3" />,
  number: <Hash     className="w-3 h-3" />,
  date:   <Calendar className="w-3 h-3" />,
};
const TYPE_LABELS: Record<ColType, string> = { text: "Text", number: "Number", date: "Date" };

// ─── API helpers ──────────────────────────────────────────────────────────────

const api = {
  fetchLeads: (s: string): Promise<LeadRecord[]> =>
    fetch(`/api/leads${s ? `?search=${encodeURIComponent(s)}` : ""}`, { credentials: "include" }).then(r => r.json()),
  fetchStats: (): Promise<LeadsStats> =>
    fetch("/api/leads/stats", { credentials: "include" }).then(r => r.json()),
  fetchPrefs: (): Promise<LeadsPrefs | null> =>
    fetch("/api/preferences/leads", { credentials: "include" }).then(r => r.json()),
  savePrefs: (p: LeadsPrefs) =>
    fetch("/api/preferences/leads", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }).then(r => r.json()),
  patchLead: ({ id, data }: { id: number; data: Partial<LeadRecord> }) =>
    fetch(`/api/leads/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
  deleteLead: (id: number) =>
    fetch(`/api/leads/${id}`, { method: "DELETE", credentials: "include" }),
  createLead: (data: Partial<LeadRecord>): Promise<LeadRecord> =>
    fetch("/api/leads", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
  fetchCustomCols: (): Promise<CustomColRecord[]> =>
    fetch("/api/leads/columns", { credentials: "include" }).then(r => r.json()),
  createCustomCol: (name: string, type: ColType): Promise<CustomColRecord> =>
    fetch("/api/leads/columns", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, type }) }).then(r => r.json()),
  updateCustomCol: (id: number, patch: { name?: string; type?: ColType }) =>
    fetch(`/api/leads/columns/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).then(r => r.json()),
  deleteCustomCol: (id: number) =>
    fetch(`/api/leads/columns/${id}`, { method: "DELETE", credentials: "include" }),
};

// ─── Inline Cell Editor ───────────────────────────────────────────────────────

// Per-key validation used by both CellEditor and NewLeadRow
function validateFieldValue(key: string, value: string): string {
  if (!value.trim()) return "";
  if (key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
    return "Invalid email format";
  if ((key === "leadValue") && (isNaN(parseFloat(value)) || parseFloat(value) < 0))
    return "Must be a positive number";
  if (key === "contact" && !isValidPhoneNumber(value))
    return "Phone must be 10 digits, e.g. (201) 000-9090";
  return "";
}

function CellEditor({ colKey, colType, inputType: inputTypeProp, value, onSave, onCancel }: {
  colKey: string; colType?: ColType; inputType?: string; value: string;
  onSave: (v: string) => void; onCancel: () => void;
}) {
  const [val, setVal]     = useState(value);
  const [err, setErr]     = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const commit = () => {
    const e = validateFieldValue(colKey, val);
    if (e) { setErr(e); return; }
    onSave(val);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    e.stopPropagation();
  };

  if (colKey === "status") {
    return (
      <select autoFocus value={val}
        className="w-full text-xs font-bold uppercase border border-primary/40 rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary px-1.5 py-0.5 cursor-pointer"
        onChange={e => { setVal(e.target.value); onSave(e.target.value); }}
        onBlur={() => onSave(val)}
        onKeyDown={e => { if (e.key === "Escape") onCancel(); e.stopPropagation(); }}>
        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  }

  const inputType = inputTypeProp ?? colType ?? "text";
  return (
    <div className="relative">
      <input ref={ref} type={inputType} value={val}
        title={err || undefined}
        className={`w-full min-w-[80px] text-sm border rounded-md bg-background focus:outline-none focus:ring-1 px-1.5 py-0.5 transition-colors
          ${err ? "border-destructive focus:ring-destructive" : "border-primary/40 focus:ring-primary"}`}
        onChange={e => { setVal(e.target.value); if (err) setErr(validateFieldValue(colKey, e.target.value)); }}
        onBlur={commit} onKeyDown={onKey}
      />
      {err && (
        <div className="absolute top-full left-0 mt-0.5 text-[10px] text-destructive whitespace-nowrap bg-background border border-destructive/30 rounded px-1.5 py-0.5 z-30 shadow-sm">
          {err}
        </div>
      )}
    </div>
  );
}

// ─── Multi-Value Cell ────────────────────────────────────────────────────────

function MultiValueCell({ values, colKey, inputType, onUpdate }: {
  values: string[];
  colKey: string;
  inputType?: string;
  onUpdate: (vals: string[]) => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [draft,    setDraft]    = useState("");
  const [draftErr, setDraftErr] = useState("");
  const [editIdx,  setEditIdx]  = useState<number | null>(null);
  const [editVal,  setEditVal]  = useState("");
  const [editErr,  setEditErr]  = useState("");
  const addRef = useRef<HTMLInputElement>(null);

  const addValue = () => {
    const v = draft.trim();
    if (!v) return;
    if (colKey === "contact" && !isValidPhoneNumber(v)) { setDraftErr("Phone must be 10 digits, e.g. (201) 000-9090"); return; }
    onUpdate([...values, colKey === "contact" ? formatPhoneNumber(v) : v]);
    setDraft("");
    setDraftErr("");
    setTimeout(() => addRef.current?.focus(), 0);
  };

  const removeValue = (i: number) => onUpdate(values.filter((_, idx) => idx !== i));

  const startEdit = (i: number) => { setEditIdx(i); setEditVal(values[i]); setEditErr(""); };
  const commitEdit = () => {
    if (editIdx === null) return;
    const v = editVal.trim();
    if (v && colKey === "contact" && !isValidPhoneNumber(v)) { setEditErr("Phone must be 10 digits, e.g. (201) 000-9090"); return; }
    const finalVal = colKey === "contact" && v ? formatPhoneNumber(v) : v;
    onUpdate(finalVal ? values.map((val, i) => i === editIdx ? finalVal : val) : values.filter((_, i) => i !== editIdx));
    setEditIdx(null);
    setEditErr("");
  };

  const SHOW = 2;
  const itype = inputType ?? "text";

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditIdx(null); setDraft(""); } }}>
      <PopoverTrigger asChild>
        {/* Trigger area — shows chips inline */}
        <div
          className="flex items-center flex-wrap gap-0.5 min-h-[22px] rounded px-0.5 cursor-pointer group hover:bg-muted/40 transition-colors"
          onClick={() => setOpen(true)}
          title="Click to manage values"
        >
          {values.length === 0 && (
            <span className="text-xs text-muted-foreground/30 italic select-none">—</span>
          )}
          {values.slice(0, SHOW).map((v, i) => (
            <span key={i}
              className="inline-flex items-center bg-muted/70 border border-border/60 rounded-sm text-xs px-1.5 py-0 max-w-[100px] shrink-0">
              <span className="truncate">{colKey === "contact" ? formatPhoneNumber(v) : v}</span>
            </span>
          ))}
          {values.length > SHOW && (
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 border border-border/40 rounded-sm px-1">
              +{values.length - SHOW}
            </span>
          )}
          <Plus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3 shadow-xl" align="start" side="bottom"
        onOpenAutoFocus={e => { e.preventDefault(); setTimeout(() => addRef.current?.focus(), 50); }}>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          {colKey === "contact" ? "Phone numbers" : colKey === "email" ? "Email addresses" : "Values"}
        </p>

        {/* Existing values */}
        <div className="space-y-1 mb-2 max-h-52 overflow-y-auto">
          {values.length === 0 && (
            <p className="text-xs text-muted-foreground/60 text-center py-3 italic">No values yet — add one below</p>
          )}
          {values.map((v, i) => (
            <div key={i} className="flex items-center gap-1.5 group/item rounded hover:bg-muted/30 px-1 py-0.5">
              {editIdx === i ? (
                <div className="flex-1 relative">
                  <input autoFocus type={itype} value={editVal}
                    className={`w-full text-xs border rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 ${editErr ? "border-destructive focus:ring-destructive" : "border-primary/50 focus:ring-primary"}`}
                    onChange={e => { const nv = colKey === "contact" ? formatPhoneNumber(e.target.value) : e.target.value; setEditVal(nv); if (editErr) setEditErr(""); }}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") { setEditIdx(null); setEditErr(""); } e.stopPropagation(); }}
                  />
                  {editErr && <p className="text-[10px] text-destructive mt-0.5">{editErr}</p>}
                </div>
              ) : (
                <>
                  {i === 0 && (
                    <span className="text-[9px] font-bold text-primary/60 uppercase tracking-wider shrink-0">primary</span>
                  )}
                  <span className="flex-1 text-xs truncate cursor-pointer hover:text-primary transition-colors"
                    onClick={() => startEdit(i)} title="Click to edit">
                    {v}
                  </span>
                  <button onClick={() => removeValue(i)}
                    className="p-0.5 rounded text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover/item:opacity-100 shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new value */}
        <div className="border-t border-border/40 pt-2">
          <div className="flex gap-1.5">
            <input ref={addRef} type={itype}
              placeholder={colKey === "contact" ? "(201) 000-9090" : colKey === "email" ? "Add email…" : "Add value…"}
              value={draft}
              className={`flex-1 text-xs border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 placeholder:text-muted-foreground/40 ${draftErr ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"}`}
              onChange={e => { const nv = colKey === "contact" ? formatPhoneNumber(e.target.value) : e.target.value; setDraft(nv); if (draftErr) setDraftErr(""); }}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === "Enter") { e.preventDefault(); addValue(); }
                if (e.key === "Escape") setOpen(false);
              }}
            />
            <button onClick={addValue} disabled={!draft.trim()}
              className="px-2.5 py-1 text-xs bg-primary text-primary-foreground rounded disabled:opacity-30 hover:bg-primary/90 transition-all">
              Add
            </button>
          </div>
          {draftErr && <p className="text-[10px] text-destructive mt-1">{draftErr}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Sortable Column Header ───────────────────────────────────────────────────

function SortableColHeader({ col }: { col: ColumnDef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key });
  return (
    <TableHead ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, cursor: isDragging ? "grabbing" : "grab", userSelect: "none", position: "relative", whiteSpace: "nowrap" }}
      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground h-10 px-1 select-none"
      {...attributes} {...listeners}>
      <span className="flex items-center gap-1.5">
        <GripVertical className="w-3 h-3 opacity-30 rotate-90 shrink-0" />
        {col.label}
        {col.isCustom && col.colType && col.colType !== "text" && (
          <span className="opacity-40">{TYPE_ICONS[col.colType]}</span>
        )}
      </span>
    </TableHead>
  );
}

// ─── Sortable Lead Row ────────────────────────────────────────────────────────

interface RowProps {
  lead: LeadRecord; index: number; visibleCols: ColumnDef[];
  editingCell: { rowId: number; colKey: string } | null;
  highlighted: boolean;
  onCellDoubleClick: (rowId: number, colKey: string, val: string) => void;
  onCellSave: (rowId: number, col: ColumnDef, val: string) => void;
  onCellCancel: () => void;
  onMultiValueUpdate: (rowId: number, colKey: string, vals: string[]) => void;
  onDelete: (id: number) => void; isDeleting: boolean;
}

function SortableLeadRow({ lead, index, visibleCols, editingCell, highlighted, onCellDoubleClick, onCellSave, onCellCancel, onMultiValueUpdate, onDelete, isDeleting }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
  const baseClass = lead.status === "paid" ? "bg-green-50/60 dark:bg-green-900/10" : index % 2 === 1 ? "bg-muted/10" : "";

  return (
    <TableRow ref={setNodeRef}
      data-lead-id={lead.id}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: "relative" }}
      className={`${baseClass} ${highlighted ? "row-flash" : ""}`}>
      <TableCell className="w-6 px-0.5 py-2 text-center">
        <button className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted/60 text-muted-foreground transition-colors"
          {...attributes} {...listeners} tabIndex={-1}>
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </TableCell>

      {visibleCols.map(col => {
        const isEditing  = editingCell?.rowId === lead.id && editingCell?.colKey === col.key;
        const isMulti    = !col.isCustom && MULTI_VALUE_COLS.has(col.key);
        const rawVal     = col.isCustom ? (lead.customData?.[col.fieldKey!] ?? "") : (lead as any)[col.key];
        const displayStr = rawVal == null ? "" : String(rawVal);

        // ── Multi-value cell ─────────────────────────────────────────────────
        if (isMulti) {
          return (
            <TableCell key={col.key}
              className="px-1 py-1 border-r border-border/30 last:border-r-0 max-w-[180px]">
              <MultiValueCell
                values={getLeadMultiValues(lead, col.key)}
                colKey={col.key}
                inputType={col.inputType}
                onUpdate={vals => onMultiValueUpdate(lead.id, col.key, vals)}
              />
            </TableCell>
          );
        }

        // ── Regular / single-value cell ──────────────────────────────────────
        return (
          <TableCell key={col.key}
            className="px-1 py-1.5 text-sm border-r border-border/30 last:border-r-0 max-w-[160px]"
            onDoubleClick={() => !isEditing && onCellDoubleClick(lead.id, col.key, displayStr)}
            title="Double-click to edit">
            {isEditing ? (
              <CellEditor colKey={col.key} colType={col.colType} inputType={col.inputType} value={displayStr}
                onSave={v => onCellSave(lead.id, col, v)} onCancel={onCellCancel} />
            ) : col.key === "status" ? (
              <LeadStatusBadge status={lead.status} />
            ) : col.key === "leadValue" ? (
              <span className="font-medium">{formatCurrency(lead.leadValue)}</span>
            ) : col.colType === "number" && rawVal !== "" && rawVal != null ? (
              <span className="font-medium tabular-nums">{Number(rawVal).toLocaleString()}</span>
            ) : col.colType === "date" && displayStr ? (
              (() => {
                const d = new Date(displayStr);
                return <span>{isNaN(d.getTime()) ? displayStr : d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "2-digit" })}</span>;
              })()
            ) : col.key === "contact" && displayStr ? (
              <span className="truncate block">{formatPhoneNumber(displayStr)}</span>
            ) : (
              <span className="truncate block">{displayStr}</span>
            )}
          </TableCell>
        );
      })}

      <TableCell className="px-1 py-1.5 text-right w-8">
        <button className="p-1 rounded text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors" disabled={isDeleting} onClick={() => onDelete(lead.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </TableCell>
    </TableRow>
  );
}

// ─── New Row (inline) ─────────────────────────────────────────────────────────

function NewLeadRow({ visibleCols, onSave, onCancel }: {
  visibleCols: ColumnDef[];
  onSave: (d: Partial<LeadRecord>) => void;
  onCancel: () => void;
}) {
  const [data,   setData]   = useState<Record<string, string>>({ status: "pending", leadValue: "0" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);

  // first non-status column key → gets the autofocus ref
  const firstInputKey = visibleCols.find(c => c.key !== "status")?.key ?? "";

  const handleChange = (fieldId: string, colKey: string, value: string) => {
    const finalValue = colKey === "contact" ? formatPhoneNumber(value) : value;
    setData(d => ({ ...d, [fieldId]: finalValue }));
    // Clear error as soon as field is valid again
    if (errors[colKey]) setErrors(e => ({ ...e, [colKey]: validateFieldValue(colKey, finalValue) }));
  };

  const commit = () => {
    // Validate every filled field; block save only on format errors
    const newErrs: Record<string, string> = {};
    let hasErr = false;
    visibleCols.forEach(col => {
      const fieldId = col.isCustom ? col.fieldKey! : col.key;
      const val = data[fieldId] ?? "";
      const err = validateFieldValue(col.key, val);
      if (err) { newErrs[col.key] = err; hasErr = true; }
    });
    if (hasErr) { setErrors(newErrs); return; }

    const payload: any = { ...data };
    const builtinKeys = new Set(BUILTIN_COLUMNS.map(c => c.key));
    const customData: Record<string, string> = {};
    Object.keys(payload).forEach(k => {
      if (!builtinKeys.has(k)) { customData[k] = payload[k]; delete payload[k]; }
    });
    if (Object.keys(customData).length) payload.customData = customData;
    if (data.leadValue !== undefined) payload.leadValue = parseFloat(data.leadValue) || 0;
    onSave(payload);
  };

  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") { onCancel(); return; }
    // Enter on ANY field saves — no need to tab to the last column first
    if (e.key === "Enter") { e.preventDefault(); commit(); }
  };

  return (
    <TableRow className="bg-primary/5 border-y border-primary/30">
      <TableCell className="w-6 px-0.5 py-1.5" />
      {visibleCols.map(col => {
        const fieldId   = col.isCustom ? col.fieldKey! : col.key;
        const inputType = col.inputType ?? col.colType ?? "text";
        const hasErr    = !!errors[col.key];
        return (
          <TableCell key={col.key} className="px-1 py-1.5 border-r border-border/30 last:border-r-0">
            {col.key === "status" ? (
              <select
                value={data[fieldId] ?? "pending"}
                className="w-full text-xs font-bold uppercase border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary px-1.5 py-0.5 cursor-pointer"
                onChange={e => setData(d => ({ ...d, [fieldId]: e.target.value }))}
                onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") onCancel(); }}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <div className="relative">
                <input
                  ref={col.key === firstInputKey ? firstRef : undefined}
                  type={inputType}
                  placeholder={col.label}
                  value={data[fieldId] ?? ""}
                  title={hasErr ? errors[col.key] : undefined}
                  className={`w-full min-w-[60px] text-sm border rounded-md bg-background focus:outline-none focus:ring-1 px-1.5 py-0.5 placeholder:text-muted-foreground/50 transition-colors
                    ${hasErr
                      ? "border-destructive focus:ring-destructive placeholder:text-destructive/40"
                      : "border-border focus:ring-primary"}`}
                  onChange={e => handleChange(fieldId, col.key, e.target.value)}
                  onKeyDown={onKey}
                />
                {hasErr && (
                  <div className="absolute top-full left-0 mt-0.5 text-[10px] text-destructive bg-background border border-destructive/30 rounded px-1.5 py-0.5 z-30 shadow-sm whitespace-nowrap pointer-events-none">
                    {errors[col.key]}
                  </div>
                )}
              </div>
            )}
          </TableCell>
        );
      })}
      <TableCell className="px-1 py-1.5 text-right w-8">
        <button className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors" onClick={onCancel} title="Cancel (Esc)">
          <X className="w-3.5 h-3.5" />
        </button>
      </TableCell>
    </TableRow>
  );
}

// ─── Manage Columns Dialog ───────────────────────────────────────────────────

function ManageColumnsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<ColType>("text");
  const [editId,  setEditId]  = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [editType, setEditType] = useState<ColType>("text");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: cols = [] } = useQuery<CustomColRecord[]>({
    queryKey: ["lead-custom-cols"],
    queryFn: api.fetchCustomCols,
  });

  const createMut = useMutation({
    mutationFn: ({ name, type }: { name: string; type: ColType }) => api.createCustomCol(name, type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-custom-cols"] });
      setNewName(""); setNewType("text");
      toast({ title: "Column added" });
    },
    onError: () => toast({ title: "Failed to add column", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: { name?: string; type?: ColType } }) =>
      api.updateCustomCol(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-custom-cols"] });
      setEditId(null);
      toast({ title: "Column updated" });
    },
    onError: () => toast({ title: "Failed to update column", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteCustomCol(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-custom-cols"] });
      toast({ title: "Column deleted" });
    },
    onError: () => toast({ title: "Failed to delete column", variant: "destructive" }),
  });

  const startEdit = (col: CustomColRecord) => {
    setEditId(col.id); setEditVal(col.name); setEditType(col.type ?? "text");
  };
  const commitUpdate = (id: number) => {
    if (!editVal.trim()) { setEditId(null); return; }
    updateMut.mutate({ id, patch: { name: editVal.trim(), type: editType } });
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMut.mutate({ name: newName.trim(), type: newType });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Manage Columns
          </DialogTitle>
        </DialogHeader>

        {/* Built-in columns */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Built-in</p>
          <div className="space-y-0.5 max-h-36 overflow-y-auto pr-1">
            {BUILTIN_COLUMNS.map(col => (
              <div key={col.key} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-muted/30">
                <span className="text-sm text-muted-foreground">{col.label}</span>
                <span className="text-xs text-muted-foreground/50 flex items-center gap-1">
                  {col.colType && TYPE_ICONS[col.colType]}
                  built-in
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border/40 pt-3 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Custom Columns</p>
          {cols.length === 0 && <p className="text-sm text-muted-foreground py-2 text-center">No custom columns yet</p>}
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {cols.map(col => (
              <div key={col.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/40 bg-background hover:bg-muted/20 group">
                {editId === col.id ? (
                  <>
                    <input autoFocus value={editVal}
                      className="flex-1 text-sm border border-primary/40 rounded px-2 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitUpdate(col.id); if (e.key === "Escape") setEditId(null); }}
                    />
                    {/* Type selector in edit mode */}
                    <select value={editType}
                      className="text-xs border border-border rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      onChange={e => setEditType(e.target.value as ColType)}>
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                    <button onClick={() => commitUpdate(col.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Save">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditId(null)} className="p-1 text-muted-foreground hover:bg-muted rounded" title="Cancel">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{col.name}</span>
                    {/* Type badge */}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground/60 border border-border/50 rounded px-1.5 py-0.5 bg-muted/20">
                      {TYPE_ICONS[col.type ?? "text"]}
                      {TYPE_LABELS[col.type ?? "text"]}
                    </span>
                    <button onClick={() => startEdit(col)} className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { if (confirm(`Delete column "${col.name}"? This removes its data from all leads.`)) deleteMut.mutate(col.id); }}
                      className="p-1 text-destructive/50 hover:text-destructive hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new column */}
          <div className="pt-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Add new column</p>
            <div className="flex gap-2">
              <Input
                placeholder="Column name…"
                value={newName}
                className="h-8 text-sm flex-1"
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
              />
              {/* Type selector */}
              <select value={newType}
                className="h-8 text-xs border border-border rounded-md px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shrink-0"
                onChange={e => setNewType(e.target.value as ColType)}
                title="Column type">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
              </select>
              <Button size="sm" className="h-8 shrink-0 px-3" disabled={!newName.trim() || createMut.isPending}
                onClick={handleCreate}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/60">
              Type controls the input used when editing — Text, Number, or Date picker.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Leads() {
  const [search,      setSearch]      = useState("");
  const [timeFilter,  setTimeFilter]  = useState("all");
  const [editingCell, setEditingCell] = useState<{ rowId: number; colKey: string } | null>(null);
  const [showNewRow,  setShowNewRow]  = useState(false);
  const [manageOpen,  setManageOpen]  = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const [columnOrder,   setColumnOrder]   = useState<string[]>(BUILTIN_COLUMNS.map(c => c.key));
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [rowOrder,      setRowOrder]      = useState<number[]>([]);
  const prefsReady = useRef(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: rawLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads", search],
    queryFn: () => api.fetchLeads(search),
  });

  const { data: stats }       = useQuery({ queryKey: ["leads-stats"],   queryFn: api.fetchStats });
  const { data: savedPrefs }  = useQuery({ queryKey: ["leads-prefs"],   queryFn: api.fetchPrefs });

  const { data: customColRecords = [] } = useQuery<CustomColRecord[]>({
    queryKey: ["lead-custom-cols"],
    queryFn: api.fetchCustomCols,
  });

  // ── Build full column list ────────────────────────────────────────────────

  const allColumns: ColumnDef[] = React.useMemo(() => {
    const custom: ColumnDef[] = customColRecords.map(c => ({
      key: `custom_${c.fieldKey}`,
      label: c.name,
      isCustom: true,
      fieldKey: c.fieldKey,
      customId: c.id,
      colType: c.type,
    }));
    return [...BUILTIN_COLUMNS, ...custom];
  }, [customColRecords]);

  // ── Load saved prefs once ─────────────────────────────────────────────────

  useEffect(() => {
    if (savedPrefs === undefined || prefsReady.current) return;
    prefsReady.current = true;
    if (!savedPrefs) return;
    if (savedPrefs.columnOrder?.length) setColumnOrder(savedPrefs.columnOrder);
    if (savedPrefs.hiddenColumns)       setHiddenColumns(new Set(savedPrefs.hiddenColumns));
    if (savedPrefs.rowOrder)            setRowOrder(savedPrefs.rowOrder);
  }, [savedPrefs]);

  // When new custom columns arrive, add them to columnOrder if missing
  useEffect(() => {
    const missing = allColumns.filter(c => !columnOrder.includes(c.key));
    if (missing.length) setColumnOrder(prev => [...prev, ...missing.map(c => c.key)]);
  }, [allColumns]);

  // Scroll to + highlight a newly created row once it lands in rawLeads
  useEffect(() => {
    if (!highlightId) return;
    const exists = Array.isArray(rawLeads) && rawLeads.some(l => l.id === highlightId);
    if (!exists) return;
    // Row is in the data — wait one frame for DOM paint, then scroll
    const raf = requestAnimationFrame(() => {
      const el = tableScrollRef.current?.querySelector(`[data-lead-id="${highlightId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    const timer = setTimeout(() => setHighlightId(null), 2500);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [highlightId, rawLeads]);

  // ── Prefs save ────────────────────────────────────────────────────────────

  const savePrefs = useCallback((patch: Partial<LeadsPrefs>) => {
    api.savePrefs({ columnOrder, hiddenColumns: [...hiddenColumns], rowOrder, ...patch }).catch(() => {});
  }, [columnOrder, hiddenColumns, rowOrder]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const patchMut = useMutation({
    mutationFn: api.patchLead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-stats"] });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteLead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-stats"] });
    },
  });

  const createMut = useMutation({
    mutationFn: api.createLead,
    onSuccess: (newLead) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-stats"] });
      setShowNewRow(false);
      toast({ title: "Lead added" });

      // Scroll to new row + flash highlight
      setHighlightId(newLead.id);
    },
    onError: () => toast({ title: "Failed to add lead", variant: "destructive" }),
  });

  // ── Computed columns ─────────────────────────────────────────────────────

  const orderedAllCols = React.useMemo(() => {
    const ordered = columnOrder
      .map(key => allColumns.find(c => c.key === key))
      .filter(Boolean) as ColumnDef[];
    allColumns.forEach(c => { if (!ordered.find(x => x.key === c.key)) ordered.push(c); });
    return ordered;
  }, [columnOrder, allColumns]);

  const visibleCols = orderedAllCols.filter(c => !hiddenColumns.has(c.key));

  // ── Leads in row order ────────────────────────────────────────────────────

  const leads: LeadRecord[] = React.useMemo(() => {
    if (!Array.isArray(rawLeads)) return [];
    if (rowOrder.length === 0) return rawLeads;
    const byId = new Map(rawLeads.map(l => [l.id, l]));
    const ordered: LeadRecord[] = [];
    rowOrder.forEach(id => { const l = byId.get(id); if (l) { ordered.push(l); byId.delete(id); } });
    byId.forEach(l => ordered.push(l));
    return ordered;
  }, [rawLeads, rowOrder]);

  // ── Column toggle ─────────────────────────────────────────────────────────

  const toggleColumn = (key: string) => {
    const next = new Set(hiddenColumns);
    if (next.has(key)) { next.delete(key); }
    else { if (visibleCols.length <= 1) return; next.add(key); }
    setHiddenColumns(next);
    savePrefs({ hiddenColumns: [...next] });
  };

  // ── DnD ──────────────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleColDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(columnOrder, columnOrder.indexOf(String(active.id)), columnOrder.indexOf(String(over.id)));
    setColumnOrder(next);
    savePrefs({ columnOrder: next });
  };

  const handleRowDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = leads.map(l => l.id);
    const next = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    setRowOrder(next);
    savePrefs({ rowOrder: next });
  };

  // ── Cell edit ─────────────────────────────────────────────────────────────

  const handleCellDoubleClick = (rowId: number, colKey: string, _val: string) => setEditingCell({ rowId, colKey });

  const handleCellSave = (rowId: number, col: ColumnDef, val: string) => {
    setEditingCell(null);
    let parsed: any = val;
    if (col.key === "leadValue" || col.colType === "number") parsed = parseFloat(val) || 0;
    const data: Partial<LeadRecord> = col.isCustom
      ? { customData: { [col.fieldKey!]: parsed } } as any
      : { [col.key]: parsed } as any;
    patchMut.mutate({ id: rowId, data });
  };

  const handleMultiValueUpdate = (rowId: number, colKey: string, vals: string[]) => {
    // Optimistic update in cache
    qc.setQueryData(["leads", search], (old: LeadRecord[] | undefined) =>
      old?.map(l => l.id !== rowId ? l : {
        ...l,
        multiValues: { ...l.multiValues, [colKey]: vals },
        [colKey]: vals[0] ?? null,  // keep primary column in sync
      })
    );
    patchMut.mutate({ id: rowId, data: { multiValues: { [colKey]: vals } } as any });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Flash animation keyframes — injected once */}
      <style>{`
        @keyframes flash-highlight {
          0%   { background-color: hsl(var(--primary) / 0.25); box-shadow: inset 0 0 0 1px hsl(var(--primary) / 0.4); }
          100% { background-color: transparent; box-shadow: none; }
        }
        .row-flash { animation: flash-highlight 2s ease-out forwards; }
      `}</style>

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">Global Leads Database</h1>
          <div className="flex items-center gap-2">

            {/* Columns popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <Columns className="w-4 h-4" /> Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Show / Hide</p>
                <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
                  {orderedAllCols.map(col => (
                    <div key={col.key} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                      <span className="text-sm font-medium truncate flex items-center gap-1.5">
                        {col.isCustom && col.colType && (
                          <span className="text-muted-foreground/50">{TYPE_ICONS[col.colType]}</span>
                        )}
                        {col.label}
                      </span>
                      <Switch checked={!hiddenColumns.has(col.key)} onCheckedChange={() => toggleColumn(col.key)} />
                    </div>
                  ))}
                </div>
                <div className="border-t border-border/40 mt-3 pt-3">
                  <button className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium w-full"
                    onClick={() => setManageOpen(true)}>
                    <Settings2 className="w-3.5 h-3.5" /> Manage custom columns
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[["all","All time"],["7d","Last 7 days"],["3m","Last 3 months"],["6m","Last 6 months"],["this_month","This month"],["last_month","Last month"],["this_year","This year"],["last_year","Last year"]].map(([v,l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search leads…" className="pl-8 h-9 w-48" onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard icon={<LayoutGrid   className="w-5 h-5" />} label="Total Leads"    value={stats?.totalLeads ?? 0} />
          <StatCard icon={<Clock        className="w-5 h-5" />} label="Active Leads"   value={stats?.activeLeads ?? 0}           iconBg="bg-amber-100 text-amber-600" />
          <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Paid Leads"    value={stats?.paidLeads ?? 0}             iconBg="bg-green-100 text-green-600" />
          <StatCard icon={<DollarSign   className="w-5 h-5" />} label="Paid Revenue"  value={formatCurrency(stats?.paidRevenue ?? 0)}  iconBg="bg-green-100 text-green-700" />
          <StatCard icon={<TrendingUp   className="w-5 h-5" />} label="Total Revenue" value={formatCurrency(stats?.totalRevenue ?? 0)} iconBg="bg-blue-100 text-blue-600" />
        </div>

        {/* Table card — fixed height so the Add row button stays visible */}
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm flex flex-col"
             style={{ height: "calc(100vh - 340px)", minHeight: "420px" }}>

          {/* Scrollable table body */}
          <div className="flex-1 overflow-auto" ref={tableScrollRef}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleColDragEnd}>
                  <SortableContext items={orderedAllCols.map(c => c.key)} strategy={horizontalListSortingStrategy}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-6 px-0.5" />
                      {visibleCols.map(col => <SortableColHeader key={col.key} col={col} />)}
                      <TableHead className="w-8 px-1" />
                    </TableRow>
                  </SortableContext>
                </DndContext>
              </TableHeader>

              <TableBody>
                {leadsLoading ? (
                  <TableRow><TableCell colSpan={visibleCols.length + 2} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRowDragEnd}>
                    <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                      {leads.map((lead, i) => (
                        <SortableLeadRow key={lead.id} lead={lead} index={i} visibleCols={visibleCols}
                          editingCell={editingCell}
                          highlighted={highlightId === lead.id}
                          onCellDoubleClick={handleCellDoubleClick}
                          onCellSave={handleCellSave}
                          onCellCancel={() => setEditingCell(null)}
                          onMultiValueUpdate={handleMultiValueUpdate}
                          onDelete={id => deleteMut.mutate(id)}
                          isDeleting={deleteMut.isPending}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}

                {showNewRow && (
                  <NewLeadRow visibleCols={visibleCols}
                    onSave={data => createMut.mutate(data)}
                    onCancel={() => setShowNewRow(false)}
                  />
                )}

                {leads.length > 0 && (
                  <TableRow className="bg-muted/20 font-medium border-t-2 border-border">
                    <TableCell className="w-6 px-0.5" />
                    {visibleCols.map(col => (
                      <TableCell key={col.key} className="px-1 py-2.5 text-sm border-r border-border/30 last:border-r-0">
                        {col.key === "leadValue" ? formatCurrency(leads.reduce((s, r) => s + (r.leadValue || 0), 0)) : ""}
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Sticky footer — always visible regardless of scroll position */}
          <div className="border-t border-border/60 px-3 py-2 shrink-0 bg-card flex items-center justify-between">
            <button
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => { setShowNewRow(true); setEditingCell(null); }}
              disabled={showNewRow}>
              <span className="flex items-center justify-center w-5 h-5 rounded border border-dashed border-muted-foreground/40 group-hover:border-foreground/60 group-disabled:border-muted-foreground/20 transition-colors">
                <Plus className="w-3 h-3" />
              </span>
              Add row
            </button>
            <span className="text-xs text-muted-foreground">{leads.length} lead{leads.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <ManageColumnsDialog open={manageOpen} onClose={() => { setManageOpen(false); qc.invalidateQueries({ queryKey: ["lead-custom-cols"] }); }} />
    </>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function LeadStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   "border border-gray-300 text-gray-600 bg-transparent",
    contacted: "bg-blue-500 text-white border border-blue-500",
    paid:      "bg-green-500 text-white border border-green-500",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}
