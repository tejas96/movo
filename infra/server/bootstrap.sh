#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 VM for MOVO (Oracle Cloud, arm64 or amd64).
# Safe to run again: every step checks before it changes anything.
#
#   ssh -i ~/.ssh/movo_oracle ubuntu@<ip> 'bash -s' < infra/server/bootstrap.sh
#
# Does: timezone, full upgrade, unattended security updates, host firewall 80/443 (above
# Oracle's REJECT rule), 2 GB swap, Docker Engine + compose plugin, SSH password login off,
# /opt/movo. Then add the deploy key and copy the stack (docs/08-release-and-ops.md, 2.8-2.10).
# Prints REBOOT-NEEDED at the end when a kernel update needs a reboot.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
log() { printf '\n== %s\n' "$*"; }

log "timezone"
sudo timedatectl set-timezone Asia/Kolkata

log "packages"
sudo apt-get update -q
sudo apt-get -y -q -o Dpkg::Options::=--force-confold full-upgrade
sudo apt-get -y -q install unattended-upgrades ca-certificates curl
echo 'unattended-upgrades unattended-upgrades/enable_auto_updates boolean true' | sudo debconf-set-selections
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

log "host firewall: 80/tcp, 443/tcp, 443/udp before the REJECT rule"
# Oracle images end INPUT with a REJECT; rules appended after it never match.
allow() { # proto port
  sudo iptables -C INPUT -m state --state NEW -p "$1" --dport "$2" -j ACCEPT 2>/dev/null && return 0
  local n
  n=$(sudo iptables -L INPUT --line-numbers -n | awk '$2=="REJECT"{print $1; exit}')
  if [ -n "$n" ]; then
    sudo iptables -I INPUT "$n" -m state --state NEW -p "$1" --dport "$2" -j ACCEPT
  else
    sudo iptables -A INPUT -m state --state NEW -p "$1" --dport "$2" -j ACCEPT
  fi
}
allow tcp 80
allow tcp 443
allow udp 443
sudo netfilter-persistent save >/dev/null

log "swap 2 GB"
if ! sudo swapon --show=NAME --noheadings | grep -q '^/swapfile$'; then
  [ -f /swapfile ] || { sudo fallocate -l 2G /swapfile; sudo chmod 600 /swapfile; sudo mkswap /swapfile >/dev/null; }
  sudo swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-movo.conf >/dev/null
sudo sysctl --system >/dev/null

log "docker"
if ! command -v docker >/dev/null; then
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -q
  sudo apt-get -y -q install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
sudo systemctl enable --now docker
id -nG ubuntu | grep -qw docker || sudo usermod -aG docker ubuntu

log "ssh: keys only"
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' \
  | sudo tee /etc/ssh/sshd_config.d/99-movo.conf >/dev/null
sudo systemctl reload ssh

log "app folder"
sudo mkdir -p /opt/movo/backup /opt/movo/backups
sudo chown ubuntu:ubuntu /opt/movo /opt/movo/backup /opt/movo/backups

log "done: $(uname -m), $(docker --version)"
[ -f /var/run/reboot-required ] && echo "REBOOT-NEEDED: sudo reboot"
exit 0
