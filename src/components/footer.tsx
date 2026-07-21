export function Footer() {
  return (
    <footer className="shrink-0 border-t border-border bg-card/40 px-4 py-6 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
        <p>
          © {new Date().getFullYear()}{" "}
          <a
            href="https://alpusconsulting.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline"
          >
            Alpus Consulting LLC
          </a>
          . All rights reserved.
        </p>
        <p>Cute Job Platform is a product of Alpus Consulting LLC.</p>
      </div>
    </footer>
  );
}
