"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { CalendarIcon } from "@/components/icons";
import { InterviewStatusPill } from "@/app/interview/status-pill";
import { formatInterviewTime, zonedDayKey } from "@/lib/interview/timezone";
import type { InterviewSummary } from "@/lib/interview/interviews";

type Option = { id: string; label: string };
const PAGE_SIZE = 25;

/**
 * Client-side filterable table of interviews. The server already scopes rows to
 * what the viewer may see (a Caller only receives their own), so filtering here
 * is purely a convenience over that set. Columns and filters intentionally track
 * the field registry's list/filterable flags (see src/lib/interview/fields.ts).
 */
export function InterviewsTable({
  interviews,
  timezone,
  isManager,
  statuses,
  stages,
  callers,
}: {
  interviews: InterviewSummary[];
  timezone: string;
  isManager: boolean;
  statuses: Option[];
  stages: Option[];
  callers: Option[];
}) {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [statusId, setStatusId] = useState("");
  const [stageId, setStageId] = useState("");
  const [callerId, setCallerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return interviews.filter((i) => {
      if (company && !i.companyName.toLowerCase().includes(company.toLowerCase())) return false;
      if (statusId && i.status?.id !== statusId) return false;
      if (stageId && i.stage?.id !== stageId) return false;
      if (callerId && i.caller?.id !== callerId) return false;
      if (from || to) {
        if (!i.scheduledAt) return false;
        const day = zonedDayKey(i.scheduledAt, timezone);
        if (from && day < from) return false;
        if (to && day > to) return false;
      }
      return true;
    });
  }, [interviews, company, statusId, stageId, callerId, from, to, timezone]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const resetPage = () => setPage(0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Company">
          <Input
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              resetPage();
            }}
            placeholder="Search…"
            className="h-8 w-40"
          />
        </Field>
        <Field label="Status">
          <FilterSelect value={statusId} onChange={(v) => { setStatusId(v); resetPage(); }} options={statuses} allLabel="All statuses" />
        </Field>
        <Field label="Stage">
          <FilterSelect value={stageId} onChange={(v) => { setStageId(v); resetPage(); }} options={stages} allLabel="All stages" />
        </Field>
        {isManager && (
          <Field label="Caller">
            <FilterSelect value={callerId} onChange={(v) => { setCallerId(v); resetPage(); }} options={callers} allLabel="All callers" />
          </Field>
        )}
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} className="h-8 w-36" />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} className="h-8 w-36" />
        </Field>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarIcon} title="No interviews match" description="Try clearing a filter." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Caller</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((i) => (
                  <TableRow
                    key={i.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/interview/${i.id}`)}
                  >
                    <TableCell className="font-medium text-foreground">{i.companyName}</TableCell>
                    <TableCell>{i.jobTitle}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {i.scheduledAt ? formatInterviewTime(i.scheduledAt, timezone) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.stage?.label ?? "—"}</TableCell>
                    <TableCell>
                      <InterviewStatusPill status={i.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.caller?.name ?? "Unassigned"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {filtered.length} interview{filtered.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>
                Previous
              </Button>
              <span>
                Page {current + 1} of {pageCount}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={current >= pageCount - 1}
                onClick={() => setPage(current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  allLabel: string;
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-40 text-sm">
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
