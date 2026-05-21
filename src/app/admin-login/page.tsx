"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [unauthorized, setUnauthorized] = useState("");
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleAdminLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setUnauthorized("");

    try {
      const normalizedEmail = formData.email.trim().toLowerCase();
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, formData.password);
      const userDoc = await getDoc(doc(db, "users", credential.user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;

      if (userData?.role !== "super_admin") {
        setUnauthorized("Unauthorized Access");
        await signOut(auth);
        return;
      }

      router.push("/admin-dashboard");
    } catch (error: any) {
      toast({
        title: "Admin Login Failed",
        description: error.message,
        variant: "destructive",
      });
      await signOut(auth).catch(() => undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url(/images/bg-transport.png)" }}
    >
      <div className="absolute inset-0 bg-background/70 z-0" />

      <Card className="w-full max-w-md bg-card/70 backdrop-blur-lg border-border/30 shadow-2xl relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mb-4 shadow-lg">
            <ShieldCheck className="text-white w-7 h-7" />
          </div>
          <h1 className="text-3xl font-headline font-bold">TripBook Super Admin</h1>
          <p className="text-muted-foreground text-sm">Restricted administrator access</p>
        </CardHeader>
        <CardContent>
          {unauthorized && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-bold text-destructive">
              {unauthorized}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                required
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                className="bg-secondary/50 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                required
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                className="bg-secondary/50 border-border/50"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-primary h-11 font-bold shadow-lg">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
