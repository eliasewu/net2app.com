import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Upload, Play, FileText, RefreshCw, Hash } from "lucide-react";
import { toast } from "sonner";
import OtpUnicodePresets from "@/components/content/OtpUnicodePresets";

// ── OTP Numeric → Unicode Digit Replacement (Python _replace equivalent) ─────
// Each digit 0-9 maps to multiple Unicode lookalikes; one index is chosen randomly
// per message (same index for all digits, like Python: _index = randrange(0, len(...)))
const DIGIT_REPLACE = {
  "0": ['𝟘','０','𝟬','𝟶','₀','⁰','₀','🄋','🄌','🄋','🄌','０','౦','0️⃣'],
  "1": ['𝟙','𝟣','𝟭','𝟷','１','₁','¹','①','❶','➀','➊','⑴','🄂','1️⃣'],
  "2": ['𝟚','𝟤','𝟮','𝟸','２','₂','²','②','❷','➁','➋','⑵','🄃','2️⃣'],
  "3": ['𝟛','𝟥','𝟯','𝟹','３','₃','³','③','❸','➂','➌','⑶','🄄','3️⃣'],
  "4": ['𝟜','𝟦','𝟰','𝟺','４','₄','⁴','④','❹','➃','➍','⑷','🄅','4️⃣'],
  "5": ['𝟝','𝟧','𝟱','𝟻','５','⒌','⁵','➄','➎','➄','➎','⑸','𝟓','5️⃣'],
  "6": ['𝟞','𝟨','𝟲','𝟼','６','⒍','⁶','⑥','❻','➅','➏','⑹','🄇','6️⃣'],
  "7": ['𝟟','𝟩','𝟳','𝟽','７','₇','⁷','⑦','❼','➆','➐','⑺','🄈','7️⃣'],
  "8": ['𝟠','𝟪','𝟴','𝟾','８','₈','⁸','⑧','❽','➇','➑','⑻','🄉','8️⃣'],
  "9": ['𝟡','𝟫','𝟵','𝟿','９','₉','⁹','⑨','❾','➈','➒','⑼','🄊','9️⃣'],
};

// Apply same-index replacement across all digits in the text (mimics Python _index = randrange(...))
function applyDigitUnicode(text, fixedIndex = null) {
  const idx = fixedIndex !== null ? fixedIndex : Math.floor(Math.random() * DIGIT_REPLACE["0"].length);
  return text.replace(/[0-9]/g, d => DIGIT_REPLACE[d][idx % DIGIT_REPLACE[d].length]);
}

// Legacy padding (kept for reference)
function applyUnicodePadding(text, padCount = 10) {
  const UNICODE_ZERO = '\u200B';
  return text.replace(/([0-9])/g, (match, digit) => {
    const d = parseInt(digit);
    const count = d === 0 ? padCount : d;
    return digit + UNICODE_ZERO.repeat(count);
  });
}

// ── Body Translation: "Your code is XXXXXXX" → random variant from template ──
function applyBodyTranslation(originalBody, translationRules) {
  if (!translationRules || translationRules.length === 0) return originalBody;
  
  // Extract OTP/code from original (any 4-8 digit sequence)
  const codeMatch = originalBody.match(/\b(\d{4,8})\b/);
  const otpCode = codeMatch ? codeMatch[1] : '';
  
  for (const rule of translationRules) {
    if (!rule.match_pattern || !rule.templates || rule.templates.length === 0) continue;
    const regex = new RegExp(rule.match_pattern, 'i');
    if (regex.test(originalBody)) {
      const templates = rule.templates;
      const chosen = templates[Math.floor(Math.random() * templates.length)];
      // Replace {{otp}}, {{code}}, {{OTP}}, XXXXXX with actual code
      return chosen
        .replace(/\{\{otp\}\}/gi, otpCode)
        .replace(/\{\{code\}\}/gi, otpCode)
        .replace(/X{4,8}/g, otpCode)
        .replace(/\d{4,8}/, otpCode);
    }
  }
  return originalBody;
}

