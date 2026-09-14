'use client';

type DeleteDayButtonProps = {
  date: string;
  label: string;
  confirmMessage: string;
  action: () => Promise<void>;
};

export function DeleteDayButton({ label, confirmMessage, action }: DeleteDayButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        aria-label={label}
        title={label}
        className="rounded-lg px-3 py-1.5 text-sm font-semibold text-cocm-slate hover:bg-cocm-red/10 hover:text-cocm-red"
      >
        ×
      </button>
    </form>
  );
}
