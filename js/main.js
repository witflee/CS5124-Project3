const MIN_LINES_THRESHOLD     = 100;
const MIN_EPISODES_THRESHOLD  = 5;
const TOP_N_CHARACTERS        = 25;

const NAME_FIXES = {
  "Michael:": "Michael",
  "DeAngelo": "Deangelo",
  "Dwight ": "Dwight",
  "Jim ": "Jim",
  "Pam ": "Pam",
};

const EXCLUDE_SPEAKERS = new Set([
  "Everyone", "All", "Both", "Group", "Crowd",
  "Man", "Woman", "Man #1", "Man #2", "Woman #1", "Woman #2",
  "Guy", "Guy #1", "Guy #2", "Boy", "Girl",
]);

const WIKI = {
  "Michael":  "https://en.wikipedia.org/wiki/Michael_Scott_(The_Office)",
  "Jim":      "https://en.wikipedia.org/wiki/Jim_Halpert",
  "Pam":      "https://en.wikipedia.org/wiki/Pam_Beesly",
  "Dwight":   "https://en.wikipedia.org/wiki/Dwight_Schrute",
  "Andy":     "https://en.wikipedia.org/wiki/Andy_Bernard",
  "Angela":   "https://en.wikipedia.org/wiki/Angela_Martin",
  "Kevin":    "https://en.wikipedia.org/wiki/Kevin_Malone",
  "Erin":     "https://en.wikipedia.org/wiki/Erin_Hannon",
  "Oscar":    "https://en.wikipedia.org/wiki/Oscar_Martinez_(The_Office)",
  "Ryan":     "https://en.wikipedia.org/wiki/Ryan_Howard_(The_Office)",
  "Darryl":   "https://en.wikipedia.org/wiki/Darryl_Philbin",
  "Phyllis":  "https://en.wikipedia.org/wiki/Phyllis_Lapin",
  "Kelly":    "https://en.wikipedia.org/wiki/Kelly_Kapoor",
  "Jan":      "https://en.wikipedia.org/wiki/Jan_Levinson",
  "Toby":     "https://en.wikipedia.org/wiki/Toby_Flenderson",
  "Stanley":  "https://en.wikipedia.org/wiki/Stanley_Hudson",
  "Meredith": "https://en.wikipedia.org/wiki/Meredith_Palmer",
  "Nellie":   "https://en.wikipedia.org/wiki/Nellie_Bertram",
  "Holly":    "https://en.wikipedia.org/wiki/Holly_Flax",
  "Robert":   "https://en.wikipedia.org/wiki/Robert_California",
  "Gabe":     "https://en.wikipedia.org/wiki/List_of_The_Office_(American_TV_series)_characters",
  "Creed":    "https://en.wikipedia.org/wiki/Creed_Bratton_(character)",
  "David":    "https://en.wikipedia.org/wiki/David_Wallace_(The_Office)",
  "Karen":    "https://en.wikipedia.org/wiki/Karen_Filippelli",
  "Roy":      "https://en.wikipedia.org/wiki/List_of_The_Office_(American_TV_series)_characters",
  "Pete":     "https://en.wikipedia.org/wiki/List_of_The_Office_(American_TV_series)_characters",
  "Clark":    "https://en.wikipedia.org/wiki/List_of_The_Office_(American_TV_series)_characters",
  "Charles":  "https://en.wikipedia.org/wiki/List_of_The_Office_(American_TV_series)_characters",
  "Jo":       "https://en.wikipedia.org/wiki/List_of_The_Office_(American_TV_series)_characters",
  "Deangelo": "https://en.wikipedia.org/wiki/List_of_The_Office_(American_TV_series)_characters",
  "David Wallace": "https://en.wikipedia.org/wiki/David_Wallace_(The_Office)",
};

let allRows      = [];
let episodes     = [];
let characters   = [];
let perCharEpisodeLines = new Map();

const state = {
  season: "all",
  metric: "lines",
  selectedChar: null,
};

d3.select("#bar-chart").append("div").attr("class", "loading").text("Loading data…");
d3.select("#heatmap").append("div").attr("class", "loading").text("Loading data…");

