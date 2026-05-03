// ─── NET2APP v3.0 COMPLETE DEPLOY SCRIPT BUILDER ─────────────────────────────
// 22 tables, express@4, JWT, node-cron, git hard-reset, nginx -t + reload

export const ALL_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY, name VARCHAR(128), email VARCHAR(128) NOT NULL,
  password_hash VARCHAR(64) NOT NULL, role ENUM('admin','manager','viewer','reseller','customer') DEFAULT 'viewer',
  company VARCHAR(128), phone VARCHAR(32), tenant_id VARCHAR(64) DEFAULT 'default',
  balance DECIMAL(12,4) DEFAULT 0, status ENUM('active','inactive','blocked') DEFAULT 'active',
  created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uk_email (email), INDEX(tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(64) PRIMARY KEY, company_name VARCHAR(128) NOT NULL,
  login_username VARCHAR(64) NOT NULL, login_password VARCHAR(128),
  contact_email VARCHAR(128), contact_phone VARCHAR(32),
  package_type ENUM('5m_sms','10m_sms','unlimited_sms','unlimited_sms_voiceotp','voip_only','custom') DEFAULT '5m_sms',
  sms_limit BIGINT DEFAULT 5000000, voice_otp_limit BIGINT DEFAULT 0, voip_minutes_limit INT DEFAULT 0,
  sms_used BIGINT DEFAULT 0, voice_otp_used BIGINT DEFAULT 0, voip_minutes_used INT DEFAULT 0,
  monthly_price DECIMAL(12,4) DEFAULT 200, currency VARCHAR(8) DEFAULT 'USD',
  expiry_date DATE, smpp_port INT, http_port INT,
  smpp_system_id VARCHAR(64), smpp_password VARCHAR(128),
  dlr_mode ENUM('real','fake_success') DEFAULT 'real',
  kannel_config TEXT, ufw_commands TEXT,
  status ENUM('active','suspended','expired','pending') DEFAULT 'active',
  notes TEXT, created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(128) NOT NULL, contact_person VARCHAR(128), email VARCHAR(128), phone VARCHAR(32),
  connection_type ENUM('SMPP','HTTP') DEFAULT 'SMPP',
  smpp_ip VARCHAR(64), smpp_port INT DEFAULT 9096,
  smpp_username VARCHAR(64), smpp_password VARCHAR(128),
  http_url TEXT, http_method ENUM('GET','POST') DEFAULT 'POST', http_params TEXT,
  dlr_url TEXT, query_url TEXT,
  billing_type ENUM('send','submit','delivery') DEFAULT 'submit',
  force_dlr TINYINT(1) DEFAULT 0, force_dlr_timeout INT DEFAULT 30,
  status ENUM('active','inactive','blocked') DEFAULT 'active',
  credit_limit DECIMAL(12,4) DEFAULT 0, currency VARCHAR(8) DEFAULT 'USD',
  balance DECIMAL(12,4) DEFAULT 0, tps_limit INT DEFAULT 100,
  allowed_senders TEXT, daily_sms_limit INT DEFAULT 0,
  threshold_notify_email VARCHAR(256), notes TEXT,
  created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX(tenant_id), INDEX(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(128) NOT NULL,
  category ENUM('sms','voice_otp','whatsapp','telegram','device','android') DEFAULT 'sms',
  provider_type VARCHAR(64), contact_person VARCHAR(128), email VARCHAR(128), phone VARCHAR(32),
  connection_type ENUM('HTTP','SMPP','SIP','SDK','DEVICE','ANDROID') DEFAULT 'HTTP',
  smpp_ip VARCHAR(64), smpp_port INT DEFAULT 2775,
  smpp_username VARCHAR(64), smpp_password VARCHAR(128),
  http_url TEXT, http_method ENUM('GET','POST') DEFAULT 'POST', http_params TEXT,
  api_key VARCHAR(256), api_secret VARCHAR(256), account_sid VARCHAR(128), auth_token VARCHAR(256),
  dlr_url TEXT, sip_server VARCHAR(128), sip_port INT DEFAULT 5060,
  sip_username VARCHAR(64), sip_password VARCHAR(128),
  android_webhook_url TEXT, android_device_id VARCHAR(128), android_api_token VARCHAR(256),
  allowed_prefixes TEXT, allowed_mcc_mnc TEXT,
  reroute_on_fail TINYINT(1) DEFAULT 1, reroute_supplier_id VARCHAR(64),
  billing_type ENUM('send','submit','delivery') DEFAULT 'submit',
  status ENUM('active','inactive','blocked') DEFAULT 'active',
  priority INT DEFAULT 1, tps_limit INT DEFAULT 100,
  total_sent BIGINT DEFAULT 0, total_delivered BIGINT DEFAULT 0,
  total_failed BIGINT DEFAULT 0, total_rerouted BIGINT DEFAULT 0,
  bind_status VARCHAR(32) DEFAULT 'unknown', last_bind_at DATETIME,
  otp_unicode_preset VARCHAR(128), otp_unicode_enabled TINYINT(1) DEFAULT 0,
  notes TEXT, created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX(tenant_id), INDEX(category), INDEX(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS routes (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(128) NOT NULL, client_id VARCHAR(64), client_name VARCHAR(128),
  supplier_id VARCHAR(64), supplier_name VARCHAR(128),
  backup_supplier_id VARCHAR(64), backup_supplier_name VARCHAR(128),
  device_reroute_supplier_id VARCHAR(64), device_reroute_supplier_name VARCHAR(128),
  device_reroute_to ENUM('smpp','http','voice_otp','none') DEFAULT 'smpp',
  reroute_on_device_fail TINYINT(1) DEFAULT 1,
  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128), prefix VARCHAR(32),
  routing_mode ENUM('LCR','ASR','Priority','Round Robin') DEFAULT 'Priority',
  status ENUM('active','inactive','blocked') DEFAULT 'active',
  fail_count INT DEFAULT 0, auto_block_threshold INT DEFAULT 10, is_auto_blocked TINYINT(1) DEFAULT 0,
  otp_unicode_preset_id VARCHAR(64), content_template_id VARCHAR(64),
  created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX(tenant_id), INDEX(mcc,mnc), INDEX(client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS routing_rules (
  id VARCHAR(64) PRIMARY KEY, name VARCHAR(128) NOT NULL, description TEXT,
  rule_type ENUM('lcr','load_balance','failover','prefix_lock','time_based','client_override','block') DEFAULT 'lcr',
  priority INT DEFAULT 10, is_active TINYINT(1) DEFAULT 1,
  match_prefix VARCHAR(32), match_mcc VARCHAR(8), match_mnc VARCHAR(8),
  match_client_id VARCHAR(64), match_client_name VARCHAR(128),
  match_sender_pattern VARCHAR(128),
  match_time_start VARCHAR(8), match_time_end VARCHAR(8), match_days VARCHAR(64),
  supplier_ids TEXT, supplier_names TEXT, load_balance_weights TEXT,
  lcr_auto TINYINT(1) DEFAULT 1, max_cost_per_sms DECIMAL(12,6),
  block_reason VARCHAR(256),
  action_on_all_fail ENUM('reject','fallback_any','queue') DEFAULT 'reject',
  hit_count BIGINT DEFAULT 0, last_hit_at DATETIME, notes TEXT,
  created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rates (
  id VARCHAR(64) PRIMARY KEY, type ENUM('client','supplier','voice') DEFAULT 'client',
  entity_id VARCHAR(64), entity_name VARCHAR(128),
  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128), prefix VARCHAR(32),
  rate DECIMAL(12,6) DEFAULT 0, currency VARCHAR(8) DEFAULT 'USD',
  status ENUM('active','inactive','scheduled') DEFAULT 'active',
  active_from DATETIME, active_until DATETIME, superseded_by VARCHAR(64), version INT DEFAULT 1,
  created_at DATETIME DEFAULT NOW(),
  INDEX(entity_id), INDEX(mcc,mnc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mcc_mnc (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mcc VARCHAR(8) NOT NULL, mnc VARCHAR(8) NOT NULL,
  country VARCHAR(64), network VARCHAR(128), prefix VARCHAR(32), iso VARCHAR(8),
  UNIQUE KEY uk_mcc_mnc (mcc,mnc), INDEX(prefix), INDEX(country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sms_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  message_id VARCHAR(64), client_id VARCHAR(64), client_name VARCHAR(128),
  supplier_id VARCHAR(64), supplier_name VARCHAR(128), route_id VARCHAR(64),
  sender_id VARCHAR(32), destination VARCHAR(32),
  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128),
  content TEXT,
  status ENUM('pending','sent','delivered','failed','rejected','blocked') DEFAULT 'pending',
  fail_reason VARCHAR(256), dest_msg_id VARCHAR(64),
  parts TINYINT DEFAULT 1, cost DECIMAL(12,6) DEFAULT 0, sell_rate DECIMAL(12,6) DEFAULT 0,
  sms_type ENUM('transactional','promotional','otp','voice_otp') DEFAULT 'transactional',
  submit_time DATETIME DEFAULT NOW(), delivery_time DATETIME,
  client_billed TINYINT(1) DEFAULT 0,
  supplier_billed TINYINT(1) DEFAULT 0,
  INDEX(tenant_id), INDEX(destination), INDEX(client_id), INDEX(status), INDEX(submit_time), INDEX(message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sms_log_archive (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, archive_month VARCHAR(7), original_id BIGINT,
  tenant_id VARCHAR(64), message_id VARCHAR(64),
  client_id VARCHAR(64), client_name VARCHAR(128),
  supplier_id VARCHAR(64), supplier_name VARCHAR(128), route_id VARCHAR(64),
  sender_id VARCHAR(32), destination VARCHAR(32),
  mcc VARCHAR(8), mnc VARCHAR(8), country VARCHAR(64), network VARCHAR(128),
  content TEXT, status VARCHAR(32), fail_reason VARCHAR(256), dest_msg_id VARCHAR(64),
  parts TINYINT DEFAULT 1, cost DECIMAL(12,6) DEFAULT 0, sell_rate DECIMAL(12,6) DEFAULT 0,
  submit_time DATETIME, delivery_time DATETIME, sms_type VARCHAR(32), original_created_date DATETIME,
  INDEX(archive_month), INDEX(client_id), INDEX(destination)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS voice_otp (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(64) DEFAULT 'default',
  message_id VARCHAR(64), client_id VARCHAR(64), supplier_id VARCHAR(64),
  destination VARCHAR(32), otp_code VARCHAR(16),
  status ENUM('pending','calling','answered','failed','busy','no_answer') DEFAULT 'pending',
  duration_sec INT DEFAULT 0, cost DECIMAL(12,6) DEFAULT 0,
  attempt INT DEFAULT 1, fail_reason VARCHAR(256),
  submit_time DATETIME DEFAULT NOW(), answer_time DATETIME,
  INDEX(client_id), INDEX(status), INDEX(submit_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS billing_summary (
  id VARCHAR(128) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  client_id VARCHAR(64), period DATE,
  total_sms BIGINT DEFAULT 0, total_cost DECIMAL(14,4) DEFAULT 0,
  total_revenue DECIMAL(14,4) DEFAULT 0, margin DECIMAL(14,4) DEFAULT 0,
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX(tenant_id), INDEX(client_id,period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) DEFAULT 'default',
  client_id VARCHAR(64), client_name VARCHAR(128),
  invoice_number VARCHAR(32), period_start DATE, period_end DATE,
  total_sms BIGINT DEFAULT 0, amount DECIMAL(14,4) DEFAULT 0, currency VARCHAR(8) DEFAULT 'USD',
  status ENUM('draft','sent','paid','overdue') DEFAULT 'draft',
  due_date DATE, paid_at DATETIME, notes TEXT, created_at DATETIME DEFAULT NOW(),
  INDEX(client_id), INDEX(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) DEFAULT 'default',
  name VARCHAR(128), client_id VARCHAR(64), client_name VARCHAR(128),
  supplier_id VARCHAR(64), route_id VARCHAR(64),
  channel ENUM('sms','whatsapp','telegram','imo','android') DEFAULT 'sms',
  sender_id VARCHAR(32), content TEXT,
  total_recipients INT DEFAULT 0, sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0, failed_count INT DEFAULT 0,
  status ENUM('draft','scheduled','running','completed','paused','failed') DEFAULT 'draft',
  scheduled_at DATETIME, started_at DATETIME, completed_at DATETIME,
  cost_total DECIMAL(14,4) DEFAULT 0, notes TEXT, created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS channel_suppliers (
  id VARCHAR(64) PRIMARY KEY, name VARCHAR(128) NOT NULL,
  channel ENUM('whatsapp','telegram','imo','android','sms') DEFAULT 'whatsapp',
  session_id VARCHAR(128), session_status VARCHAR(32) DEFAULT 'disconnected',
  server_url TEXT, device_id VARCHAR(128), phone_number VARCHAR(32),
  allowed_prefixes TEXT, reroute_on_fail TINYINT(1) DEFAULT 1,
  reroute_supplier_id VARCHAR(64), status ENUM('active','inactive','blocked') DEFAULT 'active',
  qr_data TEXT, last_seen DATETIME, created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS content_templates (
  id VARCHAR(64) PRIMARY KEY, name VARCHAR(128) NOT NULL,
  template_type ENUM('rotation','obfuscation','translation','padding','otp') DEFAULT 'rotation',
  content TEXT, variants TEXT, apply_to TEXT,
  is_active TINYINT(1) DEFAULT 1, notes TEXT, created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS otp_unicode_presets (
  id VARCHAR(64) PRIMARY KEY, name VARCHAR(128) NOT NULL,
  description TEXT, digit_map TEXT,
  apply_to_suppliers TEXT, apply_to_routes TEXT,
  is_active TINYINT(1) DEFAULT 1, created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS number_translations (
  id VARCHAR(64) PRIMARY KEY, name VARCHAR(128),
  match_pattern VARCHAR(128), replace_with VARCHAR(128),
  match_type ENUM('prefix','regex','exact') DEFAULT 'prefix',
  apply_to ENUM('destination','sender','both') DEFAULT 'destination',
  priority INT DEFAULT 10, is_active TINYINT(1) DEFAULT 1,
  notes TEXT, created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ip_access (
  id VARCHAR(64) PRIMARY KEY, label VARCHAR(128),
  ip_address VARCHAR(64) NOT NULL, cidr VARCHAR(64),
  rule_type ENUM('allow','deny') DEFAULT 'allow',
  apply_to ENUM('api','smpp','all') DEFAULT 'all',
  is_active TINYINT(1) DEFAULT 1, notes TEXT, created_at DATETIME DEFAULT NOW(),
  INDEX(ip_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS alert_rules (
  id VARCHAR(64) PRIMARY KEY, name VARCHAR(128) NOT NULL,
  alert_type ENUM('delivery_rate_below','failure_rate_above','balance_below','volume_drop','no_traffic') DEFAULT 'delivery_rate_below',
  threshold DECIMAL(12,4), window_minutes INT DEFAULT 60, min_messages INT DEFAULT 10,
  notify_email VARCHAR(256), client_id VARCHAR(64), client_name VARCHAR(128),
  supplier_id VARCHAR(64), supplier_name VARCHAR(128),
  severity ENUM('info','warning','critical') DEFAULT 'warning',
  is_active TINYINT(1) DEFAULT 1, cooldown_minutes INT DEFAULT 60,
  last_triggered_at DATETIME, created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS supplier_health (
  id VARCHAR(64) PRIMARY KEY, supplier_id VARCHAR(64) NOT NULL, supplier_name VARCHAR(128),
  latency_ms DECIMAL(10,2) DEFAULT 0, error_rate DECIMAL(5,2) DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 100, total_checked INT DEFAULT 0, total_failed INT DEFAULT 0,
  status ENUM('healthy','degraded','critical','unknown') DEFAULT 'unknown',
  auto_disabled TINYINT(1) DEFAULT 0,
  threshold_error_rate DECIMAL(5,2) DEFAULT 30, threshold_min_messages INT DEFAULT 10,
  last_checked_at DATETIME, created_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uk_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_settings (
  id VARCHAR(64) PRIMARY KEY, setting_key VARCHAR(128) NOT NULL, setting_value TEXT,
  category ENUM('smtp','telegram','notification','backup','system','kannel') DEFAULT 'system',
  description TEXT, updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uk_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) DEFAULT 'default',
  title VARCHAR(256), message TEXT,
  type ENUM('info','warning','critical','success') DEFAULT 'info',
  category VARCHAR(64), entity_id VARCHAR(64), entity_type VARCHAR(64),
  is_read TINYINT(1) DEFAULT 0, created_at DATETIME DEFAULT NOW(),
  INDEX(tenant_id), INDEX(is_read), INDEX(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gateways (
  id VARCHAR(64) PRIMARY KEY, name VARCHAR(128) NOT NULL,
  protocol ENUM('smpp','sip','http_api') DEFAULT 'smpp',
  host VARCHAR(128) NOT NULL, port INT NOT NULL,
  status ENUM('active','inactive','maintenance') DEFAULT 'active',
  tenant_id VARCHAR(64) DEFAULT 'default', created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cdr_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  user_id VARCHAR(64), direction ENUM('inbound','outbound') DEFAULT 'outbound',
  sender VARCHAR(32), recipient VARCHAR(32) NOT NULL,
  message TEXT, units INT DEFAULT 1, cost DECIMAL(12,6) DEFAULT 0,
  status ENUM('submitted','delivered','failed') DEFAULT 'submitted',
  created_at DATETIME DEFAULT NOW(),
  INDEX(tenant_id), INDEX(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS smpp_users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  client_id VARCHAR(64) NOT NULL, smpp_username VARCHAR(64) NOT NULL,
  smpp_password VARCHAR(128), smpp_port INT DEFAULT 9096,
  status ENUM('active','inactive') DEFAULT 'active',
  last_bind DATETIME, bind_count INT DEFAULT 0,
  created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uk_user (smpp_username), INDEX idx_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS channel_sessions (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(128) NOT NULL,
  channel ENUM('whatsapp','telegram','imo','android') NOT NULL,
  session_name VARCHAR(128),
  phone_number VARCHAR(32),
  status ENUM('pending','connected','disconnected','failed') DEFAULT 'pending',
  qr_data TEXT,
  qr_generated_at DATETIME,
  connected_at DATETIME,
  last_seen DATETIME,
  supplier_id VARCHAR(64),
  notes TEXT,
  created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  INDEX(channel), INDEX(status), INDEX(session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

export const BILLING_TRIGGER_SQL = `
DROP TRIGGER IF EXISTS trg_sms_billing_insert;
DROP TRIGGER IF EXISTS trg_sms_billing_update;
DELIMITER $$

-- ── INSERT trigger: handles 'send' billing (fires immediately on log creation)
CREATE TRIGGER trg_sms_billing_insert
AFTER INSERT ON sms_log FOR EACH ROW
trig_block: BEGIN
  DECLARE v_client_billing VARCHAR(16);
  DECLARE v_supplier_billing VARCHAR(16);
  DECLARE v_force_dlr TINYINT(1);
  DECLARE v_do_client TINYINT(1) DEFAULT 0;
  DECLARE v_do_supplier TINYINT(1) DEFAULT 0;

  SELECT IFNULL(billing_type,'submit'), IFNULL(force_dlr,0)
    INTO v_client_billing, v_force_dlr FROM clients WHERE id=NEW.client_id LIMIT 1;
  SELECT IFNULL(billing_type,'submit')
    INTO v_supplier_billing FROM suppliers WHERE id=NEW.supplier_id LIMIT 1;

  -- CLIENT: 'send' billing fires on insert (non-blocked)
  IF v_client_billing='send' AND NEW.status NOT IN ('blocked') THEN SET v_do_client=1; END IF;

  -- SUPPLIER: 'send' billing fires on insert (non-blocked)
  IF v_supplier_billing='send' AND NEW.status NOT IN ('blocked') THEN SET v_do_supplier=1; END IF;

  IF v_do_client=1 THEN
    UPDATE clients SET balance=balance-NEW.sell_rate WHERE id=NEW.client_id;
    INSERT INTO billing_summary (id,tenant_id,client_id,period,total_sms,total_cost,total_revenue,margin)
    VALUES (CONCAT(NEW.client_id,'_',DATE_FORMAT(IFNULL(DATE(NEW.submit_time),CURDATE()),'%Y%m%d')),
      IFNULL(NEW.tenant_id,'default'), NEW.client_id, IFNULL(DATE(NEW.submit_time),CURDATE()),
      1, IF(v_do_supplier=1,NEW.cost,0), NEW.sell_rate, NEW.sell_rate-IF(v_do_supplier=1,NEW.cost,0))
    ON DUPLICATE KEY UPDATE
      total_sms=total_sms+1,
      total_cost=total_cost+IF(v_do_supplier=1,NEW.cost,0),
      total_revenue=total_revenue+NEW.sell_rate,
      margin=margin+(NEW.sell_rate-IF(v_do_supplier=1,NEW.cost,0)),
      updated_at=NOW();
  END IF;

END$$

-- ── UPDATE trigger: handles 'submit' and 'delivery' billing on status change
CREATE TRIGGER trg_sms_billing_update
AFTER UPDATE ON sms_log FOR EACH ROW
trig_block: BEGIN
  DECLARE v_client_billing VARCHAR(16);
  DECLARE v_supplier_billing VARCHAR(16);
  DECLARE v_force_dlr TINYINT(1);
  DECLARE v_do_client TINYINT(1) DEFAULT 0;
  DECLARE v_do_supplier TINYINT(1) DEFAULT 0;

  -- Skip if status unchanged
  IF NEW.status = OLD.status THEN LEAVE trig_block; END IF;

  SELECT IFNULL(billing_type,'submit'), IFNULL(force_dlr,0)
    INTO v_client_billing, v_force_dlr FROM clients WHERE id=NEW.client_id LIMIT 1;
  SELECT IFNULL(billing_type,'submit')
    INTO v_supplier_billing FROM suppliers WHERE id=NEW.supplier_id LIMIT 1;

  -- Skip 'send' billing — already handled by insert trigger
  IF v_client_billing='send' THEN LEAVE trig_block; END IF;

  -- CLIENT billing logic (submit + delivery only)
  IF v_client_billing='submit' THEN
    IF NEW.status NOT IN ('failed','rejected','blocked','pending') AND OLD.status IN ('pending','sent') THEN
      SET v_do_client=1;
    END IF;
  ELSEIF v_client_billing='delivery' THEN
    IF NEW.status='delivered' THEN SET v_do_client=1; END IF;
    IF v_force_dlr=1 AND NEW.status NOT IN ('failed','rejected','blocked','pending') AND OLD.status IN ('pending','sent') THEN
      SET v_do_client=1;
    END IF;
  END IF;

  -- SUPPLIER billing logic (skip 'send' — handled by insert trigger)
  IF v_supplier_billing='submit' THEN
    IF NEW.status NOT IN ('failed','rejected','blocked','pending') AND OLD.status IN ('pending','sent') THEN
      SET v_do_supplier=1;
    END IF;
  ELSEIF v_supplier_billing='delivery' THEN
    IF NEW.status='delivered' THEN SET v_do_supplier=1; END IF;
  END IF;

  IF v_do_client=1 THEN
    UPDATE clients SET balance=balance-NEW.sell_rate WHERE id=NEW.client_id;
    INSERT INTO billing_summary (id,tenant_id,client_id,period,total_sms,total_cost,total_revenue,margin)
    VALUES (CONCAT(NEW.client_id,'_',DATE_FORMAT(IFNULL(DATE(NEW.submit_time),CURDATE()),'%Y%m%d')),
      IFNULL(NEW.tenant_id,'default'), NEW.client_id, IFNULL(DATE(NEW.submit_time),CURDATE()),
      1, IF(v_do_supplier=1,NEW.cost,0), NEW.sell_rate, NEW.sell_rate-IF(v_do_supplier=1,NEW.cost,0))
    ON DUPLICATE KEY UPDATE
      total_sms=total_sms+1,
      total_cost=total_cost+IF(v_do_supplier=1,NEW.cost,0),
      total_revenue=total_revenue+NEW.sell_rate,
      margin=margin+(NEW.sell_rate-IF(v_do_supplier=1,NEW.cost,0)),
      updated_at=NOW();
  END IF;

END$$
DELIMITER ;
`;

// express@4 server with 40+ endpoints covering all 22 tables
export const SERVER_JS_CODE = `require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express  = require('express');
const mysql    = require('mysql2/promise');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const { exec } = require('child_process');
const net      = require('net');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const cron     = require('node-cron');

const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Authorization','Content-Type','X-Api-Token'] }));
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const WEBROOT = process.env.WEBROOT || '/var/www/html';
if (fs.existsSync(WEBROOT)) app.use(express.static(WEBROOT));

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST||'localhost', port: parseInt(process.env.MYSQL_PORT)||3306,
  database: process.env.MYSQL_DB, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASS,
  connectionLimit: 30, waitForConnections: true
});

const JWT_SECRET = process.env.JWT_SECRET || process.env.API_TOKEN || 'changeme';
const uuid = () => crypto.randomUUID();
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

const auth = (req,res,next) => {
  const token = (req.headers['authorization']||'').replace(/^Bearer /i,'').trim() || (req.headers['x-api-token']||'').trim();
  if (!token) return res.status(401).json({error:'No token — POST /api/auth/login to get a JWT token'});
  if (token === process.env.API_TOKEN) { req.user={id:'system',role:'admin'}; return next(); }
  try { req.user = jwt.verify(token, JWT_SECRET); return next(); }
  catch { return res.status(401).json({error:'Invalid or expired token — POST /api/auth/login'}); }
};
const adminOnly = (req,res,next) => { if(req.user?.role!=='admin') return res.status(403).json({error:'Admin only'}); next(); };

// PUBLIC
app.get('/health', async (req,res) => {
  try { await pool.execute('SELECT 1');
    const [[{cnt}]]=await pool.execute('SELECT COUNT(*) AS cnt FROM sms_log WHERE DATE(submit_time)=CURDATE()');
    const [[{tbl}]]=await pool.execute("SELECT COUNT(*) AS tbl FROM information_schema.tables WHERE table_schema=DATABASE()");
    res.json({ok:true,db:'connected',sms_today:cnt,tables:tbl,version:'3.0.0',ts:new Date().toISOString()});
  } catch(e) { res.json({ok:false,db:'disconnected',error:e.message}); }
});
app.get('/api/version', (req,res) => res.json({version:'3.0.0',standalone:true,tables:22}));
app.post('/api/auth/login', async (req,res) => {
  const {email,password}=req.body;
  if (!email||!password) return res.status(400).json({error:'email+password required'});
  const [[user]]=await pool.execute('SELECT * FROM users WHERE email=? AND status="active" LIMIT 1',[email]);
  if (!user||user.password_hash!==sha256(password)) return res.status(401).json({error:'Invalid credentials'});
  const token=jwt.sign({id:user.id,email:user.email,name:user.name,role:user.role},JWT_SECRET,{expiresIn:'24h'});
  res.json({ok:true,token,user:{id:user.id,name:user.name,email:user.email,role:user.role}});
});
app.get('/api/dlr', async (req,res) => {
  const {msgid,status}=req.query; const s=parseInt(status);
  const st=s===1?'delivered':(s===16?'pending':'failed');
  await pool.execute('UPDATE sms_log SET status=?,delivery_time=NOW() WHERE message_id=? OR dest_msg_id=?',[st,msgid,msgid]);
  res.json({ok:true});
});
app.post('/api/dlr', async (req,res) => {
  const {msgid,status}=req.body;
  const map={DELIVRD:'delivered',UNDELIV:'failed',REJECTD:'rejected',EXPIRED:'failed',DELETED:'failed'};
  const st=map[(status||'').toUpperCase()]||(parseInt(status)===1?'delivered':'failed');
  await pool.execute('UPDATE sms_log SET status=?,delivery_time=NOW() WHERE message_id=? OR dest_msg_id=?',[st,msgid,msgid]);
  res.json({ok:true});
});

app.use('/api', auth);
app.get('/api/auth/me', async (req,res) => { const [[u]]=await pool.execute('SELECT id,name,email,role,status FROM users WHERE id=?',[req.user.id]); res.json(u||{}); });
app.get('/api/dashboard', async (req,res) => {
  const [[today]]=await pool.execute("SELECT COUNT(*) AS total,SUM(status='delivered') AS delivered,SUM(status IN('failed','rejected')) AS failed,IFNULL(SUM(sell_rate),0) AS revenue,IFNULL(SUM(cost),0) AS cost FROM sms_log WHERE DATE(submit_time)=CURDATE()");
  const [[{cc}]]=await pool.execute("SELECT COUNT(*) AS cc FROM clients WHERE status='active'");
  const [[{sc}]]=await pool.execute("SELECT COUNT(*) AS sc FROM suppliers WHERE status='active'");
  const [hourly]=await pool.execute("SELECT HOUR(submit_time) AS hour,COUNT(*) AS count,SUM(status='delivered') AS delivered FROM sms_log WHERE DATE(submit_time)=CURDATE() GROUP BY HOUR(submit_time) ORDER BY hour");
  const [recent]=await pool.execute('SELECT message_id,client_name,sender_id,destination,status,submit_time,parts FROM sms_log ORDER BY submit_time DESC LIMIT 20');
  res.json({today:today[0],active_clients:cc,active_suppliers:sc,hourly,recent});
});
// USERS
app.get('/api/users', adminOnly, async (req,res) => { const [r]=await pool.execute('SELECT id,name,email,role,status,created_at FROM users ORDER BY created_at DESC'); res.json({ok:true,data:r}); });
app.post('/api/users', adminOnly, async (req,res) => {
  const {name,email,password,role}=req.body; if(!email||!password) return res.status(400).json({error:'email+password required'});
  const id=uuid(); await pool.execute('INSERT INTO users (id,name,email,password_hash,role) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),role=VALUES(role)',[id,name||email,email,sha256(password),role||'viewer']);
  res.json({ok:true,id});
});
app.put('/api/users/:id', adminOnly, async (req,res) => {
  const {name,role,status,password}=req.body;
  if(password) await pool.execute('UPDATE users SET name=?,role=?,status=?,password_hash=? WHERE id=?',[name,role,status,sha256(password),req.params.id]);
  else await pool.execute('UPDATE users SET name=?,role=?,status=? WHERE id=?',[name,role,status,req.params.id]);
  res.json({ok:true});
});
app.delete('/api/users/:id', adminOnly, async (req,res) => { await pool.execute('DELETE FROM users WHERE id=?',[req.params.id]); res.json({ok:true}); });
// CLIENTS
app.get('/api/clients', async (req,res) => { const [r]=await pool.execute('SELECT * FROM clients ORDER BY created_at DESC'); res.json({ok:true,data:r}); });
app.post('/api/clients', async (req,res) => {
  const d=req.body; if(!d.name||!d.email||!d.connection_type) return res.status(400).json({error:'name,email,connection_type required'});
  const id=d.id||uuid();
  await pool.execute('INSERT INTO clients (id,tenant_id,name,contact_person,email,phone,connection_type,smpp_ip,smpp_port,smpp_username,smpp_password,http_url,http_method,http_params,dlr_url,billing_type,force_dlr,force_dlr_timeout,status,credit_limit,currency,balance,tps_limit,allowed_senders,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),status=VALUES(status),updated_at=NOW()',
    [id,d.tenant_id||'default',d.name,d.contact_person||'',d.email,d.phone||'',d.connection_type,d.smpp_ip||'',d.smpp_port||9096,d.smpp_username||'',d.smpp_password||'',d.http_url||'',d.http_method||'POST',d.http_params||'',d.dlr_url||'',d.billing_type||'submit',d.force_dlr?1:0,d.force_dlr_timeout||30,d.status||'active',d.credit_limit||0,d.currency||'USD',d.balance||0,d.tps_limit||100,d.allowed_senders||'',d.notes||'']);
  res.json({ok:true,id});
});
app.put('/api/clients/:id', async (req,res) => {
  const d=req.body;
  await pool.execute('UPDATE clients SET name=?,contact_person=?,email=?,phone=?,connection_type=?,smpp_ip=?,smpp_port=?,smpp_username=?,smpp_password=?,billing_type=?,force_dlr=?,force_dlr_timeout=?,status=?,tps_limit=?,currency=?,balance=?,credit_limit=?,notes=?,updated_at=NOW() WHERE id=?',
    [d.name,d.contact_person||'',d.email,d.phone||'',d.connection_type,d.smpp_ip||'',d.smpp_port||9096,d.smpp_username||'',d.smpp_password||'',d.billing_type||'submit',d.force_dlr?1:0,d.force_dlr_timeout||30,d.status||'active',d.tps_limit||100,d.currency||'USD',d.balance||0,d.credit_limit||0,d.notes||'',req.params.id]);
  res.json({ok:true});
});
app.delete('/api/clients/:id', async (req,res) => { await pool.execute('DELETE FROM clients WHERE id=?',[req.params.id]); res.json({ok:true}); });
app.post('/api/clients/:id/topup', adminOnly, async (req,res) => {
  await pool.execute('UPDATE clients SET balance=balance+? WHERE id=?',[parseFloat(req.body.amount),req.params.id]);
  const [[r]]=await pool.execute('SELECT balance FROM clients WHERE id=?',[req.params.id]); res.json({ok:true,new_balance:r?.balance});
});
// SUPPLIERS
app.get('/api/suppliers', async (req,res) => { const [r]=await pool.execute('SELECT * FROM suppliers ORDER BY priority,created_at DESC'); res.json({ok:true,data:r}); });
app.post('/api/suppliers', async (req,res) => {
  const d=req.body; if(!d.name) return res.status(400).json({error:'name required'});
  const id=d.id||uuid();
  await pool.execute('INSERT INTO suppliers (id,tenant_id,name,category,provider_type,connection_type,smpp_ip,smpp_port,smpp_username,smpp_password,http_url,http_method,http_params,api_key,api_secret,dlr_url,billing_type,status,priority,tps_limit,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),billing_type=VALUES(billing_type),status=VALUES(status),updated_at=NOW()',
    [id,d.tenant_id||'default',d.name,d.category||'sms',d.provider_type||'',d.connection_type||'HTTP',d.smpp_ip||'',d.smpp_port||2775,d.smpp_username||'',d.smpp_password||'',d.http_url||'',d.http_method||'POST',d.http_params||'',d.api_key||'',d.api_secret||'',d.dlr_url||'',d.billing_type||'submit',d.status||'active',d.priority||1,d.tps_limit||100,d.notes||'']);
  res.json({ok:true,id});
});
app.put('/api/suppliers/:id', async (req,res) => {
  const d=req.body;
  await pool.execute('UPDATE suppliers SET name=?,category=?,connection_type=?,smpp_ip=?,smpp_port=?,smpp_username=?,smpp_password=?,http_url=?,api_key=?,api_secret=?,dlr_url=?,billing_type=?,status=?,priority=?,tps_limit=?,notes=?,updated_at=NOW() WHERE id=?',
    [d.name,d.category||'sms',d.connection_type||'HTTP',d.smpp_ip||'',d.smpp_port||2775,d.smpp_username||'',d.smpp_password||'',d.http_url||'',d.api_key||'',d.api_secret||'',d.dlr_url||'',d.billing_type||'submit',d.status||'active',d.priority||1,d.tps_limit||100,d.notes||'',req.params.id]);
  res.json({ok:true});
});
app.delete('/api/suppliers/:id', async (req,res) => { await pool.execute('DELETE FROM suppliers WHERE id=?',[req.params.id]); res.json({ok:true}); });
// ROUTES
app.get('/api/routes', async (req,res) => { const [r]=await pool.execute('SELECT * FROM routes ORDER BY created_at DESC'); res.json({ok:true,data:r}); });
app.post('/api/routes', async (req,res) => {
  const d=req.body; if(!d.name||!d.client_id||!d.supplier_id) return res.status(400).json({error:'name,client_id,supplier_id required'});
  const id=d.id||uuid();
  await pool.execute('INSERT INTO routes (id,tenant_id,name,client_id,client_name,supplier_id,supplier_name,backup_supplier_id,mcc,mnc,country,network,prefix,routing_mode,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),updated_at=NOW()',
    [id,d.tenant_id||'default',d.name,d.client_id,d.client_name||'',d.supplier_id,d.supplier_name||'',d.backup_supplier_id||null,d.mcc||'',d.mnc||'',d.country||'',d.network||'',d.prefix||'',d.routing_mode||'Priority',d.status||'active']);
  res.json({ok:true,id});
});
app.put('/api/routes/:id', async (req,res) => { const d=req.body; await pool.execute('UPDATE routes SET name=?,supplier_id=?,supplier_name=?,backup_supplier_id=?,mcc=?,mnc=?,routing_mode=?,status=?,updated_at=NOW() WHERE id=?',[d.name,d.supplier_id,d.supplier_name||'',d.backup_supplier_id||null,d.mcc||'',d.mnc||'',d.routing_mode||'Priority',d.status||'active',req.params.id]); res.json({ok:true}); });
app.delete('/api/routes/:id', async (req,res) => { await pool.execute('DELETE FROM routes WHERE id=?',[req.params.id]); res.json({ok:true}); });
// RATES
app.get('/api/rates', async (req,res) => {
  const {entity_id,type}=req.query; let q='SELECT * FROM rates WHERE status="active"'; const p=[];
  if(entity_id){q+=' AND entity_id=?';p.push(entity_id);} if(type){q+=' AND type=?';p.push(type);}
  const [r]=await pool.execute(q+' ORDER BY mcc,mnc',p); res.json({ok:true,data:r});
});
app.post('/api/rates', async (req,res) => {
  const d=req.body; const id=uuid();
  await pool.execute('INSERT INTO rates (id,type,entity_id,entity_name,mcc,mnc,country,network,prefix,rate,currency) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[id,d.type||'client',d.entity_id,d.entity_name||'',d.mcc||'',d.mnc||'',d.country||'',d.network||'',d.prefix||'',d.rate||0,d.currency||'USD']);
  res.json({ok:true,id});
});
app.put('/api/rates/:id', async (req,res) => { const d=req.body; await pool.execute('UPDATE rates SET rate=?,currency=?,status=? WHERE id=?',[d.rate,d.currency||'USD',d.status||'active',req.params.id]); res.json({ok:true}); });
app.delete('/api/rates/:id', async (req,res) => { await pool.execute('DELETE FROM rates WHERE id=?',[req.params.id]); res.json({ok:true}); });
// SMS LOGS
app.get('/api/sms-logs', async (req,res) => {
  const {status,client_id,destination,limit=100,offset=0,from,to}=req.query;
  let q='SELECT * FROM sms_log'; const p=[],w=[];
  if(status){w.push('status=?');p.push(status);} if(client_id){w.push('client_id=?');p.push(client_id);}
  if(destination){w.push('destination LIKE ?');p.push('%'+destination+'%');}
  if(from){w.push('submit_time>=?');p.push(from);} if(to){w.push('submit_time<=?');p.push(to);}
  if(w.length) q+=' WHERE '+w.join(' AND '); q+=' ORDER BY submit_time DESC LIMIT ? OFFSET ?'; p.push(parseInt(limit),parseInt(offset));
  const [r]=await pool.execute(q,p); res.json({ok:true,data:r});
});
// BILLING
app.get('/api/billing/summary', async (req,res) => {
  const {client_id,from,to}=req.query; let q='SELECT * FROM billing_summary'; const p=[],w=[];
  if(client_id){w.push('client_id=?');p.push(client_id);} if(from){w.push('period>=?');p.push(from);} if(to){w.push('period<=?');p.push(to);}
  if(w.length) q+=' WHERE '+w.join(' AND '); q+=' ORDER BY period DESC';
  const [r]=await pool.execute(q,p); res.json({ok:true,data:r});
});
// INVOICES
app.get('/api/invoices', async (req,res) => { const [r]=await pool.execute('SELECT * FROM invoices ORDER BY created_at DESC LIMIT 200'); res.json({ok:true,data:r}); });
app.post('/api/invoices', adminOnly, async (req,res) => {
  const d=req.body; const id=uuid(); const inv='INV-'+Date.now();
  await pool.execute('INSERT INTO invoices (id,client_id,client_name,invoice_number,period_start,period_end,total_sms,amount,currency,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[id,d.client_id,d.client_name||'',inv,d.period_start||null,d.period_end||null,d.total_sms||0,d.amount||0,d.currency||'USD',d.status||'draft',d.notes||'']);
  res.json({ok:true,id,invoice_number:inv});
});
app.put('/api/invoices/:id', adminOnly, async (req,res) => { await pool.execute('UPDATE invoices SET status=?,notes=? WHERE id=?',[req.body.status,req.body.notes||'',req.params.id]); res.json({ok:true}); });
// SETTINGS
app.get('/api/settings', adminOnly, async (req,res) => { const [r]=await pool.execute('SELECT * FROM system_settings ORDER BY category,setting_key'); res.json({ok:true,data:r}); });
app.post('/api/settings', adminOnly, async (req,res) => {
  const {setting_key,setting_value,category,description}=req.body; if(!setting_key) return res.status(400).json({error:'setting_key required'});
  const id=uuid(); await pool.execute('INSERT INTO system_settings (id,setting_key,setting_value,category,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_at=NOW()',[id,setting_key,setting_value||'',category||'system',description||'']);
  res.json({ok:true});
});
// ALERT RULES
app.get('/api/alert-rules', adminOnly, async (req,res) => { const [r]=await pool.execute('SELECT * FROM alert_rules ORDER BY created_at DESC'); res.json({ok:true,data:r}); });
app.post('/api/alert-rules', adminOnly, async (req,res) => {
  const d=req.body; const id=uuid();
  await pool.execute('INSERT INTO alert_rules (id,name,alert_type,threshold,window_minutes,min_messages,notify_email,severity,is_active,cooldown_minutes) VALUES (?,?,?,?,?,?,?,?,?,?)',[id,d.name,d.alert_type,d.threshold||0,d.window_minutes||60,d.min_messages||10,d.notify_email||'',d.severity||'warning',d.is_active!==false?1:0,d.cooldown_minutes||60]);
  res.json({ok:true,id});
});
app.put('/api/alert-rules/:id', adminOnly, async (req,res) => { const d=req.body; await pool.execute('UPDATE alert_rules SET name=?,threshold=?,notify_email=?,severity=?,is_active=? WHERE id=?',[d.name,d.threshold,d.notify_email||'',d.severity,d.is_active?1:0,req.params.id]); res.json({ok:true}); });
app.delete('/api/alert-rules/:id', adminOnly, async (req,res) => { await pool.execute('DELETE FROM alert_rules WHERE id=?',[req.params.id]); res.json({ok:true}); });
// MCC MNC
app.get('/api/mccmnc', async (req,res) => {
  const {mcc,prefix,country}=req.query; let q='SELECT * FROM mcc_mnc WHERE 1=1'; const p=[];
  if(mcc){q+=' AND mcc=?';p.push(mcc);} if(prefix){q+=' AND prefix LIKE ?';p.push(prefix+'%');} if(country){q+=' AND country LIKE ?';p.push('%'+country+'%');}
  const [r]=await pool.execute(q+' LIMIT 200',p); res.json({ok:true,data:r});
});
// KANNEL
app.get('/api/kannel/status', async (req,res) => {
  try { const r=await fetch(process.env.KANNEL_ADMIN_URL+'/status?password='+encodeURIComponent(process.env.KANNEL_ADMIN_PASS||''),{signal:AbortSignal.timeout(5000)}); const t=await r.text(); res.json({ok:true,up:t.includes('bearerbox')||t.includes('uptime'),raw:t.substring(0,800)}); }
  catch(e){res.json({ok:false,up:false,error:e.message});}
});
app.post('/api/kannel/sync', (req,res) => { exec('/opt/net2app-api/gen-kannel-conf.sh',(err,stdout,stderr)=>{res.json({ok:!err,output:(stdout||'')+(stderr||''),error:err?.message||null});}); });
app.post('/api/kannel/reload', (req,res) => { exec('kill -HUP $(pidof bearerbox) 2>/dev/null||pkill -HUP bearerbox',(err)=>{res.json({ok:!err,message:err?err.message:'Reloaded'});}); });
app.post('/api/smpp/test', (req,res) => {
  const {host,port}=req.body; if(!host||!port) return res.status(400).json({error:'host+port required'});
  const sock=new net.Socket(); const tid=setTimeout(()=>{sock.destroy();res.json({connected:false,reason:'Timeout'});},5000);
  sock.connect(parseInt(port),host,()=>{clearTimeout(tid);sock.destroy();res.json({connected:true,reason:'TCP OK'});});
  sock.on('error',err=>{clearTimeout(tid);res.json({connected:false,reason:err.message});});
});
app.post('/api/smpp/user/add', async (req,res) => {
  const {client_id,smpp_username,smpp_password,smpp_port}=req.body;
  await pool.execute("INSERT INTO smpp_users (client_id,smpp_username,smpp_password,smpp_port,status) VALUES (?,?,?,?,'active') ON DUPLICATE KEY UPDATE smpp_password=?,smpp_port=?,status='active',updated_at=NOW()",[client_id,smpp_username,smpp_password,smpp_port||9096,smpp_password,smpp_port||9096]);
  res.json({ok:true});
});
// NOTIFICATIONS
app.get('/api/notifications', async (req,res) => { const {tenant_id='default'}=req.query; const [r]=await pool.execute('SELECT * FROM notifications WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100',[tenant_id]); res.json({ok:true,data:r}); });
app.put('/api/notifications/:id/read', async (req,res) => { await pool.execute('UPDATE notifications SET is_read=1 WHERE id=?',[req.params.id]); res.json({ok:true}); });
// REPORTS
app.get('/api/reports/traffic', async (req,res) => {
  const {from,to,group_by='day'}=req.query; const fmt=group_by==='hour'?'%Y-%m-%d %H:00:00':'%Y-%m-%d';
  let q="SELECT DATE_FORMAT(submit_time,?) AS period,COUNT(*) AS total,SUM(status='delivered') AS delivered,SUM(status IN('failed','rejected')) AS failed,ROUND(SUM(sell_rate),2) AS revenue,ROUND(SUM(cost),2) AS cost FROM sms_log WHERE 1=1"; const p=[fmt];
  if(from){q+=' AND submit_time>=?';p.push(from);} if(to){q+=' AND submit_time<=?';p.push(to);}
  const [r]=await pool.execute(q+' GROUP BY period ORDER BY period DESC LIMIT 90',p); res.json({ok:true,data:r});
});
// GATEWAYS
app.get('/api/gateways', async (req,res) => { const [r]=await pool.execute('SELECT * FROM gateways ORDER BY created_at DESC'); res.json({ok:true,data:r}); });
app.post('/api/gateways', async (req,res) => {
  const d=req.body; if(!d.name||!d.host||!d.port) return res.status(400).json({error:'name,host,port required'});
  const id=d.id||uuid();
  await pool.execute('INSERT INTO gateways (id,name,protocol,host,port,status,tenant_id) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status)',[id,d.name,d.protocol||'smpp',d.host,d.port,d.status||'active',d.tenant_id||'default']);
  res.json({ok:true,id});
});
app.put('/api/gateways/:id', async (req,res) => { const d=req.body; await pool.execute('UPDATE gateways SET name=?,protocol=?,host=?,port=?,status=? WHERE id=?',[d.name,d.protocol,d.host,d.port,d.status,req.params.id]); res.json({ok:true}); });
app.delete('/api/gateways/:id', async (req,res) => { await pool.execute('DELETE FROM gateways WHERE id=?',[req.params.id]); res.json({ok:true}); });
// CDR LOGS
app.get('/api/cdr-logs', async (req,res) => {
  const {tenant_id='default',limit=50}=req.query;
  const [r]=await pool.execute('SELECT * FROM cdr_logs WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?',[tenant_id,parseInt(limit)]);
  res.json({ok:true,data:r});
});
app.post('/api/cdr-logs', async (req,res) => {
  const d=req.body; if(!d.recipient||!d.tenant_id) return res.status(400).json({error:'recipient+tenant_id required'});
  await pool.execute('INSERT INTO cdr_logs (tenant_id,user_id,direction,sender,recipient,message,units,cost,status) VALUES (?,?,?,?,?,?,?,?,?)',[d.tenant_id,d.user_id||null,d.direction||'outbound',d.sender||'',d.recipient,d.message||'',d.units||1,d.cost||0,d.status||'submitted']);
  res.json({ok:true});
});
// TENANTS
app.get('/api/tenants', adminOnly, async (req,res) => { const [r]=await pool.execute('SELECT id,company_name,login_username,contact_email,package_type,sms_limit,sms_used,status,expiry_date FROM tenants ORDER BY created_at DESC'); res.json({ok:true,data:r}); });
app.post('/api/tenants', adminOnly, async (req,res) => {
  const d=req.body; if(!d.company_name) return res.status(400).json({error:'company_name required'});
  const id=d.id||uuid();
  await pool.execute('INSERT INTO tenants (id,company_name,login_username,login_password,contact_email,contact_phone,package_type,sms_limit,monthly_price,currency,smpp_port,http_port,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status)',
    [id,d.company_name,d.login_username||d.company_name.toLowerCase().replace(/\\s/g,'_'),d.login_password||'',d.contact_email||'',d.contact_phone||'',d.package_type||'5m_sms',d.sms_limit||5000000,d.monthly_price||200,d.currency||'USD',d.smpp_port||null,d.http_port||null,d.status||'active',d.notes||'']);
  res.json({ok:true,id});
});
app.put('/api/tenants/:id', adminOnly, async (req,res) => { const d=req.body; await pool.execute('UPDATE tenants SET company_name=?,status=?,sms_limit=?,monthly_price=?,expiry_date=? WHERE id=?',[d.company_name,d.status,d.sms_limit,d.monthly_price,d.expiry_date||null,req.params.id]); res.json({ok:true}); });
app.delete('/api/tenants/:id', adminOnly, async (req,res) => { await pool.execute('DELETE FROM tenants WHERE id=?',[req.params.id]); res.json({ok:true}); });
// NUMBER TRANSLATIONS
app.get('/api/translations', async (req,res) => { const [r]=await pool.execute('SELECT * FROM number_translations ORDER BY priority,created_at DESC'); res.json({ok:true,data:r}); });
app.post('/api/translations', async (req,res) => {
  const d=req.body; const id=uuid();
  await pool.execute('INSERT INTO number_translations (id,name,match_pattern,replace_with,match_type,apply_to,priority,is_active,notes) VALUES (?,?,?,?,?,?,?,?,?)',[id,d.name||'',d.match_pattern||'',d.replace_with||'',d.match_type||'prefix',d.apply_to||'destination',d.priority||10,d.is_active!==false?1:0,d.notes||'']);
  res.json({ok:true,id});
});
app.put('/api/translations/:id', async (req,res) => { const d=req.body; await pool.execute('UPDATE number_translations SET name=?,match_pattern=?,replace_with=?,match_type=?,apply_to=?,priority=?,is_active=?,notes=? WHERE id=?',[d.name||'',d.match_pattern||'',d.replace_with||'',d.match_type||'prefix',d.apply_to||'destination',d.priority||10,d.is_active?1:0,d.notes||'',req.params.id]); res.json({ok:true}); });
app.delete('/api/translations/:id', async (req,res) => { await pool.execute('DELETE FROM number_translations WHERE id=?',[req.params.id]); res.json({ok:true}); });
// IP ACCESS
app.get('/api/ip-access', async (req,res) => { const [r]=await pool.execute('SELECT * FROM ip_access ORDER BY created_at DESC'); res.json({ok:true,data:r}); });
app.post('/api/ip-access', async (req,res) => {
  const d=req.body; const id=uuid();
  await pool.execute('INSERT INTO ip_access (id,label,ip_address,cidr,rule_type,apply_to,is_active,notes) VALUES (?,?,?,?,?,?,?,?)',[id,d.label||'',d.ip_address,d.cidr||'',d.rule_type||'allow',d.apply_to||'all',d.is_active!==false?1:0,d.notes||'']);
  res.json({ok:true,id});
});
app.put('/api/ip-access/:id', async (req,res) => { const d=req.body; await pool.execute('UPDATE ip_access SET label=?,ip_address=?,rule_type=?,apply_to=?,is_active=?,notes=? WHERE id=?',[d.label||'',d.ip_address,d.rule_type,d.apply_to,d.is_active?1:0,d.notes||'',req.params.id]); res.json({ok:true}); });
app.delete('/api/ip-access/:id', async (req,res) => { await pool.execute('DELETE FROM ip_access WHERE id=?',[req.params.id]); res.json({ok:true}); });
// ROUTING RULES
app.get('/api/routing-rules', async (req,res) => { const [r]=await pool.execute('SELECT * FROM routing_rules ORDER BY priority,created_at DESC'); res.json({ok:true,data:r}); });
app.post('/api/routing-rules', async (req,res) => {
  const d=req.body; const id=uuid();
  await pool.execute('INSERT INTO routing_rules (id,name,description,rule_type,priority,is_active,match_prefix,match_mcc,match_mnc,match_client_id,match_client_name,supplier_ids,supplier_names,load_balance_weights,lcr_auto,max_cost_per_sms,block_reason,action_on_all_fail,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,d.name,d.description||'',d.rule_type||'lcr',d.priority||10,d.is_active!==false?1:0,d.match_prefix||'',d.match_mcc||'',d.match_mnc||'',d.match_client_id||'',d.match_client_name||'',d.supplier_ids||'[]',d.supplier_names||'[]',d.load_balance_weights||'[]',d.lcr_auto?1:0,d.max_cost_per_sms||null,d.block_reason||'',d.action_on_all_fail||'reject',d.notes||'']);
  res.json({ok:true,id});
});
app.put('/api/routing-rules/:id', async (req,res) => { const d=req.body; await pool.execute('UPDATE routing_rules SET name=?,rule_type=?,priority=?,is_active=?,match_prefix=?,match_mcc=?,supplier_ids=?,supplier_names=?,load_balance_weights=?,notes=? WHERE id=?',[d.name,d.rule_type,d.priority,d.is_active?1:0,d.match_prefix||'',d.match_mcc||'',d.supplier_ids||'[]',d.supplier_names||'[]',d.load_balance_weights||'[]',d.notes||'',req.params.id]); res.json({ok:true}); });
app.delete('/api/routing-rules/:id', async (req,res) => { await pool.execute('DELETE FROM routing_rules WHERE id=?',[req.params.id]); res.json({ok:true}); });
// CAMPAIGNS
app.get('/api/campaigns', async (req,res) => { const [r]=await pool.execute('SELECT * FROM campaigns ORDER BY created_at DESC'); res.json({ok:true,data:r}); });
app.post('/api/campaigns', async (req,res) => {
  const d=req.body; const id=uuid();
  await pool.execute('INSERT INTO campaigns (id,tenant_id,name,client_id,client_name,supplier_id,route_id,channel,sender_id,content,total_recipients,status,scheduled_at,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,d.tenant_id||'default',d.name,d.client_id,d.client_name||'',d.supplier_id||null,d.route_id||null,d.channel||'sms',d.sender_id||'',d.content||'',d.total_recipients||0,d.status||'draft',d.scheduled_at||null,d.notes||'']);
  res.json({ok:true,id});
});
app.put('/api/campaigns/:id', async (req,res) => { const d=req.body; await pool.execute('UPDATE campaigns SET name=?,status=?,sent_count=?,delivered_count=?,failed_count=? WHERE id=?',[d.name,d.status,d.sent_count||0,d.delivered_count||0,d.failed_count||0,req.params.id]); res.json({ok:true}); });
app.delete('/api/campaigns/:id', async (req,res) => { await pool.execute('DELETE FROM campaigns WHERE id=?',[req.params.id]); res.json({ok:true}); });
// CONTENT TEMPLATES
app.get('/api/content-templates', async (req,res) => { const [r]=await pool.execute('SELECT * FROM content_templates ORDER BY created_at DESC'); res.json({ok:true,data:r}); });
app.post('/api/content-templates', async (req,res) => {
  const d=req.body; const id=uuid();
  await pool.execute('INSERT INTO content_templates (id,name,template_type,content,variants,is_active,notes) VALUES (?,?,?,?,?,?,?)',[id,d.name,d.template_type||'rotation',d.content||'',d.variants||'[]',d.is_active!==false?1:0,d.notes||'']);
  res.json({ok:true,id});
});
app.delete('/api/content-templates/:id', async (req,res) => { await pool.execute('DELETE FROM content_templates WHERE id=?',[req.params.id]); res.json({ok:true}); });
// VOICE OTP
app.get('/api/voice-otp', async (req,res) => {
  const {client_id,status,limit=50}=req.query; let q='SELECT * FROM voice_otp WHERE 1=1'; const p=[];
  if(client_id){q+=' AND client_id=?';p.push(client_id);} if(status){q+=' AND status=?';p.push(status);}
  const [r]=await pool.execute(q+' ORDER BY submit_time DESC LIMIT ?',[...p,parseInt(limit)]); res.json({ok:true,data:r});
});
app.post('/api/voice-otp', async (req,res) => {
  const d=req.body; if(!d.destination||!d.client_id) return res.status(400).json({error:'destination+client_id required'});
  const id=uuid(); const msg_id='VOTP-'+Date.now();
  await pool.execute('INSERT INTO voice_otp (tenant_id,message_id,client_id,supplier_id,destination,otp_code,status) VALUES (?,?,?,?,?,?,?)',[d.tenant_id||'default',msg_id,d.client_id,d.supplier_id||null,d.destination,d.otp_code||'',d.status||'pending']);
  res.json({ok:true,message_id:msg_id});
});
// SUPPLIER HEALTH
app.get('/api/supplier-health', async (req,res) => { const [r]=await pool.execute('SELECT * FROM supplier_health ORDER BY last_checked_at DESC'); res.json({ok:true,data:r}); });
// BILLING — topup/deduct
app.post('/api/billing/deduct', adminOnly, async (req,res) => {
  const {client_id,amount,reason}=req.body;
  await pool.execute('UPDATE clients SET balance=balance-? WHERE id=?',[parseFloat(amount),client_id]);
  const [[r]]=await pool.execute('SELECT balance FROM clients WHERE id=?',[client_id]); res.json({ok:true,new_balance:r?.balance});
});
app.post('/api/billing/topup', adminOnly, async (req,res) => {
  const {client_id,amount}=req.body;
  await pool.execute('UPDATE clients SET balance=balance+? WHERE id=?',[parseFloat(amount),client_id]);
  const [[r]]=await pool.execute('SELECT balance FROM clients WHERE id=?',[client_id]); res.json({ok:true,new_balance:r?.balance});
});
// SMS LOG — update status (for DLR + billing)
app.put('/api/sms-logs/:id', async (req,res) => {
  const {status,delivery_time,dest_msg_id,fail_reason}=req.body;
  await pool.execute('UPDATE sms_log SET status=?,delivery_time=?,dest_msg_id=?,fail_reason=?,updated_at=NOW() WHERE id=? OR message_id=?',[status,delivery_time||null,dest_msg_id||null,fail_reason||null,req.params.id,req.params.id]);
  res.json({ok:true});
});
// SMPP RELOAD
app.post('/api/smpp/reload', (req,res) => { exec('kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null || true',(err)=>{res.json({ok:true,message:'Reload signal sent'});}); });
app.post('/api/smpp/user/remove', async (req,res) => {
  const {smpp_username}=req.body;
  await pool.execute("UPDATE smpp_users SET status='inactive' WHERE smpp_username=?",[smpp_username]);
  res.json({ok:true});
});
// DEVICE SESSIONS — QR connect for WhatsApp/Telegram/IMO
app.post('/api/device/qr', async (req,res) => {
  const {channel,session_name}=req.body;
  if(!channel) return res.status(400).json({error:'channel required'});
  const sessionId='sess_'+channel+'_'+Date.now();
  const id=uuid();
  await pool.execute('INSERT INTO channel_sessions (id,session_id,channel,session_name,status,qr_generated_at) VALUES (?,?,?,?,"pending",NOW())',[id,sessionId,channel,session_name||sessionId]);
  // Try WPPConnect (WhatsApp) or return placeholder for others
  if(channel==='whatsapp') {
    try {
      const wppRes=await fetch('http://127.0.0.1:21465/api/'+sessionId+'/start-session',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer net2app_wpp_token'},body:'{}',signal:AbortSignal.timeout(5000)});
      if(wppRes.ok){
        const wppData=await wppRes.json().catch(()=>({}));
        const qr=wppData.qrcode||wppData.qr||null;
        if(qr){ await pool.execute('UPDATE channel_sessions SET qr_data=? WHERE id=?',[qr,id]); return res.json({ok:true,qr_data:qr,session_id:sessionId}); }
      }
    } catch{}
  }
  if(channel==='telegram') {
    try {
      const tgRes=await fetch('http://127.0.0.1:3000/api/telegram/qr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sessionId}),signal:AbortSignal.timeout(5000)});
      if(tgRes.ok){ const d=await tgRes.json(); if(d.qr){ await pool.execute('UPDATE channel_sessions SET qr_data=? WHERE id=?',[d.qr,id]); return res.json({ok:true,qr_data:d.qr,session_id:sessionId}); } }
    } catch{}
  }
  res.json({ok:false,session_id:sessionId,error:'Session service not available — use manual QR'});
});
app.post('/api/device/status', async (req,res) => {
  const {channel,session_id}=req.body;
  const [[sess]]=await pool.execute('SELECT * FROM channel_sessions WHERE session_id=? LIMIT 1',[session_id]);
  if(!sess) return res.json({connected:false,reason:'Session not found'});
  if(sess.status==='connected') return res.json({connected:true,phone:sess.phone_number});
  if(channel==='whatsapp') {
    try {
      const r=await fetch('http://127.0.0.1:21465/api/'+session_id+'/check-connection-session',{headers:{'Authorization':'Bearer net2app_wpp_token'},signal:AbortSignal.timeout(3000)});
      if(r.ok){ const d=await r.json(); if(d.status===true||d.connected){ await pool.execute('UPDATE channel_sessions SET status="connected",connected_at=NOW(),phone_number=? WHERE session_id=?',[d.phone||'',session_id]); return res.json({connected:true,phone:d.phone||''}); } }
    } catch{}
  }
  res.json({connected:false,status:sess.status});
});

// SPA fallback — app.use() is express@4 compatible (not app.get('*') which breaks in express v5)
app.use((req,res) => {
  const idx=path.join(WEBROOT,'index.html');
  if(fs.existsSync(idx)) res.sendFile(idx);
  else res.json({service:'Net2app Standalone API v3.0',tables:22,login:'POST /api/auth/login'});
});

// Daily billing cron
cron.schedule('0 0 * * *', async () => {
  try {
    await pool.execute("INSERT INTO billing_summary (id,tenant_id,client_id,period,total_sms,total_cost,total_revenue,margin) SELECT CONCAT(client_id,'_',DATE_FORMAT(CURDATE()-INTERVAL 1 DAY,'%Y%m%d')),tenant_id,client_id,CURDATE()-INTERVAL 1 DAY,COUNT(*),IFNULL(SUM(cost),0),IFNULL(SUM(sell_rate),0),IFNULL(SUM(sell_rate-cost),0) FROM sms_log WHERE DATE(submit_time)=CURDATE()-INTERVAL 1 DAY GROUP BY client_id ON DUPLICATE KEY UPDATE updated_at=NOW()");
    console.log('[CRON] billing summary updated');
  } catch(e){console.error('[CRON]',e.message);}
});

const PORT=process.env.PORT||5000;
app.listen(PORT,'0.0.0.0',async()=>{
  console.log('Net2app Standalone API v3.0 — 22 tables — port '+PORT);
  try{await pool.execute('SELECT 1');console.log('MariaDB: connected');}catch(e){console.error('MariaDB:',e.message);}
});
`;

export function buildDeployScript(c) {
  return [
    '#!/bin/bash',
    '# ════════════════════════════════════════════════════════════════════',
    '#  NET2APP v3.0 — COMPLETE STANDALONE DEBIAN 12 DEPLOYMENT',
    '#  22 TABLES — express@4 pinned — JWT auth — node-cron',
    '#  git hard-reset — npm install --include=dev — nginx -t + reload',
    '# ════════════════════════════════════════════════════════════════════',
    '[ "$EUID" -ne 0 ] && exec sudo bash "$0" "$@"',
    'export DEBIAN_FRONTEND=noninteractive',
    'GREEN="\\033[0;32m"; RED="\\033[0;31m"; YELLOW="\\033[1;33m"; BLUE="\\033[0;34m"; NC="\\033[0m"',
    'ok()     { echo -e "${GREEN}[OK]${NC} $1"; }',
    'fail()   { echo -e "${RED}[FAIL]${NC} $1"; }',
    'info()   { echo -e "${YELLOW}[i]${NC} $1"; }',
    'header() { echo -e "\\n${BLUE}══ $1 ══${NC}\\n"; }',
    '',
    `DB_ROOT_PASS="${c.dbRootPass}"`,
    `DB_APP_USER="${c.dbAppUser}"`,
    `DB_APP_PASS="${c.dbAppPass}"`,
    `DB_NAME="${c.dbName}"`,
    `KANNEL_ADMIN_PASS="${c.kannelPass}"`,
    `API_TOKEN="${c.apiToken}"`,
    `ADMIN_PASS="Admin@2025!"`,
    'GITHUB_REPO="https://github.com/eliasewu/net2app.com.git"',
    'DEPLOY_DIR="/opt/net2app"',
    'WEBROOT="/var/www/html"',
    'API_DIR="/opt/net2app-api"',
    'BRANCH="main"',
    `VITE_APP_ID="${c.appId}"`,
    `VITE_APP_BASE_URL="${c.appBaseUrl}"`,
    `VITE_FUNCTIONS_VERSION="${c.funcVersion}"`,
    '',
    'echo ""',
    'echo "════════════════════════════════════════════════════════════"',
    'echo "  NET2APP v3.0 — 22 TABLES — $(date)"',
    'echo "════════════════════════════════════════════════════════════"',
    '',

    'header "STEP 1: System Update + Base Packages"',
    'apt-get update -y && apt-get upgrade -y',
    'apt-get install -y build-essential git curl wget vim net-tools ufw fail2ban \\',
    '  lsb-release gnupg ca-certificates libssl-dev libxml2-dev uuid-dev pkg-config \\',
    '  nginx mariadb-server mariadb-client kannel python3 unzip',
    'ok "Base packages ready"',
    '',

    'header "STEP 2: Node.js 20 + PM2"',
    'which node &>/dev/null || { curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; apt-get install -y nodejs; }',
    'which pm2  &>/dev/null || npm install -g pm2',
    'ok "Node $(node -v) + PM2 ready"',
    '',

    'header "STEP 3: MariaDB — Database + User"',
    'systemctl enable mariadb && systemctl start mariadb && sleep 2',
    `mysql -u root -p"$DB_ROOT_PASS" -e "SELECT 1" 2>/dev/null || mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$DB_ROOT_PASS'; FLUSH PRIVILEGES;"`,
    'mysql -u root -p"$DB_ROOT_PASS" <<DBSETUP',
    'CREATE DATABASE IF NOT EXISTS net2app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;',
    "SET @s = CONCAT(\"DROP USER IF EXISTS '\", '$DB_APP_USER', \"'@'localhost'\"); PREPARE st FROM @s; EXECUTE st;",
    "SET @s = CONCAT(\"CREATE USER '\", '$DB_APP_USER', \"'@'localhost' IDENTIFIED BY '\", '$DB_APP_PASS', \"'\"); PREPARE st FROM @s; EXECUTE st;",
    "SET @s = CONCAT(\"GRANT ALL PRIVILEGES ON \", '$DB_NAME', \".* TO '\", '$DB_APP_USER', \"'@'localhost'\"); PREPARE st FROM @s; EXECUTE st;",
    'FLUSH PRIVILEGES;',
    'DBSETUP',
    'ok "MariaDB: database + user ready"',
    '',

    'header "STEP 4: ALL 22 TABLES"',
    "cat > /tmp/net2app_schema.sql << 'SCHEMAEOF'",
    ALL_TABLES_SQL,
    'SCHEMAEOF',
    `mysql -u root -p"$DB_ROOT_PASS" $DB_NAME < /tmp/net2app_schema.sql && ok "All 22 tables created" || fail "Schema import failed"`,
    'rm -f /tmp/net2app_schema.sql',
    '',

    'header "STEP 5: Admin User (admin@net2app.local / Admin@2025!)"',
    `ADMIN_HASH=$(echo -n "Admin@2025!" | sha256sum | awk '{print $1}')`,
    `mysql -u root -p"$DB_ROOT_PASS" $DB_NAME -e "INSERT INTO users (id,name,email,password_hash,role,status) VALUES (UUID(),'Admin','admin@net2app.local','$ADMIN_HASH','admin','active') ON DUPLICATE KEY UPDATE password_hash='$ADMIN_HASH';"`,
    'ok "Admin user ready"',
    '',

    'header "STEP 6: Billing Trigger (labeled block — no syntax error)"',
    "cat > /tmp/net2app_trigger.sql << 'TRIGEOF'",
    BILLING_TRIGGER_SQL,
    'TRIGEOF',
    `mysql -u root -p"$DB_ROOT_PASS" $DB_NAME < /tmp/net2app_trigger.sql && ok "Billing trigger created" || fail "Trigger failed"`,
    'rm -f /tmp/net2app_trigger.sql',
    '',

    'header "STEP 7: Kannel SMS Gateway"',
    'mkdir -p /etc/kannel /var/log/kannel && chmod 755 /var/log/kannel',
    'cat > /etc/kannel/kannel.conf << KANNELEOF',
    'group = core',
    'admin-port = 13000',
    `admin-password = ${c.kannelPass}`,
    `status-password = ${c.kannelPass}`,
    'smsbox-port = 13001',
    'log-file = "/var/log/kannel/bearerbox.log"',
    'log-level = 1',
    'box-allow-ip = 127.0.0.1',
    'access-log = "/var/log/kannel/access.log"',
    'unified-prefix = "+,00,011"',
    '',
    'group = smsbox',
    'smsbox-id = "net2app_smsbox"',
    'bearerbox-host = 127.0.0.1',
    'bearerbox-port = 13001',
    'sendsms-port = 13013',
    'sendsms-interface = 127.0.0.1',
    'log-file = "/var/log/kannel/smsbox.log"',
    'log-level = 1',
    'global-sender = "NET2APP"',
    'max-msgs-per-second = 500',
    'dlr-url = "http://127.0.0.1:5000/api/dlr?msgid=%i&status=%d&to=%p&from=%A"',
    'KANNELEOF',
    "cat > /etc/systemd/system/kannel-bearerbox.service << 'EOF'",
    '[Unit]',
    'Description=Kannel Bearerbox',
    'After=network.target',
    '[Service]',
    'Type=simple',
    'ExecStart=/usr/sbin/bearerbox /etc/kannel/kannel.conf',
    'Restart=always',
    'RestartSec=5',
    'User=root',
    '[Install]',
    'WantedBy=multi-user.target',
    'EOF',
    "cat > /etc/systemd/system/kannel-smsbox.service << 'EOF'",
    '[Unit]',
    'Description=Kannel Smsbox',
    'After=kannel-bearerbox.service',
    'Requires=kannel-bearerbox.service',
    '[Service]',
    'Type=simple',
    'ExecStartPre=/bin/sleep 6',
    'ExecStart=/usr/sbin/smsbox /etc/kannel/kannel.conf',
    'Restart=always',
    'RestartSec=5',
    'User=root',
    '[Install]',
    'WantedBy=multi-user.target',
    'EOF',
    'systemctl daemon-reload',
    'systemctl enable kannel-bearerbox kannel-smsbox',
    'pkill -f bearerbox 2>/dev/null || true; pkill -f smsbox 2>/dev/null || true; sleep 3',
    'systemctl start kannel-bearerbox; sleep 8',
    'systemctl start kannel-smsbox;    sleep 6',
    'systemctl is-active kannel-bearerbox && ok "Kannel bearerbox: RUNNING" || { systemctl restart kannel-bearerbox; sleep 6; systemctl is-active kannel-bearerbox && ok "Kannel bearerbox: RUNNING" || fail "Bearerbox: FAILED"; }',
    'systemctl is-active kannel-smsbox    && ok "Kannel smsbox: RUNNING"    || { systemctl restart kannel-smsbox;    sleep 6; systemctl is-active kannel-smsbox    && ok "Kannel smsbox: RUNNING"    || fail "Smsbox: FAILED"; }',
    '',

    'header "STEP 8: Kannel Auto-Sync Script"',
    'mkdir -p $API_DIR',
    "cat > $API_DIR/gen-kannel-conf.sh << 'GENKEOF'",
    '#!/bin/bash',
    `DB_USER="${c.dbAppUser}"; DB_PASS="${c.dbAppPass}"; DB_NAME="${c.dbName}"; KANNEL_PASS="${c.kannelPass}"`,
    'CONF=/etc/kannel/kannel.conf; BAK=/etc/kannel/kannel.conf.bak.$(date +%s)',
    '[ -f "$CONF" ] && cp "$CONF" "$BAK"',
    'cat > "$CONF" << COREEOF',
    'group = core',
    'admin-port = 13000',
    `admin-password = ${c.kannelPass}`,
    `status-password = ${c.kannelPass}`,
    'smsbox-port = 13001',
    'log-file = "/var/log/kannel/bearerbox.log"',
    'log-level = 1',
    'box-allow-ip = 127.0.0.1',
    'access-log = "/var/log/kannel/access.log"',
    'unified-prefix = "+,00,011"',
    '',
    'group = smsbox',
    'smsbox-id = "net2app_smsbox"',
    'bearerbox-host = 127.0.0.1',
    'bearerbox-port = 13001',
    'sendsms-port = 13013',
    'sendsms-interface = 127.0.0.1',
    'log-file = "/var/log/kannel/smsbox.log"',
    'log-level = 1',
    'global-sender = "NET2APP"',
    'max-msgs-per-second = 500',
    'dlr-url = "http://127.0.0.1:5000/api/dlr?msgid=%i&status=%d&to=%p&from=%A"',
    'COREEOF',
    "mysql -u \"$DB_USER\" -p\"$DB_PASS\" \"$DB_NAME\" -N -B -e \"SELECT name,smpp_ip,smpp_port,smpp_username,smpp_password,tps_limit FROM suppliers WHERE connection_type='SMPP' AND status='active'\" 2>/dev/null | while IFS=$'\\t' read -r name ip port user pass tps; do",
    '  tps=${tps:-100}',
    '  printf "\\ngroup = smsc\\nsmsc = smpp\\nsmsc-id = \\"%s\\"\\nhost = %s\\nport = %s\\nsmsc-username = \\"%s\\"\\nsmsc-password = \\"%s\\"\\ntransceiver-mode = true\\nreconnect-delay = 10\\nmax-pending-submits = %s\\n" "$name" "$ip" "$port" "$user" "$pass" "$tps" >> "$CONF"',
    'done',
    "mysql -u \"$DB_USER\" -p\"$DB_PASS\" \"$DB_NAME\" -N -B -e \"SELECT name,smpp_username,smpp_password,smpp_port,tps_limit FROM clients WHERE connection_type='SMPP' AND status='active' AND smpp_username IS NOT NULL AND smpp_username<>''\" 2>/dev/null | while IFS=$'\\t' read -r cname user pass port tps; do",
    '  port=${port:-9096}; tps=${tps:-100}',
    '  sid=$(echo "$cname" | tr " " "_" | tr -cd "a-zA-Z0-9_-")',
    '  printf "\\ngroup = smpp-server\\nport = %s\\nsmpp-server-id = \\"%s\\"\\nsystem-id = \\"%s\\"\\npassword = \\"%s\\"\\nsystem-type = \\"\\"\\ninterface-version = 34\\nmax-binds = 10\\nallow-ip = \\"*.*.*.*\\"\\nthroughput = %s\\n" "$port" "$sid" "$user" "$pass" "$tps" >> "$CONF"',
    'done',
    'kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null || true',
    'echo "[OK] kannel.conf regenerated and reloaded"',
    'GENKEOF',
    'chmod +x $API_DIR/gen-kannel-conf.sh',
    'ok "gen-kannel-conf.sh ready"',
    '',

    'header "STEP 9: API Server (express@4, JWT, 40+ endpoints)"',
    'cd $API_DIR && npm init -y 2>/dev/null | tail -1',
    '# express@4 pinned — avoids path-to-regexp crash in express v5',
    'npm install express@4 mysql2 cors dotenv jsonwebtoken node-cron 2>&1 | tail -3',
    '',
    'cat > $API_DIR/.env << ENVEOF',
    'PORT=5000',
    'MYSQL_HOST=localhost',
    'MYSQL_PORT=3306',
    `MYSQL_DB=${c.dbName}`,
    `MYSQL_USER=${c.dbAppUser}`,
    `MYSQL_PASS=${c.dbAppPass}`,
    `JWT_SECRET=${c.apiToken}`,
    'KANNEL_ADMIN_URL=http://127.0.0.1:13000',
    `KANNEL_ADMIN_PASS=${c.kannelPass}`,
    `API_TOKEN=${c.apiToken}`,
    'WEBROOT=/var/www/html',
    'ENVEOF',
    'chmod 600 $API_DIR/.env',
    '',
    "cat > $API_DIR/server.js << 'SERVEREOF'",
    SERVER_JS_CODE,
    'SERVEREOF',
    '',
    'pm2 delete net2app-api 2>/dev/null || true',
    'pm2 start $API_DIR/server.js --name net2app-api --cwd $API_DIR',
    '# Ensure PM2 starts on boot',
    'pm2 save',
    'env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root 2>&1 | tail -3',
    '# Run the generated startup command if it outputs one',
    'PM2_STARTUP=$(env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root 2>&1 | grep "sudo")',
    '[ -n "$PM2_STARTUP" ] && eval "$PM2_STARTUP" || true',
    'systemctl enable pm2-root 2>/dev/null || true',
    'info "Waiting 6s for API..."',
    'sleep 6',
    'curl -s http://127.0.0.1:5000/health | grep -q \'"ok":true\' && ok "API Server: RUNNING on :5000 (22 tables)" || { sleep 5; curl -s http://127.0.0.1:5000/health | grep -q \'"ok":true\' && ok "API: RUNNING" || fail "API FAILED — pm2 logs net2app-api"; }',
    '',

    'header "STEP 10: Clone + Git Hard-Reset (no merge conflicts) + Build"',
    'if [ -d "$DEPLOY_DIR/.git" ]; then',
    '  cd $DEPLOY_DIR',
    '  git fetch origin',
    '  git reset --hard origin/$BRANCH',
    '  git clean -fd',
    '  ok "Hard-reset to origin/$BRANCH — merge conflicts cleared"',
    'else',
    '  git clone $GITHUB_REPO $DEPLOY_DIR && cd $DEPLOY_DIR',
    '  ok "Repository cloned"',
    'fi',
    'cd $DEPLOY_DIR',
    'cat > $DEPLOY_DIR/.env << VITEEOF',
    'VITE_BASE44_APP_ID=${VITE_APP_ID}',
    'VITE_BASE44_APP_BASE_URL=${VITE_APP_BASE_URL}',
    'VITE_BASE44_FUNCTIONS_VERSION=${VITE_FUNCTIONS_VERSION}',
    'VITEEOF',
    '# --include=dev ensures Vite + all build tools are installed',
    'npm install --include=dev 2>&1 | tail -5',
    'npm run build 2>&1 | tail -5',
    'mkdir -p $WEBROOT && rm -rf $WEBROOT/* && cp -r $DEPLOY_DIR/dist/* $WEBROOT/',
    'ok "Frontend built → $WEBROOT"',
    '',

    'header "STEP 11: Nginx SPA + API Proxy (nginx -t before reload)"',
    "cat > /etc/nginx/sites-available/net2app << 'NGINXEOF'",
    'server {',
    '    listen 80 default_server;',
    '    listen [::]:80 default_server;',
    '    server_name _;',
    '    root /var/www/html;',
    '    index index.html;',
    '    location /api/ {',
    '        proxy_pass http://127.0.0.1:5000;',
    '        proxy_http_version 1.1;',
    '        proxy_set_header Host $host;',
    '        proxy_set_header X-Real-IP $remote_addr;',
    '        proxy_connect_timeout 10s;',
    '        proxy_read_timeout 60s;',
    '        add_header Access-Control-Allow-Origin * always;',
    '        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;',
    '        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;',
    '        if ($request_method = OPTIONS) { return 204; }',
    '    }',
    '    location = /health { proxy_pass http://127.0.0.1:5000/health; }',
    '    location / { try_files $uri $uri/ /index.html; }',
    '    location ~* \\.(js|css|png|jpg|ico|woff2?)$ { expires 7d; add_header Cache-Control "public, immutable"; }',
    '    gzip on;',
    '    gzip_types text/plain application/javascript application/json text/css;',
    '}',
    'NGINXEOF',
    'ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/',
    'rm -f /etc/nginx/sites-enabled/default',
    '# Test config BEFORE reload — fail safe',
    'nginx -t && systemctl enable nginx && systemctl reload nginx && ok "Nginx: config valid + reloaded" || fail "Nginx config FAILED — run: nginx -t"',
    '',

    'header "STEP 12: UFW Firewall"',
    'ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 443/tcp; ufw allow 5000/tcp',
    'ufw allow 5060/udp; ufw allow 5060/tcp',
    'ufw allow 9095:9200/tcp',
    'ufw allow from 127.0.0.1 to any port 13000',
    'ufw allow from 127.0.0.1 to any port 13013',
    'ufw deny 3306',
    'echo "y" | ufw enable 2>/dev/null || true',
    'ok "UFW configured"',
    '',

    'header "STEP 13: Fail2Ban"',
    'systemctl enable fail2ban && systemctl restart fail2ban && ok "Fail2Ban ready"',
    '',

    'header "STEP 14: Initial Kannel Sync"',
    'bash $API_DIR/gen-kannel-conf.sh && ok "kannel.conf synced" || info "Sync skipped — add SMPP entries first"',
    '',

    'header "STEP 14b: WPPConnect (WhatsApp QR sessions)"',
    'WPP_DIR="/opt/net2app-wpp"',
    'mkdir -p $WPP_DIR && cd $WPP_DIR',
    'npm init -y 2>/dev/null | tail -1',
    'npm install @wppconnect-team/wppconnect@latest 2>&1 | tail -3',
    "cat > $WPP_DIR/wpp-server.js << 'WPPEOF'",
    "const wppconnect = require('@wppconnect-team/wppconnect');",
    "const express = require('express');",
    "const app = express(); app.use(express.json());",
    "const sessions = {};",
    "app.post('/api/:session/start-session', async (req,res) => {",
    "  const sid = req.params.session;",
    "  if (sessions[sid]) return res.json({ok:true,status:'already_started'});",
    "  try {",
    "    const client = await wppconnect.create({ session: sid, folderNameToken: '/tmp/wpp-tokens', qrCallback: (qr) => { sessions[sid] = { ...sessions[sid], qr }; }, onLoadingScreen: () => {}, browserArgs: ['--no-sandbox','--disable-setuid-sandbox'] });",
    "    sessions[sid] = { client, connected: false, phone: '' };",
    "    client.onStateChange(state => { if(state==='CONNECTED') { sessions[sid].connected=true; client.getHostDevice().then(d=>{ sessions[sid].phone=d.id?._serialized||''; }).catch(()=>{}); } });",
    "    res.json({ok:true,qrcode:sessions[sid]?.qr||null});",
    "  } catch(e) { res.json({ok:false,error:e.message}); }",
    "});",
    "app.get('/api/:session/check-connection-session', (req,res) => {",
    "  const s=sessions[req.params.session];",
    "  res.json({status:s?.connected||false,connected:s?.connected||false,phone:s?.phone||''});",
    "});",
    "app.get('/api/:session/get-qr-code', (req,res) => {",
    "  const s=sessions[req.params.session];",
    "  res.json({qrcode:s?.qr||null});",
    "});",
    "app.listen(21465,'127.0.0.1',()=>console.log('WPPConnect on :21465'));",
    'WPPEOF',
    'pm2 delete net2app-wpp 2>/dev/null || true',
    'pm2 start $WPP_DIR/wpp-server.js --name net2app-wpp --cwd $WPP_DIR',
    'pm2 save',
    'ok "WPPConnect WhatsApp QR server: started on :21465"',
    'cd $API_DIR',
    '',

    'header "STEP 14c: channel_sessions table"',
    "mysql -u root -p\"$DB_ROOT_PASS\" $DB_NAME -e \"CREATE TABLE IF NOT EXISTS channel_sessions (id VARCHAR(64) PRIMARY KEY, session_id VARCHAR(128) NOT NULL, channel VARCHAR(32) NOT NULL, session_name VARCHAR(128), phone_number VARCHAR(32), status ENUM('pending','connected','disconnected','failed') DEFAULT 'pending', qr_data TEXT, qr_generated_at DATETIME, connected_at DATETIME, last_seen DATETIME, supplier_id VARCHAR(64), notes TEXT, created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(), INDEX(channel), INDEX(status), INDEX(session_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\" && ok \"channel_sessions table ready\"",
    '',

    'header "STEP 15: Health Check + Summary"',
    'SERVER_IP=$(hostname -I | awk \'{print $1}\')',
    'systemctl is-active nginx            && ok "Nginx:     RUNNING" || fail "Nginx: DOWN"',
    'systemctl is-active mariadb          && ok "MariaDB:   RUNNING" || fail "MariaDB: DOWN"',
    'systemctl is-active kannel-bearerbox && ok "Bearerbox: RUNNING" || fail "Bearerbox: DOWN"',
    'systemctl is-active kannel-smsbox    && ok "Smsbox:    RUNNING" || fail "Smsbox: DOWN"',
    'pm2 list | grep net2app-api | grep -q online && ok "API:       RUNNING" || fail "API: DOWN"',
    'curl -s http://127.0.0.1:5000/health | grep -q \'"ok":true\' && ok "API /health: OK" || fail "API /health: FAIL"',
    `TABLE_COUNT=$(mysql -u $DB_APP_USER -p"$DB_APP_PASS" $DB_NAME -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME'" 2>/dev/null || echo "?")`,
    'ok "DB Tables: $TABLE_COUNT (expected 22)"',
    '',
    'echo ""',
    'echo "╔═══════════════════════════════════════════════════════════════╗"',
    'echo "║  NET2APP v3.0 — DEPLOYMENT COMPLETE — 22 TABLES             ║"',
    'echo "╠═══════════════════════════════════════════════════════════════╣"',
    `echo "║  Dashboard:   http://$SERVER_IP/                             ║"`,
    `echo "║  API:         http://$SERVER_IP:5000                         ║"`,
    `echo "║  Health:      http://$SERVER_IP/health                       ║"`,
    'echo "╠═══════════════════════════════════════════════════════════════╣"',
    'echo "║  LOGIN:  admin@net2app.local / Admin@2025!                   ║"',
    'echo "║  TOKEN:  POST /api/auth/login → JWT (24h)                    ║"',
    'echo "╠═══════════════════════════════════════════════════════════════╣"',
    `echo "║  SERVER_API_URL   = http://$SERVER_IP:5000                   "`,
    `echo "║  SERVER_API_TOKEN = ${c.apiToken}                            "`,
    `echo "║  KANNEL_ADMIN_URL = http://$SERVER_IP:13000                  "`,
    `echo "║  KANNEL_ADMIN_PASS= ${c.kannelPass}                          "`,
    'echo "╠═══════════════════════════════════════════════════════════════╣"',
    'echo "║  TABLES: users, tenants, clients, suppliers, routes,         ║"',
    'echo "║  routing_rules, rates, mcc_mnc, sms_log, sms_log_archive,    ║"',
    'echo "║  voice_otp, billing_summary, invoices, campaigns,            ║"',
    'echo "║  channel_suppliers, content_templates, otp_unicode_presets,  ║"',
    'echo "║  number_translations, ip_access, alert_rules,                ║"',
    'echo "║  supplier_health, system_settings, notifications,            ║"',
    'echo "║  gateways, cdr_logs, smpp_users  (total: 22)                 ║"',
    'echo "╚═══════════════════════════════════════════════════════════════╝"',
  ].join('\n');
}

export function buildKannelSyncScript(c) {
  return [
    '#!/bin/bash',
    '# gen-kannel-conf.sh — Regenerate /etc/kannel/kannel.conf from MariaDB',
    `DB_USER="${c.dbAppUser}"`,
    `DB_PASS="${c.dbAppPass}"`,
    `DB_NAME="${c.dbName}"`,
    `KANNEL_PASS="${c.kannelPass}"`,
    'CONF=/etc/kannel/kannel.conf',
    'BAK=/etc/kannel/kannel.conf.bak.$(date +%s)',
    '[ -f "$CONF" ] && cp "$CONF" "$BAK"',
    'cat > "$CONF" << COREEOF',
    'group = core',
    'admin-port = 13000',
    `admin-password = ${c.kannelPass}`,
    `status-password = ${c.kannelPass}`,
    'smsbox-port = 13001',
    'log-file = "/var/log/kannel/bearerbox.log"',
    'log-level = 1',
    'box-allow-ip = 127.0.0.1',
    'access-log = "/var/log/kannel/access.log"',
    'unified-prefix = "+,00,011"',
    '',
    'group = smsbox',
    'smsbox-id = "net2app_smsbox"',
    'bearerbox-host = 127.0.0.1',
    'bearerbox-port = 13001',
    'sendsms-port = 13013',
    'sendsms-interface = 127.0.0.1',
    'log-file = "/var/log/kannel/smsbox.log"',
    'log-level = 1',
    'global-sender = "NET2APP"',
    'max-msgs-per-second = 500',
    'dlr-url = "http://127.0.0.1:5000/api/dlr?msgid=%i&status=%d&to=%p&from=%A"',
    'COREEOF',
    'echo "# === SMSC Suppliers auto-gen $(date) ===" >> "$CONF"',
    "mysql -u \"$DB_USER\" -p\"$DB_PASS\" \"$DB_NAME\" -N -B -e \"SELECT name,smpp_ip,smpp_port,smpp_username,smpp_password,tps_limit FROM suppliers WHERE connection_type='SMPP' AND status='active'\" 2>/dev/null | while IFS=$'\\t' read -r name ip port user pass tps; do",
    '  tps=${tps:-100}',
    '  printf "\\ngroup = smsc\\nsmsc = smpp\\nsmsc-id = \\"%s\\"\\nhost = %s\\nport = %s\\nsmsc-username = \\"%s\\"\\nsmsc-password = \\"%s\\"\\ntransceiver-mode = true\\nreconnect-delay = 10\\nmax-pending-submits = %s\\n" "$name" "$ip" "$port" "$user" "$pass" "$tps" >> "$CONF"',
    'done',
    'echo "# === SMPP Clients auto-gen $(date) ===" >> "$CONF"',
    "mysql -u \"$DB_USER\" -p\"$DB_PASS\" \"$DB_NAME\" -N -B -e \"SELECT name,smpp_username,smpp_password,smpp_port,tps_limit FROM clients WHERE connection_type='SMPP' AND status='active' AND smpp_username IS NOT NULL AND smpp_username<>''\" 2>/dev/null | while IFS=$'\\t' read -r cname user pass port tps; do",
    '  port=${port:-9096}; tps=${tps:-100}',
    '  sid=$(echo "$cname" | tr " " "_" | tr -cd "a-zA-Z0-9_-")',
    '  printf "\\ngroup = smpp-server\\nport = %s\\nsmpp-server-id = \\"%s\\"\\nsystem-id = \\"%s\\"\\npassword = \\"%s\\"\\nsystem-type = \\"\\"\\ninterface-version = 34\\nmax-binds = 10\\nallow-ip = \\"*.*.*.*\\"\\nthroughput = %s\\n" "$port" "$sid" "$user" "$pass" "$tps" >> "$CONF"',
    'done',
    'kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null || true',
    'echo "[OK] kannel.conf updated → $CONF (backup: $BAK)"',
  ].join('\n');
}