import PageHeader from "@/components/shared/PageHeader";
import KannelSmppManager from "@/components/kannel/KannelSmppManager";

export default function SmppGateway() {
  return (
    <div className="space-y-4">
      <PageHeader title="SMPP / Kannel Gateway" description="Manage SMPP & HTTP supplier binds, auto-generate Kannel config, monitor real-time bind status" />
      <KannelSmppManager />
    </div>
  );
}