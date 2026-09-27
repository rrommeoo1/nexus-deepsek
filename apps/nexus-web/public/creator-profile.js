import { renderOwnerProfileExperience } from './profile-experience.js?v=20260923-wave14i';

export function restrictedProfileCopy(locale) {
  const lang = String(locale || '').split('-')[0];
  return ({
    ro: ['Profil închis', 'Conținutul este vizibil doar persoanelor autorizate.', 'Cere să urmărești', 'Vezi opțiunile de acces'],
    pl: ['Profil zamknięty', 'Treść jest widoczna tylko dla uprawnionych osób.', 'Poproś o obserwowanie', 'Opcje dostępu'],
    ar: ['ملف مقيد', 'المحتوى متاح للأشخاص المصرح لهم فقط.', 'طلب المتابعة', 'خيارات الوصول'],
  })[lang] || ['Restricted profile', 'Content is visible only to authorized people.', 'Request to follow', 'Access options'];
}

// Visitors read the SAME identity, crop, tabs, archive and story renderer as the
// owner. Only owner-only controls and server-denied content are excluded.
export function renderCreatorProfile(host, result, options) {
  const { esc, t, locale, onFollow, onMessage, onPrivateAccess, ...shared } = options;
  const p = result.profile, locked = result.locked === true;
  const copy = restrictedProfileCopy(locale);
  const safeResult = locked ? {
    profile: { user_id: p.user_id, handle: p.handle, name: p.name, persona: p.persona,
      visibility: p.visibility, is_self: false }, posts: [], stories: [],
  } : { ...result, profile: { ...p, is_self: false } };
  renderOwnerProfileExperience(host, safeResult, { ...shared, esc, t, locale,
    albums: locked ? [] : p.highlights || [],
    onRendered: locked ? undefined : shared.onRendered,
  });
  if (locked) {
    host.querySelectorAll('.ownerFacts,.ownerBioBlock,.ownerStoryRail,.ownerTabsRegion,.ownerFlowStream,.ownerPostGrid,.ownerWhisperList,.ownerMomentsPanel,.ownerEmptyStates').forEach((el) => el.remove());
  }
  const actions = '<div class="ownerActions creatorProfileActions">'
    + '<button type="button" data-follow="' + Number(p.user_id) + '" data-active="' + (p.is_following ? '1' : '0') + '" data-pending="' + (p.follow_request_pending ? '1' : '0') + '">'
    + esc(p.is_following ? t('publicProfile.following') : p.follow_request_pending ? t('publicProfile.requested') : p.visibility === 'private' ? copy[2] : t('publicProfile.follow')) + '</button>'
    + (!locked ? '<button type="button" data-creator-message>' + esc(t('publicProfile.message')) + '</button>' : '')
    + '</div>'
    + (locked ? '<div class="creatorProfileRestricted"><b>' + esc(copy[0]) + '</b><p>' + esc(copy[1]) + '</p>'
      + (p.private_access?.enabled === true ? '<button type="button" data-creator-access>' + esc(copy[3]) + '</button><div id="private-access-sheet"></div>' : '') + '</div>' : '');
  host.querySelector('.ownerHero').insertAdjacentHTML('afterend', actions);
  host.querySelector('[data-follow]')?.addEventListener('click', (event) => onFollow(event.currentTarget));
  host.querySelector('[data-creator-message]')?.addEventListener('click', onMessage);
  host.querySelector('[data-creator-access]')?.addEventListener('click', onPrivateAccess);
}
