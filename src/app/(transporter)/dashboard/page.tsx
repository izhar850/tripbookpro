"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { collection, query, where, onSnapshot, doc, deleteDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Plus, Edit, Trash2, FileText, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { getTransporterTripAISuggestions } from "@/ai/flows/transporter-trip-ai-suggestions";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { profile, db } = useAuth();
  const { toast } = useToast();
  const [trips, setTrips] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalRevenue: 0,
    totalAdvance: 0,
    totalPending: 0
  });

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
      const tripsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips(tripsData);

      // Calc stats
      let revenue = 0, advance = 0, pending = 0;
      tripsData.forEach((trip: any) => {
        revenue += (Number(trip.totalAmount) || 0);
        advance += (Number(trip.advance) || 0);
        pending += (Number(trip.balance) || 0);
      });
      setStats({
        totalTrips: tripsData.length,
        totalRevenue: revenue,
        totalAdvance: advance,
        totalPending: pending
      });
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

  const calculateTotals = () => {
    const weight = Number(formData.weight) || 0;
    const rateQtl = Number(formData.rateQtl) || 0;
    const unloading = Number(formData.unloadingCharges) || 0;
    const advance = Number(formData.advance) || 0;

    const totalFreight = weight * rateQtl;
    const totalAmount = totalFreight + unloading;
    const balance = totalAmount - advance;

    return { totalFreight, totalAmount, balance };
  };

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
        description: `Suggested rate: ₹${suggestion.suggestedRateQtl} per quintal. Check logistical notes below.`
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

    const { totalFreight, totalAmount, balance } = calculateTotals();

    const numericData = {
      packages: Number(formData.packages) || 0,
      weight: Number(formData.weight) || 0,
      rateQtl: Number(formData.rateQtl) || 0,
      unloadingCharges: Number(formData.unloadingCharges) || 0,
      advance: Number(formData.advance) || 0,
    };

    try {
      if (editingTrip) {
        await runTransaction(db, async (transaction) => {
          const tripRef = doc(db, "trips", editingTrip.id);
          transaction.update(tripRef, {
            ...formData,
            ...numericData,
            companyName: profile.companyName,
            companyAddress: profile.address,
            partyName: selectedParty.partyName,
            partyGst: selectedParty.gstNo,
            partyAddress: selectedParty.address,
            partyMobile: selectedParty.mobile,
            totalFreight,
            totalAmount,
            balance,
            updatedAt: serverTimestamp()
          });
        });
        toast({ title: "Trip Updated", description: "The trip details have been updated." });
      } else {
        await runTransaction(db, async (transaction) => {
          const counterRef = doc(db, "counters", profile.uid);
          const counterDoc = await transaction.get(counterRef);
          
          let nextLrNo = 1;
          if (counterDoc.exists()) {
            nextLrNo = (counterDoc.data().lastLrNo || 0) + 1;
          }

          const lrNo = `LR-${nextLrNo.toString().padStart(4, '0')}`;
          const newTripRef = doc(collection(db, "trips"));

          transaction.set(newTripRef, {
            ...formData,
            ...numericData,
            userId: profile.uid,
            companyName: profile.companyName,
            companyAddress: profile.address,
            ownerName: profile.ownerName,
            partyName: selectedParty.partyName,
            partyGst: selectedParty.gstNo,
            partyAddress: selectedParty.address,
            partyMobile: selectedParty.mobile,
            lrNo,
            totalFreight,
            totalAmount,
            balance,
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

  const handleDeleteTrip = async (id: string) => {
    if (!db) return;
    if (confirm("Are you sure you want to delete this trip record?")) {
      await deleteDoc(doc(db, "trips", id));
      toast({ title: "Deleted", description: "Trip record deleted successfully." });
    }
  };

  const handleEditTrip = (trip: any) => {
    setEditingTrip(trip);
    setFormData({
      date: trip.date,
      partyId: trip.partyId,
      vehicleNo: trip.vehicleNo,
      packages: trip.packages.toString(),
      weight: trip.weight.toString(),
      goodsDescription: trip.goodsDescription,
      vehicleType: trip.vehicleType,
      sizeL: trip.sizeL || "",
      sizeW: trip.sizeW || "",
      sizeH: trip.sizeH || "",
      source: trip.source,
      destination: trip.destination,
      driverMobile: trip.driverMobile || "",
      rateQtl: trip.rateQtl.toString(),
      unloadingCharges: trip.unloadingCharges.toString(),
      advance: trip.advance.toString(),
      remark: trip.remark || "",
      gstPayBy: trip.gstPayBy,
      notes: trip.notes || ""
    });
    setIsSheetOpen(true);
  };

  const { totalFreight, totalAmount, balance } = calculateTotals();

  return (
    <div className="space-y-8">
      {/* Welcome & Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Welcome, {profile?.companyName}</h1>
          <p className="text-muted-foreground">Logistics Overview & Fleet Operations</p>
        </div>
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button onClick={() => { setEditingTrip(null); resetForm(); }} className="bg-gradient-primary shadow-lg shadow-indigo-500/20 h-11 px-6 font-bold">
              <Plus className="w-5 h-5 mr-2" /> New Trip Entry
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-xl overflow-y-auto bg-card border-l border-border/50 scrollbar-hide">
            <SheetHeader className="pb-6">
              <SheetTitle className="text-2xl font-headline font-bold">
                {editingTrip ? `Edit Trip Record: ${editingTrip.lrNo}` : "New Trip Log"}
              </SheetTitle>
            </SheetHeader>
            <form onSubmit={handleSaveTrip} className="space-y-6 pb-20">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
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

              <div className="grid grid-cols-2 gap-4">
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
                  <Label>Packages</Label>
                  <Input type="number" placeholder="50" value={formData.packages} onChange={e => setFormData({ ...formData, packages: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Weight (Qtl)</Label>
                  <Input type="number" step="0.01" placeholder="120.5" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Driver Mobile</Label>
                  <Input placeholder="Phone No." value={formData.driverMobile} onChange={e => setFormData({ ...formData, driverMobile: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Goods Description</Label>
                <Input placeholder="Cement Bags / Iron Rods" value={formData.goodsDescription} onChange={e => setFormData({ ...formData, goodsDescription: e.target.value })} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source (From)</Label>
                  <Input placeholder="City Name" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Destination (To)</Label>
                  <Input placeholder="City Name" value={formData.destination} onChange={e => setFormData({ ...formData, destination: e.target.value })} required />
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
                Get AI Pricing Suggestion
              </Button>

              <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
                <div className="space-y-2">
                  <Label>Rate (per Quintal)</Label>
                  <Input type="number" placeholder="450" value={formData.rateQtl} onChange={e => setFormData({ ...formData, rateQtl: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Unloading Charges</Label>
                  <Input type="number" placeholder="0" value={formData.unloadingCharges} onChange={e => setFormData({ ...formData, unloadingCharges: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Advance Received</Label>
                  <Input type="number" placeholder="0" value={formData.advance} onChange={e => setFormData({ ...formData, advance: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>GST Payable By</Label>
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

              {/* Live Calculation Card */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Freight (Weight x Rate)</span>
                    <span className="font-bold">₹{totalFreight.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Unloading Charges</span>
                    <span className="font-bold">₹{Number(formData.unloadingCharges || 0).toFixed(2)}</span>
                  </div>
                  <div className="h-px bg-border my-2" />
                  <div className="flex justify-between">
                    <span className="font-bold">Total Amount</span>
                    <span className="font-bold text-primary">₹{totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Advance Received</span>
                    <span className="font-bold text-destructive">- ₹{Number(formData.advance || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg pt-2 border-t">
                    <span className="font-headline font-bold">Balance Due</span>
                    <span className="font-headline font-bold text-accent">₹{balance.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Internal Logistical Notes (AI Suggested)</Label>
                <textarea 
                  className="w-full h-24 p-3 bg-secondary/50 rounded-lg text-sm border focus:ring-primary"
                  placeholder="Additional route or handling info..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Public Remarks (Visible on LR)</Label>
                <Input placeholder="Extra instructions" value={formData.remark} onChange={e => setFormData({ ...formData, remark: e.target.value })} />
              </div>

              <Button type="submit" className="w-full h-12 bg-gradient-primary font-bold text-lg">
                {editingTrip ? "Update Trip Entry" : "Save & Generate LR"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {profile && !profile.profileCompleted && (
        <div className="flex items-center gap-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Incomplete Profile</p>
            <p className="text-sm opacity-80">Please complete your bank and company details in the Profile section to enable invoice printing.</p>
          </div>
          <Link href="/profile">
            <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10 font-bold">Complete Now</Button>
          </Link>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Trips", value: stats.totalTrips, sub: "Historical load count", color: "text-primary" },
          { label: "Total Revenue", value: `₹${stats.totalRevenue.toLocaleString()}`, sub: "Gross billing amount", color: "text-green-500" },
          { label: "Total Advance", value: `₹${stats.totalAdvance.toLocaleString()}`, sub: "Cash on dispatch", color: "text-blue-500" },
          { label: "Pending Balance", value: `₹${stats.totalPending.toLocaleString()}`, sub: "Outstanding debt", color: "text-destructive" }
        ].map((stat, i) => (
          <Card key={i} className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold font-headline", stat.color)}>{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trips Table */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Shipments</CardTitle>
            <Link href="/billing">
              <Button variant="ghost" className="text-primary hover:text-primary/80">
                Go to Billing <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : trips.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
              <FileText className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold">No trips logged yet.</p>
              <p className="text-sm">Start by creating a new trip entry.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow>
                  <TableHead className="font-bold">LR No</TableHead>
                  <TableHead className="font-bold">Date</TableHead>
                  <TableHead className="font-bold">Party</TableHead>
                  <TableHead className="font-bold">Vehicle</TableHead>
                  <TableHead className="font-bold">Route</TableHead>
                  <TableHead className="font-bold text-right">Freight</TableHead>
                  <TableHead className="font-bold text-right">Balance</TableHead>
                  <TableHead className="font-bold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => (
                  <TableRow key={trip.id} className="hover:bg-secondary/30 transition-colors group">
                    <TableCell className="font-bold text-primary">{trip.lrNo}</TableCell>
                    <TableCell className="text-sm">{trip.date}</TableCell>
                    <TableCell className="font-medium">{trip.partyName}</TableCell>
                    <TableCell className="text-xs font-mono">{trip.vehicleNo}</TableCell>
                    <TableCell className="text-sm">{trip.source} → {trip.destination}</TableCell>
                    <TableCell className="text-right font-bold">₹{Number(trip.totalAmount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={Number(trip.balance || 0) > 0 ? "destructive" : "secondary"}>
                        ₹{Number(trip.balance || 0).toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/lr-receipt-preview?id=${trip.id}`}>
                          <Button size="icon" variant="ghost" className="text-green-500 hover:bg-green-500/10">
                            <FileText className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button size="icon" variant="ghost" onClick={() => handleEditTrip(trip)} className="text-blue-500 hover:bg-blue-500/10">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteTrip(trip.id)} className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
