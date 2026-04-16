import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Server, Users, DollarSign, ArrowRightLeft, CreditCard, Terminal, BookOpen, Activity } from "lucide-react";
import VoipPlatformSetup from "@/components/voip/VoipPlatformSetup";
import VoipClientManager from "@/components/voip/VoipClientManager";
import VoipRates from "@/components/voip/VoipRates";
import VoipNumberTranslation from "@/components/voip/VoipNumberTranslation";
import VoipBilling from "@/components/voip/VoipBilling";
import VoipTesting from "@/components/voip/VoipTesting";
import VoipDeployGuide from "@/components/voip/VoipDeployGuide";

export default function VoipPlatform() {
  const [tab, setTab] = useState("setup");

  const { data: platforms = [] } = useQuery({
    queryKey: ['voip-platforms'],
    queryFn: () => base44.entities.VoipPlatform.list('-created_date'),
    initialData: [],
    refetchInterval: 15000,
  });

  const { data: voipClients = [] } = useQuery({
    queryKey: ['voip-clients'],
    queryFn: () => base44.entities.VoipClient.list('-created_date'),
    initialData: [],
  });

  const activePlatform = platforms.find(p => p.status === 'active') || platforms[0];

  return (
    <div className="space-y-4">
      <PageHeader title="VoIP Platform" description="Asterisk 20+ / FreePBX integration — clients, rates, billing, ANI, testing & deployment">
        <div className="flex items-center gap-2">
          {activePlatform ? (
            <Badge className={`gap-1 ${activePlatform.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`} variant="outline">
              <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
              {activePlatform.name} — {activePlatform.host}:{activePlatform.sip_port}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">No platform configured</Badge>
          )}
        </div>
      </PageHeader>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Platforms", value: platforms.length, icon: Server, color: "text-orange-600 bg-orange-50 border-orange-200" },
          { label: "SIP Clients", value: voipClients.length, icon: Users, color: "text-blue-600 bg-blue-50 border-blue-200" },
          { label: "Active", value: voipClients.filter(c => c.status === 'active').length, icon: Activity, color: "text-green-600 bg-green-50 border-green-200" },
          { label: "Voice+SMS", value: voipClients.filter(c => c.traffic_type === 'both').length, icon: DollarSign, color: "text-purple-600 bg-purple-50 border-purple-200" },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${s.color}`}><s.icon className="w-4 h-4" /></div>
            <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="setup" className="gap-1.5"><Server className="w-3.5 h-3.5" />Platform Setup</TabsTrigger>
          <TabsTrigger value="clients" className="gap-1.5"><Users className="w-3.5 h-3.5" />SIP Clients</TabsTrigger>
          <TabsTrigger value="rates" className="gap-1.5"><DollarSign className="w-3.5 h-3.5" />Buy / Sell Rates</TabsTrigger>
          <TabsTrigger value="translation" className="gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5" />Number Translation</TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5"><CreditCard className="w-3.5 h-3.5" />Billing</TabsTrigger>
          <TabsTrigger value="testing" className="gap-1.5"><Terminal className="w-3.5 h-3.5" />Testing</TabsTrigger>
          <TabsTrigger value="deploy" className="gap-1.5"><BookOpen className="w-3.5 h-3.5" />Deploy Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-4"><VoipPlatformSetup platforms={platforms} /></TabsContent>
        <TabsContent value="clients" className="mt-4"><VoipClientManager platforms={platforms} /></TabsContent>
        <TabsContent value="rates" className="mt-4"><VoipRates voipClients={voipClients} /></TabsContent>
        <TabsContent value="translation" className="mt-4"><VoipNumberTranslation voipClients={voipClients} /></TabsContent>
        <TabsContent value="billing" className="mt-4"><VoipBilling voipClients={voipClients} /></TabsContent>
        <TabsContent value="testing" className="mt-4"><VoipTesting platforms={platforms} /></TabsContent>
        <TabsContent value="deploy" className="mt-4"><VoipDeployGuide /></TabsContent>
      </Tabs>
    </div>
  );
}