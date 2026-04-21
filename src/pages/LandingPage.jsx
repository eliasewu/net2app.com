import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquare, Phone, Globe, Shield, Zap, Server, Star,
  ChevronRight, Mail, MapPin, Calendar, CheckCircle2,
  ArrowRight, Menu, X, Radio, Wifi, PhoneCall, ChevronDown
} from "lucide-react";

const COMPANY = {
  name: "Tri Angle Trade Centre FZE LLC",
  tagline: "Next-Gen SMS & VoIP Telecom Platform",
  website: "www.triangletrade.net",
  phone: "+971585844398",
  whatsapp: "+971585844398",
  email: "platform@triangletrade.net",
};

const WHATSAPP_URL = `https://wa.me/${COMPANY.whatsapp.replace(/\D/g, '')}`;

const LOGIN_ROLES = [
  { label: "Website Manager", icon: "🌐" },
  { label: "Server / Admin", icon: "🖥️" },
  { label: "Support", icon: "🎧" },
  { label: "User", icon: "👤" },
  { label: "Agent", icon: "🤝" },
];

const CATEGORY_LABELS = {
  sms: { label: "SMS Package", color: "bg-blue-100 text-blue-700", icon: MessageSquare },
  voip: { label: "VoIP Platform", color: "bg-orange-100 text-orange-700", icon: Phone },
  tenant: { label: "Tenant Package", color: "bg-purple-100 text-purple-700", icon: Server },
  voice_route: { label: "Voice Routes", color: "bg-green-100 text-green-700", icon: Radio },
  custom: { label: "Custom", color: "bg-gray-100 text-gray-700", icon: Star },
};

