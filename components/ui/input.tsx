import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-navy outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-navy disabled:bg-background",
        className,
      )}
      {...props}
    />
  );
}
