"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc, serverTimestamp, updateDoc, or, and, runTransaction } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Plus, Edit, Trash2, User, Search, Loader2, Phone, CreditCard, Calendar, Truck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function DriversPage() {
  return (
    <div className="space-y-6">
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-2xl font-headline font-bold flex items-center gap-2">
            <User className="h-6 w-6 text-muted-foreground" /> Driver Module Hidden
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Driver details are no longer required in the active TripBook workflow. Existing driver data remains untouched in Firestore.
        </CardContent>
      </Card>
    </div>
  );

  // Legacy driver management UI is intentionally left below for reference and future rollback.
  const { profile } = useAuth();
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    licenseNo: "",
    licenseExpiry: "",
    address: "",
    vehicleId: "",
    status: "active"
  });

  useEffect(() => {
    if (!profile) return;
    
    // Fetch Drivers
    const driversQuery = query(
      collection(db, "drivers"), 
      or(where("companyId", "==", profile.companyId), where("userId", "==", profile.uid))
    );
    const unsubscribeDrivers = onSnapshot(
      driversQuery, 
      (snapshot) => {
        setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Drivers Query Error:", error);
        toast({ title: "Error", description: "Failed to load drivers. Check permissions or indexes.", variant: "destructive" });
        setLoading(false);
      }
    );

    // Fetch Vehicles for assignment dropdown
    const vehiclesQuery = query(
      collection(db, "vehicles"), 
      and(
        or(where("companyId", "==", profile.companyId), where("userId", "==", profile.uid)), 
        where("status", "==", "active")
      )
    );
    const unsubscribeVehicles = onSnapshot(
      vehiclesQuery,
      (snapshot) => {
        setVehicles(snapshot.docs.map(doc => ({ id: doc.id, vehicleNo: doc.data().vehicleNo })));
      },
      (error) => {
        console.error("Vehicles assignment Query Error:", error);
      }
    );

    return () => {
      unsubscribeDrivers();
      unsubscribeVehicles();
    };
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const selectedVehicleId = formData.vehicleId === "unassigned" ? "" : formData.vehicleId;
    const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

    // Validation: Check if vehicle is already assigned to ANOTHER driver
    if (selectedVehicleId) {
      const alreadyAssignedTo = drivers.find(d => 
        d.vehicleId === selectedVehicleId && 
        d.id !== editingDriver?.id &&
        d.status !== "inactive"
      );
      if (alreadyAssignedTo) {
        toast({ 
          title: "Assignment Error", 
          description: `This vehicle is already assigned to ${alreadyAssignedTo.name}.`, 
          variant: "destructive" 
        });
        return;
      }
    }
    
    try {
      await runTransaction(db, async (transaction) => {
        const driverData = {
          ...formData,
          vehicleId: selectedVehicleId,
          assignedVehicleId: selectedVehicleId,
          assignedVehicleNumber: selectedVehicle?.vehicleNo || "",
          updatedAt: serverTimestamp()
        };

        if (editingDriver) {
          const driverRef = doc(db, "drivers", editingDriver.id);
          
          // 1. If vehicle changed, clear old vehicle's assignment
          if (editingDriver.vehicleId && editingDriver.vehicleId !== selectedVehicleId) {
            const oldVehicleRef = doc(db, "vehicles", editingDriver.vehicleId);
            transaction.update(oldVehicleRef, {
              assignedDriverId: "",
              assignedDriverName: ""
            });
          }

          // 2. Update Driver
          transaction.update(driverRef, driverData);
          
          // 3. Update new vehicle's assignment
          if (selectedVehicleId) {
            const vehicleRef = doc(db, "vehicles", selectedVehicleId);
            transaction.update(vehicleRef, {
              assignedDriverId: editingDriver.id,
              assignedDriverName: formData.name
            });
          }
        } else {
          const driversCollection = collection(db, "drivers");
          const newDriverRef = doc(driversCollection);
          
          // 2. Create Driver
          transaction.set(newDriverRef, {
            ...driverData,
            companyId: profile.companyId,
            userId: profile.uid,
            createdAt: serverTimestamp()
          });

          // 3. Update vehicle's assignment
          if (selectedVehicleId) {
            const vehicleRef = doc(db, "vehicles", selectedVehicleId);
            transaction.update(vehicleRef, {
              assignedDriverId: newDriverRef.id,
              assignedDriverName: formData.name
            });
          }
        }
      });

      toast({ title: "Success", description: editingDriver ? "Driver updated." : "New driver added." });
      setIsDialogOpen(false);
      setEditingDriver(null);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this driver?")) {
      try {
        const driverRef = doc(db, "drivers", id);
        await deleteDoc(driverRef);
        toast({ title: "Deleted", description: "Driver removed." });
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      mobile: "",
      licenseNo: "",
      licenseExpiry: "",
      address: "",
      vehicleId: "",
      status: "active"
    });
  };

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    d.licenseNo.toLowerCase().includes(search.toLowerCase()) ||
    d.mobile.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Driver Management</h1>
          <p className="text-muted-foreground">Manage your drivers, licenses, and assignments</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingDriver(null); resetForm(); }} className="bg-gradient-primary h-11 px-6 font-bold">
              <Plus className="w-5 h-5 mr-2" /> Add New Driver
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card border-border/50 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline font-bold">{editingDriver ? "Edit Driver" : "Add Driver"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Driver's Full Name" />
              </div>
              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <Input required value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: e.target.value })} placeholder="e.g. +91 9876543210" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>License Number</Label>
                  <Input required value={formData.licenseNo} onChange={e => setFormData({ ...formData, licenseNo: e.target.value.toUpperCase() })} placeholder="DL Number" />
                </div>
                <div className="space-y-2">
                  <Label>License Expiry</Label>
                  <Input required type="date" value={formData.licenseExpiry} onChange={e => setFormData({ ...formData, licenseExpiry: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assigned Vehicle</Label>
                <Select value={formData.vehicleId} onValueChange={value => setFormData({ ...formData, vehicleId: value })}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Select a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {vehicles.map(v => {
                      const assignedTo = drivers.find(d => d.vehicleId === v.id && d.id !== editingDriver?.id);
                      return (
                        <SelectItem key={v.id} value={v.id} disabled={!!assignedTo}>
                          {v.vehicleNo} {assignedTo ? `— Assigned to ${assignedTo.name}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Full Address</Label>
                <textarea 
                  className="w-full h-24 p-3 bg-secondary/50 rounded-lg text-sm border focus:ring-primary"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Driver's permanent address"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={value => setFormData({ ...formData, status: value })}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_trip">On Trip</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full bg-gradient-primary h-12 font-bold text-lg shadow-lg">
                {editingDriver ? "Update Driver" : "Create Driver"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border/50">
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              className="pl-10 bg-secondary/30" 
              placeholder="Search by name, mobile, or license..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
              <User className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold">No drivers found.</p>
              <p className="text-sm">Add your first driver to get started.</p>
            </div>
          ) : (
            <div className="rounded-md border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="font-bold">Driver Name</TableHead>
                    <TableHead className="font-bold">Contact & License</TableHead>
                    <TableHead className="font-bold">Assigned Vehicle</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrivers.map((driver) => {
                    const assignedVehicle = vehicles.find(v => v.id === driver.vehicleId);
                    return (
                      <TableRow key={driver.id} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-bold text-primary">{driver.name}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1 text-xs"><Phone className="w-3 h-3" /> {driver.mobile}</span>
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><CreditCard className="w-3 h-3" /> {driver.licenseNo} (Exp: {driver.licenseExpiry})</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {assignedVehicle ? (
                            <div className="flex items-center gap-2 text-primary font-medium">
                              <Truck className="w-4 h-4" />
                              {assignedVehicle.vehicleNo}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={driver.status === "active" ? "default" : "secondary"} className={driver.status === "active" ? "bg-green-500/10 text-green-500 border-green-500/20" : ""}>
                            {driver.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="icon" variant="ghost" className="text-blue-500" onClick={() => { 
                              setEditingDriver(driver); 
                              setFormData({ 
                                name: driver.name, 
                                mobile: driver.mobile, 
                                licenseNo: driver.licenseNo, 
                                licenseExpiry: driver.licenseExpiry,
                                address: driver.address || "",
                                vehicleId: driver.vehicleId || "",
                                status: driver.status || "active"
                              }); 
                              setIsDialogOpen(true); 
                            }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(driver.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
