import { safariStore } from "./safari-store";
import {
  credibleDetections,
  readJournal,
  STORAGE_KEY,
  missionFor,
  type Entry,
  type Detection,
} from "./domain";
import { transitionView, stopViewTransition } from "./view-transition";

class CaptureController {
  private releaseCapture: () => void = () => {};
  private worker: Worker | null = null;
  private listeningTimer: ReturnType<typeof setInterval> | undefined;
  attach() {
    let history: Entry[] = [];
    try {
      history = readJournal(localStorage);
    } catch {
      /* Session-only mode. */
    }
    safariStore.trigger.sessionOpened({ history });
    const syncTimer = () => {
      if (safariStore.getSnapshot().context.listeningUntil !== null) {
        if (this.listeningTimer === undefined)
          this.listeningTimer = setInterval(
            () => safariStore.trigger.timerTicked({ now: Date.now() }),
            500,
          );
      } else {
        clearInterval(this.listeningTimer);
        this.listeningTimer = undefined;
      }
    };
    const subscription = safariStore.subscribe(syncTimer);
    const hide = () => {
      if (document.hidden && safariStore.getSnapshot().context.phase !== "idle")
        this.cancel();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      safariStore.trigger.disposed();
      this.releaseCapture();
      this.releaseCapture = () => {};
      this.worker?.terminate();
      this.worker = null;
      clearInterval(this.listeningTimer);
      this.listeningTimer = undefined;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", hide);
      stopViewTransition();
    };
  }
  cancel = () => {
    safariStore.trigger.captureCancelled();
    this.releaseCapture();
    this.releaseCapture = () => {};
    this.worker?.terminate();
    this.worker = null;
  };
  record = async () => {
    const before = safariStore.getSnapshot().context;
    if (
      before.phase !== "idle" ||
      !before.consent ||
      before.stage !== "capture"
    )
      return;
    safariStore.trigger.captureRequested();
    const id = safariStore.getSnapshot().context.runId;
    const reportStatus = (status: string) =>
      safariStore.trigger.captureUpdated({ runId: id, status });
    const reportPhase = (phase: "permission" | "recording" | "analyzing") =>
      safariStore.trigger.captureUpdated({ runId: id, phase });
    const reportSeconds = (seconds: number) =>
      safariStore.trigger.captureUpdated({ runId: id, seconds });
    const fail = (message: string) =>
      safariStore.trigger.captureFailed({ runId: id, message });
    let stream: MediaStream | undefined, ctx: AudioContext | undefined;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Microphone requires HTTPS or localhost and a supported browser. Try manual listening below.",
        );
      if (!window.MediaRecorder)
        throw new Error(
          "Recording is unavailable in this browser. Try manual listening below.",
        );
      reportStatus(
        "Allow microphone access in your browser, or cancel to listen manually.",
      );
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      if (id !== safariStore.getSnapshot().context.runId) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      ctx = new AudioContext();
      await ctx.resume();
      if (id !== safariStore.getSnapshot().context.runId) {
        stream.getTracks().forEach((t) => t.stop());
        await ctx.close();
        return;
      }
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      let timer: ReturnType<typeof setInterval>,
        end: ReturnType<typeof setTimeout>;
      const stopTracks = () => stream?.getTracks().forEach((t) => t.stop());
      this.releaseCapture = () => {
        clearInterval(timer);
        clearTimeout(end);
        if (recorder.state !== "inactive") recorder.stop();
        stopTracks();
        void ctx?.close().catch(() => {});
        chunks.length = 0;
      };
      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          clearInterval(timer);
          clearTimeout(end);
          stopTracks();
          resolve(new Blob(chunks, { type: recorder.mimeType }));
        };
        recorder.onerror = () =>
          reject(
            new Error(
              "Recording failed. Check your microphone or try manual listening.",
            ),
          );
        recorder.start();
        reportPhase("recording");
        reportSeconds(10);
        reportStatus(
          "Recording for 10 seconds. Stay still and let the world do the talking.",
        );
        const started = Date.now();
        timer = setInterval(
          () =>
            reportSeconds(
              Math.max(0, 10 - Math.floor((Date.now() - started) / 1000)),
            ),
          250,
        );
        end = setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, 10000);
      });
      if (id !== safariStore.getSnapshot().context.runId) return;
      reportPhase("analyzing");
      reportStatus("Microphone off. Preparing your clip for local analysis…");
      const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
      const offline = new OfflineAudioContext(1, 160000, 16000);
      const buffer = offline.createBufferSource();
      buffer.buffer = decoded;
      buffer.connect(offline.destination);
      buffer.start();
      const audio = (await offline.startRendering()).getChannelData(0);
      await ctx.close();
      if (id !== safariStore.getSnapshot().context.runId) return;
      if (
        Math.sqrt(audio.reduce((sum, v) => sum + v * v, 0) / audio.length) <
        0.0001
      )
        throw new Error(
          "The clip was almost silent. No sounds identified. Check your microphone or listen manually.",
        );
      reportStatus(
        "Loading the sound model (first use may download ~90 MB). Audio stays on this device.",
      );
      const w = new Worker(new URL("./model.worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker = w;
      const results = await new Promise<Detection[]>((resolve, reject) => {
        const timeout = setTimeout(() => {
          w.terminate();
          reject(
            new Error(
              "Model timed out. Your audio was discarded. Try again or listen manually.",
            ),
          );
        }, 180000);
        this.releaseCapture = () => {
          clearTimeout(timeout);
          w.terminate();
          reject(new Error("Cancelled"));
        };
        w.onmessage = (e) => {
          if (id !== safariStore.getSnapshot().context.runId) return;
          if (e.data.type === "progress")
            reportStatus(
              `Downloading model asset: ${e.data.progress}%. Audio stays local.`,
            );
          else {
            clearTimeout(timeout);
            if (e.data.type === "result") resolve(e.data.results);
            else
              reject(
                new Error(
                  "The model could not load or run. Check your connection or try manual listening.",
                ),
              );
          }
        };
        w.onerror = () => {
          clearTimeout(timeout);
          reject(
            new Error(
              "Local analysis is unavailable in this browser. Try manual listening.",
            ),
          );
        };
        w.postMessage({ audio }, [audio.buffer]);
      });
      w.terminate();
      this.worker = null;
      if (id !== safariStore.getSnapshot().context.runId) return;
      await transitionView(() =>
        safariStore.trigger.detectionsReceived({
          runId: id,
          detections: credibleDetections(results),
        }),
      );
    } catch (e) {
      if (id === safariStore.getSnapshot().context.runId)
        fail(
          e instanceof Error || e instanceof DOMException
            ? e.name === "NotAllowedError"
              ? "Microphone access was denied. Enable it in browser site settings or use manual listening."
              : e.name === "NotFoundError"
                ? "No microphone found. You can still explore by listening manually."
                : e.message
            : "Something went wrong. Try manual listening.",
        );
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
      if (id === safariStore.getSnapshot().context.runId) {
        this.releaseCapture();
        this.releaseCapture = () => {};
        this.worker?.terminate();
        this.worker = null;
        safariStore.trigger.captureSettled({ runId: id });
      }
    }
  };
}
export const captureController = new CaptureController();
export function completeMission() {
  void transitionView(() => {
    const context = safariStore.getSnapshot().context;
    if (context.stage !== "note") return;
    const entry: Entry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      category: context.selected,
      source: context.source,
      title: missionFor(context.selected).title,
      reflection: context.reflection.trim(),
    };
    safariStore.trigger.missionCompleted({ entry });
    if (context.persist)
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(safariStore.getSnapshot().context.storedHistory),
        );
      } catch {
        safariStore.trigger.persistenceFailed({
          message:
            "Browser storage is unavailable. This entry is only saved for this session.",
        });
      }
  });
}
export function clearJournal() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    safariStore.trigger.journalCleared();
  } catch {
    safariStore.trigger.persistenceFailed({
      message:
        "Could not clear browser storage. Use browser site settings to remove saved data.",
    });
  }
}
