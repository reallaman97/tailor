import { redirect } from "next/navigation";
import { requireTeamContext, canManageInvoices } from "@/lib/auth/team-context";
import {
  getBidderBillingSummaries,
  listTeamInvoices,
  listBidderInvoices,
  getBiddingActivity,
} from "@/lib/payments/invoices";
import { AppShell } from "@/components/app-shell";
import { InterviewShell } from "@/components/interview-shell";
import { PageHeader } from "@/components/page-header";
import { InvoicesAdminView } from "./invoices-admin-view";
import { InvoicesBidderView } from "./invoices-bidder-view";

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function validKey(v?: string): string | undefined {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00.000Z`).getTime()) ? v : undefined;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requireTeamContext();
  const teamId = ctx.activeTeamId;
  if (!teamId) redirect("/");

  const teamName = ctx.teams.find((t) => t.id === teamId)?.name ?? null;
  const role = ctx.isServiceAdmin ? "SERVICE_ADMIN" : ctx.teamRole;

  if (canManageInvoices(ctx)) {
    const now = new Date();
    const defFrom = ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    const defTo = ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
    const sp = await searchParams;
    const fromKey = validKey(sp.from) ?? defFrom;
    const toKey = validKey(sp.to) ?? defTo;
    const from = new Date(`${fromKey}T00:00:00.000Z`);
    const to = new Date(`${toKey}T00:00:00.000Z`);

    const [summaries, invoices, activity] = await Promise.all([
      getBidderBillingSummaries(teamId, from, to),
      listTeamInvoices(teamId),
      getBiddingActivity(teamId, from, to),
    ]);

    const content = (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Invoices"
          description="Pick a date range, review each bidder's completed applications (paid vs unpaid), generate invoices, and mark them paid."
        />
        <InvoicesAdminView
          summaries={summaries}
          invoices={invoices}
          activity={activity}
          teamName={teamName}
          fromKey={fromKey}
          toKey={toKey}
        />
      </div>
    );
    return role === "MANAGER" ? (
      <InterviewShell isManager wide>
        {content}
      </InterviewShell>
    ) : (
      <AppShell userEmail={ctx.email} isSuperAdmin wide>
        {content}
      </AppShell>
    );
  }

  const invoices = await listBidderInvoices(teamId, ctx.userId);
  return (
    <AppShell userEmail={ctx.email} isSuperAdmin={false} wide>
      <div className="flex flex-col gap-6">
        <PageHeader title="Invoices & payments" description="Add your payment address to an invoice, and track what you've been paid." />
        <InvoicesBidderView invoices={invoices} />
      </div>
    </AppShell>
  );
}
