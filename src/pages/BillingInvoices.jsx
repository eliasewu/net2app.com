import PageHeader from "@/components/shared/PageHeader";
import BillingEngine from "@/components/billing/BillingEngine";

export default function BillingInvoices() {
  return (
    <div className="space-y-4">
      <PageHeader title="Billing & Invoices" description="Real-time CDR rating, buy/sell margin, client balance control, invoice generation & email delivery" />
      <BillingEngine />
    </div>
  );
}