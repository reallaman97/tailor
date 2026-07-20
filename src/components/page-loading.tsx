import { LoaderIcon } from "@/components/icons";

export function PageLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoaderIcon className="size-6 text-muted-foreground" />
    </div>
  );
}
