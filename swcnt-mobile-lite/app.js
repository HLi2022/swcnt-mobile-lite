const DATA_FILES = {
  semiconducting: "./data/swcnt_info_semiconducting.csv",
  metallic: "./data/swcnt_info_metallic.csv",
};

const COLORS = [
  "#1f77b4",
  "#d62728",
  "#2ca02c",
  "#9467bd",
  "#ff7f0e",
  "#17becf",
  "#bcbd22",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
];

const state = {
  db: new Map(),
  sortedKeys: [],
  selected: [],
  sigma: 8,
  gamma: 6,
  minWavelength: 350,
  maxWavelength: 2200,
  stepSize: 1,
  showTotal: true,
};

const el = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  init();
});

function cacheElements() {
  el.nInput = document.getElementById("nInput");
  el.mInput = document.getElementById("mInput");
  el.addBtn = document.getElementById("addBtn");
  el.clearBtn = document.getElementById("clearBtn");
  el.status = document.getElementById("statusMessage");
  el.sigmaSlider = document.getElementById("sigmaSlider");
  el.gammaSlider = document.getElementById("gammaSlider");
  el.sigmaValue = document.getElementById("sigmaValue");
  el.gammaValue = document.getElementById("gammaValue");
  el.minWavelength = document.getElementById("minWavelength");
  el.maxWavelength = document.getElementById("maxWavelength");
  el.stepSize = document.getElementById("stepSize");
  el.showTotalToggle = document.getElementById("showTotalToggle");
  el.selectedSpecies = document.getElementById("selectedSpecies");
  el.plotWrap = document.getElementById("plotWrap");
  el.plotSvg = document.getElementById("plotSvg");
  el.legend = document.getElementById("legend");
  el.propertyTableBody = document.querySelector("#propertyTable tbody");
}

function bindEvents() {
  el.addBtn.addEventListener("click", onAddSpecies);
  [el.nInput, el.mInput].forEach((inputEl) => {
    inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onAddSpecies();
      }
    });
  });

  el.clearBtn.addEventListener("click", () => {
    state.selected = [];
    setStatus("All selected species were cleared.");
    renderAll();
  });

  el.sigmaSlider.addEventListener("input", () => {
    state.sigma = toNumber(el.sigmaSlider.value) || 8;
    el.sigmaValue.textContent = state.sigma.toFixed(1);
    renderPlotAndTables();
  });

  el.gammaSlider.addEventListener("input", () => {
    state.gamma = toNumber(el.gammaSlider.value) || 6;
    el.gammaValue.textContent = state.gamma.toFixed(1);
    renderPlotAndTables();
  });

  el.minWavelength.addEventListener("change", () => {
    state.minWavelength = toNumber(el.minWavelength.value) || 350;
    renderPlotAndTables();
  });

  el.maxWavelength.addEventListener("change", () => {
    state.maxWavelength = toNumber(el.maxWavelength.value) || 2200;
    renderPlotAndTables();
  });

  el.stepSize.addEventListener("change", () => {
    state.stepSize = toNumber(el.stepSize.value) || 1;
    renderPlotAndTables();
  });

  el.showTotalToggle.addEventListener("change", () => {
    state.showTotal = el.showTotalToggle.checked;
    renderPlotAndTables();
  });

  let pendingResize = false;
  window.addEventListener("resize", () => {
    if (pendingResize) {
      return;
    }
    pendingResize = true;
    requestAnimationFrame(() => {
      pendingResize = false;
      renderPlotAndTables();
    });
  });
}

async function init() {
  try {
    const [semiRows, metRows] = await Promise.all([
      loadCsvRows(DATA_FILES.semiconducting),
      loadCsvRows(DATA_FILES.metallic),
    ]);

    ingestDatabase(semiRows, metRows);
    const semiCount = Array.from(state.db.values()).filter((row) => row.type === "Semiconducting").length;
    const metCount = Array.from(state.db.values()).filter((row) => row.type === "Metallic").length;
    setStatus(`Loaded ${state.db.size} entries: ${semiCount} semiconducting, ${metCount} metallic.`);
    renderAll();
  } catch (error) {
    setStatus(`Failed to load data: ${error.message}`, true);
  }

  registerServiceWorker();
}

