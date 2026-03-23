const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') || '';

export const buildApiUrl = (path) => {
  if (!path.startsWith('/')) {
    throw new Error(`API path must start with "/": ${path}`);
  }
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
};

export async function apiFetch(path, init = {}, getToken) {
  const headers = new Headers(init.headers || {});

  if (typeof getToken === 'function') {
    const token = await getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(buildApiUrl(path), {
    ...init,
    headers,
  });
}
