import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Upload, Image, Package, Newspaper, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function LandingAdmin() {
  return (
    <div className="space-y-4">
      <PageHeader title="Landing Page Manager" description="Manage public website packages, gallery, and news/events">
        <a href="/" target="_blank" rel="noreferrer">
          <Button size="sm" variant="outline" className="gap-1"><ExternalLink className="w-3.5 h-3.5" />View Site</Button>
        </a>
      </PageHeader>
      <Tabs defaultValue="packages">
        <TabsList>
          <TabsTrigger value="packages"><Package className="w-3.5 h-3.5 mr-1.5" />Packages</TabsTrigger>
          <TabsTrigger value="gallery"><Image className="w-3.5 h-3.5 mr-1.5" />Gallery & Banners</TabsTrigger>
          <TabsTrigger value="updates"><Newspaper className="w-3.5 h-3.5 mr-1.5" />News & Events</TabsTrigger>
        </TabsList>
        <TabsContent value="packages" className="mt-4"><PackagesManager /></TabsContent>
        <TabsContent value="gallery" className="mt-4"><GalleryManager /></TabsContent>
        <TabsContent value="updates" className="mt-4"><UpdatesManager /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Packages Manager ──────────────────────────────────────────────────────────
function PackagesManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const blank = { title: "", category: "sms", price: "", currency: "USD", price_unit: "/month", features: "", badge_text: "", highlight: false, is_active: true, sort_order: 0 };
  const [form, setForm] = useState(blank);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const { data: packages = [] } = useQuery({ queryKey: ["landing-packages-admin"], queryFn: () => base44.entities.LandingPackage.list("sort_order", 100), initialData: [] });
  const createMut = useMutation({ mutationFn: d => base44.entities.LandingPackage.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["landing-packages-admin"] }); qc.invalidateQueries({ queryKey: ["landing-packages"] }); toast.success("Package added"); setOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }) => base44.entities.LandingPackage.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["landing-packages-admin"] }); qc.invalidateQueries({ queryKey: ["landing-packages"] }); toast.success("Updated"); setOpen(false); } });
  const deleteMut = useMutation({ mutationFn: id => base44.entities.LandingPackage.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["landing-packages-admin"] }); qc.invalidateQueries({ queryKey: ["landing-packages"] }); toast.success("Deleted"); } });

  const openNew = () => { setEditing(null); setForm(blank); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...p, features: Array.isArray(p.features) ? p.features.join("\n") : ((() => { try { return JSON.parse(p.features || "[]").join("\n"); } catch { return p.features || ""; } })()) }); setOpen(true); };

  const save = () => {
    const featArr = form.features.split("\n").map(s => s.trim()).filter(Boolean);
    const data = { ...form, price: parseFloat(form.price) || 0, features: JSON.stringify(featArr) };
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const CATS = [["sms", "SMS Package"], ["voip", "VoIP Platform"], ["tenant", "Tenant Package"], ["voice_route", "Voice Routes"], ["custom", "Custom"]];

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />Add Package</Button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map(p => (
          <Card key={p.id} className={`border-2 ${p.highlight ? "border-blue-400" : "border-gray-100"}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge className="text-[10px] mb-1">{p.category}</Badge>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-muted-foreground">{p.currency} {p.price} {p.price_unit}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteMut.mutate(p.id)} className="p-1.5 hover:bg-muted rounded"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                </div>
              </div>
              {!p.is_active && <Badge variant="outline" className="text-[10px] mt-2 text-red-500 border-red-300">Hidden</Badge>}
            </CardContent>
          </Card>
        ))}
        {packages.length === 0 && <p className="text-muted-foreground text-sm col-span-3 py-8 text-center">No packages yet. Add your first package.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Package" : "Add Package"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="col-span-2 space-y-1"><Label>Title</Label><Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Business SMS 10M" /></div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => set("currency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["USD","EUR","GBP","AED"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Price (0 = hidden)</Label><Input type="number" value={form.price} onChange={e => set("price", e.target.value)} /></div>
            <div className="space-y-1"><Label>Price Unit</Label><Input value={form.price_unit} onChange={e => set("price_unit", e.target.value)} placeholder="/month" /></div>
            <div className="col-span-2 space-y-1">
              <Label>Features (one per line)</Label>
              <textarea className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={form.features} onChange={e => set("features", e.target.value)} placeholder="5 Million SMS/month&#10;SMPP & HTTP API&#10;DLR Tracking" />
            </div>
            <div className="space-y-1"><Label>Badge Text</Label><Input value={form.badge_text} onChange={e => set("badge_text", e.target.value)} placeholder="Most Popular" /></div>
            <div className="space-y-1"><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => set("sort_order", parseInt(e.target.value) || 0)} /></div>
            <div className="flex items-center gap-2 col-span-1">
              <Switch checked={!!form.highlight} onCheckedChange={v => set("highlight", v)} /><Label>Featured / Highlighted</Label>
            </div>
            <div className="flex items-center gap-2 col-span-1">
              <Switch checked={!!form.is_active} onCheckedChange={v => set("is_active", v)} /><Label>Active (visible)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Gallery Manager ───────────────────────────────────────────────────────────
function GalleryManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const blank = { image_url: "", caption: "", category: "gallery", event_date: "", is_active: true, sort_order: 0 };
  const [form, setForm] = useState(blank);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const { data: items = [] } = useQuery({ queryKey: ["landing-gallery-admin"], queryFn: () => base44.entities.LandingGallery.list("sort_order", 100), initialData: [] });
  const createMut = useMutation({ mutationFn: d => base44.entities.LandingGallery.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["landing-gallery-admin"] }); qc.invalidateQueries({ queryKey: ["landing-gallery"] }); toast.success("Added"); setOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }) => base44.entities.LandingGallery.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["landing-gallery-admin"] }); qc.invalidateQueries({ queryKey: ["landing-gallery"] }); toast.success("Updated"); setOpen(false); } });
  const deleteMut = useMutation({ mutationFn: id => base44.entities.LandingGallery.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["landing-gallery-admin"] }); qc.invalidateQueries({ queryKey: ["landing-gallery"] }); toast.success("Deleted"); } });

  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set("image_url", file_url);
    setUploading(false);
  };

  const save = () => {
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
  };

  const CATS = [["banner", "Hero Banner"], ["gallery", "Gallery Photo"], ["event", "Event Photo"], ["news", "News Image"]];

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button size="sm" onClick={() => { setEditing(null); setForm(blank); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Add Image</Button></div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(item => (
          <div key={item.id} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
            <img src={item.image_url} alt={item.caption || ""} className="w-full aspect-square object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
              <Badge className="text-[10px]">{item.category}</Badge>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(item); setForm({ ...item }); setOpen(true); }} className="p-1.5 bg-white rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => deleteMut.mutate(item.id)} className="p-1.5 bg-white rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
              </div>
            </div>
            {!item.is_active && <div className="absolute top-2 left-2"><Badge variant="outline" className="text-[10px] bg-white text-red-500 border-red-300">Hidden</Badge></div>}
          </div>
        ))}
        {items.length === 0 && <p className="text-muted-foreground text-sm col-span-4 py-8 text-center">No images yet.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Image" : "Add Image"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Image</Label>
              {form.image_url && <img src={form.image_url} className="w-full max-h-40 object-cover rounded-lg mb-2" alt="" />}
              <div className="flex gap-2">
                <Input value={form.image_url} onChange={e => set("image_url", e.target.value)} placeholder="https://... or upload" />
                <Button variant="outline" size="sm" onClick={() => fileRef.current.click()} disabled={uploading}>
                  <Upload className="w-3.5 h-3.5" />
                </Button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              {uploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
            </div>
            <div className="space-y-1"><Label>Caption</Label><Input value={form.caption} onChange={e => set("caption", e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Event Date (optional)</Label><Input type="date" value={form.event_date} onChange={e => set("event_date", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => set("sort_order", parseInt(e.target.value) || 0)} /></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={!!form.is_active} onCheckedChange={v => set("is_active", v)} /><Label>Active</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Updates/News Manager ──────────────────────────────────────────────────────
function UpdatesManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const blank = { title: "", body: "", category: "news", event_date: "", is_active: true, sort_order: 0 };
  const [form, setForm] = useState(blank);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const { data: items = [] } = useQuery({ queryKey: ["landing-updates-admin"], queryFn: () => base44.entities.LandingUpdate.list("sort_order", 100), initialData: [] });
  const createMut = useMutation({ mutationFn: d => base44.entities.LandingUpdate.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["landing-updates-admin"] }); qc.invalidateQueries({ queryKey: ["landing-updates"] }); toast.success("Added"); setOpen(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }) => base44.entities.LandingUpdate.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["landing-updates-admin"] }); qc.invalidateQueries({ queryKey: ["landing-updates"] }); toast.success("Updated"); setOpen(false); } });
  const deleteMut = useMutation({ mutationFn: id => base44.entities.LandingUpdate.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["landing-updates-admin"] }); qc.invalidateQueries({ queryKey: ["landing-updates"] }); toast.success("Deleted"); } });

  const CATS = [["news", "News"], ["event", "Event"], ["offer", "Offer"], ["maintenance", "Maintenance"]];
  const BORDER_COLORS = { news: "border-l-blue-500", event: "border-l-purple-500", offer: "border-l-green-500", maintenance: "border-l-yellow-500" };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button size="sm" onClick={() => { setEditing(null); setForm(blank); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Add Update</Button></div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className={`border-l-4 ${BORDER_COLORS[item.category] || "border-l-gray-300"} bg-muted/30 rounded-r-lg p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="text-[10px] capitalize">{item.category}</Badge>
                  {item.event_date && <span className="text-xs text-muted-foreground">{item.event_date}</span>}
                  {!item.is_active && <Badge variant="outline" className="text-[10px] text-red-500 border-red-300">Hidden</Badge>}
                </div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(item); setForm({ ...item }); setOpen(true); }} className="p-1.5 hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => deleteMut.mutate(item.id)} className="p-1.5 hover:bg-muted rounded"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-muted-foreground text-sm py-8 text-center">No updates yet.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Update" : "Add Update"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={e => set("title", e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Body</Label>
              <textarea className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={form.body} onChange={e => set("body", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Event Date (optional)</Label><Input type="date" value={form.event_date} onChange={e => set("event_date", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => set("sort_order", parseInt(e.target.value) || 0)} /></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={!!form.is_active} onCheckedChange={v => set("is_active", v)} /><Label>Active</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { editing ? updateMut.mutate({ id: editing.id, data: form }) : createMut.mutate(form); }}>{editing ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}