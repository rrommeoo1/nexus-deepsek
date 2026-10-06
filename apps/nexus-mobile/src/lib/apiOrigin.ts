// The backend origin is configured explicitly (EXPO_PUBLIC_NEXUS_API_URL) and defaults to the
// owner's Railway deployment. The installed app never depends on localhost or adb reverse.
export const API_ORIGIN = (process.env.EXPO_PUBLIC_NEXUS_API_URL || 'https://nexus-deepsek-production.up.railway.app').replace(/\/+$/, '');
