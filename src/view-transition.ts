import { flushSync } from "react-dom";
// Native transition handles are effects, never application state.
let activeTransition: ViewTransition | undefined;
export function transitionView(update: () => void): Promise<void> {
  if (
    typeof document.startViewTransition !== "function" ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    update();
    return Promise.resolve();
  }
  activeTransition?.skipTransition();
  let committed = false;
  const commit = () => {
    if (!committed) {
      committed = true;
      flushSync(update);
    }
  };
  try {
    const transition = document.startViewTransition(commit);
    activeTransition = transition;
    // A skipped/unsupported animation must not reject an event handler.
    void transition.ready.catch(() => {});
    void transition.finished
      .catch(() => {})
      .finally(() => {
        if (activeTransition === transition) activeTransition = undefined;
      });
    return transition.updateCallbackDone.catch(() => {
      commit();
    });
  } catch {
    commit();
    return Promise.resolve();
  }
}
export function stopViewTransition() {
  activeTransition?.skipTransition();
  activeTransition = undefined;
}
