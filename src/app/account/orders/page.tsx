import { requireCustomer } from "@/lib/customers/requireCustomer";
import { listMemberOrders } from "@/lib/shopify/orders";
import AccountShell from "../AccountShell";
import { affiliateIdFor } from "@/lib/customers/crossLinks";
import { Page, PageHeader } from "../ui";
import OrdersClient from "./OrdersClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders · LumeraMD" };

export default async function OrdersPage() {
  const customer = await requireCustomer();
  const { orders, error } = await listMemberOrders(customer.email);

  return (
    <AccountShell
      name={`${customer.firstName} ${customer.lastName}`.trim()}
      email={customer.email}
      affiliateId={await affiliateIdFor(customer.email)}
    >
      <Page>
        <PageHeader title="Orders" subtitle="Track and review your store orders." />
        <OrdersClient orders={orders} error={error} email={customer.email} />
      </Page>
    </AccountShell>
  );
}
