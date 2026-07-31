import { requireSuperAdmin } from "@/lib/auth/require-user";
import { AccountShell } from "@/components/account-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { DownloadIcon } from "@/components/icons";
import { getSettings } from "@/lib/settings";
import { RESUME_STYLES, styleKeyFromAppDefault } from "@/lib/export/styles";

export default async function TemplatesPage() {
  await requireSuperAdmin();
  const settings = await getSettings();
  const appDefaultKey = styleKeyFromAppDefault(settings.resumeTemplate);

  return (
    <AccountShell isSuperAdmin wide>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Resume Templates"
          description="Ten built-in PDF styles. Preview any of them, then assign one per candidate on their profile page. All styles are single-column and ATS-safe."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESUME_STYLES.map((style) => (
            <Card key={style.key} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{style.name}</CardTitle>
                  {style.key === appDefaultKey && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      App default
                    </span>
                  )}
                </div>
                <CardDescription>{style.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-full" style={{ backgroundColor: style.accent }} />
                  <span className="text-xs text-muted-foreground">{style.bodyFont.replace("-Roman", "")}</span>
                </span>
                <a
                  href={`/api/resume-templates/${style.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants("outline", "sm") + " ml-auto"}
                >
                  <DownloadIcon className="size-4" />
                  Preview
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AccountShell>
  );
}
