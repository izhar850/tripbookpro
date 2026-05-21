"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, deleteDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Plus, Edit, Trash2, Truck, Search, Loader2, Calendar, User, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  isValidDateInput,
  nextSortDirection,
  normalizeText,
  normalizeVehicleNo,
  sortRows,
  type SortConfig,
} from "@/lib/transport-utils";
import { getSubscriptionBlockMessage, isSubscriptionActive } from "@/lib/account-utils";
import { subscribeToOwnedCollection } from "@/lib/firestore-query-utils";

type VehicleSortKey = "createdAt" | "vehicleNo" | "type" | "status";

export default function VehiclesPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vehicleSort, setVehicleSort] = useState<SortConfig<VehicleSortKey>>({ key: "createdAt", direction: "desc" });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [formData, setFormData] = useState({
    vehicleNo: "",
    type: "",
    ownerName: "",
    capacity: "",
    rcExpiry: "",
    insuranceExpiry: "",
    permitExpiry: "",
    fitnessExpiry: "",
    pollutionExpiry: "",
    sizeL: "",
    sizeW: "",
    sizeH: "",
    status: "active"
  });
  const subscriptionActive = isSubscriptionActive(profile);
  const subscriptionBlockMessage = getSubscriptionBlockMessage(profile);

  const guardSubscriptionAction = () => {
    if (subscriptionActive) return false;
    toast({
      title: "Subscription Required",
      description: subscriptionBlockMessage || "Subscription expired. Please contact admin to renew.",
      variant: "destructive",
    });
    return true;
  };

  useEffect(() => {
    if (!profile) return;
    const unsubscribe = subscribeToOwnedCollection(
      db,
      "vehicles",
      profile,
      [],
      (rows) => {
        setVehicles(rows);
        setLoading(false);
      },
      (serverError: any) => {
        console.error("Vehicles Query Error:", serverError);
        toast({
          title: "Permission Error",
          description: "Unable to load vehicles. Please check your Firestore rules or indexes.",
          variant: "destructive",
        });
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [profile, toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (guardSubscriptionAction()) return;

    const vehicleData = {
      vehicleNo: normalizeVehicleNo(formData.vehicleNo),
      type: normalizeText(formData.type),
      ownerName: normalizeText(formData.ownerName),
      capacity: normalizeText(formData.capacity),
      rcExpiry: normalizeText(formData.rcExpiry),
      insuranceExpiry: normalizeText(formData.insuranceExpiry),
      permitExpiry: normalizeText(formData.permitExpiry),
      fitnessExpiry: normalizeText(formData.fitnessExpiry),
      pollutionExpiry: normalizeText(formData.pollutionExpiry),
      sizeL: normalizeText(formData.sizeL),
      sizeW: normalizeText(formData.sizeW),
      sizeH: normalizeText(formData.sizeH),
      status: normalizeText(formData.status || "active"),
    };

    if (!vehicleData.vehicleNo) {
      toast({ title: "Validation Error", description: "Vehicle number is required.", variant: "destructive" });
      return;
    }
    if (!vehicleData.type) {
      toast({ title: "Validation Error", description: "Vehicle type is required.", variant: "destructive" });
      return;
    }

    const invalidDateField = [
      ["RC expiry", vehicleData.rcExpiry],
      ["Insurance expiry", vehicleData.insuranceExpiry],
      ["Permit expiry", vehicleData.permitExpiry],
      ["Fitness expiry", vehicleData.fitnessExpiry],
      ["Pollution expiry", vehicleData.pollutionExpiry],
    ].find(([, value]) => !isValidDateInput(value));

    if (invalidDateField) {
      toast({ title: "Validation Error", description: `${invalidDateField[0]} must be a valid date.`, variant: "destructive" });
      return;
    }
    
    try {
      if (editingVehicle) {
        const vehicleRef = doc(db, "vehicles", editingVehicle.id);
        await updateDoc(vehicleRef, {
          ...vehicleData,
          updatedAt: serverTimestamp()
        });
        toast({ title: "Updated", description: "Vehicle details updated." });
      } else {
        const vehiclesCollection = collection(db, "vehicles");
        await addDoc(vehiclesCollection, {
          ...vehicleData,
          companyId: profile.companyId,
          userId: profile.uid,
          createdAt: serverTimestamp()
        });
        toast({ title: "Success", description: "New vehicle added." });
      }
      setIsDialogOpen(false);
      setEditingVehicle(null);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (guardSubscriptionAction()) return;
    if (confirm("Delete this vehicle?")) {
      try {
        const vehicleRef = doc(db, "vehicles", id);
        await deleteDoc(vehicleRef);
        toast({ title: "Deleted", description: "Vehicle removed." });
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      vehicleNo: "",
      type: "",
      ownerName: "",
      capacity: "",
      rcExpiry: "",
      insuranceExpiry: "",
      permitExpiry: "",
      fitnessExpiry: "",
      pollutionExpiry: "",
      sizeL: "",
      sizeW: "",
      sizeH: "",
      status: "active"
    });
  };

  const handleVehicleSort = (key: VehicleSortKey) => {
    setVehicleSort((current) => ({
      key,
      direction: nextSortDirection(current, key),
    }));
  };

  const filteredVehicles = vehicles.filter(v => {
    const queryText = search.toLowerCase();
    return (
      normalizeVehicleNo(v.vehicleNo).toLowerCase().includes(queryText) || 
      (v.ownerName || "").toLowerCase().includes(queryText) ||
      (v.type || "").toLowerCase().includes(queryText)
    );
  });

  const sortedVehicles = useMemo(() => sortRows(filteredVehicles, vehicleSort, {
    createdAt: (vehicle) => vehicle.createdAt || vehicle.updatedAt,
    vehicleNo: (vehicle) => normalizeVehicleNo(vehicle.vehicleNo),
    type: (vehicle) => vehicle.type,
    status: (vehicle) => vehicle.status,
  }), [filteredVehicles, vehicleSort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Vehicle Management</h1>
          <p className="text-muted-foreground">Manage your fleet and track documentation expiries</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => { setEditingVehicle(null); resetForm(); }}
              disabled={!subscriptionActive}
              title={!subscriptionActive ? subscriptionBlockMessage : "Add New Vehicle"}
              className="bg-gradient-primary h-11 px-6 font-bold"
            >
              <Plus className="w-5 h-5 mr-2" /> Add New Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl bg-card border-border/50 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline font-bold">{editingVehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle Number</Label>
                  <Input required value={formData.vehicleNo} onChange={e => setFormData({ ...formData, vehicleNo: e.target.value.toUpperCase() })} placeholder="e.g. MH 12 AB 1234" />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Type</Label>
                  <Input required value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} placeholder="e.g. 10 Wheeler, Container" />
                </div>
                <div className="space-y-2">
                  <Label>Owner Name</Label>
                  <Input required value={formData.ownerName} onChange={e => setFormData({ ...formData, ownerName: e.target.value })} placeholder="Full Name" />
                </div>
                <div className="space-y-2">
                  <Label>Capacity (Tons)</Label>
                  <Input required type="number" value={formData.capacity} onChange={e => setFormData({ ...formData, capacity: e.target.value })} placeholder="e.g. 15" />
                </div>
                <div className="space-y-2">
                  <Label>Size (L x W x H in ft)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="L" value={formData.sizeL} onChange={e => setFormData({ ...formData, sizeL: e.target.value })} />
                    <Input placeholder="W" value={formData.sizeW} onChange={e => setFormData({ ...formData, sizeW: e.target.value })} />
                    <Input placeholder="H" value={formData.sizeH} onChange={e => setFormData({ ...formData, sizeH: e.target.value })} />
                  </div>
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
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold flex items-center gap-2 border-b pb-2">
                  <Calendar className="w-4 h-4 text-primary" /> Documentation Expiry Dates
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>RC Expiry</Label>
                    <Input type="date" value={formData.rcExpiry} onChange={e => setFormData({ ...formData, rcExpiry: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Insurance Expiry</Label>
                    <Input type="date" value={formData.insuranceExpiry} onChange={e => setFormData({ ...formData, insuranceExpiry: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Permit Expiry</Label>
                    <Input type="date" value={formData.permitExpiry} onChange={e => setFormData({ ...formData, permitExpiry: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fitness Expiry</Label>
                    <Input type="date" value={formData.fitnessExpiry} onChange={e => setFormData({ ...formData, fitnessExpiry: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pollution (PUC) Expiry</Label>
                    <Input type="date" value={formData.pollutionExpiry} onChange={e => setFormData({ ...formData, pollutionExpiry: e.target.value })} />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full bg-gradient-primary h-12 font-bold text-lg shadow-lg">
                {editingVehicle ? "Update Vehicle" : "Create Vehicle"}
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
              placeholder="Search by vehicle number, owner, or type..." 
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
          ) : filteredVehicles.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
              <Truck className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold">No vehicles found.</p>
              <p className="text-sm">Click "Add New Vehicle" to build your fleet.</p>
            </div>
          ) : (
            <div className="rounded-md border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <SortableTableHead active={vehicleSort.key === "vehicleNo"} direction={vehicleSort.direction} onSort={() => handleVehicleSort("vehicleNo")}>Vehicle No</SortableTableHead>
                    <SortableTableHead active={vehicleSort.key === "type"} direction={vehicleSort.direction} onSort={() => handleVehicleSort("type")}>Type & Capacity</SortableTableHead>
                    <TableHead className="font-bold">Dimensions (ft)</TableHead>
                    <TableHead className="font-bold">Owner</TableHead>
                    <SortableTableHead active={vehicleSort.key === "status"} direction={vehicleSort.direction} onSort={() => handleVehicleSort("status")} align="center">Status</SortableTableHead>
                    <TableHead className="font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedVehicles.map((vehicle) => (
                    <TableRow key={vehicle.id} className="hover:bg-secondary/30 transition-colors">
                      <TableCell className="font-bold text-primary">
                        <div className="flex flex-col">
                          <span>{normalizeVehicleNo(vehicle.vehicleNo)}</span>
                          <span className="text-[10px] text-muted-foreground font-normal uppercase">Next Expiry: {vehicle.rcExpiry || "N/A"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span>{vehicle.type}</span>
                          <span className="text-xs text-muted-foreground">{vehicle.capacity} Tons</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-xs">
                        {vehicle.sizeL || "-"}{" x "}{vehicle.sizeW || "-"}{" x "}{vehicle.sizeH || "-"}
                      </TableCell>
                      <TableCell className="text-sm">{vehicle.ownerName}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={vehicle.status === "active" ? "default" : "secondary"} className={vehicle.status === "active" ? "bg-green-500/10 text-green-500 border-green-500/20" : ""}>
                          {vehicle.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="icon" variant="ghost" className="text-blue-500" disabled={!subscriptionActive} title={!subscriptionActive ? subscriptionBlockMessage : "Edit"} onClick={() => { 
                            setEditingVehicle(vehicle); 
                            setFormData({ 
                              vehicleNo: normalizeVehicleNo(vehicle.vehicleNo), 
                              type: vehicle.type, 
                              ownerName: vehicle.ownerName, 
                              capacity: vehicle.capacity,
                              rcExpiry: vehicle.rcExpiry || "",
                              insuranceExpiry: vehicle.insuranceExpiry || "",
                              permitExpiry: vehicle.permitExpiry || "",
                              fitnessExpiry: vehicle.fitnessExpiry || "",
                              pollutionExpiry: vehicle.pollutionExpiry || "",
                              sizeL: vehicle.sizeL || "",
                              sizeW: vehicle.sizeW || "",
                              sizeH: vehicle.sizeH || "",
                              status: vehicle.status || "active"
                            }); 
                            setIsDialogOpen(true); 
                          }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" disabled={!subscriptionActive} title={!subscriptionActive ? subscriptionBlockMessage : "Delete"} onClick={() => handleDelete(vehicle.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
