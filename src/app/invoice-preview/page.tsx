"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Truck, Loader2 } from "lucide-react";

function InvoiceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const billNo = searchParams.get("billNo");
  const partyId = searchParams.get("partyId");
  const tripIds = searchParams.get("tripIds")?.split(',') || [];
  
  const [party, setParty] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!partyId) return;
      
      const partyDoc = await getDoc(doc(db, "parties", partyId));
      if (partyDoc.exists()) {
        const pData = partyDoc.data();
        setParty(pData);
        
        // Use party's owner ID to fetch transporter profile
        const userDoc = await getDoc(doc(db, "users", pData.userId));
        if (userDoc.exists()) setProfile(userDoc.data());
      }

      const tripPromises = tripIds.map(id => getDoc(doc(db, "trips", id)));
      const tripDocs = await Promise.all(tripPromises);
      setTrips(tripDocs.filter(d => d.exists()).map(d => d.data()));
      
      setLoading(false);
    };
    fetchData();
  }, [partyId, tripIds]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!party || !profile) return <div>Data not found.</div>;

  const totalAmount = trips.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0);

  return (
    <div className="min-h-screen bg-white text-black p-4 md:p-8 font-body">
      <div className="max-w-5xl mx-auto border-2 border-black p-8">
        {/* Header */}
        <div className="flex justify-between mb-8 border-b-4 border-black pb-6">
           <div>
              <h1 className="text-4xl font-bold uppercase mb-2">{profile.companyName}</h1>
              <p className="text-sm italic">{profile.address}</p>
              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                 <p><span className="font-bold">Email:</span> {profile.email}</p>
                 <p><span className="font-bold">Phone:</span> {profile.mobile}</p>
                 <p><span className="font-bold">GSTIN:</span> {profile.gstNo}</p>
                 <p><span className="font-bold">Office:</span> {profile.officePhone || 'N/A'}</p>
              </div>
           </div>
           <div className="text-right flex flex-col justify-center">
              <h2 className="text-3xl font-bold border-b-2 border-black inline-block ml-auto mb-4">TAX INVOICE</h2>
              <p className="text-lg font-bold">Bill No: {billNo}</p>
              <p className="text-md">Date: {new Date().toLocaleDateString()}</p>
           </div>
        </div>

        {/* Party Details */}
        <div className="mb-8 p-4 bg-gray-50 border-2 border-black">
           <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Billing To:</h3>
           <div className="grid grid-cols-2">
              <div>
                 <p className="text-xl font-bold uppercase">{party.partyName}</p>
                 <p className="text-sm max-w-md">{party.address}</p>
              </div>
              <div className="text-right">
                 <p><span className="font-bold">GST No:</span> {party.gstNo || 'UNREGISTERED'}</p>
                 <p><span className="font-bold">Mobile:</span> {party.mobile || 'N/A'}</p>
              </div>
           </div>
        </div>

        {/* Items Table */}
        <table className="w-full border-2 border-black mb-8">
           <thead>
              <tr className="bg-black text-white border-b-2 border-black">
                 <th className="p-2 border-r border-white/20 text-xs">DATE</th>
                 <th className="p-2 border-r border-white/20 text-xs">LR NO</th>
                 <th className="p-2 border-r border-white/20 text-xs">VEHICLE NO</th>
                 <th className="p-2 border-r border-white/20 text-xs">ROUTE</th>
                 <th className="p-2 border-r border-white/20 text-xs">WT(QTL)</th>
                 <th className="p-2 border-r border-white/20 text-xs">RATE</th>
                 <th className="p-2 border-r border-white/20 text-xs">FREIGHT</th>
                 <th className="p-2 border-r border-white/20 text-xs">UNL.</th>
                 <th className="p-2 text-xs">AMOUNT</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-black/10">
              {trips.map((trip, idx) => (
                 <tr key={idx} className="text-sm">
                    <td className="p-2 border-r border-black/10 text-center">{trip.date}</td>
                    <td className="p-2 border-r border-black/10 font-bold">{trip.lrNo}</td>
                    <td className="p-2 border-r border-black/10 font-mono text-xs">{trip.vehicleNo}</td>
                    <td className="p-2 border-r border-black/10">{trip.source}-{trip.destination}</td>
                    <td className="p-2 border-r border-black/10 text-center">{trip.weight}</td>
                    <td className="p-2 border-r border-black/10 text-center">{trip.rateQtl}</td>
                    <td className="p-2 border-r border-black/10 text-right">₹{Number(trip.totalFreight || 0).toFixed(2)}</td>
                    <td className="p-2 border-r border-black/10 text-right">₹{Number(trip.unloadingCharges || 0).toFixed(2)}</td>
                    <td className="p-2 text-right font-bold">₹{Number(trip.totalAmount || 0).toFixed(2)}</td>
                 </tr>
              ))}
              {/* Fill remaining space if needed */}
              <tr className="h-40 align-top">
                 <td colSpan={9} className="p-2"></td>
              </tr>
           </tbody>
           <tfoot>
              <tr className="bg-gray-100 border-t-2 border-black">
                 <td colSpan={8} className="p-3 text-right font-bold text-lg">GRAND TOTAL</td>
                 <td className="p-3 text-right font-bold text-xl">₹{totalAmount.toLocaleString()}</td>
              </tr>
           </tfoot>
        </table>

        {/* Footer */}
        <div className="grid grid-cols-2 gap-8">
           <div className="border-2 border-black p-4">
              <h4 className="font-bold text-sm border-b border-black mb-2 pb-1">BANK SETTLEMENT DETAILS</h4>
              <p className="text-sm"><span className="font-bold">Bank Name:</span> {profile.bankName}</p>
              <p className="text-sm"><span className="font-bold">A/C No:</span> {profile.accountNo}</p>
              <p className="text-sm"><span className="font-bold">IFSC Code:</span> {profile.ifscCode}</p>
              <div className="mt-4 pt-4 border-t border-black">
                 <p className="text-xs font-bold uppercase italic">Amount in words: Rupees {totalAmount.toLocaleString()} Only</p>
              </div>
           </div>
           <div className="text-right flex flex-col justify-end items-end p-4">
              <p className="font-bold uppercase text-xs mb-16">For {profile.companyName}</p>
              <p className="font-bold uppercase text-sm border-t-2 border-black pt-2">Authorized Signatory</p>
           </div>
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 no-print">
         <Button variant="outline" onClick={() => router.back()} className="bg-white border-black text-black hover:bg-gray-100 font-bold h-12 shadow-xl">
            <ArrowLeft className="w-5 h-5 mr-2" /> Back
         </Button>
         <Button onClick={() => window.print()} className="bg-black text-white hover:bg-gray-800 font-bold h-12 shadow-xl">
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