
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Truck, KeyRound } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { getTransporterAccessIssue } from "@/lib/account-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const normalizedEmail = formData.email.trim().toLowerCase();
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, formData.password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const accessIssue = getTransporterAccessIssue(userData);

        if (accessIssue) {
          if (userData.accountStatus === "pending") {
            router.push("/dashboard");
            return;
          }
          await signOut(auth);
          toast({
            title: "Access Denied",
            description: accessIssue,
            variant: "destructive",
          });
          return;
        }

        router.push("/dashboard");
      } else {
        await signOut(auth);
        toast({
          title: "Access Denied",
          description: "Profile not found.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!resetEmail) {
      toast({
        title: "Error",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);
    try {
      const normalizedEmail = resetEmail.trim().toLowerCase();
      
      // Explicit check if user exists in the database
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", normalizedEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({
          title: "Reset Failed",
          description: "No registered account found with this email address. Please check the email or sign up.",
          variant: "destructive",
        });
        setResetLoading(false);
        return;
      }
      
      // User exists, send the reset link
      await sendPasswordResetEmail(auth, normalizedEmail);
      setIsResetOpen(false);
      setResetEmail("");
      
      toast({
        title: "Success",
        description: "Password reset email sent successfully. Please check your inbox and spam folder.",
      });
    } catch (error: any) {
      let message = "Could not send reset email. Please try again.";
      if (error.code === "auth/user-not-found") {
        message = "No registered account found with this email address.";
      } else if (error.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      }
      
      toast({
        title: "Reset Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url(/images/bg-transport.png)' }}
    >
      {/* Dark overlay without blur so the background is crisp */}
      <div className="absolute inset-0 bg-background/60 z-0"></div>

      <Card className="w-full max-w-md bg-card/60 backdrop-blur-lg border-border/30 shadow-2xl relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mb-4 shadow-lg">
            <Truck className="text-white w-7 h-7" />
          </div>
          <h2 className="text-3xl font-headline font-bold">Welcome Back</h2>
          <p className="text-muted-foreground text-sm">Access your TripBook Pro account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-secondary/50 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                  <DialogTrigger asChild>
                    <button type="button" className="text-xs text-primary hover:underline font-bold">
                      Forgot Password?
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] bg-card border-border/50">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-primary" /> Reset Password
                      </DialogTitle>
                      <DialogDescription>
                        Enter your registered email address and we'll send you a link to reset your password.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleResetPassword} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="reset-email">Work Email</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="name@company.com"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="bg-secondary/50 border-border/50"
                        />
                      </div>
                      <DialogFooter>
                        <Button 
                          type="submit" 
                          disabled={resetLoading}
                          className="w-full bg-gradient-primary font-bold"
                        >
                          {resetLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Send Reset Link
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-secondary/50 border-border/50"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-primary h-11 font-bold shadow-lg"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline font-bold">
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
