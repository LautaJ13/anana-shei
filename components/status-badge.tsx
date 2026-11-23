import { STATUS_LABEL, type AppointmentStatus } from "@/lib/labels";
import { cn } from "@/lib/utils";

const styles: Record<AppointmentStatus, string> = {
  pending: "bg-amber-100 text-amber-950",
  confirmed: "bg-teal/20 text-navy",
  completed: "bg-slate-200 text-slate-800",
  cancelled: "bg-rose-100 text-rose-950",
  no_show: "bg-orange-100 text-orange-950",
};

export function StatusBadge({ status }: { status: string }) {
  const key = (status in STATUS_LABEL ? status : "pending") as AppointmentStatus;
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", styles[key])}>{STATUS_LABEL[key]}</span>;
}
