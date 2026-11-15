# Wishlist App

A minimal React app built with Vite and Tailwind CSS.

## Development

Requires Node.js 22.12+ and npm.

```sh
npm install
npm run dev
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

Edit `src/App.jsx` to start building. Global styles live in `src/index.css`.
Tailwind utilities are available through the Tailwind Vite plugin.

Without `MONGODB_URI`, the development server uses `.data/preview.json` for
preview accounts, sessions, and wishlists. This is a development-only store
for testing with multiple devices before MongoDB is connected. Run one dev
server per checkout and use the same port on every device. For a LAN preview:

```sh
npm run dev -- --host 0.0.0.0 --port 5174 --strictPort
```

Preview accounts are separate from live MongoDB accounts and are not migrated
automatically. `.data/` is ignored by Git. Production and `npm run preview`
always use MongoDB; there is no production fallback to the preview file.

## Production

For the Linux server and Nginx Proxy Manager deployment, follow
[deploy/README.md](deploy/README.md). It uses the existing authenticated MongoDB
container and a separate persistent photo volume.

For automatic deployment after pushing to `main`, follow
[deploy/automation.md](deploy/automation.md). This uses the same GitHub Actions
and SSH pattern as the portfolio, with checks before deploying and a health
check with an attempted rollback after replacement.

```sh
npm run build
npm start
```

The production build is generated in `dist/`.

## Holiday customization

Edit `src/config/holiday.js` to change the holiday name, annual date, hero copy,
page metadata, palette, and legacy wishlist storage key.
Months use 1–12. The countdown targets midnight in the visitor's local time,
shows a celebration on the holiday itself, and advances to the next year afterward.

The seasonal SVG illustration lives in `HolidayIllustration` in `src/App.jsx`;
replace that component for a different holiday's artwork. Its colors come from
the holiday configuration.

The interface uses SVG icons from `src/components/Icon.jsx` so symbols keep
the same appearance across phones and computers. Text, form controls, and
touch targets use a larger, high-contrast Christmas design; the mobile preview
uses the same components as desktop.

## Wishes and flexible details

Only the item name is required. Wishes support store, product link, cost in
CAD, quantity, priority, notes, alternatives, one photo, and up to 30
custom detail label/value pairs. Detail values are always text, preserving
sizes such as `00`, `Medium`, and `28 × 30`. Size, color, material, and brand
are always-visible optional fields. Field definitions and priority labels
live in `src/config/wishFields.js`; arbitrary detail labels need no code change.

Existing browser drafts, including photos, remain in IndexedDB until claimed.
During account creation, the user can opt in to importing the existing draft
into their new account. Successfully imported drafts are cleared from browser
storage; account wishes are saved on the server.

## Accounts and sharing

Each username has exactly one wishlist. Users sign in with a username and
password, then add, edit, or remove their own wishes. Usernames are case
insensitive. There is no user directory or list browser. Knowing another
username does not grant access to their list. Creating additional lists is
disabled; signing in on another device opens the same list.

Passwords are salted and hashed with scrypt. Sessions use random tokens in
HttpOnly, SameSite=Lax cookies; only token hashes are stored on the server.
Sessions expire after 30 days, with a MongoDB TTL index for cleanup. Signing
out revokes the current session. Login and registration attempts are limited
per connection IP. Password recovery is not implemented yet.

The owner can copy a separate viewing link for gift-givers. Anyone with that
link can view the list and mark purchases, but cannot change the wishes.
Purchase markers are omitted from the owner's responses. Shared links stay
the same after edits. Open shared pages check for changes every 10 seconds
and when the visitor returns to the tab; checks pause during mutations.
Recipients do not need an account. A forwarded viewing link also grants
access, so share it only with intended gift-givers.

## Database and photos (when ready to connect)

Set the server-only `MONGODB_URI` and `MONGODB_DB` using `.env.example` as a
guide. Keep credentials out of frontend variables and Git. MongoDB stores
`users`, `sessions`, and `wishlists` collections. The existing `readWrite`
database role supports this setup, including the sessions TTL index.

Legacy private editing links still work for pre-account lists; new accounts
use login sessions and never expose private editing tokens. Anonymous list
creation is disabled outside explicit legacy test fixtures.

Photo uploads accept JPG, PNG, and WebP up to 20 MB. The browser resizes to
1200 pixels on the longest edge and compresses to at most 512 KB. HEIC files
must first be converted to JPG. Image links are also supported. The photo
section offers separate camera and photo-library buttons. Camera capture
requests the rear camera on supported mobile browsers; desktop browsers and
some mobile browsers may show a file picker instead. Test on the target phone.

Uploaded photo bytes are stored in `.data/uploads` on the server, with only
their `/uploads/...` paths stored in MongoDB. Set `UPLOADS_DIR` to override the
directory. The API serves the files in development and production. For Docker
deployment, mount this directory on persistent storage and back up both it
and MongoDB. Uploaded files are retained when wishes are removed so shared
references are not accidentally broken; automatic orphan cleanup is not yet
implemented. Initial list uploads are limited to 48 MB per request.

`npm start` serves both the built frontend and API; build first with
`npm run build`. Set `HOST=0.0.0.0` inside an app container. Static-only hosting
does not run the database API or photo service. Database connection and server
deployment can be completed separately from local v1 testing.

For live deployment, set `NODE_ENV=production`, serve the app through HTTPS,
and preserve the incoming Host header in the reverse proxy. Production
session cookies require HTTPS. Back up MongoDB and the uploads directory;
the development preview data file is not the production database.

