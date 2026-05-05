#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────
# Immense Estate – Deploy / Dev / Status helper
# Usage:
#   ./deploy.sh setup    – first-time server provisioning + env
#   ./deploy.sh deploy   – build & push to production
#   ./deploy.sh dev      – start local dev servers
#   ./deploy.sh status   – check remote server health
#   ./deploy.sh logs     – tail remote PM2 logs
#   ./deploy.sh env      – push/update .env on server
#   ./deploy.sh ssh      – open SSH session to server
#   ./deploy.sh db       – run schema on server DB
#   ./deploy.sh assets   – upload large image assets to server
#   ./deploy.sh ssl      – set up HTTPS with Let's Encrypt
# ───────────────────────────────────────────────────────────
set -euo pipefail

# ─── Config ───
SERVER_IP="45.77.226.36"
SERVER_USER="root"
REMOTE_DIR="/var/www/immenseestate"
APP_NAME="immenseestate"
DB_NAME="immenseestate"
DB_USER="immense"
SSH_KEY="$HOME/.ssh/id_ed25519"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"
SSH_CMD="ssh $SSH_OPTS $SERVER_USER@$SERVER_IP"
SCP_CMD="scp $SSH_OPTS"
LOCAL_ENV=".env.production"

# ─── Colors ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# Generate a random 32-char password
gen_password() {
  openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32
}

# ═══════════════════════════════════════════════════════════
# ENV – generate local .env.production and push to server
# ═══════════════════════════════════════════════════════════
cmd_env() {
  # If local .env.production doesn't exist, generate it
  if [ ! -f "$LOCAL_ENV" ]; then
    info "Generating $LOCAL_ENV with secure passwords..."
    DB_PASS=$(gen_password)
    cat > "$LOCAL_ENV" << EOF
# ─── Server ───
PORT=3001
NODE_ENV=production

# ─── PostgreSQL ───
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}

# ─── App ───
APP_NAME=Immense Estate
APP_VERSION=1.0.0
EOF
    ok "Generated $LOCAL_ENV (DB password: $DB_PASS)"
    warn "Save this password! It will be needed if you recreate the env."
  else
    ok "$LOCAL_ENV already exists, using it."
  fi

  info "Pushing .env to server at $REMOTE_DIR/.env ..."
  $SCP_CMD "$LOCAL_ENV" "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/.env"
  ok ".env pushed to server"

  # Also update DB password on server if it was just generated
  info "Ensuring DB user password matches .env..."
  DB_PASS_FROM_ENV=$(grep DATABASE_URL "$LOCAL_ENV" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
  if [ -n "$DB_PASS_FROM_ENV" ]; then
    $SSH_CMD "sudo -u postgres psql -c \"ALTER USER ${DB_USER} PASSWORD '${DB_PASS_FROM_ENV}';\"" 2>/dev/null || warn "Could not update DB password (PostgreSQL may not be installed yet)"
    ok "DB password synced"
  fi
}

# ═══════════════════════════════════════════════════════════
# ASSETS – upload large image files to server
# ═══════════════════════════════════════════════════════════
ASSET_FILES=("HighresScreenshot00000.png" "HighresScreenshot00001.png" "villaview.jpg")

cmd_assets() {
  info "Uploading image assets to server..."
  for f in "${ASSET_FILES[@]}"; do
    if [ -f "$f" ]; then
      # Check if file already exists on server with same size
      LOCAL_SIZE=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f" 2>/dev/null || echo 0)
      REMOTE_SIZE=$($SSH_CMD "stat -c%s $REMOTE_DIR/$f 2>/dev/null || echo 0")
      if [ "$LOCAL_SIZE" = "$REMOTE_SIZE" ] && [ "$LOCAL_SIZE" != "0" ]; then
        ok "$f already on server (${LOCAL_SIZE} bytes), skipping"
      else
        info "Uploading $f ($(( LOCAL_SIZE / 1024 / 1024 ))MB)..."
        $SCP_CMD "$f" "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/$f"
        ok "$f uploaded"
      fi
    else
      warn "$f not found locally, skipping"
    fi
  done
  ok "Assets upload complete"
}

