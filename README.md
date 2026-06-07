# Let's Do Durham

A Triangle-area live-entertainment finder that ranks shows against your taste
profile using live web search. Feed + map views, pin clustering, a distance
filter, and one-tap save-to-calendar.

It calls the Anthropic API through a Netlify serverless function, so your API
key stays on the server and never ships to the browser.

---

## What you need first

1. **Node.js** installed (v18 or newer). Check with `node -v`. If you don't
   have it, get it from nodejs.org.
2. **An Anthropic API key.** Create one at console.anthropic.com -> API Keys.
   (This is separate from your Claude.ai subscription; API usage is billed by
   token. The searches this app runs are small.)
3. **A Netlify account** (you have one) and a **GitHub account** (easiest path).

---

## Option A — Run it on your own computer first (recommended sanity check)

1. Open a terminal in this project folder.
2. Install dependencies:
       npm install
3. Create a file named `.env` in the project root with your key:
       ANTHROPIC_API_KEY=sk-ant-your-key-here
4. Install the Netlify CLI (one time) and run the dev server, which runs the
   function and the site together:
       npm install -g netlify-cli
       netlify dev
5. It opens at http://localhost:8888 . Click "Find My Shows."

(Plain `npm run dev` runs the site but NOT the serverless function, so the
search won't work that way. Use `netlify dev`.)

---

## Option B — Deploy live on Netlify

### Step 1 — Put the code on GitHub
1. Create a new empty repository on github.com (e.g. "lets-do-durham").
2. In a terminal in this folder:
       git init
       git add .
       git commit -m "initial commit"
       git branch -M main
       git remote add origin https://github.com/YOUR-USERNAME/lets-do-durham.git
       git push -u origin main

### Step 2 — Connect Netlify to the repo
1. In Netlify, click **Add new site -> Import an existing project**.
2. Choose **GitHub**, authorize, and pick your `lets-do-durham` repo.
3. Netlify reads `netlify.toml` automatically, so the build settings
   (build command `npm run build`, publish dir `dist`, functions dir
   `netlify/functions`) are already filled in. Just click **Deploy**.

### Step 3 — Add your API key as an environment variable
1. In your new site's dashboard: **Site configuration -> Environment variables**.
2. Click **Add a variable** -> **Add a single variable**.
   - Key:   `ANTHROPIC_API_KEY`
   - Value: your `sk-ant-...` key
   - Scope: leave as all / production.
3. Save, then go to **Deploys -> Trigger deploy -> Deploy site** so the
   function picks up the new variable.

### Step 4 — Use it
Open your site's URL (something like `your-site-name.netlify.app`). Bookmark it
on your phone's home screen and you've got a real web app.

---

## How it works

- `src/App.jsx` — the whole UI. Your taste profile is the default; the gear
  button lets you tweak it per session.
- `netlify/functions/scout.js` — receives the prompt, attaches your key
  server-side, calls Anthropic with web search on, returns the result.
- The app asks the model to return strict JSON, parses it, ranks by fit,
  filters by distance from downtown Durham, and clusters map pins by venue.

## Notes & honest limits

- **Results vary run to run** — it's a live search + model ranking. Always
  verify a show on the venue's own page before you drive out. Aggregator-
  sourced items are flagged for exactly this reason.
- **The map is a schematic**, not a street map — it places known venues by
  coordinate on a stylized grid. Distances are straight-line ("as the crow
  flies"), so real drive time is a bit longer.
- **Edit your venue list / coordinates** in `src/App.jsx` (the `VENUE_GEO` and
  `DEFAULT_PROFILE` objects near the top) any time you find a new spot.
- **API cost** — each "Find My Shows" is one API call with web search. Keep an
  eye on usage in the Anthropic console; set a spend limit there if you want.

## Changing your home point

In `src/App.jsx`, edit the `HOME` constant (lat/lng/label) to set where the
distance slider measures from. It defaults to downtown Durham.
