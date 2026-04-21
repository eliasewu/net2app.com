import PageHeader from "@/components/shared/PageHeader";
import IntegrationDeployGuide from "@/components/deploy/IntegrationDeployGuide";

export default function DeployGuide() {
  return (
    <div className="space-y-4">
      <PageHeader title="Integration & Deploy Guide" description="Full Debian 12: Asterisk 20 + Kannel SMPP/HTTP + SIM Box + MariaDB per-tenant CDR + real-time billing + firewall" />
      <IntegrationDeployGuide />
    </div>
  );
}