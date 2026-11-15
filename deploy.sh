#!/usr/bin/env bash
set -euo pipefail

# Functions are parsed before checkout can replace this script on disk.
main() {
  cd "$(dirname "${BASH_SOURCE[0]}")"
  local root
  root=$(pwd -P)
  if [[ "$root" != /home/riley-drake/Projects/wishlist/app ]]; then
    echo 'Run deployment only in /home/riley-drake/Projects/wishlist/app.' >&2
    return 1
  fi
  for dependency in git docker python3 flock; do
    command -v "$dependency" >/dev/null || { echo "Missing $dependency" >&2; return 1; }
  done
  [[ -d .git && -f deploy/app.env ]] || { echo 'Complete the Git checkout setup and keep deploy/app.env on the server.' >&2; return 1; }
  local remote
  remote=$(git remote get-url origin)
  case "$remote" in
    https://github.com/RileyDrk/Wishlist-App.git|git@github.com:RileyDrk/Wishlist-App.git) ;;
    *) echo 'Unexpected origin repository. Stopping.' >&2; return 1 ;;
  esac
  umask 077
  local state="$root/../.wishlist-deploy"
  mkdir -p "$state"
  chmod 700 "$state"
  exec 9>"$state/lock"
  flock -n 9 || { echo 'Another deployment is already running.' >&2; return 1; }
  git diff --quiet && git diff --cached --quiet || { echo 'Tracked server files have local changes. Commit or resolve them before deploying.' >&2; return 1; }
  git fetch origin '+refs/heads/main:refs/remotes/origin/main'
  local target=${1:-$(git rev-parse origin/main)}
  [[ "$target" =~ ^[a-f0-9]{40}$ ]] || { echo 'Expected a full commit SHA.' >&2; return 1; }
  git merge-base --is-ancestor "$target" origin/main || { echo 'The requested commit is not on main.' >&2; return 1; }
  if [[ -n "$(git ls-tree -r --name-only "$target" -- deploy/app.env .env .data)" ]]; then
    echo 'The target commit contains server configuration or preview data. Stopping.' >&2
    return 1
  fi

  local -a compose=(docker compose --env-file deploy/app.env -p wishlist-app -f deploy/compose.app.yml)
  local previous_id previous_image previous_commit
  previous_commit=$(git rev-parse HEAD)
  previous_id=$("${compose[@]}" ps -aq app)
  previous_image=''
  if [[ -n "$previous_id" ]]; then
    previous_image=$(docker inspect --format '{{.Image}}' "$previous_id")
    if [[ -f "$state/last-good.json" ]]; then
      cp "$state/last-good.json" "$state/rollback.json"
    else
      "${compose[@]}" config --format json > "$state/rollback.json"
    fi
    pin_image "$state/rollback.json" "$previous_image"
  fi

  git checkout --detach "$target"
  export WISHLIST_IMAGE_TAG="$target"
  "${compose[@]}" config --quiet
  echo "Building wishlist commit $target. The current container stays running during the build."
  "${compose[@]}" build app
  if ! "${compose[@]}" up -d --no-build --pull never --no-deps --wait --wait-timeout 120 app; then
    echo 'The replacement app did not become healthy.' >&2
    if [[ -n "$previous_image" ]]; then
      echo 'Restoring the previous app image and configuration.' >&2
      if docker compose -p wishlist-app -f "$state/rollback.json" up -d --no-build --pull never --no-deps --force-recreate --wait --wait-timeout 120 app; then
        git checkout --detach "$previous_commit"
        echo 'Previous app restored. This deployment is still reported as failed.' >&2
      else
        echo 'Automatic rollback also failed. Inspect the app container on the server.' >&2
      fi
    fi
    return 1
  fi
  "${compose[@]}" config --format json > "$state/last-good.json"
  local new_id
  new_id=$("${compose[@]}" ps -q app)
  pin_image "$state/last-good.json" "$(docker inspect --format '{{.Image}}' "$new_id")"
  echo "Wishlist deployed successfully: $target"
  "${compose[@]}" ps app
}

pin_image() {
  # These protected JSON files contain runtime secrets: never print them.
  python3 - "$1" "$2" <<'PY'
import json
import sys
from pathlib import Path
filename = Path(sys.argv[1])
config = json.loads(filename.read_text())
config['services']['app']['image'] = sys.argv[2]
config['services']['app'].pop('build', None)
filename.write_text(json.dumps(config))
PY
}

main "$@"
