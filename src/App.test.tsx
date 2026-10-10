// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { STORAGE_KEY } from "./domain";
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("MediaRecorder", class {});
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("privacy and fallback flows", () => {
  it("never requests permission before consent and recovers from denial", async () => {
    const mic = vi
      .fn()
      .mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: mic },
    });
    const user = userEvent.setup();
    render(<App />);
    expect(
      (
        screen.getByRole("button", {
          name: "Listen to my surroundings",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(mic).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox", { name: /I agree/ }));
    await user.click(
      screen.getByRole("button", { name: "Listen to my surroundings" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("denied"),
    );
    expect(mic).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole("button", { name: "Listen without recording" }),
    );
    await user.click(screen.getByRole("button", { name: "Birds" }));
    expect(screen.getByText("Your observation")).toBeTruthy();
  });
  it("stops a late microphone stream after permission request cancellation", async () => {
    let resolve!: (s: MediaStream) => void;
    const mic = vi.fn(
      () =>
        new Promise<MediaStream>((r) => {
          resolve = r;
        }),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: mic },
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("checkbox", { name: /I agree/ }));
    await user.click(
      screen.getByRole("button", { name: "Listen to my surroundings" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel & discard" }));
    const stop = vi.fn();
    await act(async () => {
      resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    });
    expect(stop).toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("discarded");
  });
  it("keeps new reflections in session memory by default", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      screen.getByRole("button", { name: "Listen without recording" }),
    );
    await user.click(screen.getByRole("button", { name: "Water" }));
    await user.click(screen.getByRole("button", { name: "I’ve listened" }));
    await user.type(
      screen.getByRole("textbox", { name: /What did you notice/ }),
      "A steady stream",
    );
    await user.click(screen.getByRole("button", { name: "Complete mission" }));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Journal 1" }));
    expect(screen.getByText("A steady stream")).toBeTruthy();
  });
  it("persists only with opt-in and restores saved notes", async () => {
    const user = userEvent.setup();
    const rendered = render(<App />);
    await user.click(
      screen.getByRole("button", { name: "Listen without recording" }),
    );
    await user.click(screen.getByRole("button", { name: "Birds" }));
    await user.click(screen.getByRole("button", { name: "I’ve listened" }));
    await user.type(
      screen.getByRole("textbox", { name: /What did you notice/ }),
      "Two rhythms",
    );
    await user.click(
      screen.getByRole("checkbox", { name: /Save new reflections/ }),
    );
    await user.click(screen.getByRole("button", { name: "Complete mission" }));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved[0].source).toBe("manual");
    expect(saved[0]).not.toHaveProperty("audio");
    rendered.unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Journal 1" }));
    expect(screen.getByText("Two rhythms")).toBeTruthy();
  });
});

it("finishes the optional timer using elapsed wall-clock time", () => {
  vi.useFakeTimers();
  render(<App/>);
  fireEvent.click(screen.getByRole("button",{name:"Listen without recording"}));
  fireEvent.click(screen.getByRole("button",{name:"Birds"}));
  fireEvent.click(screen.getByRole("button",{name:"Start one minute"}));
  act(()=>{vi.setSystemTime(Date.now()+65000);vi.advanceTimersByTime(500)});
  expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("0 seconds remaining");
  expect(screen.getByRole("status").textContent).toContain("One minute");
});
