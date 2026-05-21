"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ACCOUNT_STATUSES,
  PAYMENT_STATUSES,
  PLAN_DEFINITIONS,
  PLAN_LABELS,
  TRANSPORTER_PLANS,
  formatDateInputValue,
  getDateFromFirestoreValue,
  getAccountStatus,
  getPaymentStatus,
  getPlanExpiryForPlan,
  getTransporterPlan,
  type AccountStatus,
  type PaymentStatus,
  type TransporterPlan,
} from "@/lib/account-utils";
import { cn } from "@/lib/utils";
import { Loader2, LogOut, Search, ShieldCheck, TrendingUp, Truck, Users } from "lucide-react";

const STATUS_STYLES: Record<AccountStatus, string> = {
  pending: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  suspended: "bg-destructive/10 text-destructive border-destructive/20",
};

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  pending: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  paid: "bg-green-500/10 text-green-500 border-green-500/20",
  unpaid: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
};

const CHART_COLORS = ["#5850EC", "#2563EB", "#10B981", "#F59E0B", "#EF4444"];

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile, loading: authLoading, auth, db, logout } = useAuth();
  const [transporters, setTransporters] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus>("all");
  const [planFilter, setPlanFilter] = useState<"all" | TransporterPlan>("all");
  const [expiryEdits, setExpiryEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    if (authLoading || redirecting) return;

    if (!user || !profile) {
      router.push("/admin-login");
      return;
    }

    if (profile.role !== "super_admin" && auth) {
      setRedirecting(true);
      signOut(auth).finally(() => router.push("/admin-login"));
    }
  }, [auth, authLoading, profile, redirecting, router, user]);

  useEffect(() => {
    if (!db || profile?.role !== "super_admin") return;

    setLoading(true);
    const handleAdminSnapshotError = (label: string) => (error: unknown) => {
      console.error(`Admin ${label} Query Error:`, error);
      toast({
        title: "Permission Error",
        description: `Unable to load ${label}. Deploy the latest Firestore rules if this continues.`,
        variant: "destructive",
      });
      setLoading(false);
    };

    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setTransporters(
          snapshot.docs
            .map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }))
            .filter((account: any) => account.role === "transporter")
        );
        setLoading(false);
      },
      handleAdminSnapshotError("users")
    );

    const unsubscribeTrips = onSnapshot(
      collection(db, "trips"),
      (snapshot) => {
        setTrips(snapshot.docs.map((tripDoc) => ({ id: tripDoc.id, ...tripDoc.data() })));
      },
      handleAdminSnapshotError("trips")
    );

    const unsubscribeInvoices = onSnapshot(
      collection(db, "invoices"),
      (snapshot) => {
        setInvoices(snapshot.docs.map((invoiceDoc) => ({ id: invoiceDoc.id, ...invoiceDoc.data() })));
      },
      handleAdminSnapshotError("invoices")
    );

    return () => {
      unsubscribeUsers();
      unsubscribeTrips();
      unsubscribeInvoices();
    };
  }, [db, profile, toast]);

  const stats = useMemo(() => {
    const statusCounts = ACCOUNT_STATUSES.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<AccountStatus, number>);

    transporters.forEach((transporter) => {
      statusCounts[getAccountStatus(transporter)] += 1;
    });

    return {
      total: transporters.length,
      pending: statusCounts.pending,
      active: statusCounts.active,
      suspended: statusCounts.suspended,
    };
  }, [transporters]);

  const revenueTotal = useMemo(() => {
    if (invoices.length > 0) {
      return invoices.reduce((sum, invoice) => sum + Number(invoice.invoiceTotal || 0), 0);
    }
    return trips.reduce((sum, trip) => sum + Number(trip.totalAmount || 0), 0);
  }, [invoices, trips]);

  const revenueData = useMemo(() => {
    const buckets: Record<string, number> = {};
    const sourceRows = invoices.length > 0 ? invoices : trips;

    sourceRows.forEach((row) => {
      const date = getDateFromFirestoreValue(row.billDate || row.date)
        || getDateFromFirestoreValue(row.createdAt)
        || new Date();
      const label = date.toLocaleString("default", { month: "short" });
      buckets[label] = (buckets[label] || 0) + Number(row.invoiceTotal || row.totalAmount || 0);
    });

    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [invoices, trips]);

  const planData = useMemo(() => {
    return TRANSPORTER_PLANS.map((plan) => ({
      name: PLAN_LABELS[plan],
      value: transporters.filter((transporter) => getTransporterPlan(transporter) === plan).length,
    }));
  }, [transporters]);

  const filteredTransporters = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();

    return transporters.filter((transporter) => {
      const status = getAccountStatus(transporter);
      const plan = getTransporterPlan(transporter);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesPlan = planFilter === "all" || plan === planFilter;
      const matchesSearch = !queryText || [
        transporter.companyName,
        transporter.ownerName,
        transporter.email,
        transporter.mobile,
        transporter.gstNo,
      ].some((value) => String(value || "").toLowerCase().includes(queryText));

      return matchesStatus && matchesPlan && matchesSearch;
    });
  }, [planFilter, searchQuery, statusFilter, transporters]);

  const handleUpdateTransporter = async (transporterId: string, data: Record<string, any>, successTitle: string) => {
    if (!db || !profile) return;

    setSavingId(transporterId);
    try {
      await updateDoc(doc(db, "users", transporterId), {
        ...data,
        updatedAt: serverTimestamp(),
        updatedBy: profile.uid,
      });
      toast({ title: successTitle });
    } catch (error: any) {
      toast({ title: "Admin Action Failed", description: error.message, variant: "destructive" });
    } finally {
      setSavingId("");
    }
  };

  const handleApprove = (transporter: any) => {
    const plan = getTransporterPlan(transporter);
    const startDate = new Date();
    handleUpdateTransporter(
      transporter.id,
      {
        accountStatus: "active",
        plan,
        planName: PLAN_DEFINITIONS[plan].name,
        planStartDate: startDate,
        planExpiryDate: getPlanExpiryForPlan(plan, startDate),
        paymentStatus: transporter.paymentStatus || "pending",
        approvedAt: serverTimestamp(),
      },
      "Transporter Approved"
    );
  };

  const handleChangePlan = (transporter: any, plan: TransporterPlan) => {
    const startDate = new Date();
    handleUpdateTransporter(
      transporter.id,
      {
        plan,
        planName: PLAN_DEFINITIONS[plan].name,
        accountStatus: getAccountStatus(transporter),
        planStartDate: startDate,
        planExpiryDate: getPlanExpiryForPlan(plan, startDate),
      },
      "Plan Updated"
    );
  };

  const handleChangeAccountStatus = (transporter: any, accountStatus: AccountStatus) => {
    handleUpdateTransporter(transporter.id, { accountStatus }, "Account Status Updated");
  };

  const handleChangePaymentStatus = (transporter: any, paymentStatus: PaymentStatus) => {
    handleUpdateTransporter(transporter.id, { paymentStatus }, "Payment Status Updated");
  };

  const handleExtendExpiry = (transporter: any) => {
    const expiryDate = expiryEdits[transporter.id] || formatDateInputValue(transporter.planExpiryDate);
    if (!expiryDate) {
      toast({
        title: "Expiry Date Required",
        description: "Choose a plan expiry date before extending.",
        variant: "destructive",
      });
      return;
    }

    handleUpdateTransporter(
      transporter.id,
      { planExpiryDate: new Date(`${expiryDate}T23:59:59`) },
      "Expiry Extended"
    );
  };

  if (authLoading || loading || redirecting) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/50 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-lg">
            <ShieldCheck className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-headline font-bold">TripBook Super Admin</h1>
            <p className="text-muted-foreground text-sm">Transporter approvals, plans, and platform revenue</p>
          </div>
        </div>
        <Button onClick={() => logout("/admin-login")} variant="destructive" className="h-11 font-bold">
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Transporters", value: stats.total, icon: Users, color: "text-primary" },
          { label: "Pending Accounts", value: stats.pending, icon: ShieldCheck, color: "text-orange-500" },
          { label: "Active Accounts", value: stats.active, icon: Truck, color: "text-green-500" },
          { label: "Suspended Accounts", value: stats.suspended, icon: ShieldCheck, color: "text-destructive" },
          { label: "Revenue Overview", value: formatCurrency(revenueTotal), icon: TrendingUp, color: "text-blue-500" },
        ].map((stat) => (
          <Card key={stat.label} className="bg-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                {stat.label}
              </CardTitle>
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-headline font-bold", stat.color)}>{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card border-border/50">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Invoice totals when available, otherwise trip totals</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <ChartTooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {revenueData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle>Plan Overview</CardTitle>
            <CardDescription>Current transporter plan mix</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="75%">
              <PieChart>
                <Pie data={planData} cx="50%" cy="50%" innerRadius={55} outerRadius={82} dataKey="value" paddingAngle={4}>
                  {planData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {planData.map((plan, index) => (
                <div key={plan.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                    {plan.name}
                  </span>
                  <span className="font-bold">{plan.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="bg-card border-border/50">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>Transporter Control</CardTitle>
              <CardDescription>Approve, suspend, reactivate, update plans, and extend account expiry</CardDescription>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:max-w-3xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search company, GST, mobile..."
                  className="pl-10 bg-secondary/30"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="bg-secondary/30">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {ACCOUNT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={(value: any) => setPlanFilter(value)}>
                <SelectTrigger className="bg-secondary/30">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  {TRANSPORTER_PLANS.map((plan) => (
                    <SelectItem key={plan} value={plan}>{PLAN_LABELS[plan]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransporters.map((transporter) => {
                  const status = getAccountStatus(transporter);
                  const plan = getTransporterPlan(transporter);
                  const paymentStatus = getPaymentStatus(transporter);
                  const isSaving = savingId === transporter.id;

                  return (
                    <TableRow key={transporter.id} className="hover:bg-secondary/20">
                      <TableCell>
                        <div className="font-bold text-primary">{transporter.companyName || "Unnamed Company"}</div>
                        <div className="text-xs text-muted-foreground">GST: {transporter.gstNo || "N/A"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{transporter.ownerName || "N/A"}</div>
                        <div className="text-xs text-muted-foreground">{transporter.email}</div>
                        <div className="text-xs text-muted-foreground">{transporter.mobile || "N/A"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2 min-w-[140px]">
                          <Badge variant="outline" className={cn("capitalize", STATUS_STYLES[status])}>
                            {status}
                          </Badge>
                          <Select value={status} onValueChange={(value: AccountStatus) => handleChangeAccountStatus(transporter, value)}>
                            <SelectTrigger className="h-9 bg-secondary/30">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACCOUNT_STATUSES.map((statusOption) => (
                                <SelectItem key={statusOption} value={statusOption}>{statusOption}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <Select value={plan} onValueChange={(value: TransporterPlan) => handleChangePlan(transporter, value)}>
                          <SelectTrigger className="h-9 bg-secondary/30">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TRANSPORTER_PLANS.map((planOption) => (
                              <SelectItem key={planOption} value={planOption}>{PLAN_LABELS[planOption]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="min-w-[150px]">
                        <div className="space-y-2">
                          <Badge variant="outline" className={cn("capitalize", PAYMENT_STYLES[paymentStatus])}>
                            {paymentStatus}
                          </Badge>
                          <Select value={paymentStatus} onValueChange={(value: PaymentStatus) => handleChangePaymentStatus(transporter, value)}>
                            <SelectTrigger className="h-9 bg-secondary/30">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_STATUSES.map((statusOption) => (
                                <SelectItem key={statusOption} value={statusOption}>{statusOption}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[190px]">
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={expiryEdits[transporter.id] ?? formatDateInputValue(transporter.planExpiryDate)}
                            onChange={(event) => setExpiryEdits((current) => ({ ...current, [transporter.id]: event.target.value }))}
                            className="h-9 bg-secondary/30"
                          />
                          <Button size="sm" variant="outline" onClick={() => handleExtendExpiry(transporter)} disabled={isSaving}>
                            Extend
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {status === "pending" && (
                            <Button size="sm" onClick={() => handleApprove(transporter)} disabled={isSaving} className="bg-gradient-primary font-bold">
                              Approve
                            </Button>
                          )}
                          {status !== "suspended" && (
                            <Button size="sm" variant="destructive" onClick={() => handleUpdateTransporter(transporter.id, { accountStatus: "suspended" }, "Transporter Suspended")} disabled={isSaving}>
                              Suspend
                            </Button>
                          )}
                          {status === "suspended" && (
                            <Button size="sm" variant="outline" onClick={() => handleUpdateTransporter(transporter.id, { accountStatus: "active" }, "Transporter Reactivated")} disabled={isSaving}>
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
