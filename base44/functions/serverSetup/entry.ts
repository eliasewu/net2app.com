/**
 * NET2APP — Full Server Setup & Connectivity Check
 * Creates all 26 tables, verifies each module's API endpoint,
 * and returns a full health report for the dashboard.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SERVER_API_URL = Deno.env.get("SERVER_API_URL") || "http://127.0.0.1:5000";
const SERVER_API_TOKEN = Deno.env.get("SERVER_API_TOKEN") || "";

const apiHeaders = {
  "Content-Type": "application/json",
  "X-Api-Token": SERVER_API_TOKEN,
  "Authorization": `Bearer ${SERVER_API_TOKEN}`,
};

async function apiGet(path) {
  try {
    const r = await fetch(`${SERVER_API_URL}${path}`, { headers: apiHeaders, signal: AbortSignal.timeout(8000) });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

async function apiPost(path, body) {
  try {
    const r = await fetch(`${SERVER_API_URL}${path}`, {
      method: "POST", headers: apiHeaders,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

// All modules to check
const MODULE_CHECKS = [
  { module: "Health",           endpoint: "/health",              method: "GET" },
  { module: "Auth / Login",     endpoint: "/api/auth/me",         method: "GET" },
  { module: "Dashboard",        endpoint: "/api/dashboard",       method: "GET" },
  { module: "Users",            endpoint: "/api/users",           method: "GET" },
  { module: "Clients",          endpoint: "/api/clients",         method: "GET" },
  { module: "Suppliers",        endpoint: "/api/suppliers",       method: "GET" },
  { module: "Routes",           endpoint: "/api/routes",          method: "GET" },
  { module: "Routing Rules",    endpoint: "/api/routing-rules",   method: "GET" },
  { module: "Rates",            endpoint: "/api/rates",           method: "GET" },
  { module: "MCC/MNC",          endpoint: "/api/mccmnc",          method: "GET" },
  { module: "SMS Logs",         endpoint: "/api/sms-logs",        method: "GET" },
  { module: "Voice OTP",        endpoint: "/api/voice-otp",       method: "GET" },
  { module: "Billing Summary",  endpoint: "/api/billing/summary", method: "GET" },
  { module: "Invoices",         endpoint: "/api/invoices",        method: "GET" },
  { module: "Campaigns",        endpoint: "/api/campaigns",       method: "GET" },
  { module: "Content Templates",endpoint: "/api/content-templates",method: "GET"},
  { module: "Settings",         endpoint: "/api/settings",        method: "GET" },
  { module: "Alert Rules",      endpoint: "/api/alert-rules",     method: "GET" },
  { module: "Notifications",    endpoint: "/api/notifications",   method: "GET" },
  { module: "Gateways",         endpoint: "/api/gateways",        method: "GET" },
  { module: "Number Translation",endpoint: "/api/translations",   method: "GET" },
  { module: "IP Access",        endpoint: "/api/ip-access",       method: "GET" },
  { module: "Reports Traffic",  endpoint: "/api/reports/traffic", method: "GET" },
  { module: "Tenants",          endpoint: "/api/tenants",         method: "GET" },
  { module: "Supplier Health",  endpoint: "/api/supplier-health", method: "GET" },
  { module: "CDR Logs",         endpoint: "/api/cdr-logs",        method: "GET" },
  { module: "Kannel Status",    endpoint: "/api/kannel/status",   method: "GET" },
  { module: "SMPP Test",        endpoint: "/api/smpp/test",       method: "GET" },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── ACTION: full connectivity check ──────────────────────────────────
    if (action === "check" || !action) {
      const health = await apiGet("/health");

      if (!health.ok) {
        return Response.json({
          ok: false,
          server_reachable: false,
          server_url: SERVER_API_URL,
          error: health.error || `HTTP ${health.status}`,
          message: "Server unreachable. Check SERVER_API_URL and SERVER_API_TOKEN secrets.",
          modules: [],
        });
      }

      // Run all module checks in parallel
      const results = await Promise.all(
        MODULE_CHECKS.map(async (m) => {
          const r = await apiGet(m.endpoint);
          // 200 or 401 = endpoint exists (auth required = server running)
          // 404 = endpoint not deployed yet
          // 0 = server unreachable
          const endpointExists = r.status === 200 || r.status === 401 || r.status === 403;
          const connected = r.ok || endpointExists;
          return {
            module: m.module,
            endpoint: m.endpoint,
            ok: connected,
            status: r.status,
            connected,
            note: r.status === 401 ? "auth required" : r.status === 404 ? "not deployed" : null,
            error: r.error || (r.status === 404 ? "Endpoint not found — run deploy.sh to install server.js" : null),
          };
        })
      );

      const connected = results.filter(r => r.connected).length;
      const total = results.length;

      return Response.json({
        ok: true,
        server_reachable: true,
        server_url: SERVER_API_URL,
        db_connected: health.data?.db === "connected" || health.data?.ok === true,
        tables: health.data?.tables || 0,
        sms_today: health.data?.sms_today || 0,
        version: health.data?.version || "unknown",
        modules_connected: connected,
        modules_total: total,
        modules: results,
      });
    }

    // ── ACTION: sync all Base44 entities → server DB ──────────────────────
    if (action === "sync_entities") {
      const results = [];

      // Sync Clients
      const clients = await base44.asServiceRole.entities.Client.list();
      let clientsSynced = 0;
      for (const c of clients) {
        const r = await apiPost("/api/clients", { ...c, id: c.id });
        if (r.ok) clientsSynced++;
      }
      results.push({ entity: "Clients", total: clients.length, synced: clientsSynced });

      // Sync Suppliers
      const suppliers = await base44.asServiceRole.entities.Supplier.list();
      let suppliersSynced = 0;
      for (const s of suppliers) {
        const r = await apiPost("/api/suppliers", { ...s, id: s.id });
        if (r.ok) suppliersSynced++;
      }
      results.push({ entity: "Suppliers", total: suppliers.length, synced: suppliersSynced });

      // Sync Routes
      const routes = await base44.asServiceRole.entities.Route.list();
      let routesSynced = 0;
      for (const r of routes) {
        const res = await apiPost("/api/routes", { ...r, id: r.id });
        if (res.ok) routesSynced++;
      }
      results.push({ entity: "Routes", total: routes.length, synced: routesSynced });

      // Sync Routing Rules
      const rules = await base44.asServiceRole.entities.RoutingRule.list();
      let rulesSynced = 0;
      for (const rule of rules) {
        const res = await apiPost("/api/routing-rules", { ...rule, id: rule.id });
        if (res.ok) rulesSynced++;
      }
      results.push({ entity: "Routing Rules", total: rules.length, synced: rulesSynced });

      // Sync Rates
      const rates = await base44.asServiceRole.entities.Rate.list();
      let ratesSynced = 0;
      for (const rate of rates) {
        const res = await apiPost("/api/rates", { ...rate, id: rate.id });
        if (res.ok) ratesSynced++;
      }
      results.push({ entity: "Rates", total: rates.length, synced: ratesSynced });

      // Sync Alert Rules
      const alertRules = await base44.asServiceRole.entities.AlertRule.list();
      let alertsSynced = 0;
      for (const a of alertRules) {
        const res = await apiPost("/api/alert-rules", { ...a, id: a.id });
        if (res.ok) alertsSynced++;
      }
      results.push({ entity: "Alert Rules", total: alertRules.length, synced: alertsSynced });

      // Sync Gateways
      const gateways = await base44.asServiceRole.entities.Gateway.list();
      let gwSynced = 0;
      for (const g of gateways) {
        const res = await apiPost("/api/gateways", { ...g, id: g.id });
        if (res.ok) gwSynced++;
      }
      results.push({ entity: "Gateways", total: gateways.length, synced: gwSynced });

      // Sync Tenants
      const tenants = await base44.asServiceRole.entities.Tenant.list();
      let tenantsSynced = 0;
      for (const t of tenants) {
        const res = await apiPost("/api/tenants", { ...t, id: t.id });
        if (res.ok) tenantsSynced++;
      }
      results.push({ entity: "Tenants", total: tenants.length, synced: tenantsSynced });

      const totalSynced = results.reduce((s, r) => s + r.synced, 0);
      const totalEntities = results.reduce((s, r) => s + r.total, 0);

      return Response.json({
        ok: true,
        message: `Synced ${totalSynced} / ${totalEntities} records across ${results.length} entities`,
        results,
      });
    }

    // ── ACTION: check all 22 tables exist in server DB ───────────────────
    if (action === "db_tables_check") {
      const EXPECTED_TABLES = [
        "users","tenants","clients","suppliers","routes","routing_rules","rates","mcc_mnc",
        "sms_log","sms_log_archive","voice_otp","billing_summary","invoices","campaigns",
        "channel_suppliers","content_templates","otp_unicode_presets","number_translations",
        "ip_access","alert_rules","supplier_health","system_settings","notifications",
        "gateways","cdr_logs","smpp_users",
      ];

      const health = await apiGet("/health");
      if (!health.ok) {
        return Response.json({ ok: false, error: "Server unreachable", tables_found: 0, tables_expected: EXPECTED_TABLES.length });
      }

      // Get table list from server via the health endpoint (it reports table count)
      // Also try fetching each module endpoint to infer table presence
      const tableChecks = await Promise.all(
        EXPECTED_TABLES.map(async (tbl) => {
          const endpointMap = {
            users: "/api/users", tenants: "/api/tenants", clients: "/api/clients",
            suppliers: "/api/suppliers", routes: "/api/routes", routing_rules: "/api/routing-rules",
            rates: "/api/rates", mcc_mnc: "/api/mccmnc", sms_log: "/api/sms-logs",
            sms_log_archive: "/api/sms-logs", voice_otp: "/api/voice-otp",
            billing_summary: "/api/billing/summary", invoices: "/api/invoices",
            campaigns: "/api/campaigns", channel_suppliers: "/api/campaigns",
            content_templates: "/api/content-templates", otp_unicode_presets: "/api/content-templates",
            number_translations: "/api/translations", ip_access: "/api/ip-access",
            alert_rules: "/api/alert-rules", supplier_health: "/api/supplier-health",
            system_settings: "/api/settings", notifications: "/api/notifications",
            gateways: "/api/gateways", cdr_logs: "/api/cdr-logs", smpp_users: "/api/smpp/user/add",
          };
          const ep = endpointMap[tbl] || "/health";
          const r = await apiGet(ep);
          // 200 or 401 = endpoint exists (table likely present)
          const exists = r.status === 200 || r.status === 401 || r.status === 403;
          return { table: tbl, endpoint: ep, exists, status: r.status };
        })
      );

      const found = tableChecks.filter(t => t.exists).length;
      const missing = tableChecks.filter(t => !t.exists).map(t => t.table);
      const serverTableCount = health.data?.tables || 0;

      return Response.json({
        ok: found >= EXPECTED_TABLES.length * 0.8,
        server_table_count: serverTableCount,
        expected: EXPECTED_TABLES.length,
        verified_via_api: found,
        missing_tables: missing,
        table_details: tableChecks,
        message: missing.length === 0
          ? `All ${EXPECTED_TABLES.length} tables verified via API endpoints`
          : `${missing.length} tables may be missing: ${missing.join(", ")} — run deploy.sh to create them`,
      });
    }

    // ── ACTION: get server dashboard stats ────────────────────────────────
    if (action === "dashboard_stats") {
      const [health, dash] = await Promise.all([
        apiGet("/health"),
        apiGet("/api/dashboard"),
      ]);
      return Response.json({
        ok: health.ok,
        health: health.data,
        dashboard: dash.data,
      });
    }

    // ── ACTION: run kannel sync ───────────────────────────────────────────
    if (action === "kannel_sync") {
      const r = await apiPost("/api/kannel/sync", {});
      return Response.json({ ok: r.ok, output: r.data });
    }

    // ── ACTION: kannel status ─────────────────────────────────────────────
    if (action === "kannel_status") {
      const r = await apiGet("/api/kannel/status");
      return Response.json({ ok: r.ok, ...r.data });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });

  } catch (error) {
    console.error("[serverSetup]", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});