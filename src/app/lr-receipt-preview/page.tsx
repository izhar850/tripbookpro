
"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Truck, Loader2 } from "lucide-react";
import { numberToWords } from "@/lib/format-utils";

function LRReceiptContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useFirestore();
  const id = searchParams.get("id");
  const receiptRef = useRef<HTMLDivElement>(null);

  const [trip, setTrip] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !db) return;
    const fetchData = async () => {
      const tripDoc = await getDoc(doc(db, "trips", id));
      if (tripDoc.exists()) {
        const tData = tripDoc.data();
        setTrip({ id: tripDoc.id, ...tData });
        
        const userDoc = await getDoc(doc(db, "users", tData.userId));
        if (userDoc.exists()) {
          setProfile(userDoc.data());
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [id, db]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!trip) return <div className="p-8 text-center text-foreground">Trip data not found. <Button variant="link" onClick={() => router.back()}>Go Back</Button></div>;

  const companyName = profile?.companyName || trip.companyName;
  const companyAddress = profile?.address || trip.companyAddress;
  const companyGst = profile?.gstNo || trip.companyGst || "N/A";
  const companyMobile = profile?.mobile || trip.companyMobile || "N/A";

  const totalAmount = Number(trip.totalAmount || 0);

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 font-body">
      <div ref={receiptRef} className="max-w-4xl mx-auto !bg-white !text-black border-2 border-black p-6 shadow-2xl printable-area">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            .printable-area { background-color: white !important; color: black !important; }
            .printable-area * { color: black !important; border-color: black !important; }
            .printable-area .bg-gray-100 { background-color: #f3f4f6 !important; }
            .printable-area .bg-gray-50 { background-color: #f9fafb !important; }
            .no-print { display: none !important; }
          }
          .printable-area { background-color: white !important; color: black !important; }
          .printable-area * { color: black !important; border-color: black !important; }
          .printable-area .bg-gray-100 { background-color: #f3f4f6 !important; }
          .printable-area .bg-gray-50 { background-color: #f9fafb !important; }
        `}} />

        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
          <div className="flex gap-4">
             <Truck className="w-12 h-12" />
             <div>
                <h1 className="text-3xl font-bold uppercase leading-tight">{companyName}</h1>
                <p className="text-sm font-bold">Logistics & Transportation Services</p>
                <p className="text-xs whitespace-pre-wrap max-w-sm mt-1">{companyAddress}</p>
                <div className="mt-2 text-[10px] font-bold space-y-0.5">
                   <p>GSTIN: {companyGst}</p>
                   <p>MOB: {companyMobile}</p>
                </div>
             </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold border-2 border-black px-4 py-1 mb-2">LORRY RECEIPT</div>
            <p className="text-sm font-bold">LR NO: <span className="text-lg">{trip.lrNo}</span></p>
            <p className="text-sm">DATE: {trip.date}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b-2 border-black mb-4 py-2 px-4 bg-gray-50 font-bold">
           <div className="flex items-center gap-2">
              <span className="text-xs uppercase">FROM:</span>
              <span>{trip.source}</span>
           </div>
           <div className="flex items-center gap-2 justify-end">
              <span className="text-xs uppercase">TO:</span>
              <span>{trip.destination}</span>
           </div>
        </div>

        <div className="grid grid-cols-2 border-b-2 border-black mb-4">
          <div className="border-r-2 border-black p-4">
            <h3 className="text-xs font-bold uppercase mb-2">Consignor:</h3>
            <p className="font-bold">{companyName}</p>
            <p className="text-sm">{companyAddress}</p>
            <p className="text-sm font-bold mt-2">GSTIN: {companyGst}</p>
          </div>
          <div className="p-4">
            <h3 className="text-xs font-bold uppercase mb-2">Consignee:</h3>
            <p className="font-bold">{trip.partyName}</p>
            <p className="text-sm">{trip.partyAddress}</p>
            <p className="text-sm font-bold mt-2">GSTIN: {trip.partyGst || 'UNREGISTERED'}</p>
          </div>
        </div>

        <div className="mb-4">
          <table className="w-full border-2 border-black">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-black text-[10px]">
                <th className="border-r-2 border-black p-2">PKGS</th>
                <th className="border-r-2 border-black p-2">DESCRIPTION OF GOODS</th>
                <th className="border-r-2 border-black p-2">VEHICLE SIZE</th>
                <th className="border-r-2 border-black p-2">WEIGHT (QTL)</th>
                <th className="border-r-2 border-black p-2">VEHICLE NO</th>
                <th className="p-2">RATE/QTL</th>
              </tr>
            </thead>
            <tbody className="h-32 align-top text-xs">
              <tr className="border-b-2 border-black">
                <td className="border-r-2 border-black p-4 text-center font-bold">{trip.packages}</td>
                <td className="border-r-2 border-black p-4 uppercase">{trip.goodsDescription}</td>
                <td className="border-r-2 border-black p-4 text-center">
                  {trip.sizeL || '-'}x{trip.sizeW || '-'}x{trip.sizeH || '-'} ft
                </td>
                <td className="border-r-2 border-black p-4 text-center font-bold">{Number(trip.weight || 0)}</td>
                <td className="border-r-2 border-black p-4 text-center font-bold">{trip.vehicleNo}</td>
                <td className="p-4 text-right font-bold">₹{Number(trip.rateQtl || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 border-2 border-black p-4">
            <div className="p-2 bg-gray-50 border border-black/10 rounded mb-4">
               <span className="text-[10px] font-bold block mb-1 underline">AMOUNT IN WORDS:</span>
               <p className="text-xs font-bold uppercase italic">Rupees {numberToWords(totalAmount)} Only</p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold underline">GST PAYABLE BY:</span>
              <div className="flex gap-4 text-[10px] uppercase font-bold">
                 <div className="flex items-center gap-1">
                    <div className="w-4 h-4 border border-black flex items-center justify-center">
                       {trip.gstPayBy === 'consigner' && <span>✓</span>}
                    </div>
                    <span>Consignor</span>
                 </div>
                 <div className="flex items-center gap-1">
                    <div className="w-4 h-4 border border-black flex items-center justify-center">
                       {trip.gstPayBy === 'consignee' && <span>✓</span>}
                    </div>
                    <span>Consignee</span>
                 </div>
                 <div className="flex items-center gap-1">
                    <div className="w-4 h-4 border border-black flex items-center justify-center">
                       {trip.gstPayBy === 'transporter' && <span>✓</span>}
                    </div>
                    <span>Transporter</span>
                 </div>
              </div>
            </div>
          </div>
          <div className="border-2 border-black divide-y-2 divide-black text-xs">
             <div className="p-2 flex justify-between">
                <span>TOTAL FREIGHT:</span>
                <span className="font-bold">₹{Number(trip.totalFreight || 0).toFixed(2)}</span>
             </div>
             <div className="p-2 flex justify-between">
                <span>UNLOADING:</span>
                <span className="font-bold">₹{Number(trip.unloadingCharges || 0).toFixed(2)}</span>
             </div>
             <div className="p-2 flex justify-between bg-gray-100 font-bold">
                <span>BALANCE DUE:</span>
                <span className="text-sm">₹{Number(trip.balance || 0).toFixed(2)}</span>
             </div>
          </div>
        </div>

        <div className="mt-8 flex justify-between items-end text-[10px] font-bold uppercase">
          <div className="text-center">
             <div className="w-40 border-b border-black mb-1" />
             <p>Consignee Signature</p>
          </div>
          <div className="text-right">
             <p>For {companyName}</p>
             <div className="h-12" />
             <p className="border-t border-black pt-1">Authorized Signatory</p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 no-print">
         <Button variant="outline" onClick={() => router.back()} className="bg-white border-black text-black font-bold h-12 shadow-xl">
            <ArrowLeft className="w-5 h-5 mr-2" /> Back
         </Button>
         <Button onClick={() => window.print()} className="bg-black text-white font-bold h-12 shadow-xl">
            <Printer className="w-5 h-5 mr-2" /> Print LR
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
