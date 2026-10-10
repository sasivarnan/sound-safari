import { describe, it, expect } from "vitest";
import {
  categoryOf,
  credibleDetections,
  missionFor,
  readJournal,
} from "./domain";
describe("honest detections", () => {
  it("does not invent labels for empty or weak predictions", () => {
    expect(credibleDetections([])).toEqual([]);
    expect(
      credibleDetections([
        { label: "Bird", score: 0.14 },
        { label: "Wind", score: NaN },
      ]),
    ).toEqual([]);
  });
  it("filters invalid scores and ranks real predictions", () => {
    expect(
      credibleDetections([
        { label: "Wind", score: 0.4 },
        { label: "Bird", score: 0.8 },
        { label: "Invalid", score: 2 },
      ]).map((x) => x.label),
    ).toEqual(["Bird", "Wind"]);
  });
  it("maps sound labels to safe listening missions", () => {
    expect(categoryOf("Bird vocalization, bird call, bird song")).toBe("Birds");
    expect(categoryOf("Stream")).toBe("Water");
    expect(categoryOf("Vehicle")).toBe("Urban life");
    expect(missionFor("Water").body).toContain("safe, dry spot");
  });
});
describe("local history recovery", () => {
  it("handles corrupt and unsupported storage", () => {
    expect(readJournal({ getItem: () => "{" })).toEqual([]);
    expect(
      readJournal({
        getItem: () => {
          throw Error("denied");
        },
      }),
    ).toEqual([]);
  });
  it("rejects malformed saved entries", () => {
    expect(
      readJournal({
        getItem: () => JSON.stringify([{ category: "Birds" }, null]),
      }),
    ).toEqual([]);
  });
});
