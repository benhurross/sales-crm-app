export const LEAD_STATUSES = ["Secured", "Pending", "Lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const RFQ_TYPES = ["New", "Renewal"] as const;
export type RfqType = (typeof RFQ_TYPES)[number];

export const COB_TYPES = ["General", "Medical", "Motor"] as const;
export type CobType = (typeof COB_TYPES)[number];

export const USER_ROLES = ["admin", "manager", "salesman"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const EMPLOYMENT_STATUSES = ["Active", "Resigned", "Transferred"] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];
