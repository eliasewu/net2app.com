import PageHeader from "@/components/shared/PageHeader";
import IntegrationDeployGuide from "@/components/deploy/IntegrationDeployGuide";

export default function DeployGuide() {
  return (
    <div className="space-y-4">
      <PageHeader title="Integration & Deploy Guide" description="Full Debian 12 setup: Asterisk 20 + Kannel + SMPP + MariaDB CDR + Firewall — copy-paste scripts" />
      <IntegrationDeployGuide />
    </div>
  );
}