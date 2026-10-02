const DEFAULTS = Object.freeze({ title: '', location: '', locationPrecision: 'area', link: '', taggedUserIds: [], allowComments: true, allowRepost: true, allowDownload: true, watermark: true, saveToDevice: false });
export function normalizePublishing(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !Object.hasOwn(DEFAULTS,key))) throw new Error('PUBLISHING_INVALID');
  const result = { ...DEFAULTS, ...value };
  for (const [key, max] of [['title', 100], ['location', 120], ['link', 2048]]) {
    if (typeof result[key] !== 'string' || result[key].length > max) throw new Error('PUBLISHING_INVALID');
    result[key] = result[key].normalize('NFKC').trim();
  }
  if (!['exact', 'area', 'city'].includes(result.locationPrecision)) throw new Error('PUBLISHING_INVALID');
  for (const key of ['allowComments', 'allowRepost', 'allowDownload', 'watermark', 'saveToDevice']) if (typeof result[key] !== 'boolean') throw new Error('PUBLISHING_INVALID');
  if (!Array.isArray(result.taggedUserIds) || result.taggedUserIds.length > 20 || result.taggedUserIds.some(id => !Number.isSafeInteger(id) || id < 1)) throw new Error('PUBLISHING_TAGS_INVALID');
  result.taggedUserIds = [...new Set(result.taggedUserIds)];
  if (result.link) {
    let url; try { url = new URL(result.link); } catch { throw new Error('PUBLISHING_LINK_INVALID'); }
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(url.hostname)) throw new Error('PUBLISHING_LINK_INVALID');
    result.link = url.href;
  }
  return result;
}
export function publishingFromRow(row) {
  try { return normalizePublishing(JSON.parse(row?.publishing_json || '{}')); }
  catch { return { ...DEFAULTS, allowComments: false, allowRepost: false, allowDownload: false }; }
}
