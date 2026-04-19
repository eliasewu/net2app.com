// Port utility helpers for multi-tenant provisioning

export const SMPP_BASE_PORT = 9095; // existing Kannel port
export const SMPP_START = 9096;
export const HTTP_START = 4000;
export const HTTP_END = 6000;

/** Given list of tenants, return next free SMPP port */
export function nextSmppPort(tenants) {
  const used = new Set(tenants.map(t => t.smpp_port).filter(Boolean));
  let port = SMPP_START;
  while (used.has(port)) port++;
  return port;
}

/** Given list of tenants, return next free HTTP port in 4000-6000 */
export function nextHttpPort(tenants) {
  const used = new Set(tenants.map(t => t.http_port).filter(Boolean));
  let port = HTTP_START;
  while (used.has(port) && port <= HTTP_END) port++;
  return port <= HTTP_END ? port : null;
}

/** Check if a port is already taken by any tenant */
export function isSmppPortTaken(tenants, port, excludeId = null) {
  return tenants.some(t => t.smpp_port === port && t.id !== excludeId);
}
export function isHttpPortTaken(tenants, port, excludeId = null) {
  return tenants.some(t => t.http_port === port && t.id !== excludeId);
}

/** Generate Kannel smpp-server config block for a tenant */
export function generateKannelTenantConfig(tenant) {
  const id = tenant.login_username?.replace(/\W/g, '_') || 'tenant';
  return [
    `group = smpp-server`,
    `smpp-server-id = ${id}`,
    `port = ${tenant.smpp_port}`,
    `system-id = ${tenant.smpp_system_id || id + '_user'}`,
    `password = ${tenant.smpp_password || 'ChangeMe123'}`,
    `system-type = ""`,
    `log-file = "/var/log/kannel/${id}_smpp.log"`,
    `log-level = 1`,
    `# Tenant: ${tenant.company_name}  HTTP port: ${tenant.http_port}`,
  ].join('\n');
}

/** Generate UFW commands for a tenant */
export function generateUfwCommands(tenant) {
  return [
    `ufw allow ${tenant.smpp_port}/tcp`,
    `ufw allow ${tenant.http_port}/tcp`,
    `ufw reload`,
    `echo "Tenant ${tenant.company_name}: SMPP ${tenant.smpp_port} + HTTP ${tenant.http_port} opened"`,
  ].join('\n');
}

/** Package display labels */
export const PACKAGES = [
  { key: '5m_sms',                 label: '5M SMS/month',              price: 200,  sms: 5000000,   voice: 0,       voip: 0 },
  { key: '10m_sms',                label: '10M SMS/month',             price: 350,  sms: 10000000,  voice: 0,       voip: 0 },
  { key: 'unlimited_sms',          label: 'Unlimited SMS',             price: 500,  sms: 999999999, voice: 0,       voip: 0 },
  { key: 'unlimited_sms_voiceotp', label: 'Unlimited SMS + Voice OTP', price: 400,  sms: 999999999, voice: 999999,  voip: 0 },
  { key: 'voip_only',              label: 'VoIP Only',                 price: 150,  sms: 0,         voice: 0,       voip: 100000 },
  { key: 'custom',                 label: 'Custom',                    price: 0,    sms: 0,         voice: 0,       voip: 0 },
];