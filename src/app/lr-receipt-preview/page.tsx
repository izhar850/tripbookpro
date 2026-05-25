"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { numberToWords } from "@/lib/format-utils";
import { normalizeVehicleNo } from "@/lib/transport-utils";

function displayValue(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  if (text === "0") return fallback;
  return text || fallback;
}

function formatMoney(value: unknown) {
  const text = String(value ?? "").trim();
  const amount = Number(value || 0);
  if (!text || amount === 0) return "";
  return `\u20b9${amount.toFixed(0)}`;
}

function formatDisplayDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString("en-GB");
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span className="inline-flex h-3 w-3 items-center justify-center border border-black align-middle text-[9px] leading-none">
      {checked ? "\u2713" : ""}
    </span>
  );
}

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

  const companyName = profile?.companyName || trip.companyName || "";
  const companyAddress = profile?.address || trip.companyAddress || "";
  const companyGst = profile?.gstNo || trip.companyGst || "";
  const companyMobile = profile?.mobile || trip.companyMobile || "";
  const companyEmail = profile?.email || trip.companyEmail || "";
  const companyOffice = profile?.officePhone || "";

  const consignorName = trip.consignorName || "";
  const consignorGst = trip.consignorGst || "";
  const consignorMobile = trip.consignorMobile || "";
  const consignorAddress = trip.consignorAddress || "";
  const consigneeName = trip.consigneeName || trip.partyName || "";
  const consigneeGst = trip.consigneeGst || trip.partyGst || "";
  const consigneeMobile = trip.consigneeMobile || trip.partyMobile || "";
  const consigneeAddress = trip.consigneeAddress || trip.partyAddress || "";

  const totalAmount = Number(trip.totalAmount || 0);
  const totalFreight = Number(trip.totalFreight || 0);
  const advance = Number(trip.advance || 0);
  const balance = Number(trip.balance || 0);
  const amountWords = totalAmount > 0 ? `${numberToWords(totalAmount)} Rupees Only` : "";
  const gstPayBy = String(trip.gstPayBy || "").toLowerCase();

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 font-body">
      <div ref={receiptRef} className="lr-sheet max-w-[794px] mx-auto !bg-white !text-black border-2 border-black px-7 py-6 shadow-2xl printable-area">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { size: A4; margin: 8mm; }
            html, body { background: white !important; }
            .printable-area { width: 100% !important; max-width: none !important; box-shadow: none !important; margin: 0 !important; }
            .printable-area { background-color: white !important; color: black !important; }
            .printable-area * { color: black !important; border-color: black !important; }
            .no-print { display: none !important; }
          }
          .printable-area, .printable-area * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .lr-sheet { font-family: Arial, Helvetica, sans-serif; }
          .lr-table td, .lr-table th { border: 1px solid #111827; }
        `}} />

        <header className="text-center border-b-2 border-black pb-3">
          <h1 className="text-[28px] font-black uppercase leading-none tracking-wide">{displayValue(companyName, "")}</h1>
          <p className="mt-2 text-[13px]">{displayValue(companyAddress, "")}</p>
          <p className="mt-1 text-[12px]">
            Mobile: {displayValue(companyMobile)}
            {companyOffice && <> | Office: {companyOffice}</>}
          </p>
          <p className="mt-1 text-[12px]">
            Email: {displayValue(companyEmail)} | GSTIN: {displayValue(companyGst)}
          </p>
        </header>

        <div className="border-b-2 border-black py-2 text-center text-[15px] font-black uppercase">
          Lorry Receipt / LR Copy
        </div>

        <section className="border border-black border-t-0">
          <div className="grid grid-cols-2 text-[12px]">
            <div className="grid grid-cols-[92px_1fr] gap-y-2 p-3">
              <span className="font-black">LR No:</span>
              <span>{displayValue(trip.lrNo)}</span>
              <span className="font-black">From:</span>
              <span>{displayValue(trip.source)}</span>
              <span className="font-black">Consignor:</span>
              <span>{displayValue(consignorName)}</span>
              {consignorAddress && <><span className="font-black">Address:</span><span className="whitespace-pre-wrap">{consignorAddress}</span></>}
              {consignorMobile && <><span className="font-black">Mobile:</span><span>{consignorMobile}</span></>}
              <span className="font-black">GST No:</span>
              <span>{displayValue(consignorGst)}</span>
            </div>
            <div className="grid grid-cols-[92px_1fr] gap-y-2 p-3">
              <span className="font-black">Date:</span>
              <span>{formatDisplayDate(trip.date)}</span>
              <span className="font-black">To:</span>
              <span>{displayValue(trip.destination)}</span>
              <span className="font-black">Consignee:</span>
              <span>{displayValue(consigneeName)}</span>
              {consigneeAddress && <><span className="font-black">Address:</span><span className="whitespace-pre-wrap">{consigneeAddress}</span></>}
              {consigneeMobile && <><span className="font-black">Mobile:</span><span>{consigneeMobile}</span></>}
              <span className="font-black">GST No:</span>
              <span>{displayValue(consigneeGst)}</span>
            </div>
          </div>
        </section>

        <table className="lr-table mt-3 w-full border-collapse text-[12px]">
          <tbody>
            <tr>
              <th className="w-[22%] bg-slate-100 p-2 text-left font-black">No. of Packages</th>
              <td className="w-[36%] p-2">{displayValue(trip.packages)}</td>
              <th className="w-[22%] bg-slate-100 p-2 text-left font-black">Weight</th>
              <td className="w-[20%] p-2">{displayValue(trip.weight)}</td>
            </tr>
            <tr>
              <th className="bg-slate-100 p-2 text-left font-black">Description of Goods</th>
              <td colSpan={3} className="h-14 p-2 align-top">{displayValue(trip.goodsDescription)}</td>
            </tr>
            <tr>
              <th className="bg-slate-100 p-2 text-left font-black">Vehicle No</th>
              <td className="p-2">{displayValue(normalizeVehicleNo(trip.vehicleNo))}</td>
              <th className="bg-slate-100 p-2 text-left font-black">Vehicle Type</th>
              <td className="p-2">{displayValue(trip.vehicleType)}</td>
            </tr>
            <tr>
              <th className="bg-slate-100 p-2 text-left font-black">Rate / Qtl</th>
              <td className="p-2">{formatMoney(trip.rateQtl)}</td>
              <th className="bg-slate-100 p-2 text-left font-black">Total Freight</th>
              <td className="p-2">{formatMoney(totalFreight)}</td>
            </tr>
            <tr>
              <th className="bg-slate-100 p-2 text-left font-black">Advance</th>
              <td className="p-2">{formatMoney(advance)}</td>
              <th className="bg-slate-100 p-2 text-left font-black">Balance</th>
              <td className="p-2">{formatMoney(balance)}</td>
            </tr>
            <tr>
              <th className="bg-slate-100 p-2 text-left font-black">Remark</th>
              <td colSpan={3} className="p-2">{displayValue(trip.remark || trip.notes)}</td>
            </tr>
          </tbody>
        </table>

        <section className="mt-3 border border-black p-3 text-[12px]">
          <span className="font-black">Amount in Words:</span> {amountWords}
        </section>

        <section className="mt-3 border border-black p-3 text-[12px] font-black">
          GST / Service Tax To Pay By:
          <span className="ml-5 inline-flex items-center gap-1"><CheckBox checked={gstPayBy === "consignor" || gstPayBy === "consigner"} /> Consignor</span>
          <span className="ml-5 inline-flex items-center gap-1"><CheckBox checked={gstPayBy === "consignee"} /> Consignee</span>
          <span className="ml-5 inline-flex items-center gap-1"><CheckBox checked={gstPayBy === "transporter"} /> Transporter</span>
        </section>

        <section className="mt-3 grid grid-cols-[1.45fr_1fr] gap-3">
          <div className="min-h-[145px] border border-black p-3 text-[12px]">
            <p className="mb-5 font-black">Terms & Conditions</p>
            <ol className="ml-8 list-decimal text-[11px] leading-snug">
              <li>Goods carried at owner's risk.</li>
              <li>All disputes subject to local jurisdiction.</li>
              <li>Please verify packages and goods before acknowledgement.</li>
              <li>Company is not responsible for leakage, breakage or shortage.</li>
            </ol>
          </div>
          <div className="min-h-[145px] border border-black p-3 text-[12px] font-black">
            <div className="flex h-full items-center">
              <p>Party Acknowledgement /<br />Stamp</p>
            </div>
          </div>
        </section>

        <footer className="mt-6 text-right text-[12px] font-black">
          For {displayValue(companyName, "")}
        </footer>
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
