/** @param {string | undefined} host */
export function isLocalHost(host) {
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host || '');
}
/** @param {string | undefined} address */
export function isLoopback(address) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address || '');
}
/** @param {{enabled:boolean,development:boolean,vercel:boolean,host?:string,address?:string}} context */
export function previewAllowed(context) {
  return context.enabled && context.development && !context.vercel && isLocalHost(context.host) && isLoopback(context.address);
}
/** @param {string} pathname */
export function safeRelativePath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').some(p => p === '..' || p.startsWith('.'))) return null;
  return decoded.replace(/^\/+/, '');
}
/** Only known workspace destinations may receive a post-login redirect.
 * @param {unknown} value
 */
export function safeLoginDestination(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return '/work';
  try {
    const url = new URL(value, 'https://local.invalid');
    if (url.origin !== 'https://local.invalid') return '/work';
    const allowed = ['/work', '/work/', '/work/demos', '/work/demos/', '/work/app/index.html', '/work/expenses', '/work/expenses/', '/work/expenses/index.html', '/personal', '/personal/'];
    return allowed.includes(url.pathname) ? url.pathname + url.search + url.hash : '/work';
  } catch { return '/work'; }
}
/** @param {unknown} state */
export function validState(state) {
  if (!state || typeof state !== 'object') return false;
  const value = /** @type {Record<string,unknown>} */ (state);
  return ['goals', 'phases', 'tasks', 'notes', 'references'].every(k => Array.isArray(value[k]));
}
