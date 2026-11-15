// Change the holiday here. Months are 1–12; dates use the visitor's local time.
export const holiday = {
  name: 'Christmas',
  brand: 'merry little wishes',
  symbol: '✳',
  date: { month: 12, day: 25 },
  pageTitle: 'Merry Little Wishes — A little Christmas magic',
  description: 'Count down to Christmas and make a little room for your wishes.',
  announcement: 'A little magic is on its way',
  theme: {
    background: '#fff9ed', ink: '#163d31', muted: '#526259', accent: '#b6313d',
    'accent-dark': '#942331', gold: '#ebbd62', paper: '#ffffff', line: '#d4dfd5',
    'scene-background': '#e2eddf', 'tree-color': '#397658', 'ribbon-color': '#ffe2a3',
    'gift-color': '#c29c61',
  },
  hero: {
    eyebrow: 'The most wonderful time is coming', heading: 'Big joy.', accent: 'Little wishes.',
    description: 'Save your favorites. Share a few hints. Make someone’s Christmas a little easier.',
    cta: 'Open my wishlist',
  },
  countdown: {
    label: 'A little closer to Christmas', arrived: 'Christmas is here. Let the magic begin!',
    note: 'Until the stockings are filled & the magic begins.',
  },
  // The CSS scene is separate from the holiday data. Replace HolidayIllustration
  // in App.jsx for a different holiday's artwork.
  art: {
    snow: true,
    description: 'Wrapped cranberry and gold gifts beside an evergreen tree and hanging ornaments',
    giftTag: 'for you ♡', sticker: 'a little\nChristmas\nmagic', caption: 'Wrapped in a little wonder',
  },
  highlights: ['Thoughtful gifts', 'Heartfelt wishes', 'A season of little joys'],
  wishlist: {
    storageKey: 'merry-little-wishes:christmas', eyebrow: 'A little space to dream', heading: 'What’s on your wishlist?',
    description: 'Something cozy, something lovely, something you’ve had your eye on. Every little wish belongs here.',
    inputLabel: 'Start with one little wish', placeholder: 'A book, a cozy sweater, a little adventure…',
    empty: 'Your next favorite thing starts with a wish.', saveNote: 'Just for you. Saved in this browser.',
  },
  footer: 'Made for the joy of giving. And a little receiving.',
}
