
"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Printer, ArrowLeft, Loader2, Edit, Save, Plus, Trash2, X } from "lucide-react";
import { numberToWords } from "@/lib/format-utils";
import { normalizeMultiline, normalizeText, normalizeVehicleNo } from "@/lib/transport-utils";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getDateFromFirestoreValue, getSubscriptionBlockMessage, isSubscriptionActive } from "@/lib/account-utils";

type EditableInvoiceTrip = {
  date: string;
  lrNo: string;
  packages: string;
  vehicleNo: string;
  source: string;
  destination: string;
  weight: string;
  rateQtl: string;
  totalFreight: string;
  unloadingCharges: string;
  totalAmount: string;
};

type EditableInvoice = {
  billNo: string;
  billDate: string;
  partyName: string;
  partyAddress: string;
  partyGst: string;
  partyMobile: string;
  notes: string;
  trips: EditableInvoiceTrip[];
};

const emptyInvoiceTrip = (): EditableInvoiceTrip => ({
  date: "",
  lrNo: "",
  packages: "",
  vehicleNo: "",
  source: "",
  destination: "",
  weight: "",
  rateQtl: "",
  totalFreight: "",
  unloadingCharges: "",
  totalAmount: "",
});

function formatInvoiceDate(invoice: any) {
  const date = getDateFromFirestoreValue(invoice?.billDate) || getDateFromFirestoreValue(invoice?.createdAt);
  return date ? date.toLocaleDateString() : "N/A";
}

function displayInvoiceValue(value: unknown) {
  const text = String(value ?? "").trim();
  return text === "0" ? "" : text;
}

function displayInvoiceMoney(value: unknown) {
  const text = String(value ?? "").trim();
  const amount = Number(value || 0);
  if (!text || amount === 0) return "";
  return `Rs. ${amount.toFixed(2)}`;
}

function displayRoute(source: unknown, destination: unknown) {
  const from = displayInvoiceValue(source);
  const to = displayInvoiceValue(destination);
  if (!from && !to) return "";
  return `${from}-${to}`;
}

function getEditableInvoice(invoice: any): EditableInvoice {
  return {
    billNo: normalizeText(invoice?.billNo),
    billDate: invoice?.billDate || (getDateFromFirestoreValue(invoice?.createdAt)?.toISOString().split("T")[0] ?? ""),
    partyName: normalizeText(invoice?.partyName),
    partyAddress: normalizeMultiline(invoice?.partyAddress),
    partyGst: normalizeText(invoice?.partyGst),
    partyMobile: normalizeText(invoice?.partyMobile),
    notes: normalizeMultiline(invoice?.notes),
    trips: (invoice?.trips || []).map((trip: any) => ({
      date: normalizeText(trip.date),
      lrNo: normalizeText(trip.lrNo),
      packages: String(trip.packages ?? ""),
      vehicleNo: normalizeVehicleNo(trip.vehicleNo),
      source: normalizeText(trip.source),
      destination: normalizeText(trip.destination),
      weight: String(trip.weight ?? ""),
      rateQtl: String(trip.rateQtl ?? ""),
      totalFreight: String(trip.totalFreight ?? ""),
      unloadingCharges: String(trip.unloadingCharges ?? ""),
      totalAmount: String(trip.totalAmount ?? ""),
    })),
  };
}

function InvoiceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const invoiceId = searchParams.get("id");
  const invoiceRef = useRef<HTMLDivElement>(null);
  const { profile: authProfile } = useAuth();
  const { toast } = useToast();
  const subscriptionActive = isSubscriptionActive(authProfile);
  const subscriptionBlockMessage = getSubscriptionBlockMessage(authProfile) || "Subscription expired. Please renew to continue.";
  
  const [invoice, setInvoice] = useState<any>(null);
  const [editData, setEditData] = useState<EditableInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!invoiceId) {
        setLoading(false);
        return;
      }
      
      try {
        const invoiceDoc = await getDoc(doc(db, "invoices", invoiceId));
        if (invoiceDoc.exists()) {
          const invoiceData = { id: invoiceDoc.id, ...invoiceDoc.data() };
          setInvoice(invoiceData);
          setEditData(getEditableInvoice(invoiceData));
        }
      } catch (error) {
        console.error("Error fetching invoice:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [invoiceId]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!invoice) return <div className="p-8 text-center text-foreground">Invoice data not found. <Button variant="link" onClick={() => router.back()}>Go Back</Button></div>;

  const { transporterProfile, trips, billNo, partyName, partyAddress, partyGst, partyMobile, invoiceTotal } = invoice;
  const getTripFinalAmount = (trip: any) => Number(trip.totalFreight || 0) + Number(trip.unloadingCharges || 0);
  const firstTrip = trips?.[0] || {};
  const billToName = partyName || firstTrip.consigneeName || firstTrip.partyName || "";
  const billToAddress = partyAddress || firstTrip.consigneeAddress || firstTrip.partyAddress || "";
  const billToGst = partyGst || firstTrip.consigneeGst || firstTrip.partyGst || "";
  const billToMobile = partyMobile || firstTrip.consigneeMobile || firstTrip.partyMobile || "";
  const printableTotal = trips.length > 0
    ? trips.reduce((sum: number, trip: any) => sum + getTripFinalAmount(trip), 0)
    : Number(invoiceTotal || 0);
  const editedInvoiceTotal = editData?.trips.reduce((sum, trip) => sum + Number(trip.totalFreight || 0) + Number(trip.unloadingCharges || 0), 0) || 0;

  const updateEditField = (field: keyof EditableInvoice, value: string) => {
    if (!editData) return;
    setEditData({ ...editData, [field]: value });
  };

  const updateTripField = (index: number, field: keyof EditableInvoiceTrip, value: string) => {
    if (!editData) return;
    setEditData({
      ...editData,
      trips: editData.trips.map((trip, currentIndex) => (
        currentIndex === index ? { ...trip, [field]: value } : trip
      )),
    });
  };

  const handleAddTripRow = () => {
    if (!editData) return;
    setEditData({ ...editData, trips: [...editData.trips, emptyInvoiceTrip()] });
  };

  const handleRemoveTripRow = (index: number) => {
    if (!editData) return;
    setEditData({
      ...editData,
      trips: editData.trips.filter((_, currentIndex) => currentIndex !== index),
    });
  };

  const handleCancelEdit = () => {
    setEditData(getEditableInvoice(invoice));
    setIsEditing(false);
  };

  const handleSaveInvoice = async () => {
    if (!invoiceId || !editData) return;
    if (!subscriptionActive) {
      toast({
        title: "Subscription Required",
        description: subscriptionBlockMessage,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const cleanedTrips = editData.trips.map((trip) => ({
        ...trip,
        date: normalizeText(trip.date),
        lrNo: normalizeText(trip.lrNo),
        packages: Number(trip.packages) || 0,
        vehicleNo: normalizeVehicleNo(trip.vehicleNo),
        source: normalizeText(trip.source),
        destination: normalizeText(trip.destination),
        weight: Number(trip.weight) || 0,
        rateQtl: Number(trip.rateQtl) || 0,
        totalFreight: Number(trip.totalFreight) || 0,
        unloadingCharges: Number(trip.unloadingCharges) || 0,
        totalAmount: (Number(trip.totalFreight) || 0) + (Number(trip.unloadingCharges) || 0),
      }));
      const updatedInvoiceTotal = cleanedTrips.reduce((sum, trip) => sum + Number(trip.totalAmount || 0), 0);
      const updatePayload = {
        billNo: normalizeText(editData.billNo),
        billDate: editData.billDate,
        partyName: normalizeText(editData.partyName),
        partyAddress: normalizeMultiline(editData.partyAddress),
        partyGst: normalizeText(editData.partyGst).toUpperCase(),
        partyMobile: normalizeText(editData.partyMobile),
        notes: normalizeMultiline(editData.notes),
        trips: cleanedTrips,
        invoiceTotal: updatedInvoiceTotal,
        updatedAt: serverTimestamp(),
        updatedBy: authProfile?.uid || "",
        updatedByEmail: authProfile?.email || "",
      };

      await updateDoc(doc(db, "invoices", invoiceId), updatePayload);
      const updatedInvoice = { ...invoice, ...updatePayload, updatedAt: new Date() };
      setInvoice(updatedInvoice);
      setEditData(getEditableInvoice(updatedInvoice));
      setIsEditing(false);
      toast({ title: "Bill Updated", description: "Generated bill details have been saved." });
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 font-body">
      {isEditing && editData && (
        <div className="no-print max-w-5xl mx-auto mb-6 bg-card border border-border/50 rounded-lg p-4 md:p-6 space-y-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-headline font-bold">Edit Bill</h2>
              <p className="text-sm text-muted-foreground">Changes are saved to the generated invoice record only.</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Edited Total</p>
              <p className="text-2xl font-bold text-primary">Rs. {editedInvoiceTotal.toLocaleString("en-IN")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bill No</Label>
              <Input value={editData.billNo} onChange={(event) => updateEditField("billNo", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bill Date</Label>
              <Input type="date" value={editData.billDate} onChange={(event) => updateEditField("billDate", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Party Name</Label>
              <Input value={editData.partyName} onChange={(event) => updateEditField("partyName", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Party GST</Label>
              <Input value={editData.partyGst} onChange={(event) => updateEditField("partyGst", event.target.value.toUpperCase())} />
            </div>
            <div className="space-y-2">
              <Label>Party Mobile</Label>
              <Input value={editData.partyMobile} onChange={(event) => updateEditField("partyMobile", event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Party Address</Label>
              <Textarea value={editData.partyAddress} onChange={(event) => updateEditField("partyAddress", event.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">LR Rows</h3>
              <Button type="button" size="sm" variant="outline" onClick={handleAddTripRow} disabled={!subscriptionActive} title={!subscriptionActive ? subscriptionBlockMessage : "Add Row"}>
                <Plus className="w-4 h-4 mr-2" /> Add Row
              </Button>
            </div>
            <div className="space-y-3">
              {editData.trips.map((trip, index) => (
                <div key={index} className="grid grid-cols-2 md:grid-cols-6 gap-3 rounded-lg border border-border/50 bg-secondary/20 p-3">
                  <Input type="date" value={trip.date} onChange={(event) => updateTripField(index, "date", event.target.value)} />
                  <Input placeholder="LR No" value={trip.lrNo} onChange={(event) => updateTripField(index, "lrNo", event.target.value)} />
                  <Input type="number" placeholder="Packages" value={trip.packages} onChange={(event) => updateTripField(index, "packages", event.target.value)} />
                  <Input placeholder="Vehicle" value={trip.vehicleNo} onChange={(event) => updateTripField(index, "vehicleNo", event.target.value)} />
                  <Input placeholder="Source" value={trip.source} onChange={(event) => updateTripField(index, "source", event.target.value)} />
                  <Input placeholder="Destination" value={trip.destination} onChange={(event) => updateTripField(index, "destination", event.target.value)} />
                  <Input type="number" step="0.01" placeholder="Weight" value={trip.weight} onChange={(event) => updateTripField(index, "weight", event.target.value)} />
                  <Input type="number" step="0.01" placeholder="Rate" value={trip.rateQtl} onChange={(event) => updateTripField(index, "rateQtl", event.target.value)} />
                  <Input type="number" step="0.01" placeholder="Freight" value={trip.totalFreight} onChange={(event) => updateTripField(index, "totalFreight", event.target.value)} />
                  <Input type="number" step="0.01" placeholder="Unloading" value={trip.unloadingCharges} onChange={(event) => updateTripField(index, "unloadingCharges", event.target.value)} />
                  <Input type="number" step="0.01" placeholder="Amount" value={trip.totalAmount} onChange={(event) => updateTripField(index, "totalAmount", event.target.value)} />
                  <Button type="button" variant="ghost" className="text-destructive" onClick={() => handleRemoveTripRow(index)} disabled={!subscriptionActive} title={!subscriptionActive ? subscriptionBlockMessage : "Remove"}>
                    <Trash2 className="w-4 h-4 mr-2" /> Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={editData.notes} onChange={(event) => updateEditField("notes", event.target.value)} />
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleCancelEdit}>
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>
            <Button type="button" onClick={handleSaveInvoice} disabled={saving || !subscriptionActive} title={!subscriptionActive ? subscriptionBlockMessage : "Save Bill"} className="bg-gradient-primary font-bold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Bill
            </Button>
          </div>
        </div>
      )}

      <div ref={invoiceRef} className="max-w-5xl mx-auto !bg-white !text-black border-2 border-black p-8 shadow-2xl printable-area">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { size: A4; margin: 10mm; }
            html, body { background: white !important; }
            .printable-area { background-color: white !important; color: black !important; }
            .printable-area * { color: black !important; border-color: black !important; }
            .printable-area .bg-black { background-color: black !important; color: white !important; }
            .printable-area .bg-black * { color: white !important; }
            .no-print { display: none !important; }
          }
          .printable-area, .printable-area * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .printable-area { background-color: white !important; color: black !important; }
          .printable-area * { color: black !important; border-color: black !important; }
          .printable-area .bg-black { background-color: black !important; color: white !important; }
          .printable-area .bg-black * { color: white !important; }
        `}} />

        {/* Header */}
        <div className="flex justify-between mb-8 border-b-4 border-black pb-6">
           <div>
              <h1 className="text-4xl font-bold uppercase mb-2">{transporterProfile.companyName}</h1>
              <p className="text-sm italic">{transporterProfile.address}</p>
              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                 <p><span className="font-bold">Email:</span> {transporterProfile.email}</p>
                 <p><span className="font-bold">Phone:</span> {transporterProfile.mobile}</p>
                 <p><span className="font-bold">GSTIN:</span> {transporterProfile.gstNo}</p>
                 <p><span className="font-bold">Office:</span> {transporterProfile.officePhone || 'N/A'}</p>
              </div>
           </div>
           <div className="text-right flex flex-col justify-center">
              <h2 className="text-3xl font-bold border-b-2 border-black inline-block ml-auto mb-4">TAX INVOICE</h2>
              <p className="text-lg font-bold">Bill No: {billNo}</p>
              <p className="text-md">Date: {formatInvoiceDate(invoice)}</p>
           </div>
        </div>

        {/* Party Details */}
        <div className="mb-8 p-4 bg-gray-50 border-2 border-black">
           <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Billing To:</h3>
           <div className="grid grid-cols-2">
              <div>
                 <p className="text-xl font-bold uppercase">{billToName}</p>
                 <p className="text-sm max-w-md whitespace-pre-wrap">{billToAddress}</p>
              </div>
              <div className="text-right">
                 <p><span className="font-bold">GST No:</span> {billToGst}</p>
                 <p><span className="font-bold">Mobile:</span> {billToMobile}</p>
              </div>
           </div>
        </div>

        {/* Items Table */}
        <table className="w-full border-2 border-black mb-8">
           <thead>
              <tr className="bg-black text-white border-b-2 border-black">
                 <th className="p-2 border-r border-white/20 text-xs">DATE</th>
                 <th className="p-2 border-r border-white/20 text-xs">LR NO</th>
                 <th className="p-2 border-r border-white/20 text-xs">PACKAGES</th>
                 <th className="p-2 border-r border-white/20 text-xs">VEHICLE NO</th>
                 <th className="p-2 border-r border-white/20 text-xs">ROUTE</th>
                 <th className="p-2 border-r border-white/20 text-xs">WT(QTL)</th>
                 <th className="p-2 border-r border-white/20 text-xs">RATE/QTL</th>
                 <th className="p-2 border-r border-white/20 text-xs">TOTAL FREIGHT</th>
                 <th className="p-2 border-r border-white/20 text-xs">UNLOADING</th>
                 <th className="p-2 text-xs">FINAL AMOUNT</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-black/10">
              {trips.map((trip: any, idx: number) => (
                 <tr key={idx} className="text-sm">
                    <td className="p-2 border-r border-black/10 text-center">{displayInvoiceValue(trip.date)}</td>
                    <td className="p-2 border-r border-black/10 font-bold">{displayInvoiceValue(trip.lrNo)}</td>
                    <td className="p-2 border-r border-black/10 text-center">{displayInvoiceValue(trip.packages)}</td>
                    <td className="p-2 border-r border-black/10 font-mono text-xs">{displayInvoiceValue(normalizeVehicleNo(trip.vehicleNo))}</td>
                    <td className="p-2 border-r border-black/10">{displayRoute(trip.source, trip.destination)}</td>
                    <td className="p-2 border-r border-black/10 text-center">{displayInvoiceValue(trip.weight)}</td>
                    <td className="p-2 border-r border-black/10 text-center">{displayInvoiceValue(trip.rateQtl)}</td>
                    <td className="p-2 border-r border-black/10 text-right">{displayInvoiceMoney(trip.totalFreight)}</td>
                    <td className="p-2 border-r border-black/10 text-right">{displayInvoiceMoney(trip.unloadingCharges)}</td>
                    <td className="p-2 text-right font-bold">{displayInvoiceMoney(getTripFinalAmount(trip))}</td>
                 </tr>
              ))}
              <tr className="h-40 align-top">
                 <td colSpan={10} className="p-2"></td>
              </tr>
           </tbody>
           <tfoot>
              <tr className="bg-gray-100 border-t-2 border-black">
                 <td colSpan={9} className="p-3 text-right font-bold text-lg">GRAND TOTAL</td>
                 <td className="p-3 text-right font-bold text-xl">{printableTotal > 0 ? `Rs. ${printableTotal.toLocaleString("en-IN")}` : ""}</td>
              </tr>
           </tfoot>
        </table>

        {/* Footer */}
        <div className="grid grid-cols-2 gap-8">
           <div className="border-2 border-black p-4">
              <h4 className="font-bold text-sm border-b border-black mb-2 pb-1">TOTAL AMOUNT IN WORDS</h4>
              <p className="text-xs font-bold uppercase italic mb-4">
                {printableTotal > 0 ? `Rupees ${numberToWords(printableTotal)} Only` : ""}
              </p>
              <h4 className="font-bold text-sm border-b border-black mb-2 pb-1">BANK SETTLEMENT DETAILS</h4>
              <p className="text-sm"><span className="font-bold">Bank Name:</span> {transporterProfile.bankName}</p>
              <p className="text-sm"><span className="font-bold">A/C No:</span> {transporterProfile.accountNo}</p>
              <p className="text-sm"><span className="font-bold">IFSC Code:</span> {transporterProfile.ifscCode}</p>
              <div className="mt-4 pt-4 border-t border-black">
                 <h4 className="font-bold text-xs uppercase mb-1">Notes / Terms</h4>
                 <p className="text-xs whitespace-pre-wrap">{invoice.notes || "Please verify all LR details before payment. Subject to local jurisdiction."}</p>
              </div>
           </div>
           <div className="text-right flex flex-col justify-end items-end p-4">
              <div className="border-2 border-black p-3 mb-8 w-full">
                <p className="text-xs font-bold uppercase">Total Amount</p>
                <p className="text-2xl font-bold">{printableTotal > 0 ? `Rs. ${printableTotal.toLocaleString("en-IN")}` : ""}</p>
              </div>
              <p className="font-bold uppercase text-xs mb-16">For {transporterProfile.companyName}</p>
              <p className="font-bold uppercase text-sm border-t-2 border-black pt-2">Authorized Signatory</p>
           </div>
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 no-print">
         <Button variant="outline" onClick={() => router.back()} className="bg-white border-black text-black hover:bg-gray-100 font-bold h-12 shadow-xl">
            <ArrowLeft className="w-5 h-5 mr-2" /> Back
         </Button>
         <Button onClick={() => setIsEditing(true)} disabled={!subscriptionActive} title={!subscriptionActive ? subscriptionBlockMessage : "Edit Bill"} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-12 shadow-xl">
            <Edit className="w-5 h-5 mr-2" /> Edit Bill
         </Button>
         <Button onClick={() => window.print()} disabled={isEditing} className="bg-black text-white hover:bg-gray-800 font-bold h-12 shadow-xl">
            <Printer className="w-5 h-5 mr-2" /> Print Invoice
         </Button>
      </div>
    </div>
  );
}

export default function InvoicePreviewPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <InvoiceContent />
    </Suspense>
  );
}
