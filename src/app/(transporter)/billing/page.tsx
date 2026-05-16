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
import { AlertCircle, CreditCard, Loader2, FileCheck, Users, ArrowRight, ReceiptText } from "lucide-react";
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
  const [allUnbilledTrips, setAllUnbilledTrips] = useState<any[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

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
    const unbilledQuery = query(
      collection(db, "trips"), 
      where("userId", "==", profile.uid), 
      where("billed", "==", false)
    );
    const unsubscribe = onSnapshot(
      unbilledQuery, 
      (snapshot) => {
        setAllUnbilledTrips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
  }, [profile]);

  const partiesWithUnbilledTrips = useMemo(() => {
    const unbilledPartyIds = new Set(allUnbilledTrips.map(t => t.partyId));
    return parties.filter(p => unbilledPartyIds.has(p.id));
  }, [parties, allUnbilledTrips]);

  const currentTrips = useMemo(() => {
    return allUnbilledTrips.filter(t => t.partyId === selectedPartyId);
  }, [allUnbilledTrips, selectedPartyId]);

  const toggleTripSelection = (id: string) => {
    setSelectedTripIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const selectedTrips = currentTrips.filter(t => selectedTripIds.includes(t.id));
  const invoiceTotal = selectedTrips.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0);

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
          trips: selectedTrips,
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
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Select Party
              </CardTitle>
              <CardDescription>Only parties with unbilled trips are listed below</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedPartyId} onValueChange={(val) => { setSelectedPartyId(val); setSelectedTripIds([]); }}>
                <SelectTrigger className="h-12 bg-secondary/30">
                  <SelectValue placeholder="Choose an unbilled party..." />
                </SelectTrigger>
                <SelectContent>
                  {partiesWithUnbilledTrips.length === 0 ? (
                    <SelectItem value="none" disabled>No pending billing found</SelectItem>
                  ) : (
                    partiesWithUnbilledTrips.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.partyName}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {selectedPartyId && (
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

          {partiesWithUnbilledTrips.length > 0 && !selectedPartyId && (
            <div className="bg-blue-500/5 border border-blue-500/20 p-6 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-left-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <ReceiptText className="w-5 h-5 text-blue-500" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-blue-500">Pending Actions</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You have <b>{partiesWithUnbilledTrips.length}</b> client(s) waiting for invoices. Select one from the list to process their shipments.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <Card className="bg-card border-border/50 min-h-[400px]">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg">Unbilled Shipments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!selectedPartyId ? (
                <div className="h-96 flex flex-col items-center justify-center text-muted-foreground">
                  <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mb-6">
                    <ArrowRight className="w-8 h-8 opacity-20" />
                  </div>
                  <p className="font-bold text-lg">Select a party to view their unbilled cargo</p>
                  <p className="text-xs opacity-60">Trips marked as 'Unbilled' in the registry will appear here.</p>
                </div>
              ) : currentTrips.length === 0 ? (
                <div className="h-96 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                  <AlertCircle className="w-16 h-16 mb-4 opacity-20 text-orange-500" />
                  <p className="font-bold text-lg">No unbilled trips for this party.</p>
                  <p className="text-sm max-w-xs mx-auto">Either all trips have been billed or no trips are logged for this client yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow>
                        <TableHead className="w-[60px]"></TableHead>
                        <TableHead className="font-bold">LR No</TableHead>
                        <TableHead className="font-bold">Date</TableHead>
                        <TableHead className="font-bold">Vehicle</TableHead>
                        <TableHead className="font-bold">Route</TableHead>
                        <TableHead className="font-bold text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentTrips.map((trip) => (
                        <TableRow key={trip.id} className="hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => toggleTripSelection(trip.id)}>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox 
                              checked={selectedTripIds.includes(trip.id)} 
                              onCheckedChange={() => toggleTripSelection(trip.id)} 
                              className="w-5 h-5"
                            />
                          </TableCell>
                          <TableCell className="font-bold text-primary">{trip.lrNo}</TableCell>
                          <TableCell className="text-sm">{trip.date}</TableCell>
                          <TableCell className="text-xs font-mono">{trip.vehicleNo}</TableCell>
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
