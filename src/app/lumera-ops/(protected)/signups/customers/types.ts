/** One customer membership as the Customers page and its details panel see it. */
export interface CustomerData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  planLabel: string;
  planName: string;
  monthlyPrice: number;
  discountPercent: number;
  benefits: string[];
  wantsTestKit: boolean;
  testKitPrice: number;
  status: string;
  referrer: string | null;
  signedUp: string;
  currentPeriodEnd: string | null;
  memberDiscountCode: string | null;
  memberDiscountActive: boolean;
  consultationsUsed: number;
  consultationsIncluded: number;
  complimentary: boolean;
  complimentaryNote: string | null;
  complimentaryBy: string | null;
  /** Wallet points, in cents. */
  pointsCents: number;
  /** Where this member can pay online, when they still owe a payment and online payment is set up. */
  payLink: string | null;
  /** The Authorize.net subscription that renews this membership, if there is one. */
  subscriptionId: string | null;
  payments: { id: string; amount: number; paidOn: string; coversThrough: string; note: string | null; source: string }[];
}

export interface CountStat {
  total: number;
  trend: number;
}
