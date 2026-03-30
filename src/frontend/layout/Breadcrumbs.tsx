import { buildAutoBreadcrumbs, type BreadcrumbItem } from "@frontend/layout/breadcrumb-routes";
import { useMatches, useRouter } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export type { BreadcrumbItem };

interface BreadcrumbsContextValue {
  autoItems: BreadcrumbItem[];
  items: BreadcrumbItem[];
  setBreadcrumbs: Dispatch<SetStateAction<BreadcrumbItem[] | null>>;
}

const BreadcrumbsContext = createContext<BreadcrumbsContextValue | null>(null);
const DASHBOARD_CRUMB: BreadcrumbItem = { label: "Dashboard", to: "/" };

export const BreadcrumbsProvider = ({ children }: { children: ReactNode }) => {
  const routeMatches = useMatches({
    select: (matches) =>
      matches.map((match) => ({ fullPath: match.fullPath, params: match.params as Record<string, unknown> })),
  });
  const autoItems = useMemo(() => buildAutoBreadcrumbs(routeMatches), [routeMatches]);
  const leafFullPath = routeMatches[routeMatches.length - 1]?.fullPath;
  const [overrideItems, setBreadcrumbs] = useState<BreadcrumbItem[] | null>(null);
  const baseItems = overrideItems ?? autoItems;
  const items = useMemo(() => {
    if (!leafFullPath || leafFullPath === "/" || leafFullPath === "/dashboard") {
      return baseItems;
    }

    if (baseItems[0]?.label === DASHBOARD_CRUMB.label) {
      return baseItems;
    }

    return [DASHBOARD_CRUMB, ...baseItems];
  }, [baseItems, leafFullPath]);
  const value = useMemo(() => ({ autoItems, items, setBreadcrumbs }), [autoItems, items, setBreadcrumbs]);
  return <BreadcrumbsContext.Provider value={value}>{children}</BreadcrumbsContext.Provider>;
};

export const useBreadcrumbs = (): BreadcrumbsContextValue => {
  const context = useContext(BreadcrumbsContext);
  if (!context) {
    throw new Error("useBreadcrumbs must be used within BreadcrumbsProvider");
  }
  return context;
};

export const usePageBreadcrumbs = (items: BreadcrumbItem[] | null) => {
  const { setBreadcrumbs } = useBreadcrumbs();

  useLayoutEffect(() => {
    setBreadcrumbs(items);
    return () => {
      setBreadcrumbs(null);
    };
  }, [items, setBreadcrumbs]);
};

export const BreadcrumbsBar = () => {
  const { items } = useBreadcrumbs();
  const router = useRouter();
  const crumbTextClass = "text-[14px] font-medium leading-none";

  return (
    <nav
      className="bg-surface flex h-[48px] w-full items-center gap-[16px] border-b border-border px-[16px] max-[720px]:min-h-[40px] max-[720px]:overflow-x-auto max-[720px]:py-[6px]"
      aria-label="Breadcrumb"
    >
      {items.length === 0 ? <span className="inline-block h-px w-px" /> : null}
      <div className="flex items-center gap-[8px] overflow-hidden">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <div key={`${item.label}:${index}`} className="flex items-center gap-[8px] whitespace-nowrap">
              {index > 0 ? <ChevronRight size={16} className="text-border-strong" aria-hidden="true" /> : null}
              {item.to && !isLast ? (
                <button
                  className={`${crumbTextClass} cursor-pointer border-0 bg-transparent p-0 text-brand-blue hover:underline`}
                  onClick={() => {
                    void router.navigate({ to: item.to as never });
                  }}
                  type="button"
                >
                  {item.label}
                </button>
              ) : (
                <span className={`${crumbTextClass} text-text-primary`}>{item.label}</span>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
};
