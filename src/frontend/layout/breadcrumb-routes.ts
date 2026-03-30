export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbRouteMatch {
  fullPath: string;
  params: Record<string, unknown>;
}

const toTitleCase = (value: string): string =>
  value
    .split(/[-_]/g)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const genericCrumbs = (fullPath: string): BreadcrumbItem[] => {
  const segments = fullPath.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return [];
  }

  return segments.map((segment, index) => ({
    label: toTitleCase(segment),
    to: index === segments.length - 1 ? undefined : `/${segments.slice(0, index + 1).join("/")}`,
  }));
};

export const buildAutoBreadcrumbs = (matches: BreadcrumbRouteMatch[]): BreadcrumbItem[] => {
  const leaf = matches[matches.length - 1];
  if (!leaf) {
    return [];
  }

  if (leaf.fullPath === "/" || leaf.fullPath === "/dashboard") {
    return [{ label: "Dashboard" }];
  }

  if (leaf.fullPath === "/database") {
    return [{ label: "Database" }];
  }

  if (leaf.fullPath === "/jobs") {
    return [{ label: "Jobs" }];
  }

  if (leaf.fullPath === "/settings") {
    return [{ label: "Settings" }];
  }

  return genericCrumbs(leaf.fullPath);
};
