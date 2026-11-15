# Deploy to Riley's Linux server

Target: `https://wishlist.rileydrake.ca`, through Nginx Proxy Manager (NPM).
This app-only stack preserves the existing MongoDB stack and its data volume.
Do not replace `~/Projects/wishlist/compose.yml` or its `.env`.

## 1. Inspect the existing server

In `~/Projects/wishlist`:

```sh
docker compose ps
docker ps --format 'table {{.Names}}\t{{.Image}}'
docker network ls
```

Identify NPM's container, then inspect it (replace the placeholder):

```sh
docker inspect NPM_CONTAINER_NAME --format '{{range $name, $network := .NetworkSettings.Networks}}{{println $name}}{{end}}'
```

Choose a user-defined bridge network attached to NPM, not the built-in
`bridge`, `host`, or `none` network. MongoDB should be on `wishlist_default`.

## 2. Copy and unpack the prepared source

Copy `artifacts/wishlist-v1.tar.gz` from the Windows workspace to
`~/Projects/wishlist/` using SCP or your normal file transfer method.
Use `~/Projects/wishlist/app` for the app source:

```sh
cd ~/Projects/wishlist
mkdir -p app
tar -xzf wishlist-v1.tar.gz -C app
cd app
```

The archive excludes preview accounts, photos, passwords, Git history,
dependencies, and build output. The server builds the Linux image from source.

## 3. Configure the app's restricted MongoDB connection

```sh
python3 deploy/configure.py
```

Enter the actual NPM network name, then the existing `wishlist_app` database
password. It is hidden as you type and URL encoded automatically. This creates
`deploy/app.env` with mode 600 without overwriting an existing file. The app
does not receive MongoDB administrator credentials. Do not paste the env file
or resolved Compose configuration into chat.

## 4. Build and start

```sh
docker compose --env-file deploy/app.env -p wishlist-app -f deploy/compose.app.yml config --quiet
docker compose --env-file deploy/app.env -p wishlist-app -f deploy/compose.app.yml up -d --build
docker compose --env-file deploy/app.env -p wishlist-app -f deploy/compose.app.yml ps
curl -fsS http://127.0.0.1:3000/api/health
```

The health check must return `{"status":"ok"}`. This performs a database read;
the process merely listening is not considered a successful database connection.
MongoDB remains on its existing private Docker network. The app's diagnostic
host port binds only to `127.0.0.1`; NPM reaches `wishlist-app:3000` over Docker.
If host port 3000 is occupied, change `WISHLIST_PORT` in `deploy/app.env` and
use that host port for curl. NPM still forwards to container port 3000.

## 5. Publish through NPM

Set the subdomain's DNS record to use the same public routing as your existing
NPM websites. Create a Proxy Host:

- Domain: `wishlist.rileydrake.ca`
- Scheme: `http`
- Forward hostname: `wishlist-app`
- Forward port: `3000`
- Access: Publicly Accessible (the app itself requires login to edit)
- Advanced: `client_max_body_size 50m;`
- SSL: Request a certificate for the subdomain, then enable Force SSL.

Keep the default Host header forwarding. No WebSocket configuration is needed.
HTTP connects NPM to the app over Docker; users must use the HTTPS URL because
production login cookies are Secure. Only NPM should expose public web ports;
do not publish MongoDB's port.

## 6. Verify live behavior and prepare backups

Use the HTTPS address to create an account, add a wish and photo, and sign out
and back in. Open the shared link from a second device; it should update within
10 seconds after an edit while visible. Test a second account to verify list
separation. Restart the app container and confirm both wish and photo persist.
Passwords and accounts from the local Windows preview are separate from live
accounts and are not automatically transferred.

Uploaded photos use the persistent `wishlist_app_uploads` volume; MongoDB uses
the existing `wishlist_mongodb_data` volume. Back up **both** MongoDB and photos,
and keep a copy off this server. Establish a backup schedule and verify a
restore before relying on the server as the only copy. Never use
`docker compose down -v` during updates.

Keep `deploy/app.env` separately and securely: it is required for recovery.
Future app updates use the same app Compose command to rebuild, preserving
both named volumes. Password recovery is not implemented in v1.
