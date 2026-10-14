import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "@/components/icons";

/**
 * Search across ALL applications (no date window) — see searchApplications.
 * A plain GET form: the query lives in the URL (`?q=`), so results survive a
 * refresh and can be linked to.
 */
export function ApplicationSearchBox({
  action,
  query,
  placeholder = "Search all applications — company, title, candidate, bidder, or link",
  hidden,
}: {
  action: string;
  query: string;
  placeholder?: string;
  /** Other query params to keep (e.g. the current tab). */
  hidden?: Record<string, string>;
}) {
  return (
    <form action={action} method="get" role="search" className="flex flex-wrap items-center gap-2">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="relative min-w-[16rem] flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={query} placeholder={placeholder} aria-label="Search applications" className="pl-9" />
      </div>
      <Button type="submit" variant="outline">
        Search
      </Button>
      {query && (
        <Link href={action} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          Clear
        </Link>
      )}
    </form>
  );
}
