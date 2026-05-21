"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  PLAN_DEFINITIONS,
  SUBSCRIPTION_FEATURES,
  TRANSPORTER_PLANS,
  getDateFromFirestoreValue,
  getDaysRemaining,
  getPlanName,
  getSubscriptionStatus,
  getTransporterPlan,
} from "@/lib/account-utils";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  ShieldAlert,
  Star,
  XCircle,
} from "lucide-react";

const STATUS_META: Record<string, { label: string; className: string; icon: any }> = {
  active: {
    label: "Active",
    className: "bg-green-500/10 text-green-500 border-green-500/20",
    icon: CheckCircle2,
  },
  expiring_soon: {
    label: "Expiring Soon",
    className: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    icon: Clock,
  },
  expired: {
    label: "Expired",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    icon: XCircle,
  },
  suspended: {
    label: "Suspended",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    icon: ShieldAlert,
  },
  pending: {
    label: "Pending",
    className: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    icon: Clock,
  },
};

const PLAN_ACCENTS: Record<string, { className: string; icon: any }> = {
  monthly: { className: "border-border/50", icon: CalendarDays },
  three_months: { className: "border-primary/60 shadow-primary/10", icon: Star },
  six_months: { className: "border-green-500/50 shadow-green-500/10", icon: Flame },
  yearly: { className: "border-orange-500/50 shadow-orange-500/10", icon: Crown },
};

function formatDisplayDate(value: any) {
  const date = getDateFromFirestoreValue(value);
  if (!date) return "Not set";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(value: number) {
  return `\u20b9${value.toLocaleString("en-IN")}`;
}

export default function SubscriptionPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const currentPlan = getTransporterPlan(profile);
  const currentPlanName = profile?.planName || getPlanName(profile);
  const status = getSubscriptionStatus(profile);
  const statusMeta = STATUS_META[status] || STATUS_META.pending;
  const StatusIcon = statusMeta.icon;
  const daysRemaining = getDaysRemaining(profile);

  const requestRenewal = (planName?: string) => {
    toast({
      title: "Contact Admin",
      description: planName
        ? `Please contact admin to request ${planName}.`
        : "Please contact admin to request renewal or plan change.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold">Subscription</h1>
        <p className="text-sm text-muted-foreground">
          Manage your TripBook membership. Payments are handled manually by admin.
        </p>
      </div>

      <Card className="bg-card border-border/50 overflow-hidden">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-xl">Current Subscription</CardTitle>
              <CardDescription>Manual subscription details from your account profile</CardDescription>
            </div>
            <Badge variant="outline" className={cn("w-fit gap-1.5", statusMeta.className)}>
              <StatusIcon className="h-3.5 w-3.5" />
              {statusMeta.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg bg-secondary/30 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Current Plan</p>
            <p className="mt-2 text-xl font-headline font-bold">{currentPlanName}</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Status</p>
            <p className="mt-2 text-xl font-headline font-bold">{statusMeta.label}</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Plan Start Date</p>
            <p className="mt-2 text-xl font-headline font-bold">{formatDisplayDate(profile?.planStartDate)}</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Valid Till</p>
            <p className="mt-2 text-xl font-headline font-bold">{formatDisplayDate(profile?.planExpiryDate)}</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Days Remaining</p>
            <p className="mt-2 text-xl font-headline font-bold">{daysRemaining ?? "N/A"}</p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-headline font-bold">Available Plans</h2>
          <p className="text-sm text-muted-foreground">Choose a plan and contact admin for manual activation.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TRANSPORTER_PLANS.map((plan) => {
            const planInfo = PLAN_DEFINITIONS[plan];
            const accent = PLAN_ACCENTS[plan] || PLAN_ACCENTS.monthly;
            const PlanIcon = accent.icon;
            const isCurrent = currentPlan === plan;

            return (
              <Card
                key={plan}
                className={cn("bg-card border-border/50 shadow-lg flex flex-col", accent.className)}
              >
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{planInfo.name}</CardTitle>
                      <CardDescription>{planInfo.durationDays} Days</CardDescription>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <PlanIcon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-3xl font-headline font-bold">{formatPrice(planInfo.price)}</div>
                    <div className="flex flex-wrap gap-2">
                      {planInfo.badge && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                          {planInfo.badge}
                        </Badge>
                      )}
                      {planInfo.discountMessage && (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                          {planInfo.discountMessage}
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                          Current Plan
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="space-y-2 text-sm text-muted-foreground flex-1">
                    {SUBSCRIPTION_FEATURES.map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-2">
                    <Button type="button" onClick={() => requestRenewal(planInfo.name)} className="bg-gradient-primary font-bold">
                      Contact Admin
                    </Button>
                    <Button type="button" variant="outline" onClick={() => requestRenewal(planInfo.name)} className="font-bold">
                      Request Renewal
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
