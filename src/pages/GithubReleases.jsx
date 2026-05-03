import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import PageHeader from "@/components/shared/PageHeader";
import { GitBranch, Tag, Plus, Trash2, ExternalLink, RefreshCw, Package, Upload } from "lucide-react";
import DeployScriptViewer from "@/components/github/DeployScriptViewer";
import { buildDeployScript } from "@/lib/deployScriptBuilder";
import { format } from "date-fns";
import { toast } from "sonner";

const invoke = (action, payload = {}) =>
  base44.functions.invoke("githubRelease", { action, ...payload });

export default function GithubReleases() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ tag: "", name: "", body: "", draft: false, prerelease: false });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const { data: releasesData, isLoading, refetch } = useQuery({
    queryKey: ["github-releases"],
    queryFn: () => invoke("list"),
    refetchInterval: 60000,
  });
  const { data: tagsData } = useQuery({
    queryKey: ["github-tags"],
    queryFn: () => invoke("tags"),
  });

  const releases = releasesData?.data?.releases || [];
  const tags = tagsData?.data?.tags || [];

  const createMut = useMutation({
    mutationFn: (payload) => invoke("create", payload),
    onSuccess: (res) => {
      const d = res.data;
      if (d.status >= 400 || d.release?.errors) {
        toast.error(d.release?.message || "Failed to create release");
      } else {
        toast.success(`Release ${form.tag} created!`);
        setDialogOpen(false);
        setForm({ tag: "", name: "", body: "", draft: false, prerelease: false });
        qc.invalidateQueries({ queryKey: ["github-releases"] });
        qc.invalidateQueries({ queryKey: ["github-tags"] });
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (release_id) => invoke("delete", { release_id }),
    onSuccess: () => {
      toast.success("Release deleted");
      qc.invalidateQueries({ queryKey: ["github-releases"] });
    },
  });

  const pushDeployMut = useMutation({
    mutationFn: async () => {
      // 1. Get existing file SHA (needed for update)
      const fileRes = await invoke("get_file", { path: "deploy.sh" });
      const sha = fileRes?.data?.sha || null;
      // 2. Generate latest deploy.sh content
      const content = buildDeployScript({
        dbRootPass: "RootPass@2025!",
        dbAppUser: "net2app",
        dbAppPass: "Net2App@2025!",
        dbName: "net2app",
        kannelPass: "kannel_admin_2025",
        apiToken: "net2app_api_token_2025",
        appId: "",
        appBaseUrl: "https://api.base44.com",
        funcVersion: "v3",
      });
      // 3. Push to GitHub
      return invoke("push_file", {
        path: "deploy.sh",
        content,
        message: `Update deploy.sh — ${new Date().toISOString()}`,
        sha,
      });
    },
    onSuccess: (res) => {
      if (res?.data?.ok === false || res?.data?.status >= 400) {
        toast.error("Push failed: " + (res?.data?.data?.message || "Unknown error"));
      } else {
        toast.success("deploy.sh pushed to GitHub successfully!");
      }
    },
    onError: (e) => toast.error("Push failed: " + e.message),
  });

  const handleCreate = () => {
    if (!form.tag) return toast.error("Tag is required");
    createMut.mutate(form);
  };

  const statusBadge = (r) => {
    if (r.draft) return <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-300">Draft</Badge>;
    if (r.prerelease) return <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">Pre-release</Badge>;
    return <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">Released</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="GitHub Releases" description="eliasewu/net2app.com — manage release tags and push deploy.sh">
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </Button>
        <Button
          variant="outline" size="sm"
          onClick={() => pushDeployMut.mutate()}
          disabled={pushDeployMut.isPending}
          className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
        >
          <Upload className="w-3.5 h-3.5" />
          {pushDeployMut.isPending ? "Pushing..." : "Push deploy.sh"}
        </Button>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />New Release
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200"><Package className="w-4 h-4 text-blue-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Releases</p>
              <p className="text-2xl font-bold">{releases.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 border border-green-200"><Tag className="w-4 h-4 text-green-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Tags</p>
              <p className="text-2xl font-bold">{tags.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 border border-purple-200"><GitBranch className="w-4 h-4 text-purple-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Latest</p>
              <p className="text-sm font-bold truncate">{releases[0]?.tag_name || "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Releases table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Releases</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading releases...</div>
          ) : releases.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No releases found. Create your first release above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Tag</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Name</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Author</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Published</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {releases.map((r, i) => (
                    <tr key={r.id} className={`border-b hover:bg-accent/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="p-3">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">{r.tag_name}</span>
                      </td>
                      <td className="p-3 font-medium">{r.name || r.tag_name}</td>
                      <td className="p-3">{statusBadge(r)}</td>
                      <td className="p-3 text-xs text-muted-foreground">{r.author?.login || "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {r.published_at ? format(new Date(r.published_at), "dd MMM yyyy HH:mm") : "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1.5">
                          <a href={r.html_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                              <ExternalLink className="w-3 h-3" />View
                            </Button>
                          </a>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 text-xs text-destructive hover:bg-red-50"
                            onClick={() => deleteMut.mutate(r.id)}
                            disabled={deleteMut.isPending}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deploy Script */}
      <DeployScriptViewer />

      {/* Tags list */}
      {tags.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Tag className="w-4 h-4" />All Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tags.map(t => (
                <span key={t.name} className="font-mono text-xs bg-muted border border-border px-2 py-1 rounded">{t.name}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Release Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create New Release</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Tag Name <span className="text-destructive">*</span></Label>
              <Input placeholder="v1.0.0" value={form.tag} onChange={e => set("tag", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Release Title</Label>
              <Input placeholder="Release v1.0.0" value={form.name} onChange={e => set("name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Release Notes / Changelog</Label>
              <textarea
                className="w-full border border-input rounded-md px-3 py-2 text-sm min-h-[100px] bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="What's new in this release..."
                value={form.body}
                onChange={e => set("body", e.target.value)}
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.draft} onCheckedChange={v => set("draft", v)} id="draft" />
                <Label htmlFor="draft">Draft</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.prerelease} onCheckedChange={v => set("prerelease", v)} id="prerelease" />
                <Label htmlFor="prerelease">Pre-release</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? "Creating..." : "Create Release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}