import { loadAdminConfig } from "@/backend/logic/services/admin-auth";
import { requireAdminRequest } from "@/backend/logic/services/admin-session";
import { AdminApp } from "@/components/admin-app";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!loadAdminConfig()) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-4 text-sm text-red-700">
          Admin endpoints are not configured. Set <code>ADMIN_PASSPHRASE</code> and <code>ADMIN_COOKIE_SECRET</code> to
          enable.
        </p>
      </main>
    );
  }
  const guard = await requireAdminRequest();
  if (!guard.ok) redirect("/");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <Link href="/" className="text-sm text-neutral-600 hover:underline">
          Back to viewer
        </Link>
      </header>
      <AdminApp />
    </main>
  );
}
