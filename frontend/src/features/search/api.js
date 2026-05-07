import { apiRequest } from '../../config/api';

export async function searchGlobal(query, token) {
  const suffix = `?query=${encodeURIComponent(query)}`;
  return apiRequest(`/search/global${suffix}`, 'GET', undefined, token);
}
