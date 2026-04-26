import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, Zap, Building2, Rocket, Loader2 } from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    price: 199,
    priceId: "price_1TQcVsDAKyH5C0WbwtITowJL",
    icon: Zap,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    badge: null,
    description: "Perfect for small-scale SMS operations",
    features: [
      "Up to 500,000 SMS/month",
      "SMPP + HTTP routing",
      "Up to 5 suppliers",
      "Basic analytics & reporting",
      "Route management",
      "Email support",
    ],
  },
  {
    name: "Professional",
    price: 799,
    priceId: "price_1TQcVsDAKyH5C0Wbz151ecM5",
    icon: Rocket,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    badge: "Most Popular",
    badgeColor: "bg-purple-600",
    description: "For growing SMS businesses with higher volume",
    features: [
      "Up to 5,000,000 SMS/month",
      "SMPP + HTTP + Device routing",
      "Up to 25 suppliers",
      "WhatsApp & Telegram device support",
      "Advanced analytics & CDR",
      "LCR / ASR / Priority routing",
      "Auto-block & failover",
      "Priority email + chat support",
    ],
  },
  {
    name: "Enterprise",
    price: 2499,
    priceId: "price_1TQcVsDAKyH5C0WbNScSI3Rq",
    icon: Building2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    badge: "Full Platform",
    badgeColor: "bg-emerald-600",
    description: "Complete multi-tenant SMS routing platform",
    features: [
      "Unlimited SMS volume",
      "All channels: SMPP/HTTP/WhatsApp/Telegram/IMO/Android",
      "Unlimited suppliers & routes",
      "Multi-tenant management",
      "Real-time DLR billing triggers",
      "Android APK SMS gateway",
      "OTP Unicode obfuscation",
      "Voice OTP (Asterisk/SIP)",
      "VoIP platform integration",
      "SLA guarantee",
      "Dedicated 24/7 support",
    ],
  },
];

export default function PricingPlans() {
  const [loading, setLoading] = useState(null);

  const handleSubscribe = async (plan) => {
    // Block if running inside iframe (Base44 preview)
    if (window.self !== window.top) {
      alert("Checkout is only available from the published app, not the preview.");
      return;
    }

    setLoading(plan.priceId);
    const response = await base44.functions.invoke("createCheckoutSession", {
      priceId: plan.priceId,
      successUrl: `${window.location.origin}/billing?success=1&plan=${plan.name}`,
      cancelUrl: `${window.location.origin}/billing`,
    });

    if (response.data?.url) {
      window.location.href = response.data.url;
    } else {
      alert("Failed to start checkout. Please try again.");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 py-16 px-4">
      {/* Header */}
      <div className="text-center mb-12 max-w-2xl mx-auto">
        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 mb-4">Enterprise SMS Routing</Badge>
        <h1 className="text-4xl font-bold text-white mb-4">Choose Your Plan</h1>
        <p className="text-slate-400 text-lg">
          Professional SMS routing infrastructure for telecoms, aggregators, and enterprises.
          All plans include multi-channel routing, DLR tracking, and real-time billing.
        </p>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isLoading = loading === plan.priceId;
          const isPopular = plan.badge === "Most Popular";

          return (
            <Card
              key={plan.name}
              className={`relative bg-slate-800/60 border ${isPopular ? "border-purple-500 shadow-lg shadow-purple-500/20" : "border-slate-700"} text-white`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className={`${plan.badgeColor} text-white border-0 px-3 py-1`}>
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-4">
                <div className={`w-10 h-10 rounded-lg ${plan.bgColor} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${plan.color}`} />
                </div>
                <CardTitle className="text-xl text-white">{plan.name}</CardTitle>
                <CardDescription className="text-slate-400 text-sm">{plan.description}</CardDescription>
                <div className="pt-2">
                  <span className="text-4xl font-bold text-white">${plan.price.toLocaleString()}</span>
                  <span className="text-slate-400 ml-2">/month</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <Button
                  className={`w-full ${isPopular ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"} text-white`}
                  onClick={() => handleSubscribe(plan)}
                  disabled={!!loading}
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                  ) : (
                    "Subscribe Now"
                  )}
                </Button>

                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      <span className="text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer note */}
      <p className="text-center text-slate-500 text-sm mt-10">
        All plans billed monthly. Cancel anytime. Need a custom volume deal?{" "}
        <a href="https://wa.me/971XXXXXXXXX" className="text-blue-400 hover:underline">Contact us on WhatsApp</a>.
      </p>
    </div>
  );
}