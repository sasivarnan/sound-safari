import { useEffect, type CSSProperties } from "react";
import { useSelector } from "@xstate/store-react";
import {
  Microphone,
  ShieldCheck,
  BookOpen,
  Bird,
  Waves,
  Wind,
  Users,
  Tram,
  Ear,
  Check,
  X,
} from "@phosphor-icons/react";
import { Button } from "./components/ui/button";
import { categories, missionFor, type Category } from "./domain";
import { safariStore } from "./safari-store";
import {
  captureController,
  completeMission,
  clearJournal,
} from "./capture-controller";
import { transitionView } from "./view-transition";
const icons = [Bird, Waves, Wind, Users, Tram, Ear];
export default function App() {
  const {
    view,
    stage,
    consent,
    phase,
    status,
    seconds,
    detections,
    selected,
    source,
    reflection,
    history,
    persist,
    storageError,
    confirmClear,
    manual,
    listeningUntil,
    remaining,
    privacyOpen,
    modelResultsOpen,
    changeSoundOpen,
  } = useSelector(safariStore, (snapshot) => snapshot.context);
  const hasMission = stage !== "capture";
  const reflecting = stage === "note";
  const saved = stage === "done";
  const screen = view === "journal" ? "journal" : stage;
  useEffect(() => captureController.attach(), []);
  useEffect(() => {
    const heading = document.querySelector<HTMLElement>("main h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }, [screen]);
  useEffect(() => {
    if (listeningUntil !== null) document.querySelector<HTMLElement>(".listening-time")?.focus({preventScroll:true});
  }, [listeningUntil]);
  function choose(category: Category) {
    void transitionView(() => safariStore.trigger.soundChosen({ category }));
  }
  function startAgain() {
    void transitionView(() => safariStore.trigger.restarted());
  }
  const mission = missionFor(selected);
  const step = stage === "capture" ? 1 : stage === "listen" ? 2 : 3;
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <button
          className="wordmark"
          onClick={() => {
            if (phase === "idle") {
              startAgain();
            }
          }}
          aria-label="SoundSafari home"
          disabled={phase !== "idle"}
        >
          SoundSafari<span aria-hidden="true">.</span>
        </button>
        <Button
          disabled={phase !== "idle"}
          variant="ghost"
          onClick={() =>
            transitionView(() => safariStore.trigger.viewToggled())
          }
          aria-label={
            view === "journal"
              ? "Back to listening"
              : history.length
                ? `Journal ${history.length}`
                : "Journal"
          }
        >
          <BookOpen size={18} />
          {view === "journal" ? "Back" : "Journal"}
          {history.length > 0 && (
            <span className="count">{history.length}</span>
          )}
        </Button>
      </header>
      <main
        id="main"
        tabIndex={-1}
        data-screen={screen}
        data-view-transitions={
          typeof document.startViewTransition === "function"
            ? "native"
            : "fallback"
        }
      >
        {view === "explore" ? (
          <>
            <ol className="progress" aria-label="Your listening session">
              {["Capture", "Listen", "Note"].map((label, i) => (
                <li
                  key={label}
                  aria-current={step === i + 1 ? "step" : undefined}
                >
                  <span>{i + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
            {!hasMission ? (
              <section
                id="listen"
                key="capture"
                className="capture"
                aria-labelledby="capture-title"
              >
                <p className="kicker">A TWO-MINUTE BREAK OUTSIDE</p>
                <h1 id="capture-title">What can you hear?</h1>
                <p className="lead">
                  Pause somewhere safe. Record 10 seconds, then take a minute to
                  notice one sound.
                </p>
                <div className="record-area">
                  <div
                    className={
                      "record-symbol " +
                      (phase === "recording" ? "recording" : "")
                    }
                    aria-hidden="true"
                  >
                    {phase === "recording" ? (
                      <span>
                        {seconds}
                        <small>seconds left</small>
                      </span>
                    ) : (
                      <Microphone size={32} weight="light" />
                    )}
                  </div>
                  {phase === "idle" ? (
                    <>
                      <label className="consent">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) =>
                            safariStore.trigger.consentChanged({
                              value: e.target.checked,
                            })
                          }
                        />
                        <span>
                          I agree to a 10-second microphone recording, processed
                          on this device.
                        </span>
                      </label>
                      <Button
                        className="primary-action"
                        disabled={!consent}
                        onClick={captureController.record}
                      >
                        <Microphone />
                        Listen to my surroundings
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="primary-action"
                      onClick={captureController.cancel}
                    >
                      <X />
                      {phase === "recording"
                        ? "Stop & discard"
                        : "Cancel & discard"}
                    </Button>
                  )}
                  {status && (
                    <p className="status" role="status" aria-live="polite">
                      {status}
                    </p>
                  )}
                  <p className="download-note">
                    First use downloads a sound model (~90 MB). Wi-Fi
                    recommended.
                  </p>
                </div>
                <div className="manual-section">
                  <Button
                    variant="ghost"
                    disabled={phase !== "idle"}
                    onClick={() => safariStore.trigger.manualToggled()}
                    aria-expanded={manual}
                  >
                    {manual ? "Hide sound choices" : "Listen without recording"}
                    <span aria-hidden="true">{manual ? "−" : "+"}</span>
                  </Button>
                  {manual && (
                    <>
                      <p className="help">
                        Listen for a moment, then choose what you hear.
                      </p>
                      <div className="sound-choices">
                        {categories.map((c, i) => {
                          const Icon = icons[i];
                          return (
                            <Button
                              variant="outline"
                              key={c}
                              onClick={() => choose(c)}
                            >
                              <Icon />
                              {c}
                            </Button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </section>
            ) : saved ? (
              <section
                key="done"
                className="finished"
                aria-labelledby="done-title"
              >
                <Check size={32} />
                <p className="kicker">SESSION COMPLETE</p>
                <h1 id="done-title">A moment noticed.</h1>
                <p className="lead">
                  {reflection.trim()
                    ? "Your note is in your journal."
                    : "Your listening session is in your journal."}
                </p>
                <p className="help">
                  {persist && !storageError
                    ? "Saved on this device."
                    : "Available for this session only."}
                </p>
                {storageError && <p role="alert">{storageError}</p>}
                <Button className="primary-action" onClick={startAgain}>
                  Listen again
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    transitionView(() => safariStore.trigger.journalOpened())
                  }
                >
                  View journal
                </Button>
              </section>
            ) : (
              <section
                key={stage}
                className="listening"
                aria-labelledby="mission-title"
              >
                <div className="sound-summary">
                  <span>{selected}</span>
                  <small>
                    {source === "model"
                      ? "Model suggestion · may be wrong"
                      : "Your observation"}
                  </small>
                </div>
                {detections.length > 0 && (
                  <details
                    className="model-results"
                    open={modelResultsOpen}
                    onToggle={(e) =>
                      safariStore.trigger.disclosureChanged({
                        disclosure: "modelResultsOpen",
                        open: e.currentTarget.open,
                      })
                    }
                  >
                    <summary>What the model suggested</summary>
                    <p>
                      Scores are uncertain model estimates, not verified
                      identifications.
                    </p>
                    <ul>
                      {detections.map((d) => (
                        <li key={d.label}>
                          <span>{d.label}</span>
                          <span>{Math.round(d.score * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {!reflecting ? (
                  <>
                    <p className="kicker">PUT YOUR PHONE DOWN FOR A MINUTE</p>
                    <h1 id="mission-title">{mission.title}</h1>
                    <p className="lead">{mission.body}</p>
                    <div
                      className="listening-time"
                      tabIndex={-1}
                      style={
                        {
                          "--listening-progress": `${((60 - remaining) / 60) * 100}%`,
                        } as CSSProperties
                      }
                      role="timer"
                      aria-label={`${remaining} seconds remaining`}
                    >
                      {Math.floor(remaining / 60)}:
                      {String(remaining % 60).padStart(2, "0")}
                    </div>
                    {listeningUntil === null && remaining > 0 ? (
                      <Button
                        className="primary-action"
                        onClick={() =>
                          safariStore.trigger.listeningStarted({
                            now: Date.now(),
                          })
                        }
                      >
                        Start one minute
                      </Button>
                    ) : listeningUntil !== null ? (
                      <p className="timer-hint">
                        You can lock your phone. Come back when you’re ready.
                      </p>
                    ) : (
                      <p className="timer-hint" role="status">
                        One minute. What stood out?
                      </p>
                    )}
                    <Button
                      variant="outline"
                      className="secondary-action"
                      onClick={() =>
                        transitionView(() =>
                          safariStore.trigger.reflectionOpened(),
                        )
                      }
                    >
                      I’ve listened
                    </Button>
                    <details
                      className="change-sound"
                      open={changeSoundOpen}
                      onToggle={(e) =>
                        safariStore.trigger.disclosureChanged({
                          disclosure: "changeSoundOpen",
                          open: e.currentTarget.open,
                        })
                      }
                    >
                      <summary>Choose a different sound</summary>
                      <p className="help">
                        Choose what you actually heard. This becomes your
                        observation.
                      </p>
                      <div className="sound-choices">
                        {categories.map((c) => (
                          <Button
                            key={c}
                            variant="outline"
                            onClick={() => choose(c)}
                          >
                            {c}
                          </Button>
                        ))}
                      </div>
                    </details>
                  </>
                ) : (
                  <>
                    <p className="kicker">ONE LAST THING · OPTIONAL</p>
                    <h1 id="mission-title">What did you notice?</h1>
                    <p className="lead">
                      A rhythm, a pause, something you hadn’t heard before.
                    </p>
                    <label className="note-label" htmlFor="reflection">
                      What did you notice? <span>(optional)</span>
                    </label>
                    <textarea
                      id="reflection"
                      maxLength={1000}
                      value={reflection}
                      onChange={(e) =>
                        safariStore.trigger.reflectionChanged({
                          value: e.target.value,
                        })
                      }
                      placeholder="I noticed…"
                    />
                    <label className="consent">
                      <input
                        type="checkbox"
                        checked={persist}
                        onChange={(e) =>
                          safariStore.trigger.persistenceChanged({
                            value: e.target.checked,
                          })
                        }
                      />
                      <span>
                        Save new reflections on this device. Shared devices may
                        expose your notes.
                      </span>
                    </label>
                    <Button
                      className="primary-action"
                      onClick={completeMission}
                    >
                      Complete mission
                    </Button>
                    <Button
                      variant="ghost"
                      className="back-link"
                      onClick={() =>
                        transitionView(() =>
                          safariStore.trigger.listeningReturned(),
                        )
                      }
                    >
                      Back to listening
                    </Button>
                  </>
                )}
              </section>
            )}
            <p className="safety">
              Stay still, away from traffic and water edges. Don’t approach
              wildlife or record private conversations.
            </p>
            <details
              className="privacy"
              open={privacyOpen}
              onToggle={(e) =>
                safariStore.trigger.disclosureChanged({
                  disclosure: "privacyOpen",
                  open: e.currentTarget.open,
                })
              }
            >
              <summary>
                <ShieldCheck size={16} />
                Your audio stays on this device
              </summary>
              <p>
                Recordings are discarded after analysis. No location tracking or
                audio uploads. The first model download contacts Hugging Face;
                it receives normal connection information, never your audio.
                Sound suggestions can be wrong. Listening prompts are written in
                advance and selected for the sound.
              </p>
              <p>
                Notes stay in memory unless you choose to save them. Saved notes
                are not encrypted. You can remove them from your journal.
              </p>
            </details>
          </>
        ) : (
          <section
            key="journal"
            className="journal"
            aria-labelledby="journal-title"
          >
            <p className="kicker">YOUR LISTENING NOTES</p>
            <h1 id="journal-title">Journal</h1>
            <p className="help">
              Saved on this browser only. Unsaved sessions disappear when you
              refresh.
            </p>
            {history.length === 0 ? (
              <div className="empty">
                <p>No listening sessions yet.</p>
                <Button
                  onClick={() =>
                    transitionView(() => safariStore.trigger.exploreOpened())
                  }
                >
                  Start listening
                </Button>
              </div>
            ) : (
              <>
                {history.map((e) => (
                  <article className="journal-entry" key={e.id}>
                    <div className="entry-meta">
                      <time dateTime={e.date}>
                        {new Date(e.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                      <span>{e.category}</span>
                    </div>
                    <h2>{e.title}</h2>
                    <p>
                      {e.reflection || "Listened for a moment. No note added."}
                    </p>
                    <small>
                      {e.source === "manual"
                        ? "Your observation"
                        : "Model suggestion"}
                    </small>
                  </article>
                ))}
                <div className="journal-actions">
                  {!confirmClear ? (
                    <Button
                      variant="ghost"
                      onClick={() => safariStore.trigger.clearRequested()}
                    >
                      Clear journal
                    </Button>
                  ) : (
                    <div role="alert">
                      <p>
                        Remove all entries from this browser and this session?
                      </p>
                      <Button variant="destructive" onClick={clearJournal}>
                        Yes, clear entries
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => safariStore.trigger.clearDismissed()}
                      >
                        Keep entries
                      </Button>
                    </div>
                  )}
                  {storageError && <p role="alert">{storageError}</p>}
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </>
  );
}
