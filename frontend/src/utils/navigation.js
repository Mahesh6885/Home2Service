/**
 * Navigation and role routing utilities for Home 2 Service
 */

export const ROLE_DASHBOARDS = {
  ADMIN: '/admin/workers',
  WORKER: '/worker/dashboard',
  CUSTOMER: '/customer/dashboard',
};

/**
 * Returns the authoritative dashboard route for a given user role.
 * Fallbacks to customer dashboard for unknown/default roles.
 */
export function getRoleDashboard(role) {
  if (role === 'ADMIN') return ROLE_DASHBOARDS.ADMIN;
  if (role === 'WORKER') return ROLE_DASHBOARDS.WORKER;
  if (role === 'CUSTOMER') return ROLE_DASHBOARDS.CUSTOMER;
  return '/';
}

/**
 * Validates and safely resolves an internal redirect path for a given role.
 * Ensures the destination is a safe relative path authorized for the role.
 */
export function getSafeRedirectPath(fromPath, role) {
  if (!fromPath || typeof fromPath !== 'string') {
    return getRoleDashboard(role);
  }

  // Prevent open redirect attacks (must start with / and not //)
  if (!fromPath.startsWith('/') || fromPath.startsWith('//')) {
    return getRoleDashboard(role);
  }

  // Role-specific path authorizations
  if (role === 'ADMIN') {
    if (fromPath.startsWith('/admin')) return fromPath;
    return ROLE_DASHBOARDS.ADMIN;
  }

  if (role === 'WORKER') {
    if (fromPath.startsWith('/worker')) return fromPath;
    return ROLE_DASHBOARDS.WORKER;
  }

  // Customer or general public services
  if (role === 'CUSTOMER') {
    if (fromPath.startsWith('/customer') || fromPath.startsWith('/services')) {
      return fromPath;
    }
    return ROLE_DASHBOARDS.CUSTOMER;
  }

  return getRoleDashboard(role);
}
