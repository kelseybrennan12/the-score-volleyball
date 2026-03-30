import { useEffect, useRef, useState } from "react";
import { cn } from "./ui/class-names";

export const MultiSelect = ({
  label,
  options,
  selected,
  onChange,
  className,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const triggerLabel = selected.size === 0 ? label : `${label} (${selected.size})`;
  const hasSelection = selected.size > 0;

  return (
    <div className={cn("relative w-[200px]", className)} ref={ref}>
      <button
        type="button"
        className={cn(
          "h-[35px] w-full rounded-[4px] border border-control-border bg-surface px-3 text-left text-[14px] text-text-primary",
          hasSelection ? "font-semibold" : "font-medium",
        )}
        onClick={() => setOpen((prev) => !prev)}
      >
        {triggerLabel}
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-10 flex min-w-full flex-col rounded-[8px] border border-border bg-surface py-1 shadow-[0_8px_18px_var(--color-card-shadow)]">
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[14px] text-text-primary hover:bg-bg-subtle"
            >
              <input
                type="checkbox"
                checked={selected.has(option)}
                className="h-[14px] w-[14px] accent-brand-blue"
                onChange={() => {
                  const next = new Set(selected);
                  if (next.has(option)) {
                    next.delete(option);
                  } else {
                    next.add(option);
                  }
                  onChange(next);
                }}
              />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
