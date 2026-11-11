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
/** @param {unknown} state */
export function validState(state) {
  if (!state || typeof state !== 'object') return false;
  const value = /** @type {Record<string,unknown>} */ (state);
  return ['goals', 'phases', 'tasks', 'notes', 'references'].every(k => Array.isArray(value[k]));
}
