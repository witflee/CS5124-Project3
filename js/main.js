const MIN_LINES_THRESHOLD     = 100;
const MIN_EPISODES_THRESHOLD  = 5;
const TOP_N_CHARACTERS        = 25;

const STOPWORDS = new Set([
  "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself",
  "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself",
  "they", "them", "their", "theirs", "themselves", "what", "which", "who", "whom", "why", "how",
  "all", "each", "every", "both", "few", "more", "most", "other", "some", "such", "no", "nor",
  "not", "only", "own", "same", "so", "than", "too", "very", "can", "just", "should", "now",
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is",
  "it", "no", "not", "of", "on", "or", "such", "that", "the", "their", "then", "there",
  "these", "they", "this", "to", "was", "will", "with", "has", "have", "had", "do", "does",
  "did", "will", "would", "could", "should", "may", "might", "must", "can", "am", "being",
  "been", "having", "doing", "up", "down", "out", "about", "over", "under", "again", "further",
  "then", "once", "here", "there", "when", "where", "why", "how", "what", "which", "who", "whom",
  "ok", "okay", "yeah", "yup", "nope", "uh", "um", "well", "um", "like", "you", "know", "get",
  "got", "d", "s", "t", "ve", "re", "ll", "m"
]);

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

let scenes              = [];
let coSceneMatrix       = null;
let charIndex           = new Map();

