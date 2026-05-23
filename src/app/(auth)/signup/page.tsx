"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Truck } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { isValidMobile, normalizeGstNo, normalizeText } from "@/lib/transport-utils";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    ownerName: "",
    email: "",
    password: "",
    mobile: "",
    gstNo: "",
  });

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }

      const companyName = normalizeText(formData.companyName);
      const ownerName = normalizeText(formData.ownerName);
      const normalizedEmail = formData.email.trim().toLowerCase();
      const mobile = normalizeText(formData.mobile);
      const gstNo = normalizeGstNo(formData.gstNo);

      if (!companyName || !ownerName || !normalizedEmail || !formData.password || !mobile || !gstNo) {
        toast({
          title: "Validation Error",
          description: "All signup fields are required.",
          variant: "destructive",
        });
        return;
      }

      if (!isValidMobile(mobile)) {
        toast({
          title: "Validation Error",
          description: "Mobile number must be exactly 10 digits.",
          variant: "destructive",
        });
        return;
      }

      const usersRef = collection(db, "users");
      const duplicateChecks = await Promise.all([
        getDocs(query(usersRef, where("email", "==", normalizedEmail))),
        getDocs(query(usersRef, where("gstNo", "==", gstNo))),
        getDocs(query(usersRef, where("mobile", "==", mobile))),
      ]);

      if (duplicateChecks.some((snapshot) => !snapshot.empty)) {
        toast({
          title: "Duplicate Account",
          description: "An account with this GST/email/mobile already exists.",
          variant: "destructive",
        });
        return;
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, formData.password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        uid,
        companyId: uid,
        companyName,
        ownerName,
        email: normalizedEmail,
        mobile,
        gstNo,
        role: "transporter",
        accountStatus: "pending",
        plan: "trial",
        planName: "Trial",
        planStartDate: null,
        planExpiryDate: null,
        paymentStatus: "pending",
        officePhone: "",
        address: "",
        bankName: "",
        accountNo: "",
        ifscCode: "",
        profileCompleted: false,
        createdAt: serverTimestamp(),
      });

      try {
        await Promise.all([
          setDoc(doc(db, "counters", uid), { lastLrNo: 0 }, { merge: true }),
          setDoc(doc(db, "billCounters", uid), { lastBillNo: 0 }, { merge: true }),
        ]);
      } catch (counterError) {
        // Counter initialization is retried lazily by trip/bill creation so signup can still reach pending dashboard.
        console.warn("Counter initialization skipped during signup:", counterError);
      }

      toast({
        title: "Account Created",
        description: "Your account is pending admin approval.",
      });
      router.replace("/dashboard");
    } catch (error: any) {
      const duplicateMessage = error.code === "auth/email-already-in-use"
        ? "An account with this GST/email/mobile already exists."
        : error.message;
      toast({
        title: "Signup Failed",
        description: duplicateMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url(/images/bg-transport.png)' }}
    >
      {/* Dark overlay without blur so the background is crisp */}
      <div className="absolute inset-0 bg-background/60 z-0"></div>
      <ThemeToggle className="absolute right-4 top-4 z-20 bg-card/70 backdrop-blur-md" />

      <Card className="w-full max-w-lg bg-card/60 backdrop-blur-lg border-border/30 shadow-2xl relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mb-4 shadow-lg">
            <Truck className="text-white w-7 h-7" />
          </div>
          <h2 className="text-3xl font-headline font-bold">Create Account</h2>
          <p className="text-muted-foreground text-sm">Register your transport business today</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="e.g. Rapid Logistics Pvt Ltd"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerName">Owner Name</Label>
              <Input
                id="ownerName"
                placeholder="Your Full Name"
                required
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                inputMode="numeric"
                maxLength={10}
                placeholder="10 digit mobile"
                required
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gstNo">GST No</Label>
              <Input
                id="gstNo"
                placeholder="22AAAAA0000A1Z5"
                required
                value={formData.gstNo}
                onChange={(e) => setFormData({ ...formData, gstNo: e.target.value.toUpperCase() })}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-secondary/50"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-primary h-11 font-bold shadow-indigo-500/20 shadow-lg md:col-span-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Complete Registration"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-bold">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
