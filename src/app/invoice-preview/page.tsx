
"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2, FileDown } from "lucide-react";

function InvoiceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const invoiceId = searchParams.get("id");
  const invoiceRef = useRef<HTMLDivElement>(null);
  
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!invoiceId) {
        setLoading(false);
        return;
      }
      
      try {
        const invoiceDoc = await getDoc(doc(db, "invoices", invoiceId));
        if (invoiceDoc.exists()) {
          setInvoice(invoiceDoc.data());
        }
      } catch (error) {
        console.error("Error fetching invoice:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [invoiceId]);

  const handleDownloadPdf = async () => {
    if (!invoiceRef.current || !invoice) return;
    setDownloading(true);
    
    const html2pdf = (await import('html2pdf.js')).default;
    
    const element = invoiceRef.current;
    const opt = {
      margin: 10,
      filename: `${invoice.billNo || 'Invoice'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        backgroundColor: '#ffffff'
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().from(element).set(opt).save();
    } catch (error) {
      console.error("PDF generation failed:", error);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!invoice) return <div className="p-8 text-center text-foreground">Invoice data not found. <Button variant="link" onClick={() => router.back()}>Go Back</Button></div>;

  const { transporterProfile: profile, trips, billNo, partyName, partyAddress, partyGst, partyMobile, invoiceTotal } = invoice;

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 font-body">
      <div ref={invoiceRef} className="max-w-5xl mx-auto !bg-white !text-black border-2 border-black p-8 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between mb-8 border-b-4 border-black pb-6">
           <div>
              <h1 className="text-4xl font-bold uppercase mb-2 !text-black">{profile.companyName}</h1>
              <p className="text-sm italic !text-black">{profile.address}</p>
              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm !text-black">
                 <p><span className="font-bold">Email:</span> {profile.email}</p>
                 <p><span className="font-bold">Phone:</span> {profile.mobile}</p>
                 <p><span className="font-bold">GSTIN:</span> {profile.gstNo}</p>
                 <p><span className="font-bold">Office:</span> {profile.officePhone || 'N/A'}</p>
              </div>
           </div>
           <div className="text-right flex flex-col justify-center !text-black">
              <h2 className="text-3xl font-bold border-b-2 border-black inline-block ml-auto mb-4 !text-black">TAX INVOICE</h2>
              <p className="text-lg font-bold">Bill No: {billNo}</p>
              <p className="text-md">Date: {new Date(invoice.createdAt?.seconds * 1000).toLocaleDateString()}</p>
           </div>
        </div>

        {/* Party Details */}
        <div className="mb-8 p-4 bg-gray-50 border-2 border-black !text-black">
           <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Billing To:</h3>
           <div className="grid grid-cols-2">
              <div>
                 <p className="text-xl font-bold uppercase !text-black">{partyName}</p>
                 <p className="text-sm max-w-md !text-black">{partyAddress}</p>
              </div>
              <div className="text-right !text-black">
                 <p><span className="font-bold">GST No:</span> {partyGst || 'UNREGISTERED'}</p>
                 <p><span className="font-bold">Mobile:</span> {partyMobile || 'N/A'}</p>
              </div>
           </div>
        </div>

        {/* Items Table */}
        <table className="w-full border-2 border-black mb-8 !text-black">
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
           <tbody className="divide-y divide-black/10 !text-black">
              {trips.map((trip: any, idx: number) => (
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
              <tr className="h-40 align-top">
                 <td colSpan={9} className="p-2"></td>
              </tr>
           </tbody>
           <tfoot>
              <tr className="bg-gray-100 border-t-2 border-black !text-black">
                 <td colSpan={8} className="p-3 text-right font-bold text-lg">GRAND TOTAL</td>
                 <td className="p-3 text-right font-bold text-xl">₹{invoiceTotal.toLocaleString()}</td>
              </tr>
           </tfoot>
        </table>

        {/* Footer */}
        <div className="grid grid-cols-2 gap-8 !text-black">
           <div className="border-2 border-black p-4 !text-black">
              <h4 className="font-bold text-sm border-b border-black mb-2 pb-1 !text-black">BANK SETTLEMENT DETAILS</h4>
              <p className="text-sm !text-black"><span className="font-bold">Bank Name:</span> {profile.bankName}</p>
              <p className="text-sm !text-black"><span className="font-bold">A/C No:</span> {profile.accountNo}</p>
              <p className="text-sm !text-black"><span className="font-bold">IFSC Code:</span> {profile.ifscCode}</p>
              <div className="mt-4 pt-4 border-t border-black !text-black">
                 <p className="text-xs font-bold uppercase italic">Amount in words: Rupees {invoiceTotal.toLocaleString()} Only</p>
              </div>
           </div>
           <div className="text-right flex flex-col justify-end items-end p-4 !text-black">
              <p className="font-bold uppercase text-xs mb-16 !text-black">For {profile.companyName}</p>
              <p className="font-bold uppercase text-sm border-t-2 border-black pt-2 !text-black">Authorized Signatory</p>
           </div>
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 no-print">
         <Button variant="outline" onClick={() => router.back()} className="bg-white border-black text-black hover:bg-gray-100 font-bold h-12 shadow-xl">
            <ArrowLeft className="w-5 h-5 mr-2" /> Back
         </Button>
         <Button onClick={handleDownloadPdf} disabled={downloading} className="bg-primary text-white hover:opacity-90 font-bold h-12 shadow-xl">
            {downloading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <FileDown className="w-5 h-5 mr-2" />}
            Download PDF
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
