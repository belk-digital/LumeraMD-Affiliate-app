/** One sales rep application as the Sales Reps page and its details panel see it. */
export interface RepData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  annualGrossSales: number | null;
  salesType: string | null;
  /** e.g. "Premium (rep) · $79/mo", or null for applications from before plans were offered. */
  plan: string | null;
  hasResume: boolean;
  resumeFileName: string | null;
  referrer: string | null;
  appliedOn: string;
  status: string;
  reviewNotes: string | null;
  /** The affiliate account created when the application was approved. */
  linkedAffiliateId: string | null;
  /** The rep's own Premium membership, which they pay for after being approved. */
  membership: { status: string; payLink: string | null } | null;
}

export interface CountStat {
  total: number;
  trend: number;
}