# ═══════════════════════════════════════════════════════════
# UPLOADS – sync uploaded villa floor images to server
# ═══════════════════════════════════════════════════════════
cmd_uploads() {
  if [ ! -d "uploads/villas" ]; then
    warn "uploads/villas not found locally, skipping villa uploads sync"
    return 0
  fi

  info "Syncing uploaded villa images to server..."
  $SSH_CMD "mkdir -p $REMOTE_DIR/uploads/villas"

  if command -v rsync >/dev/null 2>&1; then
    rsync -avz --progress \
      -e "ssh $SSH_OPTS" \
      ./uploads/villas/ "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/uploads/villas/"
  else
    warn "rsync not found locally, using tar + ssh fallback for uploads..."
    tar -C ./uploads -czf - villas | $SSH_CMD "mkdir -p $REMOTE_DIR/uploads && tar -xzf - -C $REMOTE_DIR/uploads"
  fi

  ok "Villa uploads synced"
}

# ═══════════════════════════════════════════════════════════
# DEPLOY – build locally, rsync to server, restart PM2
# ═══════════════════════════════════════════════════════════
cmd_deploy() {
  # Ensure .env exists on server
  if ! $SSH_CMD "test -f $REMOTE_DIR/.env" 2>/dev/null; then
    warn ".env not found on server, pushing now..."
    cmd_env
  fi

  info "Building frontend..."
  npm run build || fail "Build failed"
  ok "Build complete"

  info "Syncing files to $SERVER_USER@$SERVER_IP:$REMOTE_DIR ..."
  if command -v rsync >/dev/null 2>&1; then
    rsync -avz --progress \
      --exclude='node_modules' \
      --exclude='.git' \
      --exclude='UI_fix' \
      --exclude='.env' \
      --exclude='.env.production' \
      --exclude='.env.example' \
      --exclude='uploads/villas/*' \
      --exclude='HighresScreenshot*.png' \
      --exclude='villaview.jpg' \
      --exclude='Screenshot*' \
      -e "ssh $SSH_OPTS" \
      ./ "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"
  else
    warn "rsync not found locally, using tar + ssh fallback..."
    tar \
      --exclude='./node_modules' \
      --exclude='./.git' \
      --exclude='./UI_fix' \
      --exclude='./.env' \
      --exclude='./.env.production' \
      --exclude='./.env.example' \
      --exclude='./uploads/villas' \
      --exclude='./HighresScreenshot*.png' \
      --exclude='./villaview.jpg' \
      --exclude='./Screenshot*' \
      -czf - . | $SSH_CMD "mkdir -p $REMOTE_DIR && tar -xzf - -C $REMOTE_DIR"
  fi
  ok "Files synced"

  # Upload large image assets (skips if already on server)
  cmd_assets

  # Sync uploaded villa floor images
  cmd_uploads

  info "Installing dependencies & restarting on server..."
  $SSH_CMD << 'REMOTE'
    set -e
    cd /var/www/immenseestate
    export NODE_ENV=production
    npm ci --omit=dev
    # Start or restart PM2
    if pm2 describe immenseestate > /dev/null 2>&1; then
      pm2 restart immenseestate
    else
      pm2 start server.js --name immenseestate --node-args="--env-file=.env"
    fi
    pm2 save
REMOTE
  ok "Deployed & restarted on server!"
  echo ""
  info "Health: http://$SERVER_IP/health"
  info "App:    http://$SERVER_IP"
}

# ═══════════════════════════════════════════════════════════
# DEV – run local development
# ═══════════════════════════════════════════════════════════
cmd_dev() {
  info "Starting local dev servers (Vite + API)..."
  npm run dev
}

# ═══════════════════════════════════════════════════════════
# STATUS – check remote server health
# ═══════════════════════════════════════════════════════════
cmd_status() {
  info "Checking server connectivity..."
  if $SSH_CMD "echo 'SSH OK'" > /dev/null 2>&1; then
    ok "SSH connection successful"
  else
    fail "Cannot connect to server"
  fi

  info "Checking PM2 process..."
  $SSH_CMD "pm2 describe $APP_NAME 2>/dev/null | head -20" || warn "PM2 process not found"

  info "Checking health endpoint..."
  HEALTH=$(curl -s --connect-timeout 5 "http://$SERVER_IP:3001/api/health" 2>/dev/null) || true
  if [ -n "$HEALTH" ]; then
    ok "Health response:"
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
  else
    warn "Health endpoint not responding (server may not be running yet)"
  fi

  info "Server resources:"
  $SSH_CMD << 'REMOTE'
    echo "── Uptime ──"
    uptime
    echo ""
    echo "── Memory ──"
    free -h
    echo ""
    echo "── Disk ──"
    df -h /
    echo ""
    echo "── Node version ──"
    node --version 2>/dev/null || echo "Node not installed"
    echo ""
    echo "── PM2 list ──"
    pm2 list 2>/dev/null || echo "PM2 not installed"
REMOTE
}

