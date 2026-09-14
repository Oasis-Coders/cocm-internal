type MetricCardProps = {
  label: string;
  value: string;
  helper: string;
};

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <article className="card-hover rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card md:p-6">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cocm-slate">
        <span className="h-1 w-1 rounded-full bg-cocm-red" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-3 font-serif text-4xl tracking-tight text-cocm-ink">{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-cocm-slate">{helper}</p>
    </article>
  );
}
