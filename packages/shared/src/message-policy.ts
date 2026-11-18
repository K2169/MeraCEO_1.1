// Contact exchange is disabled in chat. This shared detector gives the composer immediate
// feedback; the API calls the same function again before persisting anything.
const NUMBER_WORDS = [
  'zero', 'oh', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
  'hundred', 'thousand', 'million', 'billion', 'trillion', 'lakh', 'lakhs', 'lac', 'crore', 'crores',
];

const NUMBER_WORD = new RegExp(`\\b(?:${NUMBER_WORDS.join('|')})\\b`, 'iu');
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/iu;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b(?:[\p{L}\p{N}-]+\.)+(?:com|net|org|in|io|co|edu|gov|app|dev|ai)\b/iu;
const SOCIAL_HANDLE = /(?:^|\s)@[\p{L}\p{N}_][\p{L}\p{N}_.-]{1,}/u;
const SPELLED_EMAIL = /\b[\p{L}._+-]+\s+at\s+[\p{L}-]+\s+dot\s+[\p{L}]{2,}\b/iu;

// True when a message contains a direct contact channel or a number written with words.
export function hasContactInformation(text: string): boolean {
  return /\p{N}/u.test(text)
    || NUMBER_WORD.test(text)
    || EMAIL.test(text)
    || URL.test(text)
    || SOCIAL_HANDLE.test(text)
    || SPELLED_EMAIL.test(text);
}
