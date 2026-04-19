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
css/style.css           # Office-themed styling
js/main.js              # data loading, cleaning, bar chart, heatmap
js/d3.v6.min.js         # D3 v6
data/The-Office-Lines-V4.csv  # source dialogue dataset
```

## Hosting on GitHub Pages
1. Push this repo to GitHub (any branch — e.g. `main`).
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source = Deploy from a branch**
   and choose **Branch: `main` / folder: `/ (root)`**, then **Save**.
4. Wait ~1 minute, then visit
   `https://<your-username>.github.io/CS5124-Project3/`.

No build step is required — everything is static HTML / CSS / JS.

## Credits
- Dataset: `The-Office-Lines-V4.csv` (transcribed dialogue from all 186
  episodes).
- Built with [D3.js v6](https://d3js.org).
