#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  gen-kannel-conf.sh — Read clients/suppliers from MariaDB
#  and write /etc/kannel/kannel.conf then reload Kannel.
#  Run: bash /opt/net2app-api/gen-kannel-conf.sh
# ═══════════════════════════════════════════════════════════════════

DB_HOST=localhost
DB_USER="net2app"
DB_PASS="Ariya2015@db"
DB_NAME="net2app"
KANNEL_PASS="Ariya2015@k"
CONF=/etc/kannel/kannel.conf
BAK=/etc/kannel/kannel.conf.bak.$(date +%s)

[ -f "$CONF" ] && cp "$CONF" "$BAK"

# ── Write core + smsbox blocks ──────────────────────────────────────
cat > "$CONF" << COREEOF
group = core
admin-port = 13000
admin-password = Ariya2015@k
status-password = Ariya2015@k
smsbox-port = 13001
log-file = "/var/log/kannel/bearerbox.log"
log-level = 1
box-allow-ip = 127.0.0.1
access-log = "/var/log/kannel/access.log"
unified-prefix = "+,00,011"

group = smsbox
smsbox-id = "net2app_smsbox"
bearerbox-host = 127.0.0.1
bearerbox-port = 13001
sendsms-port = 13013
sendsms-interface = 127.0.0.1
log-file = "/var/log/kannel/smsbox.log"
log-level = 1
global-sender = "NET2APP"
max-msgs-per-second = 500
dlr-url = "http://127.0.0.1:5000/api/dlr?msgid=%i&status=%d&to=%p&from=%A"
COREEOF

# ── Append SMPP supplier (smsc) blocks from DB ──────────────────────
echo "# === SMSC Suppliers (auto-generated $(date)) ===" >> "$CONF"

mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -B -e \
  "SELECT id,name,smpp_ip,smpp_port,smpp_username,smpp_password,tps_limit FROM suppliers WHERE connection_type='SMPP' AND status='active'" | \
while IFS=$'\t' read -r id name ip port user pass tps; do
  tps=${tps:-100}
  cat >> "$CONF" << EOF

group = smsc
smsc = smpp
smsc-id = "$name"
host = $ip
port = $port
smsc-username = "$user"
smsc-password = "$pass"
transceiver-mode = true
reconnect-delay = 10
max-pending-submits = $tps
EOF
done

# ── Append SMPP client (smpp-server) blocks from DB ─────────────────
echo "# === SMPP Clients (auto-generated $(date)) ===" >> "$CONF"

mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -B -e \
  "SELECT id,smpp_username,smpp_password,smpp_port,tps_limit FROM clients WHERE connection_type='SMPP' AND status='active' AND smpp_username IS NOT NULL AND smpp_username<>''" | \
while IFS=$'\t' read -r id user pass port tps; do
  port=${port:-9096}
  tps=${tps:-100}
  cat >> "$CONF" << EOF

group = smpp-server
system-id = "$user"
password = "$pass"
port = $port
max-sms-per-second = $tps
EOF
done

# ── Reload Kannel ───────────────────────────────────────────────────
kill -HUP $(pidof bearerbox) 2>/dev/null || pkill -HUP bearerbox 2>/dev/null || true
echo "[OK] kannel.conf updated and Kannel reloaded → $CONF"
echo "[OK] Backup saved → $BAK"
