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
import { Plus, Edit, Trash2, Users, Search, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MobileDataCard, MobileDataCards, MobileDataField } from "@/components/ui/mobile-data-card";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import {
  isValidMobile,
  nextSortDirection,
  normalizeGstNo,
  normalizeMultiline,
  normalizeText,
  sortRows,
  type SortConfig,
} from "@/lib/transport-utils";
import { getSubscriptionBlockMessage, isSubscriptionActive } from "@/lib/account-utils";
import { subscribeToOwnedCollection } from "@/lib/firestore-query-utils";

type PartySortKey = "createdAt" | "partyType" | "partyName" | "gstNo" | "mobile";

const PARTY_TYPE_OPTIONS = [
  { value: "consignor", label: "Consignor" },
  { value: "consignee", label: "Consignee" },
];

const getPartyType = (party: any) => party?.partyType === "consignor" ? "consignor" : "consignee";
const getPartyTypeLabel = (party: any) => getPartyType(party) === "consignor" ? "Consignor" : "Consignee";
const getPartyTypeBadgeClass = (party: any) =>
  getPartyType(party) === "consignor"
    ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
    : "bg-green-500/10 text-green-500 border-green-500/20";

export default function PartiesPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [partySort, setPartySort] = useState<SortConfig<PartySortKey>>({ key: "createdAt", direction: "desc" });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<any>(null);
  const [formData, setFormData] = useState({
    partyType: "consignee",
    partyName: "",
    gstNo: "",
    mobile: "",
    address: ""
  });
  const subscriptionActive = isSubscriptionActive(profile);
  const subscriptionBlockMessage = getSubscriptionBlockMessage(profile);

  const resetForm = () => {
    setEditingParty(null);
    setFormData({ partyType: "consignee", partyName: "", gstNo: "", mobile: "", address: "" });
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

  useEffect(() => {
    if (!profile) return;
    const unsubscribe = subscribeToOwnedCollection(
      db,
      "parties",
      profile,
      [],
      (rows) => {
        setParties(rows);
        setLoading(false);
      },
      () => {
        const permissionError = new FirestorePermissionError({
          path: 'parties',
          operation: 'list',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (guardSubscriptionAction()) return;

    const partyData = {
      partyType: normalizeText(formData.partyType) || "consignee",
      partyName: normalizeText(formData.partyName),
      gstNo: normalizeGstNo(formData.gstNo),
      mobile: normalizeText(formData.mobile),
      address: normalizeMultiline(formData.address),
    };

    if (!["consignor", "consignee"].includes(partyData.partyType)) {
      toast({ title: "Validation Error", description: "Party type is required.", variant: "destructive" });
      return;
    }
    if (!partyData.partyName) {
      toast({ title: "Validation Error", description: "Party name is required.", variant: "destructive" });
      return;
    }
    if (!isValidMobile(partyData.mobile)) {
      toast({ title: "Validation Error", description: "Mobile number must be exactly 10 digits.", variant: "destructive" });
      return;
    }
    
    try {
      if (editingParty) {
        const partyRef = doc(db, "parties", editingParty.id);
        await updateDoc(partyRef, {
          ...partyData,
          updatedAt: serverTimestamp()
        }).catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: partyRef.path,
            operation: 'update',
            requestResourceData: partyData,
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
          throw error;
        });
        toast({ title: "Updated", description: "Party details updated." });
      } else {
        const partiesCollection = collection(db, "parties");
        const data = {
          ...partyData,
          companyId: profile.companyId,
          userId: profile.uid,
          createdAt: serverTimestamp()
        };
        await addDoc(partiesCollection, data).catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: 'parties',
            operation: 'create',
            requestResourceData: data,
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
          throw error;
        });
        toast({ title: "Success", description: "New party added." });
      }
      setIsDialogOpen(false);
      setEditingParty(null);
      setFormData({ partyType: "consignee", partyName: "", gstNo: "", mobile: "", address: "" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (guardSubscriptionAction()) return;
    if (confirm("Delete this party?")) {
      const partyRef = doc(db, "parties", id);
      deleteDoc(partyRef).catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: partyRef.path,
          operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      });
      toast({ title: "Deleted", description: "Party removed." });
    }
  };

  const handlePartySort = (key: PartySortKey) => {
    setPartySort((current) => ({
      key,
      direction: nextSortDirection(current, key),
    }));
  };

  const filteredParties = parties.filter(p => {
    const queryText = search.toLowerCase();
    return (
      (p.partyName || "").toLowerCase().includes(queryText) || 
      getPartyTypeLabel(p).toLowerCase().includes(queryText) ||
      (p.gstNo || "").toLowerCase().includes(queryText) ||
      (p.mobile || "").toLowerCase().includes(queryText)
    );
  });

  const sortedParties = useMemo(() => sortRows(filteredParties, partySort, {
    createdAt: (party) => party.createdAt || party.updatedAt,
    partyType: (party) => getPartyType(party),
    partyName: (party) => party.partyName,
    gstNo: (party) => party.gstNo,
    mobile: (party) => party.mobile,
  }), [filteredParties, partySort]);

  const openEditParty = (party: any) => {
    setEditingParty(party);
    setFormData({
      partyType: getPartyType(party),
      partyName: party.partyName || "",
      gstNo: party.gstNo || "",
      mobile: party.mobile || "",
      address: party.address || "",
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Parties Management</h1>
          <p className="text-muted-foreground">Manage your clients and their GST details</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={resetForm}
              disabled={!subscriptionActive}
              title={!subscriptionActive ? subscriptionBlockMessage : "Add New Party"}
              className="bg-gradient-primary h-11 px-6 font-bold"
            >
              <Plus className="w-5 h-5 mr-2" /> Add New Party
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card border-border/50">
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline font-bold">{editingParty ? "Edit Party" : "Add Party"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Party Type</Label>
                <Select value={formData.partyType} onValueChange={value => setFormData({ ...formData, partyType: value })}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Select party type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTY_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Party Name</Label>
                <Input required value={formData.partyName} onChange={e => setFormData({ ...formData, partyName: e.target.value })} placeholder="Company / Individual Name" />
              </div>
              <div className="space-y-2">
                <Label>GST Number</Label>
                <Input value={formData.gstNo} onChange={e => setFormData({ ...formData, gstNo: e.target.value.toUpperCase() })} placeholder="e.g. 07AAAAA0000A1Z5" />
              </div>
              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <Input value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: e.target.value })} placeholder="Contact Phone" />
              </div>
              <div className="space-y-2">
                <Label>Full Address</Label>
                <textarea 
                  className="w-full h-24 p-3 bg-secondary/50 rounded-lg text-sm border focus:ring-primary"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, City, Pin"
                />
              </div>
              <Button type="submit" className="w-full bg-gradient-primary h-12 font-bold text-lg">
                {editingParty ? "Update Party" : "Create Party"}
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
              placeholder="Search by party name or GST..." 
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
          ) : filteredParties.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
              <Users className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold">No parties found.</p>
              <p className="text-sm">Click "Add New Party" to get started.</p>
            </div>
          ) : (
            <>
              <MobileDataCards>
                {sortedParties.map((party) => (
                  <MobileDataCard
                    key={party.id}
                    title={party.partyName || "Unnamed Party"}
                    titleClassName="text-primary"
                    subtitle={party.mobile || "Mobile not added"}
                    badge={(
                      <Badge variant="outline" className={getPartyTypeBadgeClass(party)}>
                        {getPartyTypeLabel(party)}
                      </Badge>
                    )}
                    actions={(
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          disabled={!subscriptionActive}
                          title={!subscriptionActive ? subscriptionBlockMessage : "Edit"}
                          onClick={() => openEditParty(party)}
                        >
                          <Edit className="mr-2 h-4 w-4 text-blue-500" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          disabled={!subscriptionActive}
                          title={!subscriptionActive ? subscriptionBlockMessage : "Delete"}
                          onClick={() => handleDelete(party.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Delete
                        </Button>
                      </>
                    )}
                  >
                    <MobileDataField label="GST No" value={party.gstNo ? <span className="font-mono text-xs">{party.gstNo}</span> : undefined} />
                    <MobileDataField label="Mobile" value={party.mobile} />
                    <MobileDataField
                      label="Address"
                      value={party.address ? <span className="whitespace-pre-wrap">{party.address}</span> : undefined}
                      className="sm:col-span-2"
                    />
                  </MobileDataCard>
                ))}
              </MobileDataCards>

              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow>
                      <SortableTableHead active={partySort.key === "partyType"} direction={partySort.direction} onSort={() => handlePartySort("partyType")}>Party Type</SortableTableHead>
                      <SortableTableHead active={partySort.key === "partyName"} direction={partySort.direction} onSort={() => handlePartySort("partyName")}>Party Name</SortableTableHead>
                      <SortableTableHead active={partySort.key === "gstNo"} direction={partySort.direction} onSort={() => handlePartySort("gstNo")}>GST No</SortableTableHead>
                      <SortableTableHead active={partySort.key === "mobile"} direction={partySort.direction} onSort={() => handlePartySort("mobile")}>Mobile</SortableTableHead>
                      <TableHead className="font-bold">Address</TableHead>
                      <TableHead className="font-bold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedParties.map((party) => (
                      <TableRow key={party.id} className="hover:bg-secondary/30 transition-colors">
                        <TableCell>
                          <Badge variant="outline" className={getPartyTypeBadgeClass(party)}>
                            {getPartyTypeLabel(party)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-primary">{party.partyName}</TableCell>
                        <TableCell className="text-sm font-mono">{party.gstNo || "N/A"}</TableCell>
                        <TableCell className="text-sm">{party.mobile || "N/A"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{party.address || "N/A"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="icon" variant="ghost" className="text-blue-500" disabled={!subscriptionActive} title={!subscriptionActive ? subscriptionBlockMessage : "Edit"} onClick={() => openEditParty(party)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="text-destructive" disabled={!subscriptionActive} title={!subscriptionActive ? subscriptionBlockMessage : "Delete"} onClick={() => handleDelete(party.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
