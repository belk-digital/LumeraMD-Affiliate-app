import { redirect } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import { getAdminSession } from "@/lib/admin/session";
import AdminLoginForm from "./AdminLoginForm";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (await getAdminSession()) redirect("/lumera-ops");

  const { error } = await searchParams;

  return (
    <AuthLayout
      headline="Run the affiliate program"
      blurb="Review applications, follow performance and keep payouts moving, all in one place."
      points={[
        {
          icon: "clipboard",
          title: "Review applications",
          body: "Approve new affiliates and create their link and code in one click.",
        },
        {
          icon: "chart",
          title: "Track performance",
          body: "Sales, conversions and commission across the whole program.",
        },
        {
          icon: "card",
          title: "Manage payouts",
          body: "Approve requests and mark them paid as you send the money.",
        },
      ]}
      title="Admin sign in"
      subtitle="Enter your admin email and we'll send you a one-time login link."
    >
      <AdminLoginForm initialError={typeof error === "string" ? error : undefined} />
    </AuthLayout>
  );
}
