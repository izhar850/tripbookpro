"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Loader2, Truck, ShieldCheck, PieChart, FileText } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role === "admin") {
            router.push("/admin");
          } else {
            router.push("/dashboard");
          }
        }
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-lg">
            <Truck className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-headline font-bold">TripBook <span className="text-primary">Pro</span></span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-gradient-primary hover:opacity-90">Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
        <h1 className="text-5xl md:text-7xl font-headline font-bold mb-6 max-w-4xl mx-auto leading-tight">
          Modern Logistics Management for <span className="text-primary">Scaling Fleets.</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          Manage trips, parties, LR receipts, and billing invoices in one enterprise-grade dashboard. Built for the modern transporter.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="h-14 px-8 text-lg bg-gradient-primary">Register Your Company</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg">Live Demo</Button>
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-4 gap-8 mt-32">
          {[
            { icon: ShieldCheck, title: "Secure Data", desc: "Enterprise-grade encryption for all your financial records." },
            { icon: PieChart, title: "Live Analytics", desc: "Track revenue, advances, and pending balances in real-time." },
            { icon: FileText, title: "One-Click Billing", desc: "Generate professional GST-compliant invoices instantly." },
            { icon: Truck, title: "LR Management", desc: "Automated Lorry Receipt generation and digital tracking." }
          ].map((feature, i) => (
            <div key={i} className="p-6 rounded-2xl bg-card border border-border/50 text-left hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
