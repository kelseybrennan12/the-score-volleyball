import type { ReactNode } from "react";

export function DivisionPill({ division, children }: { division: string; children?: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
      {children ?? division}
    </span>
  );
}

function courtDotClasses(court: string): string {
  const lower = court.toLowerCase();
  if (lower.includes("blue")) return "bg-blue-500";
  if (lower.includes("yellow")) return "bg-yellow-400";
  if (lower.includes("green")) return "bg-green-500";
  if (lower.includes("white")) return "bg-white border border-neutral-400";
  if (lower.includes("red")) return "bg-red-500";
  if (lower.includes("orange")) return "bg-orange-500";
  if (lower.includes("pink")) return "bg-pink-400";
  if (lower.includes("black")) return "bg-black";
  return "bg-neutral-300";
}

export function CourtLabel({ court }: { court: string }) {
  const expanded = court.replace(/\bCt\.?\b/gi, "Court");
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${courtDotClasses(court)}`} aria-hidden />
      {expanded}
    </span>
  );
}
