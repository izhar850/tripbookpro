"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useFirestore } from "@/firebase";
import { collection, query, where, onSnapshot, doc, deleteDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Plus, Edit, Trash2, FileText, Loader2, Sparkles, Search, TrendingUp, Users as UsersIcon, Wallet, ArrowUpRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { getTransporterTripAISuggestions } from "@/ai/flows/transporter-trip-ai-suggestions";
import { cn } from "@/lib/utils";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";

export default function Dashboard() {
  const { profile, db } = useAuth();
  const { toast } = useToast();
  const [trips, setTrips] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<any>(null);
  const [tripToDelete, setTripToDelete] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    partyId: "",
    vehicleNo: "",
    packages: "",
    weight: "",
    goodsDescription: "",
    vehicleType: "",
    sizeL: "",
    sizeW: "",
    sizeH: "",
    source: "",
    destination: "",
    driverMobile: "",
    rateQtl: "",
    unloadingCharges: "",
    advance: "",
    remark: "",
    gstPayBy: "transporter",
    notes: ""
  });

  useEffect(() => {
    if (!profile || !db) return;

    const tripsQuery = query(collection(db, "trips"), where("userId", "==", profile.uid));
    const unsubscribeTrips = onSnapshot(tripsQuery, (snapshot) => {
      setTrips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const partiesQuery = query(collection(db, "parties"), where("userId", "==", profile.uid));
    const unsubscribeParties = onSnapshot(partiesQuery, (snapshot) => {
      setParties(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeTrips();
      unsubscribeParties();
    };
  }, [profile, db]);

  // Financial Stats
  const stats = useMemo(() => {
    let revenue = 0, advance = 0, pending = 0;
    trips.forEach((trip: any) => {
      revenue += (Number(trip.totalAmount) || 0);
      advance += (Number(trip.advance) || 0);
      pending += (Number(trip.balance) || 0);
    });
    return {
      totalTrips: trips.length,
      totalRevenue: revenue,
      totalAdvance: advance,
      totalPending: pending,
      avgTripValue: trips.length ? (revenue / trips.length) : 0
    };
  }, [trips]);

  // Chart Data: Revenue by Month
  const chartData = useMemo(() => {
    const months: { [key: string]: number } = {};
    trips.forEach(t => {
      const month = new Date(t.date).toLocaleString('default', { month: 'short' });
      months[month] = (months[month] || 0) + (Number(t.totalAmount) || 0);
    });
    return Object.keys(months).map(name => ({ name, value: months[name] }));
  }, [trips]);

  // Chart Data: Party Distribution
  const partyData = useMemo(() => {
    const partyStats: { [key: string]: number } = {};
    trips.forEach(t => {
      partyStats[t.partyName] = (partyStats[t.partyName] || 0) + (Number(t.totalAmount) || 0);
    });
    return Object.keys(partyStats).map(name => ({ name, value: partyStats[name] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [trips]);

  const totals = useMemo(() => {
    const weight = Number(formData.weight) || 0;
    const rateQtl = Number(formData.rateQtl) || 0;
    const unloading = Number(formData.unloadingCharges) || 0;
    const advance = Number(formData.advance) || 0;

    const totalFreight = weight * rateQtl;
    const totalAmount = totalFreight + unloading;
    const balance = totalAmount - advance;

    return { totalFreight, totalAmount, balance };
  }, [formData.weight, formData.rateQtl, formData.unloadingCharges, formData.advance]);

  const handleAiSuggestion = async () => {
    if (!formData.source || !formData.destination || !formData.goodsDescription || !formData.weight || !formData.vehicleType) {
      toast({
        title: "Missing Info",
        description: "Please fill source, destination, goods, weight, and vehicle type for AI suggestions.",
        variant: "destructive"
      });
      return;
    }

    setIsAiLoading(true);
    try {
      const suggestion = await getTransporterTripAISuggestions({
        source: formData.source,
        destination: formData.destination,
        goodsDescription: formData.goodsDescription,
        weight: Number(formData.weight),
        vehicleType: formData.vehicleType
      });

      setFormData(prev => ({
        ...prev,
        rateQtl: suggestion.suggestedRateQtl.toString(),
        notes: suggestion.logisticalNotes
      }));

      toast({
        title: "AI Suggestion Applied",
        description: `Suggested rate: ₹${suggestion.suggestedRateQtl} per quintal.`
      });
    } catch (error) {
      toast({ title: "AI Error", description: "Failed to get AI suggestions.", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !db) return;

    const selectedParty = parties.find(p => p.id === formData.partyId);
    if (!selectedParty) {
      toast({ title: "Select Party", description: "Please select a party for this trip.", variant: "destructive" });
      return;
    }

    const { totalFreight, totalAmount, balance } = totals;

    const numericData = {
      packages: Number(formData.packages) || 0,
      weight: Number(formData.weight) || 0,
      rateQtl: Number(formData.rateQtl) || 0,
      unloadingCharges: Number(formData.unloadingCharges) || 0,
      advance: Number(formData.advance) || 0,
      totalFreight: Number(totalFreight) || 0,
      totalAmount: Number(totalAmount) || 0,
      balance: Number(balance) || 0,
    };

    try {
      if (editingTrip) {
        const tripRef = doc(db, "trips", editingTrip.id);
        await runTransaction(db, async (transaction) => {
          transaction.update(tripRef, {
            ...formData,
            ...numericData,
            companyName: profile.companyName,
            companyAddress: profile.address || "",
            companyGst: profile.gstNo || "",
            companyMobile: profile.mobile || "",
            partyName: selectedParty.partyName,
            partyGst: selectedParty.gstNo,
            partyAddress: selectedParty.address,
            partyMobile: selectedParty.mobile,
            updatedAt: serverTimestamp()
          });
        });
        toast({ title: "Trip Updated", description: "The trip details have been updated." });
      } else {
        const counterRef = doc(db, "counters", profile.uid);
        const newTripRef = doc(collection(db, "trips"));
        
        await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          let nextLrNo = 1;
          if (counterDoc.exists()) {
            nextLrNo = (counterDoc.data().lastLrNo || 0) + 1;
          }

          const lrNo = `LR-${nextLrNo.toString().padStart(4, '0')}`;

          transaction.set(newTripRef, {
            ...formData,
            ...numericData,
            userId: profile.uid,
            companyName: profile.companyName,
            companyAddress: profile.address || "",
            companyGst: profile.gstNo || "",
            companyMobile: profile.mobile || "",
            ownerName: profile.ownerName,
            partyName: selectedParty.partyName,
            partyGst: selectedParty.gstNo,
            partyAddress: selectedParty.address,
            partyMobile: selectedParty.mobile,
            lrNo,
            createdAt: serverTimestamp()
          });

          transaction.update(counterRef, { lastLrNo: nextLrNo });
        });
        toast({ title: "Trip Created", description: "New trip record added successfully." });
      }

      setIsSheetOpen(false);
      setEditingTrip(null);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error Saving", description: error.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      partyId: "",
      vehicleNo: "",
      packages: "",
      weight: "",
      goodsDescription: "",
      vehicleType: "",
      sizeL: "",
      sizeW: "",
      sizeH: "",
      source: "",
      destination: "",
      driverMobile: "",
      rateQtl: "",
      unloadingCharges: "",
      advance: "",
      remark: "",
      gstPayBy: "transporter",
      notes: ""
    });
  };

  const handleDeleteTrip = async () => {
    if (!db || !tripToDelete) return;
    try {
      await deleteDoc(doc(db, "trips", tripToDelete.id));
      toast({ title: "Deleted", description: `Trip ${tripToDelete.lrNo} record deleted.` });
    } catch (error: any) {
      toast({ title: "Error Deleting", description: error.message, variant: "destructive" });
    } finally {
      setTripToDelete(null);
    }
  };

  const handleEditTrip = (trip: any) => {
    setEditingTrip(trip);
    setFormData({
      date: trip.date,
      partyId: trip.partyId,
      vehicleNo: trip.vehicleNo,
      packages: (trip.packages || 0).toString(),
      weight: (trip.weight || 0).toString(),
      goodsDescription: trip.goodsDescription,
      vehicleType: trip.vehicleType,
      sizeL: trip.sizeL || "",
      sizeW: trip.sizeW || "",
      sizeH: trip.sizeH || "",
      source: trip.source,
      destination: trip.destination,
      driverMobile: trip.driverMobile || "",
      rateQtl: (trip.rateQtl || 0).toString(),
      unloadingCharges: (trip.unloadingCharges || 0).toString(),
      advance: (trip.advance || 0).toString(),
      remark: trip.remark || "",
      gstPayBy: trip.gstPayBy,
      notes: trip.notes || ""
    });
    setIsSheetOpen(true);
  };

  const filteredTrips = trips.filter(trip => {
    const queryStr = searchQuery.toLowerCase();
    return (
      trip.lrNo?.toLowerCase().includes(queryStr) ||
      trip.partyName?.toLowerCase().includes(queryStr) ||
      trip.vehicleNo?.toLowerCase().includes(queryStr) ||
      trip.source?.toLowerCase().includes(queryStr) ||
      trip.destination?.toLowerCase().includes(queryStr) ||
      trip.goodsDescription?.toLowerCase().includes(queryStr)
    );
  });

  const COLORS = ['#5850EC', '#2563EB', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <div className="space-y-6 md:space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Fleet Operations</h1>
          <p className="text-sm text-muted-foreground">Manage your shipments and logistics logs</p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button onClick={() => { setEditingTrip(null); resetForm(); }} className="flex-1 md:flex-none bg-gradient-primary shadow-lg shadow-indigo-500/20 h-11 px-6 font-bold">
                <Plus className="w-5 h-5 mr-2" /> New Trip Entry
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto bg-card border-l border-border/50 scrollbar-hide">
              <SheetHeader className="pb-6">
                <SheetTitle className="text-2xl font-headline font-bold">
                  {editingTrip ? `Edit Trip: ${editingTrip.lrNo}` : "New Trip Log"}
                </SheetTitle>
              </SheetHeader>
              <form onSubmit={handleSaveTrip} className="space-y-6 pb-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Party (Client)</Label>
                    <Select value={formData.partyId} onValueChange={val => setFormData({ ...formData, partyId: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Client" />
                      </SelectTrigger>
                      <SelectContent>
                        {parties.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.partyName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vehicle Number</Label>
                    <Input placeholder="RJ-14-GA-1234" value={formData.vehicleNo} onChange={e => setFormData({ ...formData, vehicleNo: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Vehicle Type</Label>
                    <Input placeholder="Open Truck / 14ft" value={formData.vehicleType} onChange={e => setFormData({ ...formData, vehicleType: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Length (ft)</Label>
                    <Input type="number" placeholder="L" value={formData.sizeL} onChange={e => setFormData({ ...formData, sizeL: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Width (ft)</Label>
                    <Input type="number" placeholder="W" value={formData.sizeW} onChange={e => setFormData({ ...formData, sizeW: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Height (ft)</Label>
                    <Input type="number" placeholder="H" value={formData.sizeH} onChange={e => setFormData({ ...formData, sizeH: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Packages</Label>
                    <Input type="number" placeholder="Qty" value={formData.packages} onChange={e => setFormData({ ...formData, packages: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Weight (Qtl)</Label>
                    <Input type="number" step="0.01" placeholder="Wt" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Driver Mobile</Label>
                    <Input placeholder="Phone" value={formData.driverMobile} onChange={e => setFormData({ ...formData, driverMobile: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Goods Description</Label>
                  <Input placeholder="Cement Bags / Iron Rods" value={formData.goodsDescription} onChange={e => setFormData({ ...formData, goodsDescription: e.target.value })} required />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Source (From)</Label>
                    <Input placeholder="City" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Destination (To)</Label>
                    <Input placeholder="City" value={formData.destination} onChange={e => setFormData({ ...formData, destination: e.target.value })} required />
                  </div>
                </div>

                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full border-primary/50 text-primary hover:bg-primary/10 font-bold h-11"
                  onClick={handleAiSuggestion}
                  disabled={isAiLoading}
                >
                  {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                  AI Pricing Suggestion
                </Button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
                  <div className="space-y-2">
                    <Label>Rate (per Quintal)</Label>
                    <Input type="number" placeholder="0" value={formData.rateQtl} onChange={e => setFormData({ ...formData, rateQtl: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Unloading</Label>
                    <Input type="number" placeholder="0" value={formData.unloadingCharges} onChange={e => setFormData({ ...formData, unloadingCharges: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Advance</Label>
                    <Input type="number" placeholder="0" value={formData.advance} onChange={e => setFormData({ ...formData, advance: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>GST By</Label>
                    <Select value={formData.gstPayBy} onValueChange={val => setFormData({ ...formData, gstPayBy: val })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transporter">Transporter</SelectItem>
                        <SelectItem value="consignee">Consignee</SelectItem>
                        <SelectItem value="consigner">Consigner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-6 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Freight Amount</span>
                      <span className="font-bold">₹{totals.totalFreight.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Unloading</span>
                      <span className="font-bold">₹{Number(formData.unloadingCharges || 0).toFixed(2)}</span>
                    </div>
                    <div className="h-px bg-border my-2" />
                    <div className="flex justify-between font-bold">
                      <span>Total Bill</span>
                      <span className="text-primary">₹{totals.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Advance</span>
                      <span className="font-bold text-destructive">- ₹{Number(formData.advance || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg pt-2 border-t font-headline font-bold">
                      <span>Balance Due</span>
                      <span className="text-accent">₹{totals.balance.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <Label>Logistical Notes (AI Suggested)</Label>
                  <textarea 
                    className="w-full h-24 p-3 bg-secondary/50 rounded-lg text-sm border focus:ring-primary outline-none"
                    placeholder="AI generated tips for this route..."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <Button type="submit" className="w-full h-12 bg-gradient-primary font-bold text-lg sticky bottom-0">
                  {editingTrip ? "Update Entry" : "Save & Generate LR"}
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: "Total Shipments", value: stats.totalTrips, icon: Truck, color: "text-primary", sub: "Live Logs" },
          { label: "Gross Revenue", value: `₹${stats.totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-green-500", sub: "Total Billed" },
          { label: "Pending Payments", value: `₹${stats.totalPending.toLocaleString()}`, icon: Wallet, color: "text-destructive", sub: "Action Required" },
          { label: "Top Party Share", value: partyData[0] ? `${((partyData[0].value / stats.totalRevenue) * 100).toFixed(0)}%` : "0%", icon: UsersIcon, color: "text-blue-500", sub: partyData[0]?.name || "N/A" }
        ].map((stat, i) => (
          <Card key={i} className="bg-card border-border/50 hover:border-primary/50 transition-all group overflow-hidden relative">
            <div className={cn("absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 opacity-5 transition-transform group-hover:scale-110", stat.color.replace('text', 'bg'))} />
            <CardHeader className="p-5 pb-2">
              <div className="flex justify-between items-center mb-1">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</CardTitle>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className={cn("text-3xl font-bold font-headline mb-1", stat.color)}>{stat.value}</div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-bold">
                <ArrowUpRight className="w-3 h-3" /> {stat.sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Revenue Overview</CardTitle>
            <CardDescription>Monthly distribution of freight income</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }} 
                  tickFormatter={(val) => `₹${val/1000}k`}
                />
                <ChartTooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Party Distribution</CardTitle>
            <CardDescription>Revenue share by top clients</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col items-center">
            <ResponsiveContainer width="100%" height="70%">
              <PieChart>
                <Pie
                  data={partyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {partyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full space-y-2 mt-4">
              {partyData.map((p, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="truncate max-w-[120px] font-medium">{p.name}</span>
                  </div>
                  <span className="font-bold">₹{p.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shipment Table */}
      <Card className="bg-card border-border/50">
        <CardHeader className="p-4 md:p-6 border-b border-border/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-xl">Recent Shipments</CardTitle>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Search by LR, Party, Vehicle or Route..." 
                className="pl-10 bg-secondary/30 h-10 border-border/50 focus:border-primary/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground p-8">
              <FileText className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold text-lg">No matching records</p>
              <p className="text-sm">Try a different search query or add a new trip.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead className="font-bold whitespace-nowrap">LR No</TableHead>
                    <TableHead className="font-bold whitespace-nowrap">Party</TableHead>
                    <TableHead className="font-bold whitespace-nowrap">Vehicle</TableHead>
                    <TableHead className="font-bold whitespace-nowrap">Route</TableHead>
                    <TableHead className="font-bold text-right">Amount</TableHead>
                    <TableHead className="font-bold text-right">Status</TableHead>
                    <TableHead className="font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrips.map((trip) => (
                    <TableRow key={trip.id} className="hover:bg-secondary/20 transition-colors group">
                      <TableCell className="font-bold text-primary py-4">{trip.lrNo}</TableCell>
                      <TableCell className="font-medium truncate max-w-[150px]">{trip.partyName}</TableCell>
                      <TableCell className="text-xs font-mono">{trip.vehicleNo}</TableCell>
                      <TableCell className="text-sm truncate max-w-[150px]">{trip.source} → {trip.destination}</TableCell>
                      <TableCell className="text-right font-bold">₹{Number(trip.totalAmount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={Number(trip.balance || 0) > 0 ? "destructive" : "secondary"}>
                          {Number(trip.balance || 0) > 0 ? `₹${Number(trip.balance).toLocaleString()} Due` : "Paid"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/lr-receipt-preview?id=${trip.id}`}>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500">
                              <FileText className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button size="icon" variant="ghost" onClick={() => handleEditTrip(trip)} className="h-8 w-8 text-blue-500">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setTripToDelete(trip)} className="h-8 w-8 text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!tripToDelete} onOpenChange={(open) => !open && setTripToDelete(null)}>
        <AlertDialogContent className="bg-card border border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-headline font-bold text-destructive flex items-center gap-2">
              <Trash2 className="w-6 h-6" /> Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground pt-2">
              Are you sure you want to delete shipment <span className="font-bold text-foreground">{tripToDelete?.lrNo}</span>? 
              This will remove all associated financial and logistics data permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4 gap-2">
            <AlertDialogCancel className="bg-secondary border-none font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTrip}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold shadow-lg shadow-destructive/20"
            >
              Delete Shipment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}