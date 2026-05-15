
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, runTransaction } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CreditCard, Loader2, FileCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    if (!profile) return;
    const partiesQuery = query(collection(db, "parties"), where("userId", "==", profile.uid));
    const unsubscribeParties = onSnapshot(partiesQuery, (snapshot) => {
      setParties(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribeParties();
  }, [profile]);

  useEffect(() => {
    if (!profile || !selectedPartyId) {
      setTrips([]);
      return;
    }
    // Only fetch unbilled trips for invoice generation
    const tripsQuery = query(
      collection(db, "trips"), 
      where("userId", "==", profile.uid), 
      where("partyId", "==", selectedPartyId),
      where("billed", "==", false)
    );
    const unsubscribeTrips = onSnapshot(tripsQuery, (snapshot) => {
      setTrips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribeTrips();
  }, [profile, selectedPartyId]);

  const toggleTripSelection = (id: string) => {
    setSelectedTripIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const selectedTrips = trips.filter(t => selectedTripIds.includes(t.id));
  const invoiceTotal = selectedTrips.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0);

  const handleGenerateInvoice = async () => {
    if (!profile || selectedTripIds.length === 0) return;
    setGenerating(true);

    try {
      let billNo = "";
      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, "billCounters", profile.uid);
        const counterDoc = await transaction.get(counterRef);
        
        let nextBillNo = 1;
        if (counterDoc.exists()) {
          nextBillNo = (counterDoc.data().lastBillNo || 0) + 1;
        }

        billNo = `BILL-${nextBillNo.toString().padStart(4, '0')}`;
        
        // Mark trips as billed
        selectedTripIds.forEach(id => {
          const tripRef = doc(db, "trips", id);
          transaction.update(tripRef, { billed: true, billNo });
        });

        transaction.update(counterRef, { lastBillNo: nextBillNo });
      });

      const queryParams = new URLSearchParams({
        billNo,
        partyId: selectedPartyId,
        tripIds: selectedTripIds.join(',')
      });

      router.push(`/invoice-preview?${queryParams.toString()}`);
    } catch (error: any) {
      toast({ title: "Billing Error", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (parties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 bg-card border border-border/50 rounded-2xl">
        <AlertCircle className="w-16 h-16 text-primary mb-4" />
        <h2 className="text-2xl font-headline font-bold mb-2">Setup Required</h2>
        <p className="text-muted-foreground max-w-md">Please create at least one party and one trip to continue with billing invoices.</p>
        <Button onClick={() => router.push("/parties")} className="mt-6 bg-gradient-primary">Go to Parties</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Billing Center</h1>
          <p className="text-muted-foreground">Select a party and trips to generate tax invoices</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <Card className="bg-card border-border/50 h-fit">
            <CardHeader>
              <CardTitle className="text-lg">Select Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedPartyId} onValueChange={(val) => { setSelectedPartyId(val); setSelectedTripIds([]); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a party..." />
                </SelectTrigger>
                <SelectContent>
                  {parties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.partyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedPartyId && (
                <div className="pt-4 border-t border-border/50 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Trips Selected</span>
                    <span className="font-bold">{selectedTripIds.length}</span>
                  </div>
                  <div className="flex justify-between text-lg font-headline font-bold">
                    <span>Total Amount</span>
                    <span className="text-primary">₹{invoiceTotal.toLocaleString()}</span>
                  </div>
                  <Button 
                    onClick={handleGenerateInvoice}
                    disabled={selectedTripIds.length === 0 || generating}
                    className="w-full bg-gradient-primary h-12 shadow-indigo-500/20 shadow-lg font-bold"
                  >
                    {generating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <FileCheck className="w-5 h-5 mr-2" />}
                    Generate Invoice
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Available Unbilled Trips</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedPartyId ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                  <CreditCard className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-bold">Select a party to view trips</p>
                </div>
              ) : trips.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                  <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-bold">No unbilled trips found for this party.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead className="font-bold">LR No</TableHead>
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold">Vehicle</TableHead>
                      <TableHead className="font-bold text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trips.map((trip) => (
                      <TableRow key={trip.id}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedTripIds.includes(trip.id)} 
                            onCheckedChange={() => toggleTripSelection(trip.id)} 
                          />
                        </TableCell>
                        <TableCell className="font-bold text-primary">{trip.lrNo}</TableCell>
                        <TableCell className="text-sm">{trip.date}</TableCell>
                        <TableCell className="text-xs font-mono">{trip.vehicleNo}</TableCell>
                        <TableCell className="text-right font-bold">₹{trip.totalAmount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
