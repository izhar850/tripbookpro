"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Truck, Loader2 } from "lucide-react";

function LRReceiptContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useFirestore();
  const id = searchParams.get("id");
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !db) return;
    const fetchTrip = async () => {
      const tripDoc = await getDoc(doc(db, "trips", id));
      if (tripDoc.exists()) setTrip(tripDoc.data());
      setLoading(false);
    };
    fetchTrip();
  }, [id, db]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!trip) return <div>Trip not found.</div>;

  return (
    <div className="min-h-screen bg-white text-black p-4 md:p-8 font-body">
      <div className="max-w-4xl mx-auto border-2 border-black p-6">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
          <div className="flex gap-4">
             <Truck className="w-12 h-12" />
             <div>
                <h1 className="text-3xl font-bold uppercase">{trip.companyName}</h1>
                <p className="text-sm font-bold">Logistics & Transportation Services</p>
                <p className="text-xs">{trip.companyAddress || trip.source}</p>
                <p className="text-xs font-bold mt-1">GSTIN: {trip.partyGst || 'N/A'}</p>
             </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold border-2 border-black px-4 py-1 mb-2">LORRY RECEIPT</div>
            <p className="text-sm font-bold">LR NO: <span className="text-lg">{trip.lrNo}</span></p>
            <p className="text-sm">DATE: {trip.date}</p>
          </div>
        </div>

        {/* Consignor/Consignee Section */}
        <div className="grid grid-cols-2 border-b-2 border-black mb-4">
          <div className="border-r-2 border-black p-4">
            <h3 className="text-xs font-bold uppercase mb-2">Consignor:</h3>
            <p className="font-bold">{trip.companyName}</p>
            <p className="text-sm">Address: {trip.companyAddress || trip.source}</p>
          </div>
          <div className="p-4">
            <h3 className="text-xs font-bold uppercase mb-2">Consignee:</h3>
            <p className="font-bold">{trip.partyName}</p>
            <p className="text-sm">{trip.partyAddress}</p>
            <p className="text-sm font-bold mt-2">GST: {trip.partyGst}</p>
          </div>
        </div>

        {/* Cargo Details */}
        <div className="mb-4">
          <table className="w-full border-2 border-black">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-black">
                <th className="border-r-2 border-black p-2 text-xs">PKGS</th>
                <th className="border-r-2 border-black p-2 text-xs">DESCRIPTION OF GOODS</th>
                <th className="border-r-2 border-black p-2 text-xs">WEIGHT (QTL)</th>
                <th className="border-r-2 border-black p-2 text-xs">VEHICLE NO</th>
                <th className="p-2 text-xs">RATE/QTL</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b-2 border-black h-40 align-top">
                <td className="border-r-2 border-black p-4 text-center font-bold">{trip.packages}</td>
                <td className="border-r-2 border-black p-4 font-medium uppercase">{trip.goodsDescription}</td>
                <td className="border-r-2 border-black p-4 text-center font-bold">{trip.weight}</td>
                <td className="border-r-2 border-black p-4 text-center font-bold font-mono">{trip.vehicleNo}</td>
                <td className="p-4 text-right font-bold">₹{Number(trip.rateQtl || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary and Terms */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 border-2 border-black p-4 h-full">
            <h4 className="text-xs font-bold underline mb-2">TERMS & CONDITIONS</h4>
            <ul className="text-[10px] space-y-1 list-disc pl-3">
              <li>Goods are carried at Owner's Risk.</li>
              <li>Consignee should check the goods at the time of delivery.</li>
              <li>Not responsible for any leakage or damage during transit.</li>
              <li>Subject to local jurisdiction.</li>
            </ul>
            <div className="mt-6 flex gap-4">
              <span className="text-xs font-bold">GST PAYABLE BY:</span>
              <div className="flex gap-2 text-xs uppercase font-bold">
                 <span>[{trip.gstPayBy === 'consigner' ? 'X' : ' '}] Consignor</span>
                 <span>[{trip.gstPayBy === 'consignee' ? 'X' : ' '}] Consignee</span>
                 <span>[{trip.gstPayBy === 'transporter' ? 'X' : ' '}] Transporter</span>
              </div>
            </div>
          </div>
          <div className="border-2 border-black p-0 divide-y-2 divide-black">
             <div className="p-2 flex justify-between">
                <span className="text-xs font-bold">TOTAL FREIGHT:</span>
                <span className="font-bold">₹{Number(trip.totalFreight || 0).toFixed(2)}</span>
             </div>
             <div className="p-2 flex justify-between">
                <span className="text-xs font-bold">ADVANCE PAID:</span>
                <span className="font-bold">₹{Number(trip.advance || 0).toFixed(2)}</span>
             </div>
             <div className="p-2 flex justify-between bg-gray-100">
                <span className="text-xs font-bold">BALANCE DUE:</span>
                <span className="font-bold text-lg">₹{Number(trip.balance || 0).toFixed(2)}</span>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex justify-between items-end">
          <div className="text-center">
             <div className="w-40 h-1 border-b-2 border-dotted border-black mb-1" />
             <p className="text-[10px] font-bold">CONSIGNEE SIGNATURE</p>
          </div>
          <div className="text-right text-xs">
             <p className="font-bold">For {trip.companyName}</p>
             <div className="h-16" />
             <p className="font-bold uppercase">Authorized Signatory</p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 no-print">
         <Button variant="outline" onClick={() => router.back()} className="bg-white border-black text-black hover:bg-gray-100 font-bold h-12 shadow-xl">
            <ArrowLeft className="w-5 h-5 mr-2" /> Back
         </Button>
         <Button onClick={() => window.print()} className="bg-black text-white hover:bg-gray-800 font-bold h-12 shadow-xl">
            <Printer className="w-5 h-5 mr-2" /> Print LR Receipt
         </Button>
      </div>
    </div>
  );
}

export default function LRReceiptPreviewPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <LRReceiptContent />
    </Suspense>
  );
}
