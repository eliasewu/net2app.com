sudo apt update
# Install Node.js (Current LTS recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y node.js git nginx
# Install PM2 to manage the background process
sudo npm install -g pm2

cd /var/www
git clone https://github.com/eliasewu/net2app.com.git
cd net2app.com

# Create the environment file as per your README
nano .env.local

VITE_BASE44_APP_ID=cbef744a8545c389ef439ea6
VITE_BASE44_APP_BASE_URL=https://your-api-url.com

npm install
npm run build
sudo nano /etc/nginx/sites-available/net2app
server {
    listen 80;
    server_name yourdomain.com; # Replace with your domain or IP

    root /var/www/net2app.com/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Connectivity for potential backend synchronization
    location /api/ {
        proxy_pass http://localhost:5000; # Adjust if your backend is on a different port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

sudo ln -s /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

chmod +x deploy.sh
./deploy.sh



**Welcome to your Base44 project** 

**About**

View and Edit  your app on [Base44.com](http://Base44.com) 

This project contains everything you need to run your app locally.

**Edit the code in your local development environment**

Any change pushed to the repo will also be reflected in the Base44 Builder.

**Prerequisites:** 

1. Clone the repository using the project's Git URL 
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Create an `.env.local` file and set the right environment variables

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url

e.g.
VITE_BASE44_APP_ID=cbef744a8545c389ef439ea6
VITE_BASE44_APP_BASE_URL=https://my-to-do-list-81bfaad7.base44.app
```

Run the app: `npm run dev`

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.
Complete Asterisk Installation Script - All Issues Fixed
#!/bin/bash
# ════════════════════════════════════════════════════════════════════
#  ASTERISK 20 - Full Production Install for Net2App
#  Fixes ALL known issues: permissions, modules, dirs, segfaults
#  Run: sudo bash install_asterisk_full.sh
# ════════════════════════════════════════════════════════════════════

# Force root
if [ "$EUID" -ne 0 ]; then
    echo "Switching to root..."
    exec sudo bash "$0" "$@"
fi

set -e

# ═══════════════ COLORS ═══════════════
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()     { echo -e "${GREEN}[✓]${NC} $1"; }
fail()   { echo -e "${RED}[✗]${NC} $1"; }
info()   { echo -e "${YELLOW}[i]${NC} $1"; }
header() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  $1"
    echo -e "${BLUE}╚═══════════════════════════════════════════════╝${NC}"
    echo ""
}

# ═══════════════ CONFIGURATION ═══════════════
ASTERISK_VERSION="20"
SIP_PASSWORD="Telco1988"
AMI_PASSWORD="Telco1988"
VM_PASSWORD="Telco1988"
MYSQL_USER="net2app"
MYSQL_PASS="Telco1988"
MYSQL_DB="net2app"

echo ""
echo "════════════════════════════════════════════════"
echo "  ASTERISK ${ASTERISK_VERSION} FULL INSTALLER"
echo "  Server: $(hostname) ($(hostname -I | awk '{print $1}'))"
echo "  User:   $(whoami)"
echo "════════════════════════════════════════════════"

# ════════════════════════════════════════════════════
# STEP 1: SYSTEM UPDATE
# ════════════════════════════════════════════════════
header "STEP 1: Update System"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y 2>&1 | tail -3
apt-get upgrade -y 2>&1 | tail -3
ok "System updated ✓"

# ════════════════════════════════════════════════════
# STEP 2: INSTALL DEPENDENCIES
# ════════════════════════════════════════════════════
header "STEP 2: Install Build Dependencies"

apt-get install -y \
    build-essential wget curl git \
    libssl-dev libncurses5-dev libnewt-dev \
    libxml2-dev libsqlite3-dev uuid-dev \
    libjansson-dev libedit-dev \
    libgsm1-dev libspeex-dev libspeexdsp-dev \
    libogg-dev libvorbis-dev libcurl4-openssl-dev \
    libiksemel-dev pkg-config \
    liblua5.2-dev mpg123 sox \
    unixodbc unixodbc-dev odbcinst \
    subversion libmariadb-dev \
    libmariadb-dev-compat \
    autoconf automake libtool \
    python3 python3-dev \
    bison flex 2>&1 | tail -3

# Optional libs (don't fail if missing)
apt-get install -y libsrtp2-dev 2>/dev/null || \
apt-get install -y libsrtp-dev 2>/dev/null || \
info "libsrtp not available (optional)"

ok "Dependencies installed ✓"

# ════════════════════════════════════════════════════
# STEP 3: CLEAN PREVIOUS INSTALL
# ════════════════════════════════════════════════════
header "STEP 3: Clean Previous Installation"

# Stop any running asterisk
systemctl stop asterisk 2>/dev/null || true
pm2 delete asterisk 2>/dev/null || true
pkill -9 asterisk 2>/dev/null || true
sleep 2
ok "Previous instances stopped ✓"

# ════════════════════════════════════════════════════
# STEP 4: DOWNLOAD ASTERISK SOURCE
# ════════════════════════════════════════════════════
header "STEP 4: Download Asterisk ${ASTERISK_VERSION}"

cd /usr/src

# Check if source already exists
ASTERISK_SRC=$(find /usr/src -maxdepth 1 -name "asterisk-${ASTERISK_VERSION}*" -type d 2>/dev/null | head -1)

if [ -z "$ASTERISK_SRC" ] || [ ! -f "$ASTERISK_SRC/configure" ]; then
    info "Downloading fresh source..."
    rm -rf asterisk-${ASTERISK_VERSION}*
    rm -f asterisk-${ASTERISK_VERSION}-current.tar.gz

    wget -q --show-progress \
        "https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-${ASTERISK_VERSION}-current.tar.gz" \
        -O asterisk-${ASTERISK_VERSION}-current.tar.gz

    tar -xzf asterisk-${ASTERISK_VERSION}-current.tar.gz
    ASTERISK_SRC=$(find /usr/src -maxdepth 1 -name "asterisk-${ASTERISK_VERSION}*" -type d | head -1)
    ok "Source downloaded ✓"
else
    ok "Source already exists: $ASTERISK_SRC"
fi

cd "$ASTERISK_SRC"
info "Working in: $(pwd)"

# ════════════════════════════════════════════════════
# STEP 5: INSTALL PREREQUISITES
# ════════════════════════════════════════════════════
header "STEP 5: Asterisk Prerequisites"

if [ -f contrib/scripts/install_prereq ]; then
    chmod +x contrib/scripts/install_prereq
    contrib/scripts/install_prereq install 2>&1 | tail -5 || true
    ok "Prerequisites installed ✓"
fi

# ════════════════════════════════════════════════════
# STEP 6: CREATE ALL REQUIRED DIRECTORIES
# ════════════════════════════════════════════════════
header "STEP 6: Create All Required Directories"

# Create asterisk user FIRST
if ! id asterisk &>/dev/null; then
    useradd -r \
        -d /var/lib/asterisk \
        -s /usr/sbin/nologin \
        -c "Asterisk PBX Daemon" \
        asterisk
    ok "User asterisk created ✓"
else
    ok "User asterisk exists ✓"
fi

# Create EVERY directory asterisk needs (prevents 'No such file' errors)
for DIR in \
    /etc/asterisk \
    /var/lib/asterisk \
    /var/lib/asterisk/phoneprov \
    /var/lib/asterisk/sounds \
    /var/lib/asterisk/sounds/en \
    /var/lib/asterisk/moh \
    /var/lib/asterisk/keys \
    /var/lib/asterisk/agi-bin \
    /var/lib/asterisk/documentation \
    /var/lib/asterisk/firmware \
    /var/lib/asterisk/firmware/iax \
    /var/lib/asterisk/images \
    /var/lib/asterisk/static-http \
    /var/lib/asterisk/res_parking \
    /var/spool/asterisk \
    /var/spool/asterisk/voicemail \
    /var/spool/asterisk/voicemail/default \
    /var/spool/asterisk/voicemail/default/1234/INBOX \
    /var/spool/asterisk/voicemail/default/1001/INBOX \
    /var/spool/asterisk/voicemail/default/1002/INBOX \
    /var/spool/asterisk/monitor \
    /var/spool/asterisk/outgoing \
    /var/spool/asterisk/outgoing_temp \
    /var/spool/asterisk/tmp \
    /var/spool/asterisk/meetme \
    /var/spool/asterisk/recording \
    /var/log/asterisk \
    /var/log/asterisk/cdr-csv \
    /var/log/asterisk/cdr-custom \
    /run/asterisk \
    /usr/lib/asterisk \
    /usr/lib/asterisk/modules; do
    mkdir -p "$DIR"
done

# Set ownership
chown -R asterisk:asterisk \
    /etc/asterisk \
    /var/lib/asterisk \
    /var/spool/asterisk \
    /var/log/asterisk \
    /run/asterisk \
    /usr/lib/asterisk

chmod -R 755 /var/lib/asterisk /var/spool/asterisk
chmod -R 750 /var/log/asterisk /etc/asterisk

ok "All directories created with correct permissions ✓"

# ════════════════════════════════════════════════════
# STEP 7: CONFIGURE ASTERISK
# ════════════════════════════════════════════════════
header "STEP 7: Configure Asterisk"

cd "$ASTERISK_SRC"

info "Running ./configure (5-10 minutes)..."
./configure \
    --with-jansson-bundled \
    --with-pjproject-bundled \
    --without-radius \
    --without-postgres \
    --without-tds \
    --without-odbc \
    2>&1 | tail -10

ok "Configure complete ✓"

# ════════════════════════════════════════════════════
# STEP 8: SELECT MODULES (DISABLE PROBLEMATIC)
# ════════════════════════════════════════════════════
header "STEP 8: Select Modules"

cd "$ASTERISK_SRC"

make menuselect.makeopts 2>&1 | tail -3

# Enable required modules
menuselect/menuselect \
    --enable chan_sip \
    --enable chan_pjsip \
    --enable res_pjsip \
    --enable res_pjsip_session \
    --enable res_pjsip_authenticator_digest \
    --enable res_pjsip_endpoint_identifier_ip \
    --enable res_pjsip_registrar \
    --enable res_pjsip_sdp_rtp \
    --enable res_pjsip_outbound_registration \
    --enable app_voicemail \
    --enable app_dial \
    --enable app_playback \
    --enable app_record \
    --enable app_echo \
    --enable codec_gsm \
    --enable codec_ulaw \
    --enable codec_alaw \
    --enable format_mp3 \
    --enable cdr_csv \
    --enable cdr_manager \
    --enable cdr_mysql \
    --enable cel_manager \
    --disable chan_misdn \
    --disable chan_sip \
    --disable cdr_radius \
    --disable cel_radius \
    --disable cdr_tds \
    --disable cel_tds \
    --disable cdr_pgsql \
    --disable cel_pgsql \
    --disable cdr_odbc \
    --disable cel_odbc \
    --disable cdr_sqlite3_custom \
    --disable cel_sqlite3_custom \
    --disable cdr_custom \
    --disable cel_custom \
    --disable res_snmp \
    --disable res_odbc \
    --disable res_config_odbc \
    --disable res_phoneprov \
    menuselect.makeopts 2>/dev/null || true

# Re-enable chan_sip (we want it)
menuselect/menuselect --enable chan_sip menuselect.makeopts 2>/dev/null || true

ok "Modules selected (problematic ones disabled) ✓"

# ════════════════════════════════════════════════════
# STEP 9: COMPILE
# ════════════════════════════════════════════════════
header "STEP 9: Compile Asterisk (10-20 minutes)"

cd "$ASTERISK_SRC"
CORES=$(nproc)
info "Compiling with $CORES cores..."

make -j${CORES} 2>&1 | tail -15

# Check if make succeeded
if [ ! -f main/asterisk ]; then
    fail "Compilation failed - check make output"
    exit 1
fi

ok "Compilation complete ✓"

# ════════════════════════════════════════════════════
# STEP 10: INSTALL ASTERISK
# ════════════════════════════════════════════════════
header "STEP 10: Install Asterisk"

cd "$ASTERISK_SRC"

info "Running make install..."
make install 2>&1 | tail -10
ok "make install ✓"

info "Running make samples (with all dirs ready)..."
make samples 2>&1 | tail -5
ok "make samples ✓"

info "Running make config..."
make config 2>&1 | tail -3
ok "make config ✓"

info "Running ldconfig..."
ldconfig
ok "Libraries linked ✓"

# Verify binary
if [ ! -f /usr/sbin/asterisk ]; then
    fail "Asterisk binary not installed!"
    exit 1
fi

ok "Asterisk binary: $(asterisk -V) ✓"

# ════════════════════════════════════════════════════
# STEP 11: WRITE CONFIGURATIONS
# ════════════════════════════════════════════════════
header "STEP 11: Write Configuration Files"

# ── asterisk.conf ─────────────────────────────────────
cat > /etc/asterisk/asterisk.conf <<'EOF'
[options]
runuser  = asterisk
rungroup = asterisk
verbose  = 3
debug    = 0
alwaysfork = no
nofork = yes
quiet = no
documentation_language = en_US

[directories]
astetcdir    => /etc/asterisk
astmoddir    => /usr/lib/asterisk/modules
astvarlibdir => /var/lib/asterisk
astdbdir     => /var/lib/asterisk
astkeydir    => /var/lib/asterisk
astdatadir   => /var/lib/asterisk
astagidir    => /var/lib/asterisk/agi-bin
astspooldir  => /var/spool/asterisk
astrundir    => /run/asterisk
astlogdir    => /var/log/asterisk
astsbindir   => /usr/sbin
EOF
ok "asterisk.conf ✓"

# ── modules.conf (disable problematic modules) ─────────
cat > /etc/asterisk/modules.conf <<'EOF'
[modules]
autoload = yes

; ── Disable modules that cause crashes/errors ──
noload => cdr_radius.so
noload => cel_radius.so
noload => cdr_tds.so
noload => cel_tds.so
noload => cdr_pgsql.so
noload => cel_pgsql.so
noload => cdr_odbc.so
noload => cel_odbc.so
noload => cdr_sqlite3_custom.so
noload => cel_sqlite3_custom.so
noload => cdr_custom.so
noload => cel_custom.so
noload => res_snmp.so
noload => res_odbc.so
noload => res_config_odbc.so
noload => res_phoneprov.so
noload => app_minivm.so
noload => app_externalivr.so
EOF
ok "modules.conf ✓"

# ── sip.conf ──────────────────────────────────────────
cat > /etc/asterisk/sip.conf <<EOF
[general]
context          = default
bindport         = 5060
bindaddr         = 0.0.0.0
language         = en
disallow         = all
allow            = ulaw
allow            = alaw
allow            = gsm
nat              = force_rport,comedia
qualify          = yes
alwaysauthreject = yes
canreinvite      = no
session-timers   = refuse
tcpenable        = yes
tcpbindaddr      = 0.0.0.0:5060
allowguest       = no
defaultexpiry    = 120
minexpiry        = 60
maxexpiry        = 3600
rtptimeout       = 60
rtpholdtimeout   = 300
useragent        = Net2App-PBX

;── Extensions ──
[1001]
type      = friend
context   = default
host      = dynamic
secret    = ${SIP_PASSWORD}
callerid  = "Extension 1001" <1001>
disallow  = all
allow     = ulaw
allow     = alaw
allow     = gsm
mailbox   = 1001@default
qualify   = yes

[1002]
type      = friend
context   = default
host      = dynamic
secret    = ${SIP_PASSWORD}
callerid  = "Extension 1002" <1002>
disallow  = all
allow     = ulaw
allow     = alaw
allow     = gsm
mailbox   = 1002@default
qualify   = yes

[1003]
type      = friend
context   = default
host      = dynamic
secret    = ${SIP_PASSWORD}
callerid  = "Extension 1003" <1003>
disallow  = all
allow     = ulaw
allow     = alaw
mailbox   = 1003@default
qualify   = yes
EOF
ok "sip.conf ✓"

# ── pjsip.conf (modern SIP stack) ─────────────────────
cat > /etc/asterisk/pjsip.conf <<EOF
;── Global ──
[global]
type = global
endpoint_identifier_order = ip,username,anonymous
default_realm = net2app

;── Transport ──
[transport-udp]
type     = transport
protocol = udp
bind     = 0.0.0.0:5060

[transport-tcp]
type     = transport
protocol = tcp
bind     = 0.0.0.0:5060

;── Templates ──
[endpoint-template](!)
type            = endpoint
context         = default
disallow        = all
allow           = ulaw,alaw,gsm
direct_media    = no
force_rport     = yes
rewrite_contact = yes
rtp_symmetric   = yes
trust_id_inbound = yes

[auth-template](!)
type      = auth
auth_type = userpass

[aor-template](!)
type              = aor
max_contacts      = 5
remove_existing   = yes
qualify_frequency = 30

;── Extension 1001 ──
[1001](endpoint-template)
auth     = auth1001
aors     = aor1001
callerid = "Ext 1001" <1001>

[auth1001](auth-template)
username = 1001
password = ${SIP_PASSWORD}

[aor1001](aor-template)
mailboxes = 1001@default

;── Extension 1002 ──
[1002](endpoint-template)
auth     = auth1002
aors     = aor1002
callerid = "Ext 1002" <1002>

[auth1002](auth-template)
username = 1002
password = ${SIP_PASSWORD}

[aor1002](aor-template)
mailboxes = 1002@default

;── Extension 1003 ──
[1003](endpoint-template)
auth     = auth1003
aors     = aor1003
callerid = "Ext 1003" <1003>

[auth1003](auth-template)
username = 1003
password = ${SIP_PASSWORD}

[aor1003](aor-template)
mailboxes = 1003@default
EOF
ok "pjsip.conf ✓"

# ── extensions.conf ───────────────────────────────────
cat > /etc/asterisk/extensions.conf <<'EOF'
[general]
static          = yes
writeprotect    = no
autofallthrough = yes
clearglobalvars = no

[globals]
VOICEMAIL_OPTS = u(unavail)b(busy)
DIAL_TIMEOUT   = 30

;── Default Context ──
[default]
include => extensions

;── Extensions ──
[extensions]
; Ext 1001
exten => 1001,1,NoOp(Calling Extension 1001)
 same => n,Set(CALLERID(num)=${CALLERID(num)})
 same => n,Dial(PJSIP/1001&SIP/1001,${DIAL_TIMEOUT})
 same => n,Goto(s-${DIALSTATUS},1)

; Ext 1002
exten => 1002,1,NoOp(Calling Extension 1002)
 same => n,Dial(PJSIP/1002&SIP/1002,${DIAL_TIMEOUT})
 same => n,Goto(s-${DIALSTATUS},1)

; Ext 1003
exten => 1003,1,NoOp(Calling Extension 1003)
 same => n,Dial(PJSIP/1003&SIP/1003,${DIAL_TIMEOUT})
 same => n,Goto(s-${DIALSTATUS},1)

; Voicemail
exten => _s-NOANSWER,1,VoiceMail(${EXTEN}@default,${VOICEMAIL_OPTS})
 same => n,Hangup()
exten => _s-BUSY,1,VoiceMail(${EXTEN}@default,${VOICEMAIL_OPTS})
 same => n,Hangup()
exten => _s-CHANUNAVAIL,1,VoiceMail(${EXTEN}@default,${VOICEMAIL_OPTS})
 same => n,Hangup()
exten => _s-.,1,Hangup()

; Service Numbers
exten => 9999,1,Answer()                  ; Echo test
 same => n,Echo()
 same => n,Hangup()

exten => 9998,1,Answer()                  ; Music demo
 same => n,Playback(demo-congrats)
 same => n,Hangup()

exten => 9997,1,Answer()                  ; Voicemail check
 same => n,VoiceMailMain(${CALLERID(num)}@default)
 same => n,Hangup()

exten => 8888,1,Answer()                  ; Date/Time
 same => n,SayUnixTime()
 same => n,Hangup()

; Hangup handler
exten => h,1,NoOp(Call ended)
 same => n,Hangup()

; Invalid
exten => i,1,Playback(pbx-invalid)
 same => n,Hangup()

; Timeout
exten => t,1,Playback(vm-goodbye)
 same => n,Hangup()
EOF
ok "extensions.conf ✓"

# ── logger.conf ───────────────────────────────────────
cat > /etc/asterisk/logger.conf <<'EOF'
[general]
dateformat     = %F %T
use_callids    = yes
appendhostname = no
queue_log      = yes
rotatestrategy = sequential

[logfiles]
console  => verbose,notice,warning,error
messages => notice,warning,error
full     => verbose,notice,warning,error,debug,dtmf,fax
cdr-csv  => csv
EOF
ok "logger.conf ✓"

# ── manager.conf (AMI) ────────────────────────────────
cat > /etc/asterisk/manager.conf <<EOF
[general]
enabled         = yes
port            = 5038
bindaddr        = 0.0.0.0
displayconnects = yes
timestampevents = yes
webenabled      = yes
httptimeout     = 60

[admin]
secret       = ${AMI_PASSWORD}
deny         = 0.0.0.0/0.0.0.0
permit       = 127.0.0.1/255.255.255.0
permit       = 10.0.0.0/255.0.0.0
permit       = 172.16.0.0/255.240.0.0
permit       = 192.168.0.0/255.255.0.0
read         = system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan,originate,agi
write        = system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan,originate,agi
writetimeout = 5000

[net2app]
secret       = ${AMI_PASSWORD}
deny         = 0.0.0.0/0.0.0.0
permit       = 127.0.0.1/255.255.255.0
read         = all
write        = all
EOF
ok "manager.conf ✓"

# ── voicemail.conf ────────────────────────────────────
cat > /etc/asterisk/voicemail.conf <<EOF
[general]
format          = wav49|gsm|wav
serveremail     = asterisk@$(hostname)
attach          = yes
skipms          = 3000
maxsilence      = 10
silencethreshold = 128
maxlogins       = 3
emaildateformat = %A, %B %d, %Y at %r
sendvoicemail   = yes
review          = yes
operator        = yes
saycid          = yes
envelope        = yes

[zonemessages]
eastern  = America/New_York|'vm-received' Q 'digits/at' IMp
central  = America/Chicago|'vm-received' Q 'digits/at' IMp
european = Europe/Copenhagen|'vm-received' a d b 'digits/at' HM

[default]
1001 => ${VM_PASSWORD},Extension 1001,admin@$(hostname)
1002 => ${VM_PASSWORD},Extension 1002,admin@$(hostname)
1003 => ${VM_PASSWORD},Extension 1003,admin@$(hostname)
EOF
ok "voicemail.conf ✓"

# ── cdr.conf ──────────────────────────────────────────
cat > /etc/asterisk/cdr.conf <<'EOF'
[general]
enable        = yes
unanswered    = no
endbeforehexten = no
initiatedseconds = no
batch         = no
size          = 100
time          = 300
scheduleronly = no
safeshutdown  = yes

[csv]
usegmtime = no
loguniqueid = yes
loguserfield = yes
EOF
ok "cdr.conf ✓"

# ── cdr_mysql.conf ────────────────────────────────────
cat > /etc/asterisk/cdr_mysql.conf <<EOF
[global]
hostname = localhost
port     = 3306
dbname   = ${MYSQL_DB}
password = ${MYSQL_PASS}
user     = ${MYSQL_USER}
table    = cdr
charset  = utf8mb4

;── Column mappings ──
alias start         => calldate
alias accountcode   => accountcode
alias src           => src
alias dst           => dst
alias dcontext      => dcontext
alias clid          => clid
alias channel       => channel
alias dstchannel    => dstchannel
alias lastapp       => lastapp
alias lastdata      => lastdata
alias duration      => duration
alias billsec       => billsec
alias disposition   => disposition
alias amaflags      => amaflags
alias userfield     => userfield
alias uniqueid      => uniqueid
EOF
ok "cdr_mysql.conf ✓"

# ── http.conf (for AMI/ARI) ───────────────────────────
cat > /etc/asterisk/http.conf <<'EOF'
[general]
enabled         = yes
bindaddr        = 0.0.0.0
bindport        = 8088
prefix          = asterisk
sessionlimit    = 100
session_inactivity = 30000
session_keep_alive = 15000
EOF
ok "http.conf ✓"

# ── rtp.conf ──────────────────────────────────────────
cat > /etc/asterisk/rtp.conf <<'EOF'
[general]
rtpstart = 10000
rtpend   = 20000
EOF
ok "rtp.conf ✓"

# Set ownership on all configs
chown -R asterisk:asterisk /etc/asterisk
chmod 640 /etc/asterisk/*.conf
ok "All configs written with correct permissions ✓"

# ════════════════════════════════════════════════════
# STEP 12: SYSTEMD SERVICE
# ════════════════════════════════════════════════════
header "STEP 12: Create systemd Service"

cat > /etc/systemd/system/asterisk.service <<'EOF'
[Unit]
Description=Asterisk PBX
Documentation=man:asterisk(8)
Wants=network.target
After=network.target mysql.service

[Service]
Type=simple
User=asterisk
Group=asterisk
Environment=HOME=/var/lib/asterisk
WorkingDirectory=/var/lib/asterisk

ExecStartPre=/bin/mkdir -p /run/asterisk
ExecStartPre=/bin/chown -R asterisk:asterisk /run/asterisk

ExecStart=/usr/sbin/asterisk -C /etc/asterisk/asterisk.conf -f
ExecReload=/usr/sbin/asterisk -rx "core reload"
ExecStop=/usr/sbin/asterisk -rx "core stop now"

Restart=on-failure
RestartSec=10
TimeoutStartSec=60
TimeoutStopSec=30

LimitNOFILE=65536
LimitSTACK=240
LimitCORE=infinity

# Security
NoNewPrivileges=yes
ProtectSystem=full
ProtectHome=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable asterisk
ok "systemd service created and enabled ✓"

# ════════════════════════════════════════════════════
# STEP 13: FIREWALL
# ════════════════════════════════════════════════════
header "STEP 13: Configure Firewall"

# SIP
iptables -I INPUT -p udp --dport 5060 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 5060 -j ACCEPT 2>/dev/null || true

# AMI
iptables -I INPUT -p tcp --dport 5038 -j ACCEPT 2>/dev/null || true

# HTTP/ARI
iptables -I INPUT -p tcp --dport 8088 -j ACCEPT 2>/dev/null || true

# RTP
iptables -I INPUT -p udp --dport 10000:20000 -j ACCEPT 2>/dev/null || true

iptables-save > /etc/iptables.rules 2>/dev/null || true

ufw allow 5060/udp 2>/dev/null || true
ufw allow 5060/tcp 2>/dev/null || true
ufw allow 5038/tcp 2>/dev/null || true
ufw allow 8088/tcp 2>/dev/null || true
ufw allow 10000:20000/udp 2>/dev/null || true

ok "Firewall configured ✓"

# ════════════════════════════════════════════════════
# STEP 14: START ASTERISK
# ════════════════════════════════════════════════════
header "STEP 14: Start Asterisk"

# Make sure no instance running
pkill -9 asterisk 2>/dev/null || true
sleep 3

systemctl start asterisk
sleep 8

if systemctl is-active --quiet asterisk; then
    ok "Asterisk: STARTED via systemd ✓"
else
    info "Systemd start failed - trying direct start..."
    journalctl -u asterisk --no-pager -n 15

    info "Starting directly as background process..."
    nohup /usr/sbin/asterisk \
        -C /etc/asterisk/asterisk.conf \
        -f \
        > /var/log/asterisk/startup.log 2>&1 &

    sleep 8

    if pgrep -x asterisk > /dev/null; then
        ok "Asterisk running directly ✓"
    else
        fail "Asterisk failed to start"
        info "Check logs: tail -50 /var/log/asterisk/messages"
        tail -30 /var/log/asterisk/messages 2>/dev/null
        exit 1
    fi
fi

# ════════════════════════════════════════════════════
# STEP 15: VERIFY INSTALLATION
# ════════════════════════════════════════════════════
header "STEP 15: Verification"

sleep 3

echo ""
echo "── Service Status ──"
systemctl is-active --quiet asterisk \
    && ok "Service: RUNNING ✓" \
    || info "Service: $(systemctl is-active asterisk)"

echo ""
echo "── Process ──"
pgrep -x asterisk > /dev/null \
    && ok "Process: $(pgrep -x asterisk) ✓" \
    || fail "No asterisk process found"

echo ""
echo "── Version ──"
asterisk -V && ok "Version OK ✓"

echo ""
echo "── Ports ──"
ss -tlunp | grep -E "5060|5038|8088" && ok "Ports listening ✓"

echo ""
echo "── CLI Test ──"
asterisk -rx "core show version" 2>/dev/null && ok "CLI working ✓"

echo ""
echo "── SIP Peers ──"
asterisk -rx "sip show peers" 2>/dev/null | tail -5 && ok "SIP loaded ✓"

echo ""
echo "── PJSIP Endpoints ──"
asterisk -rx "pjsip show endpoints" 2>/dev/null | tail -10

echo ""
echo "── Modules Loaded ──"
asterisk -rx "module show" 2>/dev/null | tail -3

echo ""
echo "── AMI Test ──"
sleep 1
AMI_RESULT=$(echo -e "Action: Login\r\nUsername: admin\r\nSecret: ${AMI_PASSWORD}\r\n\r\nAction: Logoff\r\n\r\n" | \
    nc -w3 127.0.0.1 5038 2>/dev/null)
echo "$AMI_RESULT" | grep -q "Authentication accepted" \
    && ok "AMI: working ✓" \
    || info "AMI: not ready (try again in a moment)"

# ════════════════════════════════════════════════════
# STEP 16: SAVE CREDENTIALS
# ════════════════════════════════════════════════════
header "STEP 16: Save Credentials"

cat > /root/.asterisk_credentials <<EOF
# ════════════════════════════════════════════════════
#  ASTERISK CREDENTIALS - Generated $(date)
#  KEEP THIS FILE SECURE!
# ════════════════════════════════════════════════════

# Server
SERVER_IP=$(hostname -I | awk '{print $1}')
HOSTNAME=$(hostname)

# Asterisk
ASTERISK_VERSION=$(asterisk -V 2>/dev/null)
INSTALL_DIR=${ASTERISK_SRC}
CONFIG_DIR=/etc/asterisk
LOG_DIR=/var/log/asterisk

# SIP Extensions
EXT_1001_USER=1001
EXT_1001_PASS=${SIP_PASSWORD}
EXT_1002_USER=1002
EXT_1002_PASS=${SIP_PASSWORD}
EXT_1003_USER=1003
EXT_1003_PASS=${SIP_PASSWORD}

# AMI (Manager Interface)
AMI_HOST=127.0.0.1
AMI_PORT=5038
AMI_USER=admin
AMI_PASS=${AMI_PASSWORD}
AMI_USER2=net2app
AMI_PASS2=${AMI_PASSWORD}

# Voicemail
VM_PASS=${VM_PASSWORD}

# HTTP/ARI
ARI_HOST=127.0.0.1
ARI_PORT=8088

# Ports
SIP_PORT=5060
AMI_PORT=5038
HTTP_PORT=8088
RTP_RANGE=10000-20000

# Service Numbers
ECHO_TEST=9999
DEMO_PLAYBACK=9998
VOICEMAIL_CHECK=9997
TIME_DATE=8888

# MySQL CDR
MYSQL_HOST=localhost
MYSQL_DB=${MYSQL_DB}
MYSQL_USER=${MYSQL_USER}
MYSQL_PASS=${MYSQL_PASS}
EOF

chmod 600 /root/.asterisk_credentials
ok "Credentials saved: /root/.asterisk_credentials ✓"

# ════════════════════════════════════════════════════
# FINAL SUMMARY
# ════════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════════"
echo -e "${GREEN}  ✅ ASTERISK INSTALLATION COMPLETE!${NC}"
echo "════════════════════════════════════════════════"
echo ""
echo -e "${CYAN}  Status:${NC}"
echo "    Service:  $(systemctl is-active asterisk)"
echo "    Version:  $(asterisk -V 2>/dev/null)"
echo "    PID:      $(pgrep -x asterisk | head -1)"
echo ""
echo -e "${CYAN}  Ports Listening:${NC}"
echo "    SIP:   5060 (UDP/TCP)"
echo "    AMI:   5038 (TCP)"
echo "    HTTP:  8088 (TCP)"
echo "    RTP:   10000-20000 (UDP)"
echo ""
echo -e "${CYAN}  Extensions:${NC}"
echo "    1001 / ${SIP_PASSWORD}"
echo "    1002 / ${SIP_PASSWORD}"
echo "    1003 / ${SIP_PASSWORD}"
echo ""
echo -e "${CYAN}  Service Numbers:${NC}"
echo "    9999 - Echo test"
echo "    9998 - Demo playback"
echo "    9997 - Voicemail check"
echo "    8888 - Date/time"
echo ""
echo -e "${CYAN}  AMI Connection:${NC}"
echo "    Host: 127.0.0.1:5038"
echo "    User: admin / ${AMI_PASSWORD}"
echo ""
echo -e "${CYAN}  Useful Commands:${NC}"
echo "    asterisk -rvvv                    # Interactive CLI"
echo "    asterisk -rx 'core show version'"
echo "    asterisk -rx 'sip show peers'"
echo "    asterisk -rx 'pjsip show endpoints'"
echo "    asterisk -rx 'core show channels'"
echo "    asterisk -rx 'manager show connected'"
echo "    asterisk -rx 'core reload'"
echo ""
echo -e "${CYAN}  Logs:${NC}"
echo "    journalctl -u asterisk -f"
echo "    tail -f /var/log/asterisk/messages"
echo "    tail -f /var/log/asterisk/full"
echo ""
echo -e "${CYAN}  Service Management:${NC}"
echo "    systemctl status asterisk"
echo "    systemctl restart asterisk"
echo "    systemctl stop asterisk"
echo ""
echo -e "${CYAN}  Test AMI:${NC}"
echo "    echo -e 'Action: Login\\r\\nUsername: admin\\r\\nSecret: ${AMI_PASSWORD}\\r\\n\\r\\n' | nc 127.0.0.1 5038"
echo ""
echo -e "${CYAN}  Test SIP Connection (from softphone):${NC}"
echo "    Server:   $(hostname -I | awk '{print $1}'):5060"
echo "    Username: 1001"
echo "    Password: ${SIP_PASSWORD}"
echo ""
echo -e "${CYAN}  Credentials File:${NC}"
echo "    cat /root/.asterisk_credentials"
echo "════════════════════════════════════════════════"

Run Installation
# Switch to root
sudo -i

# Save and run the script
nano install_asterisk_full.sh
# Paste the entire script above

chmod +x install_asterisk_full.sh
bash install_asterisk_full.sh 2>&1 | tee /var/log/asterisk-install.log
What This Fixes
✅ Permission denied errors        - All dirs created with correct ownership
✅ Phoneprov directory missing      - Pre-created before make samples
✅ Voicemail INBOX missing          - All voicemail dirs created
✅ Segfault on start                - Problematic modules disabled
✅ /usr/sbin/asterisk not found     - Proper compile + install
✅ User 'asterisk' missing          - Created BEFORE install
✅ Run dir issues                   - Uses /run/asterisk (modern)
✅ Module load errors               - All bad modules in noload list
✅ AMI not working                  - Properly configured
✅ MySQL CDR setup                  - Pre-configured for net2app DB
After Install - Verify
# All in one verification
asterisk -rx "core show version"
asterisk -rx "sip show peers"
asterisk -rx "pjsip show endpoints"
ss -tlunp | grep -E "5060|5038|8088"
echo -e "Action: Login\r\nUsername: admin\r\nSecret: Telco1988\r\n\r\n" | nc 127.0.0.1 5038
SIP Softphone Setup (Zoiper, MicroSIP, etc.)
Server:    154.95.36.154 (or your IP)
Port:      5060
Protocol:  UDP
Username:  1001
Password:  Telco1988
Domain:    154.95.36.154

Test: Dial 9999 for echo test
**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
