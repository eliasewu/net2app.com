import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
import VoiceOtpLogs from "@/components/voice/VoiceOtpLogs";
import VoiceAudioLibrary from "@/components/voice/VoiceAudioLibrary";
import VoiceSupplierManager from "@/components/voice/VoiceSupplierManager";
import BornoVoiceOtp from "@/components/voice/BornoVoiceOtp";
import { Phone, FolderOpen, Settings, Zap } from "lucide-react";

export default function VoiceOtpPage() {
  const [tab, setTab] = useState("borno");

  return (
    <div className="space-y-6">
      <PageHeader title="Voice OTP" description="Send voice OTPs via Borno API, SIP suppliers, audio library & routing" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="borno"><Zap className="w-3.5 h-3.5 mr-1.5" />Borno API</TabsTrigger>
          <TabsTrigger value="logs"><Phone className="w-3.5 h-3.5 mr-1.5" />OTP Logs</TabsTrigger>
          <TabsTrigger value="library"><FolderOpen className="w-3.5 h-3.5 mr-1.5" />Audio Library</TabsTrigger>
          <TabsTrigger value="suppliers"><Settings className="w-3.5 h-3.5 mr-1.5" />Voice Suppliers</TabsTrigger>
        </TabsList>
        <TabsContent value="borno" className="mt-4"><BornoVoiceOtp /></TabsContent>
        <TabsContent value="logs" className="mt-4"><VoiceOtpLogs /></TabsContent>
        <TabsContent value="library" className="mt-4"><VoiceAudioLibrary /></TabsContent>
        <TabsContent value="suppliers" className="mt-4"><VoiceSupplierManager /></TabsContent>
      </Tabs>
    </div>
  );
}