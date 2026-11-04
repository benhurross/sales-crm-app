import { describe, expect, it } from "vitest";
import { LEAD_STATUSES, RFQ_TYPES, COB_TYPES, USER_ROLES, EMPLOYMENT_STATUSES } from "@/lib/constants";

describe("LEAD_STATUSES", () => {
  it("has Secured, Pending, Lost", () => {
    expect(LEAD_STATUSES).toEqual(["Secured", "Pending", "Lost"]);
  });
});

describe("RFQ_TYPES", () => {
  it("has New and Renewal", () => {
    expect(RFQ_TYPES).toEqual(["New", "Renewal"]);
  });
});

describe("COB_TYPES", () => {
  it("has General, Medical, Motor", () => {
    expect(COB_TYPES).toEqual(["General", "Medical", "Motor"]);
  });
});

describe("USER_ROLES", () => {
  it("has admin, manager, salesman", () => {
    expect(USER_ROLES).toEqual(["admin", "manager", "salesman"]);
  });
});

describe("EMPLOYMENT_STATUSES", () => {
  it("has Active, Resigned, Transferred", () => {
    expect(EMPLOYMENT_STATUSES).toEqual(["Active", "Resigned", "Transferred"]);
  });
});
