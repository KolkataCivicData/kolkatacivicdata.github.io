/* Kolkata LST — interactive map
 * After running gee/kolkata_lst.js, paste the printed tile URL into GEE_TILE_URL below.
 * The hover temperature read-out uses assets/kolkata_lst_grid.csv exported from the GEE script.
 */

// >>> PASTE the urlFormat printed by the GEE script here <<<
const GEE_TILE_URL = "https://earthengine.googleapis.com/v1/projects/digital-splicer-464020-e9/maps/0ad1981181681025a896b1cdd60bd61e-75aa06878ac8d7a84ada6390ce96dcc0/tiles/{z}/{x}/{y}";

// Grid CSV exported from Earth Engine (columns: r,c,lon,lat,lst).
const GRID_CSV_URL = "assets/kolkata_lst_grid.csv";

const PALETTE = ['#040274','#0502a3','#0502ce','#235cb1','#307ef3',
                 '#30c8e2','#3be285','#86e26f','#b5e22e','#d28e00',
                 '#d06d00','#e03f00','#c61700','#911003'];
const LST_MIN = 24, LST_MAX = 45;

const map = L.map('map').setView([22.5726, 88.3639], 11);

// OpenStreetMap base
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// LST overlay (Earth Engine tiles)
let lstLayer = null;
if (GEE_TILE_URL && !GEE_TILE_URL.startsWith("PASTE")) {
  lstLayer = L.tileLayer(GEE_TILE_URL, {
    opacity: 0.7,
    attribution: 'LST: NASA/USGS Landsat 8/9 C2 L2 via Google Earth Engine'
  }).addTo(map);
}

// --- Legend ---
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'legend');
  div.innerHTML = '<b>LST (°C)</b><br>';
  const step = (LST_MAX - LST_MIN) / PALETTE.length;
  for (let i = PALETTE.length - 1; i >= 0; i--) {
    const lo = (LST_MIN + i * step).toFixed(0);
    div.innerHTML += `<i style="background:${PALETTE[i]}"></i>${lo}<br>`;
  }
  if (!lstLayer) {
    div.innerHTML += '<div class="note">Add your GEE tile URL in <code>map.js</code> to show the LST layer.</div>';
  }
  return div;
};
legend.addTo(map);

// --- Opacity control ---
const panel = L.control({ position: 'topright' });
panel.onAdd = function () {
  const div = L.DomUtil.create('div', 'panel');
  div.innerHTML = '<label>LST opacity</label>' +
    '<input id="op" type="range" min="0" max="100" value="70" style="width:140px">';
  L.DomEvent.disableClickPropagation(div);
  return div;
};
panel.addTo(map);

map.whenReady(() => {
  const op = document.getElementById('op');
  if (op) op.addEventListener('input', e => { if (lstLayer) lstLayer.setOpacity(e.target.value / 100); });
});

/* ============================================================
 *  Hover temperature read-out, backed by the exported grid.
 * ============================================================ */

const readout = L.control({ position: 'bottomleft' });
readout.onAdd = function () {
  this._div = L.DomUtil.create('div', 'panel');
  this._div.innerHTML = '<b>LST</b>: loading grid…';
  return this._div;
};
readout.update = function (html) { if (this._div) this._div.innerHTML = html; };
readout.addTo(map);

let GRID = null;  // { lon0, lon1, lat0, lat1, rows, cols, values[rows][cols] }

function parseGridCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',').map(s => s.trim());
  const ri = header.indexOf('r'), ci = header.indexOf('c'), lsti = header.indexOf('lst');
  let maxR = 0, maxC = 0;
  const recs = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const p = lines[i].split(',');
    const r = parseInt(p[ri], 10), c = parseInt(p[ci], 10);
    const lst = p[lsti] === '' ? null : parseFloat(p[lsti]);
    if (Number.isNaN(r) || Number.isNaN(c)) continue;
    maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
    recs.push([r, c, lst]);
  }
  const rows = maxR + 1, cols = maxC + 1;
  const values = Array.from({ length: rows }, () => new Array(cols).fill(null));
  for (const rec of recs) values[rec[0]][rec[1]] = rec[2];
  return { lon0: 88.20, lon1: 88.50, lat0: 22.40, lat1: 22.70, rows, cols, values };
}

function lstAt(lat, lng) {
  if (!GRID) return null;
  const { lon0, lon1, lat0, lat1, rows, cols, values } = GRID;
  if (lng < lon0 || lng > lon1 || lat < lat0 || lat > lat1) return null;
  const c = Math.round((lng - lon0) / (lon1 - lon0) * (cols - 1));
  const r = Math.round((lat1 - lat) / (lat1 - lat0) * (rows - 1));
  if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
  return values[r][c];
}

function colourFor(t) {
  if (t == null) return '#999';
  const f = Math.max(0, Math.min(1, (t - LST_MIN) / (LST_MAX - LST_MIN)));
  return PALETTE[Math.min(PALETTE.length - 1, Math.floor(f * PALETTE.length))];
}

fetch(GRID_CSV_URL)
  .then(res => { if (!res.ok) throw new Error('grid not found'); return res.text(); })
  .then(text => { GRID = parseGridCsv(text); readout.update('<b>LST</b>: move cursor over the map'); })
  .catch(() => { readout.update('<b>LST</b>: grid unavailable<br><span style="font-size:.7rem;color:#777">export assets/kolkata_lst_grid.csv</span>'); });

map.on('mousemove', e => {
  if (!GRID) return;
  const t = lstAt(e.latlng.lat, e.latlng.lng);
  if (t == null) {
    readout.update('<b>LST</b>: — (outside area)');
  } else {
    readout.update(
      `<b>LST</b>: <span style="display:inline-block;width:12px;height:12px;background:${colourFor(t)};vertical-align:middle;margin:0 4px;border:1px solid #0003"></span>${t.toFixed(1)} °C` +
      `<br><span style="font-size:.7rem;color:#777">${e.latlng.lat.toFixed(3)}, ${e.latlng.lng.toFixed(3)}</span>`
    );
  }
});

map.on('click', e => {
  const t = lstAt(e.latlng.lat, e.latlng.lng);
  const tempStr = (t == null) ? 'n/a' : `${t.toFixed(1)} °C`;
  L.popup()
    .setLatLng(e.latlng)
    .setContent(`LST: ${tempStr}<br>Lat ${e.latlng.lat.toFixed(4)}, Lng ${e.latlng.lng.toFixed(4)}`)
    .openOn(map);
});
