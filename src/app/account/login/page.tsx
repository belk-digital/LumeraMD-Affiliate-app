import { redirect } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import { getCustomerSession } from "@/lib/customers/session";
import CustomerLoginForm from "./CustomerLoginForm";

export const metadata = { title: "Member login · LumeraMD" };

export default async function MemberLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (await getCustomerSession()) redirect("/account");
  const error = (await searchParams).error;

  return (
    <AuthLayout
      headline="Your membership, in one place"
      blurb="See your plan, your member discount code and your included consultations."
      points={[
        { icon: "card", title: "Your plan and status", body: "Know when your membership renews." },
        { icon: "chart", title: "Member discount", body: "Your personal code for savings on web pricing." },
        { icon: "cursor", title: "Consultations and test kits", body: "Track what's included and your member price." },
      ]}
      title="Member login"
      subtitle="Enter the email you signed up with and we'll send you a login link."
    >
      <CustomerLoginForm initialError={typeof error === "string" ? error : undefined} />
    </AuthLayout>
  );
}
