"use client";

import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { CalendarIcon } from "@/components/icons";
import { disconnectCalendarAction, syncNowAction } from "./calendar-actions";

type Connection = {
  provider: string;
  accountEmail: string | null;
  status: string;
  lastSyncedAt: Date | null;
  lastError: string | null;
};

const NOTICE: Record<string, { variant: "success" | "destructive"; text: string }> = {
  connected: { variant: "success", text: "Google Calendar connected — your events now appear on the calendar." },
  denied: { variant: "destructive", text: "Calendar connection was cancelled." },
  error: { variant: "destructive", text: "Couldn't connect the calendar. Please try again." },
  not_configured: { variant: "destructive", text: "Google Calendar isn't configured on the server yet." },
};

export function CalendarSync({
  configured,
  connection,
  notice,
}: {
  configured: boolean;
  connection: Connection | null;
  notice?: string;
}) {
  const [syncState, syncAction, syncing] = useActionState(syncNowAction, undefined);
  const noticeInfo = notice ? NOTICE[notice] : undefined;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Calendar sync</span>
          {connection &&
            (connection.status === "active" ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge variant="warning">Reconnect needed</Badge>
            ))}
        </div>

        <div className="flex items-center gap-2">
          {!configured ? (
            <span className="text-xs text-muted-foreground">Not configured on the server.</span>
          ) : !connection ? (
            <a href="/api/calendar/google/connect" className={buttonVariants("primary", "sm")}>
              Connect Google Calendar
            </a>
          ) : (
            <>
              {connection.status === "active" ? (
                <form action={syncAction}>
                  <Button type="submit" size="sm" variant="secondary" loading={syncing}>
                    {syncing ? "Syncing…" : "Sync now"}
                  </Button>
                </form>
              ) : (
                <a href="/api/calendar/google/connect" className={buttonVariants("primary", "sm")}>
                  Reconnect
                </a>
              )}
              <form action={disconnectCalendarAction}>
                <Button type="submit" size="sm" variant="outline">
                  Disconnect
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      {connection && (
        <p className="text-xs text-muted-foreground">
          {connection.accountEmail ? <span className="font-medium text-foreground">{connection.accountEmail}</span> : "Google Calendar"}
          {connection.lastSyncedAt
            ? ` · last synced ${connection.lastSyncedAt.toLocaleString()}`
            : " · not synced yet"}
          {connection.lastError ? ` · ${connection.lastError}` : ""}
        </p>
      )}

      {noticeInfo && <Alert variant={noticeInfo.variant}>{noticeInfo.text}</Alert>}
      {syncState?.message && <Alert variant="success">{syncState.message}</Alert>}
      {syncState?.error && <Alert variant="destructive">{syncState.error}</Alert>}
    </div>
  );
}
