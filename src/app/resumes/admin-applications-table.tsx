"use client";

import { useMemo, useState, useTransition } from "react";
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
import { StatusMultiSelect } from "./status-select";
import { SourceSelect } from "./source-select";
import { ApprovalSelect } from "./approval-select";
import {
  bulkUpdateResumeStatusAction,
  bulkUpdateResumeApprovalAction,
  bulkDeleteResumesAction,
  deleteResumeAction,
} from "./actions";
import { usePersistedState } from "@/lib/use-persisted-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { ExternalLinkIcon, TrashIcon, DownloadIcon, FileTextIcon } from "@/components/icons";
import {
  ROLE_TRACK_LABEL,
  ROLE_TRACK_OPTIONS,
  SOURCE_OPTIONS,
  STATUS_OPTIONS,
  OPEN_STATUSES,
  getPrimaryStatus,
} from "@/lib/resume-status";
import { cn } from "@/lib/utils";
import type { AdminTrackerRow } from "@/lib/admin/applications";
import type { ResumeStatus } from "@/generated/prisma/client";

const DAY_MS = 86_400_000;
const APPROVAL_FILTER_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

function daysOpen(createdAt: Date): number {
  return Math.floor((Date.now() - createdAt.getTime()) / DAY_MS);
}

function needsFollowUp(statuses: ResumeStatus[], updatedAt: Date, followUpDate: Date | null): boolean {
  if (!OPEN_STATUSES.has(getPrimaryStatus(statuses))) return false;
  const daysSinceUpdate = Math.floor((Date.now() - updatedAt.getTime()) / DAY_MS);
  const followUpDue = followUpDate ? followUpDate.getTime() <= Date.now() : false;
  return daysSinceUpdate >= 7 || followUpDue;
}

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
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

export function AdminApplicationsTable({ applications }: { applications: AdminTrackerRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<ResumeStatus>("APPLIED");
  const [pending, startTransition] = useTransition();
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

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyBulkStatus() {
    const ids = [...selected];
    startTransition(async () => {
      await bulkUpdateResumeStatusAction(ids, bulkStatus);
      setSelected(new Set());
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
        header: () => null,
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
        id: "userEmail",
        accessorKey: "userEmail",
        header: "Applied By",
        size: 200,
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span>,
        filterFn: (row, id, value: string) =>
          row.original.userEmail.toLowerCase().includes(value.toLowerCase()),
      },
      {
        id: "profileName",
        accessorFn: (row) => row.profileName ?? "",
        header: "Profile",
        size: 160,
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>() || "—"}</span>,
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
            className="font-medium text-foreground hover:text-primary hover:underline"
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
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span>,
        filterFn: (row, id, value: string) => row.original.jobTitle.toLowerCase().includes(value.toLowerCase()),
      },
      {
        id: "status",
        accessorFn: (row) => getPrimaryStatus(row.statuses),
        header: "Status",
        size: 220,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <StatusMultiSelect resumeId={row.original.id} statuses={row.original.statuses} />
          </div>
        ),
        filterFn: (row, id, value: string) => row.original.statuses.includes(value as ResumeStatus),
      },
      {
        id: "roleTrack",
        accessorKey: "roleTrack",
        header: "Role track",
        size: 130,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{ROLE_TRACK_LABEL[getValue<AdminTrackerRow["roleTrack"]>()]}</span>
        ),
      },
      {
        id: "source",
        accessorKey: "source",
        header: "Source",
        size: 170,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <SourceSelect resumeId={row.original.id} source={row.original.source} />
          </div>
        ),
      },
      {
        id: "daysOpen",
        accessorFn: (row) => daysOpen(row.createdAt),
        header: "Days open",
        size: 90,
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<number>()}</span>,
        filterFn: (row, id, value: string) => {
          const min = Number(value);
          return value === "" || Number.isNaN(min) || daysOpen(row.original.createdAt) >= min;
        },
      },
      {
        id: "followUp",
        accessorFn: (row) => needsFollowUp(row.statuses, row.updatedAt, row.followUpDate),
        header: "Follow-up",
        size: 130,
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <Badge variant="warning">Needs follow-up</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        filterFn: (row, id, value: string) => {
          if (value === "") return true;
          const needs = needsFollowUp(row.original.statuses, row.original.updatedAt, row.original.followUpDate);
          return value === "yes" ? needs : !needs;
        },
      },
      {
        id: "updatedAt",
        accessorKey: "updatedAt",
        header: "Updated",
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<Date>().toLocaleDateString()}</span>
        ),
        filterFn: (row, id, value: string) => value === "" || toDateInputValue(row.original.updatedAt) === value,
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
        filterFn: (row, id, value: string) => value === "" || toDateInputValue(row.original.appliedAt) === value,
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
        size: 190,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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
    data: applications,
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
    userEmail: (
      <TextFilter
        value={(table.getColumn("userEmail")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("userEmail")?.setFilterValue(v)}
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
    status: (
      <SelectFilter
        value={(table.getColumn("status")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("status")?.setFilterValue(v || undefined)}
        options={STATUS_OPTIONS}
      />
    ),
    roleTrack: (
      <SelectFilter
        value={(table.getColumn("roleTrack")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("roleTrack")?.setFilterValue(v || undefined)}
        options={ROLE_TRACK_OPTIONS}
      />
    ),
    source: (
      <SelectFilter
        value={(table.getColumn("source")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("source")?.setFilterValue(v || undefined)}
        options={SOURCE_OPTIONS}
      />
    ),
    daysOpen: (
      <input
        type="number"
        min={0}
        placeholder="Min"
        value={(table.getColumn("daysOpen")?.getFilterValue() as string) ?? ""}
        onChange={(e) => table.getColumn("daysOpen")?.setFilterValue(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="h-7 w-full rounded border border-input bg-transparent px-1.5 text-xs text-foreground"
      />
    ),
    followUp: (
      <SelectFilter
        value={(table.getColumn("followUp")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("followUp")?.setFilterValue(v || undefined)}
        options={[
          { value: "yes", label: "Needs follow-up" },
          { value: "no", label: "OK" },
        ]}
      />
    ),
    updatedAt: (
      <DateFilter
        value={(table.getColumn("updatedAt")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("updatedAt")?.setFilterValue(v)}
      />
    ),
    appliedAt: (
      <DateFilter
        value={(table.getColumn("appliedAt")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("appliedAt")?.setFilterValue(v)}
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
          <Select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as ResumeStatus)}
            className="h-8 min-w-[9rem] text-sm"
            aria-label="Bulk status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Button type="button" size="sm" loading={pending} onClick={applyBulkStatus}>
            {pending ? "Adding…" : "Add status to selected"}
          </Button>
          <span className="h-5 w-px shrink-0 bg-border" />
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
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

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
