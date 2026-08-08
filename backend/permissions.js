/** Granular admin permissions */
const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  MANAGE_USERS: 'manage_users',
  MANAGE_CONTENT: 'manage_content',
  MANAGE_PRODUCTS: 'manage_products',
  MANAGE_ORDERS: 'manage_orders',
  MANAGE_ANALYTICS: 'manage_analytics',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_ADMINS: 'manage_admins',
  MANAGE_DESIGN: 'manage_design',
  MANAGE_DATABASE: 'manage_database',
  VIEW_LOGS: 'view_logs'
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

const ROLE_DEFAULTS = {
  super_admin: ALL_PERMISSIONS,
  admin: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.MANAGE_CONTENT,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.MANAGE_ANALYTICS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.MANAGE_DESIGN,
    PERMISSIONS.VIEW_LOGS
  ],
  editor: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.MANAGE_CONTENT,
    PERMISSIONS.MANAGE_DESIGN
  ]
};

function parsePermissions(json) {
  try {
    const arr = JSON.parse(json || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function hasPermission(admin, permission) {
  if (!admin) return false;
  if (admin.role === 'super_admin') return true;
  const perms = parsePermissions(admin.permissions);
  return perms.includes(permission);
}

module.exports = { PERMISSIONS, ALL_PERMISSIONS, ROLE_DEFAULTS, parsePermissions, hasPermission };
