import React, { useState, useMemo } from "react";

// ---------------------------------------------------------------------------
// Let's Do Durham - Triangle-area entertainment discovery, ranked to taste.
// Live web search + ranking via Anthropic API.
// Feed + Map views, pin clustering, distance filter, save-to-calendar.
// ---------------------------------------------------------------------------

const DEFAULT_PROFILE = {
  priorities: [
    "Indie rock, Americana, folk, and local bands",
    "Standup comedy",
    "Improv or sketch comedy, especially Mettlesome",
    "Other music or bands",
    "Anything fun or out of the ordinary",
  ],
  music:
    "2000s & modern indie (Big Thief, MJ Lenderman, Wednesday), indie folk-rock, classic rock, punk/post-punk, metal, blues-rock. Faves: Butch Walker, The Glorious Sons, The Trews, Badflower, Art's Fishing Club, Fantastic Cat, Anthony Gomes. Loves tiny dive venues under ~100 cap. Discovery of unknown local/opener acts is the point.",
  comedy:
    "Comedy nerd, improv student at Mettlesome. Absurdist, dark/edgy standup. Faves: Big Jay Oakerson, Phil Hanley, Des Bishop, Anthony Jeselnik, Michael Che, Kathleen Madigan. Loves long-form & musical improv, open mics.",
  other:
    "Indie/arthouse films, trivia, bar games/arcades, pop-ups, supper clubs, secret shows. Out-of-the-ordinary experiences.",
  passes:
    "Stadium/arena shows, EDM, mainstream/pop country, 21+ club vibes, cruise-ship entertainment, formulaic Hollywood art.",
  budget: "$15-30 ticket sweet spot. Goes solo. Low-key sit-and-listen nights. Will drive ~30 miles.",
  venues:
    "The Pinhook, Motorco, Cat's Cradle + Back Room (Carrboro), Local 506, Mettlesome (Golden Belt, 800 Taylor St), Goodnights, Raleigh Improv, ComedyWorx, Kings, The Pour House, Rubies on Five Points, Stanczyk's (West Main, Durham), Haw River Ballroom, Sharp 9 Gallery, Speakeasy Carrboro.",
  sources:
    "discoverdurham.com/events, thetriangleweekender.com/things-to-do, goodnightscomedy.com/events, catscradle.com, thepinhook.com, motorcomusic.com, thisismettlesome.com/live.",
};

const VENUE_GEO = {
  "the pinhook": { lat: 35.9956, lng: -78.9036 },
  pinhook: { lat: 35.9956, lng: -78.9036 },
  motorco: { lat: 36.0046, lng: -78.8939 },
  "cat's cradle": { lat: 35.9132, lng: -79.0742 },
  "cats cradle": { lat: 35.9132, lng: -79.0742 },
  "back room": { lat: 35.9132, lng: -79.0742 },
  "local 506": { lat: 35.9114, lng: -79.0589 },
  mettlesome: { lat: 36.0089, lng: -78.8856 },
  goodnights: { lat: 35.7902, lng: -78.6647 },
  "raleigh improv": { lat: 35.8385, lng: -78.7039 },
  comedyworx: { lat: 35.8324, lng: -78.6411 },
  kings: { lat: 35.7782, lng: -78.6385 },
  "pour house": { lat: 35.7776, lng: -78.6371 },
  rubies: { lat: 35.9931, lng: -78.9 },
  "stanczyk's": { lat: 35.9962, lng: -78.9075 },
  stanczyks: { lat: 35.9962, lng: -78.9075 },
  "haw river": { lat: 35.8949, lng: -79.0967 },
  "sharp 9": { lat: 35.9967, lng: -78.9 },
  speakeasy: { lat: 35.9101, lng: -79.0758 },
};

// Home reference point: downtown Durham.
const HOME = { lat: 35.9940, lng: -78.8986, label: "Downtown Durham" };

function geoFor(venue) {
  if (!venue) return null;
  const v = venue.toLowerCase();
  for (const key of Object.keys(VENUE_GEO)) {
    if (v.includes(key)) return VENUE_GEO[key];
  }
  return null;
}

// Haversine distance in miles.
function milesBetween(a, b) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const TIMEFRAMES = [
  { id: "tonight", label: "Tonight" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "weekend", label: "This Weekend" },
  { id: "week", label: "This Week" },
];

