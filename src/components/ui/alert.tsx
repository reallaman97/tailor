import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircleIcon, CheckCircleIcon } from "@/components/icons";

type Variant = "destructive" | "success" | "default";

const variantClasses: Record<Variant, string> = {
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  success: "border-success/30 bg-success/10 text-success",
  default: "border-border bg-muted text-foreground",
};

const icons: Record<Variant, React.ComponentType<{ className?: string }>> = {
  destructive: AlertCircleIcon,
  success: CheckCircleIcon,
  default: AlertCircleIcon,
};

export function Alert({
  className,
  variant = "default",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  const Icon = icons[variant];
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
