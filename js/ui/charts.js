import { esc } from '../core/utils.js';

const W = 640;
const H = 200;
const PAD = { l: 36, r: 16, t: 14, b: 26 };
const PW = W - PAD.l - PAD.r;
const PH = H - PAD.t - PAD.b;

const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '')} mil` : String(n));

function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function axes(max, data, xAt) {
  const ticks = [0, max / 2, max];
  const grid = ticks.map((t) => {
    const y = PAD.t + PH - (t / max) * PH;
    return `<line class="chart__grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}"/>
      <text class="chart__tick" x="${PAD.l - 6}" y="${y + 4}" text-anchor="end">${fmt(Math.round(t))}</text>`;
  }).join('');
  const idx = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];
  const labels = idx.map((i, k) => `<text class="chart__tick" x="${xAt(i)}" y="${H - 6}" text-anchor="${k === 0 ? 'start' : k === idx.length - 1 ? 'end' : 'middle'}">${esc(data[i].label)}</text>`).join('');
  return grid + labels;
}

function table(data, unit) {
  return `<details class="chart__table"><summary>Ver tabela</summary>
    <table><thead><tr><th>Dia</th><th>${esc(unit)}</th></tr></thead>
    <tbody>${data.map((d) => `<tr><td>${esc(d.label)}</td><td>${d.v}</td></tr>`).join('')}</tbody></table></details>`;
}

function shell(el, svg, data, unit) {
  el.innerHTML = `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(unit)} por dia">${svg}</svg><div class="chart__tip" hidden></div></div>${table(data, unit)}`;
  return { svg: el.querySelector('svg'), tip: el.querySelector('.chart__tip'), box: el.querySelector('.chart') };
}

function bindHover({ svg, tip, box }, data, unit, indexAt, onIndex) {
  const show = (e) => {
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const i = indexAt(x);
    if (i < 0 || i >= data.length) return hide();
    onIndex(i);
    tip.hidden = false;
    tip.innerHTML = `<strong>${data[i].v}</strong> ${esc(unit.toLowerCase())}<span>${esc(data[i].full || data[i].label)}</span>`;
    const px = (onIndex.x(i) / W) * r.width;
    tip.style.left = `${Math.min(Math.max(px, 60), r.width - 60)}px`;
  };
  const hide = () => { tip.hidden = true; onIndex(-1); };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', hide);
  box.addEventListener('pointerleave', hide);
}

export function lineChart(el, data, unit) {
  if (!data.length) { el.innerHTML = ''; return; }
  const max = niceMax(Math.max(...data.map((d) => d.v)));
  const step = data.length > 1 ? PW / (data.length - 1) : 0;
  const xAt = (i) => PAD.l + i * step;
  const yAt = (v) => PAD.t + PH - (v / max) * PH;
  const pts = data.map((d, i) => `${xAt(i)},${yAt(d.v)}`);
  const last = data.length - 1;
  const svg = `${axes(max, data, xAt)}
    <path class="chart__area" d="M${xAt(0)},${PAD.t + PH} L${pts.join(' L')} L${xAt(last)},${PAD.t + PH} Z"/>
    <polyline class="chart__line" points="${pts.join(' ')}"/>
    <line class="chart__cross" y1="${PAD.t}" y2="${PAD.t + PH}" x1="0" x2="0" hidden/>
    <circle class="chart__dot chart__dot--hover" r="5" hidden/>
    <circle class="chart__dot" cx="${xAt(last)}" cy="${yAt(data[last].v)}" r="5"/>
    <text class="chart__value" x="${xAt(last) - 8}" y="${yAt(data[last].v) - 10}" text-anchor="end">${fmt(data[last].v)}</text>
    <rect x="${PAD.l}" y="${PAD.t}" width="${PW}" height="${PH}" fill="transparent"/>`;
  const parts = shell(el, svg, data, unit);
  const cross = parts.svg.querySelector('.chart__cross');
  const dot = parts.svg.querySelector('.chart__dot--hover');
  const onIndex = (i) => {
    cross.hidden = dot.hidden = i < 0;
    if (i < 0) return;
    cross.setAttribute('x1', xAt(i)); cross.setAttribute('x2', xAt(i));
    dot.setAttribute('cx', xAt(i)); dot.setAttribute('cy', yAt(data[i].v));
  };
  onIndex.x = xAt;
  bindHover(parts, data, unit, (x) => Math.round((x - PAD.l) / (step || 1)), onIndex);
}

export function columnChart(el, data, unit) {
  if (!data.length) { el.innerHTML = ''; return; }
  const max = niceMax(Math.max(...data.map((d) => d.v)));
  const band = PW / data.length;
  const bw = Math.max(2, Math.min(24, band - 2));
  const xAt = (i) => PAD.l + band * i + band / 2;
  const peak = data.reduce((m, d, i) => (d.v > data[m].v ? i : m), 0);
  const bars = data.map((d, i) => {
    const h = (d.v / max) * PH;
    if (!h) return '';
    const x = xAt(i) - bw / 2;
    const y = PAD.t + PH - h;
    const r = Math.min(4, h, bw / 2);
    return `<path class="chart__bar" data-i="${i}" d="M${x},${PAD.t + PH} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${PAD.t + PH} Z"/>`;
  }).join('');
  const peakLabel = data[peak].v ? `<text class="chart__value" x="${xAt(peak)}" y="${PAD.t + PH - (data[peak].v / max) * PH - 6}" text-anchor="middle">${fmt(data[peak].v)}</text>` : '';
  const svg = `${axes(max, data, xAt)}${bars}${peakLabel}<rect x="${PAD.l}" y="${PAD.t}" width="${PW}" height="${PH}" fill="transparent"/>`;
  const parts = shell(el, svg, data, unit);
  const onIndex = (i) => parts.svg.querySelectorAll('.chart__bar').forEach((b) => b.classList.toggle('is-dim', i >= 0 && Number(b.dataset.i) !== i));
  onIndex.x = xAt;
  bindHover(parts, data, unit, (x) => Math.floor((x - PAD.l) / band), onIndex);
}

export function barList(rows, { empty = 'Sem dados no período.', unit = '' } = {}) {
  if (!rows.length) return `<p class="muted bar-list__empty">${esc(empty)}</p>`;
  const max = Math.max(...rows.map((r) => r.v)) || 1;
  return `<ul class="bar-list">${rows.map((r) => `
    <li class="bar-list__row" title="${esc(`${r.label}: ${r.v}${unit ? ` ${unit}` : ''}`)}">
      <div class="bar-list__head"><span class="bar-list__label">${esc(r.label)}</span><span class="bar-list__value">${esc(r.display ?? String(r.v))}</span></div>
      <div class="bar-list__track"><span class="bar-list__bar" style="width:${Math.max(2, (r.v / max) * 100)}%"></span></div>
      ${r.sub ? `<div class="bar-list__sub">${esc(r.sub)}</div>` : ''}
    </li>`).join('')}</ul>`;
}
