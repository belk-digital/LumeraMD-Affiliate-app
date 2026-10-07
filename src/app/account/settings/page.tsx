import { requireCustomer } from "@/lib/customers/requireCustomer";
import AccountShell from "../AccountShell";
import { affiliateIdFor } from "@/lib/customers/crossLinks";
import { LogoutButton } from "../AccountClient";
import { Card, Page, PageHeader } from "../ui";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account Settings · LumeraMD" };

export default async function SettingsPage() {
  const customer = await requireCustomer();

  return (
    <AccountShell
      name={`${customer.firstName} ${customer.lastName}`.trim()}
      email={customer.email}
      affiliateId={await affiliateIdFor(customer.email)}
    >
      <Page>
        <PageHeader title="Account Settings" subtitle="Manage your profile." />

        <Card title="Profile" icon="user">
          <ProfileForm
            firstName={customer.firstName}
            lastName={customer.lastName}
            phone={customer.phone ?? ""}
            email={customer.email}
          />
        </Card>

        <Card title="Signing in" icon="mail">
          <p className="text-sm text-ink/60">
            There&apos;s no password to remember. Each time you sign in we email a one-time link to {customer.email}.
          </p>
          <div className="mt-4">
            <LogoutButton />
          </div>
        </Card>
      </Page>
    </AccountShell>
  );
}
