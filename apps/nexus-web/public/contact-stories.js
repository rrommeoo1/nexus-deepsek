// Uses authorized Social results, never a cached/demo Story from another persona.
export function contactStories(result, { viewerId, peerId, safeUrl, now = Date.now() / 1000 }) {
  if (result?.ok !== true || Number(result.viewer_id) !== Number(viewerId)
    || result.viewer_persona !== 'social' || result.state !== 'all'
    || !Array.isArray(result.stories) || result.stories.length > 100) return null;
  const items = result.stories.filter((s) => Number(s?.user_id) === Number(peerId));
  if (!items.every((s) => Number.isSafeInteger(s.id) && s.id > 0 && s.persona === 'social'
    && s.status === 'active' && ['public', 'followers', 'friends', 'private'].includes(s.visibility)
    && typeof s.caption === 'string' && s.caption.length <= 500
    && Number.isSafeInteger(s.created_at) && s.created_at > 0
    && Number(s.author?.id) === Number(peerId) && /^[a-z0-9_]{2,30}$/.test(s.author?.handle || '')
    && (!s.author.avatar || safeUrl(s.author.avatar))
    && /^[a-f0-9]{64}$/.test(s.content_commitment || '')
    && (s.expires_at === null || (Number.isSafeInteger(s.expires_at) && s.expires_at > now))
    && s.lifecycle === (s.expires_at === null ? 'persistent_until_archived' : 'expires')
    && Number(s.view_progress) >= 0 && Number(s.view_progress) <= 1
    && (!s.media || (['image', 'video'].includes(s.media.kind) && /^[a-f0-9]{64}$/.test(s.media.hash || '')
      && /^[a-z0-9]{2,8}$/.test(s.media.ext || '') && safeUrl('/media/' + s.media.hash + '.' + s.media.ext))))) return null;
  return items;
}

export async function loadContactStories({ api, viewerId, peerId, safeUrl }) {
  const result = await api('/api/stories?state=all').catch(() => null);
  return contactStories(result, { viewerId, peerId, safeUrl });
}
