import { redirect } from "next/navigation";
import { requireTeamContext, canManageInvoices } from "@/lib/auth/team-context";
import { getBidderBillingSummaries, listTeamInvoices, listBidderInvoices } from "@/lib/payments/invoices";
import { AppShell } from "@/components/app-shell";
import { InterviewShell } from "@/components/interview-shell";
import { PageHeader } from "@/components/page-header";
import { InvoicesAdminView } from "./invoices-admin-view";
import { InvoicesBidderView } from "./invoices-bidder-view";

export default async function InvoicesPage() {
  const ctx = await requireTeamContext();
  const teamId = ctx.activeTeamId;
  if (!teamId) redirect("/");

  const teamName = ctx.teams.find((t) => t.id === teamId)?.name ?? null;
  const role = ctx.isServiceAdmin ? "SERVICE_ADMIN" : ctx.teamRole;

  // Managers / team admins manage; everyone else (bidders) sees their own.
  if (canManageInvoices(ctx)) {
    const [summaries, invoices] = await Promise.all([getBidderBillingSummaries(teamId), listTeamInvoices(teamId)]);
    const content = (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Invoices"
          description="Generate invoices for your bidders' completed applications, then mark them paid with a payment link."
        />
        <InvoicesAdminView summaries={summaries} invoices={invoices} teamName={teamName} />
      </div>
    );
    // A Manager lives in Interview Management; team/service admins in the Resume Platform.
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
