"use client";

import Link from "next/link";
import { useMemo } from "react";
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
import { RoleSelect } from "./role-select";
import { ApprovalSelect } from "./approval-select";
import { ProfileSelect } from "./profile-select";
import { deleteUserAction } from "./actions";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TrashIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { usePersistedState } from "@/lib/use-persisted-state";
import type { AdminUserSummary } from "@/lib/admin/users";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
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

export function UsersTable({
  users,
  adminId,
  profiles,
}: {
  users: AdminUserSummary[];
  adminId: string;
  profiles: Array<{ id: string; fullName: string | null }>;
}) {
  const [sorting, setSorting] = usePersistedState<SortingState>("admin-users-table:sorting", []);
  const [columnFilters, setColumnFilters] = usePersistedState<ColumnFiltersState>(
    "admin-users-table:columnFilters",
    []
  );
  const [columnSizing, setColumnSizing] = usePersistedState<ColumnSizingState>(
    "admin-users-table:columnSizing",
    {}
  );

  const columns = useMemo<ColumnDef<AdminUserSummary>[]>(
    () => [
      {
        id: "username",
        accessorKey: "username",
        header: "Username",
        size: 200,
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.username}
            {row.original.id === adminId && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>
            )}
          </span>
        ),
        filterFn: (row, id, value: string) => row.original.username.toLowerCase().includes(value.toLowerCase()),
      },
      {
        id: "email",
        accessorKey: "email",
        header: "Email",
        size: 240,
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span>,
        filterFn: (row, id, value: string) => row.original.email.toLowerCase().includes(value.toLowerCase()),
      },
      {
        id: "approved",
        accessorFn: (row) => (row.approved ? "true" : "false"),
        header: "Approval",
        size: 190,
        cell: ({ row }) => (
          <ApprovalSelect
            userId={row.original.id}
            approved={row.original.approved}
            disabled={row.original.id === adminId}
          />
        ),
        filterFn: (row, id, value: string) => (row.original.approved ? "true" : "false") === value,
      },
      {
        id: "role",
        accessorKey: "role",
        header: "Role",
        size: 210,
        cell: ({ row }) => (
          <RoleSelect userId={row.original.id} role={row.original.role} disabled={row.original.id === adminId} />
        ),
        filterFn: (row, id, value: string) => row.original.role === value,
      },
      {
        id: "assignedProfileName",
        accessorFn: (row) => row.assignedProfileName ?? "",
        header: "Assigned profile",
        size: 260,
        cell: ({ row }) => (
          <ProfileSelect
            userId={row.original.id}
            profileId={row.original.assignedProfileId}
            profiles={profiles}
            disabled={row.original.id === adminId}
          />
        ),
        filterFn: (row, id, value: string) =>
          (row.original.assignedProfileName ?? "").toLowerCase().includes(value.toLowerCase()),
      },
      {
        id: "approvedApplicationsCount",
        accessorKey: "approvedApplicationsCount",
        header: "Successful applications",
        size: 150,
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<number>()}</span>,
        filterFn: (row, id, value: string) => {
          const min = Number(value);
          return value === "" || Number.isNaN(min) || row.original.approvedApplicationsCount >= min;
        },
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: "Joined",
        size: 130,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<Date>().toLocaleDateString()}</span>
        ),
        filterFn: (row, id, value: string) => value === "" || toDateInputValue(row.original.createdAt) === value,
      },
      {
        id: "actions",
        header: "Actions",
        size: 120,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Link
              href={`/admin/users/${row.original.id}`}
              aria-label={`Edit ${row.original.email}`}
              className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
            >
              Edit
            </Link>
            {row.original.id !== adminId && (
              <ConfirmDialog
                title="Delete this user?"
                description={`This permanently deletes ${row.original.email}'s account and all generated resumes. Their assigned profile is untouched. This cannot be undone.`}
                action={deleteUserAction.bind(null, row.original.id)}
                triggerVariant="ghost"
                triggerSize="icon"
                triggerClassName="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                triggerLabel={`Delete ${row.original.email}`}
                triggerContent={<TrashIcon className="size-4" />}
              />
            )}
          </div>
        ),
      },
    ],
    [adminId, profiles]
  );

  const table = useReactTable({
    data: users,
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
    username: (
      <TextFilter
        value={(table.getColumn("username")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("username")?.setFilterValue(v)}
      />
    ),
    email: (
      <TextFilter
        value={(table.getColumn("email")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("email")?.setFilterValue(v)}
      />
    ),
    approved: (
      <SelectFilter
        value={(table.getColumn("approved")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("approved")?.setFilterValue(v || undefined)}
        options={[
          { value: "true", label: "Approved" },
          { value: "false", label: "Pending" },
        ]}
      />
    ),
    role: (
      <SelectFilter
        value={(table.getColumn("role")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("role")?.setFilterValue(v || undefined)}
        options={[
          { value: "BIDDER", label: "Bidder" },
          { value: "CALLER", label: "Caller" },
          { value: "MANAGER", label: "Manager" },
          { value: "SUPERADMIN", label: "Superadmin" },
        ]}
      />
    ),
    assignedProfileName: (
      <TextFilter
        value={(table.getColumn("assignedProfileName")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("assignedProfileName")?.setFilterValue(v)}
      />
    ),
    approvedApplicationsCount: (
      <input
        type="number"
        min={0}
        placeholder="Min"
        value={(table.getColumn("approvedApplicationsCount")?.getFilterValue() as string) ?? ""}
        onChange={(e) => table.getColumn("approvedApplicationsCount")?.setFilterValue(e.target.value)}
        className="h-7 w-full rounded border border-input bg-transparent px-1.5 text-xs text-foreground"
      />
    ),
    createdAt: (
      <DateFilter
        value={(table.getColumn("createdAt")?.getFilterValue() as string) ?? ""}
        onChange={(v) => table.getColumn("createdAt")?.setFilterValue(v)}
      />
    ),
  };

  return (
    <div className="flex flex-col gap-3">
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
