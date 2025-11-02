export const Roles = {
  EMPLOYEE: "EMPLOYEE",
  ADMIN: "ADMIN",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];
