import { router } from 'expo-router';

/** Open the real Social profile only when the server supplied a handle. */
export function openSocialProfile(handle?: string | null, dismiss?: () => void): void {
  const normalized = handle?.trim().replace(/^@/, '');
  if (!normalized) return;
  dismiss?.();
  router.push({ pathname: '/profile/[handle]', params: { handle: normalized } });
}
