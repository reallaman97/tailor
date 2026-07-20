const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatMonthYear(date: string | null): string {
  if (!date) return "Present";
  const [year, month] = date.split("-");
  const index = Number(month) - 1;
  return index >= 0 && index < 12 ? `${MONTH_NAMES[index]} ${year}` : year;
}

export function formatOptionalDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && !end) return `${formatMonthYear(start)} - Present`;
  if (!start && end) return formatMonthYear(end);
  return `${formatMonthYear(start)} - ${formatMonthYear(end)}`;
}
