import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { SignupsTabs } from "./_components/kit";

export const dynamic = "force-dynamic";

// Shared frame for the two Signups pages: the heading and the Customers / Sales reps tabs, each of
// which is its own page below.
export default async function SignupsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  const [customers, reps, pendingReps] = await Promise.all([
    prisma.customerSignup.count(),
    prisma.salesRepSignup.count(),
    prisma.salesRepSignup.count({ where: { status: "pending" } }),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 md:p-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-ink">Signups</h1>
        <p className="mt-1.5 text-sm font-medium text-ink/60">
          People who signed up through the public customer membership and sales rep pages.
        </p>
      </div>
      <SignupsTabs customers={customers} reps={reps} pendingReps={pendingReps} />
      {children}
    </div>
  );
}
