import { createStore } from "@xstate/store";
import {
  categoryOf,
  type Category,
  type Detection,
  type Entry,
} from "./domain";
export type Phase = "idle" | "permission" | "recording" | "analyzing";
export type Stage = "capture" | "listen" | "note" | "done";
export type Disclosure = "privacyOpen" | "modelResultsOpen" | "changeSoundOpen";
export interface SafariContext {
  view: "explore" | "journal";
  stage: Stage;
  consent: boolean;
  phase: Phase;
  status: string;
  seconds: number;
  runId: number;
  detections: Detection[];
  selected: Category;
  source: "model" | "manual";
  reflection: string;
  history: Entry[];
  storedHistory: Entry[];
  persist: boolean;
  storageError: string;
  confirmClear: boolean;
  manual: boolean;
  listeningUntil: number | null;
  remaining: number;
  privacyOpen: boolean;
  modelResultsOpen: boolean;
  changeSoundOpen: boolean;
}
const freshSession = (): SafariContext => ({
  view: "explore",
  stage: "capture",
  consent: false,
  phase: "idle",
  status: "",
  seconds: 10,
  runId: 0,
  detections: [],
  selected: "Other sounds",
  source: "manual",
  reflection: "",
  history: [],
  storedHistory: [],
  persist: false,
  storageError: "",
  confirmClear: false,
  manual: false,
  listeningUntil: null,
  remaining: 60,
  privacyOpen: false,
  modelResultsOpen: false,
  changeSoundOpen: false,
});
const mission = (category: Category, source: "model" | "manual") => ({
  selected: category,
  source,
  stage: "listen" as const,
  reflection: "",
  manual: false,
  listeningUntil: null,
  remaining: 60,
  changeSoundOpen: false,
});
export function createSafariStore() {
  return createStore({
    context: freshSession(),
    on: {
      sessionOpened: (context, event: { history: Entry[] }) => ({
        ...freshSession(),
        history: event.history,
        storedHistory: event.history,
        runId: context.runId + 1,
      }),
      disposed: (context) => ({
        ...context,
        runId: context.runId + 1,
        phase: "idle" as const,
        listeningUntil: null,
      }),
      consentChanged: (context, event: { value: boolean }) =>
        context.phase === "idle"
          ? { ...context, consent: event.value }
          : context,
      persistenceChanged: (context, event: { value: boolean }) => ({
        ...context,
        persist: event.value,
      }),
      reflectionChanged: (context, event: { value: string }) =>
        context.stage === "note"
          ? { ...context, reflection: event.value.slice(0, 1000) }
          : context,
      manualToggled: (context) =>
        context.phase === "idle"
          ? { ...context, manual: !context.manual }
          : context,
      disclosureChanged: (
        context,
        event: { disclosure: Disclosure; open: boolean },
      ) => ({ ...context, [event.disclosure]: event.open }),
      viewToggled: (context) =>
        context.phase === "idle"
          ? {
              ...context,
              view:
                context.view === "journal"
                  ? ("explore" as const)
                  : ("journal" as const),
            }
          : context,
      journalOpened: (context) =>
        context.phase === "idle"
          ? { ...context, view: "journal" as const }
          : context,
      exploreOpened: (context) => ({ ...context, view: "explore" as const }),
      restarted: (context) =>
        context.phase === "idle"
          ? {
              ...context,
              view: "explore" as const,
              stage: "capture" as const,
              reflection: "",
              manual: false,
              listeningUntil: null,
              remaining: 60,
              detections: [],
              status: "",
              modelResultsOpen: false,
              changeSoundOpen: false,
            }
          : context,
      soundChosen: (context, event: { category: Category }) =>
        context.phase === "idle"
          ? { ...context, ...mission(event.category, "manual") }
          : context,
      listeningStarted: (context, event: { now: number }) =>
        context.stage === "listen" &&
        context.listeningUntil === null &&
        context.remaining > 0
          ? { ...context, listeningUntil: event.now + 60000, remaining: 60 }
          : context,
      timerTicked: (context, event: { now: number }) => {
        if (context.listeningUntil === null) return context;
        const remaining = Math.max(
          0,
          Math.ceil((context.listeningUntil - event.now) / 1000),
        );
        return {
          ...context,
          remaining,
          listeningUntil: remaining === 0 ? null : context.listeningUntil,
        };
      },
      reflectionOpened: (context) =>
        context.stage === "listen"
          ? { ...context, stage: "note" as const, listeningUntil: null }
          : context,
      listeningReturned: (context) =>
        context.stage === "note"
          ? { ...context, stage: "listen" as const }
          : context,
      captureRequested: (context) =>
        context.consent &&
        context.phase === "idle" &&
        context.stage === "capture"
          ? {
              ...context,
              runId: context.runId + 1,
              phase: "permission" as const,
              detections: [],
              status:
                "Allow microphone access in your browser, or cancel to listen manually.",
            }
          : context,
      captureUpdated: (
        context,
        event: {
          runId: number;
          phase?: Phase;
          status?: string;
          seconds?: number;
        },
      ) => {
        if (event.runId !== context.runId || context.phase === "idle")
          return context;
        return {
          ...context,
          ...(event.phase !== undefined ? { phase: event.phase } : {}),
          ...(event.status !== undefined ? { status: event.status } : {}),
          ...(event.seconds !== undefined ? { seconds: event.seconds } : {}),
        };
      },
      detectionsReceived: (
        context,
        event: { runId: number; detections: Detection[] },
      ) => {
        if (event.runId !== context.runId || context.phase === "idle")
          return context;
        return {
          ...context,
          detections: event.detections,
          phase: "idle" as const,
          ...(event.detections.length
            ? {
                ...mission(categoryOf(event.detections[0].label), "model"),
                status:
                  "Possible sounds found. These are model suggestions, not verified identifications.",
              }
            : {
                manual: true,
                status: "No confident matches. Choose what you heard instead.",
              }),
        };
      },
      captureFailed: (context, event: { runId: number; message: string }) =>
        event.runId === context.runId
          ? { ...context, phase: "idle" as const, status: event.message }
          : context,
      captureSettled: (context, event: { runId: number }) =>
        event.runId === context.runId
          ? { ...context, phase: "idle" as const }
          : context,
      captureCancelled: (context) => ({
        ...context,
        runId: context.runId + 1,
        phase: "idle" as const,
        status: "Stopped. Microphone off; captured audio discarded.",
      }),
      missionCompleted: (context, event: { entry: Entry }) =>
        context.stage === "note"
          ? {
              ...context,
              stage: "done" as const,
              history: [event.entry, ...context.history].slice(0, 50),
              storedHistory: context.persist
                ? [event.entry, ...context.storedHistory].slice(0, 50)
                : context.storedHistory,
              storageError: "",
            }
          : context,
      persistenceFailed: (context, event: { message: string }) => ({
        ...context,
        storageError: event.message,
      }),
      clearRequested: (context) => ({ ...context, confirmClear: true }),
      clearDismissed: (context) => ({ ...context, confirmClear: false }),
      journalCleared: (context) => ({
        ...context,
        history: [],
        storedHistory: [],
        confirmClear: false,
        storageError: "",
      }),
    },
  });
}
export const safariStore = createSafariStore();
