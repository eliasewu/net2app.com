/**
 * Net2app Dynamic Routing Engine
 * Evaluates RoutingRule records against a message context and returns
 * the ordered list of suppliers to try.
 *
 * Usage (in any page/component):
 *   import { evaluateRules } from "@/lib/routingEngine";
 *   const result = evaluateRules(rules, rates, suppliers, context);
 */

/**
 * @param {Array} rules        - All active RoutingRule records (sorted by priority asc)
 * @param {Array} rates        - All active Rate records (type=supplier)
 * @param {Array} suppliers    - All Supplier records
 * @param {Object} context     - { prefix, mcc, mnc, client_id, sender_id, nowHour, nowDay }
 * @returns {{ matchedRule, supplierOrder, reason }}
 */
export function evaluateRules(rules, rates, suppliers, context) {
  const active = [...rules]
    .filter(r => r.is_active !== false)
    .sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));

  for (const rule of active) {
    if (!matchesContext(rule, context)) continue;

    const result = applyRule(rule, rates, suppliers, context);
    if (result) return { matchedRule: rule, ...result };
  }

  // No rule matched — default: use all active suppliers sorted by priority field
  const defaults = suppliers
    .filter(s => s.status === "active" && (s.category === "sms" || !s.category))
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

  return {
    matchedRule: null,
    supplierOrder: defaults.map(s => ({ id: s.id, name: s.name, weight: null })),
    reason: "default_priority",
  };
}

function matchesContext(rule, ctx) {
  // Prefix match
  if (rule.match_prefix && ctx.prefix) {
    if (!String(ctx.prefix).startsWith(String(rule.match_prefix)) &&
        !String(rule.match_prefix).startsWith(String(ctx.prefix))) return false;
  }
  if (rule.match_mcc && rule.match_mcc !== ctx.mcc) return false;
  if (rule.match_mnc && rule.match_mnc !== ctx.mnc) return false;
  if (rule.match_client_id && rule.match_client_id !== ctx.client_id) return false;

  // Sender pattern (regex or wildcard)
  if (rule.match_sender_pattern && ctx.sender_id) {
    try {
      const re = new RegExp(rule.match_sender_pattern.replace(/\*/g, ".*"), "i");
      if (!re.test(ctx.sender_id)) return false;
    } catch { /* invalid regex — skip */ }
  }

  // Time window
  if (rule.match_time_start && rule.match_time_end && ctx.nowHour !== undefined) {
    const [sh, sm] = rule.match_time_start.split(":").map(Number);
    const [eh, em] = rule.match_time_end.split(":").map(Number);
    const nowMin = ctx.nowHour * 60 + (ctx.nowMin ?? 0);
    const startMin = sh * 60 + (sm ?? 0);
    const endMin = eh * 60 + (em ?? 0);
    if (startMin <= endMin) {
      if (nowMin < startMin || nowMin >= endMin) return false;
    } else {
      // overnight window e.g. 22:00-06:00
      if (nowMin < startMin && nowMin >= endMin) return false;
    }
  }

  // Day of week
  if (rule.match_days) {
    try {
      const days = JSON.parse(rule.match_days);
      if (Array.isArray(days) && days.length > 0 && !days.includes(ctx.nowDay)) return false;
    } catch { /* ignore */ }
  }

  return true;
}

