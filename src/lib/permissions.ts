import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const ROLES = ["admin", "manager", "salesman"] as const;
export type Role = (typeof ROLES)[number];

const ROLE_RANK: Record<Role, number> = { admin: 3, manager: 2, salesman: 1 };

export function hasRole(role: string | null | undefined, required: Role): boolean {
  return ROLE_RANK[role as Role] >= ROLE_RANK[required];
}

export const ac = createAccessControl(defaultStatements);
export const authRoles = {
  admin: ac.newRole(adminAc.statements),
  manager: ac.newRole({ user: [], session: [] }),
  salesman: ac.newRole({ user: [], session: [] }),
};
