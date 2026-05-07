import { getApiBaseUrl } from './appConfig';

export function getProfileImageUrl(profileImageKey) {
  if (!profileImageKey) {
    return '';
  }
  return `${getApiBaseUrl()}/static/profile-images/${encodeURIComponent(profileImageKey)}`;
}
