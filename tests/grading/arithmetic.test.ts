import { describe, expect, it } from "vitest";
import { numericEquivalent } from "@/lib/grading/arithmetic";

const UNRECOGNIZED = { equivalent: false, reason: "格式无法识别" } as const;

describe("numericEquivalent", () => {
  it.each([
    ["0.5", "1/2"],
    ["2/4", "1/2"],
    ["1.0", "1"],
    ["2+3", "5"],
    ["3×4", "12"],
    ["3x4", "12"],
    ["3*4", "12"],
    ["6÷3", "2"],
    ["(1/8+7/8)", "1"],
    ["40%", "0.4"],
    ["1/3", "2/6"],
    [".5", "1/2"],
    ["5.", "5"],
    [" 1 / 2 ", "0.5"],
  ])("treats %s and %s as equivalent", (student, expected) => {
    expect(numericEquivalent(student, expected)).toEqual({ equivalent: true });
  });

  it.each([
    ["-1/2", "-0.5"],
    ["+0.5", "1/2"],
    ["-(1/2+1/2)", "-1"],
  ])("supports unary signs for %s and %s", (student, expected) => {
    expect(numericEquivalent(student, expected)).toEqual({ equivalent: true });
  });

  it("returns false without a format reason when valid numbers differ", () => {
    expect(numericEquivalent("0.6", "1/2")).toEqual({ equivalent: false });
  });

  it.each([
    ["0.5000000001", "0.5"],
    ["1/3", "0.3333333333"],
  ])("requires exact rational equivalence for %s and %s", (student, expected) => {
    expect(numericEquivalent(student, expected)).toEqual({ equivalent: false });
  });

  it.each([
    ["9007199254740992", "9007199254740993"],
    ["9007199254740991.1", "9007199254740991"],
    ["9007199254740990.9", "9007199254740991"],
    ["999999999999999.99", "1000000000000000"],
    ["9007199254740991+1", "1"],
  ])("compares large numeric values exactly for %s and %s", (student, expected) => {
    expect(numericEquivalent(student, expected)).toEqual({ equivalent: false });
  });

  it("rejects blank student or expected input", () => {
    expect(numericEquivalent("", "1")).toEqual(UNRECOGNIZED);
    expect(numericEquivalent("1", "   ")).toEqual(UNRECOGNIZED);
  });

  it("rejects inputs longer than 80 characters", () => {
    expect(numericEquivalent("1".repeat(81), "1")).toEqual(UNRECOGNIZED);
    expect(numericEquivalent("1", "1".repeat(81))).toEqual(UNRECOGNIZED);
  });

  it("rejects unsupported characters", () => {
    expect(numericEquivalent("process.exit()", "1")).toEqual(UNRECOGNIZED);
    expect(numericEquivalent("2^3", "8")).toEqual(UNRECOGNIZED);
  });

  it("rejects division by zero", () => {
    expect(numericEquivalent("1/0", "1")).toEqual(UNRECOGNIZED);
    expect(numericEquivalent("1÷(2-2)", "1")).toEqual(UNRECOGNIZED);
  });

  it("rejects malformed expressions", () => {
    expect(numericEquivalent("1+", "1")).toEqual(UNRECOGNIZED);
    expect(numericEquivalent("(1+2", "3")).toEqual(UNRECOGNIZED);
    expect(numericEquivalent(".", "1")).toEqual(UNRECOGNIZED);
    expect(numericEquivalent("1..2", "1")).toEqual(UNRECOGNIZED);
    expect(numericEquivalent("1 2", "12")).toEqual(UNRECOGNIZED);
  });

  it("does not share invalid result objects across calls", () => {
    const result = numericEquivalent("bad", "1");

    (result as { equivalent: boolean }).equivalent = true;

    expect(numericEquivalent("bad", "1")).toEqual(UNRECOGNIZED);
  });
});
