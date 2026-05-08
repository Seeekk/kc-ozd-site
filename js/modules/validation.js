var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {string} value
 * @returns {boolean}
 */
export function validateEmail(value) {
  var v = String(value || '').trim();
  if (!v) {
    return false;
  }
  return EMAIL_RE.test(v);
}

/**
 * Optional phone: empty is valid; otherwise +7 and digits or international.
 * @param {string} value
 * @returns {boolean}
 */
export function validatePhoneOptional(value) {
  var v = String(value || '').trim();
  if (!v) {
    return true;
  }
  var digits = v.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * @param {string} value
 * @param {number} maxLen
 * @returns {boolean}
 */
export function validateRequiredText(value, maxLen) {
  var v = String(value || '').trim();
  if (!v) {
    return false;
  }
  if (typeof maxLen === 'number' && v.length > maxLen) {
    return false;
  }
  return true;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function validatePersonName(name) {
  return validateRequiredText(name, 120);
}
