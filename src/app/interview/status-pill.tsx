/**
 * A single interview-status chip in its configured color. Pure (no hooks), so
 * it renders in both server and client components. Colors are data-driven from
 * InterviewStatus.color, so recoloring a status in Settings reflects everywhere.
 */
export function InterviewStatusPill({
  status,
}: {
  status: { label: string; color: string } | null;
}) {
  if (!status) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span
      title={status.label}
      className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border bg-card px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color: status.color,
        borderColor: status.color,
        boxShadow: `inset 0 0 8px ${status.color}4d, 0 0 3px ${status.color}33`,
      }}
    >
      {status.label}
    </span>
  );
}
