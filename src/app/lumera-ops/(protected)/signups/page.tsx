import { redirect } from "next/navigation";

// Signups used to be one long page. It is now two: customers and sales reps.
export default function SignupsIndexPage() {
  redirect("/lumera-ops/signups/customers");
}
