"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { collection, query, where, doc, deleteDoc, runTransaction, serverTimestamp, or, and, addDoc, getDoc, getDocs } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Plus, Edit, Trash2, FileText, Loader2, Search, TrendingUp, Users as UsersIcon, Wallet, ArrowUpRight, Truck, Receipt, Paperclip, CalendarDays, ShieldAlert } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { TripFilesModal } from "@/components/trip-files-modal";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  isValidDateInput,
  isValidMobile,
  nextSortDirection,
  normalizeGstNo,
  normalizeMultiline,
  normalizeText,
  normalizeVehicleNo,
  sortRows,
  type SortConfig,
} from "@/lib/transport-utils";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import {
  PLAN_DEFINITIONS,
  SUBSCRIPTION_FEATURES,
  TRANSPORTER_PLANS,
  formatDateInputValue,
  getDaysRemaining,
  getPlanName,
  getSubscriptionBlockMessage,
  getSubscriptionStatus,
  getTransporterPlan,
  isSubscriptionActive,
} from "@/lib/account-utils";
import { subscribeToOwnedCollection } from "@/lib/firestore-query-utils";

type TripSortKey = "date" | "lrNo" | "status" | "consignorName" | "consigneeName" | "vehicleNo" | "totalAmount";

const VEHICLE_TYPE_OPTIONS = ["single axle", "multi axle"];
const getPartyType = (party: any) => party?.partyType === "consignor" ? "consignor" : "consignee";
const getTripConsignorName = (trip: any) => trip?.consignorName || "";
const getTripConsigneeName = (trip: any) => trip?.consigneeName || trip?.partyName || "";

