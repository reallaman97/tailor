export function Footer() {
  return (
    <footer className="shrink-0 border-t border-border bg-card/40 px-4 py-6 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
        <p>© {new Date().getFullYear()} Visa. All rights reserved.</p>
      </div>
    </footer>
  );
}
