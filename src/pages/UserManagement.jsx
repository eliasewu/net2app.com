import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Shield, Users, Headphones, UserCheck, Pencil, Mail } from "lucide-react";
import { toast } from "sonner";

const ROLES = [
  { value: "admin", label: "Admin", icon: Shield, color: "bg-blue-50 text-blue-700 border-blue-200", desc: "Full access to all features" },
  { value: "support", label: "Support", icon: Headphones, color: "bg-green-50 text-green-700 border-green-200", desc: "View logs, limited actions" },
  { value: "agent", label: "Agent", icon: UserCheck, color: "bg-orange-50 text-orange-700 border-orange-200", desc: "Campaign & messaging only" },
  { value: "user", label: "User", icon: Users, color: "bg-gray-100 text-gray-600 border-gray-200", desc: "Basic read-only access" },
];

export default function UserManagement() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('support');
  const [editRole, setEditRole] = useState('support');
  const qc = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const inviteMut = useMutation({
    mutationFn: async ({ email, role }) => {
      await base44.users.inviteUser(email, role === 'admin' ? 'admin' : 'user');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setDialogOpen(false);
      setInviteEmail('');
      toast.success("User invited — invitation email sent");
    },
  });

  const updateRoleMut = useMutation({
    mutationFn: async ({ id, role }) => {
      return base44.entities.User.update(id, { role: role === 'admin' ? 'admin' : 'user' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setEditDialogOpen(false);
      toast.success("User role updated");
    },
  });

  const sendResetMut = useMutation({
    mutationFn: async (email) => {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: "Net2app — Password Reset Request",
        body: `Hello,\n\nA password reset has been requested for your Net2app account (${email}).\n\nPlease visit www.net2app.com to reset your password.\n\nIf you did not request this, please ignore this email.\n\nRegards,\nNet2app Team`
      });
    },
    onSuccess: (_, email) => {
      toast.success(`Password reset email sent to ${email}`);
    },
  });

  const isSuperAdmin = currentUser?.role === 'admin';

  const countByRole = (role) => users.filter(u => u.role === role || (role === 'support' && u.role === 'user')).length;

  const getRoleInfo = (role) => ROLES.find(r => r.value === role) || ROLES[3];

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" description="Manage admin, support & agent accounts — invite, edit roles, reset passwords">
        {isSuperAdmin && (
          <Button onClick={() => { setInviteEmail(''); setInviteRole('support'); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />Invite User
          </Button>
        )}
      </PageHeader>

      {/* Role stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ROLES.map(role => (
          <Card key={role.value} className="p-5">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${role.color}`}><role.icon className="w-5 h-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{role.label}s</p>
                <p className="text-2xl font-bold">{users.filter(u => u.role === (role.value === 'admin' ? 'admin' : 'user') || (role.value === 'user' && u.role === 'user')).length}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base font-semibold flex items-center justify-between">
          All Users <Badge variant="outline">{users.length}</Badge>
        </CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const roleInfo = getRoleInfo(u.role);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || 'N/A'}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleInfo.color}>
                        <roleInfo.icon className="w-3 h-3 mr-1" />
                        {u.role === 'admin' ? 'Admin' : u.role === 'user' ? 'Support/Agent' : u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(u.created_date).toLocaleDateString()}</TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Edit Role"
                            onClick={() => { setEditingUser(u); setEditRole(u.role === 'admin' ? 'admin' : 'support'); setEditDialogOpen(true); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Send Password Reset Email"
                            onClick={() => sendResetMut.mutate(u.email)} disabled={sendResetMut.isPending}>
                            <Mail className="w-4 h-4 text-blue-600" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {users.length === 0 && (
                <TableRow><TableCell colSpan={isSuperAdmin ? 5 : 4} className="text-center text-muted-foreground py-12">No users</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Invite New User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <r.icon className="w-4 h-4" />
                        <span>{r.label}</span>
                        <span className="text-muted-foreground text-xs">— {r.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">An invitation email will be sent to the user. They will receive a login link to access Net2app.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => inviteMut.mutate({ email: inviteEmail, role: inviteRole })} disabled={inviteMut.isPending || !inviteEmail}>
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit User — {editingUser?.full_name || editingUser?.email}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="text-sm font-medium">{editingUser?.full_name || 'N/A'}</p>
              <p className="text-xs text-muted-foreground">{editingUser?.email}</p>
            </div>
            <div className="space-y-2">
              <Label>Change Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <r.icon className="w-4 h-4" />
                        <span>{r.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={() => { sendResetMut.mutate(editingUser?.email); }} disabled={sendResetMut.isPending}>
              <Mail className="w-4 h-4" />Send Password Reset Email
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => updateRoleMut.mutate({ id: editingUser.id, role: editRole })} disabled={updateRoleMut.isPending}>
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}