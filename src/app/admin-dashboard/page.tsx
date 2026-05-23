"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MobileDataCard, MobileDataCards, MobileDataField } from "@/components/ui/mobile-data-card";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import {
  ACCOUNT_STATUSES,
  PAYMENT_STATUSES,
  PLAN_DEFINITIONS,
  PLAN_LABELS,
  formatDateInputValue,
  getAccountStatus,
  getDateFromFirestoreValue,
  getDaysRemaining,
  getPaymentStatus,
  getPlanExpiryForPlan,
  getTransporterPlan,
  isPlanExpired,
  type AccountStatus,
  type PaymentStatus,
  type TransporterPlan,
} from "@/lib/account-utils";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Loader2,
  LogOut,
  Megaphone,
  MoreHorizontal,
  Receipt,
  Search,
  ShieldCheck,
  StickyNote,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";

const STATUS_STYLES: Record<AccountStatus | "expired", string> = {
  pending: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  suspended: "bg-destructive/10 text-destructive border-destructive/20",
  expired: "bg-slate-500/10 text-slate-300 border-slate-500/20",
};

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  pending: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  paid: "bg-green-500/10 text-green-500 border-green-500/20",
  unpaid: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
};

const NOTICE_TYPES = ["info", "success", "warning", "danger"] as const;
const ADMIN_PLAN_OPTIONS: TransporterPlan[] = ["trial", "monthly", "three_months", "six_months", "yearly"];
const PAGE_SIZE = 10;
const CHART_COLORS = ["#5850EC", "#2563EB", "#10B981", "#F59E0B", "#EF4444"];