export default function Dashboard() {
  const { profile, db } = useAuth();
  const { toast } = useToast();
  
  const [trips, setTrips] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<any>(null);
  const [tripToDelete, setTripToDelete] = useState<any>(null);
  const [tripSort, setTripSort] = useState<SortConfig<TripSortKey>>({ key: "date", direction: "desc" });
  const [isQuickPartyOpen, setIsQuickPartyOpen] = useState(false);
  const [savingQuickParty, setSavingQuickParty] = useState(false);
  const [quickPartyData, setQuickPartyData] = useState({
    partyType: "consignee",
    partyName: "",
    gstNo: "",
    mobile: "",
    address: "",
  });
  const [quickPartyTarget, setQuickPartyTarget] = useState<"consignor" | "consignee">("consignee");
  const [isQuickVehicleOpen, setIsQuickVehicleOpen] = useState(false);
  const [savingQuickVehicle, setSavingQuickVehicle] = useState(false);
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const [quickVehicleData, setQuickVehicleData] = useState({
    vehicleNo: "",
    type: "",
    ownerName: "",
    capacity: "",
    sizeL: "",
    sizeW: "",
    sizeH: "",
    rcExpiry: "",
    insuranceExpiry: "",
    permitExpiry: "",
    fitnessExpiry: "",
    pollutionExpiry: "",
  });

  // New States for Payment and Status
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedTripForPayment, setSelectedTripForPayment] = useState<any>(null);
  const [paymentData, setPaymentData] = useState({
    paidAmount: "",
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: "UPI",
    paymentNotes: ""
  });

  // State for Trip Files Modal
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [selectedTripForFiles, setSelectedTripForFiles] = useState<any>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [formData, setFormData] = useState({
    lrNo: "",
    date: "",
    partyId: "",
    consignorPartyId: "",
    consigneePartyId: "",
    vehicleId: "",
    vehicleNo: "",
    vehicleType: "",
    packages: "",
    weight: "",
    goodsDescription: "",
    sizeL: "",
    sizeW: "",
    sizeH: "",
    source: "",
    destination: "",
    rateQtl: "",
    unloadingCharges: "",
    advance: "",
    remark: "",
    gstPayBy: "",
    notes: ""
  });

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      date: new Date().toISOString().split('T')[0]
    }));
  }, []);

  useEffect(() => {
    if (!profile || !db) return;

    const unsubscribeTrips = subscribeToOwnedCollection(
      db,
      "trips",
      profile,
      [],
      (rows) => {
        setTrips(rows);
        setLoading(false);
      },
      (serverError) => {
        console.error("Dashboard Trips Query Error:", serverError);
        setLoading(false);
      }
    );

    const unsubscribeParties = subscribeToOwnedCollection(
      db,
      "parties",
      profile,
      [],
      setParties,
      (serverError) => {
        console.error("Dashboard Parties Query Error:", serverError);
      }
    );

    const unsubscribeVehicles = subscribeToOwnedCollection(
      db,
      "vehicles",
      profile,
      [where("status", "==", "active")],
      setVehicles,
      (serverError) => {
        console.error("Dashboard Vehicles Query Error:", serverError);
      }
    );

    return () => {
      unsubscribeTrips();
      unsubscribeParties();
      unsubscribeVehicles();
    };
  }, [profile, db]);

  const stats = useMemo(() => {
    let revenue = 0, advance = 0, paid = 0, pending = 0;
    trips.forEach((trip: any) => {
      revenue += (Number(trip.totalAmount) || 0);
      advance += (Number(trip.advance) || 0);
      paid += (Number(trip.paidAmount) || 0);
      pending += (Number(trip.totalAmount || 0) - Number(trip.paidAmount || 0));
    });
    return {
      totalTrips: trips.length,
      totalRevenue: revenue,
      totalAdvance: advance,
      totalPaid: paid,
      totalPending: pending,
    };
  }, [trips]);

  const chartData = useMemo(() => {
    const months: { [key: string]: number } = {};
    trips.forEach(t => {
      const month = new Date(t.date).toLocaleString('default', { month: 'short' });
      months[month] = (months[month] || 0) + (Number(t.totalAmount) || 0);
    });
    return Object.keys(months).map(name => ({ name, value: months[name] }));
  }, [trips]);

  const partyData = useMemo(() => {
    const partyStats: { [key: string]: number } = {};
    trips.forEach(t => {
      const partyName = getTripConsigneeName(t);
      if (!partyName) return;
      partyStats[partyName] = (partyStats[partyName] || 0) + (Number(t.totalAmount) || 0);
    });
    return Object.keys(partyStats).map(name => ({ name, value: partyStats[name] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [trips]);

  const consignorParties = useMemo(() => parties.filter((party) => getPartyType(party) === "consignor"), [parties]);
  const consigneeParties = useMemo(() => parties.filter((party) => getPartyType(party) === "consignee"), [parties]);

  const openQuickPartyModal = (partyType: "consignor" | "consignee") => {
    setQuickPartyTarget(partyType);
    setQuickPartyData({
      partyType,
      partyName: "",
      gstNo: "",
      mobile: "",
      address: "",
    });
    setIsQuickPartyOpen(true);
  };

  const totals = useMemo(() => {
    const weight = Number(formData.weight) || 0;
    const rateQtl = Number(formData.rateQtl) || 0;
    const unloading = Number(formData.unloadingCharges) || 0;
    const advance = Number(formData.advance) || 0;

    const totalFreight = weight * rateQtl;
    const totalAmount = totalFreight + unloading;
    const balance = totalAmount - advance;

    return { totalFreight, totalAmount, balance };
  }, [formData.weight, formData.rateQtl, formData.unloadingCharges, formData.advance]);

  const handleTripSort = (key: TripSortKey) => {
    setTripSort((current) => ({
      key,
      direction: nextSortDirection(current, key),
    }));
  };

  const showValidationError = (description: string) => {
    toast({ title: "Validation Error", description, variant: "destructive" });
  };

  const subscriptionStatus = getSubscriptionStatus(profile);
  const currentPlan = getTransporterPlan(profile);
  const currentPlanName = profile?.planName || getPlanName(profile);
  const daysRemaining = getDaysRemaining(profile);
  const subscriptionActive = isSubscriptionActive(profile);
  const subscriptionBlockMessage = getSubscriptionBlockMessage(profile);
  const subscriptionStatusStyles: Record<string, string> = {
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    expiring_soon: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    expired: "bg-destructive/10 text-destructive border-destructive/20",
    pending: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    suspended: "bg-destructive/10 text-destructive border-destructive/20",
  };
  const subscriptionStatusLabels: Record<string, string> = {
    active: "Active",
    expiring_soon: "Expiring Soon",
    expired: "Expired",
    pending: "Pending",
    suspended: "Suspended",
  };

  const showRenewalMessage = () => {
    toast({
      title: "Contact Admin",
      description: subscriptionBlockMessage || "Please contact admin to request renewal or plan change.",
    });
  };

  const guardSubscriptionAction = () => {
    if (subscriptionActive) return false;
    toast({
      title: "Subscription Required",
      description: subscriptionBlockMessage || "Subscription expired. Please contact admin to renew.",
      variant: "destructive",
    });
    return true;
  };

  const guardEditAction = () => {
    if (subscriptionActive) return false;
    toast({
      title: "Editing Disabled",
      description: subscriptionBlockMessage || "Subscription expired. Please contact admin to renew.",
      variant: "destructive",
    });
    return true;
  };

  const formatLrNo = (value: number) => `LR-${value.toString().padStart(4, "0")}`;

  const getSequentialLrNumber = (lrNo: string) => {
    const match = /^LR-(\d+)$/i.exec(lrNo);
    return match ? Number(match[1]) : 0;
  };

  const getCounterRef = () => {
    if (!profile || !db) return null;
    return doc(db, "counters", profile.companyId || profile.uid);
  };

  const loadSuggestedLrNo = async () => {
    const counterRef = getCounterRef();
    if (!counterRef) return;

    try {
      // LR suggestions are not reserved here; the counter is advanced only during save.
      const counterDoc = await getDoc(counterRef);
      const nextLrNo = ((counterDoc.exists() ? Number(counterDoc.data().lastLrNo || 0) : 0) + 1);
      setFormData((current) => ({ ...current, lrNo: current.lrNo || formatLrNo(nextLrNo) }));
    } catch (error) {
      setFormData((current) => ({ ...current, lrNo: current.lrNo || formatLrNo(1) }));
    }
  };

  const handleNewTrip = async () => {
    if (guardSubscriptionAction()) return;
    setEditingTrip(null);
    resetForm();
    await loadSuggestedLrNo();
  };

  const findDuplicateLrNo = async (lrNo: string) => {
    if (!profile || !db) return null;

    const tripsQuery = query(
      collection(db, "trips"),
      and(
        or(where("companyId", "==", profile.companyId), where("userId", "==", profile.uid)),
        where("lrNo", "==", lrNo)
      )
    );
    const snapshot = await getDocs(tripsQuery);
    return snapshot.docs.find((tripDoc) => tripDoc.id !== editingTrip?.id) || null;
  };

  const getCleanTripFormData = () => ({
    ...formData,
    lrNo: normalizeText(formData.lrNo).toUpperCase(),
    date: normalizeText(formData.date),
    partyId: normalizeText(formData.partyId),
    consignorPartyId: normalizeText(formData.consignorPartyId),
    consigneePartyId: normalizeText(formData.consigneePartyId),
    vehicleId: normalizeText(formData.vehicleId),
    vehicleNo: normalizeVehicleNo(formData.vehicleNo),
    vehicleType: normalizeText(formData.vehicleType),
    packages: normalizeText(formData.packages),
    weight: normalizeText(formData.weight),
    goodsDescription: normalizeText(formData.goodsDescription),
    sizeL: normalizeText(formData.sizeL),
    sizeW: normalizeText(formData.sizeW),
    sizeH: normalizeText(formData.sizeH),
    source: normalizeText(formData.source),
    destination: normalizeText(formData.destination),
    rateQtl: normalizeText(formData.rateQtl),
    unloadingCharges: normalizeText(formData.unloadingCharges),
    advance: normalizeText(formData.advance),
    remark: normalizeText(formData.remark),
    gstPayBy: normalizeText(formData.gstPayBy),
    notes: normalizeMultiline(formData.notes),
  });

  const validateTripForm = (_data: ReturnType<typeof getCleanTripFormData>) => {
    // Trip entry intentionally allows blank LR copies, so no save-time field validation is applied here.
    return "";
  };

  const handleSaveQuickParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !db) return;
    if (guardSubscriptionAction()) return;

    const partyData = {
      partyType: quickPartyTarget,
      partyName: normalizeText(quickPartyData.partyName),
      gstNo: normalizeGstNo(quickPartyData.gstNo),
      mobile: normalizeText(quickPartyData.mobile),
      address: normalizeMultiline(quickPartyData.address),
    };

    if (!partyData.partyName) {
      showValidationError("Party name is required.");
      return;
    }
    if (!isValidMobile(partyData.mobile)) {
      showValidationError("Mobile number must be exactly 10 digits.");
      return;
    }

    setSavingQuickParty(true);
    try {
      const data = {
        ...partyData,
        companyId: profile.companyId,
        userId: profile.uid,
        createdAt: serverTimestamp(),
      };
      const partyRef = await addDoc(collection(db, "parties"), data);
      const createdParty = { id: partyRef.id, ...data };

      setParties((current) => current.some((p) => p.id === partyRef.id) ? current : [...current, createdParty]);
      setFormData((current) => ({
        ...current,
        ...(quickPartyTarget === "consignor"
          ? { consignorPartyId: partyRef.id }
          : { consigneePartyId: partyRef.id, partyId: partyRef.id }),
      }));
      setQuickPartyData({ partyType: "consignee", partyName: "", gstNo: "", mobile: "", address: "" });
      setIsQuickPartyOpen(false);
      toast({ title: "Party Added", description: `${partyData.partyName} selected for this trip.` });
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: 'parties',
        operation: 'create',
        requestResourceData: partyData,
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingQuickParty(false);
    }
  };

  const resetQuickVehicleData = () => {
    setQuickVehicleData({
      vehicleNo: "",
      type: "",
      ownerName: "",
      capacity: "",
      sizeL: "",
      sizeW: "",
      sizeH: "",
      rcExpiry: "",
      insuranceExpiry: "",
      permitExpiry: "",
      fitnessExpiry: "",
      pollutionExpiry: "",
    });
  };

  const handleSaveQuickVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !db) return;
    if (guardSubscriptionAction()) return;

    const vehicleData = {
      vehicleNo: normalizeVehicleNo(quickVehicleData.vehicleNo),
      type: normalizeText(quickVehicleData.type),
      ownerName: normalizeText(quickVehicleData.ownerName),
      capacity: normalizeText(quickVehicleData.capacity),
      sizeL: normalizeText(quickVehicleData.sizeL),
      sizeW: normalizeText(quickVehicleData.sizeW),
      sizeH: normalizeText(quickVehicleData.sizeH),
      rcExpiry: normalizeText(quickVehicleData.rcExpiry),
      insuranceExpiry: normalizeText(quickVehicleData.insuranceExpiry),
      permitExpiry: normalizeText(quickVehicleData.permitExpiry),
      fitnessExpiry: normalizeText(quickVehicleData.fitnessExpiry),
      pollutionExpiry: normalizeText(quickVehicleData.pollutionExpiry),
      status: "active",
    };

    if (!vehicleData.vehicleNo) {
      showValidationError("Vehicle number is required.");
      return;
    }
    if (!vehicleData.type) {
      showValidationError("Vehicle type is required.");
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
      showValidationError(`${invalidDateField[0]} must be a valid date.`);
      return;
    }

    setSavingQuickVehicle(true);
    try {
      const data = {
        ...vehicleData,
        companyId: profile.companyId,
        userId: profile.uid,
        createdAt: serverTimestamp(),
      };
      const vehicleRef = await addDoc(collection(db, "vehicles"), data);
      const createdVehicle = { id: vehicleRef.id, ...data };

      setVehicles((current) => current.some((v) => v.id === vehicleRef.id) ? current : [...current, createdVehicle]);
      setFormData((current) => ({
        ...current,
        vehicleId: vehicleRef.id,
        vehicleNo: vehicleData.vehicleNo,
        vehicleType: vehicleData.type,
        sizeL: vehicleData.sizeL,
        sizeW: vehicleData.sizeW,
        sizeH: vehicleData.sizeH,
      }));
      resetQuickVehicleData();
      setIsQuickVehicleOpen(false);
      toast({ title: "Vehicle Added", description: `${vehicleData.vehicleNo} selected for this trip.` });
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: 'vehicles',
        operation: 'create',
        requestResourceData: vehicleData,
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingQuickVehicle(false);
    }
  };



  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !db) return;
    if (!editingTrip && guardSubscriptionAction()) return;

    const cleanedFormData = getCleanTripFormData();
    const validationError = validateTripForm(cleanedFormData);
    if (validationError) {
      showValidationError(validationError);
      return;
    }

    if (editingTrip?.billed && !window.confirm("This trip is already billed. Changes may affect existing bill.")) {
      return;
    }

    try {
      const duplicateLrNo = cleanedFormData.lrNo ? await findDuplicateLrNo(cleanedFormData.lrNo) : null;
      if (duplicateLrNo) {
        showValidationError("LR number already exists for this company.");
        return;
      }
    } catch (error: any) {
      toast({ title: "Validation Error", description: error.message, variant: "destructive" });
      return;
    }

    const selectedConsignor = parties.find(p => p.id === cleanedFormData.consignorPartyId);
    const selectedConsignee = parties.find(p => p.id === cleanedFormData.consigneePartyId);

    const selectedVehicle = vehicles.find(v => v.id === cleanedFormData.vehicleId);
    const tripFormData = {
      ...cleanedFormData,
      partyId: selectedConsignee?.id || cleanedFormData.partyId,
      vehicleNo: normalizeVehicleNo(selectedVehicle?.vehicleNo || cleanedFormData.vehicleNo),
      vehicleType: normalizeText(selectedVehicle?.type || cleanedFormData.vehicleType),
    };

    const partySnapshot = {
      consignorPartyId: selectedConsignor?.id || cleanedFormData.consignorPartyId,
      consignorName: selectedConsignor?.partyName || "",
      consignorGst: selectedConsignor?.gstNo || "",
      consignorMobile: selectedConsignor?.mobile || "",
      consignorAddress: selectedConsignor?.address || "",
      consigneePartyId: selectedConsignee?.id || cleanedFormData.consigneePartyId,
      consigneeName: selectedConsignee?.partyName || "",
      consigneeGst: selectedConsignee?.gstNo || "",
      consigneeMobile: selectedConsignee?.mobile || "",
      consigneeAddress: selectedConsignee?.address || "",
      partyId: selectedConsignee?.id || cleanedFormData.partyId,
      partyName: selectedConsignee?.partyName || "",
      partyGst: selectedConsignee?.gstNo || "",
      partyAddress: selectedConsignee?.address || "",
      partyMobile: selectedConsignee?.mobile || "",
    };

    const { totalFreight, totalAmount, balance } = totals;

    const numericData = {
      packages: Number(tripFormData.packages) || 0,
      weight: Number(tripFormData.weight) || 0,
      rateQtl: Number(tripFormData.rateQtl) || 0,
      unloadingCharges: Number(tripFormData.unloadingCharges) || 0,
      advance: Number(tripFormData.advance) || 0,
      totalFreight: Number(totalFreight) || 0,
      totalAmount: Number(totalAmount) || 0,
      balance: Number(balance) || 0,
    };

    try {
      if (editingTrip) {
        const tripRef = doc(db, "trips", editingTrip.id);
        
        // Calculate advance difference to sync with paidAmount
        const oldAdvance = Number(editingTrip.advance) || 0;
        const newAdvance = Number(tripFormData.advance) || 0;
        const advanceDiff = newAdvance - oldAdvance;
        
        // Use existing paidAmount, or fallback to oldAdvance if it's a legacy trip
        const currentTotalPaid = (editingTrip.paidAmount !== undefined) 
          ? Number(editingTrip.paidAmount) 
          : oldAdvance;
          
        const updatedTotalPaid = Math.max(0, currentTotalPaid + advanceDiff);
        const finalAmount = numericData.totalAmount;
        
        let paymentStatus = "Partial";
        if (updatedTotalPaid === 0) paymentStatus = "Unpaid";
        else if (updatedTotalPaid >= finalAmount) paymentStatus = "Paid";

        await runTransaction(db, async (transaction) => {
          transaction.update(tripRef, {
            ...tripFormData,
            ...numericData,
            paidAmount: updatedTotalPaid,
            pendingAmount: Math.max(0, finalAmount - updatedTotalPaid),
            paymentStatus: paymentStatus,
            companyId: profile.companyId,
            companyName: profile.companyName,
            companyAddress: profile.address || "",
            companyGst: profile.gstNo || "",
            companyMobile: profile.mobile || "",
            ...partySnapshot,
            updatedAt: serverTimestamp(),
            // If payment is complete, sync trip status
            ...(paymentStatus === "Paid" ? { status: "Paid", statusUpdatedAt: serverTimestamp() } : {})
          });
        }).catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: tripRef.path,
            operation: 'update',
            requestResourceData: tripFormData,
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
          throw error;
        });
        toast({ title: "Trip Updated", description: "The trip details have been updated." });
      } else {
        const counterRef = getCounterRef() || doc(db, "counters", profile.uid);
        const newTripRef = doc(collection(db, "trips"));
        
        await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          const lastLrNo = counterDoc.exists() ? Number(counterDoc.data().lastLrNo || 0) : 0;
          let nextLrNo = 1;
          if (counterDoc.exists()) {
            nextLrNo = (counterDoc.data().lastLrNo || 0) + 1;
          }

          const suggestedLrNo = formatLrNo(nextLrNo);
          const lrNo = tripFormData.lrNo;
          const manualSequence = getSequentialLrNumber(lrNo);
          const nextCounterValue = lrNo
            ? Math.max(lastLrNo, manualSequence || (lrNo === suggestedLrNo ? nextLrNo : lastLrNo))
            : lastLrNo;

          transaction.set(newTripRef, {
            ...tripFormData,
            ...numericData,
            companyId: profile.companyId,
            userId: profile.uid,
            companyName: profile.companyName,
            companyAddress: profile.address || "",
            companyGst: profile.gstNo || "",
            companyMobile: profile.mobile || "",
            ownerName: profile.ownerName,
            ...partySnapshot,
            lrNo,
            billed: false,
            billNo: "",
            status: "Pending",
            statusUpdatedAt: serverTimestamp(),
            paymentStatus: numericData.advance >= numericData.totalAmount ? "Paid" : (numericData.advance > 0 ? "Partial" : "Unpaid"),
            paidAmount: numericData.advance,
            pendingAmount: Math.max(0, numericData.totalAmount - numericData.advance),
            hasPOD: false,
            podUploadedAt: null,
            createdAt: serverTimestamp()
          });

          if (nextCounterValue > lastLrNo) {
            transaction.set(counterRef, { lastLrNo: nextCounterValue }, { merge: true });
          }
        }).catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: 'trips',
            operation: 'create',
            requestResourceData: tripFormData,
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
          throw error;
        });
        toast({ title: "Trip Created", description: "New trip record added successfully." });
      }

      setIsSheetOpen(false);
      setEditingTrip(null);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error Saving", description: error.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      lrNo: "",
      date: new Date().toISOString().split('T')[0],
      partyId: "",
      consignorPartyId: "",
      consigneePartyId: "",
      vehicleId: "",
      vehicleNo: "",
      vehicleType: "",
      packages: "",
      weight: "",
      goodsDescription: "",
      sizeL: "",
      sizeW: "",
      sizeH: "",
      source: "",
      destination: "",
      rateQtl: "",
      unloadingCharges: "",
      advance: "",
      remark: "",
      gstPayBy: "",
      notes: ""
    });
  };

  const handleDeleteTrip = async () => {
    if (!db || !tripToDelete) return;
    if (guardEditAction()) {
      setTripToDelete(null);
      return;
    }
    deleteDoc(doc(db, "trips", tripToDelete.id))
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: `trips/${tripToDelete.id}`,
          operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      });
    toast({ title: "Deleted", description: `Trip ${tripToDelete.lrNo} record deleted.` });
    setTripToDelete(null);
  };

  const handleEditTrip = (trip: any) => {
    if (guardEditAction()) return;
    setEditingTrip(trip);
    setFormData({
      lrNo: normalizeText(trip.lrNo).toUpperCase(),
      date: trip.date,
      partyId: trip.consigneePartyId || trip.partyId || "",
      consignorPartyId: trip.consignorPartyId || "",
      consigneePartyId: trip.consigneePartyId || trip.partyId || "",
      vehicleId: trip.vehicleId || "",
      vehicleNo: normalizeVehicleNo(trip.vehicleNo),
      vehicleType: trip.vehicleType,
      packages: (trip.packages || 0).toString(),
      weight: (trip.weight || 0).toString(),
      goodsDescription: trip.goodsDescription,
      sizeL: trip.sizeL || "",
      sizeW: trip.sizeW || "",
      sizeH: trip.sizeH || "",
      source: trip.source,
      destination: trip.destination,
      rateQtl: (trip.rateQtl || 0).toString(),
      unloadingCharges: (trip.unloadingCharges || 0).toString(),
      advance: (trip.advance || 0).toString(),
      remark: trip.remark || "",
      gstPayBy: trip.gstPayBy || "",
      notes: trip.notes || ""
    });
    setIsSheetOpen(true);
  };

  const filteredTrips = trips.filter(trip => {
    const queryStr = searchQuery.toLowerCase();
    const matchesSearch = (
      trip.lrNo?.toLowerCase().includes(queryStr) ||
      getTripConsignorName(trip).toLowerCase().includes(queryStr) ||
      getTripConsigneeName(trip).toLowerCase().includes(queryStr) ||
      trip.partyName?.toLowerCase().includes(queryStr) ||
      normalizeVehicleNo(trip.vehicleNo).toLowerCase().includes(queryStr) ||
      trip.source?.toLowerCase().includes(queryStr) ||
      trip.destination?.toLowerCase().includes(queryStr) ||
      trip.billNo?.toLowerCase().includes(queryStr)
    );

    const isBilled = trip.billed || trip.isBilled || false;
    const matchesStatus = filterStatus === "all" 
      ? true 
      : filterStatus === "billed" ? isBilled === true : filterStatus === "unbilled" ? isBilled === false : trip.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const sortedTrips = useMemo(() => sortRows(filteredTrips, tripSort, {
    date: (trip) => trip.createdAt || trip.date,
    lrNo: (trip) => trip.lrNo,
    status: (trip) => trip.status || trip.paymentStatus,
    consignorName: (trip) => getTripConsignorName(trip),
    consigneeName: (trip) => getTripConsigneeName(trip),
    vehicleNo: (trip) => normalizeVehicleNo(trip.vehicleNo),
    totalAmount: (trip) => Number(trip.totalAmount || trip.totalFreight || 0),
  }), [filteredTrips, tripSort]);

  const handleUpdateStatus = async (tripId: string, newStatus: string) => {
    if (!db) return;
    if (guardEditAction()) return;
    try {
      const tripRef = doc(db, "trips", tripId);
      await runTransaction(db, async (transaction) => {
        transaction.update(tripRef, {
          status: newStatus,
          statusUpdatedAt: serverTimestamp(),
          // If status is Paid, ensure payment status is also Paid
          ...(newStatus === "Paid" ? { paymentStatus: "Paid" } : {})
        });
      });
      toast({ title: "Status Updated", description: `Trip marked as ${newStatus}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !selectedTripForPayment) return;
    if (guardEditAction()) return;

    const currentPaid = Number(selectedTripForPayment.paidAmount) || 0;
    const newPaidInput = Number(paymentData.paidAmount) || 0;
    const finalAmount = Number(selectedTripForPayment.totalAmount) || 0;
    
    // Validation: payment cannot exceed total bill amount
    if (currentPaid + newPaidInput > finalAmount) {
      toast({
        title: "Payment Error",
        description: `Payment exceeds total bill. Allowed maximum additional amount is ₹${finalAmount - currentPaid}.`,
        variant: "destructive"
      });
      return;
    }

    const totalPaid = currentPaid + newPaidInput;
    let paymentStatus = "Partial";
    if (totalPaid === 0) paymentStatus = "Unpaid";
    else if (totalPaid >= finalAmount) paymentStatus = "Paid";

    try {
      const tripRef = doc(db, "trips", selectedTripForPayment.id);
      await runTransaction(db, async (transaction) => {
        transaction.update(tripRef, {
          paidAmount: totalPaid,
          pendingAmount: Math.max(0, finalAmount - totalPaid),
          paymentStatus: paymentStatus,
          lastPaymentDate: paymentData.paymentDate,
          lastPaymentMode: paymentData.paymentMode,
          paymentNotes: paymentData.paymentNotes,
          // If payment is complete, optionally set trip status to Paid
          ...(paymentStatus === "Paid" ? { status: "Paid", statusUpdatedAt: serverTimestamp() } : {})
        });
      });
      
      toast({ title: "Payment Recorded", description: `Amount ₹${newPaidInput} added to Trip ${selectedTripForPayment.lrNo}` });
      setIsPaymentModalOpen(false);
      setSelectedTripForPayment(null);
      setPaymentData({
        paidAmount: "",
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMode: "UPI",
        paymentNotes: ""
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const statusColors: any = {
    "Pending": "bg-slate-500/10 text-slate-500 border-slate-500/20",
    "In Transit": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "Delivered": "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    "Billed": "bg-orange-500/10 text-orange-500 border-orange-500/20",
    "Paid": "bg-green-500/10 text-green-500 border-green-500/20",
  };

  const COLORS = ['#5850EC', '#2563EB', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <div className="space-y-6 md:space-y-8 pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Fleet Operations</h1>
          <p className="text-sm text-muted-foreground">Manage shipments and logistics logs</p>
        </div>
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button
              onClick={handleNewTrip}
              disabled={!subscriptionActive}
              title={!subscriptionActive ? subscriptionBlockMessage : "New Trip Entry"}
              className="bg-gradient-primary h-11 px-6 font-bold shadow-lg shadow-indigo-500/20 w-full md:w-auto"
            >
              <Plus className="w-5 h-5 mr-2" /> New Trip Entry
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto bg-card border-l border-border/50">
            <SheetHeader className="pb-6">
              <SheetTitle className="text-2xl font-headline font-bold">
                {editingTrip ? `Edit Trip: ${formData.lrNo || editingTrip.lrNo}` : "New Trip Log"}
              </SheetTitle>
            </SheetHeader>
            <form onSubmit={handleSaveTrip} className="space-y-6 pb-12">
              {editingTrip?.billed && (
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm font-bold text-orange-500">
                  This trip is already billed. Changes may affect existing bill.
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>LR Number</Label>
                  <Input
                    value={formData.lrNo}
                    onChange={e => setFormData({ ...formData, lrNo: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Consignor Party</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!subscriptionActive}
                      className="h-7 px-2 text-xs font-bold"
                      onClick={() => openQuickPartyModal("consignor")}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add Consignor
                    </Button>
                  </div>
                  <Select value={formData.consignorPartyId} onValueChange={val => setFormData({ ...formData, consignorPartyId: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select consignor" />
                    </SelectTrigger>
                    <SelectContent>
                      {consignorParties.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.partyName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Consignee Party</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!subscriptionActive}
                      className="h-7 px-2 text-xs font-bold"
                      onClick={() => openQuickPartyModal("consignee")}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add Consignee
                    </Button>
                  </div>
                  <Select value={formData.consigneePartyId} onValueChange={val => setFormData({ ...formData, consigneePartyId: val, partyId: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select consignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {consigneeParties.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.partyName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Vehicle</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!subscriptionActive}
                    className="h-7 px-2 text-xs font-bold"
                    onClick={() => setIsQuickVehicleOpen(true)}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add Vehicle
                  </Button>
                </div>
                <Select 
                  value={formData.vehicleId} 
                  onValueChange={val => {
                    const v = vehicles.find(v => v.id === val);
                    if (v) {
                      setFormData({ 
                        ...formData, 
                        vehicleId: val, 
                        vehicleNo: normalizeVehicleNo(v.vehicleNo), 
                        vehicleType: normalizeText(v.type),
                        sizeL: v.sizeL || "",
                        sizeW: v.sizeW || "",
                        sizeH: v.sizeH || "",
                      });
                    }
                  }}
                >
                  <SelectTrigger className="bg-secondary/30">
                    <SelectValue placeholder="Select Vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{normalizeVehicleNo(v.vehicleNo)} ({v.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Vehicle Type</Label>
                <Select value={formData.vehicleType} onValueChange={val => setFormData({ ...formData, vehicleType: val })}>
                  <SelectTrigger className="bg-secondary/30">
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.vehicleType && !VEHICLE_TYPE_OPTIONS.includes(formData.vehicleType) && (
                      <SelectItem value={formData.vehicleType}>{formData.vehicleType}</SelectItem>
                    )}
                    <SelectItem value="single axle">Single Axle</SelectItem>
                    <SelectItem value="multi axle">Multi Axle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Driver selection removed from the active trip workflow; legacy Firestore driver fields are left untouched. */}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Length (ft)</Label>
                  <Input type="number" placeholder="L" value={formData.sizeL} onChange={e => setFormData({ ...formData, sizeL: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Width (ft)</Label>
                  <Input type="number" placeholder="W" value={formData.sizeW} onChange={e => setFormData({ ...formData, sizeW: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Height (ft)</Label>
                  <Input type="number" placeholder="H" value={formData.sizeH} onChange={e => setFormData({ ...formData, sizeH: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Packages</Label>
                  <Input type="number" placeholder="Qty" value={formData.packages} onChange={e => setFormData({ ...formData, packages: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Weight (Qtl)</Label>
                  <Input type="number" step="0.01" placeholder="Wt" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Goods Description</Label>
                <Input placeholder="Cement Bags / Iron Rods" value={formData.goodsDescription} onChange={e => setFormData({ ...formData, goodsDescription: e.target.value })} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source (From)</Label>
                  <Input placeholder="City" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Destination (To)</Label>
                  <Input placeholder="City" value={formData.destination} onChange={e => setFormData({ ...formData, destination: e.target.value })} />
                </div>
              </div>



              <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/30 rounded-xl">
                <div className="space-y-2">
                  <Label>Rate (per Qtl)</Label>
                  <Input type="number" value={formData.rateQtl} onChange={e => setFormData({ ...formData, rateQtl: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Unloading</Label>
                  <Input type="number" value={formData.unloadingCharges} onChange={e => setFormData({ ...formData, unloadingCharges: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Advance</Label>
                  <Input type="number" value={formData.advance} onChange={e => setFormData({ ...formData, advance: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>GST By</Label>
                  <Select value={formData.gstPayBy || "blank"} onValueChange={val => setFormData({ ...formData, gstPayBy: val === "blank" ? "" : val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blank">Blank</SelectItem>
                      <SelectItem value="transporter">Transporter</SelectItem>
                      <SelectItem value="consignee">Consignee</SelectItem>
                      <SelectItem value="consignor">Consignor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>Total Bill</span>
                    <span className="text-primary">₹{totals.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg pt-2 border-t font-headline font-bold">
                    <span>Balance Due</span>
                    <span className="text-accent">₹{totals.balance.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" className="w-full h-12 bg-gradient-primary font-bold text-lg">
                {editingTrip ? "Update Entry" : "Save & Generate LR"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <Card
        className={cn(
          "bg-card border-border/50",
          subscriptionStatus === "expired" && "border-destructive/30 bg-destructive/10",
          subscriptionStatus === "expiring_soon" && "border-orange-500/30 bg-orange-500/10"
        )}
      >
        <CardContent className="p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 h-10 w-10 rounded-lg flex items-center justify-center",
                subscriptionStatus === "expired" ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary",
                subscriptionStatus === "expiring_soon" && "bg-orange-500/15 text-orange-500"
              )}
            >
              {subscriptionStatus === "expired" ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <CalendarDays className="h-5 w-5" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline text-lg font-bold">
                  {subscriptionStatus === "expired"
                    ? "Subscription Expired"
                    : subscriptionStatus === "expiring_soon"
                      ? `Your subscription expires in ${daysRemaining ?? 0} days.`
                      : `${currentPlanName} Active`}
                </h2>
                <Badge variant="outline" className={cn("w-fit", subscriptionStatusStyles[subscriptionStatus])}>
                  {subscriptionStatusLabels[subscriptionStatus] || subscriptionStatus}
                </Badge>
              </div>
              {subscriptionStatus === "expired" ? (
                <p className="text-sm font-medium text-destructive">Read-only mode enabled.</p>
              ) : subscriptionStatus === "expiring_soon" ? (
                <p className="text-sm font-medium text-orange-500">Please renew to avoid service interruption.</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Valid Till: {formatDateInputValue(profile?.planExpiryDate) || "Not set"}
                  {daysRemaining !== null ? ` | ${daysRemaining} Days Remaining` : ""}
                </p>
              )}
            </div>
          </div>
          <Link href="/subscription">
            <Button type="button" variant={subscriptionStatus === "active" ? "outline" : "default"} className="w-full md:w-auto font-bold">
              View Subscription
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Dialog open={isQuickPartyOpen} onOpenChange={setIsQuickPartyOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline font-bold">
              Quick Add {quickPartyTarget === "consignor" ? "Consignor" : "Consignee"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveQuickParty} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Party Type</Label>
              <Select value={quickPartyTarget} onValueChange={(value: "consignor" | "consignee") => {
                setQuickPartyTarget(value);
                setQuickPartyData({ ...quickPartyData, partyType: value });
              }}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Select party type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consignor">Consignor</SelectItem>
                  <SelectItem value="consignee">Consignee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Party Name</Label>
              <Input
                value={quickPartyData.partyName}
                onChange={e => setQuickPartyData({ ...quickPartyData, partyName: e.target.value })}
                placeholder="Company / Individual Name"
              />
            </div>
            <div className="space-y-2">
              <Label>GST No</Label>
              <Input
                value={quickPartyData.gstNo}
                onChange={e => setQuickPartyData({ ...quickPartyData, gstNo: e.target.value.toUpperCase() })}
                placeholder="e.g. 07AAAAA0000A1Z5"
              />
            </div>
            <div className="space-y-2">
              <Label>Mobile</Label>
              <Input
                value={quickPartyData.mobile}
                onChange={e => setQuickPartyData({ ...quickPartyData, mobile: e.target.value })}
                placeholder="10 digit mobile"
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <textarea
                className="w-full h-24 p-3 bg-secondary/50 rounded-lg text-sm border focus:ring-primary"
                value={quickPartyData.address}
                onChange={e => setQuickPartyData({ ...quickPartyData, address: e.target.value })}
                placeholder="Street, City, Pin"
              />
            </div>
            <Button type="submit" disabled={savingQuickParty} className="w-full bg-gradient-primary h-11 font-bold">
              {savingQuickParty && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Party
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickVehicleOpen} onOpenChange={setIsQuickVehicleOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border/50 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline font-bold">Quick Add Vehicle</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveQuickVehicle} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vehicle Number</Label>
                <Input
                  required
                  value={quickVehicleData.vehicleNo}
                  onChange={e => setQuickVehicleData({ ...quickVehicleData, vehicleNo: e.target.value.toUpperCase() })}
                  placeholder="e.g. MH 12 AB 1234"
                />
              </div>
              <div className="space-y-2">
                <Label>Vehicle Type</Label>
                <Select value={quickVehicleData.type} onValueChange={value => setQuickVehicleData({ ...quickVehicleData, type: value })}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    {quickVehicleData.type && !VEHICLE_TYPE_OPTIONS.includes(quickVehicleData.type) && (
                      <SelectItem value={quickVehicleData.type}>{quickVehicleData.type}</SelectItem>
                    )}
                    <SelectItem value="single axle">Single Axle</SelectItem>
                    <SelectItem value="multi axle">Multi Axle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Owner Name</Label>
                <Input
                  value={quickVehicleData.ownerName}
                  onChange={e => setQuickVehicleData({ ...quickVehicleData, ownerName: e.target.value })}
                  placeholder="Full Name"
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity (Tons)</Label>
                <Input
                  type="number"
                  value={quickVehicleData.capacity}
                  onChange={e => setQuickVehicleData({ ...quickVehicleData, capacity: e.target.value })}
                  placeholder="e.g. 15"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Size (L x W x H in ft)</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="L" value={quickVehicleData.sizeL} onChange={e => setQuickVehicleData({ ...quickVehicleData, sizeL: e.target.value })} />
                  <Input placeholder="W" value={quickVehicleData.sizeW} onChange={e => setQuickVehicleData({ ...quickVehicleData, sizeW: e.target.value })} />
                  <Input placeholder="H" value={quickVehicleData.sizeH} onChange={e => setQuickVehicleData({ ...quickVehicleData, sizeH: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold border-b border-border/50 pb-2">Documentation Expiry Dates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>RC Expiry</Label>
                  <Input type="date" value={quickVehicleData.rcExpiry} onChange={e => setQuickVehicleData({ ...quickVehicleData, rcExpiry: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Insurance Expiry</Label>
                  <Input type="date" value={quickVehicleData.insuranceExpiry} onChange={e => setQuickVehicleData({ ...quickVehicleData, insuranceExpiry: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Permit Expiry</Label>
                  <Input type="date" value={quickVehicleData.permitExpiry} onChange={e => setQuickVehicleData({ ...quickVehicleData, permitExpiry: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Fitness Expiry</Label>
                  <Input type="date" value={quickVehicleData.fitnessExpiry} onChange={e => setQuickVehicleData({ ...quickVehicleData, fitnessExpiry: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Pollution (PUC) Expiry</Label>
                  <Input type="date" value={quickVehicleData.pollutionExpiry} onChange={e => setQuickVehicleData({ ...quickVehicleData, pollutionExpiry: e.target.value })} />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={savingQuickVehicle} className="w-full bg-gradient-primary h-11 font-bold">
              {savingQuickVehicle && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Vehicle
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPlansOpen} onOpenChange={setIsPlansOpen}>
        <DialogContent className="sm:max-w-5xl bg-card border-border/50 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline font-bold">Subscription Plans</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 py-2">
            {TRANSPORTER_PLANS.map((plan) => {
              const planInfo = PLAN_DEFINITIONS[plan];
              const isCurrent = currentPlan === plan;

              return (
                <div
                  key={plan}
                  className={cn(
                    "rounded-lg border border-border/50 bg-secondary/20 p-4 space-y-4 flex flex-col",
                    plan === "three_months" && "border-primary/60",
                    plan === "six_months" && "border-green-500/50",
                    plan === "yearly" && "border-orange-500/50"
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-headline font-bold text-lg">{planInfo.name}</h3>
                      {planInfo.badge && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                          {planInfo.badge}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <span className="text-3xl font-headline font-bold">₹{planInfo.price}</span>
                      <span className="text-xs text-muted-foreground ml-1">/ {planInfo.durationDays} days</span>
                    </div>
                    {planInfo.discountMessage && (
                      <p className="text-xs font-bold text-green-500">{planInfo.discountMessage}</p>
                    )}
                    {isCurrent && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                        Current Plan
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground flex-1">
                    {SUBSCRIPTION_FEATURES.map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button type="button" onClick={showRenewalMessage} className="w-full bg-gradient-primary font-bold">
                    Contact Admin
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: "Total Shipments", value: stats.totalTrips, icon: Truck, color: "text-primary", sub: "Live Logs" },
          { label: "Gross Revenue", value: `₹${stats.totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-green-500", sub: "Total Freight" },
          { label: "Total Paid", value: `₹${stats.totalPaid.toLocaleString()}`, icon: Receipt, color: "text-indigo-500", sub: "Realized Cash" },
          { label: "Outstanding", value: `₹${stats.totalPending.toLocaleString()}`, icon: Wallet, color: "text-destructive", sub: "Pending Recovery" }
        ].map((stat, i) => (
          <Card key={i} className="bg-card border-border/50 hover:border-primary/50 transition-all group overflow-hidden relative">
            <CardHeader className="p-5 pb-2">
              <div className="flex justify-between items-center mb-1">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</CardTitle>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className={cn("text-3xl font-bold font-headline mb-1", stat.color)}>{stat.value}</div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-bold">
                <ArrowUpRight className="w-3 h-3" /> {stat.sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Revenue Overview</CardTitle>
            <CardDescription>Monthly distribution of freight income</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `₹${val/1000}k`} />
                <ChartTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Party Distribution</CardTitle>
            <CardDescription>Revenue share by top clients</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col items-center">
            <ResponsiveContainer width="100%" height="70%">
              <PieChart>
                <Pie data={partyData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {partyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full space-y-2 mt-4 overflow-y-auto max-h-[80px]">
              {partyData.map((p, i) => (
                <div key={i} className="flex justify-between items-center text-[10px]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="truncate max-w-[100px]">{p.name}</span>
                  </div>
                  <span className="font-bold">₹{p.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border/50">
        <CardHeader className="p-4 md:p-6 border-b border-border/50">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-4 w-full lg:w-auto">
              <CardTitle className="text-xl">Shipment Registry</CardTitle>
              <Tabs defaultValue="all" className="w-full sm:w-auto overflow-x-auto" onValueChange={setFilterStatus}>
                <TabsList className="bg-secondary/50 inline-flex w-auto min-w-full sm:min-w-0">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="Pending">Pending</TabsTrigger>
                  <TabsTrigger value="In Transit">In Transit</TabsTrigger>
                  <TabsTrigger value="Delivered">Delivered</TabsTrigger>
                  <TabsTrigger value="Billed">Billed</TabsTrigger>
                  <TabsTrigger value="Paid">Paid</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Search LR, Party, Vehicle, Route or Bill..." 
                className="pl-10 bg-secondary/30 h-10 border-border/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/30">
                    <TableRow>
                    <SortableTableHead active={tripSort.key === "date"} direction={tripSort.direction} onSort={() => handleTripSort("date")}>Date</SortableTableHead>
                    <SortableTableHead active={tripSort.key === "lrNo"} direction={tripSort.direction} onSort={() => handleTripSort("lrNo")}>LR No</SortableTableHead>
                    <SortableTableHead active={tripSort.key === "consignorName"} direction={tripSort.direction} onSort={() => handleTripSort("consignorName")}>Consignor</SortableTableHead>
                    <SortableTableHead active={tripSort.key === "consigneeName"} direction={tripSort.direction} onSort={() => handleTripSort("consigneeName")}>Consignee</SortableTableHead>
                    <SortableTableHead active={tripSort.key === "status"} direction={tripSort.direction} onSort={() => handleTripSort("status")}>Trip Status</SortableTableHead>
                    <TableHead className="font-bold">Payment</TableHead>
                    <SortableTableHead active={tripSort.key === "vehicleNo"} direction={tripSort.direction} onSort={() => handleTripSort("vehicleNo")}>Vehicle</SortableTableHead>
                    <TableHead className="font-bold">Route</TableHead>
                    <SortableTableHead active={tripSort.key === "totalAmount"} direction={tripSort.direction} onSort={() => handleTripSort("totalAmount")} align="right">Amount</SortableTableHead>
                    <TableHead className="font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTrips.map((trip) => {
                    return (
                      <TableRow key={trip.id} className="hover:bg-secondary/20 group">
                        <TableCell className="text-xs whitespace-nowrap">{trip.date}</TableCell>
                        <TableCell className="font-bold text-primary">
                          <div className="flex flex-col gap-1">
                            <span>{trip.lrNo}</span>
                            {trip.hasPOD ? (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 w-fit bg-green-500/10 text-green-500 border-green-500/20">
                                POD Uploaded
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 w-fit bg-slate-500/10 text-slate-500 border-slate-500/20">
                                No POD
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium truncate max-w-[140px]">{getTripConsignorName(trip)}</TableCell>
                        <TableCell className="font-medium truncate max-w-[140px]">{getTripConsigneeName(trip)}</TableCell>
                        <TableCell>
                          <Select 
                            value={trip.status || "Pending"} 
                            onValueChange={(val) => handleUpdateStatus(trip.id, val)}
                            disabled={!subscriptionActive}
                          >
                            <SelectTrigger className={cn("h-7 text-[10px] font-bold px-2", statusColors[trip.status || "Pending"])}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pending">Pending</SelectItem>
                              <SelectItem value="In Transit">In Transit</SelectItem>
                              <SelectItem value="Delivered">Delivered</SelectItem>
                              <SelectItem value="Billed">Billed</SelectItem>
                              <SelectItem value="Paid">Paid</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[10px] px-1 py-0 h-5 w-fit",
                                trip.paymentStatus === "Paid" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                trip.paymentStatus === "Partial" ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                                "bg-destructive/10 text-destructive border-destructive/20"
                              )}
                            >
                              {trip.paymentStatus || "Unpaid"}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">₹{trip.paidAmount || 0} / ₹{trip.totalAmount}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{normalizeVehicleNo(trip.vehicleNo)}</TableCell>
                        <TableCell className="text-xs">{trip.source} → {trip.destination}</TableCell>
                        <TableCell className="text-right font-bold">₹{Number(trip.totalAmount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-primary" 
                              title="Files / POD"
                              onClick={() => {
                                setSelectedTripForFiles(trip);
                                setIsFilesModalOpen(true);
                              }}
                            >
                              <Paperclip className="w-4 h-4" />
                            </Button>

                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-indigo-500" 
                              title="Record Payment"
                              disabled={!subscriptionActive}
                              onClick={() => {
                                if (guardEditAction()) return;
                                setSelectedTripForPayment(trip);
                                setIsPaymentModalOpen(true);
                              }}
                            >
                              <Wallet className="w-4 h-4" />
                            </Button>

                            <Link href={`/lr-receipt-preview?id=${trip.id}`}>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500" title="View LR">
                                <FileText className="w-4 h-4" />
                              </Button>
                            </Link>
                            
                            {trip.billed && trip.invoiceId && (
                              <Link href={`/invoice-preview?id=${trip.invoiceId}`}>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-accent" title="View Bill">
                                  <Receipt className="w-4 h-4" />
                                </Button>
                              </Link>
                            )}

                            <Button size="icon" variant="ghost" onClick={() => handleEditTrip(trip)} disabled={!subscriptionActive} className="h-8 w-8 text-blue-500" title={!subscriptionActive ? subscriptionBlockMessage : "Edit"}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            {!trip.billed && (
                              <Button size="icon" variant="ghost" onClick={() => setTripToDelete(trip)} disabled={!subscriptionActive} className="h-8 w-8 text-destructive" title={!subscriptionActive ? subscriptionBlockMessage : "Delete"}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
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

      <AlertDialog open={!!tripToDelete} onOpenChange={(open) => !open && setTripToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Delete shipment <span className="font-bold text-foreground">{tripToDelete?.lrNo}</span>? 
              This will remove all associated financial data permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTrip} disabled={!subscriptionActive} className="bg-destructive hover:bg-destructive/90 text-white">
                Delete Shipment
              </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Record Payment Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline font-bold flex items-center gap-2">
              <Wallet className="w-6 h-6 text-primary" /> Record Payment
            </DialogTitle>
            <CardDescription>
              Trip: {selectedTripForPayment?.lrNo} | Consignee: {getTripConsigneeName(selectedTripForPayment)}
            </CardDescription>
          </DialogHeader>
          <form onSubmit={handleRecordPayment} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4 bg-secondary/30 p-4 rounded-xl mb-4">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Bill</span>
                <p className="text-lg font-bold">₹{selectedTripForPayment?.totalAmount}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Already Paid</span>
                <p className="text-lg font-bold text-green-500">₹{selectedTripForPayment?.paidAmount || 0}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Amount (Received Now)</Label>
              <Input 
                type="number" 
                required 
                placeholder="e.g. 5000" 
                value={paymentData.paidAmount}
                onChange={e => setPaymentData({ ...paymentData, paidAmount: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input 
                  type="date" 
                  required 
                  value={paymentData.paymentDate}
                  onChange={e => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={paymentData.paymentMode} onValueChange={val => setPaymentData({ ...paymentData, paymentMode: val })}>
                  <SelectTrigger className="bg-secondary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (Reference No, etc.)</Label>
              <textarea 
                className="w-full h-20 p-3 bg-secondary/30 rounded-lg text-sm border focus:ring-primary"
                value={paymentData.paymentNotes}
                onChange={e => setPaymentData({ ...paymentData, paymentNotes: e.target.value })}
                placeholder="Transaction ID or Cheque details..."
              />
            </div>

            <Button type="submit" disabled={!subscriptionActive} className="w-full bg-gradient-primary h-12 font-bold text-lg shadow-lg">
              Confirm Payment
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Trip Files / POD Modal */}
      <TripFilesModal 
        open={isFilesModalOpen} 
        onOpenChange={setIsFilesModalOpen} 
        trip={selectedTripForFiles} 
      />
    </div>
  );
}
