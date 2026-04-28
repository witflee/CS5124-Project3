# CS5124 Project 3 — *The Office* Character Importance Dashboard

It's TV Time! An interactive D3.js dashboard for exploring how important
each character is in the US version of *The Office* — across the show as
a whole and within any individual season.

## Live demo
Once GitHub Pages is enabled (instructions below), the dashboard will be
served from:

```
https://<your-github-username>.github.io/CS5124-Project3/
```
Alternatively, this project has also been deployed and hosted via Vercel, and can be accessed here:
```
https://cs-5124-project3-i5aijqrs8-witflees-projects.vercel.app/
```

## Run locally
The page loads `data/The-Office-Lines-V4.csv` via `d3.csv`, so it must be
served over HTTP (not opened as `file://`). From the project root:

```bash
python -m http.server 8000
# then open http://localhost:8000/
```

Any static server works (`npx serve`, VS Code Live Server, etc.).

## Tasks supported (Level 1)
1. **Show overview** — header + stats panel: NBC, 2005–2013, 9 seasons,
   186 episodes, mockumentary sitcom genre, plus a short prose intro to
   the central characters.
2. **Character importance** — overall and per-season — answered by the
   horizontal bar chart with three rank toggles (lines / words / episodes
   appeared) and a season filter.
3. **Per-episode appearances for major characters** — answered by the
   character × episode heatmap, color-encoded by lines spoken in that
   episode.

Optional features included:
- **Wikipedia link** ("[w]") next to each character bar.
- **Show theme** — cream / mustard / dark-brown palette and Bebas Neue
  italic title evoke the show's opening titles and Dunder Mifflin's
  drab office aesthetic.

## Tasks supported (Level 2 — What do characters say?)
Four interconnected text analysis views let you explore what individual
characters tend to say, how their vocabulary changes across seasons, and
identify their most distinctive phrases.

1. **Word frequency cloud** — Top 50 most-used words (stop words removed)
   displayed as a word cloud. Word size represents frequency. Hover for
   exact counts and percentage of character's total dialogue.

2. **Top 20 words ranked list** — Horizontal bar chart showing the 20
   most frequent words, with exact counts and percentage of dialogue.
   Useful for seeing the precise ranking and comparing frequencies.

3. **Most common phrases** — Extracts 2–4 word phrases the character
   repeats (e.g., "that's what she said", "bears, beets..."). Shows
   count and the first episode where each phrase appears.

4. **Word frequency by season** — Grouped bar chart comparing top 8 words
   across all 9 seasons. Visualizes how a character's vocabulary evolves
   (e.g., does Michael talk more about "paper" in early seasons?).

**Controls:**
- **Character selector** — Choose any of the top 25 characters to analyze.
- **View mode** — "Entire show" or "By season" to zoom into a specific season.
- **Season filter** (in phrase view) — Refocus the seasonal bar chart on
  a single season if desired.

**Design choices:**
- **Stop word removal** — A curated list of 160+ common English words
  (the, and, is, etc.) is filtered out so analyses focus on meaningful,
  character-specific vocabulary.
- **Word cloud + ranked list** — The cloud gives an at-a-glance visual
  impression; the ranked list lets you verify precise counts and spot
  small differences in frequency.
- **Phrase extraction** — Detects repeated short phrases (catchphrases)
  by looking for n-grams that appear multiple times. Useful for
  character quirks (e.g., Dwight's "False" or Jim's impressions).
- **Seasonal breakdown** — Grouped bars make it easy to compare whether
  a character's focus changes over time (e.g., Erin's vocabulary before
  and after she joins the show).

## Visualization & interaction choices

### Bar chart (left)
- **Why a horizontal bar chart?** Bar length is the most accurate visual
  channel for ranked quantitative comparison, and horizontal orientation
  gives long character names room to breathe.
- **Three metrics (lines / words / episodes appeared).** "Speaks a lot"
  and "appears a lot" are different kinds of importance — Stanley
  appears in many episodes but speaks comparatively little; Michael
  speaks the most but only appears in S1–7. The toggle lets the viewer
  see both faces of "important."
- **Season filter** re-computes per-season totals so the ranking
  reflects only that season.

### Heatmap (right)
- **Why a heatmap?** With ~25 characters × 186 episodes (~4,650 cells),
  a heatmap is the most space-efficient way to expose appearance
  patterns. You can immediately see Michael's run ending in S7,
  Andy's rise from S3 onward, Erin entering in S5, Karen's S3 arc,
  and Robert/Nellie filling the post-Michael void.
- **Sqrt color scale** keeps low-count cells visible despite "Michael
  monologue" outlier episodes.
- **Empty cells (light gray)** explicitly show non-appearances.
- **Season labels along the top double as filters** — clicking "S5"
  applies the same filter as the dropdown.

### Brushing & linking
- Selecting a character (bar or row label) dims everything else in
  *both* views, focusing on that character's run.
- Selecting a season (dropdown or season label) re-ranks the bar chart
  *and* dims non-matching episode columns in the heatmap.
- Tooltips give details-on-demand: exact line/word/episode counts on
  bars, and `S{n}·E{m} — "Episode title"` plus line count on heatmap
  cells.

## Who is included
The CSV contains hundreds of named speakers, most of whom appear only
once. The dashboard keeps speakers who:

- Have **≥ 100 total lines** AND
- Appear in **≥ 5 distinct episodes**

…then takes the **top 25 by total lines** so the heatmap stays readable.
This includes every recurring office character with a meaningful
on-screen presence (Michael through Clark) and excludes one-off guests
("Boy", "Man #2"), group labels ("Everyone", "All"), and compound
speakers ("Jim & Pam"). Variant spellings ("Michael:", "DeAngelo") are
normalized.

## File layout
```
index.html              # markup + show overview + controls + viz containers
                        # Level 1: bar chart, heatmap
                        # Level 2: word cloud, top words, phrases, seasonal chart
css/style.css           # Office-themed styling (Level 1 + Level 2 panels)
js/main.js              # Level 1: data loading, cleaning, bar chart, heatmap
                        # Level 2: word extraction, phrase detection, text viz
js/d3.v6.min.js         # D3 v6
data/The-Office-Lines-V4.csv  # source dialogue dataset
```

## Implementation details (Level 2)

**Text processing:**
- `extractWordsForCharacter()` — Tokenizes character dialogue, removes
  stop words, counts word frequencies, and returns sorted word-frequency
  pairs. Supports filtering by season.
- `renderWordCloud()` — Generates a visual word cloud from the top 50
  words using size-based encoding. Interactive tooltips on hover.
- `renderTopWordsList()` — Renders a horizontal bar chart with the top
  20 words, showing counts and percentage of character's total dialogue.
- `renderPhrases()` — Detects 2–4 word phrases that repeat at least twice,
  sorts by frequency, and shows the first episode of appearance.
- `renderSeasonalComparison()` — Creates a grouped bar chart comparing
  the top 8 words across all 9 seasons, with interactive tooltips.

**Stop words:**
A comprehensive list of 160+ common English words (the, and, is, to, a,
an, etc.) is filtered to focus analyses on meaningful vocabulary.

**Character filtering:**
Level 2 works on the same top 25 characters as Level 1, ensuring
consistency across the dashboard.

## Credits
- Dataset: `The-Office-Lines-V4.csv` (transcribed dialogue from all 186
  episodes).
- Built with [D3.js v6](https://d3js.org).
