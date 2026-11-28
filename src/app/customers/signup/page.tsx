import SignupLayout from "@/components/SignupLayout";
import { getInviter } from "@/lib/signup";
import CustomerForm from "./CustomerForm";
import { getCatalog } from "@/lib/membership/plans.server";

export const metadata = { title: "Join LumeraMD · Membership" };

export default async function CustomerSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const inviter = await getInviter((await searchParams).ref);
  const catalog = await getCatalog();
  const discounts = catalog.customerPlans.map((p) => `${p.webDiscountPercent}%`);
  const discountText = `${discounts.slice(0, -1).join(", ")} or ${discounts[discounts.length - 1]} off web pricing, depending on your plan.`;
  const kitPlans = catalog.customerPlans.filter((p) => p.testKitPrice !== undefined);
  const kitText = `Test kits are $${catalog.testKitPrice}${
    kitPlans.length ? `, or ${kitPlans.map((p) => `$${p.testKitPrice} with ${p.name}`).join(" and ")}` : ""
  }.`;

  return (
    <SignupLayout
      headline="Better pricing, built into your"
      accent="membership"
      blurb="Choose a monthly plan for member discounts on web pricing. Your monthly fee goes toward your telehealth calls."
      points={[
        { icon: "cart", title: "Save on every order", body: discountText },
        { icon: "wallet", title: "Fees go toward your care", body: "Monthly fees are applied to your telehealth calls." },
        { icon: "dna", title: "DNA testing", body: kitText },
      ]}
      title="Choose your membership"
      subtitle="Tell us about you and pick a plan."
    >
      {inviter && (
        <p className="animate-fade-up mb-4 rounded-xl bg-primary-light px-4 py-3 text-sm text-primary">
          {inviter.displayName
            ? `You were invited by ${inviter.displayName}.`
            : "You were invited by a LumeraMD representative."}
        </p>
      )}
      <CustomerForm referralSlug={inviter?.slug} plans={catalog.customerPlans} testKitPrice={catalog.testKitPrice} />
    </SignupLayout>
  );
}
