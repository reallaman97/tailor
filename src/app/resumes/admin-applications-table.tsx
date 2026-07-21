"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type ColumnSizingState,
} from "@tanstack/react-table";
import { TablePagination, DEFAULT_PAGE_SIZE } from "@/components/table-pagination";
import { ApprovalSelect } from "./approval-select";
import {
  bulkUpdateResumeApprovalAction,
  bulkDeleteResumesAction,
  deleteResumeAction,
} from "./actions";
import { usePersistedState } from "@/lib/use-persisted-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { ExternalLinkIcon, TrashIcon, DownloadIcon, FileTextIcon, EyeIcon } from "@/components/icons";
import { needsFollowUp } from "@/lib/resume-status";
import { cn } from "@/lib/utils";
import type { AdminTrackerRow } from "@/lib/admin/applications";

const APPROVAL_FILTER_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

/**
 * The Applied column is filtered from two places that share one filter slot:
 * the top "Applied between" control (a {from,to} range) and the in-column
 * single-date picker (an exact-match string). This resolves either form.
 */
function appliedMatchesFilter(appliedAt: Date | null, value: unknown): boolean {
  if (value == null || value === "") return true;
  const applied = toDateInputValue(appliedAt);
  if (typeof value === "string") return applied === value; // single-date exact match
  const range = value as DateRange;
  if (!range.from && !range.to) return true;
  if (!applied) return false;
  if (range.from && applied < range.from) return false;
  if (range.to && applied > range.to) return false;
  return true;
}

function TextFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      placeholder="Filter…"
      className="h-7 w-full rounded border border-input bg-transparent px-1.5 text-xs text-foreground"
    />
  );
}

function SelectFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className="h-7 pl-1.5 pr-6 text-xs"
    >
      <option value="">All</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

function DateFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className="h-7 w-full rounded border border-input bg-transparent px-1 text-xs text-foreground"
    />
  );
}

export type DateRange = { from: string; to: string };

/** Standalone "Applied between" range control, shown above the table rather
 * than inside the Applied column header. */
