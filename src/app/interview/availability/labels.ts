/** Pure display helpers shared by the availability editor and admin views. */

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const HOURS: number[] = Array.from({ length: 24 }, (_, h) => h);

/** "9 AM", "12 PM", "11 PM" — the start of the hour slot. */
export function hourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const hr = hour % 12 === 0 ? 12 : hour % 12;
  return `${hr} ${period}`;
}

export const slotKey = (dayOfWeek: number, hour: number) => `${dayOfWeek}-${hour}`;

export function parseSlotKey(key: string): { dayOfWeek: number; hour: number } {
  const [d, h] = key.split("-").map(Number);
  return { dayOfWeek: d, hour: h };
}
