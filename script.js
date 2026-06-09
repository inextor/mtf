const COC_MM = 0.015;
const MFT_SENSOR_WIDTH_MM = 17.3;
const MFT_SENSOR_HEIGHT_MM = 13;
const FRAMING_SUBJECT_HEIGHT_M = 2.5;
const inputs = {
  focal: document.querySelector("#focal"),
  focalRange: document.querySelector("#focalRange"),
  aperture: document.querySelector("#aperture"),
  apertureRange: document.querySelector("#apertureRange"),
  distance: document.querySelector("#distance"),
  distanceRange: document.querySelector("#distanceRange")
};
const output = {
  near: document.querySelector("#nearLimit"),
  far: document.querySelector("#farLimit"),
  total: document.querySelector("#totalDof"),
  hyperfocal: document.querySelector("#hyperfocal"),
  portraitDistance: document.querySelector("#portraitDistance"),
  landscapeDistance: document.querySelector("#landscapeDistance")
};
const actions = {
  portrait: document.querySelector("#portraitMetric"),
  landscape: document.querySelector("#landscapeMetric")
};

function readNumber(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function dof(focalMm, aperture, focusM) {
  const focusMm = focusM * 1000;
  const hyperfocalMm = (focalMm * focalMm) / (aperture * COC_MM) + focalMm;
  const nearMm = (hyperfocalMm * focusMm) / (hyperfocalMm + (focusMm - focalMm));
  const farDenominator = hyperfocalMm - (focusMm - focalMm);
  const farMm = farDenominator <= 0 ? Infinity : (hyperfocalMm * focusMm) / farDenominator;
  const nearM = nearMm / 1000;
  const farM = farMm / 1000;

  return {
    nearM,
    farM,
    totalM: Number.isFinite(farM) ? farM - nearM : Infinity,
    hyperfocalM: hyperfocalMm / 1000
  };
}

function framingDistance(focalMm, frameHeightMm) {
  return (FRAMING_SUBJECT_HEIGHT_M * focalMm) / frameHeightMm;
}

function formatMeters(value) {
  if (!Number.isFinite(value)) return "Infinity";
  if (value < 1) return `${Math.round(value * 100)} cm`;
  if (value < 10) return `${value.toFixed(2)} m`;
  if (value < 100) return `${value.toFixed(1)} m`;
  return `${Math.round(value)} m`;
}

function niceCeil(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / power;
  const step = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * power;
}

function resizeCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(320, Math.floor(rect.width * ratio));
  canvas.height = Math.max(220, Math.floor(rect.height * ratio));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function drawLine(ctx, points, xToPx, yToPx, getY, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xToPx(point.x);
    const y = yToPx(getY(point));
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawChart(canvas, startM, endM, focalMm, aperture) {
  const { ctx, width, height } = resizeCanvas(canvas);
  const pad = { left: 58, right: 18, top: 18, bottom: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const samples = 180;
  const points = [];
  let maxY = 0;

  for (let i = 0; i <= samples; i += 1) {
    const x = startM + ((endM - startM) * i) / samples;
    const value = dof(focalMm, aperture, Math.max(0.1, x));
    points.push({ x, ...value });
    maxY = Math.max(maxY, value.nearM, value.hyperfocalM > x ? Math.min(value.farM, endM * 1.5) : 0, Number.isFinite(value.totalM) ? value.totalM : endM * 1.5);
  }

  const yMax = niceCeil(Math.max(maxY, endM));
  const xToPx = (x) => pad.left + ((x - startM) / (endM - startM)) * plotW;
  const yToPx = (y) => pad.top + plotH - (Math.min(y, yMax) / yMax) * plotH;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#e5e9f0";
  ctx.lineWidth = 1;
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#667085";

  for (let i = 0; i <= 5; i += 1) {
    const y = (yMax * i) / 5;
    const py = yToPx(y);
    ctx.beginPath();
    ctx.moveTo(pad.left, py);
    ctx.lineTo(width - pad.right, py);
    ctx.stroke();
    ctx.fillText(formatMeters(y), 8, py + 4);
  }

  const xTicks = endM <= 10 ? 9 : 5;
  for (let i = 0; i <= xTicks; i += 1) {
    const x = startM + ((endM - startM) * i) / xTicks;
    const px = xToPx(x);
    ctx.beginPath();
    ctx.moveTo(px, pad.top);
    ctx.lineTo(px, height - pad.bottom);
    ctx.stroke();
    ctx.fillText(`${Math.round(x)} m`, px - 12, height - 18);
  }

  ctx.strokeStyle = "#aeb7c4";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, height - pad.bottom);
  ctx.lineTo(width - pad.right, height - pad.bottom);
  ctx.stroke();

  drawLine(ctx, points, xToPx, yToPx, (p) => p.nearM, "#176b87", 2.5);
  drawLine(ctx, points, xToPx, yToPx, (p) => Number.isFinite(p.farM) ? p.farM : yMax, "#c7532c", 2.5);
  drawLine(ctx, points, xToPx, yToPx, (p) => Number.isFinite(p.totalM) ? p.totalM : yMax, "#237a57", 2.5);

  const focusDistance = readNumber(inputs.distance, 3);
  if (focusDistance >= startM && focusDistance <= endM) {
    const px = xToPx(focusDistance);
    ctx.strokeStyle = "#17202a";
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(px, pad.top);
    ctx.lineTo(px, height - pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#17202a";
    ctx.fillText("focus", Math.min(px + 6, width - 58), pad.top + 14);
  }
}

function syncPair(source, target) {
  target.value = source.value;
}

function setFocusDistance(distanceM) {
  const roundedDistance = distanceM.toFixed(2);
  inputs.distance.value = roundedDistance;
  inputs.distanceRange.value = Math.min(distanceM, Number(inputs.distanceRange.max));
  render();
}

function render() {
  const focal = readNumber(inputs.focal, 25);
  const aperture = readNumber(inputs.aperture, 2.8);
  const distance = readNumber(inputs.distance, 3);
  const value = dof(focal, aperture, distance);

  output.near.textContent = formatMeters(value.nearM);
  output.far.textContent = formatMeters(value.farM);
  output.total.textContent = formatMeters(value.totalM);
  output.hyperfocal.textContent = formatMeters(value.hyperfocalM);
  output.portraitDistance.textContent = formatMeters(framingDistance(focal, MFT_SENSOR_WIDTH_MM));
  output.landscapeDistance.textContent = formatMeters(framingDistance(focal, MFT_SENSOR_HEIGHT_MM));

  drawChart(document.querySelector("#chartShort"), 1, 10, focal, aperture);
  drawChart(document.querySelector("#chartLong"), 0, 100, focal, aperture);
}

[
  ["focal", "focalRange"],
  ["aperture", "apertureRange"],
  ["distance", "distanceRange"]
].forEach(([numberKey, rangeKey]) => {
  inputs[numberKey].addEventListener("input", () => {
    syncPair(inputs[numberKey], inputs[rangeKey]);
    render();
  });
  inputs[rangeKey].addEventListener("input", () => {
    syncPair(inputs[rangeKey], inputs[numberKey]);
    render();
  });
});

actions.portrait.addEventListener("click", () => {
  const focal = readNumber(inputs.focal, 25);
  setFocusDistance(framingDistance(focal, MFT_SENSOR_WIDTH_MM));
});

actions.landscape.addEventListener("click", () => {
  const focal = readNumber(inputs.focal, 25);
  setFocusDistance(framingDistance(focal, MFT_SENSOR_HEIGHT_MM));
});

window.addEventListener("resize", render);
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}