async function loadCsvRows(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Cannot fetch ${path}`);
  }
  const csvText = await response.text();
  return parseCsv(csvText);
}

function parseCsv(text) {
  const cleaned = text.replace(/^\uFEFF/, "").trim();
  if (!cleaned) {
    return [];
  }
  const lines = cleaned.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }
  const headers = splitCsvLine(lines[0]).map((name) => name.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCsvLine(lines[i]);
    if (values.length === 0) {
      continue;
    }
    const row = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = values[j] !== undefined ? values[j].trim() : "";
    }
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line) {
  const output = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      output.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  output.push(current);
  return output;
}

function ingestDatabase(semiconductingRows, metallicRows) {
  const db = new Map();

  semiconductingRows.forEach((row) => {
    const n = toInt(row.index_n);
    const m = toInt(row.index_m);
    if (n === null || m === null) {
      return;
    }
    const key = makeKey(n, m);
    db.set(key, {
      key,
      n,
      m,
      chirality: `(${n},${m})`,
      type: "Semiconducting",
      diameter: toNumber(row.diameter),
      chiralAngle: toNumber(row.chiral_angle),
      rbm: toNumber(row.RBM),
      wl11: toNumber(row.wl11),
      wl22: toNumber(row.wl22),
      wl11Minus: null,
      wl11Plus: null,
      wl11Single: null,
    });
  });

  metallicRows.forEach((row) => {
    const n = toInt(row.index_n);
    const m = toInt(row.index_m);
    if (n === null || m === null) {
      return;
    }
    const key = makeKey(n, m);
    const wl11Minus = firstValidNumber(toNumber(row["wl11-"]), evToNm(toNumber(row["M11-"])));
    const wl11Plus = firstValidNumber(toNumber(row["wl11+"]), evToNm(toNumber(row["M11+"])));
    const wl11Single = firstValidNumber(toNumber(row.wl11), evToNm(toNumber(row.M11)));

    db.set(key, {
      key,
      n,
      m,
      chirality: `(${n},${m})`,
      type: "Metallic",
      diameter: toNumber(row.diameter),
      chiralAngle: toNumber(row.chiral_angle),
      rbm: toNumber(row.RBM),
      wl11: null,
      wl22: null,
      wl11Minus,
      wl11Plus,
      wl11Single,
    });
  });

  state.db = db;
  state.sortedKeys = Array.from(db.keys()).sort((a, b) => {
    const [na, ma] = parseKey(a);
    const [nb, mb] = parseKey(b);
    return na - nb || ma - mb;
  });
}

function onAddSpecies() {
  const parsed = parseNmInputs(el.nInput.value, el.mInput.value);
  if (!parsed) {
    setStatus("Invalid n or m. Please enter two integers, for example n=6, m=5.", true);
    return;
  }
  const key = makeKey(parsed.n, parsed.m);
  const record = state.db.get(key);
  if (!record) {
    setStatus(`(${parsed.n},${parsed.m}) is not found in data files.`, true);
    return;
  }
  const alreadyAdded = state.selected.some((item) => item.key === key);
  if (alreadyAdded) {
    setStatus(`${record.chirality} is already in the active list.`);
    return;
  }

  state.selected.push({
    key,
    amplitude: 1.0,
    shift: 0.0,
    ratio: 3.0,
  });

  el.nInput.value = "";
  el.mInput.value = "";
  setStatus(`${record.chirality} added.`);
  renderAll();
}

function parseNmInputs(nText, mText) {
  const n = toInt(nText);
  const m = toInt(mText);
  if (n === null || m === null || n < 0 || m < 0) {
    return null;
  }
  return { n, m };
}

function renderAll() {
  renderSpeciesControls();
  renderPlotAndTables();
}

function renderSpeciesControls() {
  el.selectedSpecies.innerHTML = "";
  if (state.selected.length === 0) {
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent = "No species selected. Add at least one (n,m).";
    el.selectedSpecies.appendChild(note);
    return;
  }

  state.selected.forEach((item, index) => {
    const record = state.db.get(item.key);
    if (!record) {
      return;
    }
    const card = document.createElement("article");
    card.className = "species-card";

    const head = document.createElement("div");
    head.className = "species-head";

    const titleWrap = document.createElement("div");
    const title = document.createElement("div");
    title.className = "species-title";
    title.textContent = record.chirality;
    const type = document.createElement("div");
    type.className = "species-type";
    type.textContent = record.type;
    titleWrap.appendChild(title);
    titleWrap.appendChild(type);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "mini-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      state.selected.splice(index, 1);
      renderAll();
    });

    head.appendChild(titleWrap);
    head.appendChild(removeBtn);
    card.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "species-grid";

    addSpeciesSlider({
      container: grid,
      label: "Amplitude",
      min: 0,
      max: 5,
      step: 0.05,
      value: item.amplitude,
      onInput: (value) => {
        item.amplitude = value;
        renderPlotAndTables();
      },
    });

    addSpeciesSlider({
      container: grid,
      label: "Shift (nm)",
      min: -30,
      max: 30,
      step: 0.5,
      value: item.shift,
      onInput: (value) => {
        item.shift = value;
        renderPlotAndTables();
      },
    });

    if (record.type === "Semiconducting") {
      addSpeciesSlider({
        container: grid,
        label: "S11/S22 ratio",
        min: 1,
        max: 10,
        step: 0.1,
        value: item.ratio,
        onInput: (value) => {
          item.ratio = value;
          renderPlotAndTables();
        },
      });
    }

    card.appendChild(grid);
    el.selectedSpecies.appendChild(card);
  });
}

function addSpeciesSlider(config) {
  const {
    container,
    label,
    min,
    max,
    step,
    value,
    onInput,
  } = config;

  const sliderLabel = document.createElement("label");
  sliderLabel.textContent = label;
  const sliderWrap = document.createElement("div");
  sliderWrap.style.display = "grid";
  sliderWrap.style.gridTemplateColumns = "1fr auto";
  sliderWrap.style.gap = "0.45rem";
  sliderWrap.style.alignItems = "center";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(value);

  const valueText = document.createElement("output");
  valueText.textContent = Number(value).toFixed(2);

  slider.addEventListener("input", () => {
    const numeric = toNumber(slider.value) || 0;
    valueText.textContent = numeric.toFixed(2);
    onInput(numeric);
  });

  sliderWrap.appendChild(slider);
  sliderWrap.appendChild(valueText);
  container.appendChild(sliderLabel);
  container.appendChild(sliderWrap);
}

function renderPlotAndTables() {
  const simulation = buildSimulation();
  renderPlot(simulation);
  renderLegend(simulation);
  renderPropertyTable(simulation);
}

function buildSimulation() {
  const grid = makeGrid();
  const total = new Float64Array(grid.length);
  const lines = [];

  const profile = createPseudoVoigtEvaluator(state.sigma, state.gamma);

  state.selected.forEach((item, index) => {
    const record = state.db.get(item.key);
    if (!record) {
      return;
    }

    const peaks = buildPeaks(record, item);
    if (peaks.length === 0) {
      return;
    }

    const y = new Float64Array(grid.length);
    for (let i = 0; i < grid.length; i += 1) {
      let sum = 0;
      const x = grid[i];
      for (let j = 0; j < peaks.length; j += 1) {
        const peak = peaks[j];
        sum += peak.weight * profile(x, peak.position);
      }
      y[i] = sum;
      total[i] += sum;
    }

    lines.push({
      key: item.key,
      chirality: record.chirality,
      type: record.type,
      color: COLORS[index % COLORS.length],
      peaks,
      y,
      record,
    });
  });

  return {
    grid,
    total,
    lines,
  };
}

function makeGrid() {
  let minWavelength = Math.max(250, state.minWavelength);
  let maxWavelength = Math.min(3500, state.maxWavelength);
  if (!Number.isFinite(minWavelength)) {
    minWavelength = 350;
  }
  if (!Number.isFinite(maxWavelength)) {
    maxWavelength = 2200;
  }
  if (maxWavelength <= minWavelength + 10) {
    maxWavelength = minWavelength + 10;
    el.maxWavelength.value = String(maxWavelength);
    state.maxWavelength = maxWavelength;
  }

  let step = Math.max(0.2, state.stepSize);
  if (!Number.isFinite(step)) {
    step = 1;
  }

  let pointCount = Math.floor((maxWavelength - minWavelength) / step) + 1;
  if (pointCount > 5000) {
    step = (maxWavelength - minWavelength) / 5000;
    state.stepSize = Number(step.toFixed(3));
    el.stepSize.value = String(state.stepSize);
    pointCount = 5001;
  }

  const grid = new Float64Array(pointCount);
  for (let i = 0; i < pointCount; i += 1) {
    grid[i] = minWavelength + i * step;
  }
  return grid;
}

function buildPeaks(record, item) {
  const peaks = [];
  if (record.type === "Semiconducting") {
    if (record.wl11 && record.wl11 > 0) {
      peaks.push({
        label: "S11",
        position: record.wl11 + item.shift,
        weight: item.amplitude,
      });
    }
    if (record.wl22 && record.wl22 > 0) {
      peaks.push({
        label: "S22",
        position: record.wl22 + item.shift,
        weight: item.amplitude / Math.max(item.ratio, 0.1),
      });
    }
  } else {
    if (record.wl11Minus && record.wl11Minus > 0) {
      peaks.push({
        label: "M11-",
        position: record.wl11Minus + item.shift,
        weight: item.amplitude * 0.6,
      });
    }
    if (record.wl11Plus && record.wl11Plus > 0) {
      peaks.push({
        label: "M11+",
        position: record.wl11Plus + item.shift,
        weight: item.amplitude * 0.6,
      });
    }
    if (record.wl11Single && record.wl11Single > 0) {
      peaks.push({
        label: "M11",
        position: record.wl11Single + item.shift,
        weight: item.amplitude * 0.6,
      });
    }
  }

  peaks.sort((a, b) => a.position - b.position);
  return peaks;
}

function createPseudoVoigtEvaluator(sigmaInput, gammaInput) {
  const sigma = Math.max(1e-6, sigmaInput);
  const gamma = Math.max(1e-6, gammaInput);

  const fG = 2 * sigma * Math.sqrt(2 * Math.log(2));
  const fL = 2 * gamma;
  const f = Math.pow(
    Math.pow(fG, 5)
      + 2.69269 * Math.pow(fG, 4) * fL
      + 2.42843 * Math.pow(fG, 3) * Math.pow(fL, 2)
      + 4.47163 * Math.pow(fG, 2) * Math.pow(fL, 3)
      + 0.07842 * fG * Math.pow(fL, 4)
      + Math.pow(fL, 5),
    1 / 5,
  );
  const ratio = clamp(fL / f, 0, 1);
  const eta = clamp(
    1.36603 * ratio - 0.47719 * ratio * ratio + 0.11116 * ratio * ratio * ratio,
    0,
    1,
  );

  const sigmaPv = f / (2 * Math.sqrt(2 * Math.log(2)));
  const gammaPv = f / 2;
  const normalizer = eta * (1 / (Math.PI * gammaPv))
    + (1 - eta) * (1 / (sigmaPv * Math.sqrt(2 * Math.PI)));

  return (x, mu) => {
    const delta = x - mu;
    const gaussian = Math.exp(-(delta * delta) / (2 * sigmaPv * sigmaPv))
      / (sigmaPv * Math.sqrt(2 * Math.PI));
    const lorentzian = (gammaPv / Math.PI) / (delta * delta + gammaPv * gammaPv);
    return (eta * lorentzian + (1 - eta) * gaussian) / normalizer;
  };
}

function renderPlot(simulation) {
  const { grid, lines, total } = simulation;
  const svg = el.plotSvg;
  svg.innerHTML = "";

  const width = Math.max(360, el.plotWrap.clientWidth || 360);
  const height = Math.max(320, el.plotWrap.clientHeight || 390);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const margin = {
    top: 20,
    right: 16,
    bottom: 42,
    left: 56,
  };

  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  if (plotWidth <= 0 || plotHeight <= 0) {
    return;
  }

  if (lines.length === 0) {
    const text = svgElement("text", {
      x: width / 2,
      y: height / 2,
      "text-anchor": "middle",
      "font-size": 14,
      fill: "#5d7288",
    });
    text.textContent = "Add one or more (n,m) to draw spectra";
    svg.appendChild(text);
    return;
  }

  const xMin = grid[0];
  const xMax = grid[grid.length - 1];
  const yMaxFromLines = Math.max(...lines.map((line) => maxValue(line.y)));
  let totalDisplay = null;
  if (state.showTotal) {
    const totalMax = Math.max(maxValue(total), 1e-9);
    const totalGap = 1.0;
    const totalBandHeight = Math.max(yMaxFromLines * 0.55, 0.3);
    const totalOffset = yMaxFromLines + totalGap;
    totalDisplay = new Float64Array(total.length);
    for (let i = 0; i < total.length; i += 1) {
      totalDisplay[i] = (total[i] / totalMax) * totalBandHeight + totalOffset;
    }
  }

  const yMaxCandidate = totalDisplay
    ? Math.max(yMaxFromLines, maxValue(totalDisplay))
    : yMaxFromLines;
  const yMax = Math.max(0.1, yMaxCandidate * 1.08);

  const mapX = (x) => margin.left + ((x - xMin) / (xMax - xMin)) * plotWidth;
  const mapY = (y) => height - margin.bottom - (y / yMax) * plotHeight;

  const background = svgElement("rect", {
    x: margin.left,
    y: margin.top,
    width: plotWidth,
    height: plotHeight,
    fill: "#ffffff",
    stroke: "#d6e1ef",
    "stroke-width": 1,
  });
  svg.appendChild(background);

  drawGrid(svg, { margin, width, height, plotWidth, plotHeight, yMax, xMin, xMax, mapX, mapY });

  const stride = Math.max(1, Math.floor(grid.length / 1500));

  lines.forEach((line) => {
    const path = svgElement("path", {
      d: makePath(grid, line.y, mapX, mapY, stride),
      fill: "none",
      stroke: line.color,
      "stroke-width": 1.6,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    });
    svg.appendChild(path);

    line.peaks.forEach((peak) => {
      if (peak.position < xMin || peak.position > xMax) {
        return;
      }
      const x = mapX(peak.position);
      const marker = svgElement("line", {
        x1: x,
        y1: margin.top,
        x2: x,
        y2: height - margin.bottom,
        stroke: line.color,
        "stroke-width": 1,
        "stroke-dasharray": "4 4",
        opacity: 0.42,
      });
      svg.appendChild(marker);
    });
  });

  if (state.showTotal) {
    const totalPath = svgElement("path", {
      d: makePath(grid, totalDisplay, mapX, mapY, stride),
      fill: "none",
      stroke: "#111111",
      "stroke-width": 2.1,
      "stroke-dasharray": "8 6",
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
      opacity: 0.9,
    });
    svg.appendChild(totalPath);
  }

  const xLabel = svgElement("text", {
    x: margin.left + plotWidth / 2,
    y: height - 8,
    "text-anchor": "middle",
    "font-size": 12,
    fill: "#5d7288",
  });
  xLabel.textContent = "Wavelength (nm)";
  svg.appendChild(xLabel);

  const yLabel = svgElement("text", {
    x: 15,
    y: margin.top + plotHeight / 2,
    transform: `rotate(-90 15 ${margin.top + plotHeight / 2})`,
    "text-anchor": "middle",
    "font-size": 12,
    fill: "#5d7288",
  });
  yLabel.textContent = "Absorbance (a.u.)";
  svg.appendChild(yLabel);
}

function drawGrid(svg, context) {
  const {
    margin,
    height,
    plotWidth,
    plotHeight,
    yMax,
    xMin,
    xMax,
    mapX,
    mapY,
  } = context;

  const xTicks = 6;
  const yTicks = 5;

  for (let i = 0; i <= xTicks; i += 1) {
    const ratio = i / xTicks;
    const xValue = xMin + ratio * (xMax - xMin);
    const x = mapX(xValue);

    const gridLine = svgElement("line", {
      x1: x,
      y1: margin.top,
      x2: x,
      y2: margin.top + plotHeight,
      stroke: "#edf2f8",
      "stroke-width": 1,
    });
    svg.appendChild(gridLine);

    const label = svgElement("text", {
      x,
      y: margin.top + plotHeight + 16,
      "text-anchor": "middle",
      "font-size": 11,
      fill: "#6d8196",
    });
    label.textContent = formatNumber(xValue, 0);
    svg.appendChild(label);
  }

  for (let i = 0; i <= yTicks; i += 1) {
    const ratio = i / yTicks;
    const yValue = yMax * (1 - ratio);
    const y = mapY(yValue);

    const gridLine = svgElement("line", {
      x1: margin.left,
      y1: y,
      x2: margin.left + plotWidth,
      y2: y,
      stroke: "#edf2f8",
      "stroke-width": 1,
    });
    svg.appendChild(gridLine);

    const label = svgElement("text", {
      x: margin.left - 8,
      y: y + 4,
      "text-anchor": "end",
      "font-size": 11,
      fill: "#6d8196",
    });
    label.textContent = formatNumber(yValue, yValue >= 10 ? 1 : 2);
    svg.appendChild(label);
  }

  svg.appendChild(svgElement("line", {
    x1: margin.left,
    y1: margin.top + plotHeight,
    x2: margin.left + plotWidth,
    y2: margin.top + plotHeight,
    stroke: "#7a90a6",
    "stroke-width": 1.3,
  }));

  svg.appendChild(svgElement("line", {
    x1: margin.left,
    y1: margin.top,
    x2: margin.left,
    y2: margin.top + plotHeight,
    stroke: "#7a90a6",
    "stroke-width": 1.3,
  }));
}

function renderLegend(simulation) {
  el.legend.innerHTML = "";
  if (simulation.lines.length === 0) {
    return;
  }

  if (state.showTotal) {
    const totalItem = document.createElement("span");
    totalItem.className = "legend-item";
    totalItem.innerHTML = `<span class="swatch" style="background:#111111"></span>Total (dashed, +1 offset)`;
    el.legend.appendChild(totalItem);
  }

  simulation.lines.forEach((line) => {
    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<span class="swatch" style="background:${line.color}"></span>${line.chirality} (${line.type})`;
    el.legend.appendChild(item);
  });
}

