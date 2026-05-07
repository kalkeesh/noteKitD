import { apiRequest } from '../../config/api';

export async function fetchLinkPreview(url) {
  return apiRequest(`/link-preview?url=${encodeURIComponent(url)}`, 'GET');
}
