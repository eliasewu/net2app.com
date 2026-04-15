import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, FolderOpen, Upload, Play, Trash2, Pencil, Music, Globe } from "lucide-react";
import { toast } from "sonner";

// All characters that need audio files
const DIGIT_CHARS = ["0","1","2","3","4","5","6","7","8","9"];
const ALPHA_CHARS = "abcdefghijklmnopqrstuvwxyz".split("");
const SPECIAL_CHARS = [
  { value: "greeting", label: "Greeting" },
  { value: "intro", label: "Intro / Welcome" },
  { value: "otp_prompt", label: "OTP Prompt (\"Your OTP is...\")" },
  { value: "please_wait", label: "Please Wait" },
  { value: "goodbye", label: "Goodbye" },
];
const ALL_CHARS = [
  ...DIGIT_CHARS.map(c => ({ value: c, label: `Digit: ${c}`, group: "digits" })),
  ...ALPHA_CHARS.map(c => ({ value: c, label: `Letter: ${c.toUpperCase()}`, group: "alpha" })),
  ...SPECIAL_CHARS.map(c => ({ ...c, group: "special" })),
];

export default function VoiceAudioLibrary() {
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [folderForm, setFolderForm] = useState({ name: "", language_code: "", country: "", is_default_english: false, description: "", status: "active" });
  const [uploadForm, setUploadForm] = useState({ character: "greeting", label: "", file_type: "mp3" });
  const [uploading, setUploading] = useState(false);
  const [playingUrl, setPlayingUrl] = useState(null);
  const fileRef = useRef();
  const audioRef = useRef(null);
  const qc = useQueryClient();

  const { data: folders = [] } = useQuery({ queryKey: ["voice-folders"], queryFn: () => base44.entities.VoiceAudioFolder.list("-created_date"), initialData: [] });
  const { data: audioFiles = [] } = useQuery({ queryKey: ["voice-audio-files"], queryFn: () => base44.entities.VoiceAudioFile.list("-created_date", 500), initialData: [] });

  const createFolder = useMutation({
    mutationFn: d => base44.entities.VoiceAudioFolder.create(d),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["voice-folders"] }); setFolderDialogOpen(false); setSelectedFolder(res); toast.success("Folder created"); }
  });
  const deleteFolder = useMutation({
    mutationFn: id => base44.entities.VoiceAudioFolder.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["voice-folders"] }); setSelectedFolder(null); toast.success("Folder deleted"); }
  });
  const deleteFile = useMutation({
    mutationFn: id => base44.entities.VoiceAudioFile.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["voice-audio-files"] }); toast.success("File deleted"); }
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedFolder) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const charMeta = ALL_CHARS.find(c => c.value === uploadForm.character);
    await base44.entities.VoiceAudioFile.create({
      folder_id: selectedFolder.id,
      folder_name: selectedFolder.name,
      character: uploadForm.character,
      label: uploadForm.label || charMeta?.label || uploadForm.character,
      file_url,
      file_type: file.name.endsWith(".wav") ? "wav" : "mp3",
      status: "active"
    });
    qc.invalidateQueries({ queryKey: ["voice-audio-files"] });
    setUploading(false);
    setUploadDialogOpen(false);
    toast.success(`Audio file uploaded for "${uploadForm.character}"`);
    e.target.value = "";
  };

  const playAudio = (url) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playingUrl === url) { setPlayingUrl(null); return; }
    const audio = new Audio(url);
    audio.play();
    audioRef.current = audio;
    setPlayingUrl(url);
    audio.onended = () => setPlayingUrl(null);
  };

  const folderFiles = selectedFolder ? audioFiles.filter(f => f.folder_id === selectedFolder.id) : [];
  const uploadedChars = new Set(folderFiles.map(f => f.character));

  const setFF = (k, v) => setFolderForm(p => ({ ...p, [k]: v }));
  const setUF = (k, v) => setUploadForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Folder list */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Language Folders</CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setFolderForm({ name: "", language_code: "", country: "", is_default_english: false, description: "", status: "active" }); setFolderDialogOpen(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1" />New Folder
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {folders.map(f => {
              const count = audioFiles.filter(a => a.folder_id === f.id).length;
              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFolder(f)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${selectedFolder?.id === f.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50"}`}
                >
                  <FolderOpen className={`w-5 h-5 shrink-0 ${f.is_default_english ? "text-blue-500" : "text-yellow-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{f.language_code} · {count} files</p>
                  </div>
                  {f.is_default_english && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200"><Globe className="w-2.5 h-2.5 mr-1" />EN</Badge>}
                </div>
              );
            })}
            {folders.length === 0 && <p className="text-center text-muted-foreground text-sm py-6">No folders yet</p>}
          </CardContent>
        </Card>

        {/* Right: File grid */}
        <div className="lg:col-span-2">
          {!selectedFolder ? (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-16">
                <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Select a language folder to view audio files</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-yellow-500" />{selectedFolder.name}
                    {selectedFolder.is_default_english && <Badge className="bg-blue-100 text-blue-700 text-xs">Default English</Badge>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{folderFiles.length} / {ALL_CHARS.length} files uploaded</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { setUploadForm({ character: "greeting", label: "", file_type: "mp3" }); setUploadDialogOpen(true); }}>
                    <Upload className="w-3.5 h-3.5 mr-1" />Upload Audio
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteFolder.mutate(selectedFolder.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {/* Progress */}
                <div className="mb-4 p-3 bg-muted/40 rounded-lg">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Upload progress</span>
                    <span>{folderFiles.length}/{ALL_CHARS.length}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(folderFiles.length / ALL_CHARS.length) * 100}%` }} />
                  </div>
                </div>

                {/* Special chars */}
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Special Prompts</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {SPECIAL_CHARS.map(c => {
                    const file = folderFiles.find(f => f.character === c.value);
                    return (
                      <div key={c.value} className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1.5 ${file ? "border-green-200 bg-green-50" : "border-dashed border-muted-foreground/30"}`}>
                        <span className="font-medium truncate">{c.label}</span>
                        {file ? (
                          <div className="flex gap-1">
                            <button onClick={() => playAudio(file.file_url)} className={`p-1 rounded ${playingUrl === file.file_url ? "bg-primary text-white" : "bg-muted hover:bg-muted/70"}`}><Play className="w-3 h-3" /></button>
                            <button onClick={() => deleteFile.mutate(file.id)} className="p-1 rounded bg-red-50 hover:bg-red-100"><Trash2 className="w-3 h-3 text-red-500" /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setUploadForm({ character: c.value, label: c.label, file_type: "mp3" }); setUploadDialogOpen(true); }} className="text-primary hover:underline">Upload</button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Digits 0-9 */}
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Digits (0–9)</p>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 mb-4">
                  {DIGIT_CHARS.map(c => {
                    const file = folderFiles.find(f => f.character === c);
                    return (
                      <div key={c} className={`p-2 rounded-lg border text-center flex flex-col items-center gap-1 ${file ? "border-green-200 bg-green-50" : "border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary"}`}
                        onClick={!file ? () => { setUploadForm({ character: c, label: `Digit ${c}`, file_type: "mp3" }); setUploadDialogOpen(true); } : undefined}>
                        <span className="text-lg font-bold">{c}</span>
                        {file ? (
                          <div className="flex gap-0.5">
                            <button onClick={e => { e.stopPropagation(); playAudio(file.file_url); }} className={`p-0.5 rounded ${playingUrl === file.file_url ? "bg-primary text-white" : "bg-muted"}`}><Play className="w-2.5 h-2.5" /></button>
                            <button onClick={e => { e.stopPropagation(); deleteFile.mutate(file.id); }} className="p-0.5 rounded bg-red-50"><Trash2 className="w-2.5 h-2.5 text-red-500" /></button>
                          </div>
                        ) : <Music className="w-3 h-3 text-muted-foreground/40" />}
                      </div>
                    );
                  })}
                </div>

                {/* A-Z */}
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Letters (A–Z)</p>
                <div className="grid grid-cols-6 sm:grid-cols-13 gap-1.5" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
                  {ALPHA_CHARS.map(c => {
                    const file = folderFiles.find(f => f.character === c);
                    return (
                      <div key={c} className={`p-2 rounded-lg border text-center flex flex-col items-center gap-1 ${file ? "border-green-200 bg-green-50" : "border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary"}`}
                        onClick={!file ? () => { setUploadForm({ character: c, label: `Letter ${c.toUpperCase()}`, file_type: "mp3" }); setUploadDialogOpen(true); } : undefined}>
                        <span className="text-sm font-bold uppercase">{c}</span>
                        {file ? (
                          <div className="flex gap-0.5">
                            <button onClick={e => { e.stopPropagation(); playAudio(file.file_url); }} className={`p-0.5 rounded ${playingUrl === file.file_url ? "bg-primary text-white" : "bg-muted"}`}><Play className="w-2.5 h-2.5" /></button>
                            <button onClick={e => { e.stopPropagation(); deleteFile.mutate(file.id); }} className="p-0.5 rounded bg-red-50"><Trash2 className="w-2.5 h-2.5 text-red-500" /></button>
                          </div>
                        ) : <Music className="w-2.5 h-2.5 text-muted-foreground/40" />}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Language Folder</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Folder Name *</Label><Input value={folderForm.name} onChange={e => setFF("name", e.target.value)} placeholder="e.g. Bengali, Arabic, English" /></div>
            <div className="space-y-1"><Label>Language Code *</Label><Input value={folderForm.language_code} onChange={e => setFF("language_code", e.target.value)} placeholder="e.g. bn, ar, en, hi" /></div>
            <div className="space-y-1"><Label>Country</Label><Input value={folderForm.country} onChange={e => setFF("country", e.target.value)} placeholder="Bangladesh, Saudi Arabia..." /></div>
            <div className="space-y-1"><Label>Description</Label><Input value={folderForm.description} onChange={e => setFF("description", e.target.value)} /></div>
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Switch checked={folderForm.is_default_english} onCheckedChange={v => setFF("is_default_english", v)} />
              <div>
                <Label className="cursor-pointer">Set as Default English Folder</Label>
                <p className="text-xs text-muted-foreground">Used as the secondary language for all destinations</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createFolder.mutate(folderForm)} disabled={!folderForm.name || !folderForm.language_code}>Create Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Audio Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload Audio File — {selectedFolder?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Character / Prompt *</Label>
              <Select value={uploadForm.character} onValueChange={v => setUF("character", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null} disabled>— Special Prompts —</SelectItem>
                  {SPECIAL_CHARS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  <SelectItem value={null} disabled>— Digits —</SelectItem>
                  {DIGIT_CHARS.map(c => <SelectItem key={c} value={c}>Digit: {c}</SelectItem>)}
                  <SelectItem value={null} disabled>— Letters —</SelectItem>
                  {ALPHA_CHARS.map(c => <SelectItem key={c} value={c}>Letter: {c.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Label (optional)</Label><Input value={uploadForm.label} onChange={e => setUF("label", e.target.value)} /></div>
            <div className="border-2 border-dashed rounded-xl p-6 text-center space-y-2">
              <Music className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium">MP3 or WAV file</p>
              <Button variant="outline" onClick={() => fileRef.current.click()} disabled={uploading}>
                <Upload className="w-4 h-4 mr-2" />{uploading ? "Uploading..." : "Choose File"}
              </Button>
              <input ref={fileRef} type="file" accept=".mp3,.wav,.ogg" className="hidden" onChange={handleFileUpload} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}