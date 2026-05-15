"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Truck, Loader2 } from "lucide-react";

// Helper for number to words (Indian System)
function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  
  const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n < 10) return single[n];
    if (n < 20) return double[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + single[n % 10] : '');
    if (n < 1000) return single[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
    return '';
  }

  function handleLarge(n: number): string {
    let res = '';
    if (n >= 10000000) {
      res += handleLarge(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      res += convert(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      res += convert(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    if (n > 0) {
      res += convert(n);
    }
    return res.trim();
  }

  return handleLarge(Math.floor(num));
}

function LRReceiptContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useFirestore();
  const id = searchParams.get("id");
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
  if (!trip) return <div>Trip not found.</div>;

  const companyName = profile?.companyName || trip.companyName;
  const companyAddress = profile?.address || trip.companyAddress || trip.source;
  const companyGst = profile?.gstNo || trip.companyGst || "N/A";
  const companyMobile = profile?.mobile || trip.companyMobile || "N/A";

  const totalAmount = Number(trip.totalAmount || 0);

  return (
    <div className="min-h-screen bg-white text-black p-4 md:p-8 font-body">
      <div className="max-w-4xl mx-auto border-2 border-black p-6">
        {/* Header */}
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

        {/* Route Info */}
        <div className="grid grid-cols-2 border-b-2 border-black mb-4 py-2 px-4 bg-gray-50">
           <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase">FROM:</span>
              <span className="font-bold text-lg">{trip.source}</span>
           </div>
           <div className="flex items-center gap-2 justify-end">
              <span className="text-xs font-bold uppercase">TO:</span>
              <span className="font-bold text-lg">{trip.destination}</span>
           </div>
        </div>

        {/* Consignor/Consignee Section */}
        <div className="grid grid-cols-2 border-b-2 border-black mb-4">
          <div className="border-r-2 border-black p-4">
            <h3 className="text-xs font-bold uppercase mb-2">Consignor:</h3>
            <p className="font-bold">{companyName}</p>
            <p className="text-sm whitespace-pre-wrap">Address: {companyAddress}</p>
            <p className="text-sm font-bold mt-2">GSTIN: {companyGst}</p>
          </div>
          <div className="p-4">
            <h3 className="text-xs font-bold uppercase mb-2">Consignee:</h3>
            <p className="font-bold">{trip.partyName}</p>
            <p className="text-sm whitespace-pre-wrap">{trip.partyAddress}</p>
            <p className="text-sm font-bold mt-2">GSTIN: {trip.partyGst || 'UNREGISTERED'}</p>
          </div>
        </div>

        {/* Cargo Details */}
        <div className="mb-4">
          <table className="w-full border-2 border-black">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-black">
                <th className="border-r-2 border-black p-2 text-[10px]">PKGS</th>
                <th className="border-r-2 border-black p-2 text-[10px]">DESCRIPTION OF GOODS</th>
                <th className="border-r-2 border-black p-2 text-[10px]">VEHICLE SIZE (LxWxH)</th>
                <th className="border-r-2 border-black p-2 text-[10px]">WEIGHT (QTL)</th>
                <th className="border-r-2 border-black p-2 text-[10px]">VEHICLE NO</th>
                <th className="p-2 text-[10px]">RATE/QTL</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b-2 border-black h-32 align-top">
                <td className="border-r-2 border-black p-4 text-center font-bold">{trip.packages}</td>
                <td className="border-r-2 border-black p-4 font-medium uppercase">{trip.goodsDescription}</td>
                <td className="border-r-2 border-black p-4 text-center text-xs">
                  {trip.sizeL || '-'} x {trip.sizeW || '-'} x {trip.sizeH || '-'} ft
                </td>
                <td className="border-r-2 border-black p-4 text-center font-bold">{Number(trip.weight || 0)}</td>
                <td className="border-r-2 border-black p-4 text-center font-bold font-mono">{trip.vehicleNo}</td>
                <td className="p-4 text-right font-bold">₹{Number(trip.rateQtl || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary and Terms */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 border-2 border-black p-4 h-full relative">
            <h4 className="text-xs font-bold underline mb-2">TERMS & CONDITIONS</h4>
            <ul className="text-[10px] space-y-1 list-disc pl-3">
              <li>Goods are carried at Owner's Risk.</li>
              <li>Consignee should check the goods at the time of delivery.</li>
              <li>Not responsible for any leakage or damage during transit.</li>
              <li>Subject to local jurisdiction.</li>
            </ul>
            
            <div className="mt-4 p-2 bg-gray-50 border border-black/10 rounded">
               <span className="text-[10px] font-bold block mb-1">AMOUNT IN WORDS:</span>
               <p className="text-xs font-bold uppercase italic">Rupees {numberToWords(totalAmount)} Only</p>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <span className="text-xs font-bold">GST PAYABLE BY:</span>
              <div className="flex gap-4 text-[10px] uppercase font-bold items-center">
                 <div className="flex items-center gap-1">
                    <div className="w-4 h-4 border border-black flex items-center justify-center bg-gray-50">
                       {trip.gstPayBy === 'consigner' && <span>✓</span>}
                    </div>
                    <span>Consignor</span>
                 </div>
                 <div className="flex items-center gap-1">
                    <div className="w-4 h-4 border border-black flex items-center justify-center bg-gray-50">
                       {trip.gstPayBy === 'consignee' && <span>✓</span>}
                    </div>
                    <span>Consignee</span>
                 </div>
                 <div className="flex items-center gap-1">
                    <div className="w-4 h-4 border border-black flex items-center justify-center bg-gray-50">
                       {trip.gstPayBy === 'transporter' && <span>✓</span>}
                    </div>
                    <span>Transporter</span>
                 </div>
              </div>
            </div>
          </div>
          <div className="border-2 border-black p-0 divide-y-2 divide-black">
             <div className="p-2 flex justify-between">
                <span className="text-xs font-bold">TOTAL FREIGHT:</span>
                <span className="font-bold">₹{Number(trip.totalFreight || 0).toFixed(2)}</span>
             </div>
             <div className="p-2 flex justify-between">
                <span className="text-xs font-bold">UNLOADING:</span>
                <span className="font-bold">₹{Number(trip.unloadingCharges || 0).toFixed(2)}</span>
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
             <p className="text-[10px] font-bold uppercase">Consignee Signature</p>
          </div>
          <div className="text-right text-xs">
             <p className="font-bold uppercase">For {companyName}</p>
             <div className="h-16" />
             <p className="font-bold uppercase border-t border-black pt-1">Authorized Signatory</p>
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