"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, Landmark, Building2, User as UserIcon } from "lucide-react";

export default function ProfilePage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    ownerName: "",
    email: "",
    mobile: "",
    officePhone: "",
    gstNo: "",
    address: "",
    bankName: "",
    accountNo: "",
    ifscCode: ""
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        companyName: profile.companyName || "",
        ownerName: profile.ownerName || "",
        email: profile.email || "",
        mobile: profile.mobile || "",
        officePhone: profile.officePhone || "",
        gstNo: profile.gstNo || "",
        address: profile.address || "",
        bankName: profile.bankName || "",
        accountNo: profile.accountNo || "",
        ifscCode: profile.ifscCode || ""
      });
    }
  }, [profile]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);

    try {
      const isComplete = Boolean(
        formData.companyName && 
        formData.gstNo && 
        formData.bankName && 
        formData.accountNo && 
        formData.ifscCode &&
        formData.address
      );

      await updateDoc(doc(db, "users", profile.uid), {
        ...formData,
        profileCompleted: isComplete,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Profile Updated", description: "Your company details have been saved." });
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-headline font-bold">Account Settings</h1>
        <p className="text-muted-foreground">Manage your transporter identity and financial details</p>
      </div>

      <form onSubmit={handleUpdate} className="space-y-8">
        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Building2 className="text-primary w-5 h-5" />
            </div>
            <div>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Primary identification details for LR and Invoices</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input required value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>GST Number</Label>
              <Input required value={formData.gstNo} onChange={e => setFormData({ ...formData, gstNo: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Office Address</Label>
              <textarea 
                className="w-full h-24 p-3 bg-secondary/50 rounded-lg text-sm border focus:ring-primary"
                required
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <UserIcon className="text-primary w-5 h-5" />
            </div>
            <div>
              <CardTitle>Contact Details</CardTitle>
              <CardDescription>Communication channels for your account</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Owner Name</Label>
              <Input required value={formData.ownerName} onChange={e => setFormData({ ...formData, ownerName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Work Email</Label>
              <Input type="email" disabled value={formData.email} className="opacity-50" />
            </div>
            <div className="space-y-2">
              <Label>Mobile Number</Label>
              <Input required value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Office Phone</Label>
              <Input value={formData.officePhone} onChange={e => setFormData({ ...formData, officePhone: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Landmark className="text-primary w-5 h-5" />
            </div>
            <div>
              <CardTitle>Settlement Details</CardTitle>
              <CardDescription>Bank information printed on invoices for balance payments</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label>Bank Name</Label>
              <Input required value={formData.bankName} onChange={e => setFormData({ ...formData, bankName: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label>Account Number</Label>
              <Input required value={formData.accountNo} onChange={e => setFormData({ ...formData, accountNo: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label>IFSC Code</Label>
              <Input required value={formData.ifscCode} onChange={e => setFormData({ ...formData, ifscCode: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-primary font-bold shadow-lg shadow-indigo-500/20">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ShieldCheck className="w-5 h-5 mr-2" />}
          Update Profile Information
        </Button>
      </form>
    </div>
  );
}
