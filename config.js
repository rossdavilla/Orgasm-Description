/* ============================================================
   CONFIGURE ME
   1. Deploy the Google Apps Script (Code.gs) as a Web App.
   2. Paste its /exec URL below, between the quotes.
   See README.md for the full walkthrough.
   ============================================================ */

const CONFIG = {
  // e.g. "https://script.google.com/macros/s/AKfy..../exec"
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycbydzbcC4LwzTUS607_mKX7R_fF4HP1EdPrMvrKko7X79zHQyoqcwecTs7uOCpLgnfo2/exec",

  ROUNDS: 5,                  // descriptions shown per game
  MIN_DESCRIPTION_LENGTH: 20, // characters
  MAX_DESCRIPTION_LENGTH: 2000,

  // 4-digit code students must enter on the Play page before the guessing
  // game starts. Lets the instructor pace when the class moves on. This is a
  // soft gate for pacing, not a secret (it's visible in the page source).
  // Set to "" to disable the gate entirely.
  ACCESS_CODE: "5720",

  // Options a participant may report about themselves on the submit form.
  GENITALS: [
    { value: "penis", label: "Penis" },
    { value: "vulva", label: "Vulva" },
    { value: "intersex_other", label: "Intersex / other" },
  ],

  // Options a player guesses among in the game. The game only draws and scores
  // descriptions whose author reported one of these, so it stays a clean
  // two-way choice (matching the original study). "Intersex / other"
  // submissions are still collected but never shown in the game.
  GUESS_OPTIONS: [
    { value: "penis", label: "Penis" },
    { value: "vulva", label: "Vulva" },
  ],
};

/* Words that suggest a genital / anatomy reference. Used ONLY for a gentle
   client-side warning on the submit page — never a hard block. The study's
   whole method depends on descriptions that don't give the anatomy away. */
const GENITAL_HINT_WORDS = [
  "penis", "penile", "vagina", "vaginal", "vulva", "vulval", "clitoris", "clitoral",
  "clit", "cock", "dick", "phallus", "shaft", "glans", "foreskin",
  "testicle", "testicular", "balls", "scrotum", "prostate",
  "pussy", "cunt", "labia", "cervix", "cervical", "g-spot", "gspot",
  "erection", "erect", "boner", "hard-on", "ejaculate", "ejaculation",
  "semen", "cum", "sperm", "penetrate", "penetration",
];

/* The set of anatomy values eligible for the game (derived from GUESS_OPTIONS). */
const ELIGIBLE_GENITALS = CONFIG.GUESS_OPTIONS.map((g) => g.value);

/* Map any stored genitals value to its display label. */
function genitalLabel(value) {
  const match = CONFIG.GENITALS.find((g) => g.value === value);
  return match ? match.label : value;
}

/* True if the Web App URL hasn't been filled in yet. */
function isConfigured() {
  return CONFIG.WEB_APP_URL && CONFIG.WEB_APP_URL.indexOf("PASTE_YOUR") === -1;
}

/* A simple unique id for a game session (no crypto dependency required). */
function makeId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "g-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/* ---------- Shared API helpers ---------- */

/* All POSTs are sent as text/plain on purpose: that counts as a CORS "simple
   request", so the browser skips the preflight OPTIONS call that Google Apps
   Script web apps cannot answer. */
function apiPost(payload) {
  return fetch(CONFIG.WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  }).then((res) => res.json());
}

/* Save a description. */
function apiSubmitResponse(description, genitals) {
  return apiPost({ action: "submitResponse", description: description, genitals: genitals });
}

/* Record a finished game's guesses (feeds the results dashboard). */
function apiRecordGame(gameId, guesses) {
  return apiPost({ action: "recordGame", gameId: gameId, guesses: guesses });
}

/* A unique token to append to GET requests. Google Apps Script caches GET
   responses per-URL, so without this every player is served the SAME cached
   "random" set. A changing value makes each request a cache miss. */
function cacheBuster() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/* Fetch up to n random eligible responses for the guessing game. */
function apiGetRandom(n) {
  const url = CONFIG.WEB_APP_URL + "?action=random&n=" + encodeURIComponent(n) + "&cb=" + cacheBuster();
  return fetch(url, { cache: "no-store" }).then((res) => res.json());
}

/* Fetch aggregate accuracy statistics for the dashboard. */
function apiGetStats() {
  const url = CONFIG.WEB_APP_URL + "?action=stats&cb=" + cacheBuster();
  return fetch(url, { cache: "no-store" }).then((res) => res.json());
}
