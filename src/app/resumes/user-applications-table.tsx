"use client";

import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type ColumnSizingState,
} from "@tanstack/react-table";
import { ApprovalStatusCell } from "@/components/approval-status-cell";
import { StatusBadges } from "@/components/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ExternalLinkIcon, DownloadIcon, FileTextIcon } from "@/components/icons";
import { STATUS_OPTIONS, getPrimaryStatus } from "@/lib/resume-status";
import { cn } from "@/lib/utils";
import { usePersistedState } from "@/lib/use-persisted-state";
import type { ResumeSummary } from "@/lib/resumes/resumes";

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
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

function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <input
        type="date"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        aria-label="From"
        title="From"
        className="h-7 w-full rounded border border-input bg-transparent px-1 text-xs text-foreground"
      />
      <input
        type="date"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        aria-label="To"
        title="To"
        className="h-7 w-full rounded border border-input bg-transparent px-1 text-xs text-foreground"
      />
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
        <Link href={`/resumes/${row.original.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
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
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span>,
      filterFn: (row, id, value: string) => row.original.jobTitle.toLowerCase().includes(value.toLowerCase()),
    },
    {
      id: "status",
      accessorFn: (row) => getPrimaryStatus(row.statuses),
      header: "Status",
      size: 200,
      cell: ({ row }) => <StatusBadges statuses={row.original.statuses} />,
      filterFn: (row, id, value: string) => row.original.statuses.includes(value as never),
    },
    {
      id: "appliedByEmail",
      accessorKey: "appliedByEmail",
      header: "Applied By",
      size: 190,
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span>,
      filterFn: (row, id, value: string) => row.original.appliedByEmail.toLowerCase().includes(value.toLowerCase()),
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
      filterFn: (row, id, value: DateRange | undefined) => {
        if (!value?.from && !value?.to) return true;
        const applied = toDateInputValue(row.original.appliedAt);
        if (!applied) return false;
        if (value.from && applied < value.from) return false;
        if (value.to && applied > value.to) return false;
        return true;
      },
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
          <Link href={`/resumes/${row.original.id}`} className={buttonVariants("ghost", "sm")}>
            View
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
    data: resumes,
    columns,
    state: { sorting, columnFilters, columnSizing },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

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
    appliedByEmail: (
      <TextFilter
        value={(table.getColumn("appliedByEmail")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("appliedByEmail")?.setFilterValue(v)}
      />
    ),
    appliedAt: (
      <DateRangeFilter
        value={(table.getColumn("appliedAt")?.getFilterValue() as DateRange) ?? { from: "", to: "" }}
        onChange={(v) => table.getColumn("appliedAt")?.setFilterValue(v.from || v.to ? v : undefined)}
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
      <div className="w-full overflow-x-auto rounded-lg border border-border">
        <table style={{ width: table.getTotalSize(), tableLayout: "fixed" }} className="caption-bottom text-sm">
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
                  <td key={cell.id} style={{ width: cell.column.getSize() }} className="overflow-hidden p-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.getRowModel().rows.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">No rows match the current column filters.</p>
      )}
    </div>
  );
}
