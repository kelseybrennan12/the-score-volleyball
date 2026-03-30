import { redirectToLogin } from "@frontend/auth/redirect";
import { logoutAndRedirectToLogin, useAuthSession, useAuthSessionHeartbeat } from "@frontend/auth/useAuthSession";
import { Layout } from "@frontend/layout/Layout";
import { Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";

const authPanelButtonClassName =
  "inline-flex min-h-[44px] items-center justify-center rounded-[6px] px-[22px] py-[10px] text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2";

const AuthGatePanel = ({
  eyebrow,
  title,
  body,
  actions,
  tone = "default",
}: {
  eyebrow: string;
  title: string;
  body: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "error" | "warning";
}) => {
  const accentClassName =
    tone === "error"
      ? "from-danger to-[#f06a6a]"
      : tone === "warning"
        ? "from-[#c77a00] to-[#f0b34d]"
        : "from-header-bg to-brand-blue";

  const badgeClassName =
    tone === "error"
      ? "border-danger-border bg-danger-bg text-danger-text"
      : tone === "warning"
        ? "border-warning-border bg-warning-bg text-warning-text"
        : "border-[#cfe4f4] bg-[#eef7fd] text-[#20638e]";

  return (
    <section className="mx-auto flex min-h-full w-full max-w-[1240px] items-center justify-center px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-[24px] border border-white/70 bg-white/95 shadow-[0_24px_60px_rgba(4,30,65,0.16)] backdrop-blur">
        <div className={`h-[10px] w-full bg-gradient-to-r ${accentClassName}`} />
        <div
          className="absolute right-0 top-0 h-[180px] w-[180px] rounded-full bg-[#419bd8]/8 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative px-6 py-7 sm:px-8 sm:py-9">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold tracking-[0.14em] uppercase ${badgeClassName}`}
          >
            {eyebrow}
          </span>
          <div className="mt-5 space-y-3">
            <h2 className="text-[30px] leading-[1.05] font-medium text-text-primary sm:text-[34px]">{title}</h2>
            <div className="max-w-[44ch] text-[15px] leading-6 text-text-secondary">{body}</div>
          </div>
          {actions ? <div className="mt-7 flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
};

export const AppShell = () => {
  const auth = useAuthSession();
  useAuthSessionHeartbeat(auth.authenticated && auth.user !== null);

  if (auth.loading) {
    return (
      <Layout deploymentEnvironment={auth.deploymentEnvironment}>
        <AuthGatePanel
          eyebrow="Session Check"
          title="Signing You In"
          body={<p>Checking your session and restoring access to Project Starter.</p>}
        />
      </Layout>
    );
  }

  if (auth.error) {
    return (
      <Layout deploymentEnvironment={auth.deploymentEnvironment}>
        <AuthGatePanel
          eyebrow="Login Issue"
          title="Unable to Verify Session"
          tone="error"
          body={
            <>
              <p>{auth.error}</p>
              <p className="mt-3">
                Try signing in again. If the issue persists, contact an AW&amp;S Tracking administrator.
              </p>
            </>
          }
          actions={
            <button
              className={`${authPanelButtonClassName} bg-brand-blue text-nav-text hover:bg-brand-blue-hover`}
              onClick={() => redirectToLogin()}
              type="button"
            >
              Sign In Again
            </button>
          }
        />
      </Layout>
    );
  }

  if (!auth.authenticated || !auth.user) {
    return (
      <Layout deploymentEnvironment={auth.deploymentEnvironment}>
        <AuthGatePanel
          eyebrow="Welcome"
          title="Sign In Required"
          body={
            <>
              <p>Sign in with your organization account to access Project Starter.</p>
              <p className="mt-3">This workspace is limited to authenticated Project Starter users.</p>
            </>
          }
          actions={
            <button
              className={`${authPanelButtonClassName} bg-brand-blue text-nav-text hover:bg-brand-blue-hover`}
              onClick={() => redirectToLogin()}
              type="button"
            >
              Sign In
            </button>
          }
        />
      </Layout>
    );
  }

  if (!auth.user.isAuthorized || !auth.user.isActive) {
    return (
      <Layout deploymentEnvironment={auth.deploymentEnvironment}>
        <AuthGatePanel
          eyebrow="Access Restricted"
          title="Access Denied"
          tone="warning"
          body={
            <>
              <p>Your account is authenticated, but it does not have access to Project Starter yet.</p>
              <p className="mt-3">Contact your administrator to request permissions, then sign in again.</p>
            </>
          }
          actions={
            <button
              className={`${authPanelButtonClassName} border border-control-border bg-surface text-text-primary hover:bg-bg-subtle`}
              onClick={() => {
                void logoutAndRedirectToLogin();
              }}
              type="button"
            >
              Sign Out
            </button>
          }
        />
      </Layout>
    );
  }

  return (
    <Layout
      deploymentEnvironment={auth.deploymentEnvironment}
      displayName={auth.user.displayName}
      userRole={auth.user.role}
    >
      <Outlet />
    </Layout>
  );
};
