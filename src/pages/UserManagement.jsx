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
import { Plus, Shield, Users } from "lucide-react";
import { toast } from "sonner";

export default function UserManagement() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
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
      await base44.users.inviteUser(email, role);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setDialogOpen(false);
      setInviteEmail('');
      toast.success("User invited successfully");
    },
  });

  const admins = users.filter(u => u.role === 'admin');
  const regularUsers = users.filter(u => u.role === 'user');
  const isSuperAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" description="Super Admin can create up to 20 admins. Each admin has full access.">
        {isSuperAdmin && (
          <Button onClick={() => setDialogOpen(true)} disabled={admins.length >= 20}>
            <Plus className="w-4 h-4 mr-2" />Invite User
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600"><Shield className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Total Admins</p>
              <p className="text-2xl font-bold">{admins.length}<span className="text-sm font-normal text-muted-foreground">/20</span></p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-50 text-green-600"><Users className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Support Users</p>
              <p className="text-2xl font-bold">{regularUsers.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-50 text-yellow-600"><Users className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold">{users.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">All Users</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || 'N/A'}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={u.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600'}>
                      {u.role === 'admin' ? 'Admin' : 'Support'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(u.created_date).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-12">No users</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (Full Access)</SelectItem>
                  <SelectItem value="user">Support (Limited Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteRole === 'admin' && admins.length >= 20 && (
              <p className="text-sm text-destructive">Maximum 20 admins reached</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => inviteMut.mutate({ email: inviteEmail, role: inviteRole })} disabled={inviteMut.isPending || (inviteRole === 'admin' && admins.length >= 20)}>
              Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}