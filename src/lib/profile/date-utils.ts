/** Converts a Prisma DateTime to a YYYY-MM string for month inputs, in UTC to avoid timezone drift. */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Converts a YYYY-MM string from a month input into a UTC-midnight Date (the 1st of that month) for storage. */
export function fromDateOnly(value: string): Date {
  return new Date(`${value}-01T00:00:00.000Z`);
}

/** Formats a YYYY-MM string as MM/YYYY for display. */
export function formatYearMonth(value: string): string {
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}
