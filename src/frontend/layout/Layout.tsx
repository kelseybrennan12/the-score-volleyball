import type { DeploymentEnvironment } from "@frontend/auth/useAuthSession";
import { cn } from "@frontend/components/ui/class-names";
import { BreadcrumbsBar, BreadcrumbsProvider } from "@frontend/layout/Breadcrumbs";
import { Header } from "@frontend/layout/Header";
import type { UserRole } from "backend/runtime/adapters/infra/db/schema";
import type { ReactNode } from "react";

export const Layout = ({
  children,
  displayName,
  deploymentEnvironment,
  userRole,
}: {
  children: ReactNode;
  displayName?: string | null;
  deploymentEnvironment?: DeploymentEnvironment | null;
  userRole?: UserRole | null;
}) => {
  const authenticated = displayName != null;
  return (
    <BreadcrumbsProvider>
      <div
        className={cn(
          "grid min-h-screen bg-bg",
          authenticated
            ? "grid-rows-[60px_48px_minmax(0,1fr)] max-[720px]:grid-rows-[auto_auto_minmax(0,1fr)]"
            : "grid-rows-[60px_minmax(0,1fr)]",
        )}
      >
        <Header
          deploymentEnvironment={deploymentEnvironment ?? null}
          displayName={displayName ?? null}
          userRole={userRole ?? null}
        />
        {authenticated && <BreadcrumbsBar />}
        <main className="overflow-y-auto bg-gradient-to-b from-content-gradient-start to-content-gradient-end">
          {children}
        </main>
      </div>
    </BreadcrumbsProvider>
  );
};
