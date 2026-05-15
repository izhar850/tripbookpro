"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, getDocs, orderBy } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Loader2, ShieldCheck, Truck, Users, PieChart, TrendingUp, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const { profile, user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [transporters, setTransporters] = useState<any[]>([]);
  const [allTrips, setAllTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!profile || profile.role !== 'admin')) {
      router.push("/dashboard");
    }
  }, [profile, authLoading, router]);

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const transportersQuery = query(collection(db, "users"), where("role", "==", "transporter"));
    const unsubscribeTransporters = onSnapshot(transportersQuery, (snapshot) => {
      setTransporters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const tripsQuery = query(collection(db, "trips"), orderBy("createdAt", "desc"));
    const unsubscribeTrips = onSnapshot(tripsQuery, (snapshot) => {
      setAllTrips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubscribeTransporters();
      unsubscribeTrips();
    };
  }, [profile]);

  if (authLoading || loading) return <div className="h-screen flex items-center justify-center bg-background"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  const totalRevenue = allTrips.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0);
  const totalPending = allTrips.reduce((acc, t) => acc + (Number(t.balance) || 0), 0);

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 space-y-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
           <div className="w-14 h-14 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-indigo-500/20 shadow-xl">
             <ShieldCheck className="text-white w-8 h-8" />
           </div>
           <div>
              <h1 className="text-4xl font-headline font-bold">Admin Console</h1>
              <p className="text-muted-foreground">Global Logistics Intelligence & Fleet Monitoring</p>
           </div>
        </div>
        <Button onClick={logout} variant="destructive" className="font-bold px-6 h-11">
           <LogOut className="w-5 h-5 mr-2" /> Exit Session
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: "Fleet Transporters", value: transporters.length, icon: Users, color: "text-blue-500" },
           { label: "Active Loads", value: allTrips.length, icon: Truck, color: "text-primary" },
           { label: "Global Revenue", value: `₹${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-green-500" },
           { label: "Aggregate Pending", value: `₹${totalPending.toLocaleString()}`, icon: PieChart, color: "text-destructive" }
         ].map((stat, i) => (
           <Card key={i} className="bg-card/50 backdrop-blur border-border/50">
             <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-bold">{stat.label}</CardTitle>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
             </CardHeader>
             <CardContent>
                <div className="text-3xl font-headline font-bold">{stat.value}</div>
             </CardContent>
           </Card>
         ))}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
         <Card className="bg-card border-border/50">
            <CardHeader>
               <CardTitle>Registered Fleet Companies</CardTitle>
            </CardHeader>
            <CardContent>
               <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Email</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {transporters.map((t) => (
                        <TableRow key={t.id}>
                           <TableCell className="font-bold text-primary">{t.companyName}</TableCell>
                           <TableCell>{t.ownerName}</TableCell>
                           <TableCell className="text-xs text-muted-foreground">{t.email}</TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>
            </CardContent>
         </Card>

         <Card className="bg-card border-border/50">
            <CardHeader>
               <CardTitle>System-Wide Live Loads</CardTitle>
            </CardHeader>
            <CardContent>
               <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead>LR No</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {allTrips.slice(0, 10).map((trip) => (
                        <TableRow key={trip.id}>
                           <TableCell className="font-mono text-xs">{trip.lrNo}</TableCell>
                           <TableCell className="font-medium text-xs truncate max-w-[100px]">{trip.companyName}</TableCell>
                           <TableCell className="text-xs">{trip.source} → {trip.destination}</TableCell>
                           <TableCell className="text-right font-bold text-destructive">₹{trip.balance.toLocaleString()}</TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}

// Minimal where implementation for simple simulation if not using Firebase SDK correctly in this file
function where(field: string, op: string, val: any) {
  return { field, op, val };
}
