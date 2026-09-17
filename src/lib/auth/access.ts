export const accessRoles = ["owner", "admin", "operador", "visualizador"] as const;
export type AccessRole = (typeof accessRoles)[number];

export const permissions = [
  "workspace:manage",
  "members:manage",
  "integrations:manage",
  "offers:read",
  "offers:write",
  "dispatches:publish",
  "audit:read",
] as const;
export type Permission = (typeof permissions)[number];

const grants: Record<AccessRole, readonly Permission[]> = {
  owner: permissions,
  admin: ["members:manage", "integrations:manage", "offers:read", "offers:write", "dispatches:publish", "audit:read"],
  operador: ["offers:read", "offers:write", "dispatches:publish"],
  visualizador: ["offers:read"],
};

export function isAccessRole(value: unknown): value is AccessRole {
  return typeof value === "string" && accessRoles.some(role => role === value);
}

export function hasPermission(role: unknown, permission: Permission): boolean {
  return isAccessRole(role) && grants[role].includes(permission);
}
