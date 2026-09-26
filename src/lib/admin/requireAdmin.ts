import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";

/** For API routes. */
export async function requireAdminOrResponse() {
  const session = await getAdminSession();
  if (!session) {
    return { session: null, error: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

/** For pages: called next to the data access, since layouts don't re-run on client navigations. */
export async function requireAdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/lumera-ops/login");
  return session;
}
