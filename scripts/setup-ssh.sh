#!/usr/bin/env bash
# ============================================================================
# setup-ssh.sh — Interactive SSH key generator for GitHub
# Copyright 2026 Stratagem. All rights reserved.
#
# Generates an ed25519 SSH key pair, adds it to the agent, displays the
# public key for GitHub, tests the connection, and optionally switches the
# current repo's git remote from HTTPS to SSH.
#
# Usage:  chmod +x setup-ssh.sh && ./setup-ssh.sh
# Safe to run on multiple machines — backs up existing keys instead of
# overwriting them.
# ============================================================================

set -euo pipefail

KEY_TYPE="ed25519"
KEY_PATH="$HOME/.ssh/id_${KEY_TYPE}"
KEY_EMAIL="thompson1leg14@gmail.com"
REPO_REMOTE_URL="git@github.com:LostLimbRider/official.git"

# ── helpers ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { printf "${CYAN}[INFO]${RESET}  %s\n" "$*"; }
ok()    { printf "${GREEN}[OK]${RESET}    %s\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${RESET}  %s\n" "$*"; }
err()   { printf "${RED}[ERROR]${RESET} %s\n" "$*"; }

confirm() {
    local prompt="$1"
    local reply
    printf "${BOLD}%s [y/N]: ${RESET}" "$prompt"
    read -r reply
    [[ "$reply" =~ ^[Yy]$ ]]
}

# ── banner ───────────────────────────────────────────────────────────────────

cat <<'BANNER'

  ╔══════════════════════════════════════════════════════════════╗
  ║               LOST LIMB RIDERS — SSH SETUP                   ║
  ║           Interactive Key Generator for GitHub               ║
  ║                    Copyright 2026 Stratagem                  ║
  ╚══════════════════════════════════════════════════════════════╝

BANNER

# ── 1. check prerequisites ──────────────────────────────────────────────────

info "Checking prerequisites..."

MISSING=0
for cmd in ssh-keygen ssh-add ssh git; do
    if ! command -v "$cmd" &>/dev/null; then
        err "Missing required command: $cmd"
        MISSING=1
    fi
done

if [[ "$MISSING" -eq 1 ]]; then
    err "Install the missing tools above and re-run this script."
    exit 1
fi
ok "All prerequisites found."

# ── 2. check for existing keys ──────────────────────────────────────────────

if [[ -f "$KEY_PATH" ]]; then
    warn "Existing key found at $KEY_PATH"
    warn "This key is already in use — overwriting would break other machines."
    echo ""
    if confirm "Back it up and generate a new key?"; then
        BACKUP="${KEY_PATH}.backup.$(date +%Y%m%d%H%M%S)"
        cp "$KEY_PATH" "$BACKUP"
        cp "${KEY_PATH}.pub" "${BACKUP}.pub" 2>/dev/null || true
        ok "Backed up to $BACKUP"
    else
        info "Aborting — existing key preserved."
        exit 0
    fi
fi

# ── 3. ensure ~/.ssh exists ─────────────────────────────────────────────────

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

# ── 4. generate the key ─────────────────────────────────────────────────────

info "Generating new ${KEY_TYPE} key..."
ssh-keygen -t "$KEY_TYPE" -C "$KEY_EMAIL" -f "$KEY_PATH" -N "" -q
chmod 600 "$KEY_PATH"
chmod 644 "${KEY_PATH}.pub"
ok "Key pair created at $KEY_PATH"

# ── 5. start ssh-agent and add key ──────────────────────────────────────────

info "Starting ssh-agent..."
eval "$(ssh-agent -s)" >/dev/null 2>&1

info "Adding key to agent..."
ssh-add "$KEY_PATH" >/dev/null 2>&1
ok "Key added to ssh-agent."

# ── 6. display public key ───────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════"
printf "${BOLD}${GREEN}  COPY THE PUBLIC KEY BELOW:${RESET}\n"
echo "═══════════════════════════════════════════════════════════════"
echo ""
cat "${KEY_PATH}.pub"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
printf "${BOLD}  ADD IT TO GITHUB:${RESET}\n"
echo "  1. Go to https://github.com/settings/keys"
echo "  2. Click \"New SSH key\""
echo "  3. Give it a title (e.g., \"$(hostname) - $(date +%Y-%m-%d)\")"
echo "  4. Paste the key above"
echo "  5. Click \"Add SSH key\""
echo ""

if ! confirm "Have you added the key to GitHub?"; then
    warn "Skipping connection test. Run this script again after adding the key."
    exit 0
fi

# ── 7. test connection ──────────────────────────────────────────────────────

echo ""
info "Testing SSH connection to GitHub..."
SSH_OUTPUT=$(ssh -T git@github.com 2>&1) || true
if echo "$SSH_OUTPUT" | grep -qi "successfully\|authenticated"; then
    ok "GitHub says: $SSH_OUTPUT"
