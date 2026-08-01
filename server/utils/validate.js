function isValidUsername(u) {
  return typeof u === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(u);
}

function isValidPassword(p) {
  return typeof p === 'string' && p.length >= 8 && p.length <= 200;
}

function cleanText(s, maxLen = 5000) {
  if (typeof s !== 'string') return '';
  return s.slice(0, maxLen);
}

module.exports = { isValidUsername, isValidPassword, cleanText };
