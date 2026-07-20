import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "@/components/icons";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div className="relative inline-block">
      <select
        ref={ref}
        className={cn(
          "peer h-9 w-full appearance-none rounded-md border border-input bg-card py-1.5 pl-3 pr-8 text-sm text-foreground shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground peer-disabled:opacity-50" />
    </div>
  );
});
Select.displayName = "Select";
