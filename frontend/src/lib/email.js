// Email 格式檢查(與後端相同):@ 前後都要有字、網域要有「.」,例如 name@gmail.com
const EMAIL_RE = /^[^\s@]+@(?:[^\s@.]+\.)+[^\s@.]{2,}$/;
export const isValidEmail = (v) => typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim());
