export default function ProgressBar({ percent, done, total, showLabel = true, className = "" }) {
  const computedPercent =
    percent !== undefined
      ? percent
      : total
      ? Math.round((done / total) * 100)
      : 0;

  const clampedPercent = Math.min(100, Math.max(0, Math.round(computedPercent)));

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
          {done !== undefined && total !== undefined ? (
            <span>
              {done} of {total} done
            </span>
          ) : (
            <span>Progress</span>
          )}
          <span className="text-indigo-400 font-semibold">{clampedPercent}%</span>
        </div>
      )}
      <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-700/50">
        <div
          className="bg-indigo-600 h-full rounded-full transition-all duration-300 shadow-sm shadow-indigo-500/50"
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  );
}
