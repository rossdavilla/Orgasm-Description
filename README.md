# Describing Orgasm — a classroom replication

A small static website that replicates **Vance, E. B., & Wagner, N. N. (1976).
Written descriptions of orgasm: A study of sex differences.** *Archives of Sexual
Behavior, 5*(1), 87–98. <https://doi.org/10.1007/BF01542242>

Students anonymously describe what an orgasm feels like (without naming any
anatomy) and report which genitals they have. Other students then read random
descriptions and try to guess the writer's anatomy — and discover, as the original
study found, that it's very hard to tell.

## What's in here

| File | What it is |
|------|------------|
| `index.html` | The study description / landing page |
| `submit.html` | Anonymous submission form |
| `play.html` | The 5-round guessing game + scorecard |
| `results.html` | Class-results dashboard (aggregate accuracy vs chance) |
| `styles.css` | Shared styling (light + dark) |
| `config.js` | **The one file you edit** — holds the backend URL and options |
| `Code.gs` | The Google Apps Script backend (paste into Apps Script) |

## How the backend works

There is no server to run. A **Google Sheet** stores the data, and a **Google Apps
Script Web App** bound to that sheet acts as a tiny API. The layout:

- **First tab** (your existing tab) — submissions, two columns:
  **`A: Description`**, **`B: Genitals`** (one row per submission).
- **`Guesses`** tab — `timestamp | gameId | actual | guess | correct`, created
  automatically to feed the results dashboard.

The endpoints:

- Submit page **POSTs** `{ action:"submitResponse", description, genitals }` → appends a row.
- Play page **GETs** `?action=random&n=5` → random rows, **filtered to penis/vulva only**.
- Play page **POSTs** `{ action:"recordGame", gameId, guesses:[…] }` at the end of a game.
- Results page **GETs** `?action=stats` → aggregate accuracy, computed in the script.

**The two-way rule:** the game only draws and scores descriptions whose author
reported *penis* or *vulva*. Anyone may still submit *intersex / other* — those rows
are stored in `Responses` but never shown in the game or counted in the stats. This
keeps the guess a clean two-way choice, matching the original study. The eligible set
lives in `ELIGIBLE` in `Code.gs` and `GUESS_OPTIONS` in `config.js` (keep them in sync).

To moderate, just delete a row in `Responses` and it vanishes from the game.

## Setup (about 10 minutes)

### 1. Make the Sheet + script
1. Create a new Google Sheet (any name).
2. In the Sheet: **Extensions ▸ Apps Script**.
3. Delete whatever is in `Code.gs`, then paste the contents of this repo's
   [`Code.gs`](Code.gs). Click **Save**.

### 2. Deploy it as a Web App
1. In Apps Script: **Deploy ▸ New deployment**.
2. Click the gear ▸ **Web app**.
3. Set:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
4. Click **Deploy**, authorize the permissions it asks for, and **copy the Web app
   URL** (it ends in `/exec`).

> The `Anyone` setting is what lets a browser call it without a Google login. It
> only exposes the two actions above — read random rows, add a row.

### 3. Point the site at it
Open [`config.js`](config.js) and paste your URL:

```js
WEB_APP_URL: "https://script.google.com/macros/s/AKfy..../exec",
```

### 4. Host the pages
The site is plain static files — host them anywhere:

- **GitHub Pages:** push this folder to a repo, enable Pages on the branch.
- **Netlify / Vercel:** drag-and-drop the folder.
- **Locally to test:** run a static server from this folder, e.g.
  `python3 -m http.server 8000`, then open <http://localhost:8000>.
  (Opening the HTML files directly with `file://` also works for the form and game.)

That's it. Visit the site, submit a few descriptions, and play.

## Customizing

Everything tweakable lives in `config.js`:

- `ROUNDS` — how many descriptions per game (default 5).
- `MIN/MAX_DESCRIPTION_LENGTH` — submission length limits.
- `GENITALS` — the anatomy options shown on the **submit form**.
- `GUESS_OPTIONS` — the anatomy options used in the **game** (default penis / vulva).
  The game only draws/scores descriptions matching these, and chance level is computed
  from how many there are (two options → 50%). If you change this, also update
  `ELIGIBLE` in `Code.gs` to match.
- `GENITAL_HINT_WORDS` — words that trigger the gentle "you may have named anatomy"
  nudge on the submit page.

## Notes on data & ethics

- **No identifying data is collected** — no names, emails, or logins. The server
  never returns the timestamp to the browser.
- Descriptions are **shown to other students**, so treat this as a classroom
  demonstration. For actual research use, obtain proper consent and any required
  ethics/IRB approval first.
- Because descriptions auto-publish immediately, skim the Sheet now and then and
  delete anything inappropriate — that row leaves the game instantly.

## Redeploying after changes

If you edit `Code.gs`, you must publish a new version: **Deploy ▸ Manage
deployments ▸ (edit, pencil icon) ▸ Version: New version ▸ Deploy**. The `/exec`
URL stays the same, so you don't need to touch `config.js` again.
