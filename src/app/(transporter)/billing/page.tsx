
"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CreditCard, Loader2, FileCheck, Users, Download, ReceiptText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export default function BillingPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [parties, setParties] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [viewStatus, setViewStatus] = useState<"unbilled" | "billed">("unbilled");

  useEffect(() => {
    if (!profile) return;
    const partiesQuery = query(collection(db, "parties"), where("userId", "==", profile.uid));
    const unsubscribeParties = onSnapshot(
      partiesQuery, 
      (snapshot) => {
        setParties(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: 'parties',
          operation: 'list',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      }
    );
    return () => unsubscribeParties();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const tripsQuery = query(
      collection(db, "trips"), 
      where("userId", "==", profile.uid), 
      where("billed", "==", viewStatus === "billed")
    );
    
    const unsubscribe = onSnapshot(
      tripsQuery, 
      (snapshot) => {
        setTrips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: 'trips',
          operation: 'list',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [profile, viewStatus]);

  const partiesWithTrips = useMemo(() => {
    const partyIdsInTrips = new Set(trips.map(t => t.partyId));
    return parties.filter(p => partyIdsInTrips.has(p.id));
  }, [parties, trips]);

  const currentTrips = useMemo(() => {
    if (!selectedPartyId || selectedPartyId === "none") return trips;
    return trips.filter(t => t.partyId === selectedPartyId);
  }, [trips, selectedPartyId]);

  const toggleTripSelection = (id: string) => {
    setSelectedTripIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const selectedTripsData = useMemo(() => {
    return trips.filter(t => selectedTripIds.includes(t.id));
  }, [trips, selectedTripIds]);

  const invoiceTotal = selectedTripsData.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0);

  const handleExportCSV = () => {
    // If some are selected, export those. Otherwise export all visible in current list.
    const dataToExport = selectedTripIds.length > 0 ? selectedTripsData : currentTrips;

    if (dataToExport.length === 0) {
      toast({
        title: "No Data",
        description: "There are no trip records available to export.",
        variant: "destructive"
      });
      return;
    }

    setExporting(true);
    try {
      const headers = [
        "Bill No", "LR No", "Date", "Party Name", "Vehicle No", 
        "Source", "Destination", "Packages", "Weight", "Rate/Qtl", 
        "Total Freight", "Advance", "Balance", "GST Pay By"
      ];

      const csvRows = dataToExport.map(t => [
        t.billNo || "",
        t.lrNo || "",
        t.date || "",
        t.partyName || "",
        t.vehicleNo || "",
        t.source || "",
        t.destination || "",
        t.packages || 0,
        t.weight || 0,
        t.rateQtl || 0,
        t.totalFreight || 0,
        t.advance || 0,
        t.balance || 0,
        t.gstPayBy || ""
      ].map(val => {
        if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
        return val;
      }).join(","));

      const csvContent = [headers.join(","), ...csvRows].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().split('T')[0];
      
      link.setAttribute("href", url);
      link.setAttribute("download", `TripBook_Billing_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Success",
        description: `Exported ${dataToExport.length} records successfully.`
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "An unexpected error occurred during CSV generation.",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!profile || selectedTripIds.length === 0) return;
    setGenerating(true);

    const party = parties.find(p => p.id === selectedPartyId);
    if (!party) return;

    try {
      let billNo = "";
      let invoiceId = "";

      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, "billCounters", profile.uid);
        const counterDoc = await transaction.get(counterRef);
        
        let nextBillNo = 1;
        if (counterDoc.exists()) {
          nextBillNo = (counterDoc.data().lastBillNo || 0) + 1;
        }

        billNo = `BILL-${nextBillNo.toString().padStart(4, '0')}`;
        
        const invoiceRef = doc(collection(db, "invoices"));
        invoiceId = invoiceRef.id;

        const invoiceData = {
          userId: profile.uid,
          billNo,
          partyId: selectedPartyId,
          partyName: party.partyName,
          partyGst: party.gstNo || "",
          partyAddress: party.address || "",
          partyMobile: party.mobile || "",
          invoiceTotal,
          trips: selectedTripsData,
          transporterProfile: {
            companyName: profile.companyName,
            address: profile.address,
            gstNo: profile.gstNo,
            email: profile.email,
            mobile: profile.mobile,
            officePhone: profile.officePhone,
            bankName: profile.bankName,
            accountNo: profile.accountNo,
            ifscCode: profile.ifscCode
          },
          createdAt: serverTimestamp()
        };

        transaction.set(invoiceRef, invoiceData);

        selectedTripIds.forEach(id => {
          const tripRef = doc(db, "trips", id);
          transaction.update(tripRef, { 
            billed: true, 
            billNo, 
            invoiceId 
          });
        });

        transaction.update(counterRef, { lastBillNo: nextBillNo });
      }).catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: 'invoices',
          operation: 'write',
          requestResourceData: { partyId: selectedPartyId, tripCount: selectedTripIds.length },
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      });

      toast({ title: "Invoice Generated", description: `Bill No: ${billNo} is ready.` });
      router.push(`/invoice-preview?id=${invoiceId}`);
    } catch (error: any) {
      toast({ title: "Billing Error", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Billing Center</h1>
          <p className="text-muted-foreground">Manage pending shipments and tax invoice generation</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button 
            variant="outline" 
            onClick={handleExportCSV} 
            disabled={currentTrips.length === 0 || exporting}
            className="flex-1 md:flex-none h-11 border-border/50 font-bold bg-secondary/50 hover:bg-secondary"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Party Filter
              </CardTitle>
              <CardDescription>Filter records by client</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedPartyId} onValueChange={(val) => { setSelectedPartyId(val); setSelectedTripIds([]); }}>
                <SelectTrigger className="h-12 bg-secondary/30">
                  <SelectValue placeholder="All Parties" />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="none">All Parties</SelectItem>
                  {partiesWithTrips.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.partyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {viewStatus === "unbilled" && selectedPartyId && selectedPartyId !== "none" && (
                <div className="pt-6 mt-6 border-t border-border/50 space-y-4">
                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground font-bold uppercase">Selection Info</span>
                      <span className="text-primary font-bold">{selectedTripIds.length} Trips</span>
                    </div>
                    <div className="flex justify-between text-xl font-headline font-bold pt-1">
                      <span>Total Amount</span>
                      <span className="text-primary">₹{invoiceTotal.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleGenerateInvoice}
                    disabled={selectedTripIds.length === 0 || generating}
                    className="w-full bg-gradient-primary h-12 shadow-indigo-500/20 shadow-lg font-bold text-lg"
                  >
                    {generating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <FileCheck className="w-5 h-5 mr-2" />}
                    Generate Tax Invoice
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {viewStatus === "unbilled" && partiesWithTrips.length > 0 && (!selectedPartyId || selectedPartyId === "none") && (
            <div className="bg-blue-500/5 border border-blue-500/20 p-6 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-left-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <ReceiptText className="w-5 h-5 text-blue-500" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-blue-500">Pending Actions</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Select a party from the list to process their shipments into a single tax invoice.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-2 space-y-4">
          <Tabs value={viewStatus} onValueChange={(v: any) => { setViewStatus(v); setSelectedTripIds([]); }} className="w-full">
            <TabsList className="bg-secondary/50 w-full sm:w-auto">
              <TabsTrigger value="unbilled" className="flex-1 sm:flex-none">Pending Billing</TabsTrigger>
              <TabsTrigger value="billed" className="flex-1 sm:flex-none">Billing History</TabsTrigger>
            </TabsList>
          </Tabs>

          <Card className="bg-card border-border/50 min-h-[400px]">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg flex justify-between items-center">
                <span>{viewStatus === "unbilled" ? "Unbilled Shipments" : "Processed Records"}</span>
                {selectedTripIds.length > 0 && (
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                    {selectedTripIds.length} Selected
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {currentTrips.length === 0 ? (
                <div className="h-96 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                  <AlertCircle className="w-16 h-16 mb-4 opacity-20 text-orange-500" />
                  <p className="font-bold text-lg">No records found.</p>
                  <p className="text-sm max-w-xs mx-auto">There are no trips matching your criteria in this section.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow>
                        <TableHead className="w-[60px]">
                          <Checkbox 
                            checked={selectedTripIds.length === currentTrips.length && currentTrips.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTripIds(currentTrips.map(t => t.id));
                              } else {
                                setSelectedTripIds([]);
                              }
                            }}
                          />
                        </TableHead>
                        {viewStatus === "billed" && <TableHead className="font-bold">Bill No</TableHead>}
                        <TableHead className="font-bold">LR No</TableHead>
                        <TableHead className="font-bold">Party</TableHead>
                        <TableHead className="font-bold">Route</TableHead>
                        <TableHead className="font-bold text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentTrips.map((trip) => (
                        <TableRow 
                          key={trip.id} 
                          className="hover:bg-secondary/20 transition-colors cursor-pointer" 
                          onClick={() => toggleTripSelection(trip.id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox 
                              checked={selectedTripIds.includes(trip.id)} 
                              onCheckedChange={() => toggleTripSelection(trip.id)} 
                              className="w-5 h-5"
                            />
                          </TableCell>
                          {viewStatus === "billed" && <TableCell className="font-mono text-xs">{trip.billNo}</TableCell>}
                          <TableCell className="font-bold text-primary">{trip.lrNo}</TableCell>
                          <TableCell className="text-sm truncate max-w-[120px]">{trip.partyName}</TableCell>
                          <TableCell className="text-xs">{trip.source} → {trip.destination}</TableCell>
                          <TableCell className="text-right font-bold text-foreground">₹{trip.totalAmount.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
