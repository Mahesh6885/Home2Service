/**
 * Centralized HTTP Client for Home 2 Service API
 * Handles base URL configuration, Bearer token injection,
 * automatic token refresh on 401, and normalized error extraction.
 */

/**
 * Normalizes and builds the target API URL.
 * Handles trailing slashes, prevents duplicate '/api' segments,
 * and preserves relative routes for dev proxying.
 */
export function buildApiUrl(endpoint) {
  if (!endpoint || typeof endpoint !== 'string') return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
  const cleanBase = rawBase.replace(/\/+$/, '');
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (cleanBase.endsWith('/api') && cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.slice(4);
  }

  return cleanBase ? `${cleanBase}${cleanEndpoint}` : cleanEndpoint;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export function getStoredTokens() {
  const access = localStorage.getItem('mw_access_token');
  const refresh = localStorage.getItem('mw_refresh_token');
  return { access, refresh };
}

export function setStoredTokens(access, refresh) {
  if (access) localStorage.setItem('mw_access_token', access);
  if (refresh) localStorage.setItem('mw_refresh_token', refresh);
}

export function clearStoredTokens() {
  localStorage.removeItem('mw_access_token');
  localStorage.removeItem('mw_refresh_token');
  localStorage.removeItem('mw_user_data');
}

/**
 * Normalizes DRF error responses (string, {error: "..."}, {detail: "..."}, or field validation map)
 */
export function extractErrorMessage(errorData, fallback = 'An unexpected error occurred.') {
  if (!errorData) return fallback;
  if (typeof errorData === 'string') return errorData;
  if (errorData.error) return errorData.error;
  if (errorData.detail) return errorData.detail;
  if (errorData.message) return errorData.message;

  // If object of field errors (e.g. { username: ["This field is required."] })
  if (typeof errorData === 'object') {
    const messages = [];
    for (const [key, val] of Object.entries(errorData)) {
      if (Array.isArray(val)) {
        messages.push(`${key}: ${val.join(' ')}`);
      } else if (typeof val === 'string') {
        messages.push(`${key}: ${val}`);
      } else if (typeof val === 'object' && val !== null) {
        messages.push(extractErrorMessage(val));
      }
    }
    if (messages.length > 0) return messages.join(' | ');
  }

  return fallback;
}

export async function apiRequest(endpoint, options = {}) {
  const url = buildApiUrl(endpoint);
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const { access, refresh } = getStoredTokens();
  if (access && !headers.Authorization) {
    headers.Authorization = `Bearer ${access}`;
  }

  const config = {
    ...options,
    headers
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    let response = await fetch(url, config);

    // Handle token expiration & silent refresh
    if (response.status === 401 && refresh && !options._retry && !endpoint.includes('/api/auth/login/') && !endpoint.includes('/api/auth/refresh/')) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(buildApiUrl('/api/auth/refresh/'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh })
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            setStoredTokens(data.access, data.refresh || refresh);
            isRefreshing = false;
            onRefreshed(data.access);
          } else {
            isRefreshing = false;
            clearStoredTokens();
            window.dispatchEvent(new CustomEvent('mw:auth_expired'));
            throw new Error('Session expired. Please log in again.');
          }
        } catch (err) {
          isRefreshing = false;
          clearStoredTokens();
          window.dispatchEvent(new CustomEvent('mw:auth_expired'));
          throw err;
        }
      }

      // Retry request with new token
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((newToken) => {
          config.headers.Authorization = `Bearer ${newToken}`;
          config._retry = true;
          apiRequest(endpoint, config).then(resolve).catch(reject);
        });
      });
    }

    // Parse response
    let responseData = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      responseData = text ? { message: text } : {};
    }

    if (!response.ok) {
      const errorMsg = extractErrorMessage(responseData, `Request failed with status ${response.status}`);
      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = responseData;
      throw err;
    }

    return responseData;
  } catch (err) {
    throw err;
  }
}

export const api = {
  get: (endpoint, options = {}) => apiRequest(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options = {}) => apiRequest(endpoint, { method: 'POST', body, ...options }),
  patch: (endpoint, body, options = {}) => apiRequest(endpoint, { method: 'PATCH', body, ...options }),
  put: (endpoint, body, options = {}) => apiRequest(endpoint, { method: 'PUT', body, ...options }),
  delete: (endpoint, options = {}) => apiRequest(endpoint, { method: 'DELETE', ...options })
};