const UPDATE_COLORS = {
  news: "border-l-blue-500 bg-blue-50",
  event: "border-l-purple-500 bg-purple-50",
  offer: "border-l-green-500 bg-green-50",
  maintenance: "border-l-yellow-500 bg-yellow-50",
};

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);

  const { data: packages = [] } = useQuery({
    queryKey: ["landing-packages"],
    queryFn: () => base44.entities.LandingPackage.filter({ is_active: true }, "sort_order", 50),
    initialData: [],
  });

  const { data: gallery = [] } = useQuery({
    queryKey: ["landing-gallery"],
    queryFn: () => base44.entities.LandingGallery.filter({ is_active: true }, "sort_order", 20),
    initialData: [],
  });

  const { data: updates = [] } = useQuery({
    queryKey: ["landing-updates"],
    queryFn: () => base44.entities.LandingUpdate.filter({ is_active: true }, "sort_order", 20),
    initialData: [],
  });

  // Auto-rotate gallery
  useEffect(() => {
    if (gallery.length < 2) return;
    const t = setInterval(() => setGalleryIdx(i => (i + 1) % gallery.length), 4000);
    return () => clearInterval(t);
  }, [gallery.length]);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const smsPkgs = packages.filter(p => p.category === "sms");
  const voipPkgs = packages.filter(p => p.category === "voip" || p.category === "tenant");
  const voiceRoutes = packages.filter(p => p.category === "voice_route");
  const banners = gallery.filter(g => g.category === "banner");
  const galleryItems = gallery.filter(g => g.category === "gallery");
  const events = updates.filter(u => u.category === "event");
  const news = updates.filter(u => u.category !== "event");

  const heroBg = banners[0]?.image_url || null;

  return (
    <div className="min-h-screen bg-white font-inter">
      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
              <PhoneCall className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">Tri Angle Trade</p>
              <p className="text-[10px] text-blue-600 font-medium">SMS & VoIP Platform</p>
            </div>
          </div>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            {[["Services", "services"], ["Packages", "packages"], ["Voice Routes", "voice"], ["Gallery", "gallery"], ["Updates", "updates"], ["Contact", "contact"]].map(([l, id]) => (
              <button key={id} onClick={() => scrollTo(id)} className="hover:text-blue-600 transition-colors">{l}</button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-2">
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
              <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
              </Button>
            </a>
            <LoginDropdown />
          </div>
          <button className="md:hidden p-2" onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-white border-t px-4 py-3 flex flex-col gap-3 text-sm font-medium">
            {[["Services", "services"], ["Packages", "packages"], ["Voice Routes", "voice"], ["Gallery", "gallery"], ["Updates", "updates"], ["Contact", "contact"]].map(([l, id]) => (
              <button key={id} onClick={() => scrollTo(id)} className="text-left text-gray-700 hover:text-blue-600">{l}</button>
            ))}
            <div className="flex gap-2 pt-2 border-t">
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="flex-1">
                <Button size="sm" className="w-full bg-green-500 hover:bg-green-600 text-white">WhatsApp</Button>
              </a>
            </div>
            <div className="pt-1 border-t">
              <p className="text-xs text-gray-500 mb-2 font-medium">Portal Login</p>
              {LOGIN_ROLES.map(role => (
                <button key={role.label} onClick={() => base44.auth.redirectToLogin()}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 text-left text-sm text-gray-700">
                  <span>{role.icon}</span> {role.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section
        className="relative pt-16 min-h-[92vh] flex items-center overflow-hidden"
        style={heroBg ? { backgroundImage: `url(${heroBg})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
      >
        {/* gradient overlay always */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 via-indigo-900/85 to-slate-900/90" />

        {/* animated blobs */}
        <div className="absolute top-20 right-10 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 left-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-24 text-white">
          <div className="max-w-3xl">
            <Badge className="bg-blue-500/20 text-blue-200 border border-blue-400/30 mb-6 px-3 py-1">
              🚀 Enterprise Telecom Infrastructure
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              Global SMS Switch &<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                VoIP Platform
              </span>
            </h1>
            <p className="text-lg text-blue-100 mb-8 max-w-2xl leading-relaxed">
              Tri Angle Trade Centre FZE LLC delivers carrier-grade SMS routing, SMPP connectivity,
              VoIP termination, and multi-tenant telecom infrastructure for operators worldwide.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => scrollTo("packages")}
                className="bg-blue-500 hover:bg-blue-400 text-white gap-2 px-8">
                View Packages <ArrowRight className="w-4 h-4" />
              </Button>
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                <Button size="lg" variant="outline"
                  className="border-white/30 text-white hover:bg-white/10 gap-2 px-8 bg-transparent">
                  <MessageSquare className="w-4 h-4" /> Chat on WhatsApp
                </Button>
              </a>
            </div>
            {/* Quick stats */}
            <div className="flex flex-wrap gap-8 mt-14 text-center">
              {[["99.9%", "Uptime SLA"], ["190+", "Countries"], ["Multi-tenant", "Architecture"], ["24/7", "Support"]].map(([v, l]) => (
                <div key={l}>
                  <p className="text-2xl font-bold text-white">{v}</p>
                  <p className="text-xs text-blue-300">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICES ────────────────────────────────────────────── */}
      <section id="services" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <Badge className="bg-blue-100 text-blue-700 mb-3">Our Services</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Complete Telecom Solutions</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">From SMS aggregation to VoIP termination — all under one roof</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: MessageSquare, title: "SMS Gateway", desc: "SMPP & HTTP API, MCC/MNC routing, DLR tracking, multi-tenant, OTP support", color: "text-blue-600", bg: "bg-blue-50" },
              { icon: Phone, title: "VoIP Platform", desc: "Asterisk/FreePBX integration, SIP trunking, IVR, voice OTP, CDR billing", color: "text-orange-600", bg: "bg-orange-50" },
              { icon: Server, title: "Multi-Tenant", desc: "Dedicated SMPP ports per tenant, Kannel config generation, UFW automation", color: "text-purple-600", bg: "bg-purple-50" },
              { icon: Shield, title: "IP Security", desc: "Whitelist/blacklist management, anti-fraud, real-time IP monitoring", color: "text-red-600", bg: "bg-red-50" },
              { icon: Zap, title: "High Throughput", desc: "TPS-controlled routing, LCR, ASR optimization, auto-failover", color: "text-yellow-600", bg: "bg-yellow-50" },
              { icon: Globe, title: "Global Routes", desc: "190+ country coverage, MCC/MNC database, competitive wholesale rates", color: "text-green-600", bg: "bg-green-50" },
            ].map(s => (
              <Card key={s.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center mb-4`}>
                    <s.icon className={`w-6 h-6 ${s.color}`} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── PACKAGES ────────────────────────────────────────────── */}
      <section id="packages" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <Badge className="bg-blue-100 text-blue-700 mb-3">Pricing</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">SMS Packages</h2>
            <p className="text-gray-500 mt-3">Flexible plans for every scale of operation</p>
          </div>
          {smsPkgs.length === 0 ? (
            <DefaultSmsPackages />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {smsPkgs.map(p => <PackageCard key={p.id} pkg={p} />)}
            </div>
          )}

          {/* VoIP / Tenant */}
          {voipPkgs.length > 0 && (
            <>
              <div className="text-center mt-20 mb-14">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">VoIP & Tenant Packages</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {voipPkgs.map(p => <PackageCard key={p.id} pkg={p} />)}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── VOICE ROUTES ─────────────────────────────────────────── */}
      <section id="voice" className="py-20 bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <Badge className="bg-orange-100 text-orange-700 mb-3">Voice Routes</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Global Voice Termination</h2>
            <p className="text-gray-500 mt-3">Competitive wholesale voice routes with quality SLA</p>
          </div>
          {voiceRoutes.length === 0 ? (
            <DefaultVoiceRoutes />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {voiceRoutes.map(p => <PackageCard key={p.id} pkg={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* ── UPDATES / NEWS / EVENTS ──────────────────────────────── */}
      {(news.length > 0 || events.length > 0) && (
        <section id="updates" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-14">
              <Badge className="bg-blue-100 text-blue-700 mb-3">Latest</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">News & Events</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {updates.map(u => (
                <div key={u.id} className={`border-l-4 rounded-r-lg p-5 ${UPDATE_COLORS[u.category] || UPDATE_COLORS.news}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge className="text-[10px] mb-2 capitalize">{u.category}</Badge>
                      <h3 className="font-semibold text-gray-900 mb-1">{u.title}</h3>
                      <p className="text-sm text-gray-600">{u.body}</p>
                    </div>
                    {u.event_date && (
                      <div className="text-center shrink-0 bg-white rounded-lg p-2 shadow-sm min-w-[52px]">
                        <p className="text-[10px] text-gray-400 uppercase">{new Date(u.event_date).toLocaleString('default', { month: 'short' })}</p>
                        <p className="text-xl font-bold text-gray-900 leading-none">{new Date(u.event_date).getDate()}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PHOTO GALLERY ────────────────────────────────────────── */}
      {galleryItems.length > 0 && (
        <section id="gallery" className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-14">
              <Badge className="bg-blue-100 text-blue-700 mb-3">Gallery</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Photo Gallery</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {galleryItems.map((g, i) => (
                <div key={g.id} className="relative group rounded-xl overflow-hidden aspect-square bg-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <img src={g.image_url} alt={g.caption || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  {g.caption && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <p className="text-white text-xs font-medium">{g.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CONTACT / CTA ────────────────────────────────────────── */}
      <section id="contact" className="py-20 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="bg-blue-500/20 text-blue-200 border border-blue-400/30 mb-6">Get In Touch</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Scale Your Telecom Business?</h2>
              <p className="text-blue-200 mb-8 leading-relaxed">
                Contact our team for a custom quote, technical demo, or to discuss your SMS and VoIP routing needs.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Globe, label: "Website", value: COMPANY.website, href: `https://${COMPANY.website}` },
                  { icon: MessageSquare, label: "WhatsApp", value: COMPANY.whatsapp, href: WHATSAPP_URL },
                  { icon: Phone, label: "Phone", value: COMPANY.phone, href: `tel:${COMPANY.phone}` },
                  { icon: Mail, label: "Email", value: COMPANY.email, href: `mailto:${COMPANY.email}` },
                ].map(item => (
                  <a key={item.label} href={item.href} target="_blank" rel="noreferrer"
                    className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-blue-500 transition-colors shrink-0">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-blue-300">{item.label}</p>
                      <p className="text-sm font-medium group-hover:text-blue-300 transition-colors">{item.value}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-8 space-y-4">
              <h3 className="text-xl font-semibold mb-6">Quick Inquiry</h3>
              {["Your Name", "Company Name", "Email Address"].map(ph => (
                <input key={ph} placeholder={ph}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400 text-sm" />
              ))}
              <textarea placeholder="Tell us about your requirements..." rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400 text-sm resize-none" />
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                <Button className="w-full bg-green-500 hover:bg-green-400 text-white gap-2 mt-2">
                  <MessageSquare className="w-4 h-4" /> Send via WhatsApp
                </Button>
              </a>
              <p className="text-center text-xs text-blue-300">Or email us at {COMPANY.email}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="bg-slate-950 text-gray-400 py-8 px-4 text-center text-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="font-semibold text-white">{COMPANY.name}</p>
          <p>© {new Date().getFullYear()} All rights reserved.</p>
          <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
            onClick={() => base44.auth.redirectToLogin()}>
            Portal Login →
          </Button>
        </div>
      </footer>

      {/* ── FLOATING WHATSAPP ────────────────────────────────────── */}
      <a href={WHATSAPP_URL} target="_blank" rel="noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-green-500 hover:bg-green-400 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110">
        <MessageSquare className="w-7 h-7" />
      </a>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PackageCard({ pkg }) {
  const cat = CATEGORY_LABELS[pkg.category] || CATEGORY_LABELS.custom;
  const features = (() => { try { return JSON.parse(pkg.features || "[]"); } catch { return pkg.features ? pkg.features.split("\n").filter(Boolean) : []; } })();
  const WHATSAPP_URL = `https://wa.me/${"+971585844398".replace(/\D/g, '')}?text=I'm interested in the ${encodeURIComponent(pkg.title)} package`;
  return (
    <Card className={`relative border-2 transition-all hover:shadow-lg ${pkg.highlight ? "border-blue-500 shadow-blue-100" : "border-gray-100"}`}>
      {pkg.badge_text && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-blue-600 text-white px-3 py-1 text-xs">{pkg.badge_text}</Badge>
        </div>
      )}
      <CardContent className="p-6">
        <Badge className={`${cat.color} mb-3 text-xs`}>{cat.label}</Badge>
        <h3 className="font-bold text-gray-900 text-lg mb-1">{pkg.title}</h3>
        {pkg.price > 0 && (
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-3xl font-bold text-blue-600">{pkg.currency} {pkg.price}</span>
            <span className="text-sm text-gray-400">{pkg.price_unit}</span>
          </div>
        )}
        {features.length > 0 && (
          <ul className="space-y-2 mb-6">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        )}
        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
          <Button className={`w-full gap-2 ${pkg.highlight ? "bg-blue-600 hover:bg-blue-700" : "bg-green-500 hover:bg-green-600"} text-white`}>
            <MessageSquare className="w-4 h-4" /> Get This Package
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}

function DefaultSmsPackages() {
  const pkgs = [
    { title: "Starter SMS", price: "200", unit: "/month", features: ["5 Million SMS/month", "SMPP & HTTP API", "DLR Tracking", "Dedicated Port", "Email Support"], highlight: false },
    { title: "Business SMS", price: "350", unit: "/month", features: ["10 Million SMS/month", "SMPP & HTTP API", "Real DLR + Fake Mode", "MCC/MNC Routing", "Priority Support"], highlight: true, badge: "Most Popular" },
    { title: "Enterprise SMS", price: "Custom", unit: "", features: ["Unlimited SMS", "Full SMPP Switch", "Multi-tenant", "VoIP Included", "24/7 Dedicated Support"], highlight: false },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {pkgs.map(p => (
        <Card key={p.title} className={`relative border-2 ${p.highlight ? "border-blue-500 shadow-lg shadow-blue-100" : "border-gray-100"}`}>
          {p.badge && <div className="absolute -top-3 left-1/2 -translate-x-1/2"><Badge className="bg-blue-600 text-white px-3">{p.badge}</Badge></div>}
          <CardContent className="p-6">
            <Badge className="bg-blue-100 text-blue-700 mb-3 text-xs">SMS Package</Badge>
            <h3 className="font-bold text-gray-900 text-lg mb-1">{p.title}</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-blue-600">USD {p.price}</span>
              <span className="text-sm text-gray-400">{p.unit}</span>
            </div>
            <ul className="space-y-2 mb-6">
              {p.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />{f}
                </li>
              ))}
            </ul>
            <a href={`https://wa.me/971585844398?text=I'm interested in ${encodeURIComponent(p.title)}`} target="_blank" rel="noreferrer">
              <Button className={`w-full gap-2 ${p.highlight ? "bg-blue-600 hover:bg-blue-700" : "bg-green-500 hover:bg-green-600"} text-white`}>
                <MessageSquare className="w-4 h-4" /> Get Started
              </Button>
            </a>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LoginDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  return (
    <div className="relative" ref={ref}>
      <Button size="sm" onClick={() => setOpen(v => !v)}
        className="bg-blue-600 hover:bg-blue-700 gap-1">
        Login <ChevronDown className="w-3 h-3" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Portal Login</p>
          </div>
          {LOGIN_ROLES.map(role => (
            <button key={role.label}
              onClick={() => { setOpen(false); base44.auth.redirectToLogin(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left text-sm text-gray-700 transition-colors">
              <span className="text-base">{role.icon}</span>
              <span className="font-medium">{role.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DefaultVoiceRoutes() {
  const routes = [
    { dest: "Asia Pacific", rate: "0.0012", min: "USD/min", quality: "A-Grade", asr: "65%+" },
    { dest: "Middle East", rate: "0.0018", min: "USD/min", quality: "Premium", asr: "70%+" },
    { dest: "Europe", rate: "0.0008", min: "USD/min", quality: "Standard", asr: "60%+" },
    { dest: "Americas", rate: "0.0006", min: "USD/min", quality: "Standard", asr: "60%+" },
    { dest: "Africa", rate: "0.0025", min: "USD/min", quality: "A-Grade", asr: "55%+" },
    { dest: "Global Wholesale", rate: "Custom", min: "", quality: "Negotiable", asr: "SLA-based" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {routes.map(r => (
        <Card key={r.dest} className="border border-orange-100 hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900">{r.dest}</p>
              <p className="text-xs text-gray-500 mt-0.5">{r.quality} • ASR {r.asr}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold text-orange-600">{r.rate}</p>
              <p className="text-xs text-gray-400">{r.min}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}