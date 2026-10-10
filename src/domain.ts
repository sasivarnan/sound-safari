export type Detection = { label: string; score: number };
export type Category =
  | "Birds"
  | "Water"
  | "Wind & leaves"
  | "People"
  | "Urban life"
  | "Other sounds";
export const categories: Category[] = [
  "Birds",
  "Water",
  "Wind & leaves",
  "People",
  "Urban life",
  "Other sounds",
];
export function categoryOf(label: string): Category {
  if (/bird|chirp|tweet|caw|coo|owl|crow|pigeon|fowl|duck|goose/i.test(label))
    return "Birds";
  if (/water|rain|stream|ocean|wave|splash|drip|gurgle/i.test(label))
    return "Water";
  if (/wind|rustl|leaves/i.test(label)) return "Wind & leaves";
  if (/speech|conversation|laugh|chatter|child|shout|whisper/i.test(label))
    return "People";
  if (
    /traffic|vehicle|car|engine|motor|train|bus|truck|horn|siren|aircraft/i.test(
      label,
    )
  )
    return "Urban life";
  return "Other sounds";
}
export function credibleDetections(results: Detection[]): Detection[] {
  return results
    .filter(
      (r) =>
        typeof r.label === "string" &&
        Number.isFinite(r.score) &&
        r.score >= 0.15 &&
        r.score <= 1,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}
const missions: Record<Category, { title: string; body: string }> = {
  Birds: {
    title: "Find the space between songs",
    body: "Stay still for one minute. Notice a call, then the quiet after it. Can you hear a second rhythm? Observe from a distance; never approach or play calls to wildlife.",
  },
  Water: {
    title: "Listen to the layers",
    body: "From your safe, dry spot, listen for one minute. Separate the steady wash from individual drops or splashes. No need to move closer to water.",
  },
  "Wind & leaves": {
    title: "Catch an invisible rhythm",
    body: "Stay in a safe open spot for one minute. Notice how rustling rises and falls. Does the sound change before you feel the breeze?",
  },
  People: {
    title: "Hear beyond the foreground",
    body: "Pause for one minute. Let voices blend into the background and notice a quieter non-human sound. Respect others’ privacy; do not record conversations.",
  },
  "Urban life": {
    title: "Find a pocket of quiet",
    body: "Remain safely away from roads. Listen for one minute to the gaps between mechanical sounds. What natural sound appears in those gaps?",
  },
  "Other sounds": {
    title: "Make a tiny sound map",
    body: "Stay in one safe place for one minute. Notice a near sound, a far sound, and a sound that comes and goes. Describe them without needing to name them.",
  },
};
export function missionFor(category: Category) {
  return missions[category];
}
export type Entry = {
  id: string;
  date: string;
  category: Category;
  source: "model" | "manual";
  title: string;
  reflection: string;
};
export const STORAGE_KEY = "soundsafari.journal.v1";
export function readJournal(storage: Pick<Storage, "getItem">): Entry[] {
  try {
    const data: unknown = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data)
      ? data
          .filter(
            (e): e is Entry =>
              !!e &&
              typeof e === "object" &&
              typeof e.id === "string" &&
              typeof e.date === "string" &&
              categories.includes(e.category) &&
              ["manual", "model"].includes(e.source) &&
              typeof e.title === "string" &&
              typeof e.reflection === "string",
          )
          .slice(0, 50)
      : [];
  } catch {
    return [];
  }
}