d3.csv("data/The-Office-Lines-V4.csv").then(raw => {
  allRows = raw
    .map(d => {
      let speaker = (d.speaker || "").trim().replace(/\s+/g, " ");
      if (speaker.endsWith(":")) speaker = speaker.slice(0, -1).trim();
      if (NAME_FIXES[speaker]) speaker = NAME_FIXES[speaker];
      return {
        season: +d.season,
        episode: +d.episode,
        title: (d.title || "").trim(),
        scene: +d.scene,
        speaker,
        line: d.line || "",
        words: (d.line || "").split(/\s+/).filter(w => w.length > 0).length,
      };
    })
    .filter(d =>
      d.speaker.length > 0 &&
      !EXCLUDE_SPEAKERS.has(d.speaker) &&
      !d.speaker.includes("&") &&
      !/\b(and)\b/i.test(d.speaker) &&
      !d.speaker.includes("/") &&
      d.season >= 1 && d.season <= 9
    );

  const epMap = new Map();
  allRows.forEach(d => {
    const key = epKey(d.season, d.episode);
    if (!epMap.has(key)) {
      epMap.set(key, { season: d.season, episode: d.episode, title: d.title, idx: 0 });
    }
  });
  episodes = Array.from(epMap.values())
    .sort((a, b) => a.season - b.season || a.episode - b.episode);
  episodes.forEach((e, i) => (e.idx = i));

  const charAgg = new Map();
  allRows.forEach(d => {
    if (!charAgg.has(d.speaker)) {
      charAgg.set(d.speaker, { name: d.speaker, totalLines: 0, totalWords: 0, episodes: new Set() });
    }
    const c = charAgg.get(d.speaker);
    c.totalLines += 1;
    c.totalWords += d.words;
    c.episodes.add(epKey(d.season, d.episode));
  });

  characters = Array.from(charAgg.values())
    .filter(c => c.totalLines >= MIN_LINES_THRESHOLD && c.episodes.size >= MIN_EPISODES_THRESHOLD)
    .map(c => ({
      name: c.name,
      totalLines: c.totalLines,
      totalWords: c.totalWords,
      episodeCount: c.episodes.size,
    }))
    .sort((a, b) => b.totalLines - a.totalLines)
    .slice(0, TOP_N_CHARACTERS);

  const charNameSet = new Set(characters.map(c => c.name));
  perCharEpisodeLines = new Map();
  characters.forEach(c => perCharEpisodeLines.set(c.name, new Map()));
  allRows.forEach(d => {
    if (!charNameSet.has(d.speaker)) return;
    const key = epKey(d.season, d.episode);
    const m = perCharEpisodeLines.get(d.speaker);
    m.set(key, (m.get(key) || 0) + 1);
  });

  d3.select("#bar-chart").select(".loading").remove();
  d3.select("#heatmap").select(".loading").remove();

  setupControls();
  render();
}).catch(err => {
  console.error(err);
  d3.select("#bar-chart").select(".loading")
    .text("Could not load data/The-Office-Lines-V4.csv. If you are opening this file directly, try running a local web server.");
  d3.select("#heatmap").select(".loading").remove();
});

function setupControls() {
  d3.select("#season-select").on("change", function () {
    state.season = this.value;
    render();
  });
  d3.selectAll("input[name='metric']").on("change", function () {
    state.metric = this.value;
    render();
  });
  d3.select("#reset-btn").on("click", () => {
    state.season = "all";
    state.metric = "lines";
    state.selectedChar = null;
    d3.select("#season-select").property("value", "all");
    d3.select("input[name='metric'][value='lines']").property("checked", true);
    render();
  });
}

function render() {
  const subtitle = state.season === "all" ? "— all seasons" : `— Season ${state.season}`;
  d3.select("#bar-subtitle").text(subtitle);
  renderBarChart();
  renderHeatmap();
}