const CATEGORIES = [
  { id: "all", label: "Everything" },
  { id: "music", label: "Live Music" },
  { id: "standup", label: "Standup" },
  { id: "improv", label: "Improv / Sketch" },
  { id: "other", label: "Out of the Ordinary" },
];

function fmtDate(d) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function buildPrompt(profile, timeframe, category, today) {
  const tfLabel = TIMEFRAMES.find((t) => t.id === timeframe)?.label || timeframe;
  const catLabel = CATEGORIES.find((c) => c.id === category)?.label || category;
  return `You are a Triangle-area (Durham/Raleigh/Chapel Hill/Carrboro) live-entertainment scout for one specific person. Today is ${today}. Find real events for: ${tfLabel}. Category filter: ${catLabel}.

THE PERSON'S PROFILE - rank everything against this:
Priority order (highest first): ${profile.priorities.join(" > ")}
Music taste: ${profile.music}
Comedy taste: ${profile.comedy}
Other interests: ${profile.other}
HARD PASSES (never recommend): ${profile.passes}
Logistics: ${profile.budget}
Venues they follow: ${profile.venues}
Trusted sources to search: ${profile.sources}

INSTRUCTIONS:
- Use web search to find ACTUAL events with real dates matching the timeframe. Search the trusted sources and venue names + the date.
- Blues-rock ranks closer to their taste than indie-pop. Discovery (unknown openers, under-the-radar local acts) is a FEATURE.
- Flag any event whose info came from an aggregator (Bandsintown/Songkick/JamBase) as needing direct verification.
- Never invent events. If unsure of a date/detail, say so in the note.
- Rank best matches first. For "startISO" give an ISO 8601 local datetime if you can infer it (e.g. 2026-06-07T20:00), else "".

Respond with ONLY a JSON array (no markdown, no preamble), each item:
{"title": str, "venue": str, "city": str, "date": str, "time": str, "startISO": str, "category": "music"|"standup"|"improv"|"other", "price": str, "score": 1-100, "why": str (one sentence), "verify": bool}
Return 5-10 items. If nothing fits, return [].`;
}

const CAT_COLOR = { music: "#e8633a", standup: "#d4a017", improv: "#5b8c5a", other: "#7d6bb0" };

function toICSDate(iso) {
  if (!iso) return null;
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}00`;
}
function plusTwoHours(stamp) {
  if (!stamp) return null;
  const y = stamp.slice(0, 4), mo = stamp.slice(4, 6), d = stamp.slice(6, 8);
  let h = parseInt(stamp.slice(9, 11), 10) + 2;
  const mi = stamp.slice(11, 13);
  let day = parseInt(d, 10);
  if (h >= 24) { h -= 24; day += 1; }
  return `${y}${mo}${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}${mi}00`;
}
function downloadICS(ev) {
  const start = toICSDate(ev.startISO);
  const desc = `${ev.why || ""}${ev.price ? " - " + ev.price : ""}`.replace(/\n/g, " ");
  const loc = `${ev.venue}${ev.city ? ", " + ev.city : ""}`;
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LetsDoDurham//EN", "BEGIN:VEVENT",
    `UID:${Date.now()}@letsdodurham`,
    start ? `DTSTART:${start}` : "",
    start ? `DTEND:${plusTwoHours(start)}` : "",
    `SUMMARY:${ev.title} @ ${ev.venue}`,
    `LOCATION:${loc}`,
    `DESCRIPTION:${desc}`,
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean);
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ev.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
function gcalLink(ev) {
  const start = toICSDate(ev.startISO);
  const dates = start ? `&dates=${start}/${plusTwoHours(start)}` : "";
  const text = encodeURIComponent(`${ev.title} @ ${ev.venue}`);
  const loc = encodeURIComponent(`${ev.venue}${ev.city ? ", " + ev.city : ""}`);
  const det = encodeURIComponent(ev.why || "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}${dates}&location=${loc}&details=${det}`;
}

const BOX = { minLat: 35.77, maxLat: 36.02, minLng: -79.11, maxLng: -78.63 };
function project(lat, lng, w, h, pad = 28) {
  const x = pad + ((lng - BOX.minLng) / (BOX.maxLng - BOX.minLng)) * (w - pad * 2);
  const y = pad + ((BOX.maxLat - lat) / (BOX.maxLat - BOX.minLat)) * (h - pad * 2);
  return { x, y };
}

