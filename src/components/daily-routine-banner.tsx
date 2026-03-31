interface DailyRoutineBannerProps {
  visible: boolean;
  isLoading?: boolean;
  onStart: () => void;
}

export function DailyRoutineBanner({
  visible,
  isLoading = false,
  onStart,
}: DailyRoutineBannerProps) {
  if (!visible) return null;
  return (
    <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 flex items-center justify-between gap-3">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        Denni check-in je pripraven.
      </p>
      <button
        onClick={onStart}
        disabled={isLoading}
        className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm disabled:opacity-60"
      >
        {isLoading ? "Nacitam..." : "Zacit"}
      </button>
    </div>
  );
}
