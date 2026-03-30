import * as React from "react";
import { cn } from "./class-names";

export const Textarea = ({ className, ...props }: React.ComponentProps<"textarea">) => {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-16 w-full resize-none rounded-md border border-input bg-input-background px-3 py-2 text-base transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
};
