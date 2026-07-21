"use client";

import { useState, useMemo } from "react";
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
import { ApprovalStatusCell } from "@/components/approval-status-cell";
import { StatusBadges } from "@/components/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ExternalLinkIcon, DownloadIcon, FileTextIcon, EyeIcon } from "@/components/icons";
import { STATUS_OPTIONS, getPrimaryStatus, needsFollowUp } from "@/lib/resume-status";
import { cn } from "@/lib/utils";
import { usePersistedState } from "@/lib/use-persisted-state";
import type { ResumeSummary } from "@/lib/resumes/resumes";

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

/**
 * The Applied column shares one filter slot between the top "Applied between"
 * range control ({from,to}) and the in-column single-date picker (a string).
 */
function appliedMatchesFilter(appliedAt: Date | null, value: unknown): boolean {
  if (value == null || value === "") return true;
  const applied = toDateInputValue(appliedAt);
  if (typeof value === "string") return applied === value; // single-date exact match
  const range = value as { from: string; to: string };
  if (!range.from && !range.to) return true;
  if (!applied) return false;
  if (range.from && applied < range.from) return false;
  if (range.to && applied > range.to) return false;
  return true;
}

function DateFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-full rounded border border-input bg-transparent px-1 text-xs text-foreground"
    />
  );
}

function TextFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="h-7 pl-1.5 pr-6 text-xs">
      <option value="">All</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

type DateRange = { from: string; to: string };

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

const APPROVAL_FILTER_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

export function UserApplicationsTable({ resumes }: { resumes: ResumeSummary[] }) {
  const [sorting, setSorting] = usePersistedState<SortingState>("user-applications-table:sorting", []);
  const [columnFilters, setColumnFilters] = usePersistedState<ColumnFiltersState>(
    "user-applications-table:columnFilters",
    []
  );
  const [columnSizing, setColumnSizing] = usePersistedState<ColumnSizingState>(
    "user-applications-table:columnSizing",
    {}
  );
  const [pageSize, setPageSize] = usePersistedState<number>("user-applications-table:pageSize", DEFAULT_PAGE_SIZE);
  const [pageIndex, setPageIndex] = useState(0);
  const [followUpOnly, setFollowUpOnly] = useState(false);

  const data = useMemo(
    () => (followUpOnly ? resumes.filter((r) => needsFollowUp(r.statuses, r.updatedAt)) : resumes),
    [resumes, followUpOnly]
  );

  const columns: ColumnDef<ResumeSummary>[] = [
    {
      id: "jobLink",
      accessorFn: (row) => Boolean(row.jobLink),
      header: "Link",
      size: 100,
      cell: ({ row }) =>
        row.original.jobLink ? (
          <a
            href={row.original.jobLink}
            target="_blank"
            rel="noopener noreferrer"
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
      id: "companyName",
      accessorKey: "companyName",
      header: "Company",
      size: 170,
      cell: ({ row }) => (
        <Link
          href={`/resumes/${row.original.id}`}
          title={row.original.companyName}
          className="block truncate font-medium text-foreground hover:text-primary hover:underline"
        >
          {row.original.companyName}
        </Link>
      ),
      filterFn: (row, id, value: string) => row.original.companyName.toLowerCase().includes(value.toLowerCase()),
    },
    {
      id: "jobTitle",
      accessorKey: "jobTitle",
      header: "Title",
      size: 170,
      cell: ({ row }) => (
        <Link
          href={`/resumes/${row.original.id}`}
          title={row.original.jobTitle}
          className="block truncate text-muted-foreground hover:text-primary hover:underline"
        >
          {row.original.jobTitle}
        </Link>
      ),
      filterFn: (row, id, value: string) => row.original.jobTitle.toLowerCase().includes(value.toLowerCase()),
    },
    {
      id: "status",
      accessorFn: (row) => getPrimaryStatus(row.statuses),
      header: "Status",
      size: 200,
      cell: ({ row }) => <StatusBadges statuses={row.original.statuses} nowrap />,
      filterFn: (row, id, value: string) => row.original.statuses.includes(value as never),
    },
    {
      id: "appliedByName",
      accessorKey: "appliedByName",
      header: "Applied By",
      size: 170,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return <span className="block truncate text-muted-foreground" title={v}>{v}</span>;
      },
      filterFn: (row, id, value: string) => row.original.appliedByName.toLowerCase().includes(value.toLowerCase()),
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
      size: 130,
      cell: ({ row }) => (
        <ApprovalStatusCell
          resumeId={row.original.id}
          approvalStatus={row.original.approvalStatus}
          hasScreenshot={row.original.hasScreenshot}
        />
      ),
      filterFn: (row, id, value: string) => row.original.approvalStatus === value,
    },
    {
      id: "actions",
      header: "Actions",
      size: 140,
      enableResizing: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
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
        </div>
      ),
    },
  ];

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

  // Applied filter slot: {from,to} range from the top control, or a single-date
  // string from the in-column picker. Read each in the form its control expects.
  const appliedFilter = table.getColumn("appliedAt")?.getFilterValue();
  const appliedRange: DateRange =
    appliedFilter && typeof appliedFilter === "object" ? (appliedFilter as DateRange) : { from: "", to: "" };
  const setAppliedRange = (v: DateRange) =>
    table.getColumn("appliedAt")?.setFilterValue(v.from || v.to ? v : undefined);

  const approvedInRange = resumes.filter(
    (r) => r.approvalStatus === "APPROVED" && appliedMatchesFilter(r.appliedAt, appliedFilter)
  ).length;
  const appliedFilterActive = appliedFilter != null && appliedFilter !== "";

  const filterUi: Record<string, React.ReactNode> = {
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
    status: (
      <SelectFilter
        value={(table.getColumn("status")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("status")?.setFilterValue(v || undefined)}
        options={STATUS_OPTIONS}
      />
    ),
    appliedByName: (
      <TextFilter
        value={(table.getColumn("appliedByName")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("appliedByName")?.setFilterValue(v)}
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
  };

  return (
    <div className="flex flex-col gap-3">
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
                    {filterUi[header.column.id] && <div className="px-1">{filterUi[header.column.id]}</div>}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
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
              <tr key={row.id} className="border-b border-border transition-colors hover:bg-muted/40">
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
