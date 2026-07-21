"use client";

import type { Table } from "@tanstack/react-table";
import { Select } from "@/components/ui/select";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

function PageButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
    >
      {children}
    </button>
  );
}

/** Rows-per-page selector + page navigation for a TanStack table. */
export function TablePagination<T>({ table }: { table: Table<T> }) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(totalRows, (pageIndex + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>Rows per page</span>
        <Select
          value={String(pageSize)}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          className="h-8 w-auto pl-2 pr-7 text-sm"
          aria-label="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <span className="tabular-nums text-muted-foreground">
          {from}–{to} of {totalRows}
        </span>
        <div className="flex items-center gap-1">
          <PageButton onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} label="First page">
            «
          </PageButton>
          <PageButton onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} label="Previous page">
            ‹
          </PageButton>
          <span className="px-1 tabular-nums text-muted-foreground">
            Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
          </span>
          <PageButton onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} label="Next page">
            ›
          </PageButton>
          <PageButton
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
            label="Last page"
          >
            »
          </PageButton>
        </div>
      </div>
    </div>
  );
}