const state = {
  season: "all",
  metric: "lines",
  selectedChar: null,
  l2Mode: "all",
  l2SelectedChar: null,
  l2Season: "all",
  l4Query: "",
  l4PairA: null,
  l4PairB: null,
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

  charIndex = new Map();
  characters.forEach((c, i) => charIndex.set(c.name, i));

  const sceneMap = new Map();
  allRows.forEach(d => {
    if (!charNameSet.has(d.speaker)) return;
    const k = `${d.season}-${d.episode}-${d.scene}`;
    if (!sceneMap.has(k)) {
      sceneMap.set(k, { season: d.season, episode: d.episode, scene: d.scene, speakers: new Set(), lines: [] });
    }
    const sc = sceneMap.get(k);
    sc.speakers.add(d.speaker);
    sc.lines.push({ speaker: d.speaker, line: d.line });
  });
  scenes = Array.from(sceneMap.values());

  const N = characters.length;
  coSceneMatrix = Array.from({ length: N }, () => new Array(N).fill(0));
  scenes.forEach(sc => {
    const ids = Array.from(sc.speakers).map(s => charIndex.get(s)).filter(i => i !== undefined);
    if (ids.length === 0) return;
    if (ids.length === 1) {
      coSceneMatrix[ids[0]][ids[0]] += 1;
      return;
    }
    for (let i = 0; i < ids.length; i++) {
      coSceneMatrix[ids[i]][ids[i]] += 1;
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        coSceneMatrix[a][b] += 1;
        coSceneMatrix[b][a] += 1;
      }
    }
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
  d3.selectAll("input[name='metric']").on("change", function () {
    state.metric = this.value;
    render();
  });

  d3.select("#season-select").on("change", function () {
  setSeasonAll(this.value);
});

d3.select("#season-select-l2").on("change", function () {
  setSeasonAll(this.value);
});
d3.select("#season-select-seasonal").on("change", function () {
  setSeasonAll(this.value);
})

d3.select("#season-select-shared").on("change", function () {
  setSeasonAll(this.value);
});

d3.select("#season-select-l3").on("change", function () {
  setSeasonAll(this.value);
});

  d3.select("#reset-btn").on("click", () => {
  state.metric = "lines";
  state.selectedChar = null;
  d3.select("input[name='metric'][value='lines']").property("checked", true);
  setSeasonAll("all");  // handles season + render
});

d3.select("#reset-l2-btn").on("click", () => {
  state.l2SelectedChar = null;
  d3.select("#char-select-l2").property("value", "");
  setSeasonAll("all");

});

d3.select("#reset-l3-btn").on("click", () => {
  setSeasonAll("all");  // handles season + render
});

  // Level 2 controls
  const charOptions = characters.map(c => c.name);
  d3.select("#char-select-l2")
    .selectAll("option.character-option")
    .data(charOptions, d => d)
    .join("option")
    .attr("class", "character-option")
    .attr("value", d => d)
    .text(d => d);

  d3.select("#char-select-l2").on("change", function () {
    state.l2SelectedChar = this.value || null;
    renderLevel2();
  });

  d3.selectAll("input[name='l2-mode']").on("change", function () {
    state.l2Mode = this.value;
    renderLevel2();
  });

  d3.select("#reset-l2-btn").on("click", () => {
    state.l2SelectedChar = null;
    state.l2Mode = "all";
    state.l2Season = "all";
    d3.select("#char-select-l2").property("value", "");
    d3.select("input[name='l2-mode'][value='all']").property("checked", true);
    d3.select("#season-select-l2").property("value", "all");
    renderLevel2();
  });

  d3.select("#season-select-l2").on("change", function () {
    state.l2Season = this.value;
    renderLevel2();
  });

  const runPhraseSearch = () => {
    state.l4Query = (d3.select("#phrase-input").property("value") || "").trim();
    d3.selectAll(".preset-btn").classed("active", function () {
      return d3.select(this).attr("data-q").toLowerCase() === state.l4Query.toLowerCase();
    });
    renderLevel4Phrase();
  };
  d3.select("#phrase-go").on("click", runPhraseSearch);
  d3.select("#phrase-input").on("keydown", (event) => {
    if (event.key === "Enter") runPhraseSearch();
  });
  d3.selectAll(".preset-btn").on("click", function () {
    const q = d3.select(this).attr("data-q");
    d3.select("#phrase-input").property("value", q);
    runPhraseSearch();
  });
  d3.select("#char-select-l2")
    .property("value", "")
    .on("change", function () {
      state.l2SelectedChar = this.value || null;
      state.selectedChar = state.l2SelectedChar;
      render();
    });
}

function render() {
  const subtitle = state.season === "all" ? "— all seasons" : `— Season ${state.season}`;
  d3.select("#bar-subtitle").text(subtitle);
  d3.select("#season-select-l3").property("value", state.season);
  renderBarChart();
  renderHeatmap();
  renderLevel2();
  renderLevel4();
  renderLevel3();
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
        setSeasonAll(state.season == s.season ? "all" : String(s.season));
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
function setSeasonAll(value) {
  state.season    = value;
  state.l2Season  = value;
  state.l3Season  = value;
  d3.select("#season-select").property("value", value);
  d3.select("#season-select-l2").property("value", value);
  d3.select("#season-select-shared").property("value", value);
  d3.select("#season-select-seasonal").property("value", value);
  d3.select("#season-select-l3").property("value", value);
  render();
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

// ============ LEVEL 2: What do characters say? ============

function renderLevel2() {
  const char = state.l2SelectedChar || state.selectedChar;
  if (!char) {
    d3.select("#wordcloud").html('<div class="no-selection">Select a character to analyze what they say</div>');
    d3.select("#top-words-list").html('<div class="no-selection">Select a character to see word frequency</div>');
    d3.select("#phrases").html('<div class="no-selection">Select a character to see common phrases</div>');
    d3.select("#seasonal-chart").html('<div class="no-selection">Select a character to see seasonal patterns</div>');
    return;
  }
  d3.select("#char-select-l2").property("value", char);

  const filterSeason = state.l2Season;

  const charLines = allRows.filter(d => d.speaker === char);
  const wordData = extractWordsForCharacter(charLines, filterSeason);
  
  renderWordCloud(wordData, filterSeason);
  renderTopWordsList(wordData, filterSeason);
  renderPhrases(charLines, filterSeason);
  renderSeasonalComparison(charLines, filterSeason);
}

function extractWordsForCharacter(lines, seasonFilter) {
  const wordFreq = new Map();
  let totalWords = 0;

  lines.forEach(line => {
    if (seasonFilter !== "all" && line.season !== +seasonFilter) return;
    
    const words = line.line.toLowerCase()
      .replace(/[^\w\s']/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w));
    
    words.forEach(w => {
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
      totalWords++;
    });
  });

  return Array.from(wordFreq.entries())
    .map(([word, freq]) => ({ word, freq, pct: (freq / totalWords * 100).toFixed(1) }))
    .sort((a, b) => b.freq - a.freq);
}

function renderWordCloud(wordData) {
  if (!wordData || wordData.length === 0) {
    d3.select("#wordcloud").html('<div class="no-selection">No matching words found for this selection</div>');
    return;
  }

  const top50 = wordData.slice(0, 50);
  const maxFreq = Math.max(...top50.map(d => d.freq));
  const minFreq = Math.min(...top50.map(d => d.freq));
  
  const sizeScale = d3.scaleLinear()
    .domain([minFreq, maxFreq])
    .range([11, 32]);

  d3.select("#wordcloud").selectAll(".word-node").remove();
  d3.select("#wordcloud").html('');
  
  d3.select("#wordcloud")
    .selectAll(".word-node")
    .data(top50, d => d.word)
    .join("div")
    .attr("class", "word-node")
    .style("font-size", d => sizeScale(d.freq) + "px")
    .style("opacity", d => 0.5 + (d.freq / maxFreq) * 0.5)
    .text(d => d.word)
    .on("mousemove", (event, d) => {
      showTooltip(event, `<b>${d.word}</b><br>Frequency: ${d.freq}<br>${d.pct}% of dialogue`);
    })
    .on("mouseout", hideTooltip);
}

function renderTopWordsList(wordData) {
  const top20 = wordData.slice(0, 20);

  if (top20.length === 0) {
    d3.select("#top-words-list").html('<div class="no-selection">No matching words found for this selection</div>');
    return;
  }

  const maxFreq = Math.max(...top20.map(d => d.freq));

  d3.select("#top-words-list").selectAll(".word-bar-item").remove();
  d3.select("#top-words-list").html('');

  d3.select("#top-words-list")
    .selectAll(".word-bar-item")
    .data(top20, d => d.word)
    .join("div")
    .attr("class", "word-bar-item")
    .html(d => {
      const pct = (d.freq / maxFreq) * 100;
      return `
        <div class="word-bar-label">${d.word}</div>
        <div class="word-bar-container">
          <div class="word-bar-fill" style="width: ${pct}%"></div>
        </div>
        <div class="word-bar-value">${d.freq} (${d.pct}%)</div>
      `;
    });
}

function renderPhrases(lines, seasonFilter) {
  const phraseMap = new Map();
  const firstSeen = new Map();

  lines.forEach(line => {
    if (seasonFilter !== "all" && line.season !== +seasonFilter) return;
    
    const text = line.line.toLowerCase();
    
    // Look for 2-4 word phrases
    const words = text.split(/\s+/);
    for (let len = 4; len >= 2; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len)
          .map(w => w.replace(/[^\w']/g, ''))
          .join(' ')
          .trim();
        
        if (phrase.length > 5 && !phrase.split(' ').some(w => STOPWORDS.has(w))) {
          phraseMap.set(phrase, (phraseMap.get(phrase) || 0) + 1);
          if (!firstSeen.has(phrase)) {
            firstSeen.set(phrase, `S${line.season}E${line.episode}`);
          }
        }
      }
    }
  });

  const phrases = Array.from(phraseMap.entries())
    .filter(([phrase, count]) => count >= 2)
    .map(([phrase, count]) => ({ phrase, count, first: firstSeen.get(phrase) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  d3.select("#phrases").selectAll(".phrase-item").remove();

  if (phrases.length === 0) {
    d3.select("#phrases").html('<div class="no-selection">No common phrases found</div>');
    return;
  }

  d3.select("#phrases")
    .selectAll(".phrase-item")
    .data(phrases, d => d.phrase)
    .join("div")
    .attr("class", "phrase-item")
    .html(d => `
      <div class="phrase-text">"${d.phrase}"</div>
      <div class="phrase-meta">Count: ${d.count} &mdash; First: ${d.first}</div>
    `);
}

function renderSeasonalComparison(lines, seasonFilter) {
  const seasonalData = [];
  
  const allWords = extractWordsForCharacter(lines, seasonFilter).slice(0, 8);
  const topWords = allWords.map(d => d.word);

  for (let season = 1; season <= 9; season++) {
    if (seasonFilter !== 'all' && season !== +seasonFilter) continue;
    const seasonLines = lines.filter(d => d.season === season);
    if (seasonLines.length === 0) continue;
    
    const seasonWords = extractWordsForCharacter(seasonLines, "all");
    const row = { season: `S${season}` };
    
    topWords.forEach(word => {
      const entry = seasonWords.find(d => d.word === word);
      row[word] = entry ? entry.freq : 0;
    });
    seasonalData.push(row);
  }

  if (topWords.length === 0 || seasonalData.length === 0) {
    d3.select("#seasonal-chart").html('<div class="no-selection">No seasonal comparison available for this selection</div>');
    return;
  }

  const margin = { top: 10, right: 5, bottom: 200, left: 50 };
  const width = 520 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  d3.select("#seasonal-chart").selectAll("*").remove();

  const svg = d3.select("#seasonal-chart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const maxFreq = d3.max(seasonalData, row => d3.max(topWords.map(w => row[w])));

  const x = d3.scaleBand()
    .domain(seasonalData.map(d => d.season))
    .range([0, width])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, maxFreq])
    .range([height, 0]);

  const subX = d3.scaleBand()
    .domain(topWords)
    .range([0, x.bandwidth()])
    .padding(0.1);

  const colors = d3.schemeSet3;
  const colorScale = d3.scaleOrdinal()
    .domain(topWords)
    .range(colors);

  g.selectAll(".season-group")
    .data(seasonalData)
    .join("g")
    .attr("class", "season-group")
    .attr("transform", d => `translate(${x(d.season)},0)`)
    .selectAll(".seasonal-bar")
    .data(d => topWords.map(word => ({ word, freq: d[word], season: d.season })))
    .join("rect")
    .attr("class", "seasonal-bar")
    .attr("x", d => subX(d.word))
    .attr("y", d => y(d.freq))
    .attr("width", subX.bandwidth())
    .attr("height", d => height - y(d.freq))
    .attr("fill", d => colorScale(d.word))
    .on("mousemove", (event, d) => {
      showTooltip(event, `<b>${d.word}</b><br>${d.season}: ${d.freq} times`);
    })
    .on("mouseout", hideTooltip);

  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .style("font-size", "11px");

  g.append("g")
    .call(d3.axisLeft(y).ticks(4))
    .style("font-size", "11px");

  const legend = g.append("g")
    .attr('transform', `translate(0, ${height + 50})`);

  topWords.forEach((word, i) => {
    legend.append("rect")
      .attr("x", 0)
      .attr("y", i * 14)
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", colorScale(word));

    legend.append("text")
      .attr("x", 14)
      .attr("y", i * 14 + 9)
      .attr("font-size", "9px")
      .attr("fill", "#2e1f12")
      .text(word.substring(0, 12));
  });
}

function renderLevel4() {
  renderLevel4Phrase();
  renderLevel4CoScene();
  renderLevel4PairWords();
}

function renderLevel4Phrase() {
  const q = (state.l4Query || "").trim().toLowerCase();
  const statsEl = d3.select("#phrase-stats");
  const tlEl    = d3.select("#phrase-timeline");
  const spkEl   = d3.select("#phrase-speakers");

  if (!q) {
    statsEl.html('<div class="phrase-empty">Type a word or phrase above (or pick a chip) to see when it shows up across the show.</div>');
    tlEl.html("");
    spkEl.html("");
    return;
  }

  const matches = [];
  allRows.forEach(d => {
    if (d.line.toLowerCase().includes(q)) matches.push(d);
  });

  if (matches.length === 0) {
    statsEl.html(`<div class="phrase-no-result">No lines contain &ldquo;<b>${escapeHtml(q)}</b>&rdquo;.</div>`);
    tlEl.html("");
    spkEl.html("");
    return;
  }

  const perEpisode = new Map();
  const speakerCount = new Map();
  matches.forEach(d => {
    const k = epKey(d.season, d.episode);
    perEpisode.set(k, (perEpisode.get(k) || 0) + 1);
    speakerCount.set(d.speaker, (speakerCount.get(d.speaker) || 0) + 1);
  });

  const seasonCount = d3.rollup(matches, v => v.length, d => d.season);
  const peakSeason = Array.from(seasonCount.entries()).sort((a, b) => b[1] - a[1])[0];
  const first = matches[0];
  const last  = matches[matches.length - 1];
  const epsWith = perEpisode.size;

  const fmt = d => `S${d.season}&middot;E${d.episode}`;
  statsEl.html(`
    <div class="phrase-stat"><div class="phrase-stat-num">${matches.length}</div><div class="phrase-stat-lbl">Total uses</div></div>
    <div class="phrase-stat"><div class="phrase-stat-num">${epsWith}</div><div class="phrase-stat-lbl">Episodes</div></div>
    <div class="phrase-stat"><div class="phrase-stat-num">${fmt(first)}</div><div class="phrase-stat-lbl">First use</div></div>
    <div class="phrase-stat"><div class="phrase-stat-num">${fmt(last)}</div><div class="phrase-stat-lbl">Last use</div></div>
    <div class="phrase-stat"><div class="phrase-stat-num">S${peakSeason[0]}</div><div class="phrase-stat-lbl">Peak season (${peakSeason[1]})</div></div>
  `);

  drawPhraseTimeline(perEpisode, q);
  drawPhraseSpeakers(speakerCount);
}

function drawPhraseTimeline(perEpisode, q) {
  const target = d3.select("#phrase-timeline");
  target.selectAll("*").remove();

  const margin = { top: 14, right: 16, bottom: 36, left: 36 };
  const cellW = 6;
  const seasonGap = 6;
  const innerHeight = 110;

  const epX = {};
  let prevSeason = episodes[0].season;
  let cursor = 0;
  episodes.forEach(e => {
    if (e.season !== prevSeason) { cursor += seasonGap; prevSeason = e.season; }
    epX[epKey(e.season, e.episode)] = cursor;
    cursor += cellW;
  });
  const innerWidth = cursor;

  const svg = target.append("svg")
    .attr("width", innerWidth + margin.left + margin.right)
    .attr("height", innerHeight + margin.top + margin.bottom);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const maxV = d3.max(Array.from(perEpisode.values())) || 1;
  const y = d3.scaleLinear().domain([0, maxV]).nice().range([innerHeight, 0]);

  g.append("g")
    .call(d3.axisLeft(y).ticks(Math.min(maxV, 4)).tickFormat(d3.format("d")))
    .call(g => g.selectAll("text").style("font-size", "10px").style("fill", "#5a3e2b"))
    .call(g => g.selectAll("line, path").style("stroke", "#c9b48b"));

  const seasonRanges = computeSeasonRanges(epX, cellW);
  seasonRanges.forEach(s => {
    g.append("line")
      .attr("x1", s.startX).attr("x2", s.endX)
      .attr("y1", innerHeight + 4).attr("y2", innerHeight + 4)
      .attr("stroke", "#c9b48b").attr("stroke-width", 1);
    g.append("text")
      .attr("x", (s.startX + s.endX) / 2)
      .attr("y", innerHeight + 18)
      .attr("text-anchor", "middle")
      .style("font-size", "10px").style("fill", "#5a3e2b")
      .text("S" + s.season);
  });

  episodes.forEach(e => {
    const k = epKey(e.season, e.episode);
    const v = perEpisode.get(k) || 0;
    const x0 = epX[k];
    if (v === 0) {
      g.append("rect")
        .attr("x", x0).attr("y", innerHeight - 1)
        .attr("width", cellW - 1).attr("height", 1)
        .attr("fill", "#e6dcc2");
      return;
    }
    g.append("rect")
      .attr("x", x0)
      .attr("y", y(v))
      .attr("width", cellW - 1)
      .attr("height", innerHeight - y(v))
      .attr("fill", "#b3582a")
      .style("cursor", "pointer")
      .on("mousemove", (event) => {
        showTooltip(event,
          `<b>S${e.season}&middot;E${e.episode} &mdash; "${e.title}"</b><br>` +
          `${v} use${v === 1 ? "" : "s"} of "${escapeHtml(q)}"`);
      })
      .on("mouseout", hideTooltip);
  });

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 32)
    .attr("text-anchor", "middle")
    .style("font-size", "10px").style("fill", "#7a6b58")
    .text("Episodes (chronological)");
}

function drawPhraseSpeakers(speakerCount) {
  const target = d3.select("#phrase-speakers");
  target.selectAll("*").remove();

  const top = Array.from(speakerCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (top.length === 0) {
    target.html('<div class="phrase-empty">No speakers found.</div>');
    return;
  }
  const max = top[0].count;

  const wrap = target.append("div");
  top.forEach(d => {
    const pct = (d.count / max) * 100;
    wrap.append("div")
      .attr("class", "pair-word-row")
      .html(`
        <div class="word">${escapeHtml(d.name)}</div>
        <div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="count">${d.count}</div>
      `);
  });
}

function renderLevel4CoScene() {
  const target = d3.select("#coscene-matrix");
  target.selectAll("*").remove();
  if (!coSceneMatrix) return;

  const N = characters.length;
  const cell = 18;
  const margin = { top: 100, right: 14, bottom: 14, left: 100 };
  const innerSize = N * cell;

  const svg = target.append("svg")
    .attr("width", innerSize + margin.left + margin.right)
    .attr("height", innerSize + margin.top + margin.bottom);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  let maxOff = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i !== j && coSceneMatrix[i][j] > maxOff) maxOff = coSceneMatrix[i][j];
    }
  }
  const color = d3.scaleSequential(d3.interpolateYlOrBr).domain([0, Math.sqrt(maxOff || 1)]);

  const sel = (state.l4PairA != null && state.l4PairB != null);

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const v = coSceneMatrix[i][j];
      const isDiag = i === j;
      const isSel = sel && ((state.l4PairA === i && state.l4PairB === j) || (state.l4PairA === j && state.l4PairB === i));
      const fill = isDiag
        ? "#3d2916"
        : (v === 0 ? "#ece6d3" : color(Math.sqrt(v)));
      g.append("rect")
        .attr("class", "cs-cell" + (isSel ? " selected" : ""))
        .attr("x", j * cell)
        .attr("y", i * cell)
        .attr("width", cell - 1)
        .attr("height", cell - 1)
        .attr("fill", fill)
        .on("mousemove", (event) => {
          const aName = characters[i].name;
          const bName = characters[j].name;
          const html = isDiag
            ? `<b>${aName}</b><br>${v} scenes total`
            : `<b>${aName} &amp; ${bName}</b><br>${v} shared scene${v === 1 ? "" : "s"}`;
          showTooltip(event, html);
        })
        .on("mouseout", hideTooltip)
        .on("click", () => {
          if (isDiag) {
            state.l4PairA = i; state.l4PairB = i;
          } else {
            state.l4PairA = i; state.l4PairB = j;
          }
          renderLevel4CoScene();
          renderLevel4PairWords();
        });
    }
  }

  characters.forEach((c, i) => {
    const isHl = sel && (state.l4PairA === i || state.l4PairB === i);
    g.append("text")
      .attr("class", "cs-axis-label" + (isHl ? " hl" : ""))
      .attr("x", -6)
      .attr("y", i * cell + cell / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .text(c.name);

    g.append("text")
      .attr("class", "cs-axis-label" + (isHl ? " hl" : ""))
      .attr("x", i * cell + cell / 2)
      .attr("y", -6)
      .attr("text-anchor", "start")
      .attr("transform", `rotate(-55, ${i * cell + cell / 2}, -6)`)
      .text(c.name);
  });
}

const PAIR_EXTRA_STOP = new Set([
  "i'm", "it's", "don't", "that's", "you're", "we're", "they're", "he's", "she's",
  "i've", "you've", "we've", "they've", "won't", "can't", "didn't", "doesn't",
  "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't", "hadn't",
  "shouldn't", "wouldn't", "couldn't", "i'll", "you'll", "we'll", "they'll",
  "i'd", "you'd", "we'd", "they'd", "he'd", "she'd", "let's", "there's",
  "what's", "who's", "how's", "where's", "yeah", "okay", "right", "really",
  "going", "gonna", "wanna", "know", "think", "yes", "well", "hey", "oh",
  "thing", "got", "get", "one", "just", "like", "see", "way", "good",
  "want", "look", "tell", "come", "make", "take", "say", "said", "back",
  "now", "then", "here", "there", "guys", "guy", "people", "uh"
]);

function renderLevel4PairWords() {
  const target = d3.select("#pair-words");
  target.selectAll("*").remove();

  if (state.l4PairA == null || state.l4PairB == null) {
    d3.select("#pair-title").text("Click a cell above to inspect a pair");
    target.html('<div class="pair-empty">Pick any cell in the matrix &mdash; you&rsquo;ll see the words those two characters use most when they&rsquo;re in the same scene.</div>');
    return;
  }

  const a = characters[state.l4PairA].name;
  const b = characters[state.l4PairB].name;
  const samePerson = state.l4PairA === state.l4PairB;
  const title = samePerson
    ? `${a} &mdash; words spoken in any scene`
    : `${a} &amp; ${b} &mdash; words used when both are in scene`;
  d3.select("#pair-title").html(title);

  const wantA = a, wantB = b;
  const wordCount = new Map();
  let usedScenes = 0;
  let totalLines = 0;

  scenes.forEach(sc => {
    const hasA = sc.speakers.has(wantA);
    const hasB = sc.speakers.has(wantB);
    const ok = samePerson ? hasA : (hasA && hasB);
    if (!ok) return;
    usedScenes++;
    sc.lines.forEach(ln => {
      if (samePerson && ln.speaker !== wantA) return;
      if (!samePerson && ln.speaker !== wantA && ln.speaker !== wantB) return;
      totalLines++;
      const tokens = ln.line.toLowerCase()
        .replace(/[^\w\s']/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOPWORDS.has(w) && !PAIR_EXTRA_STOP.has(w));
      tokens.forEach(t => wordCount.set(t, (wordCount.get(t) || 0) + 1));
    });
  });

  if (usedScenes === 0) {
    target.html(`<div class="pair-empty">${a} and ${b} never share a scene with on-screen dialogue.</div>`);
    return;
  }

  const top = Array.from(wordCount.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const max = top[0]?.count || 1;
  const meta = target.append("div")
    .style("font-size", "12px")
    .style("color", "var(--muted)")
    .style("margin-bottom", "6px")
    .html(samePerson
      ? `${usedScenes} scenes &middot; ${totalLines} lines`
      : `${usedScenes} shared scenes &middot; ${totalLines} lines from ${a} or ${b} in those scenes`);

  top.forEach(d => {
    const pct = (d.count / max) * 100;
    target.append("div")
      .attr("class", "pair-word-row")
      .html(`
        <div class="word">${escapeHtml(d.word)}</div>
        <div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="count">${d.count}</div>
      `);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
// ============ LEVEL 3: Who speaks to each other? ============

function renderLevel3() {
  const subtitle = state.season === "all" ? "— all seasons" : `— Season ${state.season}`;
  d3.select("#chord-subtitle").text(subtitle);

  const { matrix, names } = buildCooccurrenceMatrix(state.season);
  renderChordDiagram(matrix, names);
  renderTopPairs(matrix, names);
}

function buildCooccurrenceMatrix(seasonFilter) {
  const charNames = characters.map(c => c.name);
  const nameIndex = new Map(charNames.map((n, i) => [n, i]));
  const n = charNames.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

  const sceneMap = new Map();
  allRows.forEach(d => {
    if (seasonFilter !== "all" && d.season !== +seasonFilter) return;
    if (!nameIndex.has(d.speaker)) return;
    const key = `${d.season}-${d.episode}-${d.scene}`;
    if (!sceneMap.has(key)) sceneMap.set(key, new Set());
    sceneMap.get(key).add(d.speaker);
  });

  sceneMap.forEach(speakers => {
    const arr = Array.from(speakers);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = nameIndex.get(arr[i]);
        const b = nameIndex.get(arr[j]);
        matrix[a][b] += 1;
        matrix[b][a] += 1;
      }
    }
  });

  const active = [];
  for (let i = 0; i < n; i++) {
    if (matrix[i].reduce((sum, v) => sum + v, 0) > 0) active.push(i);
  }

  return {
    matrix: active.map(i => active.map(j => matrix[i][j])),
    names: active.map(i => charNames[i]),
  };
}

function renderChordDiagram(matrix, names) {
  d3.select("#chord-chart").selectAll("*").remove();

  if (names.length === 0) {
    d3.select("#chord-chart").html('<div class="no-selection">No co-occurrence data for this selection</div>');
    return;
  }

  const size = 520;
  const outerRadius = size / 2 - 50;
  const innerRadius = outerRadius - 18;

  const svg = d3.select("#chord-chart").append("svg")
    .attr("width", size)
    .attr("height", size);

  const g = svg.append("g")
    .attr("transform", `translate(${size / 2},${size / 2})`);

  const chord = d3.chord()
    .padAngle(0.04)
    .sortSubgroups(d3.descending);

  const chords = chord(matrix);

  const arc = d3.arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

  const ribbon = d3.ribbon()
    .radius(innerRadius);

  const arcColor = d3.scaleOrdinal()
    .domain(names)
    .range(d3.quantize(d3.interpolateSinebow, names.length + 1));

  const selectedIdx = state.selectedChar ? names.indexOf(state.selectedChar) : -1;

  function ribbonOpacity(d) {
    if (selectedIdx < 0) return 0.6;
    return (d.source.index === selectedIdx || d.target.index === selectedIdx) ? 0.85 : 0.06;
  }

  g.selectAll(".chord-ribbon")
    .data(chords)
    .join("path")
    .attr("class", "chord-ribbon")
    .attr("d", ribbon)
    .attr("fill", d => arcColor(names[d.source.index]))
    .attr("opacity", ribbonOpacity)
    .on("mousemove", (event, d) => {
      showTooltip(event,
        `<b>${names[d.source.index]} &amp; ${names[d.target.index]}</b><br>` +
        `${d3.format(",")(d.source.value)} shared scenes`);
    })
    .on("mouseout", hideTooltip);

  const arcGroups = g.selectAll(".chord-arc")
    .data(chords.groups)
    .join("g")
    .attr("class", "chord-arc");

  arcGroups.append("path")
    .attr("d", arc)
    .attr("fill", d => arcColor(names[d.index]))
    .attr("stroke", d => selectedIdx === d.index ? "#2e1f12" : "#fff")
    .attr("stroke-width", d => selectedIdx === d.index ? 2 : 0.5)
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      g.selectAll(".chord-ribbon")
        .attr("opacity", r =>
          (r.source.index === d.index || r.target.index === d.index) ? 0.85 : 0.06);
    })
    .on("mousemove", (event, d) => {
      const total = matrix[d.index].reduce((sum, v) => sum + v, 0);
      showTooltip(event,
        `<b>${names[d.index]}</b><br>${d3.format(",")(total)} total shared scenes`);
    })
    .on("mouseout", () => {
      g.selectAll(".chord-ribbon").attr("opacity", ribbonOpacity);
      hideTooltip();
    })
    .on("click", (event, d) => {
      state.selectedChar = state.selectedChar === names[d.index] ? null : names[d.index];
      render();
    });

  arcGroups.append("text")
    .attr("dy", "0.35em")
    .attr("transform", d => {
      const angle = (d.startAngle + d.endAngle) / 2;
      const rotate = angle * 180 / Math.PI - 90;
      const flip = angle > Math.PI;
      return `rotate(${rotate}) translate(${outerRadius + 8}) ${flip ? "rotate(180)" : ""}`;
    })
    .attr("text-anchor", d => {
      const angle = (d.startAngle + d.endAngle) / 2;
      return angle > Math.PI ? "end" : "start";
    })
    .attr("font-size", "11px")
    .attr("fill", "#2e1f12")
    .style("cursor", "pointer")
    .text(d => names[d.index])
    .on("click", (event, d) => {
      state.selectedChar = state.selectedChar === names[d.index] ? null : names[d.index];
      render();
    });
}

function renderTopPairs(matrix, names) {
  const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (matrix[i][j] > 0) {
        pairs.push({ a: names[i], b: names[j], count: matrix[i][j] });
      }
    }
  }
  pairs.sort((a, b) => b.count - a.count);
  const top10 = pairs.slice(0, 10);

  d3.select("#top-pairs").html('');

  if (top10.length === 0) {
    d3.select("#top-pairs").html('<div class="no-selection">No pair data for this selection</div>');
    return;
  }

  const maxCount = top10[0].count;

  d3.select("#top-pairs")
    .selectAll(".pair-item")
    .data(top10)
    .join("div")
    .attr("class", "pair-item")
    .html(d => {
      const pct = (d.count / maxCount) * 100;
      return `
        <div class="pair-label">${d.a} & ${d.b}</div>
        <div class="pair-bar-container">
          <div class="pair-bar-fill" style="width: ${pct}%"></div>
        </div>
        <div class="pair-value">${d3.format(",")(d.count)} scenes</div>
      `;
    });
}
}
