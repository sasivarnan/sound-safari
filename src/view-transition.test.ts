// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { transitionView, stopViewTransition } from "./view-transition";
afterEach(() => {
  stopViewTransition();
  Reflect.deleteProperty(document, "startViewTransition");
  vi.unstubAllGlobals();
});
it("updates immediately when View Transitions are unavailable", async () => {
  const update = vi.fn();
  await transitionView(update);
  expect(update).toHaveBeenCalledTimes(1);
});
it("bypasses animation for reduced motion", async () => {
  const native = vi.fn();
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: native,
  });
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const update = vi.fn();
  await transitionView(update);
  expect(update).toHaveBeenCalledTimes(1);
  expect(native).not.toHaveBeenCalled();
});
it("commits once even if the native API fails after invoking the callback", async () => {
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: (update: () => void) => {
      update();
      throw Error("unavailable");
    },
  });
  const update = vi.fn();
  await transitionView(update);
  expect(update).toHaveBeenCalledTimes(1);
});
it("uses the native update callback and tolerates skipped animations", async () => {
  const native = vi.fn((update: () => void) => ({
    ready: Promise.reject(Error("skipped")),
    finished: Promise.resolve(),
    updateCallbackDone: Promise.resolve().then(update),
    skipTransition: vi.fn(),
  }));
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: native,
  });
  const update = vi.fn();
  await transitionView(update);
  expect(native).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledTimes(1);
});
