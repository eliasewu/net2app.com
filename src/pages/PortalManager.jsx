import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, ExternalLink, Users, Building2, Search } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/shared/PageHeader";

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
}

function getPortalUrl(type, id) {
  return `${window.location.origin}/portal?type=${type}&id=${id}`;
}

export default function PortalManager() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("clients");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list("-created_date"),
    initialData: [],
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => base44.entities.Supplier.list("-created_date"),
    initialData: [],
  });

  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Portal Manager"
        description="Generate and share portal access links for clients and suppliers."
      />

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 space-y-1">
        <p className="font-semibold">🔗 How Customer Portal Access Works</p>
        <p>• Share the portal link with each client/supplier — they log in with their <strong>Account ID + SMPP password</strong></p>
        <p>• <strong>Clients</strong> see: SMS logs (no supplier info), invoices, balance, account info only</p>
        <p>• <strong>Suppliers</strong> see: traffic logs (no client info), account info only</p>
        <p>• Portal is managed entirely by tenant/admin. Clients cannot see supplier details and vice versa.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="clients"><Users className="w-3.5 h-3.5 mr-1" />Clients ({clients.length})</TabsTrigger>
          <TabsTrigger value="suppliers"><Building2 className="w-3.5 h-3.5 mr-1" />Suppliers ({suppliers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Client Portal Links</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Account ID</TableHead>
                    <TableHead>Portal Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{c.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${c.status === "active" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600"}`}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{c.id?.slice(0, 12)}...</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(c.id)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => copyToClipboard(getPortalUrl("client", c.id))}>
                            <Copy className="w-3 h-3" />Copy Link
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(getPortalUrl("client", c.id), "_blank")}>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredClients.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No clients found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Supplier Portal Links</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Account ID</TableHead>
                    <TableHead>Portal Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{s.email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{s.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{s.id?.slice(0, 12)}...</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(s.id)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => copyToClipboard(getPortalUrl("supplier", s.id))}>
                            <Copy className="w-3 h-3" />Copy Link
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(getPortalUrl("supplier", s.id), "_blank")}>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredSuppliers.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No suppliers found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}