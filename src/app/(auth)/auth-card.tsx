import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="mb-8 flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
          <Logo className="size-7 rounded-md" />
          Visa
        </div>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {children}
            {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
