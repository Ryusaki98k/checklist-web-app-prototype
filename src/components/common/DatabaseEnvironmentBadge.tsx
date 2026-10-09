import { Database } from "lucide-react";

interface DatabaseEnvironmentBadgeProps {
  schema?: string;
  isPreview?: boolean;
  className?: string;
}

export function DatabaseEnvironmentBadge({
  schema = "checklist_prod",
  isPreview = false,
  className = "",
}: DatabaseEnvironmentBadgeProps) {
  return (
    <div
      title={
        isPreview
          ? `Preview Database: Schema "${schema}" (Safe isolated environment for bug fixes & testing)`
          : `Production Database: Schema "${schema}" (Live production system)`
      }
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-all select-none backdrop-blur-sm ${
        isPreview
          ? "bg-amber-500/10 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30 shadow-xs"
          : "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30 shadow-xs"
      } ${className}`}
      data-testid="db-schema-indicator"
    >
      <div className="relative flex items-center justify-center">
        <span
          className={`h-2 w-2 rounded-full ${
            isPreview ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
        <span
          className={`absolute h-2 w-2 rounded-full animate-ping opacity-75 ${
            isPreview ? "bg-amber-400" : "bg-emerald-400"
          }`}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <Database className="w-3.5 h-3.5 opacity-80 shrink-0" />
        <span className="font-semibold tracking-wide uppercase text-[10px]">
          {isPreview ? "Preview" : "Production"}
        </span>
        <span className="opacity-40">•</span>
        <code className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 opacity-90">
          {schema}
        </code>
      </div>
    </div>
  );
}
