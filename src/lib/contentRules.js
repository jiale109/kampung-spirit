// Must match blocked_phrases() and contact_phrases() in supabase/schema.sql
//
// A simple word filter for help requests (Owner: Victoria Soh). Not AI moderation:
// it only catches clearly unsafe phrases: scams that ask for codes or money, asking
// a helper to keep secrets or come alone, and contact details (talk in the app instead).
// The database runs the same check, so changing a list here means changing it in
// schema.sql and a new migration too.
//
// Phrases are matched as whole words after making the text small letters with
// single spaces, so "pay me" does not match "pay medical bills". Keep phrases to
// small letters, single spaces and apostrophes (the database puts them straight
// into a pattern, so no other symbols).

// Requests with any of these cannot be posted
export const BLOCKED_PHRASES = [
  // Asking for codes and passwords
  'send me your otp',
  'tell me your otp',
  'give me your otp',
  'share your otp',
  'your singpass password',
  'your bank password',
  'your pin number',
  'bank account number',
  'credit card number',
  // Asking for money
  'transfer money',
  'send money',
  'paynow me',
  'pay me',
  'pay upfront',
  // Asking a helper to keep secrets or be alone
  'come alone',
  "don't tell your parents",
  'dont tell your parents',
  "don't tell anyone",
  'our secret',
  'keep this between us',
  'keep it secret',
  'send me a photo',
  'send me pics',
  'send pics',
  // Clearly offensive words
  'fuck',
  'fucking',
  'bitch',
  'asshole',
  'cheebye',
]

// Contact details: requests are public, so people talk through the app instead
export const CONTACT_PHRASES = ['whatsapp me', 'telegram me', 'add me on', 'dm me']

// Same patterns as help_requests_check_text() in schema.sql.
// A Singapore phone number: 8 digits starting with 6, 8 or 9, maybe "+65" in front and
// a space or dash in the middle ("9123 4567", "+65 91234567"). Not part of a longer number.
const PHONE = /(^|[^0-9])(\+65 ?)?[689][0-9]{3}[ -]?[0-9]{4}([^0-9]|$)/
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/

// Allowed, but the form shows a gentle reminder about sharing details
export const WARNING_WORDS = ['password', 'otp', 'pin', 'bank', 'money', 'paynow', 'nric', 'gift card']

// Whole words only: "pin" matches "my pin" but not "spinach"
const wholeWord = (phrase) => new RegExp(`\\b${phrase}\\b`)

// { blocked: [phrases found], contact: [contact details found], warnings: [words found] }
export function checkText(text) {
  // Curly apostrophes (from phone keyboards) count as straight ones
  const clean = String(text ?? '').toLowerCase().replace(/’/g, "'").replace(/\s+/g, ' ')
  const contact = CONTACT_PHRASES.filter((phrase) => wholeWord(phrase).test(clean))
  if (PHONE.test(clean)) contact.push('phone number')
  if (EMAIL.test(clean)) contact.push('email address')
  return {
    blocked: BLOCKED_PHRASES.filter((phrase) => wholeWord(phrase).test(clean)),
    contact,
    warnings: WARNING_WORDS.filter((word) => wholeWord(word).test(clean)),
  }
}
