/* Kolkata LST — interactive map
 * After running gee/kolkata_lst.js, paste the printed tile URL into GEE_TILE_URL below.
 */

// >>> PASTE the urlFormat printed by the GEE script here <<<
const GEE_TILE_URL = "https://earthengine.googleapis.com/v1/projects/digital-splicer-464020-e9/maps/0ad1981181681025a896b1cdd60bd61e-75aa06878ac8d7a84ada6390ce96dcc0/tiles/{z}/{x}/{y}";

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

// Click shows coordinates (temperature read-out requires the GEE FeatureServer;
// the static map and legend convey the temperature scale).
map.on('click', e => {
  L.popup()
    .setLatLng(e.latlng)
    .setContent(`Lat ${e.latlng.lat.toFixed(4)}, Lng ${e.latlng.lng.toFixed(4)}`)
    .openOn(map);
});
