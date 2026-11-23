import { cn } from "@/lib/utils";

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={inverted ? "#49B8AD" : "#17324D"} />
        <path d="M7 21c3.2-7 14.8-7 18 0" fill="none" stroke={inverted ? "#17324D" : "#49B8AD"} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="16" cy="12.5" r="2" fill={inverted ? "#17324D" : "#49B8AD"} />
      </svg>
      <span className={inverted ? "text-white" : "text-navy"}>Alba</span>
    </span>
  );
}
