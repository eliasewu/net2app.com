import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Save, Mail, Image, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

// Helper: get/set SystemSettings by key
function useSettingValue(key) {
  const { data: settings = [] } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => base44.entities.SystemSettings.list(),
    initialData: [],
  });
  return settings.find(s => s.setting_key === key)?.setting_value || '';
}

export default function TenantSettings({ tenantId }) {
  const qc = useQueryClient();
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const prefix = tenantId ? `tenant_${tenantId}` : 'global';

  const { data: settings = [] } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => base44.entities.SystemSettings.list(),
    initialData: [],
  });

  useEffect(() => {
    const get = (key) => settings.find(s => s.setting_key === `smtp_${key}_${prefix}`)?.setting_value || '';
    setSmtpHost(get('host'));
    setSmtpPort(get('port') || '587');
    setSmtpUser(get('user'));
    setSmtpPass(get('pass'));
    setSmtpFrom(get('from'));
    const logoSetting = settings.find(s => s.setting_key === `logo_url_${prefix}`)?.setting_value || '';
    setLogoUrl(logoSetting);
  }, [settings, prefix]);

  const saveSetting = useMutation({
    mutationFn: async ({ key, value, category = 'smtp' }) => {
      const existing = settings.find(s => s.setting_key === key);
      if (existing) {
        return base44.entities.SystemSettings.update(existing.id, { setting_value: value });
      } else {
        return base44.entities.SystemSettings.create({ setting_key: key, setting_value: value, category, description: `Tenant ${tenantId} setting` });
      }
    },
  });

  const handleSaveSmtp = async () => {
    setSaving(true);
    const pairs = [
      { key: `smtp_host_${prefix}`, value: smtpHost },
      { key: `smtp_port_${prefix}`, value: smtpPort },
      { key: `smtp_user_${prefix}`, value: smtpUser },
      { key: `smtp_pass_${prefix}`, value: smtpPass },
      { key: `smtp_from_${prefix}`, value: smtpFrom },
    ];
    for (const p of pairs) {
      await saveSetting.mutateAsync({ key: p.key, value: p.value, category: 'smtp' });
    }
    qc.invalidateQueries({ queryKey: ['system-settings'] });
    toast.success("SMTP settings saved");
    setSaving(false);
  };

  const handleTestEmail = async () => {
    if (!testEmail) { toast.error("Enter test recipient email"); return; }
    setTesting(true);
    await base44.integrations.Core.SendEmail({
      to: testEmail,
      subject: 'Net2app SMTP Test',
      body: `<p>SMTP is configured correctly for tenant: <strong>${tenantId}</strong>.<br>Sent at: ${new Date().toISOString()}</p>`,
    });
    toast.success(`Test email sent to ${testEmail}`);
    setTesting(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setLogoUrl(file_url);
    await saveSetting.mutateAsync({ key: `logo_url_${prefix}`, value: file_url, category: 'system' });
    qc.invalidateQueries({ queryKey: ['system-settings'] });
    toast.success("Logo uploaded and saved");
    setUploadingLogo(false);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="smtp">
        <TabsList>
          <TabsTrigger value="smtp"><Mail className="w-3.5 h-3.5 mr-1.5" />SMTP Settings</TabsTrigger>
          <TabsTrigger value="branding"><Image className="w-3.5 h-3.5 mr-1.5" />Logo & Branding</TabsTrigger>
        </TabsList>

        <TabsContent value="smtp" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Email / SMTP Configuration</CardTitle>
              <p className="text-xs text-muted-foreground">Used for rate card emails, invoices, and notifications sent from this account.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>SMTP Host</Label>
                  <Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Port</Label>
                  <Input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" />
                </div>
                <div className="space-y-1.5">
                  <Label>Username / Email</Label>
                  <Input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="admin@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Password / App Password</Label>
                  <div className="relative">
                    <Input type={showPass ? 'text' : 'password'} value={smtpPass} onChange={e => setSmtpPass(e.target.value)} />
                    <button className="absolute right-2 top-2 text-muted-foreground" onClick={() => setShowPass(p => !p)}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>From Address (display name)</Label>
                  <Input value={smtpFrom} onChange={e => setSmtpFrom(e.target.value)} placeholder="Company Name <admin@company.com>" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveSmtp} disabled={saving} className="gap-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save SMTP
                </Button>
              </div>
              <div className="border-t pt-3 space-y-2">
                <Label className="text-xs text-muted-foreground">Test SMTP</Label>
                <div className="flex gap-2">
                  <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com" className="max-w-xs" />
                  <Button variant="outline" size="sm" onClick={handleTestEmail} disabled={testing} className="gap-1">
                    {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}Send Test
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Logo & Branding</CardTitle>
              <p className="text-xs text-muted-foreground">Logo appears on invoices, rate card emails, and the tenant portal header.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {logoUrl && (
                <div className="p-3 bg-muted/40 rounded-lg border flex items-center gap-4">
                  <img src={logoUrl} alt="Logo" className="h-16 object-contain rounded" />
                  <div>
                    <p className="text-xs font-medium">Current Logo</p>
                    <p className="text-xs text-muted-foreground break-all">{logoUrl}</p>
                    <Badge variant="outline" className="mt-1 bg-green-50 text-green-700 border-green-200 text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" />Active
                    </Badge>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Upload Logo (PNG/JPG/SVG, max 2MB)</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Button variant="outline" className="gap-1" disabled={uploadingLogo} asChild>
                    <span>
                      {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                      {uploadingLogo ? 'Uploading...' : 'Choose Logo'}
                    </span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
              </div>
              <div className="space-y-2">
                <Label>Or paste logo URL</Label>
                <div className="flex gap-2">
                  <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://cdn.example.com/logo.png" />
                  <Button variant="outline" size="sm" onClick={async () => {
                    await saveSetting.mutateAsync({ key: `logo_url_${prefix}`, value: logoUrl, category: 'system' });
                    qc.invalidateQueries({ queryKey: ['system-settings'] });
                    toast.success("Logo URL saved");
                  }}>Save</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}