# ═══════════════════════════════════════════════════════════
# SETUP – first-time server provisioning + env + schema
# ═══════════════════════════════════════════════════════════
cmd_setup() {
  info "Step 1/5: Provisioning server at $SERVER_IP..."
  $SSH_CMD << 'REMOTE'
    set -e
    echo "── Updating system ──"
    apt update && apt upgrade -y

    echo "── Installing Node.js 22 LTS ──"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt install -y nodejs

    echo "── Installing PM2 ──"
    npm install -g pm2

    echo "── Installing Nginx ──"
    apt install -y nginx
    systemctl enable nginx

    echo "── Installing PostgreSQL 16 ──"
    apt install -y postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql

    echo "── Creating DB user and database ──"
    sudo -u postgres psql -c "CREATE USER immense WITH PASSWORD 'temp_setup_pwd';" 2>/dev/null || echo "User may already exist"
    sudo -u postgres psql -c "CREATE DATABASE immenseestate OWNER immense;" 2>/dev/null || echo "DB may already exist"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE immenseestate TO immense;"

    echo "── Creating app directory ──"
    mkdir -p /var/www/immenseestate
    mkdir -p /var/www/immenseestate/uploads/villas
    mkdir -p /var/www/immenseestate/data

    echo "── Setting up Nginx reverse proxy ──"
    cat > /etc/nginx/sites-available/immenseestate << 'NGINX'
server {
    listen 80;
    server_name _;

    client_max_body_size 150M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

    ln -sf /etc/nginx/sites-available/immenseestate /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl restart nginx

    echo "── Setting up UFW firewall ──"
    ufw allow OpenSSH
    ufw allow 'Nginx Full'
    ufw --force enable

    echo "── PM2 startup ──"
    pm2 startup systemd -u root --hp /root
REMOTE
  ok "Step 1/5: Server provisioned"

  info "Step 2/5: Generating and pushing .env..."
  cmd_env
  ok "Step 2/5: .env configured"

  info "Step 3/5: Running database schema..."
  cmd_db
  ok "Step 3/5: Database schema applied"

  info "Step 4/5: Deploying application..."
  cmd_deploy
  ok "Step 4/5: Application deployed"

  info "Step 5/5: Final health check..."
  sleep 3
  HEALTH=$(curl -s --connect-timeout 5 "http://$SERVER_IP/api/health" 2>/dev/null) || true
  if [ -n "$HEALTH" ]; then
    ok "Server is live!"
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
  else
    warn "Health endpoint not responding yet. Check: ./deploy.sh logs"
  fi

  echo ""
  ok "══════════════════════════════════════════"
  ok "  Setup complete!"
  ok "══════════════════════════════════════════"
  echo ""
  info "App:       http://$SERVER_IP"
  info "Health UI: http://$SERVER_IP/health"
  info "Health API:http://$SERVER_IP/api/health"
  info "SSH:       ./deploy.sh ssh"
  info "Logs:      ./deploy.sh logs"
  info "Status:    ./deploy.sh status"
  echo ""
}

# ═══════════════════════════════════════════════════════════
# DB – run schema on remote PostgreSQL
# ═══════════════════════════════════════════════════════════
cmd_db() {
  info "Running database schema on server..."
  # Read DATABASE_URL from local .env.production
  if [ ! -f "$LOCAL_ENV" ]; then
    fail "$LOCAL_ENV not found. Run: ./deploy.sh env"
  fi
  DB_URL=$(grep DATABASE_URL "$LOCAL_ENV" | cut -d= -f2-)
  if [ -z "$DB_URL" ]; then
    fail "DATABASE_URL not found in $LOCAL_ENV"
  fi

  # Push schema to server and run it
  $SCP_CMD db/schema.sql "$SERVER_USER@$SERVER_IP:/tmp/immense_schema.sql"
  $SSH_CMD "PGPASSWORD=$(echo $DB_URL | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p') psql -U ${DB_USER} -h localhost -d ${DB_NAME} -f /tmp/immense_schema.sql && rm /tmp/immense_schema.sql"
  ok "Database schema applied"
}

# ═══════════════════════════════════════════════════════════
# SSH – open interactive session
# ═══════════════════════════════════════════════════════════
cmd_ssh() {
  info "Connecting to $SERVER_USER@$SERVER_IP ..."
  exec ssh $SSH_OPTS $SERVER_USER@$SERVER_IP
}

# ═══════════════════════════════════════════════════════════
# LOGS – tail remote PM2 logs
# ═══════════════════════════════════════════════════════════
cmd_logs() {
  info "Tailing PM2 logs on server..."
  $SSH_CMD "pm2 logs $APP_NAME --lines 50"
}

# ═══════════════════════════════════════════════════════════
# RESTART – restart app on server without redeploy
# ═══════════════════════════════════════════════════════════
cmd_restart() {
  info "Restarting $APP_NAME on server..."
  $SSH_CMD "cd $REMOTE_DIR && pm2 restart $APP_NAME"
  ok "Restarted"
}

# ═══════════════════════════════════════════════════════════
# SSL – set up HTTPS with Let's Encrypt (requires domain)
# ═══════════════════════════════════════════════════════════
cmd_ssl() {
  DOMAIN="${2:-}"
  if [ -z "$DOMAIN" ]; then
    echo ""
    echo "  Usage: ./deploy.sh ssl <domain>"
    echo "  Example: ./deploy.sh ssl immenseestate.com"
    echo ""
    echo "  Prerequisites:"
    echo "    1. Point your domain's A record to $SERVER_IP"
    echo "    2. Wait for DNS propagation (check: nslookup <domain>)"
    echo "    3. Then run this command"
    echo ""
    exit 1
  fi

  info "Setting up HTTPS for $DOMAIN ..."

  # Update Nginx config with the domain
  $SSH_CMD << REMOTE
    set -e
    echo "── Installing Certbot ──"
    apt install -y certbot python3-certbot-nginx

    echo "── Updating Nginx server_name ──"
    cat > /etc/nginx/sites-available/immenseestate << 'NGINX'
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    client_max_body_size 150M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX
    nginx -t && systemctl reload nginx

    echo "── Obtaining SSL certificate ──"
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect

    echo "── Enabling auto-renewal ──"
    systemctl enable certbot.timer
    systemctl start certbot.timer
REMOTE

  ok "HTTPS configured for $DOMAIN"
  echo ""
  info "App: https://$DOMAIN"
  info "Health: https://$DOMAIN/health"
}

# ═══════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════
case "${1:-help}" in
  setup)   cmd_setup ;;
  deploy)  cmd_deploy ;;
  dev)     cmd_dev ;;
  status)  cmd_status ;;
  env)     cmd_env ;;
  db)      cmd_db ;;
  ssh)     cmd_ssh ;;
  logs)    cmd_logs ;;
  restart) cmd_restart ;;
  assets)  cmd_assets ;;
  uploads) cmd_uploads ;;
  ssl)     cmd_ssl "$@" ;;
  *)
    echo ""
    echo "  Immense Estate Deploy Tool"
    echo "  Server: $SERVER_USER@$SERVER_IP"
    echo ""
    echo "  Usage: ./deploy.sh <command>"
    echo ""
    echo "  Commands:"
    echo "    setup        Full first-time provisioning (installs everything + deploys)"
    echo "    deploy       Build frontend & deploy to production server"
    echo "    dev          Start local development servers"
    echo "    status       Check remote server health & resources"
    echo "    env          Generate & push .env to server"
    echo "    db           Run database schema on server"
    echo "    ssh          Open SSH session to server"
    echo "    logs         Tail remote PM2 logs"
    echo "    restart      Restart app on server (no redeploy)"
    echo "    assets       Upload large image assets to server"
    echo "    uploads      Sync uploaded villa floor images to server"
    echo "    ssl <domain> Set up HTTPS with Let's Encrypt"
    echo ""
    ;;
esac
