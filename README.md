# Wishlist App

A minimal React app built with Vite and Tailwind CSS.

## Development

Requires Node.js 22.12+ (or 20.19+) and npm.

```sh
npm install
npm run dev
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

Edit `src/App.jsx` to start building. Global styles live in `src/index.css`.
Tailwind utilities are available through the Tailwind Vite plugin.

## Production

```sh
npm run build
npm run preview
```

The production build is generated in `dist/`.

## Holiday customization

Edit `src/config/holiday.js` to change the holiday name, annual date, copy,
page metadata, palette, decorative labels, snowfall, and wishlist storage key.
Months use 1–12. The countdown targets midnight in the visitor's local time,
shows a celebration on the holiday itself, and advances to the next year afterward.

The seasonal CSS illustration lives in `HolidayIllustration` in `src/App.jsx`;
replace that component for a different holiday's artwork. Its colors come from
the holiday configuration. Wishes are saved only in the current browser;
use a different storage key to keep each holiday's list separate.

