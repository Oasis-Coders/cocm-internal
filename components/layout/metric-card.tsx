type MetricCardProps = {
  label: string;
  value: string;
  helper: string;
};

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <article className="border-cocm-ink/8 rounded-card border bg-white px-3 py-3 shadow-card transition-shadow hover:shadow-card-hover md:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cocm-slate md:text-[11px] md:tracking-[0.2em]">{label}</p>
      <p className="mt-1 font-serif text-2xl tracking-tight text-cocm-ink md:mt-4 md:text-4xl">{value}</p>
      <p className="mt-1 hidden text-sm text-cocm-slate md:mt-3 md:block">{helper}</p>
    </article>
  );
}
