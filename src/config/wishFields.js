// Always-visible fields; other details can still use any label and value.
export const primaryDetails = [
  { label: 'Size', placeholder: 'e.g. 00, Small, Medium, 28' },
  { label: 'Color', placeholder: 'e.g. Forest green' },
  { label: 'Material', placeholder: 'e.g. Cotton' },
  { label: 'Brand', placeholder: 'e.g. Her favorite brand' },
]
export const wishCurrency = 'CAD'
export const priorities = [
  { value: 'idea', label: 'Just an idea' },
  { value: 'love', label: 'Would love' },
  { value: 'top', label: 'Top wish' },
]
export const emptyItem = { name: '', url: '', image: '', store: '', price: '', currency: wishCurrency, notes: '', priority: 'idea', quantity: '', alternatives: '', details: [] }
