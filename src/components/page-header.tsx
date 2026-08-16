// Consistent editorial header for every module content area.
// Title + description on the left, optional actions/tabs on the right.
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass-panel relative overflow-hidden rounded-[28px] px-5 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-gradient-to-b from-rose via-mauve to-aqua" aria-hidden />
      <div className="min-w-0">
        <h1 className="text-[24px] font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[13.5px] leading-5 text-muted">{description}</p> : null}
      </div>
      {children ? <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">{children}</div> : null}
    </div>
  );
}