export default function ContentTemplates() {
  const [tab, setTab] = useState("templates");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transDialogOpen, setTransDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingTrans, setEditingTrans] = useState(null);
  const [form, setForm] = useState({ name: '', destination_prefix: '', contents: '', sender_ids: '', is_random: true, client_id: '', status: 'active' });
  const [transForm, setTransForm] = useState({ name: '', match_pattern: '', templates_json: '', type: 'sms', caller_rule: '', callee_rule: '' });
  const [testInput, setTestInput] = useState('Your code is 123456');
  const [testOutput, setTestOutput] = useState('');
  const [unicodePad, setUnicodePad] = useState(10);
  const [unicodeTestInput, setUnicodeTestInput] = useState('Your OTP is 0');
  const [unicodeTestOutput, setUnicodeTestOutput] = useState('');
  // OTP digit unicode replacement state
  const [otpInput, setOtpInput] = useState('Your OTP is 123456');
  const [otpOutputs, setOtpOutputs] = useState([]);
  const [otpCustomMap, setOtpCustomMap] = useState(
    Object.entries(DIGIT_REPLACE).map(([digit, variants]) => ({ digit, variants: variants.join('\n') }))
  );
  const xlsxRef = useRef();
  const qc = useQueryClient();

  const { data: templates = [] } = useQuery({ queryKey: ['content-templates'], queryFn: () => base44.entities.ContentTemplate.list('-created_date'), initialData: [] });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list(), initialData: [] });

  // Body Translation rules stored in ContentTemplate with destination_prefix = '__body_trans__'
  const bodyTransRules = templates.filter(t => t.destination_prefix === '__body_trans__');
  const regularTemplates = templates.filter(t => t.destination_prefix !== '__body_trans__');

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.ContentTemplate.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['content-templates'] }); setDialogOpen(false); setTransDialogOpen(false); toast.success("Saved"); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContentTemplate.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['content-templates'] }); setDialogOpen(false); setTransDialogOpen(false); toast.success("Updated"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ContentTemplate.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['content-templates'] }); toast.success("Deleted"); },
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setT = (k, v) => setTransForm(p => ({ ...p, [k]: v }));

  // Test body translation
  const runBodyTest = () => {
    const rules = bodyTransRules.map(r => {
      let templates = [];
      try { templates = JSON.parse(r.contents || '[]'); } catch {}
      return { match_pattern: r.name, templates };
    });
    const result = applyBodyTranslation(testInput, rules);
    setTestOutput(result);
  };

  // Test unicode padding
  const runUnicodeTest = () => {
    setUnicodeTestOutput(applyUnicodePadding(unicodeTestInput, unicodePad));
    toast.success(`Unicode padding applied (pad=${unicodePad})`);
  };

  // Save body translation rule
  const saveTransRule = () => {
    if (!transForm.match_pattern) { toast.error("Pattern required"); return; }
    let templates = [];
    try { templates = JSON.parse(transForm.templates_json || '[]'); } catch { toast.error("Templates must be valid JSON array"); return; }
    const data = {
      name: transForm.match_pattern, // use pattern as name for lookup
      destination_prefix: '__body_trans__',
      contents: JSON.stringify(templates),
      sender_ids: JSON.stringify({ caller: transForm.caller_rule, callee: transForm.callee_rule }),
      is_random: true,
      status: 'active',
    };
    if (editingTrans) updateMut.mutate({ id: editingTrans.id, data });
    else createMut.mutate(data);
  };

  // Excel upload for body translation templates
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    toast.info("Parsing Excel/CSV...");
    const text = await file.text();
    const lines = text.trim().split('\n').filter(l => l.trim());
    const templates = lines.map(l => l.split(',')[0]?.trim()).filter(Boolean);
    setTransForm(p => ({ ...p, templates_json: JSON.stringify(templates, null, 2) }));
    toast.success(`Loaded ${templates.length} template variants`);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Content Modification" description="Random content rotation, Unicode digit padding, body/voice translation rules">
        <Button onClick={() => { setEditing(null); setForm({ name: '', destination_prefix: '', contents: '', sender_ids: '', is_random: true, client_id: '', status: 'active' }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add Template
        </Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="templates">Random Content / SID</TabsTrigger>
          <TabsTrigger value="otp_unicode"><Hash className="w-3 h-3 mr-1" />OTP Digit Unicode</TabsTrigger>
          <TabsTrigger value="otp_presets"><Hash className="w-3 h-3 mr-1" />OTP Presets (DB)</TabsTrigger>
          <TabsTrigger value="unicode">Unicode Padding</TabsTrigger>
          <TabsTrigger value="body_trans">Body Translation</TabsTrigger>
          <TabsTrigger value="voice_trans">Voice Translation</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Random Content Templates ───────────────────────── */}
        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Random</TableHead>
                    <TableHead>Contents</TableHead>
                    <TableHead>Sender IDs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regularTemplates.map((t) => {
                    let contentCount = 0, senderCount = 0;
                    try { contentCount = JSON.parse(t.contents || '[]').length; } catch {}
                    try { senderCount = JSON.parse(t.sender_ids || '[]').length; } catch {}
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="font-mono">{t.destination_prefix}</TableCell>
                        <TableCell>{t.is_random ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{contentCount} variants</TableCell>
                        <TableCell>{senderCount} IDs</TableCell>
                        <TableCell><StatusBadge status={t.status} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setForm(t); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {regularTemplates.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">No content templates</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: OTP Digit Unicode Replacement ───────────────────── */}
        <TabsContent value="otp_unicode" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Hash className="w-4 h-4" />OTP Numeric → Unicode Digit Replacement</CardTitle>
              <p className="text-xs text-muted-foreground">
                Replaces each digit 0–9 in OTP/SMS with a visually identical Unicode lookalike.<br />
                One random index is selected per message and applied consistently to all digits (same style throughout).<br />
                Equivalent to the Python <code className="bg-muted px-1 rounded">_replace</code> table with <code className="bg-muted px-1 rounded">_index = randrange(0, len(...))</code>.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Test area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Input SMS (with digits)</Label>
                  <Textarea value={otpInput} onChange={e => setOtpInput(e.target.value)} rows={3} placeholder="Your OTP is 123456" />
                  <Button onClick={() => {
                    const samples = Array.from({ length: 8 }, (_, i) => ({
                      index: i,
                      text: applyDigitUnicode(otpInput, i)
                    }));
                    setOtpOutputs(samples);
                  }} className="gap-1 w-full"><Play className="w-4 h-4" />Generate 8 Variants (one per index)</Button>
                </div>
                <div className="space-y-2">
                  <Label>Output Variants (each message picks one randomly)</Label>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {otpOutputs.map((o, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-green-50 border border-green-200 rounded text-sm font-mono">
                        <span className="text-xs text-green-600 shrink-0 font-bold">#{o.index}</span>
                        <span className="break-all">{o.text}</span>
                      </div>
                    ))}
                    {otpOutputs.length === 0 && <div className="p-4 text-center text-muted-foreground text-xs">Click "Generate" to see variants</div>}
                  </div>
                </div>
              </div>

              {/* Digit mapping table */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Digit → Unicode Variant Map (14 variants per digit)</Label>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted">
                        <th className="p-2 border text-left w-12">Digit</th>
                        <th className="p-2 border text-left">Unicode Variants (one chosen per message)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(DIGIT_REPLACE).map(([digit, variants]) => (
                        <tr key={digit} className="hover:bg-accent/30">
                          <td className="p-2 border font-bold text-center text-lg">{digit}</td>
                          <td className="p-2 border">
                            <div className="flex flex-wrap gap-2">
                              {variants.map((v, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-base" title={`Index ${i}`}>
                                  {v}
                                  <span className="text-[9px] text-blue-400">#{i}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 space-y-1">
                <p className="font-bold">How it works:</p>
                <p>• Input: <code className="bg-blue-100 px-1 rounded">Your OTP is 12345</code></p>
                <p>• Random index (e.g. 3) picked once per message.</p>
                <p>• All digits replaced using that index: 1→𝟷, 2→𝟸, 3→𝟹, 4→𝟺, 5→𝟻</p>
                <p>• Output: <code className="bg-blue-100 px-1 rounded">Your OTP is 𝟷𝟸𝟹𝟺𝟻</code></p>
                <p>• Visually identical to humans, bypasses plain-text firewall digit matching.</p>
                <p>• With 14 variants per digit, there are 14 possible output styles per message.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: OTP Presets (saved to DB) ────────────────────────── */}
        <TabsContent value="otp_presets" className="mt-4">
          <OtpUnicodePresets />
        </TabsContent>

        {/* ── Tab 3: Unicode Zero Padding ────────────────────────────── */}
        <TabsContent value="unicode" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Unicode Digit Padding</CardTitle>
              <p className="text-xs text-muted-foreground">
                Inserts invisible Unicode zero-width characters after each digit to make SMS content unique.<br />
                Digit <strong>0</strong> → pad with N invisible chars (configurable 10 or 20).<br />
                Digit <strong>1–9</strong> → pad with (digit × 2) invisible chars.<br />
                Visually identical to recipient, but each message has unique byte fingerprint.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Zero-digit pad count</Label>
                  <Select value={String(unicodePad)} onValueChange={v => setUnicodePad(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 chars (standard)</SelectItem>
                      <SelectItem value="20">20 chars (heavy)</SelectItem>
                      <SelectItem value="5">5 chars (light)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Test Input (write SMS with digits)</Label>
                <Textarea value={unicodeTestInput} onChange={e => setUnicodeTestInput(e.target.value)} rows={3} placeholder="Your OTP is 0" />
              </div>
              <Button onClick={runUnicodeTest} className="gap-1"><Play className="w-4 h-4" />Apply Unicode Padding</Button>
              {unicodeTestOutput && (
                <div className="space-y-1">
                  <Label>Output (looks same but has invisible chars)</Label>
                  <div className="p-3 bg-green-50 border border-green-200 rounded font-mono text-sm break-all">{unicodeTestOutput}</div>
                  <p className="text-xs text-muted-foreground">Byte length: {new TextEncoder().encode(unicodeTestInput).length} → {new TextEncoder().encode(unicodeTestOutput).length} bytes</p>
                </div>
              )}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 space-y-1">
                <p className="font-bold">How it works at runtime:</p>
                <p>• Each outbound SMS passes through the content modifier before sending.</p>
                <p>• Digit "0" in message → 0 + {unicodePad}× U+200B (zero-width space).</p>
                <p>• Digit "5" → 5 + 10× U+200B. Digit "9" → 9 + 18× U+200B.</p>
                <p>• Result: each SMS is byte-unique even if body text is identical → bypasses duplicate detection.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Body Translation ────────────────────────────────── */}
        <TabsContent value="body_trans" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">SMS Body Translation Rules</h3>
              <p className="text-xs text-muted-foreground">
                Pattern match incoming SMS body → replace with random template variant. OTP code preserved automatically.<br />
                Example: "your code is 123456" → "Your verification code is 123456" or "OTP: 123456" or any of 100 variants.
              </p>
            </div>
            <Button size="sm" onClick={() => { setEditingTrans(null); setTransForm({ name: '', match_pattern: '', templates_json: '[]', type: 'sms', caller_rule: '', callee_rule: '' }); setTransDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />Add Rule
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match Pattern (regex)</TableHead>
                    <TableHead>Template Variants</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bodyTransRules.map(r => {
                    let count = 0;
                    try { count = JSON.parse(r.contents || '[]').length; } catch {}
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.name}</TableCell>
                        <TableCell><Badge variant="outline">{count} variants</Badge></TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => {
                              setEditingTrans(r);
                              let templates = [];
                              try { templates = JSON.parse(r.contents || '[]'); } catch {}
                              setTransForm({ match_pattern: r.name, templates_json: JSON.stringify(templates, null, 2), type: 'sms', caller_rule: '', callee_rule: '' });
                              setTransDialogOpen(true);
                            }}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {bodyTransRules.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No body translation rules. Add one to start replacing SMS bodies.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Test panel */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Test Body Translation</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Incoming SMS body</Label>
                <Textarea value={testInput} onChange={e => setTestInput(e.target.value)} rows={2} placeholder="your code is 123456" />
              </div>
              <Button size="sm" onClick={runBodyTest} className="gap-1"><Play className="w-4 h-4" />Translate</Button>
              {testOutput && (
                <div className="space-y-1">
                  <Label>Translated Output</Label>
                  <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">{testOutput}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Voice Translation ──────────────────────────────── */}
        <TabsContent value="voice_trans" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Voice Caller/Callee Translation</CardTitle>
              <p className="text-xs text-muted-foreground">
                Modify caller ID (ANI) and callee number (DNIS) for outbound/inbound calls. OTP body stays same — only caller/callee numbers are modified.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Caller (ANI) translation rule</Label>
                  <Input placeholder="e.g. replace prefix 880 → +880" />
                  <p className="text-xs text-muted-foreground">Use Number Translation page for detailed prefix rules</p>
                </div>
                <div className="space-y-2">
                  <Label>Callee (DNIS) translation rule</Label>
                  <Input placeholder="e.g. strip leading 0, add +91" />
                </div>
              </div>
              <div className="p-3 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800 space-y-1">
                <p className="font-bold">Voice Translation Notes:</p>
                <p>• For Voice OTP: only caller ID and callee number are modified. The OTP content (spoken digits) is NOT changed.</p>
                <p>• Use <strong>Number Translation</strong> page for full prefix/suffix manipulation rules.</p>
                <p>• Asterisk dialplan handles caller/callee modification via Set(CALLERID) and Dial() target.</p>
                <p>• Example: Incoming ANI "009xxxxxxx" → strip "00" → add "+" → deliver as "+9xxxxxxx".</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add/Edit Template Dialog ─────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Template' : 'Add Template'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="space-y-2"><Label>Destination Prefix *</Label><Input value={form.destination_prefix} onChange={(e) => set('destination_prefix', e.target.value)} placeholder="880, 91, 44" /></div>
            <div className="space-y-2">
              <Label>Client (Optional)</Label>
              <Select value={form.client_id || ''} onValueChange={(v) => set('client_id', v)}>
                <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content Variants (JSON Array)</Label>
              <Textarea value={form.contents} onChange={(e) => set('contents', e.target.value)}
                placeholder='["Hello {{name}}, your OTP is {{otp}}", "Hi {{name}}, code: {{otp}}"]' rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Sender IDs (JSON Array)</Label>
              <Textarea value={form.sender_ids} onChange={(e) => set('sender_ids', e.target.value)}
                placeholder='["SenderA", "SenderB", "SenderC"]' rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_random} onCheckedChange={(v) => set('is_random', v)} />
              <Label>Random rotation</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (editing) updateMut.mutate({ id: editing.id, data: form }); else createMut.mutate(form); }}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Body Translation Rule Dialog ──────────────────── */}
      <Dialog open={transDialogOpen} onOpenChange={setTransDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTrans ? 'Edit Body Translation Rule' : 'Add Body Translation Rule'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Match Pattern (regex) *</Label>
              <Input value={transForm.match_pattern} onChange={e => setT('match_pattern', e.target.value)}
                placeholder="your.code.is|verification code|OTP" />
              <p className="text-xs text-muted-foreground">Regex pattern to match incoming SMS body. Case-insensitive.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Template Variants (JSON Array of 100 bodies)</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => xlsxRef.current.click()}>
                    <Upload className="w-3 h-3" />Import from Excel/CSV
                  </Button>
                  <input ref={xlsxRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={handleExcelUpload} />
                </div>
              </div>
              <Textarea
                value={transForm.templates_json}
                onChange={e => setT('templates_json', e.target.value)}
                rows={8}
                placeholder={`[\n  "Your verification code is {{otp}}",\n  "OTP: {{otp}} — do not share",\n  "Use {{otp}} to verify your account"\n]`}
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{"{{otp}}"}</code> or <code className="bg-muted px-1 rounded">{"{{code}}"}</code> as placeholder. Original OTP digits auto-extracted and injected.
                Upload Excel/CSV with one template per row (first column).
              </p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
              <p className="font-bold">Example:</p>
              <p>Incoming: <em>"your code is 123456"</em></p>
              <p>→ Randomly picks one template, injects OTP "123456"</p>
              <p>→ Output: <em>"Your verification code is 123456"</em> or <em>"OTP: 123456 — do not share"</em> etc.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveTransRule}>{editingTrans ? 'Update Rule' : 'Save Rule'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}