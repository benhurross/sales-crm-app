import { describe, expect, it } from "vitest";
import { z } from "zod";

const prospectSchema = z.object({
  clientName: z.string().min(1, "Required"),
  producerId: z.string().min(1, "Select a producer"),
  premiums: z.string().optional(),
  month: z.string().optional(),
  currentInsurerId: z.string().optional(),
  lob: z.string().optional(),
});

describe("prospect form schema", () => {
  it("accepts valid data", () => {
    const result = prospectSchema.safeParse({
      clientName: "Test Corp",
      producerId: "1",
      premiums: "50000",
      month: "January",
      lob: "General",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty client name", () => {
    const result = prospectSchema.safeParse({
      clientName: "",
      producerId: "1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing producer", () => {
    const result = prospectSchema.safeParse({
      clientName: "Test Corp",
      producerId: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts minimal data (only required fields)", () => {
    const result = prospectSchema.safeParse({
      clientName: "Minimal Corp",
      producerId: "2",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all optional fields as undefined", () => {
    const result = prospectSchema.safeParse({
      clientName: "Full Corp",
      producerId: "3",
      premiums: undefined,
      month: undefined,
      currentInsurerId: undefined,
      lob: undefined,
    });
    expect(result.success).toBe(true);
  });
});