function AppliedRangeControl({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  const active = value.from || value.to;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Applied between</span>
      <input
        type="date"
        aria-label="Applied from"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="h-8 rounded border border-input bg-transparent px-2 text-sm text-foreground"
      />
      <span className="text-sm text-muted-foreground">to</span>
      <input
        type="date"
        aria-label="Applied to"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="h-8 rounded border border-input bg-transparent px-2 text-sm text-foreground"
      />
      {active && (
        <button
          type="button"
          onClick={() => onChange({ from: "", to: "" })}
          className="cursor-pointer text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}

export function AdminApplicationsTable({ applications }: { applications: AdminTrackerRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approvalPending, startApprovalTransition] = useTransition();

  const [sorting, setSorting] = usePersistedState<SortingState>("admin-applications-table:sorting", []);
  const [columnFilters, setColumnFilters] = usePersistedState<ColumnFiltersState>(
    "admin-applications-table:columnFilters",
    []
  );
  const [columnSizing, setColumnSizing] = usePersistedState<ColumnSizingState>(
    "admin-applications-table:columnSizing",
    {}
  );
  const [pageSize, setPageSize] = usePersistedState<number>("admin-applications-table:pageSize", DEFAULT_PAGE_SIZE);
  const [pageIndex, setPageIndex] = useState(0);
  const [followUpOnly, setFollowUpOnly] = useState(false);

  const data = useMemo(
    () => (followUpOnly ? applications.filter((a) => needsFollowUp(a.statuses, a.updatedAt)) : applications),
    [applications, followUpOnly]
  );

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyBulkApproval(approvalStatus: "APPROVED" | "REJECTED") {
    const ids = [...selected];
    startApprovalTransition(async () => {
      await bulkUpdateResumeApprovalAction(ids, approvalStatus);
      setSelected(new Set());
    });
  }

  function downloadSelected() {
    [...selected].forEach((id, i) => {
      setTimeout(() => {
        const jd = document.createElement("a");
        jd.href = `/api/resumes/${id}/job-description`;
        jd.click();
        const pdf = document.createElement("a");
        pdf.href = `/api/resumes/${id}/pdf`;
        pdf.click();
      }, i * 400);
    });
  }

  async function bulkDelete() {
    const ids = [...selected];
    await bulkDeleteResumesAction(ids);
    setSelected(new Set());
  }

  const columns = useMemo<ColumnDef<AdminTrackerRow>[]>(
    () => [
      {
        id: "select",
        size: 40,
        enableResizing: false,
        header: ({ table }) => {
          const rows = table.getFilteredRowModel().rows;
          const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.original.id));
          return (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (allSelected) rows.forEach((r) => next.delete(r.original.id));
                  else rows.forEach((r) => next.add(r.original.id));
                  return next;
                })
              }
              onClick={(e) => e.stopPropagation()}
              aria-label="Select all rows"
              title="Select all"
              className="size-4 accent-primary"
            />
          );
        },
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selected.has(row.original.id)}
            onChange={() => toggleOne(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${row.original.companyName} — ${row.original.jobTitle}`}
            className="size-4 accent-primary"
          />
        ),
      },
      {
        id: "userName",
        accessorKey: "userName",
        header: "Applied By",
        size: 180,
        cell: ({ getValue }) => {
          const v = getValue<string>();
          return <span className="block truncate text-muted-foreground" title={v}>{v}</span>;
        },
        filterFn: (row, id, value: string) =>
          row.original.userName.toLowerCase().includes(value.toLowerCase()),
      },
      {
        id: "profileName",
        accessorFn: (row) => row.profileName ?? "",
        header: "Profile",
        size: 160,
        cell: ({ getValue }) => {
          const v = getValue<string>() || "—";
          return <span className="block truncate text-muted-foreground" title={v}>{v}</span>;
        },
        filterFn: (row, id, value: string) =>
          (row.original.profileName ?? "").toLowerCase().includes(value.toLowerCase()),
      },
      {
        id: "companyName",
        accessorKey: "companyName",
        header: "Company",
        size: 160,
        cell: ({ row }) => (
          <Link
            href={`/resumes/${row.original.id}`}
            title={row.original.companyName}
            className="block truncate font-medium text-foreground hover:text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.companyName}
          </Link>
        ),
        filterFn: (row, id, value: string) =>
          row.original.companyName.toLowerCase().includes(value.toLowerCase()),
      },
      {
        id: "jobTitle",
        accessorKey: "jobTitle",
        header: "Title",
        size: 160,
        cell: ({ row }) => (
          <Link
            href={`/resumes/${row.original.id}`}
            title={row.original.jobTitle}
            className="block truncate text-muted-foreground hover:text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.jobTitle}
          </Link>
        ),
        filterFn: (row, id, value: string) => row.original.jobTitle.toLowerCase().includes(value.toLowerCase()),
      },
      {
        id: "appliedAt",
        accessorKey: "appliedAt",
        header: "Applied",
        size: 120,
        cell: ({ getValue }) => {
          const v = getValue<Date | null>();
          return <span className="text-muted-foreground">{v ? v.toLocaleDateString() : "—"}</span>;
        },
        filterFn: (row, id, value) => appliedMatchesFilter(row.original.appliedAt, value),
      },
      {
        id: "approvalStatus",
        accessorKey: "approvalStatus",
        header: "Approval",
        size: 190,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <ApprovalSelect
              resumeId={row.original.id}
              approvalStatus={row.original.approvalStatus}
              hasScreenshot={row.original.hasScreenshot}
            />
          </div>
        ),
      },
      {
        id: "jobLink",
        accessorFn: (row) => Boolean(row.jobLink),
        header: "Link",
        size: 110,
        cell: ({ row }) =>
          row.original.jobLink ? (
            <a
              href={row.original.jobLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Posting <ExternalLinkIcon className="size-3.5" />
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        filterFn: (row, id, value: string) => {
          if (value === "") return true;
          return value === "yes" ? Boolean(row.original.jobLink) : !row.original.jobLink;
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 160,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Link
              href={`/resumes/${row.original.id}`}
              className={buttonVariants("ghost", "icon")}
              aria-label="View application"
              title="View application"
            >
              <EyeIcon className="size-4" />
            </Link>
            <a
              href={`/api/resumes/${row.original.id}/job-description`}
              className={buttonVariants("ghost", "icon")}
              aria-label="Download job description"
              title="Download job description"
            >
              <DownloadIcon className="size-4" />
            </a>
            <a
              href={`/api/resumes/${row.original.id}/pdf`}
              className={buttonVariants("ghost", "icon")}
              aria-label="Download generated resume"
              title="Download generated resume"
            >
              <FileTextIcon className="size-4" />
            </a>
            <ConfirmDialog
              title="Delete this application?"
              description={`This permanently deletes "${row.original.jobTitle}" at ${row.original.companyName} (${row.original.userEmail}), including any tailored resume and screenshot uploaded for it.`}
              action={deleteResumeAction.bind(null, row.original.id)}
              triggerVariant="ghost"
              triggerSize="icon"
              triggerClassName="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              triggerLabel="Delete application"
              triggerContent={<TrashIcon className="size-4" />}
            />
          </div>
        ),
      },
    ],
    [selected]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnSizing, pagination: { pageIndex, pageSize } },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
      setPageIndex(next.pageIndex);
      setPageSize(next.pageSize);
    },
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // The Applied column's filter slot holds either a {from,to} range (set by the
  // top "Applied between" control) or a single-date string (set by the in-column
  // picker). Read each in the form its control expects.
  const appliedFilter = table.getColumn("appliedAt")?.getFilterValue();
  const appliedRange: DateRange =
    appliedFilter && typeof appliedFilter === "object" ? (appliedFilter as DateRange) : { from: "", to: "" };
  const setAppliedRange = (v: DateRange) =>
    table.getColumn("appliedAt")?.setFilterValue(v.from || v.to ? v : undefined);

  // Approved applications matching the current Applied-date filter (range or
  // single date; all approved when no date filter is set). Updates live.
  const approvedInRange = applications.filter(
    (a) => a.approvalStatus === "APPROVED" && appliedMatchesFilter(a.appliedAt, appliedFilter)
  ).length;
  const appliedFilterActive = appliedFilter != null && appliedFilter !== "";

  const filterUi: Record<string, React.ReactNode> = {
    userName: (
      <TextFilter
        value={(table.getColumn("userName")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("userName")?.setFilterValue(v)}
      />
    ),
    profileName: (
      <TextFilter
        value={(table.getColumn("profileName")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("profileName")?.setFilterValue(v)}
      />
    ),
    companyName: (
      <TextFilter
        value={(table.getColumn("companyName")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("companyName")?.setFilterValue(v)}
      />
    ),
    jobTitle: (
      <TextFilter
        value={(table.getColumn("jobTitle")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("jobTitle")?.setFilterValue(v)}
      />
    ),
    appliedAt: (
      <DateFilter
        value={typeof appliedFilter === "string" ? appliedFilter : ""}
        onChange={(v) => table.getColumn("appliedAt")?.setFilterValue(v || undefined)}
      />
    ),
    approvalStatus: (
      <SelectFilter
        value={(table.getColumn("approvalStatus")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("approvalStatus")?.setFilterValue(v || undefined)}
        options={APPROVAL_FILTER_OPTIONS}
      />
    ),
    jobLink: (
      <SelectFilter
        value={(table.getColumn("jobLink")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("jobLink")?.setFilterValue(v || undefined)}
        options={[
          { value: "yes", label: "Has link" },
          { value: "no", label: "No link" },
        ]}
      />
    ),
  };

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">{selected.size} selected</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={approvalPending}
            onClick={() => applyBulkApproval("APPROVED")}
          >
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            loading={approvalPending}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => applyBulkApproval("REJECTED")}
          >
            Reject
          </Button>
          <span className="h-5 w-px shrink-0 bg-border" />
          <Button type="button" size="sm" variant="outline" onClick={downloadSelected}>
            <DownloadIcon className="size-4" />
            Download resume + JD
          </Button>
          <ConfirmDialog
            title={`Delete ${selected.size} application${selected.size === 1 ? "" : "s"}?`}
            description="This permanently deletes every selected application, including any tailored resume and screenshot uploaded for it."
            action={bulkDelete}
            triggerVariant="ghost"
            triggerSize="sm"
            triggerClassName="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            triggerLabel="Delete selected"
            triggerContent={
              <span className="flex items-center gap-1.5">
                <TrashIcon className="size-4" />
                Remove
              </span>
            }
          />
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="cursor-pointer text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <AppliedRangeControl value={appliedRange} onChange={setAppliedRange} />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={followUpOnly}
              onChange={(e) => {
                setFollowUpOnly(e.target.checked);
                setPageIndex(0);
              }}
              className="size-4 accent-primary"
            />
            Needs follow-up
          </label>
        </div>
        <div className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm">
          <span className="text-muted-foreground">Approved{appliedFilterActive ? " in selected dates" : ""}: </span>
          <span className="font-semibold text-foreground">{approvedInRange}</span>
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-lg border border-border">
        <table style={{ minWidth: table.getTotalSize(), tableLayout: "fixed" }} className="w-full caption-bottom text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="relative p-2 text-left align-top text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {header.column.columnDef.header !== undefined && (
                      <div
                        className={cn(
                          "flex items-center gap-1 px-1 pb-1.5",
                          header.column.getCanSort() && "cursor-pointer select-none"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" && <span>↑</span>}
                        {header.column.getIsSorted() === "desc" && <span>↓</span>}
                      </div>
                    )}
                    {filterUi[header.column.id] && <div className="px-1">{filterUi[header.column.id]}</div>}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-primary/50",
                          header.column.getIsResizing() && "bg-primary"
                        )}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => toggleOne(row.original.id)}
                className={cn(
                  "cursor-pointer border-b border-border transition-colors hover:bg-muted/40",
                  selected.has(row.original.id) && "bg-primary/5"
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className="overflow-hidden whitespace-nowrap p-3 align-middle"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.getFilteredRowModel().rows.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">No rows match the current column filters.</p>
      )}
      <TablePagination table={table} />
    </div>
  );
}
