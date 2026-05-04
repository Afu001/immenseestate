#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────
# Immense Estate – Deploy / Dev / Status helper
# Usage:
#   ./deploy.sh deploy   – build & push to production
#   ./deploy.sh dev      – start local dev servers
#   ./deploy.sh status   – check remote server health
#   ./deploy.sh setup    – first-time server provisioning
#   ./deploy.sh logs     – tail remote PM2 logs
# ───────────────────────────────────────────────────────────
set -euo pipefail

# ─── Config ───
SERVER_IP="45.77.226.36"
SERVER_USER="root"
REMOTE_DIR="/var/www/immenseestate"
APP_NAME="immenseestate"
SSH_KEY="$HOME/.ssh/id_ed25519"
SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP"

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

# ═══════════════════════════════════════════════════════════
# DEPLOY – build locally, rsync to server, restart PM2
# ═══════════════════════════════════════════════════════════
cmd_deploy() {
  info "Building frontend..."
  npm run build || fail "Build failed"
  ok "Build complete"

  info "Syncing files to $SERVER_USER@$SERVER_IP:$REMOTE_DIR ..."
  rsync -avz --progress \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='UI_fix' \
    --exclude='.env' \
    --exclude='uploads/villas/*' \
    -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
    ./ "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"
  ok "Files synced"

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
  info "Health: http://$SERVER_IP:3001/health"
  info "App:    http://$SERVER_IP:3001"
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
# SETUP – first-time server provisioning
# ═══════════════════════════════════════════════════════════
cmd_setup() {
  info "Provisioning server at $SERVER_IP..."
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
    sudo -u postgres psql -c "CREATE USER immense WITH PASSWORD 'CHANGE_ME_NOW';" 2>/dev/null || echo "User may already exist"
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
    
    echo ""
    echo "✅ Server provisioned successfully!"
    echo ""
    echo "IMPORTANT: Change the PostgreSQL password!"
    echo "  sudo -u postgres psql -c \"ALTER USER immense PASSWORD 'YOUR_SECURE_PASSWORD';\""
    echo ""
    echo "Then create .env on server:"
    echo "  nano /var/www/immenseestate/.env"
    echo ""
    echo "Then run schema:"
    echo "  psql postgresql://immense:YOUR_PASSWORD@localhost:5432/immenseestate -f /var/www/immenseestate/db/schema.sql"
REMOTE
  ok "Server provisioned! Follow the instructions above."
}

# ═══════════════════════════════════════════════════════════
# LOGS – tail remote PM2 logs
# ═══════════════════════════════════════════════════════════
cmd_logs() {
  info "Tailing PM2 logs on server..."
  $SSH_CMD "pm2 logs $APP_NAME --lines 50"
}

# ═══════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════
case "${1:-help}" in
  deploy)  cmd_deploy ;;
  dev)     cmd_dev ;;
  status)  cmd_status ;;
  setup)   cmd_setup ;;
  logs)    cmd_logs ;;
  *)
    echo ""
    echo "  Immense Estate Deploy Tool"
    echo ""
    echo "  Usage: ./deploy.sh <command>"
    echo ""
    echo "  Commands:"
    echo "    setup    First-time server provisioning (Node, Nginx, PostgreSQL, PM2)"
    echo "    deploy   Build frontend & deploy to production server"
    echo "    dev      Start local development servers"
    echo "    status   Check remote server health & resources"
    echo "    logs     Tail remote PM2 logs"
    echo ""
    ;;
esac
