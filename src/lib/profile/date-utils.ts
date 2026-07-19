/** Converts a Prisma DateTime to a YYYY-MM-DD string for date inputs, in UTC to avoid timezone drift. */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Converts a YYYY-MM-DD string from a date input into a UTC-midnight Date for storage. */
export function fromDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
