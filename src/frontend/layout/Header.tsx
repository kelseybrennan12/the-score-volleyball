import type { DeploymentEnvironment } from "@frontend/auth/useAuthSession";
import { logoutAndRedirectToLogin } from "@frontend/auth/useAuthSession";
import { cn } from "@frontend/components/ui/class-names";
import { HEADER_NAV_ITEMS } from "@frontend/features/parity/navigation-topology";
import { ProjectStarterLogo } from "@frontend/layout/ProjectStarterLogo";
import { Link, useRouterState } from "@tanstack/react-router";
import type { UserRole } from "backend/runtime/adapters/infra/db/schema";
import { useEffect, useRef, useState } from "react";

export const resolveEnvironmentBadgeLabel = (deploymentEnvironment: DeploymentEnvironment | null): string | null => {
  if (deploymentEnvironment === "staging") {
    return "Staging";
  }

  if (deploymentEnvironment === "local") {
    return "Local";
  }

  return null;
};

export const Header = ({
  deploymentEnvironment,
  displayName,
  userRole,
}: {
  deploymentEnvironment: DeploymentEnvironment | null;
  displayName: string | null;
  userRole: UserRole | null;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const greetingName = displayName?.trim().split(/\s+/)[0] ?? "";
  const environmentBadgeLabel = resolveEnvironmentBadgeLabel(deploymentEnvironment);
  const navLinkClass =
    "content-stretch relative flex items-center justify-center gap-[8px] py-[6px] text-[14px] font-medium text-nav-text no-underline transition-colors after:absolute after:right-0 after:bottom-0 after:left-0 after:h-[2px] after:bg-transparent after:content-['']";
  const navLinkActiveClass = "font-bold after:bg-brand-blue";

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <header className="bg-header-bg content-stretch flex h-[60px] w-full items-center justify-between border-b border-header-border px-[40px] max-[1080px]:px-4 max-[720px]:h-auto max-[720px]:flex-col max-[720px]:items-start max-[720px]:gap-2.5 max-[720px]:py-3">
      <Link to="/" className="content-stretch flex flex-none items-center gap-[16px] text-nav-text no-underline">
        <ProjectStarterLogo className="h-[20px] w-[57px] shrink-0" />
        {displayName !== null || environmentBadgeLabel !== null ? (
          <span className="flex flex-wrap items-center gap-3">
            {displayName !== null ? (
              <span className="text-[13px] font-bold tracking-[0.02em] uppercase">PROJECT STARTER</span>
            ) : null}
            {environmentBadgeLabel !== null ? (
              <span className="inline-flex items-center rounded-full border border-header-overlay-border bg-header-overlay-bg px-2.5 py-1 text-[11px] font-bold tracking-[0.14em] uppercase text-nav-text">
                {environmentBadgeLabel}
              </span>
            ) : null}
          </span>
        ) : null}
      </Link>

      {displayName !== null && (
        <nav
          className="content-stretch flex h-[29px] min-w-0 flex-1 items-center justify-end gap-[48px] max-[1080px]:gap-4 max-[1080px]:overflow-x-auto max-[720px]:w-full max-[720px]:justify-start"
          aria-label="Primary Navigation"
        >
          {HEADER_NAV_ITEMS.map((item) => {
            const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

            return (
              <Link key={item.label} to={item.to as never} className={cn(navLinkClass, isActive && navLinkActiveClass)}>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {displayName !== null && (
        <div
          className="relative content-stretch flex flex-none items-center justify-center py-[6px] ml-[48px] max-[1080px]:ml-4"
          ref={menuRef}
        >
          <button
            className="content-stretch flex cursor-pointer items-center justify-center gap-[8px] whitespace-nowrap rounded-[4px] border border-transparent bg-transparent px-0 py-0 text-[14px] font-medium text-nav-text hover:bg-header-logout-hover-bg"
            onClick={() => setMenuOpen((prev) => !prev)}
            type="button"
          >
            <span>Hello, {greetingName}</span>
            <span aria-hidden="true" className="text-[10px] leading-none">
              ▼
            </span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+4px)] z-[100] min-w-full rounded-[4px] border border-header-border bg-header-bg py-1 shadow-lg">
              {userRole === "admin" && (
                <Link
                  className="block w-full px-3.5 py-2 text-left text-[14px] font-medium text-nav-text no-underline hover:bg-header-logout-hover-bg"
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                >
                  Settings
                </Link>
              )}
              <button
                className={cn(
                  "block w-full cursor-pointer border-0 bg-transparent px-3.5 py-2 text-left text-[14px] font-medium text-nav-text",
                  "hover:bg-header-logout-hover-bg",
                )}
                onClick={() => {
                  void logoutAndRedirectToLogin();
                }}
                type="button"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
