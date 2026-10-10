# SoundSafari

Pause, listen, notice. A responsive outdoor listening journal with optional, on-device AI sound suggestions.

## Run locally

Requires Node.js 22.12+ and npm. No API keys, account, or backend.

```sh
npm ci
npm run dev
```

Open the localhost address shown by Vite (usually http://localhost:5173). Microphones require **HTTPS or localhost**. A phone opening your laptop's plain HTTP LAN address cannot record; use HTTPS hosting for phone testing. To produce a static deployment:

```sh
npm run build
npm run preview
npm test
```

Serve `dist/` with HTTPS on any static host. WASM assets and model requests must be permitted; no cross-origin isolation headers are required because inference uses one thread.

## What you do

1. Stop somewhere safe outdoors. Record ten seconds, or choose **Listen without recording** and select what you hear.
2. Follow one short listening prompt. Start the optional one-minute timer and put the phone down.
3. Tap **I’ve listened**, optionally write a note, then finish. Saving notes on this device is opt-in.

This is a small listening exercise, not a navigation tool or a species identifier. No partner service has been added; the app stays local while the core experience is evaluated.

## Experience

- Explicit consent before any microphone request; capture lasts ten seconds.
- Stop & discard, cancellation while permission is pending, auto-stop when the tab is hidden, and track cleanup on errors/unmount.
- A worker runs open-weight Audio Spectrogram Transformer classification with Transformers.js / ONNX WASM, keeping the interface responsive.
- Real suggestions above a 0.15 score threshold are displayed with their scores. No fake or demo classifications. Silent clips and low scores produce no detections.
- Six broad listening categories select curated one-minute missions. These are deterministic, detection-informed prompts, **not LLM-generated text**. Manual observations are labeled separately.
- Optional reflection and mission completion. Journal entries remain in session memory unless the user opts into saving new entries on this device. At most 50 entries are saved. Clear journal removes both saved and in-memory entries.
- Keyboard controls, labeled consent and reflection fields, live status, reduced motion, responsive layout, and safe stationary missions.

## Model and privacy

Model: [Xenova/ast-finetuned-audioset-10-10-0.4593](https://huggingface.co/Xenova/ast-finetuned-audioset-10-10-0.4593), a quantized ONNX conversion of [MIT AST](https://huggingface.co/MIT/ast-finetuned-audioset-10-10-0.4593). The model uses AudioSet labels; it is not a bird species identifier. Model revision is pinned in `src/model.worker.ts` to `c38c0051164d7433ccb1341e5c60d38f30608ac9`. Upstream model license: BSD-3-Clause; Transformers.js: Apache-2.0. Review upstream terms when redistributing model weights.

On first analysis the browser downloads model assets (roughly 90 MB for quantized weights, plus runtime files) from Hugging Face/CDN services. Those services see ordinary request metadata such as IP address, **never recorded audio**. The browser may cache model/runtime downloads; caching and offline availability depend on the browser. This is not an offline-installable PWA and offline operation is not guaranteed. Font files are bundled locally. No analytics, audio uploads, geolocation, transcription, or server-side storage.

Audio exists briefly in memory as a recording, decoded PCM, and worker input; it is discarded after inference or cancellation and never persisted. Only category, observation source, mission title, timestamp, and optional reflection may be stored under `soundsafari.journal.v1` in localStorage. Local storage is not encrypted and is accessible to other users of the browser profile. Saving is opt-in for **new** entries; turning it off does not erase older saved entries. Use Clear journal to erase them. Model cache is managed separately in browser site settings.

## Honest limitations

- The first model download/inference can take minutes or exhaust memory on older phones. A three-minute watchdog offers a manual fallback; cancellation is always available. The worker is discarded after each analysis, trading repeat loading cost for predictable cleanup.
- AudioSet scores are model confidence scores, not calibrated probabilities, verified detections, or loudness. Mixed soundscapes, wind on the microphone, distance, and recording hardware can cause mistakes. The threshold is an MVP heuristic, not a validated precision guarantee.
- MediaRecorder codecs and Web Audio support vary across browsers. Permission denial, missing hardware, decode/model/network failure, and very quiet input offer manual listening without fabricated output.
- Category mapping is a coarse keyword heuristic; unknown labels map to Other sounds. Missions use curated templates, not generative AI.
- No audio playback/download, background recording, location tracking, navigation, wildlife call playback, or scientific identification.
- Stay in one safe place, away from roads and water edges. Do not approach wildlife or record private conversations. The app cannot assess environmental safety.
- Automated checks cover consent gating, denied permissions, late permission cancellation cleanup, session-only and opt-in persistence, prediction filtering, safe mission selection, malformed history, and the production build. The pinned model was also smoke-tested in Node and in the browser WASM worker with synthetic input; this verifies execution, not outdoor accuracy. Real microphone quality, mobile memory usage, and outdoor classification accuracy need physical-device field testing.

## Design and structure

Uses the requested [shadcn preset b2DdzpiRk](https://ui.shadcn.com/create?preset=b2DdzpiRk), initialized with the official CLI: Base UI / Rhea, Olive base and theme, Geist font, Phosphor icons, default radius. `components.json`, generated theme tokens, and the generated shadcn Button are included. The interface is mobile-first and intentionally narrow on larger screens. A three-step flow (Capture → Listen → Note) replaces the original marketing layout. Manual sound choices and model/privacy details are disclosed on demand. A one-minute listening timer uses wall-clock time, so it resumes correctly after locking the phone.

- `src/App.tsx`: store selectors, accessible UI, and focus on step changes
- `src/safari-store.ts`: typed XState Store events for all application state
- `src/capture-controller.ts`: microphone/worker cleanup, timer effects, and journal persistence
- `src/view-transition.ts`: progressive View Transitions with reduced-motion and unsupported-browser fallback
- `src/model.worker.ts`: pinned quantized local inference
- `src/domain.ts`: prediction filtering, categories, mission templates, journal validation
- `src/domain.test.ts`: domain checks
- `src/components/ui/button.tsx`: preset-generated shadcn component
- `src/index.css`: preset tokens; `src/style.css`: responsive app layout

The requested repository did not exist when work began, so this is a new Vite / React / TypeScript project. No existing code or conventions were overwritten.

## State and interactions

All application state lives in `@xstate/store` (v4), read with `@xstate/store-react`. There is no React `useState`, `useReducer`, or `useRef` in app code. Screens, stage, consent, recording status and request IDs, detections, notes, persistence preferences, journal, disclosures, and the listening timer are updated through typed events. The capture controller owns only native resource handles and sends events; audio buffers are transient inference inputs, never store/persistence data.

A single stage (`capture`, `listen`, `note`, `done`) prevents incompatible screens. Request IDs reject stale async updates after cancellation or disposal. Only individually opted-in entries enter persistent storage; earlier session-only entries remain private to the session.

Screen changes use native View Transitions when supported (100–160 ms), with a short CSS entry fallback. Typing, countdown updates, consent, microphone cancellation, and permission requests do not wait for a screen animation. Light press feedback, a recording pulse, a timer progress line, manual-choice entry, and a completion cue provide feedback without extra visuals or sounds. Reduced-motion preferences disable transitions and animations.

Tests include store guards, stale results, opt-in persistence boundaries, and unsupported/reduced-motion/failed native transition paths, in addition to the user-flow tests.

## Hosting on OpenAI Sites

The production app is deployed as static assets on OpenAI Sites. The tracked `.openai/hosting.json` identifies the Site and declares `dist` as the static output directory. Build with `npm run build`, then use the Sites source workflow to synchronize source, package the build, and deploy a saved version. All audio inference runs in the visitor’s browser; no model or audio runs on the hosting server.

For microphone recording, open the deployed HTTPS application in a top-level tab if an embedded preview does not grant microphone access. Permission denial always leaves manual listening available.

The included Dockerfile is an optional generic static-serving alternative on port 7860. Hosting-provider plans and prices vary; free Docker compute is not assumed.
