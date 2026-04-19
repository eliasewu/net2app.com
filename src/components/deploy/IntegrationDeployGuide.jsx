import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, Server, Wifi, Phone, Database, Shield, BookOpen } from "lucide-react";
import { toast } from "sonner";

function CodeBlock({ label, code }) {
  return (
    <div className="space-y-1">
      {label && <p className="text-xs font-semibold text-muted-foreground">{label}</p>}
      <div className="relative">
        <pre className="bg-gray-900 text-green-400 text-xs font-mono p-4 rounded-lg overflow-x-auto whitespace-pre">{code}</pre>
        <Button size="sm" variant="ghost" className="absolute top-2 right-2 text-gray-400 hover:text-white gap-1"
          onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied!"); }}>
          <Copy className="w-3 h-3" />Copy
        </Button>
      </div>
    </div>
  );
}

const SCRIPTS = {
  system: `#!/bin/bash
# Net2app – Debian 12 Full Stack Setup
# Run as root: bash setup.sh

apt-get update && apt-get upgrade -y
apt-get install -y build-essential git curl wget \
  libssl-dev libncurses5-dev libxml2-dev libsqlite3-dev \
  uuid-dev jansson-dev libedit-dev libjansson-dev \
  mariadb-server mariadb-client \
  ufw fail2ban net-tools tcpdump nmap`,

  asterisk: `#!/bin/bash
# Install Asterisk 20 LTS on Debian 12

cd /usr/src
wget https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-20-current.tar.gz
tar xzf asterisk-20-current.tar.gz
cd asterisk-20*/

# Install dependencies
contrib/scripts/install_prereq install

# Configure & compile
./configure --with-jansson-bundled
make menuselect  # Enable chan_sip, app_dial, app_voicemail, cdr_mysql
make -j$(nproc)
make install
make samples
make config
ldconfig

# Enable & start
systemctl enable asterisk
systemctl start asterisk

# Verify
asterisk -rx "core show version"`,

  sip_conf: `; /etc/asterisk/sip.conf – Global section
[general]
context=default
allowoverlap=no
udpbindaddr=0.0.0.0
tcpenable=no
tcpbindaddr=0.0.0.0
transport=udp
srvlookup=yes
nat=force_rport,comedia
qualify=yes
qualifyfreq=60
dtmfmode=rfc2833
relaxdtmf=yes
canreinvite=no
directmedia=no
disallow=all
allow=ulaw
allow=alaw
allow=g729
registertimeout=20
registerattempts=10

; Register to upstream provider
; register => username:password@provider-host:5060/username`,

  extensions_conf: `; /etc/asterisk/extensions.conf
[from-trunk]
; Incoming from SIP trunk
exten => _X.,1,NoOp(Incoming call to \${EXTEN})
 same => n,Dial(PJSIP/\${EXTEN}@internal,30,tT)
 same => n,VoiceMail(\${EXTEN}@default,u)
 same => n,Hangup()

[from-iptsp]
; IPTSP Bangladesh IIGW
exten => _X.,1,NoOp(IPTSP call \${EXTEN} from \${CALLERID(num)})
 same => n,Set(CDR(accountcode)=iptsp)
 same => n,Dial(SIP/\${EXTEN}@outbound-trunk,60,tTr)
 same => n,Hangup()

[outbound-calls]
exten => _0.,1,NoOp(Outbound call to \${EXTEN})
 same => n,Dial(SIP/\${EXTEN}@provider,60)
 same => n,Hangup()`,

  kannel: `# /etc/kannel/kannel.conf
# Net2app Kannel Configuration – Debian 12

group = core
admin-port = 13000
admin-password = CHANGE_THIS_PASSWORD
status-password = CHANGE_THIS_PASSWORD
log-file = "/var/log/kannel/bearerbox.log"
log-level = 1
box-allow-ip = 127.0.0.1
unified-prefix = "+,00,011"

group = smsbox
smsbox-id = "net2app_smsbox"
bearerbox-host = localhost
bearerbox-port = 13000
sendsms-port = 13013
log-file = "/var/log/kannel/smsbox.log"
log-level = 1
global-sender = "NET2APP"

# ── SMPP Supplier Example ─────────────────────────────────────
group = smsc
smsc = smpp
smsc-id = "supplier1_smpp"
host = "smpp.supplier1.com"
port = 2775
smsc-username = "your_username"
smsc-password = "your_password"
system-type = "SMPP"
transceiver-mode = 1
max-pending-submits = 10
throughput = 100
reconnect-delay = 10`,

  mariadb: `#!/bin/bash
# MariaDB setup for Net2app

mysql -u root -e "
CREATE DATABASE IF NOT EXISTS net2app CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'net2app'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON net2app.* TO 'net2app'@'localhost';

-- Asterisk CDR table
CREATE TABLE IF NOT EXISTS net2app.cdr (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  calldate     DATETIME NOT NULL DEFAULT NOW(),
  clid         VARCHAR(80),
  src          VARCHAR(80),
  dst          VARCHAR(80),
  dcontext     VARCHAR(80),
  channel      VARCHAR(80),
  dstchannel   VARCHAR(80),
  lastapp      VARCHAR(80),
  lastdata     VARCHAR(80),
  duration     INT,
  billsec      INT,
  disposition  VARCHAR(45),
  amaflags     INT,
  accountcode  VARCHAR(20),
  uniqueid     VARCHAR(32) NOT NULL,
  userfield    VARCHAR(255),
  peeraccount  VARCHAR(20),
  linkedid     VARCHAR(32),
  INDEX(calldate), INDEX(src), INDEX(dst)
) ENGINE=InnoDB;

-- SMS Log table
CREATE TABLE IF NOT EXISTS net2app.sms_log (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id   VARCHAR(64),
  client_id    VARCHAR(64),
  supplier_id  VARCHAR(64),
  sender_id    VARCHAR(32),
  destination  VARCHAR(32),
  content      TEXT,
  status       ENUM('pending','sent','delivered','failed','rejected') DEFAULT 'pending',
  cost         DECIMAL(12,6) DEFAULT 0,
  sell_rate    DECIMAL(12,6) DEFAULT 0,
  created_at   DATETIME DEFAULT NOW(),
  INDEX(destination), INDEX(client_id), INDEX(status)
) ENGINE=InnoDB;
FLUSH PRIVILEGES;
"
echo "MariaDB net2app database created."`,

  firewall: `#!/bin/bash
# UFW Firewall rules for Net2app – Debian 12

ufw default deny incoming
ufw default allow outgoing

# SSH (change 22 to your actual SSH port)
ufw allow 22/tcp

# SIP (standard)
ufw allow 5060/udp
ufw allow 5060/tcp

# SIP (IPTSP custom ports)
ufw allow 7074/udp
ufw allow 7074/tcp
ufw allow 5080/udp
ufw allow 6060/udp

# RTP audio range
ufw allow 10000:20000/udp

# Kannel bearerbox admin (restrict to localhost only in production)
ufw allow from 127.0.0.1 to any port 13000
ufw allow from 127.0.0.1 to any port 13013

# MariaDB (localhost only)
ufw deny 3306

# Web dashboard
ufw allow 80/tcp
ufw allow 443/tcp

ufw enable
ufw status verbose`,

  cdr_mysql: `; /etc/asterisk/cdr_mysql.conf
[global]
hostname=localhost
dbname=net2app
table=cdr
password=STRONG_PASSWORD
user=net2app
port=3306
sock=/var/run/mysqld/mysqld.sock
userfield=1`,

  ami_conf: `; /etc/asterisk/manager.conf
; Asterisk Manager Interface for real-time status

[general]
enabled = yes
port = 5038
bindaddr = 127.0.0.1
displayconnects = yes

[net2app]
secret = STRONG_AMI_PASSWORD
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/255.255.255.0
read = all
write = all`,

  smpp_server: `#!/bin/bash
# Install OpenSMPPD or Jasmin SMPP Server on Debian 12
# Option A: Jasmin SMS Gateway (Python-based, full-featured)

apt-get install -y python3 python3-pip redis-server rabbitmq-server
pip3 install jasmin

# Start Jasmin
jasmind.py --start

# Or use Docker (easier)
docker run -d \\
  --name jasmin \\
  -p 2775:2775 \\
  -p 8080:8080 \\
  jookies/jasmin:latest

# Access web UI at http://YOUR_IP:8080
# Default: admin / admin`,
};