function renderBarChart() {
  const metricKey = ({
    lines:    "totalLines",
    words:    "totalWords",
    episodes: "episodeCount",
  })[state.metric];

  const data = computeStats(state.season)
    .filter(d => d[metricKey] > 0)
    .sort((a, b) => b[metricKey] - a[metricKey]);

  const margin = { top: 8, right: 60, bottom: 44, left: 130 };
  const rowHeight = 22;
  const innerWidth  = 290;
  const innerHeight = data.length * rowHeight;
  const totalWidth  = innerWidth + margin.left + margin.right;
  const totalHeight = innerHeight + margin.top + margin.bottom;

  d3.select("#bar-chart").selectAll("*").remove();

  if (data.length === 0) {
    d3.select("#bar-chart").append("div").attr("class", "loading")
      .text("No data for this filter.");
    return;
  }

  const svg = d3.select("#bar-chart").append("svg")
    .attr("width", totalWidth)
    .attr("height", totalHeight);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d[metricKey])])
    .nice()
    .range([0, innerWidth]);

  const y = d3.scaleBand()
    .domain(data.map(d => d.name))
    .range([0, innerHeight])
    .padding(0.18);

  g.append("g")
    .attr("class", "grid")
    .selectAll("line")
    .data(x.ticks(4))
    .join("line")
    .attr("x1", d => x(d)).attr("x2", d => x(d))
    .attr("y1", 0).attr("y2", innerHeight)
    .attr("stroke", "#eee5cc")
    .attr("stroke-width", 1);

  g.selectAll(".bar")
    .data(data, d => d.name)
    .join("rect")
    .attr("class", d => {
      const cls = ["bar"];
      if (state.selectedChar === d.name) cls.push("selected");
      else if (state.selectedChar) cls.push("dim");
      return cls.join(" ");
    })
    .attr("x", 0)
    .attr("y", d => y(d.name))
    .attr("width", d => x(d[metricKey]))
    .attr("height", y.bandwidth())
    .style("cursor", "pointer")
    .on("mousemove", (event, d) => {
      showTooltip(event,
        `<b>${d.name}</b><br>` +
        `Lines: ${d3.format(",")(d.totalLines)}<br>` +
        `Words: ${d3.format(",")(d.totalWords)}<br>` +
        `Episodes appeared: ${d.episodeCount}`);
    })
    .on("mouseout", hideTooltip)
    .on("click", (event, d) => {
      state.selectedChar = state.selectedChar === d.name ? null : d.name;
      render();
    });

  g.selectAll(".val-label")
    .data(data, d => d.name)
    .join("text")
    .attr("class", "val-label")
    .attr("x", d => x(d[metricKey]) + 5)
    .attr("y", d => y(d.name) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .text(d => d3.format(",")(d[metricKey]));

  g.selectAll(".char-name")
    .data(data, d => d.name)
    .join("text")
    .attr("class", d => "char-name" + (state.selectedChar === d.name ? " selected" : ""))
    .attr("x", -10)
    .attr("y", d => y(d.name) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .text(d => d.name)
    .on("click", (event, d) => {
      state.selectedChar = state.selectedChar === d.name ? null : d.name;
      render();
    })
    .append("title").text(d => "Click to spotlight in heatmap");

  g.selectAll(".wiki-link")
    .data(data.filter(d => WIKI[d.name]), d => d.name)
    .join("text")
    .attr("class", "wiki-link")
    .attr("x", -118)
    .attr("y", d => y(d.name) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text("[w]")
    .on("click", (event, d) => {
      window.open(WIKI[d.name], "_blank", "noopener");
    })
    .append("title").text(d => "Open " + d.name + " on Wikipedia");

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format("~s")))
    .call(g => g.selectAll("text").style("font-size", "11px").style("fill", "#5a3e2b"))
    .call(g => g.selectAll("line, path").style("stroke", "#c9b48b"));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 36)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#7a6b58")
    .text(metricLabel(state.metric));
}