type AdminDialog = "details" | "trips" | "bills" | "notes" | null;

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatDisplayDate(value: any) {
  const date = getDateFromFirestoreValue(value);
  return date ? date.toLocaleDateString("en-IN") : "Not set";
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function rowBelongsToTransporter(row: any, transporter: any) {
  const keys = [transporter.id, transporter.uid, transporter.companyId].filter(Boolean).map(String);
  return keys.includes(String(row.companyId || "")) || keys.includes(String(row.userId || ""));
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile, loading: authLoading, auth, db, logout } = useAuth();
  const [transporters, setTransporters] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus | "expired">("all");
  const [planFilter, setPlanFilter] = useState<"all" | TransporterPlan>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [expiryEdits, setExpiryEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");
  const [selectedTransporter, setSelectedTransporter] = useState<any>(null);
  const [adminDialog, setAdminDialog] = useState<AdminDialog>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState("");
  const [editingNoteText, setEditingNoteText] = useState("");
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    message: "",
    type: "info",
    expiryDate: "",
    active: "true",
  });

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
      (snapshot) => setTrips(snapshot.docs.map((tripDoc) => ({ id: tripDoc.id, ...tripDoc.data() }))),
      handleAdminSnapshotError("trips")
    );

    const unsubscribeInvoices = onSnapshot(
      collection(db, "invoices"),
      (snapshot) => setInvoices(snapshot.docs.map((invoiceDoc) => ({ id: invoiceDoc.id, ...invoiceDoc.data() }))),
      handleAdminSnapshotError("invoices")
    );

    const unsubscribeNotices = onSnapshot(
      collection(db, "platformNotices"),
      (snapshot) => setNotices(snapshot.docs.map((noticeDoc) => ({ id: noticeDoc.id, ...noticeDoc.data() }))),
      handleAdminSnapshotError("platform notices")
    );

    return () => {
      unsubscribeUsers();
      unsubscribeTrips();
      unsubscribeInvoices();
      unsubscribeNotices();
    };
  }, [db, profile, toast]);

  useEffect(() => {
    setCurrentPage(1);
  }, [planFilter, searchQuery, statusFilter]);

  const getTransporterTrips = (transporter: any) => trips.filter((trip) => rowBelongsToTransporter(trip, transporter));
  const getTransporterInvoices = (transporter: any) => invoices.filter((invoice) => rowBelongsToTransporter(invoice, transporter));

  const stats = useMemo(() => {
    const active = transporters.filter((transporter) => getAccountStatus(transporter) === "active").length;
    const pending = transporters.filter((transporter) => getAccountStatus(transporter) === "pending").length;
    const suspended = transporters.filter((transporter) => getAccountStatus(transporter) === "suspended").length;
    const expired = transporters.filter((transporter) => isPlanExpired(transporter)).length;
    const totalRevenue = invoices.length > 0
      ? invoices.reduce((sum, invoice) => sum + Number(invoice.invoiceTotal || 0), 0)
      : trips.reduce((sum, trip) => sum + Number(trip.totalAmount || 0), 0);

    return {
      totalTransporters: transporters.length,
      active,
      pending,
      suspended,
      expired,
      totalTrips: trips.length,
      totalBills: invoices.length,
      totalRevenue,
    };
  }, [invoices, transporters, trips]);

  const expiringSoonTransporters = useMemo(() => (
    transporters
      .filter((transporter) => {
        const daysRemaining = getDaysRemaining(transporter);
        return daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7 && !isPlanExpired(transporter);
      })
      .sort((a, b) => (getDaysRemaining(a) || 999) - (getDaysRemaining(b) || 999))
  ), [transporters]);

  const expiredTransporters = useMemo(() => (
    transporters.filter((transporter) => isPlanExpired(transporter))
  ), [transporters]);

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
    return ADMIN_PLAN_OPTIONS.map((plan) => ({
      name: PLAN_LABELS[plan],
      value: transporters.filter((transporter) => getTransporterPlan(transporter) === plan).length,
    }));
  }, [transporters]);

  const filteredTransporters = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();

    return transporters.filter((transporter) => {
      const status = getAccountStatus(transporter);
      const plan = getTransporterPlan(transporter);
      const expired = isPlanExpired(transporter);
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "expired" ? expired : status === statusFilter);
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

  const pageCount = Math.max(1, Math.ceil(filteredTransporters.length / PAGE_SIZE));
  const paginatedTransporters = filteredTransporters.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selectedTrips = selectedTransporter ? getTransporterTrips(selectedTransporter) : [];
  const selectedInvoices = selectedTransporter ? getTransporterInvoices(selectedTransporter) : [];

  const handleUpdateTransporter = async (transporterId: string, data: Record<string, any>, successTitle: string) => {
    if (!db || !profile || profile.role !== "super_admin") return;

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
        planStartDate: startDate,
        planExpiryDate: getPlanExpiryForPlan(plan, startDate),
      },
      "Plan Updated"
    );
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
      "Expiry Updated"
    );
  };

  const handleOpenDialog = (transporter: any, dialog: AdminDialog) => {
    setSelectedTransporter(transporter);
    setAdminDialog(dialog);
    setNoteDraft("");
    setEditingNoteId("");
    setEditingNoteText("");
  };

  const handleAddNote = async () => {
    if (!selectedTransporter || !noteDraft.trim()) return;
    const notes = Array.isArray(selectedTransporter.supportNotes) ? selectedTransporter.supportNotes : [];
    const newNote = {
      id: crypto.randomUUID(),
      text: noteDraft.trim(),
      createdAt: new Date().toISOString(),
      createdBy: profile?.email || profile?.uid || "super_admin",
    };
    await handleUpdateTransporter(selectedTransporter.id, { supportNotes: [newNote, ...notes] }, "Support Note Added");
    setNoteDraft("");
    setSelectedTransporter({ ...selectedTransporter, supportNotes: [newNote, ...notes] });
  };

  const handleSaveNoteEdit = async () => {
    if (!selectedTransporter || !editingNoteId || !editingNoteText.trim()) return;
    const notes = (selectedTransporter.supportNotes || []).map((note: any) => (
      note.id === editingNoteId
        ? { ...note, text: editingNoteText.trim(), updatedAt: new Date().toISOString(), updatedBy: profile?.email || profile?.uid || "super_admin" }
        : note
    ));
    await handleUpdateTransporter(selectedTransporter.id, { supportNotes: notes }, "Support Note Updated");
    setSelectedTransporter({ ...selectedTransporter, supportNotes: notes });
    setEditingNoteId("");
    setEditingNoteText("");
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedTransporter) return;
    const notes = (selectedTransporter.supportNotes || []).filter((note: any) => note.id !== noteId);
    await handleUpdateTransporter(selectedTransporter.id, { supportNotes: notes }, "Support Note Deleted");
    setSelectedTransporter({ ...selectedTransporter, supportNotes: notes });
  };

  const handleCreateNotice = async () => {
    if (!db || !profile || !noticeForm.title.trim() || !noticeForm.message.trim()) {
      toast({ title: "Notice Title and Message Required", variant: "destructive" });
      return;
    }

    try {
      await addDoc(collection(db, "platformNotices"), {
        title: noticeForm.title.trim(),
        message: noticeForm.message.trim(),
        type: noticeForm.type,
        expiryDate: noticeForm.expiryDate ? new Date(`${noticeForm.expiryDate}T23:59:59`) : null,
        active: noticeForm.active === "true",
        createdAt: serverTimestamp(),
        createdBy: profile.uid,
      });
      setNoticeForm({ title: "", message: "", type: "info", expiryDate: "", active: "true" });
      toast({ title: "Platform Notice Created" });
    } catch (error: any) {
      toast({ title: "Notice Save Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleNotice = async (notice: any) => {
    if (!db || !profile || profile.role !== "super_admin") return;
    try {
      await updateDoc(doc(db, "platformNotices", notice.id), {
        active: !notice.active,
        updatedAt: serverTimestamp(),
        updatedBy: profile.uid,
      });
      toast({ title: notice.active ? "Notice Deactivated" : "Notice Activated" });
    } catch (error: any) {
      toast({ title: "Notice Update Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteNotice = async (notice: any) => {
    if (!db || !profile || profile.role !== "super_admin") return;
    const confirmed = window.confirm(`Delete notice "${notice.title}"?`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "platformNotices", notice.id));
      toast({ title: "Platform Notice Deleted" });
    } catch (error: any) {
      toast({ title: "Notice Delete Failed", description: error.message, variant: "destructive" });
    }
  };

  const exportTransporters = () => {
    downloadCsv(
      `tripbook_transporters_${new Date().toISOString().split("T")[0]}.csv`,
      ["Company Name", "Owner Name", "Mobile", "Email", "GST No", "Plan", "Expiry Date", "Account Status", "Payment Status", "Total Trips"],
      filteredTransporters.map((transporter) => [
        transporter.companyName,
        transporter.ownerName,
        transporter.mobile,
        transporter.email,
        transporter.gstNo,
        PLAN_LABELS[getTransporterPlan(transporter)],
        formatDisplayDate(transporter.planExpiryDate),
        isPlanExpired(transporter) ? "expired" : getAccountStatus(transporter),
        getPaymentStatus(transporter),
        getTransporterTrips(transporter).length,
      ])
    );
  };

  const exportTrips = () => {
    downloadCsv(
      `tripbook_trips_${new Date().toISOString().split("T")[0]}.csv`,
      ["LR No", "Date", "Company Id", "Party", "Vehicle No", "Route", "Amount", "Status"],
      trips.map((trip) => [
        trip.lrNo,
        trip.date,
        trip.companyId || trip.userId,
        trip.consigneeName || trip.partyName,
        trip.vehicleNo,
        `${trip.source || ""} - ${trip.destination || ""}`,
        trip.totalAmount,
        trip.status || trip.paymentStatus,
      ])
    );
  };

  const exportBills = () => {
    downloadCsv(
      `tripbook_bills_${new Date().toISOString().split("T")[0]}.csv`,
      ["Bill No", "Bill Date", "Company Id", "Party", "GST No", "Total"],
      invoices.map((invoice) => [
        invoice.billNo,
        invoice.billDate,
        invoice.companyId || invoice.userId,
        invoice.partyName,
        invoice.partyGst,
        invoice.invoiceTotal,
      ])
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
            <p className="text-muted-foreground text-sm">Transporter approvals, subscriptions, notices, and support</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ThemeToggle className="h-11 font-bold" />
          <Button onClick={() => logout("/admin-login")} variant="destructive" className="h-11 font-bold">
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Total Transporters", value: stats.totalTransporters, icon: Users, color: "text-primary" },
          { label: "Active Accounts", value: stats.active, icon: Truck, color: "text-green-500" },
          { label: "Pending Approvals", value: stats.pending, icon: ShieldCheck, color: "text-orange-500" },
          { label: "Suspended Accounts", value: stats.suspended, icon: ShieldCheck, color: "text-destructive" },
          { label: "Expired Accounts", value: stats.expired, icon: ShieldCheck, color: "text-slate-300" },
          { label: "Total Trips", value: stats.totalTrips, icon: FileText, color: "text-blue-500" },
          { label: "Total Bills", value: stats.totalBills, icon: Receipt, color: "text-indigo-400" },
          { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: "text-emerald-400" },
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
            {revenueData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">No revenue data yet.</div>
            ) : (
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
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle>Plan Overview</CardTitle>
            <CardDescription>Current transporter plan mix</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="70%">
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

      <section className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle>Subscription Management</CardTitle>
            <CardDescription>Expiring and expired accounts needing attention</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
              <h3 className="font-bold text-orange-500 mb-3">Expiring in 7 Days</h3>
              {expiringSoonTransporters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No accounts expiring soon.</p>
              ) : (
                <div className="space-y-2">
                  {expiringSoonTransporters.slice(0, 6).map((transporter) => (
                    <div key={transporter.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{transporter.companyName}</span>
                      <Badge variant="outline" className="border-orange-500/20 text-orange-500">{getDaysRemaining(transporter)} days</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <h3 className="font-bold text-destructive mb-3">Expired Users</h3>
              {expiredTransporters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expired accounts.</p>
              ) : (
                <div className="space-y-2">
                  {expiredTransporters.slice(0, 6).map((transporter) => (
                    <div key={transporter.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{transporter.companyName}</span>
                      <Button size="sm" variant="outline" onClick={() => handleUpdateTransporter(transporter.id, { paymentStatus: "paid" }, "Payment Marked Received")}>
                        Mark Paid
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-primary" /> Platform Notice</CardTitle>
            <CardDescription>Create active notices shown on transporter dashboards</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input value={noticeForm.title} onChange={(event) => setNoticeForm({ ...noticeForm, title: event.target.value })} placeholder="Notice title" />
              <Select value={noticeForm.type} onValueChange={(value) => setNoticeForm({ ...noticeForm, type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTICE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={noticeForm.expiryDate} onChange={(event) => setNoticeForm({ ...noticeForm, expiryDate: event.target.value })} />
              <Select value={noticeForm.active} onValueChange={(value) => setNoticeForm({ ...noticeForm, active: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea value={noticeForm.message} onChange={(event) => setNoticeForm({ ...noticeForm, message: event.target.value })} placeholder="Notice message" />
            <Button onClick={handleCreateNotice} className="bg-gradient-primary font-bold">Create Notice</Button>
            <div className="space-y-2 pt-2">
              {notices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No platform notices created.</p>
              ) : notices.slice(0, 4).map((notice) => (
                <div key={notice.id} className="rounded-lg border border-border/50 p-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{notice.title}</div>
                    <div className="text-xs text-muted-foreground">{notice.message}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">Expires: {formatDisplayDate(notice.expiryDate)}</div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button size="sm" variant="outline" onClick={() => handleToggleNotice(notice)}>
                      {notice.active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteNotice(notice)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="bg-card border-border/50">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle>Transporter Management</CardTitle>
              <CardDescription>Manage plans, approvals, expiries, payment status, trips, bills, and support notes</CardDescription>
            </div>
            <div className="flex flex-col gap-3 xl:items-end">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full xl:min-w-[780px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search company, GST, mobile, email..."
                    className="pl-10 bg-secondary/30"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger className="bg-secondary/30">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {ACCOUNT_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    <SelectItem value="expired">expired</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={planFilter} onValueChange={(value: any) => setPlanFilter(value)}>
                  <SelectTrigger className="bg-secondary/30">
                    <SelectValue placeholder="Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    {ADMIN_PLAN_OPTIONS.map((plan) => <SelectItem key={plan} value={plan}>{PLAN_LABELS[plan]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={exportTransporters}><Download className="w-4 h-4 mr-2" /> Transporters</Button>
                <Button size="sm" variant="outline" onClick={exportTrips}><Download className="w-4 h-4 mr-2" /> Trips</Button>
                <Button size="sm" variant="outline" onClick={exportBills}><Download className="w-4 h-4 mr-2" /> Bills</Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTransporters.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
              <Users className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-bold">No transporters found.</p>
            </div>
          ) : (
            <>
              <div className="p-4 md:hidden">
                <MobileDataCards className="space-y-4">
                  {paginatedTransporters.map((transporter) => {
                    const status = getAccountStatus(transporter);
                    const displayStatus = isPlanExpired(transporter) ? "expired" : status;
                    const plan = getTransporterPlan(transporter);
                    const paymentStatus = getPaymentStatus(transporter);
                    const transporterTrips = getTransporterTrips(transporter);
                    const isSaving = savingId === transporter.id;

                    return (
                      <MobileDataCard
                        key={transporter.id}
                        title={transporter.companyName || "Unnamed Company"}
                        titleClassName="text-primary"
                        subtitle={`Owner: ${transporter.ownerName || "N/A"}`}
                        badge={(
                          <Badge variant="outline" className={cn("capitalize text-[11px]", STATUS_STYLES[displayStatus])}>
                            {displayStatus}
                          </Badge>
                        )}
                        headerRight={(
                          <Badge variant="outline" className={cn("capitalize text-[11px]", PAYMENT_STYLES[paymentStatus])}>
                            {paymentStatus}
                          </Badge>
                        )}
                        actions={(
                          <>
                            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => handleOpenDialog(transporter, "details")}>
                              Details
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => handleOpenDialog(transporter, "trips")}>
                              Trips
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => handleOpenDialog(transporter, "bills")}>
                              Bills
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => handleOpenDialog(transporter, "notes")}>
                              Notes
                            </Button>
                            {status === "pending" ? (
                              <Button size="sm" className="flex-1 sm:flex-none" disabled={isSaving} onClick={() => handleApprove(transporter)}>
                                Approve
                              </Button>
                            ) : null}
                            {status !== "suspended" ? (
                              <Button size="sm" variant="destructive" className="flex-1 sm:flex-none" disabled={isSaving} onClick={() => handleUpdateTransporter(transporter.id, { accountStatus: "suspended" }, "Transporter Suspended")}>
                                Suspend
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="flex-1 sm:flex-none" disabled={isSaving} onClick={() => handleUpdateTransporter(transporter.id, { accountStatus: "active" }, "Transporter Reactivated")}>
                                Reactivate
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" disabled={isSaving} onClick={() => handleUpdateTransporter(transporter.id, { paymentStatus: "paid" }, "Payment Marked Received")}>
                              Mark Paid
                            </Button>
                          </>
                        )}
                      >
                        <MobileDataField label="Email" value={transporter.email} className="sm:col-span-2" />
                        <MobileDataField label="Mobile" value={transporter.mobile} />
                        <MobileDataField label="Trips" value={String(transporterTrips.length)} />
                        <MobileDataField
                          label="Plan"
                          value={(
                            <Select value={plan} onValueChange={(value: TransporterPlan) => handleChangePlan(transporter, value)}>
                              <SelectTrigger className="h-9 bg-secondary/30 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ADMIN_PLAN_OPTIONS.map((planOption) => (
                                  <SelectItem key={planOption} value={planOption}>{PLAN_LABELS[planOption]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <MobileDataField
                          label="Expiry"
                          value={(
                            <div className="space-y-2">
                              <Input
                                type="date"
                                value={expiryEdits[transporter.id] ?? formatDateInputValue(transporter.planExpiryDate)}
                                onChange={(event) => setExpiryEdits((current) => ({ ...current, [transporter.id]: event.target.value }))}
                                className="h-9 bg-secondary/30 text-xs px-2"
                              />
                              <Button size="sm" variant="outline" onClick={() => handleExtendExpiry(transporter)} disabled={isSaving} className="h-8 w-full text-xs px-2">
                                Extend
                              </Button>
                            </div>
                          )}
                        />
                        <MobileDataField
                          label="Account"
                          value={(
                            <Select value={status} onValueChange={(value: AccountStatus) => handleUpdateTransporter(transporter.id, { accountStatus: value }, "Account Status Updated")}>
                              <SelectTrigger className="h-9 bg-secondary/30 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACCOUNT_STATUSES.map((statusOption) => <SelectItem key={statusOption} value={statusOption}>{statusOption}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <MobileDataField
                          label="Payment"
                          value={(
                            <Select value={paymentStatus} onValueChange={(value: PaymentStatus) => handleUpdateTransporter(transporter.id, { paymentStatus: value }, "Payment Status Updated")}>
                              <SelectTrigger className="h-9 bg-secondary/30 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PAYMENT_STATUSES.map((statusOption) => <SelectItem key={statusOption} value={statusOption}>{statusOption}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </MobileDataCard>
                    );
                  })}
                </MobileDataCards>
              </div>

              <div className="hidden md:block w-full">
                <Table className="table-fixed text-xs">
                  <TableHeader className="bg-secondary/30">
                    <TableRow>
                      <TableHead className="w-[24%] px-3">Transporter</TableHead>
                      <TableHead className="w-[15%] px-3">Plan</TableHead>
                      <TableHead className="w-[18%] px-3">Expiry</TableHead>
                      <TableHead className="w-[14%] px-3">Account</TableHead>
                      <TableHead className="w-[14%] px-3">Payment</TableHead>
                      <TableHead className="w-[6%] px-3 text-center">Trips</TableHead>
                      <TableHead className="w-[9%] px-3 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransporters.map((transporter) => {
                      const status = getAccountStatus(transporter);
                      const displayStatus = isPlanExpired(transporter) ? "expired" : status;
                      const plan = getTransporterPlan(transporter);
                      const paymentStatus = getPaymentStatus(transporter);
                      const transporterTrips = getTransporterTrips(transporter);
                      const isSaving = savingId === transporter.id;

                      return (
                        <TableRow key={transporter.id} className="hover:bg-secondary/20 align-top">
                          <TableCell className="px-3 py-3">
                            <div className="min-w-0">
                              <div className="font-bold text-primary break-words">{transporter.companyName || "Unnamed Company"}</div>
                              <div className="text-[11px] text-muted-foreground break-words">Owner: {transporter.ownerName || "N/A"}</div>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <Select value={plan} onValueChange={(value: TransporterPlan) => handleChangePlan(transporter, value)}>
                              <SelectTrigger className="h-8 bg-secondary/30 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ADMIN_PLAN_OPTIONS.map((planOption) => (
                                  <SelectItem key={planOption} value={planOption}>{PLAN_LABELS[planOption]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <div className="space-y-2">
                              <Input
                                type="date"
                                value={expiryEdits[transporter.id] ?? formatDateInputValue(transporter.planExpiryDate)}
                                onChange={(event) => setExpiryEdits((current) => ({ ...current, [transporter.id]: event.target.value }))}
                                className="h-8 bg-secondary/30 text-xs px-2"
                              />
                              <Button size="sm" variant="outline" onClick={() => handleExtendExpiry(transporter)} disabled={isSaving} className="h-7 w-full text-xs px-2">
                                Extend
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <div className="space-y-2">
                              <Badge variant="outline" className={cn("capitalize text-[11px]", STATUS_STYLES[displayStatus])}>{displayStatus}</Badge>
                              <Select value={status} onValueChange={(value: AccountStatus) => handleUpdateTransporter(transporter.id, { accountStatus: value }, "Account Status Updated")}>
                                <SelectTrigger className="h-8 bg-secondary/30 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ACCOUNT_STATUSES.map((statusOption) => <SelectItem key={statusOption} value={statusOption}>{statusOption}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <div className="space-y-2">
                              <Badge variant="outline" className={cn("capitalize text-[11px]", PAYMENT_STYLES[paymentStatus])}>{paymentStatus}</Badge>
                              <Select value={paymentStatus} onValueChange={(value: PaymentStatus) => handleUpdateTransporter(transporter.id, { paymentStatus: value }, "Payment Status Updated")}>
                                <SelectTrigger className="h-8 bg-secondary/30 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_STATUSES.map((statusOption) => <SelectItem key={statusOption} value={statusOption}>{statusOption}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-3 font-bold text-center">{transporterTrips.length}</TableCell>
                          <TableCell className="px-3 py-3 text-right">
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="outline" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onSelect={() => window.setTimeout(() => handleOpenDialog(transporter, "details"), 0)}>
                                  <Eye className="w-4 h-4" /> Show More Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => window.setTimeout(() => handleOpenDialog(transporter, "trips"), 0)}>
                                  <FileText className="w-4 h-4" /> View Trips
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => window.setTimeout(() => handleOpenDialog(transporter, "bills"), 0)}>
                                  <Receipt className="w-4 h-4" /> View Bills
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => window.setTimeout(() => handleOpenDialog(transporter, "notes"), 0)}>
                                  <StickyNote className="w-4 h-4" /> Support Notes
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {status === "pending" && (
                                  <DropdownMenuItem disabled={isSaving} onSelect={() => handleApprove(transporter)}>
                                    Approve
                                  </DropdownMenuItem>
                                )}
                                {status !== "suspended" && (
                                  <DropdownMenuItem disabled={isSaving} onSelect={() => handleUpdateTransporter(transporter.id, { accountStatus: "suspended" }, "Transporter Suspended")} className="text-destructive">
                                    Suspend
                                  </DropdownMenuItem>
                                )}
                                {status === "suspended" && (
                                  <DropdownMenuItem disabled={isSaving} onSelect={() => handleUpdateTransporter(transporter.id, { accountStatus: "active" }, "Transporter Reactivated")}>
                                    Reactivate
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem disabled={isSaving} onSelect={() => handleUpdateTransporter(transporter.id, { paymentStatus: "paid" }, "Payment Marked Received")}>
                                  Mark Paid
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Showing {paginatedTransporters.length} of {filteredTransporters.length} transporters
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-bold">Page {currentPage} / {pageCount}</span>
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!adminDialog} onOpenChange={(open) => !open && setAdminDialog(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>
              {adminDialog === "details" && "Transporter Details"}
              {adminDialog === "trips" && "Transporter Trips"}
              {adminDialog === "bills" && "Transporter Bills"}
              {adminDialog === "notes" && "Support Notes"}
              {selectedTransporter?.companyName ? ` - ${selectedTransporter.companyName}` : ""}
            </DialogTitle>
          </DialogHeader>

          {selectedTransporter && adminDialog === "details" && (
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              {[
                ["Company Name", selectedTransporter.companyName],
                ["Owner Name", selectedTransporter.ownerName],
                ["Mobile", selectedTransporter.mobile],
                ["Email", selectedTransporter.email],
                ["GST No", selectedTransporter.gstNo],
                ["Plan", PLAN_LABELS[getTransporterPlan(selectedTransporter)]],
                ["Expiry Date", formatDisplayDate(selectedTransporter.planExpiryDate)],
                ["Account Status", isPlanExpired(selectedTransporter) ? "expired" : getAccountStatus(selectedTransporter)],
                ["Payment Status", getPaymentStatus(selectedTransporter)],
                ["Total Trips", selectedTrips.length],
                ["Total Bills", selectedInvoices.length],
                ["Revenue", formatCurrency(selectedInvoices.reduce((sum, invoice) => sum + Number(invoice.invoiceTotal || 0), 0))],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border/50 p-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">{label}</p>
                  <p className="mt-1 font-bold">{String(value || "N/A")}</p>
                </div>
              ))}
            </div>
          )}

          {selectedTransporter && adminDialog === "trips" && (
            <AdminRowsTable
              emptyText="No trips found for this transporter."
              headers={["LR No", "Date", "Consignee", "Vehicle", "Amount", "Status"]}
              rows={selectedTrips.map((trip) => [
                trip.lrNo,
                trip.date,
                trip.consigneeName || trip.partyName,
                trip.vehicleNo,
                formatCurrency(Number(trip.totalAmount || 0)),
                trip.status || trip.paymentStatus || "Pending",
              ])}
            />
          )}

          {selectedTransporter && adminDialog === "bills" && (
            <AdminRowsTable
              emptyText="No bills found for this transporter."
              headers={["Bill No", "Bill Date", "Party", "GST No", "Total"]}
              rows={selectedInvoices.map((invoice) => [
                invoice.billNo,
                invoice.billDate,
                invoice.partyName,
                invoice.partyGst,
                formatCurrency(Number(invoice.invoiceTotal || 0)),
              ])}
            />
          )}

          {selectedTransporter && adminDialog === "notes" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Add Support Note</Label>
                <Textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add admin support note..." />
                <Button onClick={handleAddNote} className="bg-gradient-primary font-bold">Add Note</Button>
              </div>
              <div className="space-y-3">
                {(selectedTransporter.supportNotes || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No support notes yet.</p>
                ) : (
                  selectedTransporter.supportNotes.map((note: any) => (
                    <div key={note.id} className="rounded-lg border border-border/50 p-3">
                      {editingNoteId === note.id ? (
                        <div className="space-y-2">
                          <Textarea value={editingNoteText} onChange={(event) => setEditingNoteText(event.target.value)} />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveNoteEdit}>Save</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingNoteId("")}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {note.createdBy || "super_admin"} - {note.createdAt ? new Date(note.createdAt).toLocaleString("en-IN") : ""}
                          </p>
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.text); }}>Edit</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteNote(note.id)}>Delete</Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminRowsTable({ headers, rows, emptyText }: { headers: string[]; rows: unknown[][]; emptyText: string }) {
  if (rows.length === 0) {
    return <div className="h-40 flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg">{emptyText}</div>;
  }

  return (
    <>
      <MobileDataCards>
        {rows.map((row, index) => (
          <MobileDataCard
            key={index}
            title={String(row[0] || "N/A")}
            subtitle={headers[1] ? `${headers[1]}: ${String(row[1] || "N/A")}` : undefined}
          >
            {row.slice(1).map((cell, cellIndex) => (
              <MobileDataField
                key={cellIndex}
                label={headers[cellIndex + 1]}
                value={String(cell || "N/A")}
              />
            ))}
          </MobileDataCard>
        ))}
      </MobileDataCards>

      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => <TableHead key={header}>{header}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                {row.map((cell, cellIndex) => <TableCell key={cellIndex}>{String(cell || "N/A")}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
