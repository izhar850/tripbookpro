export type AccountStatus = "pending" | "active" | "suspended";
export type TransporterPlan = "trial" | "monthly" | "three_months" | "six_months" | "yearly";
export type PaymentStatus = "pending" | "paid" | "unpaid" | "overdue";

export const ACCOUNT_STATUSES: AccountStatus[] = ["pending", "active", "suspended"];
export const PAYMENT_STATUSES: PaymentStatus[] = ["pending", "paid", "unpaid", "overdue"];
export const TRANSPORTER_PLANS: TransporterPlan[] = ["monthly", "three_months", "six_months", "yearly"];

export const PLAN_LABELS: Record<TransporterPlan, string> = {
  trial: "Trial",
  monthly: "1 Month Plan",
  three_months: "3 Months Plan",
  six_months: "6 Months Plan",
  yearly: "1 Year Plan",
};

export const PLAN_DEFINITIONS: Record<TransporterPlan, {
  name: string;
  price: number;
  durationDays: number;
  badge?: string;
  discountMessage?: string;
}> = {
  trial: {
    name: "Trial",
    price: 0,
    durationDays: 15,
  },
  monthly: {
    name: "1 Month Plan",
    price: 499,
    durationDays: 30,
  },
  three_months: {
    name: "3 Months Plan",
    price: 1299,
    durationDays: 90,
    badge: "Recommended",
    discountMessage: "Save \u20b9198",
  },
  six_months: {
    name: "6 Months Plan",
    price: 2399,
    durationDays: 180,
    badge: "Best Value",
    discountMessage: "Save \u20b9595",
  },
  yearly: {
    name: "1 Year Plan",
    price: 4499,
    durationDays: 365,
    badge: "Most Popular",
    discountMessage: "Save ₹1489",
  },
};

export const SUBSCRIPTION_FEATURES = [
  "Trip Management",
  "LR Receipt",
  "Billing Invoice",
  "Vehicle Management",
  "Expense Tracking",
  "POD Upload",
  "Reports",
  "Cloud Backup",
];

export function getAccountStatus(profile: any): AccountStatus {
  const status = profile?.accountStatus;
  return ACCOUNT_STATUSES.includes(status) ? status : "active";
}

export function getTransporterPlan(profile: any): TransporterPlan {
  const plan = profile?.plan;
  if (plan === "one_month") return "monthly";
  if (plan === "three_month") return "three_months";
  if (plan === "six_month") return "six_months";
  return TRANSPORTER_PLANS.includes(plan) ? plan : "trial";
}

export function getPaymentStatus(profile: any): PaymentStatus {
  const status = profile?.paymentStatus;
  return PAYMENT_STATUSES.includes(status) ? status : "pending";
}

export function getPlanName(profileOrPlan: any) {
  const plan = typeof profileOrPlan === "string"
    ? getTransporterPlan({ plan: profileOrPlan })
    : getTransporterPlan(profileOrPlan);
  return PLAN_DEFINITIONS[plan]?.name || PLAN_LABELS[plan] || "Trial";
}

export function getDateFromFirestoreValue(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateInputValue(value: any) {
  const date = getDateFromFirestoreValue(value);
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

export function isPlanExpired(profile: any, now = new Date()) {
  const expiry = getDateFromFirestoreValue(profile?.planExpiryDate);
  if (!expiry) return false;

  const endOfExpiryDay = new Date(expiry);
  endOfExpiryDay.setHours(23, 59, 59, 999);
  return endOfExpiryDay.getTime() < now.getTime();
}

export function getDaysRemaining(profile: any, now = new Date()) {
  const expiry = getDateFromFirestoreValue(profile?.planExpiryDate);
  if (!expiry) return null;

  const endOfExpiryDay = new Date(expiry);
  endOfExpiryDay.setHours(23, 59, 59, 999);
  return Math.max(0, Math.ceil((endOfExpiryDay.getTime() - now.getTime()) / 86400000));
}

export function isSubscriptionActive(profile: any, now = new Date()) {
  return Boolean(profile) && getAccountStatus(profile) === "active" && !isPlanExpired(profile, now);
}

export function getSubscriptionStatus(profile: any) {
  if (!profile) return "pending";
  const accountStatus = getAccountStatus(profile);
  if (accountStatus === "pending") return "pending";
  if (accountStatus === "suspended") return "suspended";
  if (isPlanExpired(profile)) return "expired";
  const daysRemaining = getDaysRemaining(profile);
  if (daysRemaining !== null && daysRemaining < 7) return "expiring_soon";
  return "active";
}

export function getSubscriptionBlockMessage(profile: any) {
  const status = getSubscriptionStatus(profile);
  if (status === "expired") return "Subscription expired. Please contact admin to renew.";
  if (status === "pending") return "Your account is pending admin approval.";
  if (status === "suspended") return "Your account is suspended. Please contact admin.";
  return "";
}

export function getTransporterAccessIssue(profile: any) {
  if (!profile) return "Profile not found.";
  if (profile.role !== "transporter") return "Unauthorized Access";

  const status = getAccountStatus(profile);
  if (status === "pending") return "Your account is pending admin approval.";
  if (status === "suspended") return "Your account is suspended. Please contact admin.";

  return "";
}

export function getPlanExpiryForPlan(plan: TransporterPlan, startDate = new Date()) {
  const expiry = new Date(startDate);

  expiry.setDate(expiry.getDate() + PLAN_DEFINITIONS[plan].durationDays);

  return expiry;
}
