type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-card border border-dashed border-cocm-ink/15 bg-white p-8 text-center shadow-card">
      <h3 className="font-serif text-2xl tracking-tight text-cocm-ink">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-cocm-slate">{description}</p>
    </div>
  );
}
