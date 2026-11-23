import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-xl border border-line bg-white px-3 py-2 text-base text-navy outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-navy",
        className,
      )}
      {...props}
    />
  );
}
