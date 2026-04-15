import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Save, Mail, MessageSquare, Database, Server } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const qc = useQueryClient();
  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.SystemSettings.list(),
    initialData: [],
  });

  const getSetting = (key) => settings.find(s => s.setting_key === key)?.setting_value || '';

  const [smtp, setSmtp] = useState({});
  const [telegram, setTelegram] = useState({});
  const [notifConfig, setNotifConfig] = useState({});
  const [kannel, setKannel] = useState({});
  const [backup, setBackup] = useState({});

  useEffect(() => {
    if (settings.length > 0) {
      setSmtp({
        host: getSetting('smtp_host'),
        port: getSetting('smtp_port'),
        username: getSetting('smtp_username'),
        password: getSetting('smtp_password'),
        from_email: getSetting('smtp_from_email'),
        tls: getSetting('smtp_tls') === 'true',
      });
      setTelegram({
        bot_token: getSetting('telegram_bot_token'),
        chat_id: getSetting('telegram_chat_id'),
        enabled: getSetting('telegram_enabled') === 'true',
      });
      setNotifConfig({
        sms_fail: getSetting('notif_sms_fail') !== 'false',
        route_blocked: getSetting('notif_route_blocked') !== 'false',
        offline: getSetting('notif_offline') !== 'false',
        backup: getSetting('notif_backup') !== 'false',
      });
      setKannel({
        host: getSetting('kannel_host'),
        admin_port: getSetting('kannel_admin_port'),
        smsbox_port: getSetting('kannel_smsbox_port'),
        password: getSetting('kannel_password'),
      });
      setBackup({
        enabled: getSetting('backup_enabled') !== 'false',
        time: getSetting('backup_time') || '03:00',
        retention: getSetting('backup_retention') || '30',
      });
    }
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: async (entries) => {
      for (const [key, value, category] of entries) {
        const existing = settings.find(s => s.setting_key === key);
        if (existing) {
          await base44.entities.SystemSettings.update(existing.id, { setting_value: String(value) });
        } else {
          await base44.entities.SystemSettings.create({ setting_key: key, setting_value: String(value), category });
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success("Settings saved"); },
  });

  const saveSmtp = () => saveMut.mutate([
    ['smtp_host', smtp.host, 'smtp'], ['smtp_port', smtp.port, 'smtp'],
    ['smtp_username', smtp.username, 'smtp'], ['smtp_password', smtp.password, 'smtp'],
    ['smtp_from_email', smtp.from_email, 'smtp'], ['smtp_tls', smtp.tls, 'smtp'],
  ]);

  const saveTelegram = () => saveMut.mutate([
    ['telegram_bot_token', telegram.bot_token, 'telegram'],
    ['telegram_chat_id', telegram.chat_id, 'telegram'],
    ['telegram_enabled', telegram.enabled, 'telegram'],
  ]);

  const saveNotif = () => saveMut.mutate([
    ['notif_sms_fail', notifConfig.sms_fail, 'notification'],
    ['notif_route_blocked', notifConfig.route_blocked, 'notification'],
    ['notif_offline', notifConfig.offline, 'notification'],
    ['notif_backup', notifConfig.backup, 'notification'],
  ]);

  const saveKannel = () => saveMut.mutate([
    ['kannel_host', kannel.host, 'kannel'], ['kannel_admin_port', kannel.admin_port, 'kannel'],
    ['kannel_smsbox_port', kannel.smsbox_port, 'kannel'], ['kannel_password', kannel.password, 'kannel'],
  ]);

  const saveBackup = () => saveMut.mutate([
    ['backup_enabled', backup.enabled, 'backup'],
    ['backup_time', backup.time, 'backup'],
    ['backup_retention', backup.retention, 'backup'],
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="System Settings" description="Configure SMTP, Kannel, notifications, and backups" />

      <Tabs defaultValue="smtp">
        <TabsList>
          <TabsTrigger value="smtp"><Mail className="w-4 h-4 mr-1" />SMTP</TabsTrigger>
          <TabsTrigger value="telegram"><MessageSquare className="w-4 h-4 mr-1" />Telegram</TabsTrigger>
          <TabsTrigger value="notifications"><Mail className="w-4 h-4 mr-1" />Notifications</TabsTrigger>
          <TabsTrigger value="kannel"><Server className="w-4 h-4 mr-1" />Kannel</TabsTrigger>
          <TabsTrigger value="backup"><Database className="w-4 h-4 mr-1" />Backup</TabsTrigger>
        </TabsList>

        <TabsContent value="smtp">
          <Card>
            <CardHeader><CardTitle>SMTP Configuration</CardTitle><CardDescription>Email delivery settings</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>SMTP Host</Label><Input value={smtp.host || ''} onChange={(e) => setSmtp(p => ({ ...p, host: e.target.value }))} placeholder="smtp.gmail.com" /></div>
                <div className="space-y-2"><Label>Port</Label><Input value={smtp.port || ''} onChange={(e) => setSmtp(p => ({ ...p, port: e.target.value }))} placeholder="587" /></div>
                <div className="space-y-2"><Label>Username</Label><Input value={smtp.username || ''} onChange={(e) => setSmtp(p => ({ ...p, username: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Password</Label><Input type="password" value={smtp.password || ''} onChange={(e) => setSmtp(p => ({ ...p, password: e.target.value }))} /></div>
                <div className="space-y-2"><Label>From Email</Label><Input value={smtp.from_email || ''} onChange={(e) => setSmtp(p => ({ ...p, from_email: e.target.value }))} /></div>
                <div className="flex items-center gap-2 pt-6"><Switch checked={smtp.tls || false} onCheckedChange={(v) => setSmtp(p => ({ ...p, tls: v }))} /><Label>Enable TLS</Label></div>
              </div>
              <Button onClick={saveSmtp} disabled={saveMut.isPending}><Save className="w-4 h-4 mr-2" />Save SMTP</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telegram">
          <Card>
            <CardHeader><CardTitle>Telegram Notifications</CardTitle><CardDescription>Get alerts via Telegram bot</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2"><Switch checked={telegram.enabled || false} onCheckedChange={(v) => setTelegram(p => ({ ...p, enabled: v }))} /><Label>Enable Telegram notifications</Label></div>
              <div className="space-y-2"><Label>Bot Token</Label><Input value={telegram.bot_token || ''} onChange={(e) => setTelegram(p => ({ ...p, bot_token: e.target.value }))} placeholder="123456:ABC-DEF..." /></div>
              <div className="space-y-2"><Label>Chat ID</Label><Input value={telegram.chat_id || ''} onChange={(e) => setTelegram(p => ({ ...p, chat_id: e.target.value }))} placeholder="-1001234567890" /></div>
              <Button onClick={saveTelegram} disabled={saveMut.isPending}><Save className="w-4 h-4 mr-2" />Save Telegram</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle>Notification Preferences</CardTitle><CardDescription>Choose what triggers notifications</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50"><div><p className="font-medium text-sm">SMS Failures</p><p className="text-xs text-muted-foreground">Notify when SMS delivery fails</p></div><Switch checked={notifConfig.sms_fail !== false} onCheckedChange={(v) => setNotifConfig(p => ({ ...p, sms_fail: v }))} /></div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50"><div><p className="font-medium text-sm">Route Blocked</p><p className="text-xs text-muted-foreground">Auto-blocked route alerts</p></div><Switch checked={notifConfig.route_blocked !== false} onCheckedChange={(v) => setNotifConfig(p => ({ ...p, route_blocked: v }))} /></div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50"><div><p className="font-medium text-sm">Offline Alerts</p><p className="text-xs text-muted-foreground">Client/supplier connectivity issues</p></div><Switch checked={notifConfig.offline !== false} onCheckedChange={(v) => setNotifConfig(p => ({ ...p, offline: v }))} /></div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50"><div><p className="font-medium text-sm">Backup Alerts</p><p className="text-xs text-muted-foreground">Backup success/failure notifications</p></div><Switch checked={notifConfig.backup !== false} onCheckedChange={(v) => setNotifConfig(p => ({ ...p, backup: v }))} /></div>
              <Button onClick={saveNotif} disabled={saveMut.isPending}><Save className="w-4 h-4 mr-2" />Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kannel">
          <Card>
            <CardHeader><CardTitle>Kannel SMPP Gateway</CardTitle><CardDescription>Kannel server configuration for SMPP routing</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Kannel Host</Label><Input value={kannel.host || ''} onChange={(e) => setKannel(p => ({ ...p, host: e.target.value }))} placeholder="127.0.0.1" /></div>
                <div className="space-y-2"><Label>Admin Port</Label><Input value={kannel.admin_port || ''} onChange={(e) => setKannel(p => ({ ...p, admin_port: e.target.value }))} placeholder="13000" /></div>
                <div className="space-y-2"><Label>SMSBox Port</Label><Input value={kannel.smsbox_port || ''} onChange={(e) => setKannel(p => ({ ...p, smsbox_port: e.target.value }))} placeholder="13013" /></div>
                <div className="space-y-2"><Label>Admin Password</Label><Input type="password" value={kannel.password || ''} onChange={(e) => setKannel(p => ({ ...p, password: e.target.value }))} /></div>
              </div>
              <Button onClick={saveKannel} disabled={saveMut.isPending}><Save className="w-4 h-4 mr-2" />Save Kannel</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card>
            <CardHeader><CardTitle>Backup Configuration</CardTitle><CardDescription>Automated daily backups at 3 AM</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2"><Switch checked={backup.enabled !== false} onCheckedChange={(v) => setBackup(p => ({ ...p, enabled: v }))} /><Label>Enable automated backups</Label></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Backup Time</Label><Input type="time" value={backup.time || '03:00'} onChange={(e) => setBackup(p => ({ ...p, time: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Retention (days)</Label><Input type="number" value={backup.retention || '30'} onChange={(e) => setBackup(p => ({ ...p, retention: e.target.value }))} /></div>
              </div>
              <Button onClick={saveBackup} disabled={saveMut.isPending}><Save className="w-4 h-4 mr-2" />Save Backup</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}