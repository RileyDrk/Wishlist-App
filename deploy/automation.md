# Automatic deployments

This follows the portfolio's GitHub Actions + SSH setup. A push to `main`
runs tests, builds the frontend, checks Compose and Bash syntax, then asks the
server to deploy that exact tested commit. Manual runs on `main` also work.
Deployment runs are serialized, including manual server deployments.

## One-time setup

1. Commit and push this app and the new workflow/script to the Wishlist repo.
   The first deploy job cannot succeed until its secrets and server checkout
   are configured. Keep all real env files and `.data` out of Git.
2. On the server, switch from the archive copy to a Git checkout using the
   commands below. The running app does not bind-mount its source folder, so
   swapping source folders does not stop the container.
3. Add the Wishlist repository's Actions secrets.
4. Run **Actions → Deploy Wishlist → Run workflow**, on `main`.

### Convert the server's archive copy to a Git checkout

Run as `riley-drake`. The two new folder names must not already exist; inspect
and choose different backup names if they do. The backup includes credentials
and must remain private. Do not delete it until a successful deployment.

```sh
(
set -euo pipefail
cd ~/Projects/wishlist
test ! -e app-repo && test ! -e app-manual-backup
git clone https://github.com/RileyDrk/Wishlist-App.git app-repo
install -m 600 app/deploy/app.env app-repo/deploy/app.env
chmod 700 app
mv -T app app-manual-backup
mv -T app-repo app
cd app
git status --short
bash -n deploy.sh
)
```

Stop on any error. If cloning a private repo fails, configure a read-only
repository credential on the server. Do not put a GitHub token into its URL.
The existing `deploy/app.env`, database container, and named photo volume are
retained. Do not run the original database Compose file from inside `app`.

### GitHub Actions secrets

In [Wishlist repository Actions secrets](https://github.com/RileyDrk/Wishlist-App/settings/secrets/actions),
add the same named values your portfolio uses, if its deployment key permits
this command:

| Secret | Value |
| --- | --- |
| `SERVER_HOST` | Server's direct public hostname/IP, not a web proxy URL |
| `SERVER_USER` | `riley-drake` |
| `SERVER_PORT` | Same SSH port as the portfolio; defaults to `22` |
| `SERVER_SSH_KEY_B64` | Deployment private key, Base64 encoded |
| `SERVER_KNOWN_HOSTS` | Verified SSH server host-key line matching hostname/port |

Existing secret values cannot be revealed from GitHub's settings. Reuse the
original values from your secure records, or grant an existing organization
secret access to this repository. Do not paste keys into chat or commit them.
The database password stays exclusively in the server's `deploy/app.env`.

To obtain the public host-key line directly on the server, replace the hostname
with the exact `SERVER_HOST` value (use `[hostname]:port` for a non-default port):

```sh
awk -v host='YOUR_SERVER_HOST' '{print host " " $1 " " $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

The workflow checks the saved host key strictly. SSH access must work from
GitHub's hosted runners as it does for the portfolio. The deployment account
needs Git, Docker Compose, Python 3, `flock`, and permission to use Docker.
Node and npm run inside Docker and need not be installed on the server.

## Update flow

Edit locally, commit, and push to `main`. Check **Actions → Deploy Wishlist**.
The server refuses tracked local edits instead of overwriting them. It fetches
the tested commit, builds while the old container runs, and replaces only the
app service. A short interruption may occur while the container is replaced.
MongoDB and `wishlist_app_uploads` are not recreated or deleted.

If the build fails, the existing app continues running. If replacement fails
its database-aware health check, the script attempts to restore the previous
image and Compose configuration, then reports failure. Keep previous images:
aggressive Docker image pruning removes rollback options. Rollback does not
reverse database writes or future schema migrations.

Protected runtime snapshots are stored in `~/Projects/wishlist/.wishlist-deploy`
with owner-only permissions. They contain secrets; never commit or share them.

For a manual deployment on the server:

```sh
cd ~/Projects/wishlist/app
bash deploy.sh
```

The existing NPM host, HTTPS certificate, and DNS need no changes for updates.