function applyRule(rule, rates, suppliers, ctx) {
  const getSupplier = (id) => suppliers.find(s => s.id === id);
  let ids = [];
  try { ids = JSON.parse(rule.supplier_ids || "[]"); } catch { ids = []; }

  switch (rule.rule_type) {
    case "block":
      return {
        supplierOrder: [],
        reason: `blocked:${rule.block_reason || rule.name}`,
      };

    case "prefix_lock":
    case "client_override":
    case "failover": {
      const order = ids
        .map(id => getSupplier(id))
        .filter(Boolean)
        .map(s => ({ id: s.id, name: s.name, weight: null }));
      return { supplierOrder: order, reason: rule.rule_type };
    }

    case "load_balance": {
      let weights = [];
      try { weights = JSON.parse(rule.load_balance_weights || "[]"); } catch { weights = []; }
      const order = ids
        .map((id, i) => {
          const s = getSupplier(id);
          if (!s) return null;
          return { id: s.id, name: s.name, weight: weights[i] ?? Math.floor(100 / ids.length) };
        })
        .filter(Boolean);
      return { supplierOrder: order, reason: "load_balance" };
    }

    case "lcr": {
      if (rule.lcr_auto) {
        // Sort suppliers by their rate for the matched prefix/mcc/mnc
        const supplierRates = ids.length > 0 ? ids : suppliers.filter(s => s.status === "active").map(s => s.id);
        const ranked = supplierRates
          .map(id => {
            const s = getSupplier(id);
            if (!s || s.status !== "active") return null;
            const rate = findBestRate(rates, id, ctx);
            return { id, name: s.name, rate: rate ?? Infinity, weight: null };
          })
          .filter(Boolean)
          .filter(s => rule.max_cost_per_sms == null || s.rate <= rule.max_cost_per_sms)
          .sort((a, b) => a.rate - b.rate);
        return { supplierOrder: ranked.map(r => ({ id: r.id, name: r.name, weight: null, rate: r.rate })), reason: "lcr" };
      }
      // Manual LCR order
      const order = ids.map(id => getSupplier(id)).filter(Boolean).map(s => ({ id: s.id, name: s.name, weight: null }));
      return { supplierOrder: order, reason: "lcr_manual" };
    }

    case "time_based": {
      // ids in rule = suppliers to use during this time window
      const order = ids.map(id => getSupplier(id)).filter(Boolean).map(s => ({ id: s.id, name: s.name, weight: null }));
      return { supplierOrder: order, reason: "time_based" };
    }

    default:
      return null;
  }
}

function findBestRate(rates, supplierId, ctx) {
  const candidates = rates.filter(r =>
    r.type === "supplier" && r.entity_id === supplierId && r.status === "active"
  );
  // Best match: mcc+mnc > mcc only > prefix > all
  const exact = candidates.find(r => r.mcc === ctx.mcc && r.mnc === ctx.mnc);
  if (exact) return exact.rate;
  const mccOnly = candidates.find(r => r.mcc === ctx.mcc && !r.mnc);
  if (mccOnly) return mccOnly.rate;
  const prefixMatch = candidates.find(r => r.prefix && ctx.prefix?.startsWith(r.prefix));
  if (prefixMatch) return prefixMatch.rate;
  const fallback = candidates.find(r => !r.mcc);
  return fallback?.rate ?? null;
}

/** Simulate which supplier would be picked for a given weight distribution */
export function pickByWeight(supplierOrder) {
  const total = supplierOrder.reduce((s, x) => s + (x.weight ?? 0), 0);
  if (total === 0) return supplierOrder[0];
  let rand = Math.random() * total;
  for (const s of supplierOrder) {
    rand -= (s.weight ?? 0);
    if (rand <= 0) return s;
  }
  return supplierOrder[supplierOrder.length - 1];
}

export const RULE_TYPE_META = {
  lcr:             { label: "LCR — Least Cost Routing",       color: "text-green-700 bg-green-50 border-green-200",   icon: "💰" },
  load_balance:    { label: "Load Balance",                    color: "text-blue-700 bg-blue-50 border-blue-200",      icon: "⚖️" },
  failover:        { label: "Failover Chain",                  color: "text-purple-700 bg-purple-50 border-purple-200",icon: "🔁" },
  prefix_lock:     { label: "Prefix Lock",                     color: "text-orange-700 bg-orange-50 border-orange-200",icon: "📌" },
  time_based:      { label: "Time-Based Routing",              color: "text-cyan-700 bg-cyan-50 border-cyan-200",      icon: "⏰" },
  client_override: { label: "Client Override",                 color: "text-indigo-700 bg-indigo-50 border-indigo-200",icon: "👤" },
  block:           { label: "Block Traffic",                   color: "text-red-700 bg-red-50 border-red-200",         icon: "🚫" },
};