function renderPropertyTable(simulation) {
  el.propertyTableBody.innerHTML = "";
  if (simulation.lines.length === 0) {
    return;
  }

  simulation.lines.forEach((line) => {
    const record = line.record;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${record.chirality}</td>
      <td>${record.type}</td>
      <td>${formatMaybeNumber(record.diameter, 3)}</td>
      <td>${formatMaybeNumber(record.chiralAngle, 2)}</td>
      <td>${formatMaybeNumber(record.rbm, 1)}</td>
      <td>${formatMaybeNumber(record.wl11, 1)}</td>
      <td>${formatMaybeNumber(record.wl22, 1)}</td>
      <td>${formatMaybeNumber(record.wl11Minus, 1)}</td>
      <td>${formatMaybeNumber(record.wl11Plus, 1)}</td>
      <td>${formatMaybeNumber(record.wl11Single, 1)}</td>
    `;
    el.propertyTableBody.appendChild(row);
  });
}

function makePath(xArray, yArray, mapX, mapY, stride) {
  let d = "";
  const lastIndex = xArray.length - 1;
  for (let i = 0; i < xArray.length; i += stride) {
    const command = i === 0 ? "M" : "L";
    d += `${command}${mapX(xArray[i]).toFixed(2)},${mapY(yArray[i]).toFixed(2)}`;
  }
  if (lastIndex % stride !== 0) {
    d += `L${mapX(xArray[lastIndex]).toFixed(2)},${mapY(yArray[lastIndex]).toFixed(2)}`;
  }
  return d;
}

function svgElement(name, attributes) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => {
    node.setAttribute(key, String(value));
  });
  return node;
}

function setStatus(message, isError = false) {
  el.status.textContent = message;
  el.status.classList.toggle("error", isError);
}

function makeKey(n, m) {
  return `${n},${m}`;
}

function parseKey(key) {
  const [nText, mText] = key.split(",");
  return [Number(nText), Number(mText)];
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toInt(value) {
  const number = toNumber(value);
  if (number === null) {
    return null;
  }
  return Math.trunc(number);
}

function evToNm(evValue) {
  if (!evValue || evValue <= 0) {
    return null;
  }
  return 1239.841984 / evValue;
}

function firstValidNumber(...values) {
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value !== null && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatMaybeNumber(value, digits) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }
  return Number(value).toFixed(digits);
}

function formatNumber(value, digits) {
  return Number(value).toFixed(digits);
}

function maxValue(arrayLike) {
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < arrayLike.length; i += 1) {
    if (arrayLike[i] > max) {
      max = arrayLike[i];
    }
  }
  return Number.isFinite(max) ? max : 0;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
