import { describe, it, expect } from "vitest";
import { createSafariStore } from "./safari-store";
import type { Entry } from "./domain";
const entry = (id: string): Entry => ({
  id,
  date: "2026-10-09T12:00:00Z",
  category: "Birds",
  source: "manual",
  title: "A listening moment",
  reflection: "A short call",
});
describe("central event-driven state", () => {
  it("requires consent and prevents duplicate captures", () => {
    const store = createSafariStore();
    store.trigger.captureRequested();
    expect(store.getSnapshot().context.phase).toBe("idle");
    store.trigger.consentChanged({ value: true });
    store.trigger.captureRequested();
    const runId = store.getSnapshot().context.runId;
    store.trigger.captureRequested();
    expect(store.getSnapshot().context.runId).toBe(runId);
    expect(store.getSnapshot().context.phase).toBe("permission");
  });
  it("ignores late progress and results after cancellation and a new capture", () => {
    const store = createSafariStore();
    store.trigger.consentChanged({ value: true });
    store.trigger.captureRequested();
    const old = store.getSnapshot().context.runId;
    store.trigger.captureCancelled();
    store.trigger.captureRequested();
    store.trigger.captureUpdated({
      runId: old,
      phase: "recording",
      seconds: 5,
    });
    store.trigger.detectionsReceived({
      runId: old,
      detections: [{ label: "Bird", score: 0.9 }],
    });
    store.trigger.captureFailed({ runId: old, message: "old error" });
    expect(store.getSnapshot().context.phase).toBe("permission");
    expect(store.getSnapshot().context.stage).toBe("capture");
    expect(store.getSnapshot().context.detections).toEqual([]);
  });
  it("allows completion only from reflection and prevents duplicate journal entries", () => {
    const store = createSafariStore();
    store.trigger.missionCompleted({ entry: entry("ignored") });
    expect(store.getSnapshot().context.history).toHaveLength(0);
    store.trigger.soundChosen({ category: "Birds" });
    store.trigger.reflectionOpened();
    store.trigger.missionCompleted({ entry: entry("one") });
    store.trigger.missionCompleted({ entry: entry("duplicate") });
    expect(store.getSnapshot().context.history).toHaveLength(1);
    expect(store.getSnapshot().context.stage).toBe("done");
  });
  it("keeps earlier session-only entries out of opted-in persistence", () => {
    const store = createSafariStore();
    store.trigger.soundChosen({ category: "Birds" });
    store.trigger.reflectionOpened();
    store.trigger.missionCompleted({ entry: entry("session-only") });
    store.trigger.restarted();
    store.trigger.soundChosen({ category: "Birds" });
    store.trigger.reflectionOpened();
    store.trigger.persistenceChanged({ value: true });
    store.trigger.missionCompleted({ entry: entry("persisted") });
    expect(store.getSnapshot().context.history.map((e) => e.id)).toEqual([
      "persisted",
      "session-only",
    ]);
    expect(store.getSnapshot().context.storedHistory.map((e) => e.id)).toEqual([
      "persisted",
    ]);
  });
});
