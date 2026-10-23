#!/usr/bin/env bash
# Explicit retention; never run automatically during deployment/recovery.
set +x
set -Eeuo pipefail
fail() { printf '%s\n' "$1" >&2; exit 1; }
usage='Usage: bash scripts/cleanup-releases.sh [--dry-run|--apply] [--keep N (at least 2)]'
mode=--dry-run
keep=3
mode_set=false
keep_set=false
while (( $# )); do
  case "$1" in
    --dry-run|--apply)
      ! "$mode_set" || fail "$usage"
      mode=$1; mode_set=true; shift ;;
    --keep)
      ! "$keep_set" && [[ ${2-} =~ ^[1-9][0-9]{0,3}$ ]] && (( $2 >= 2 )) || fail "$usage"
      keep=$2; keep_set=true; shift 2 ;;
    *) fail "$usage" ;;
  esac
done
[[ $EUID -ne 0 ]] || fail 'Run cleanup as the unprivileged deployment account, or use sudo oclr cleanup.'
install_dir=${OCLR_INSTALL_DIR:-/opt/oclr}
service=${OCLR_SERVICE:-oclr.service}
[[ "$install_dir" == /* && ! -L "$install_dir" && -d "$install_dir" ]] || fail 'Use a real, absolute installation directory.'
[[ "$service" =~ ^[a-zA-Z0-9_-]+\.service$ ]] || fail 'Choose a valid systemd service name.'
for name in node flock systemctl; do command -v "$name" >/dev/null || fail "Required command is unavailable: $name"; done
install_dir=$(cd -- "$install_dir" && pwd -P)
# Open the updater's existing lock read-only: previews must not create files.
[[ -f "$install_dir/.update.lock" && ! -L "$install_dir/.update.lock" ]] || fail 'The existing update lock is required; inspect the installation before cleanup.'
exec 9<"$install_dir/.update.lock"
flock -n 9 || fail 'Another update or cleanup is running for this installation.'
[[ $(systemctl show --property=User --value "$service") == "$(id -un)" ]] || fail 'Run as the configured service user.'
[[ $(systemctl show --property=WorkingDirectory --value "$service") == "$install_dir/current" ]] || fail 'The service WorkingDirectory does not match this installation.'
systemctl is-active --quiet "$service" || fail 'The service is stopped. Inspect recovery before deleting releases.'
# No runtime.env, credentials, npm dependencies or service sudo rights needed.
script_dir=$(cd -- "${BASH_SOURCE[0]%/*}" && pwd -P)
exec node "$script_dir/cleanup-releases.mjs" "$install_dir" "$mode" "$keep"