else
    warn "Connection test returned: $SSH_OUTPUT"
    warn "If this failed, make sure the key is added to GitHub and try again."
    echo ""
    if ! confirm "Continue anyway and switch git remote to SSH?"; then
        exit 1
    fi
fi

# ── 8. switch git remote to SSH (if inside a repo) ──────────────────────────

if git rev-parse --git-dir &>/dev/null 2>&1; then
    CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "none")
    echo ""
    info "Current origin remote: $CURRENT_REMOTE"

    if [[ "$CURRENT_REMOTE" == "$REPO_REMOTE_URL" ]]; then
        ok "Origin already uses SSH — nothing to change."
    elif confirm "Switch origin remote to SSH?"; then
        git remote set-url origin "$REPO_REMOTE_URL"
        ok "Origin switched to SSH: $REPO_REMOTE_URL"
    fi
else
    warn "Not inside a git repo — skipping remote switch."
fi

# ── 9. setup summary ────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════"
printf "${BOLD}${GREEN}  SSH SETUP COMPLETE${RESET}\n"
echo "═══════════════════════════════════════════════════════════════"
echo ""
info "Key:    $KEY_PATH"
info "Public: ${KEY_PATH}.pub"
info "Email:  $KEY_EMAIL"
echo ""
echo "  IMPORTANT: Copy the PRIVATE key (id_ed25519, not .pub) to your"
echo "  other machine at ~/.ssh/id_ed25519 and run:"
echo ""
echo "    chmod 600 ~/.ssh/id_ed25519"
echo "    eval \$(ssh-agent -s)"
echo "    ssh-add ~/.ssh/id_ed25519"
echo ""
echo "  The public key is already on GitHub — both machines will work."
echo ""

# ── 10. interactive menu (repo operations) ──────────────────────────────────

if ! git rev-parse --git-dir &>/dev/null 2>&1; then
    info "Not inside a git repo — nothing else to do."
    exit 0
fi

show_menu() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    printf "${BOLD}  WHAT DO YOU WANT TO DO?${RESET}\n"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "  1) Pull latest from GitHub (safe merge)"
    echo "  2) Force overwrite local with GitHub (DESTRUCTIVE — local changes lost)"
    echo "  3) Check status & recent commits"
    echo "  4) Push local changes to GitHub"
    echo "  5) Switch remote between HTTPS ↔ SSH"
    echo "  6) Exit"
    echo ""
}

do_pull() {
    info "Fetching from origin..."
    git fetch origin
    info "Pulling main branch..."
    git pull origin main
    ok "Up to date."
}

do_force_overwrite() {
    echo ""
    warn "This will DISCARD all local changes and overwrite with GitHub's main branch."
    if ! confirm "Are you SURE?"; then
        info "Cancelled."
        return
    fi
    info "Stashing any local changes..."
    git stash --include-untracked 2>/dev/null || true
    info "Fetching from origin..."
    git fetch origin
    info "Hard resetting to origin/main..."
    git reset --hard origin/main
    info "Cleaning untracked files..."
    git clean -fd
    ok "Local codebase forcefully overwritten with GitHub main."
}

do_status() {
    echo ""
    info "Current branch:"
    git branch -v
    echo ""
    info "Remote:"
    git remote -v
    echo ""
    info "Status:"
    git status --short
    echo ""
    info "Last 10 commits:"
    git log --oneline -10
    echo ""
}

do_push() {
    info "Pushing to origin..."
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    git push origin "$BRANCH"
    ok "Pushed $BRANCH to origin."
}

do_switch_remote() {
    CURRENT=$(git remote get-url origin 2>/dev/null || echo "none")
    SSH_URL="git@github.com:LostLimbRider/official.git"
    HTTPS_URL="https://github.com/LostLimbRider/official.git"

    echo ""
    info "Current remote URL: $CURRENT"

    if [[ "$CURRENT" == "$SSH_URL" ]]; then
        if confirm "Switch from SSH to HTTPS?"; then
            git remote set-url origin "$HTTPS_URL"
            ok "Switched to HTTPS: $HTTPS_URL"
        fi
    else
        if confirm "Switch from HTTPS to SSH?"; then
            git remote set-url origin "$SSH_URL"
            ok "Switched to SSH: $SSH_URL"
        fi
    fi
}

# ── menu loop ────────────────────────────────────────────────────────────────

while true; do
    show_menu
    printf "${BOLD}  Select [1-6]: ${RESET}"
    read -r choice
    echo ""
    case "$choice" in
        1) do_pull ;;
        2) do_force_overwrite ;;
        3) do_status ;;
        4) do_push ;;
        5) do_switch_remote ;;
        6) info "Exiting."; exit 0 ;;
        *) warn "Invalid option — enter 1-6." ;;
    esac
done