export default function App() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [timeframe, setTimeframe] = useState("tonight");
  const [category, setCategory] = useState("all");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [view, setView] = useState("feed");
  const [activeCluster, setActiveCluster] = useState(null);
  const [maxMiles, setMaxMiles] = useState(30);
  const today = fmtDate(new Date());

  async function findShows() {
    setLoading(true);
    setError("");
    setEvents([]);
    setActiveCluster(null);
    try {
       const res = await fetch("/nf-functions/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildPrompt(profile, timeframe, category, today),
        }),
      });
      const data = await res.json();
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const clean = text.replace(/```json|```/g, "").trim();
      const start = clean.indexOf("[");
      const end = clean.lastIndexOf("]");
      const json = start !== -1 && end !== -1 ? clean.slice(start, end + 1) : clean;
      const parsed = JSON.parse(json);
      setEvents(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      setError("Couldn't pull the listings cleanly - the search may have come back messy. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Attach geo + distance to each event; keep original rank index.
  const enriched = useMemo(() => {
    return events.map((ev, i) => {
      const geo = geoFor(ev.venue);
      const dist = geo ? milesBetween(HOME, geo) : null;
      return { ev, i, geo, dist };
    });
  }, [events]);

  // Distance filter: keep events with no known geo (can't measure) OR within range.
  const visible = useMemo(
    () => enriched.filter((e) => e.dist === null || e.dist <= maxMiles),
    [enriched, maxMiles]
  );

  // Cluster visible-and-mapped events by venue coordinates.
  const clusters = useMemo(() => {
    const map = {};
    visible.forEach((e) => {
      if (!e.geo) return;
      const key = `${e.geo.lat.toFixed(4)},${e.geo.lng.toFixed(4)}`;
      if (!map[key]) map[key] = { geo: e.geo, items: [], dist: e.dist };
      map[key].items.push(e);
    });
    return Object.values(map);
  }, [visible]);

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      <header style={S.header}>
        <div style={S.kicker}>{today.toUpperCase()} - THE TRIANGLE</div>
        <h1 style={S.title}>LET'S DO<br /><span style={S.titleAccent}>DURHAM</span></h1>
        <p style={S.sub}>Tiny rooms. Local openers. Dark comedy. Ranked to your taste.</p>
      </header>

      <div style={S.controls}>
        <div style={S.row}>
          {TIMEFRAMES.map((t) => (
            <button key={t.id} onClick={() => setTimeframe(t.id)} style={{ ...S.chip, ...(timeframe === t.id ? S.chipOn : {}) }}>{t.label}</button>
          ))}
        </div>
        <div style={S.row}>
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setCategory(c.id)} style={{ ...S.chipSm, ...(category === c.id ? S.chipSmOn : {}) }}>{c.label}</button>
          ))}
        </div>
        <button onClick={findShows} disabled={loading} style={S.cta}>{loading ? "SCOUTING THE TRIANGLE..." : "FIND MY SHOWS \u2192"}</button>
        <button onClick={() => setShowProfile((s) => !s)} style={S.profileToggle}>{showProfile ? "\u2715 Close taste profile" : "\u2699 Tweak my taste profile"}</button>
      </div>

      {showProfile && (
        <div style={S.profileBox}>
          {[["music", "Music taste"], ["comedy", "Comedy taste"], ["other", "Other interests"], ["passes", "Hard passes"], ["budget", "Logistics & budget"], ["venues", "Venues to follow"]].map(([key, label]) => (
            <label key={key} style={S.field}>
              <span style={S.fieldLabel}>{label}</span>
              <textarea value={profile[key]} rows={2} style={S.textarea} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} />
            </label>
          ))}
        </div>
      )}

      {error && <div style={S.error}>{error}</div>}

      {events.length > 0 && (
        <>
          <div style={S.distBox}>
            <div style={S.distHead}>
              <span style={S.fieldLabel}>Within {maxMiles} mi of {HOME.label}</span>
              <span style={S.distCount}>{visible.length} of {events.length} shows</span>
            </div>
            <input type="range" min="2" max="40" value={maxMiles} onChange={(e) => setMaxMiles(Number(e.target.value))} style={S.slider} />
          </div>

          <div style={S.viewToggle}>
            <button onClick={() => setView("feed")} style={{ ...S.viewBtn, ...(view === "feed" ? S.viewBtnOn : {}) }}>{"\u2630 Feed"}</button>
            <button onClick={() => setView("map")} style={{ ...S.viewBtn, ...(view === "map" ? S.viewBtnOn : {}) }}>{"\u25C9 Map"}</button>
          </div>
        </>
      )}

      {view === "feed" && (
        <div style={S.feed}>
          {visible.map(({ ev, i, dist }) => (
            <article key={i} style={S.card} className="ldd-card">
              <div style={S.cardRank}>#{i + 1}</div>
              <div style={S.cardBody}>
                <div style={S.cardMeta}>
                  <span style={{ ...S.tag, background: CAT_COLOR[ev.category] || "#777" }}>{ev.category}</span>
                  <span style={S.score}>{ev.score}<span style={S.scoreMax}>/100</span></span>
                </div>
                <h2 style={S.cardTitle}>{ev.title}</h2>
                <div style={S.cardVenue}>{ev.venue} - {ev.city}{dist !== null ? ` - ${dist.toFixed(1)} mi` : ""}</div>
                <div style={S.cardWhen}>{ev.date}{ev.time ? ` - ${ev.time}` : ""}{ev.price ? ` - ${ev.price}` : ""}</div>
                <p style={S.cardWhy}>{ev.why}</p>
                {ev.verify && <div style={S.verify}>{"\u26A0 Aggregator-sourced - verify on the venue's own calendar"}</div>}
                <div style={S.calRow}>
                  <a href={gcalLink(ev)} target="_blank" rel="noreferrer" style={S.calBtn}>+ Google Calendar</a>
                  <button onClick={() => downloadICS(ev)} style={S.calBtnAlt}>{"\u2193 .ics file"}</button>
                </div>
              </div>
            </article>
          ))}
          {!loading && events.length === 0 && !error && (
            <div style={S.empty}>Pick a timeframe and hit <b>Find My Shows</b> to scout the Triangle.</div>
          )}
          {!loading && events.length > 0 && visible.length === 0 && (
            <div style={S.empty}>Nothing within {maxMiles} mi. Drag the slider wider.</div>
          )}
        </div>
      )}

      {view === "map" && (
        <div style={S.mapWrap}>
          <svg viewBox="0 0 660 420" className="ldd-map">
            <defs>
              <pattern id="grid" width="33" height="33" patternUnits="userSpaceOnUse">
                <path d="M33 0H0V33" fill="none" stroke="#2a251f" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="660" height="420" fill="#161310" />
            <rect width="660" height="420" fill="url(#grid)" />
            {[["DURHAM", 35.996, -78.9], ["CHAPEL HILL", 35.911, -79.055], ["CARRBORO", 35.913, -79.075], ["RALEIGH", 35.79, -78.64]].map(([name, la, lo], k) => {
              const p = project(la, lo, 660, 420);
              return <text key={k} x={p.x} y={p.y - 18} fill="#4a443c" fontSize="11" fontFamily="Anton, sans-serif" textAnchor="middle" letterSpacing="2">{name}</text>;
            })}
            {/* home marker */}
            {(() => {
              const hp = project(HOME.lat, HOME.lng, 660, 420);
              return <g><circle cx={hp.x} cy={hp.y} r="6" fill="none" stroke="#f5efe6" strokeWidth="2" /><circle cx={hp.x} cy={hp.y} r="2" fill="#f5efe6" /></g>;
            })()}
            {clusters.map((cl, k) => {
              const p = project(cl.geo.lat, cl.geo.lng, 660, 420);
              const multi = cl.items.length > 1;
              const topCat = cl.items[0].ev.category;
              const active = activeCluster === k;
              return (
                <g key={k} style={{ cursor: "pointer" }} onClick={() => setActiveCluster(active ? null : k)}>
                  <circle cx={p.x} cy={p.y} r={active ? 15 : multi ? 13 : 9} fill={CAT_COLOR[topCat] || "#777"} stroke="#161310" strokeWidth="2" />
                  <text x={p.x} y={p.y + 4} fill="#161310" fontSize={multi ? "11" : "10"} fontWeight="700" textAnchor="middle">{multi ? cl.items.length : cl.items[0].i + 1}</text>
                </g>
              );
            })}
          </svg>

          {activeCluster !== null && clusters[activeCluster] && (
            <div style={S.pinCard}>
              {clusters[activeCluster].items.length > 1 && (
                <div style={S.clusterHead}>{clusters[activeCluster].items.length} shows at this venue{clusters[activeCluster].dist !== null ? ` - ${clusters[activeCluster].dist.toFixed(1)} mi` : ""}</div>
              )}
              {clusters[activeCluster].items.map(({ ev, i }) => (
                <div key={i} style={S.clusterItem}>
                  <div style={S.cardMeta}>
                    <span style={{ ...S.tag, background: CAT_COLOR[ev.category] || "#777" }}>{ev.category}</span>
                    <span style={S.score}>{ev.score}<span style={S.scoreMax}>/100</span></span>
                  </div>
                  <h2 style={S.cardTitle}>{ev.title}</h2>
                  <div style={S.cardVenue}>{ev.venue} - {ev.city}</div>
                  <div style={S.cardWhen}>{ev.date}{ev.time ? ` - ${ev.time}` : ""}</div>
                  <p style={S.cardWhy}>{ev.why}</p>
                  <div style={S.calRow}>
                    <a href={gcalLink(ev)} target="_blank" rel="noreferrer" style={S.calBtn}>+ Google Calendar</a>
                    <button onClick={() => downloadICS(ev)} style={S.calBtnAlt}>{"\u2193 .ics"}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {clusters.length === 0 && (
            <div style={S.empty}>No mapped venues within {maxMiles} mi. Widen the slider or check the feed.</div>
          )}
          <div style={S.mapHint}>Numbered = single show (rank). Bubbled number = count of shows at one venue. Tap to expand. The hollow ring is {HOME.label}.</div>
        </div>
      )}

      <footer style={S.footer}>Live results via web search. Aggregator data flagged for direct verification.</footer>
    </div>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;600;700&display=swap');
  .ldd-card { transition: transform .18s ease, box-shadow .18s ease; }
  .ldd-card:hover { transform: translateY(-3px); box-shadow: 0 14px 0 -6px #e8633a, 0 22px 40px rgba(0,0,0,.5); }
  .ldd-map { width: 100%; height: auto; border: 1px solid #3a3530; border-radius: 4px; }
  textarea:focus { outline: 2px solid #e8633a; }
  input[type=range] { accent-color: #e8633a; }
`;

const S = {
  root: { minHeight: "100%", background: "#161310", backgroundImage: "radial-gradient(circle at 15% 10%, rgba(232,99,58,.10), transparent 40%), radial-gradient(circle at 85% 90%, rgba(125,107,176,.10), transparent 40%)", color: "#f5efe6", fontFamily: "'Archivo', sans-serif", padding: "28px 20px 48px", maxWidth: 720, margin: "0 auto" },
  header: { borderBottom: "3px solid #e8633a", paddingBottom: 18, marginBottom: 22 },
  kicker: { fontSize: 11, letterSpacing: 3, color: "#d4a017", fontWeight: 700 },
  title: { fontFamily: "'Anton', sans-serif", fontSize: "clamp(52px, 14vw, 92px)", lineHeight: 0.86, margin: "10px 0 0", letterSpacing: -1, textTransform: "uppercase" },
  titleAccent: { color: "#e8633a" },
  sub: { color: "#a89f92", marginTop: 14, fontSize: 15, maxWidth: 440 },
  controls: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 },
  row: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: { background: "transparent", color: "#f5efe6", border: "2px solid #3a3530", padding: "9px 16px", borderRadius: 2, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Archivo', sans-serif" },
  chipOn: { background: "#e8633a", borderColor: "#e8633a", color: "#161310" },
  chipSm: { background: "transparent", color: "#a89f92", border: "1px solid #3a3530", padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "'Archivo', sans-serif", fontWeight: 600 },
  chipSmOn: { background: "#d4a017", borderColor: "#d4a017", color: "#161310" },
  cta: { background: "#f5efe6", color: "#161310", border: "none", padding: "16px", fontFamily: "'Anton', sans-serif", fontSize: 20, letterSpacing: 1, cursor: "pointer", borderRadius: 2, marginTop: 4, textTransform: "uppercase" },
  profileToggle: { background: "none", border: "none", color: "#a89f92", fontSize: 13, cursor: "pointer", textDecoration: "underline", fontFamily: "'Archivo', sans-serif", alignSelf: "flex-start", padding: 0 },
  profileBox: { background: "#1f1b17", border: "1px solid #3a3530", borderRadius: 4, padding: 16, marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontSize: 11, letterSpacing: 2, color: "#d4a017", fontWeight: 700, textTransform: "uppercase" },
  textarea: { background: "#161310", color: "#f5efe6", border: "1px solid #3a3530", borderRadius: 3, padding: 10, fontSize: 13, fontFamily: "'Archivo', sans-serif", resize: "vertical" },
  error: { background: "#3a1d18", border: "1px solid #e8633a", color: "#f3b8a6", padding: 14, borderRadius: 4, marginBottom: 18, fontSize: 14 },
  distBox: { background: "#1f1b17", border: "1px solid #3a3530", borderRadius: 4, padding: "12px 16px", marginBottom: 14 },
  distHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  distCount: { fontSize: 12, color: "#a89f92" },
  slider: { width: "100%" },
  viewToggle: { display: "flex", gap: 6, marginBottom: 16 },
  viewBtn: { flex: 1, background: "#1f1b17", color: "#a89f92", border: "1px solid #3a3530", padding: "10px", borderRadius: 3, cursor: "pointer", fontWeight: 700, fontFamily: "'Archivo', sans-serif", fontSize: 14 },
  viewBtnOn: { background: "#e8633a", color: "#161310", borderColor: "#e8633a" },
  feed: { display: "flex", flexDirection: "column", gap: 16 },
  card: { display: "flex", background: "#1f1b17", border: "1px solid #3a3530", borderRadius: 4, overflow: "hidden" },
  cardRank: { fontFamily: "'Anton', sans-serif", fontSize: 26, color: "#161310", background: "#e8633a", padding: "14px 14px", minWidth: 54, textAlign: "center", display: "flex", alignItems: "flex-start", justifyContent: "center" },
  cardBody: { padding: "14px 16px", flex: 1 },
  cardMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  tag: { color: "#161310", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 1 },
  score: { fontFamily: "'Anton', sans-serif", fontSize: 22, color: "#d4a017" },
  scoreMax: { fontSize: 12, color: "#6b6358" },
  cardTitle: { fontFamily: "'Anton', sans-serif", fontSize: 23, margin: "0 0 4px", lineHeight: 1, textTransform: "uppercase" },
  cardVenue: { color: "#f5efe6", fontWeight: 600, fontSize: 14 },
  cardWhen: { color: "#a89f92", fontSize: 13, marginTop: 2 },
  cardWhy: { color: "#cfc6b8", fontSize: 14, marginTop: 10, lineHeight: 1.45, fontStyle: "italic" },
  verify: { marginTop: 10, color: "#d4a017", fontSize: 12, fontWeight: 600 },
  calRow: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" },
  calBtn: { background: "#5b8c5a", color: "#161310", textDecoration: "none", padding: "7px 12px", borderRadius: 3, fontSize: 12, fontWeight: 700 },
  calBtnAlt: { background: "transparent", color: "#a89f92", border: "1px solid #3a3530", padding: "7px 12px", borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Archivo', sans-serif" },
  mapWrap: { position: "relative" },
  pinCard: { background: "#1f1b17", border: "1px solid #e8633a", borderRadius: 4, padding: "14px 16px", marginTop: 14 },
  clusterHead: { fontFamily: "'Anton', sans-serif", fontSize: 15, color: "#e8633a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #3a3530" },
  clusterItem: { paddingBottom: 14, marginBottom: 14, borderBottom: "1px solid #2a251f" },
  mapHint: { color: "#6b6358", fontSize: 12, textAlign: "center", marginTop: 10, lineHeight: 1.5 },
  empty: { color: "#6b6358", textAlign: "center", padding: "50px 20px", fontSize: 15 },
  footer: { marginTop: 36, paddingTop: 16, borderTop: "1px solid #3a3530", color: "#6b6358", fontSize: 12, textAlign: "center" },
};