function renderHeatmap() {
  d3.select("#heatmap").selectAll("*").remove();

  const charsToShow = characters;
  const cellW = 7;
  const cellH = 18;
  const seasonGap = 6;

  const margin = { top: 32, right: 18, bottom: 60, left: 110 };

  const epX = {};
  let prevSeason = episodes[0].season;
  let cursor = 0;
  episodes.forEach(e => {
    if (e.season !== prevSeason) {
      cursor += seasonGap;
      prevSeason = e.season;
    }
    epX[epKey(e.season, e.episode)] = cursor;
    cursor += cellW;
  });
  const innerWidth  = cursor;
  const innerHeight = charsToShow.length * cellH;
  const totalWidth  = innerWidth + margin.left + margin.right;
  const totalHeight = innerHeight + margin.top + margin.bottom;

  let maxLines = 0;
  perCharEpisodeLines.forEach(m => m.forEach(v => { if (v > maxLines) maxLines = v; }));
  const color = d3.scaleSequential(d3.interpolateYlOrBr)
    .domain([0, Math.sqrt(maxLines || 1)]);

  const svg = d3.select("#heatmap").append("svg")
    .attr("width", totalWidth)
    .attr("height", totalHeight);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  charsToShow.forEach((c, rowIdx) => {
    const rowGroup = g.append("g").attr("class", "hm-row");
    const m = perCharEpisodeLines.get(c.name);
    const charDim = state.selectedChar && state.selectedChar !== c.name;

    episodes.forEach(e => {
      const key = epKey(e.season, e.episode);
      const v = m.get(key) || 0;
      const seasonDim = state.season !== "all" && +state.season !== e.season;
      const cellOpacity = (charDim || seasonDim) ? 0.18 : 1;

      rowGroup.append("rect")
        .attr("class", "hm-cell")
        .attr("x", epX[key])
        .attr("y", rowIdx * cellH)
        .attr("width", cellW - 1)
        .attr("height", cellH - 1)
        .attr("fill", v === 0 ? "#ece6d3" : color(Math.sqrt(v)))
        .attr("opacity", cellOpacity)
        .style("cursor", "pointer")
        .on("mousemove", (event) => {
          showTooltip(event,
            `<b>${c.name}</b><br>` +
            `S${e.season}&middot;E${e.episode} &mdash; "${e.title}"<br>` +
            `${v} line${v === 1 ? "" : "s"} in this episode`);
        })
        .on("mouseout", hideTooltip);
    });
  });

  g.selectAll(".hm-row-label")
    .data(charsToShow, d => d.name)
    .join("text")
    .attr("class", d => "hm-row-label" + (state.selectedChar === d.name ? " selected" : ""))
    .attr("x", -8)
    .attr("y", (d, i) => i * cellH + cellH / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .text(d => d.name)
    .on("click", (event, d) => {
      state.selectedChar = state.selectedChar === d.name ? null : d.name;
      render();
    });

  const seasonRanges = computeSeasonRanges(epX, cellW);
  seasonRanges.forEach(s => {
    g.append("line")
      .attr("class", "hm-season-divider")
      .attr("x1", s.startX)
      .attr("x2", s.endX)
      .attr("y1", -16)
      .attr("y2", -16)
      .attr("stroke", state.season == s.season ? "#b3582a" : "#c9b48b")
      .attr("stroke-width", state.season == s.season ? 2 : 1);

    g.append("text")
      .attr("class", "hm-season-label" + (state.season == s.season ? " active" : ""))
      .attr("x", (s.startX + s.endX) / 2)
      .attr("y", -22)
      .attr("text-anchor", "middle")
      .text("S" + s.season)
      .on("click", () => {
        state.season = state.season == s.season ? "all" : String(s.season);
        d3.select("#season-select").property("value", state.season);
        render();
      });
  });

  const legendY = innerHeight + 16;
  const legendG = g.append("g").attr("transform", `translate(0, ${legendY})`);
  legendG.append("text")
    .attr("x", 0).attr("y", 0)
    .style("font-size", "11px").style("fill", "#5a3e2b")
    .text("Lines spoken per episode →");
  const ticks = [0, 5, 25, 75, 150, 300];
  const swatchW = 36;
  ticks.forEach((t, i) => {
    legendG.append("rect")
      .attr("x", i * swatchW)
      .attr("y", 8)
      .attr("width", swatchW - 2)
      .attr("height", 12)
      .attr("fill", t === 0 ? "#ece6d3" : color(Math.sqrt(Math.min(t, maxLines))));
    legendG.append("text")
      .attr("x", i * swatchW + (swatchW - 2) / 2)
      .attr("y", 32)
      .attr("text-anchor", "middle")
      .style("font-size", "10px").style("fill", "#5a3e2b")
      .text(t);
  });
}

function epKey(season, episode) { return `${season}-${episode}`; }

function computeStats(seasonFilter) {
  const map = new Map();
  characters.forEach(c => map.set(c.name, {
    name: c.name, totalLines: 0, totalWords: 0, episodes: new Set(),
  }));
  allRows.forEach(d => {
    if (!map.has(d.speaker)) return;
    if (seasonFilter !== "all" && d.season !== +seasonFilter) return;
    const c = map.get(d.speaker);
    c.totalLines += 1;
    c.totalWords += d.words;
    c.episodes.add(epKey(d.season, d.episode));
  });
  return Array.from(map.values()).map(c => ({
    name: c.name,
    totalLines: c.totalLines,
    totalWords: c.totalWords,
    episodeCount: c.episodes.size,
  }));
}

function computeSeasonRanges(epX, cellW) {
  const ranges = [];
  let cur = null;
  episodes.forEach(e => {
    const x0 = epX[epKey(e.season, e.episode)];
    if (!cur || cur.season !== e.season) {
      if (cur) ranges.push(cur);
      cur = { season: e.season, startX: x0, endX: x0 + cellW };
    } else {
      cur.endX = x0 + cellW;
    }
  });
  if (cur) ranges.push(cur);
  return ranges;
}

function metricLabel(metric) {
  return metric === "lines"    ? "Total lines spoken"
       : metric === "words"    ? "Total words spoken"
       : "Episodes appeared in";
}

function showTooltip(event, html) {
  const t = d3.select("#tooltip");
  t.html(html)
    .style("left", (event.pageX + 14) + "px")
    .style("top",  (event.pageY - 10) + "px")
    .style("opacity", 1);
}
function hideTooltip() {
  d3.select("#tooltip").style("opacity", 0);
}
