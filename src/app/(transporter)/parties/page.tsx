"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Plus, Edit, Trash2, Users, Search, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export default function PartiesPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<any>(null);
  const [formData, setFormData] = useState({
    partyName: "",
    gstNo: "",
    mobile: "",
    address: ""
  });

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, "parties"), where("userId", "==", profile.uid));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        setParties(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      async (serverError) => {
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
    
    try {
      if (editingParty) {
        const partyRef = doc(db, "parties", editingParty.id);
        updateDoc(partyRef, {
          ...formData,
          updatedAt: serverTimestamp()
        }).catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: partyRef.path,
            operation: 'update',
            requestResourceData: formData,
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
        });
        toast({ title: "Updated", description: "Party details updated." });
      } else {
        const partiesCollection = collection(db, "parties");
        const data = {
          ...formData,
          userId: profile.uid,
          createdAt: serverTimestamp()
        };
        addDoc(partiesCollection, data).catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: 'parties',
            operation: 'create',
            requestResourceData: data,
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
        });
        toast({ title: "Success", description: "New party added." });
      }
      setIsDialogOpen(false);
      setEditingParty(null);
      setFormData({ partyName: "", gstNo: "", mobile: "", address: "" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
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

  const filteredParties = parties.filter(p => 
    p.partyName.toLowerCase().includes(search.toLowerCase()) || 
    p.gstNo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Parties Management</h1>
          <p className="text-muted-foreground">Manage your clients and their GST details</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingParty(null); setFormData({ partyName: "", gstNo: "", mobile: "", address: "" }); }} className="bg-gradient-primary h-11 px-6 font-bold">
              <Plus className="w-5 h-5 mr-2" /> Add New Party
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card border-border/50">
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline font-bold">{editingParty ? "Edit Party" : "Add Party"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Party Name</Label>
                <Input required value={formData.partyName} onChange={e => setFormData({ ...formData, partyName: e.target.value })} placeholder="Company / Individual Name" />
              </div>
              <div className="space-y-2">
                <Label>GST Number</Label>
                <Input value={formData.gstNo} onChange={e => setFormData({ ...formData, gstNo: e.target.value })} placeholder="e.g. 07AAAAA0000A1Z5" />
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
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow>
                  <TableHead className="font-bold">Party Name</TableHead>
                  <TableHead className="font-bold">GST No</TableHead>
                  <TableHead className="font-bold">Mobile</TableHead>
                  <TableHead className="font-bold">Address</TableHead>
                  <TableHead className="font-bold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParties.map((party) => (
                  <TableRow key={party.id} className="hover:bg-secondary/30 transition-colors">
                    <TableCell className="font-bold text-primary">{party.partyName}</TableCell>
                    <TableCell className="text-sm font-mono">{party.gstNo || "N/A"}</TableCell>
                    <TableCell className="text-sm">{party.mobile || "N/A"}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{party.address || "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="icon" variant="ghost" className="text-blue-500" onClick={() => { setEditingParty(party); setFormData({ partyName: party.partyName, gstNo: party.gstNo, mobile: party.mobile, address: party.address }); setIsDialogOpen(true); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(party.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