export default function IntegrationDeployGuide() {
  const [tab, setTab] = useState("overview");

  const steps = [
    { n: 1, label: "System Prep", done: false },
    { n: 2, label: "Asterisk 20", done: false },
    { n: 3, label: "MariaDB", done: false },
    { n: 4, label: "Kannel SMS", done: false },
    { n: 5, label: "SMPP Server", done: false },
    { n: 6, label: "Firewall", done: false },
  ];

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-xl text-white space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          <h2 className="font-bold text-lg">Full Integration Deploy Guide</h2>
          <Badge className="bg-white/20 text-white border-white/30">Debian 12 Bookworm</Badge>
        </div>
        <p className="text-blue-200 text-sm">Complete setup: Asterisk 20 (chan_sip + PJSIP) + Kannel SMS + SMPP Server + MariaDB CDR + AMI + Firewall</p>
        <div className="flex flex-wrap gap-2">
          {steps.map(s => (
            <div key={s.n} className="flex items-center gap-1 bg-white/10 rounded px-2 py-0.5 text-xs">
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">{s.n}</span>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="gap-1"><Server className="w-3.5 h-3.5" />System</TabsTrigger>
          <TabsTrigger value="asterisk" className="gap-1"><Phone className="w-3.5 h-3.5" />Asterisk 20</TabsTrigger>
          <TabsTrigger value="sip_config" className="gap-1"><Phone className="w-3.5 h-3.5" />SIP Config</TabsTrigger>
          <TabsTrigger value="kannel" className="gap-1"><Wifi className="w-3.5 h-3.5" />Kannel SMS</TabsTrigger>
          <TabsTrigger value="database" className="gap-1"><Database className="w-3.5 h-3.5" />MariaDB + CDR</TabsTrigger>
          <TabsTrigger value="smpp" className="gap-1"><Wifi className="w-3.5 h-3.5" />SMPP Server</TabsTrigger>
          <TabsTrigger value="security" className="gap-1"><Shield className="w-3.5 h-3.5" />Firewall</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">System Architecture</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs font-mono text-muted-foreground bg-muted p-4 rounded-lg overflow-x-auto">{`
  ┌──────────────────────────────────────────────────────┐
  │              Net2app – Debian 12 Server              │
  │                                                      │
  │  ┌─────────────┐   ┌───────────────┐                 │
  │  │ Asterisk 20 │   │  Kannel SMS   │                 │
  │  │  chan_sip   │   │  bearerbox    │                 │
  │  │  PJSIP      │   │  smsbox       │                 │
  │  │  IAX2       │   │  SMPP clients │                 │
  │  │  AMI :5038  │   │  HTTP clients │                 │
  │  │  SIP  :5060 │   │  :13013 send  │                 │
  │  └──────┬──────┘   └──────┬────────┘                 │
  │         │                 │                          │
  │  ┌──────▼─────────────────▼────────┐                 │
  │  │        MariaDB / MySQL           │                 │
  │  │  net2app DB | CDR table          │                 │
  │  │  sms_log  | rates | clients      │                 │
  │  └─────────────────────────────────┘                 │
  │                                                      │
  │  IPTSP Ports: 7074, 5080, 6060 (custom per provider) │
  │  RTP: 10000-20000/udp                                │
  └──────────────────────────────────────────────────────┘
  
  External:
  ┌──────────────┐     ┌──────────────────────┐
  │  SIP Trunks  │────▶│  Asterisk (5060)     │
  │  IPTSP India │────▶│  Asterisk (7074)     │
  │  BD IIGW     │────▶│  Asterisk (7074)     │
  └──────────────┘     └──────────────────────┘
  
  ┌──────────────┐     ┌──────────────────────┐
  │ SMPP Suppliers│────▶│  Kannel bearerbox   │
  │ HTTP Suppliers│────▶│  Kannel smsbox      │
  └──────────────┘     └──────────────────────┘
`}</pre>
            </CardContent>
          </Card>
          <CodeBlock label="Step 1 — System Preparation (run as root)" code={SCRIPTS.system} />
        </TabsContent>

        <TabsContent value="asterisk" className="mt-4 space-y-4">
          <CodeBlock label="Step 2 — Install Asterisk 20 LTS" code={SCRIPTS.asterisk} />
          <CodeBlock label="CDR MySQL Integration (/etc/asterisk/cdr_mysql.conf)" code={SCRIPTS.cdr_mysql} />
          <CodeBlock label="AMI Configuration (/etc/asterisk/manager.conf)" code={SCRIPTS.ami_conf} />
        </TabsContent>

        <TabsContent value="sip_config" className="mt-4 space-y-4">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800 space-y-1">
            <p className="font-bold">IPTSP Note:</p>
            <p>Each IPTSP provider gets its own port (7074, 5080, 6060, etc.). Add <code>bindaddr</code> per port in sip.conf. One port = one provider.</p>
            <p>BD IIGW: route via context <code>from-iptsp</code> with accountcode for CDR tagging.</p>
          </div>
          <CodeBlock label="SIP Global Configuration (/etc/asterisk/sip.conf)" code={SCRIPTS.sip_conf} />
          <CodeBlock label="Dialplan (/etc/asterisk/extensions.conf)" code={SCRIPTS.extensions_conf} />
        </TabsContent>

        <TabsContent value="kannel" className="mt-4 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            Kannel auto-config is generated from your SMPP suppliers. Go to <strong>Suppliers → SMPP Config</strong> tab to get the ready-to-paste config block per supplier.
          </div>
          <CodeBlock label="Kannel Master Config (/etc/kannel/kannel.conf)" code={SCRIPTS.kannel} />
          <CodeBlock label="Start Kannel services" code={`# Install
apt-get install -y kannel

# Create log directory
mkdir -p /var/log/kannel
chown kannel:kannel /var/log/kannel

# Enable & start
systemctl enable kannel
systemctl start kannel

# Check status
systemctl status kannel

# Live status (web UI)
# http://localhost:13000/status?password=CHANGE_THIS_PASSWORD

# Reload without restart
/usr/sbin/bearerbox -v 0 /etc/kannel/kannel.conf &`} />
        </TabsContent>

        <TabsContent value="database" className="mt-4 space-y-4">
          <CodeBlock label="Step 3 — MariaDB Setup + CDR Schema" code={SCRIPTS.mariadb} />
          <CodeBlock label="Configure Asterisk CDR MySQL" code={`# Enable cdr_mysql module in modules.conf
# /etc/asterisk/modules.conf
# [modules]
# load => cdr_mysql.so

# Reload Asterisk CDR
asterisk -rx "cdr mysql status"
asterisk -rx "module reload cdr_mysql.so"`} />
        </TabsContent>

        <TabsContent value="smpp" className="mt-4 space-y-4">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded text-xs text-purple-800">
            For acting as an SMPP server (clients connect to you), use <strong>Jasmin SMS Gateway</strong> or <strong>OpenSMPP</strong>. This allows clients to submit SMS via SMPP bind.
          </div>
          <CodeBlock label="Step 5 — SMPP Server (Jasmin)" code={SCRIPTS.smpp_server} />
          <CodeBlock label="SMPP Server – open port 2775" code={`# Verify SMPP port is listening
ss -lntp | grep 2775

# Test SMPP bind from client
# Use smppsend or Python smpplib:
# python3 -c "
# import smpplib.client, smpplib.consts
# c = smpplib.client.Client('YOUR_IP', 2775)
# c.connect()
# c.bind_transceiver(system_id='testuser', password='testpass')
# print('Bind OK')
# "`} />
        </TabsContent>

        <TabsContent value="security" className="mt-4 space-y-4">
          <CodeBlock label="Step 6 — UFW Firewall (IPTSP ports included)" code={SCRIPTS.firewall} />
          <CodeBlock label="Fail2ban – protect SIP from brute force" code={`# /etc/fail2ban/jail.local
[asterisk]
enabled = true
filter = asterisk
logpath = /var/log/asterisk/messages
maxretry = 5
bantime = 3600
findtime = 600

# Reload fail2ban
systemctl reload fail2ban
fail2ban-client status asterisk`} />
        </TabsContent>
      </Tabs>
    </div>
  );
}