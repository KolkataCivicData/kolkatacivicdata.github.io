/* Kolkata LST - interactive map (enhanced)
 * Data exported from gee/kolkata_lst.js. Assets in public/lst/assets/
 * Features: live LST tiles + mean grid, click-to-inspect (exact C, NDVI, land use,
 * per-pixel time-series, acquisition dates), NDVI/water/land-use overlays,
 * difference map between two dates, UHI transect profile, histogram, stats card,
 * legend ticks, satellite basemap, mobile-friendly cards. */

const GEE_TILE_URL = 'https://earthengine.googleapis.com/v1/projects/digital-splicer-464020-e9/maps/9af263be9ea4abcf5ccec593dbabd490-7d5786e7abecb0c3659459f188513fca/tiles/{z}/{x}/{y}';

const A = {
  grid:   'assets/kolkata_lst_grid.csv',
  byDate: 'assets/kolkata_lst_by_date.csv',
  ndvi:   'assets/kolkata_ndvi_grid.csv',
  lulc:   'assets/kolkata_lulc_grid.csv',
  stats:  'assets/kolkata_lst_stats_by_date.csv',
  water:  'assets/kolkata_water.geojson',
  ndviPng:'assets/kolkata_ndvi_static.png',
  lulcPng:'assets/kolkata_lulc_static.png'
};

const PALETTE = ['#040274','#0502a3','#0502ce','#235cb1','#307ef3',
  '#30c8e2','#3be285','#86e26f','#b5e22e','#d28e00',
  '#d06d00','#e03f00','#c61700','#911003'];
const LST_MIN = 24, LST_MAX = 45;
const BOUNDS = { lon0:88.20, lon1:88.50, lat0:22.40, lat1:22.70, rows:60, cols:60 };
const STATIC_BOUNDS = [[BOUNDS.lat0, BOUNDS.lon0],[BOUNDS.lat1, BOUNDS.lon1]];


// ===== Map & basemaps =====
const map = L.map('map', { zoomControl:true }).setView([22.5726, 88.3639], 11);
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom:19, attribution:'&copy; OpenStreetMap contributors' }).addTo(map);
const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom:19, attribution:'Imagery &copy; Esri, Maxar, Earthstar Geographics' });

let lstLayer = null;
if (GEE_TILE_URL && GEE_TILE_URL.indexOf('PASTE') !== 0) {
  lstLayer = L.tileLayer(GEE_TILE_URL, { opacity:0.7,
    attribution:'LST: NASA/USGS Landsat 8/9 C2 L2 via Google Earth Engine' }).addTo(map);
}
const ndviLayer = L.imageOverlay(A.ndviPng, STATIC_BOUNDS, { opacity:0.75, attribution:'NDVI: Landsat 8/9 via GEE' });
const lulcLayer = L.imageOverlay(A.lulcPng, STATIC_BOUNDS, { opacity:0.70, attribution:'Land use: Landsat 8/9 via GEE' });
let waterLayer = L.layerGroup();

const baseMaps = { 'OpenStreetMap': osm, 'Satellite (Esri)': sat };
const overlays = {};
if (lstLayer) overlays['LST (live tiles)'] = lstLayer;
overlays['NDVI (vegetation)'] = ndviLayer;
overlays['Land use'] = lulcLayer;
overlays['Water bodies'] = waterLayer;
L.control.layers(baseMaps, overlays, { position:'topright', collapsed:false }).addTo(map);


// ===== Helpers =====
function colourFor(t){
  if (t==null || isNaN(t)) return '#999';
  const f=Math.max(0,Math.min(1,(t-LST_MIN)/(LST_MAX-LST_MIN)));
  return PALETTE[Math.min(PALETTE.length-1, Math.floor(f*PALETTE.length))];
}
function diffColour(d){
  const x=Math.max(-8,Math.min(8,d))/8;
  if (x>=0){ const g=Math.round(255*(1-x)); return 'rgb(255,'+g+','+g+')'; }
  const g=Math.round(255*(1+x)); return 'rgb('+g+','+g+',255)';
}
function cellCenter(r,c){
  const lon=BOUNDS.lon0 + c/(BOUNDS.cols-1)*(BOUNDS.lon1-BOUNDS.lon0);
  const lat=BOUNDS.lat1 - r/(BOUNDS.rows-1)*(BOUNDS.lat1-BOUNDS.lat0);
  return [lat,lon];
}
function rcFor(lat,lng){
  if (lng<BOUNDS.lon0||lng>BOUNDS.lon1||lat<BOUNDS.lat0||lat>BOUNDS.lat1) return null;
  const c=Math.round((lng-BOUNDS.lon0)/(BOUNDS.lon1-BOUNDS.lon0)*(BOUNDS.cols-1));
  const r=Math.round((BOUNDS.lat1-lat)/(BOUNDS.lat1-BOUNDS.lat0)*(BOUNDS.rows-1));
  return [r,c];
}
function parseCsv(text){
  const lines=text.trim().split(/\r?\n/);
  const header=lines[0].split(',').map(function(s){return s.trim();});
  const rows=[];
  for (let i=1;i<lines.length;i++){
    if(!lines[i]) continue;
    const p=lines[i].split(',');
    const o={};
    for (let j=0;j<header.length;j++) o[header[j]]=p[j];
    rows.push(o);
  }
  return {header:header, rows:rows};
}
function blankGrid(){ return Array.from({length:BOUNDS.rows},function(){return new Array(BOUNDS.cols).fill(null);}); }


// ===== Data stores =====
let MEAN=null, NDVI=null, LULC=null, BYDATE=null, DATES=[], STATS=null;

function loadMean(text){
  const o=parseCsv(text), g=blankGrid();
  o.rows.forEach(function(x){ const r=Math.round(+x.r),c=Math.round(+x.c); g[r][c]= x.lst===''?null:parseFloat(x.lst); });
  return g;
}
function loadValueGrid(text,key){
  const o=parseCsv(text), g=blankGrid();
  o.rows.forEach(function(x){ const r=Math.round(+x.r),c=Math.round(+x.c); g[r][c]= (x[key]===''||x[key]==null)?null:parseFloat(x[key]); });
  return g;
}
function loadByDate(text){
  const o=parseCsv(text), acc={};
  o.rows.forEach(function(x){
    const d=x.date, r=Math.round(+x.r), c=Math.round(+x.c), v=x.lst===''?null:parseFloat(x.lst);
    if (v==null||isNaN(v)) return;
    acc[d]=acc[d]||{};
    const k=r+'_'+c, cur=acc[d][k]||{s:0,n:0}; cur.s+=v; cur.n++; acc[d][k]=cur;
  });
  const out={};
  Object.keys(acc).forEach(function(d){
    const g=blankGrid();
    Object.keys(acc[d]).forEach(function(k){ const a=k.split('_'); g[+a[0]][+a[1]]=acc[d][k].s/acc[d][k].n; });
    out[d]=g;
  });
  return out;
}
function loadStats(text){
  const o=parseCsv(text), acc={};
  o.rows.forEach(function(x){
    const d=x.date; if(!d) return;
    const cur=acc[d]||{m:0,mn:0,mx:0,n:0};
    cur.m+=parseFloat(x.mean); cur.mn+=parseFloat(x.min); cur.mx+=parseFloat(x.max); cur.n++; acc[d]=cur;
  });
  const out={};
  Object.keys(acc).forEach(function(d){ const a=acc[d]; out[d]={mean:a.m/a.n,min:a.mn/a.n,max:a.mx/a.n}; });
  return out;
}


// ===== UI scaffolding =====
const css=document.createElement('style');
css.textContent = [
  '#map { height: calc(100vh - 139px); }',
  '.side{position:absolute;top:0;right:0;width:330px;max-width:88vw;height:100%;background:#fff;box-shadow:-2px 0 10px rgba(0,0,0,.15);z-index:1200;overflow-y:auto;transform:translateX(100%);transition:transform .25s ease;padding:14px 14px 50px;}',
  '.side.open{transform:translateX(0);}',
  '.side h3{margin:6px 0 2px;font-size:.95rem;}',
  '.side .muted{color:#777;font-size:.72rem;}',
  '.side .card{border:1px solid #eee;border-radius:8px;padding:10px;margin:10px 0;}',
  '.side .big{font-size:1.4rem;font-weight:700;}',
  '.side-toggle{position:absolute;top:10px;right:10px;z-index:1300;background:#1a1a2e;color:#fff;border:none;border-radius:6px;padding:8px 12px;font:600 12px system-ui;cursor:pointer;}',
  '.side-close{float:right;border:none;background:#f0f0f0;border-radius:6px;cursor:pointer;padding:4px 8px;}',
  '.tool-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0;}',
  '.tool-row select,.tool-row button{font:500 12px system-ui;padding:5px 8px;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer;}',
  '.swatch{display:inline-block;width:12px;height:12px;border:1px solid #0003;vertical-align:middle;margin-right:4px;}',
  'canvas.chart{width:100%;height:130px;display:block;}',
  '.legend{background:#fff;padding:10px 12px;border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,.3);font-size:.78rem;line-height:1.35;}',
  '.legend i{display:inline-block;width:16px;height:12px;margin-right:6px;vertical-align:middle;}',
  '.panel{background:#fff;padding:8px 10px;border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,.3);font-size:.8rem;}',
  '@media (max-width:640px){ .side{width:100%;max-width:100%;} .leaflet-popup-content{font-size:13px;} .leaflet-control-layers{font-size:12px;} }'
].join('\n');
document.head.appendChild(css);


const sideBtn=document.createElement('button');
sideBtn.className='side-toggle'; sideBtn.textContent='Charts & tools';
document.body.appendChild(sideBtn);
const side=document.createElement('div'); side.className='side';
side.innerHTML = [
  '<button class="side-close" id="sideClose">Close</button>',
  '<h3>Date</h3><div class="tool-row"><select id="dateSel"></select></div>',
  '<div class="card" id="statsCard"><h3 style="margin-top:0">City-wide stats</h3>',
  '<div class="muted" id="statsDate"></div>',
  '<div style="display:flex;gap:14px;margin-top:6px;flex-wrap:wrap">',
  '<div><div class="muted">Mean</div><div class="big" id="stMean">-</div></div>',
  '<div><div class="muted">Hotspot</div><div class="big" style="color:#c61700" id="stMax">-</div></div>',
  '<div><div class="muted">Coolest</div><div class="big" style="color:#235cb1" id="stMin">-</div></div>',
  '</div></div>',
  '<div class="card"><h3 style="margin-top:0">Histogram - current view</h3><canvas id="histChart" class="chart"></canvas><div class="muted" id="histMeta"></div></div>',
  '<div class="card"><h3 style="margin-top:0">Pixel time-series</h3><div class="muted" id="tsMeta">Click the map to pick a pixel.</div><canvas id="tsChart" class="chart"></canvas></div>',
  '<div class="card"><h3 style="margin-top:0">Difference map</h3><div class="tool-row"><select id="diffA"></select><span>to</span><select id="diffB"></select></div><div class="tool-row"><button id="diffRun">Show difference</button><button id="diffClear">Clear</button></div><div class="muted">B minus A. Red = warmer on B, blue = cooler.</div></div>',
  '<div class="card"><h3 style="margin-top:0">Heat-island transect</h3><div class="tool-row"><button id="lineDraw">Draw line</button><button id="lineClear">Clear</button></div><div class="muted" id="lineMeta">Draw a line across the city for an LST profile.</div><canvas id="lineChart" class="chart"></canvas></div>'
].join('');
document.body.appendChild(side);
sideBtn.onclick=function(){ side.classList.add('open'); };
document.getElementById('sideClose').onclick=function(){ side.classList.remove('open'); };


// ===== Legend with real tick marks =====
const legend = L.control({ position:'bottomright' });
legend.onAdd = function(){
  const div=L.DomUtil.create('div','legend');
  let html='<b>LST (C)</b><br>';
  const step=(LST_MAX-LST_MIN)/PALETTE.length;
  for (let i=PALETTE.length-1;i>=0;i--){
    const lo=(LST_MIN+i*step).toFixed(0), hi=(LST_MIN+(i+1)*step).toFixed(0);
    html+='<i style="background:'+PALETTE[i]+'"></i>'+lo+'-'+hi+'<br>';
  }
  if(!lstLayer) html+='<div style="font-size:.7rem;color:#777">Live LST tiles unavailable; using grid.</div>';
  div.innerHTML=html; return div;
};
legend.addTo(map);

const opCtl = L.control({ position:'topright' });
opCtl.onAdd=function(){
  const d=L.DomUtil.create('div','panel');
  d.innerHTML='<label>LST opacity</label><br><input id="op" type="range" min="0" max="100" value="70" style="width:150px">';
  L.DomEvent.disableClickPropagation(d); return d;
};
opCtl.addTo(map);
map.whenReady(function(){ const op=document.getElementById('op'); if(op) op.addEventListener('input', function(e){ if(lstLayer) lstLayer.setOpacity(e.target.value/100); }); });

// ===== Tiny canvas charts (no external libs) =====
function drawBars(canvas, labels, values, color){
  const dpr=window.devicePixelRatio||1; const w=canvas.clientWidth||300, h=canvas.clientHeight||130;
  canvas.width=w*dpr; canvas.height=h*dpr; const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,w,h); if(!values.length) return;
  const max=Math.max.apply(null,values)||1; const bw=w/values.length;
  for (let i=0;i<values.length;i++){ const bh=(values[i]/max)*(h-22); ctx.fillStyle=(typeof color==='function')?color(i):color; ctx.fillRect(i*bw+1, h-18-bh, Math.max(1,bw-2), bh); }
  ctx.fillStyle='#777'; ctx.font='9px system-ui';
  ctx.fillText(labels[0]||'', 2, h-4); ctx.fillText(labels[labels.length-1]||'', w-40, h-4);
}
function drawLine(canvas, labels, values){
  const dpr=window.devicePixelRatio||1; const w=canvas.clientWidth||300, h=canvas.clientHeight||130;
  canvas.width=w*dpr; canvas.height=h*dpr; const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,w,h); const pts=values.filter(function(v){return v!=null && !isNaN(v);}); if(pts.length<1) return;
  const mn=Math.min.apply(null,pts), mx=Math.max.apply(null,pts), rng=(mx-mn)||1;
  ctx.strokeStyle='#c61700'; ctx.lineWidth=2; ctx.beginPath(); let started=false;
  for (let i=0;i<values.length;i++){ if(values[i]==null||isNaN(values[i])) continue; const x=(values.length<=1)?w/2:(i/(values.length-1))*(w-8)+4; const y=h-16-((values[i]-mn)/rng)*(h-26); if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y); ctx.fillStyle='#c61700'; ctx.fillRect(x-2,y-2,4,4); }
  ctx.stroke();
  ctx.fillStyle='#777'; ctx.font='9px system-ui'; ctx.fillText(mx.toFixed(1)+'C',2,10); ctx.fillText(mn.toFixed(1)+'C',2,h-2);
  ctx.fillText(labels[0]||'',w*0.0+24,h-2); ctx.fillText(labels[labels.length-1]||'',w-46,h-2);
}


// ===== Load all data =====
function fetchText(u){ return fetch(u).then(function(r){ if(!r.ok) throw new Error(u); return r.text(); }); }
Promise.all([
  fetchText(A.grid).then(loadMean).catch(function(){return null;}),
  fetchText(A.ndvi).then(function(t){return loadValueGrid(t,'ndvi');}).catch(function(){return null;}),
  fetchText(A.lulc).then(function(t){return loadValueGrid(t,'lulc');}).catch(function(){return null;}),
  fetchText(A.byDate).then(loadByDate).catch(function(){return null;}),
  fetchText(A.stats).then(loadStats).catch(function(){return null;}),
  fetchText(A.water).then(JSON.parse).catch(function(){return null;})
]).then(function(res){
  MEAN=res[0]; NDVI=res[1]; LULC=res[2]; BYDATE=res[3]; STATS=res[4]; const water=res[5];
  DATES = BYDATE ? Object.keys(BYDATE).sort() : [];
  if (water){ L.geoJSON(water, { style:{color:'#1f6fb2',weight:1,fillColor:'#3aa0e0',fillOpacity:0.55} }).addTo(waterLayer); }
  buildDateSelectors();
  updateStats(currentDate());
  updateHistogram();
  readout.update('LST grid ready - hover or click the map.');
}).catch(function(e){ readout.update('Some data failed to load.'); });

function currentDate(){ const s=document.getElementById('dateSel'); return s && s.value ? s.value : (DATES[0]||null); }
function activeGrid(){ const d=currentDate(); return (d && BYDATE && BYDATE[d]) ? BYDATE[d] : MEAN; }

function buildDateSelectors(){
  const sel=document.getElementById('dateSel'), dA=document.getElementById('diffA'), dB=document.getElementById('diffB');
  [sel,dA,dB].forEach(function(s){ if(!s) return; s.innerHTML=''; DATES.forEach(function(d){ const o=document.createElement('option'); o.value=d; o.textContent=d; s.appendChild(o); }); });
  if (sel) { const o=document.createElement('option'); o.value=''; o.textContent='Mean (Apr-Jun)'; sel.insertBefore(o, sel.firstChild); sel.value=''; }
  if (dA && DATES.length) dA.value=DATES[0];
  if (dB && DATES.length) dB.value=DATES[DATES.length-1];
  if (sel) sel.addEventListener('change', function(){ updateStats(currentDate()); updateHistogram(); });
}

function updateStats(date){
  const md=document.getElementById('statsDate'); const eM=document.getElementById('stMean'), eX=document.getElementById('stMax'), eN=document.getElementById('stMin');
  if (!eM) return;
  if (date && STATS && STATS[date]){ const s=STATS[date]; md.textContent=date; eM.textContent=s.mean.toFixed(1)+' C'; eX.textContent=s.max.toFixed(1)+' C'; eN.textContent=s.min.toFixed(1)+' C'; return; }
  const g=activeGrid(); let sum=0,n=0,mx=-Infinity,mn=Infinity;
  if(g) for (let r=0;r<BOUNDS.rows;r++) for (let c=0;c<BOUNDS.cols;c++){ const v=g[r][c]; if(v==null||isNaN(v))continue; sum+=v;n++; if(v>mx)mx=v; if(v<mn)mn=v; }
  md.textContent=date?date:'Mean composite (Apr-Jun)';
  eM.textContent=n?(sum/n).toFixed(1)+' C':'-'; eX.textContent=n?mx.toFixed(1)+' C':'-'; eN.textContent=n?mn.toFixed(1)+' C':'-';
}


// ===== Histogram for current view extent =====
function updateHistogram(){
  const cv=document.getElementById('histChart'); if(!cv) return;
  const g=activeGrid(); if(!g){ return; }
  const b=map.getBounds(); const nb=20; const bins=new Array(nb).fill(0); let n=0;
  for (let r=0;r<BOUNDS.rows;r++) for (let c=0;c<BOUNDS.cols;c++){
    const v=g[r][c]; if(v==null||isNaN(v)) continue;
    const ll=cellCenter(r,c); if(!b.contains(L.latLng(ll[0],ll[1]))) continue;
    let idx=Math.floor((v-LST_MIN)/(LST_MAX-LST_MIN)*nb); idx=Math.max(0,Math.min(nb-1,idx)); bins[idx]++; n++;
  }
  const labels=[LST_MIN+'C']; labels[nb-1]=LST_MAX+'C';
  drawBars(cv, [String(LST_MIN), String(LST_MAX)], bins, function(i){ return colourFor(LST_MIN+(i+0.5)/nb*(LST_MAX-LST_MIN)); });
  document.getElementById('histMeta').textContent = n+' pixels in view';
}
map.on('moveend', updateHistogram);

// ===== Hover readout =====
const readout = L.control({ position:'bottomleft' });
readout.onAdd=function(){ this._d=L.DomUtil.create('div','panel'); this._d.innerHTML='LST: loading grid...'; return this._d; };
readout.update=function(html){ if(this._d) this._d.innerHTML=html; };
readout.addTo(map);
map.on('mousemove', function(e){
  const g=activeGrid(); if(!g) return; const rc=rcFor(e.latlng.lat,e.latlng.lng);
  if(!rc){ readout.update('LST: - (outside area)'); return; }
  const t=g[rc[0]][rc[1]];
  if(t==null||isNaN(t)){ readout.update('LST: no data here'); return; }
  readout.update('LST: <span class="swatch" style="background:'+colourFor(t)+'"></span>'+t.toFixed(1)+' C');
});

// ===== Click-to-inspect =====
function pixelSeries(r,c){ return DATES.map(function(d){ const g=BYDATE[d]; return g?g[r][c]:null; }); }
map.on('click', function(e){
  if (window.__lineActive) return;
  const rc=rcFor(e.latlng.lat,e.latlng.lng); if(!rc) return; const r=rc[0],c=rc[1];
  const g=activeGrid(); const t=g?g[r][c]:null;
  const nd=NDVI?NDVI[r][c]:null; const lu=LULC?Math.round(LULC[r][c]):null;
  const luName={1:'Water',2:'Green / vegetation',3:'Built-up'}[lu]||'-';
  const luCls={1:'lulc-1',2:'lulc-2',3:'lulc-3'}[lu]||'';
  const d=currentDate();
  let html='<div style="min-width:170px">';
  html+='<div style="font-weight:700;font-size:14px"><span class="swatch" style="background:'+colourFor(t)+'"></span>'+(t==null||isNaN(t)?'no data':t.toFixed(1)+' C')+'</div>';
  html+='<div class="muted" style="color:#777;font-size:11px">'+(d?('Date: '+d):'Mean composite (Apr-Jun 2026)')+'</div>';
  html+='<div style="font-size:12px;margin-top:4px">NDVI: '+(nd==null||isNaN(nd)?'-':nd.toFixed(2))+'</div>';
  html+='<div style="font-size:12px">Land use: <span class="'+luCls+'">'+luName+'</span></div>';
  html+='<div class="muted" style="color:#777;font-size:11px;margin-top:4px">'+e.latlng.lat.toFixed(4)+', '+e.latlng.lng.toFixed(4)+'</div>';
  if (DATES.length){ html+='<canvas id="popTs" width="190" height="70" style="width:190px;height:70px;margin-top:6px"></canvas>'; html+='<div class="muted" style="color:#777;font-size:10px">LST across '+DATES.length+' dates</div>'; }
  html+='</div>';
  L.popup({maxWidth:230}).setLatLng(e.latlng).setContent(html).openOn(map);
  if (DATES.length){ setTimeout(function(){ const cv=document.getElementById('popTs'); if(cv) drawLine(cv, DATES, pixelSeries(r,c)); },30); }
  const ts=document.getElementById('tsChart'); if(ts && DATES.length){ drawLine(ts, DATES, pixelSeries(r,c)); document.getElementById('tsMeta').textContent='Pixel '+e.latlng.lat.toFixed(3)+', '+e.latlng.lng.toFixed(3); }
});


// ===== Difference map =====
let diffLayer=L.layerGroup().addTo(map);
function renderDiff(a,b){
  diffLayer.clearLayers();
  if(!BYDATE||!BYDATE[a]||!BYDATE[b]) return;
  const ga=BYDATE[a], gb=BYDATE[b];
  const dLat=(BOUNDS.lat1-BOUNDS.lat0)/(BOUNDS.rows-1), dLon=(BOUNDS.lon1-BOUNDS.lon0)/(BOUNDS.cols-1);
  for (let r=0;r<BOUNDS.rows;r++) for (let c=0;c<BOUNDS.cols;c++){
    const va=ga[r][c], vb=gb[r][c]; if(va==null||vb==null||isNaN(va)||isNaN(vb)) continue;
    const cc=cellCenter(r,c); const bnds=[[cc[0]-dLat/2,cc[1]-dLon/2],[cc[0]+dLat/2,cc[1]+dLon/2]];
    L.rectangle(bnds,{stroke:false,fillColor:diffColour(vb-va),fillOpacity:0.65}).addTo(diffLayer);
  }
}
document.getElementById('diffRun').onclick=function(){ renderDiff(document.getElementById('diffA').value, document.getElementById('diffB').value); };
document.getElementById('diffClear').onclick=function(){ diffLayer.clearLayers(); };

// ===== Transect / UHI profile =====
let lineLayer=L.layerGroup().addTo(map); let lineActive=false; let lineStart=null;
document.getElementById('lineDraw').onclick=function(){ lineActive=true; window.__lineActive=true; lineStart=null; lineLayer.clearLayers(); document.getElementById('lineMeta').textContent='Click a start point, then an end point.'; };
document.getElementById('lineClear').onclick=function(){ lineActive=false; window.__lineActive=false; lineStart=null; lineLayer.clearLayers(); const cv=document.getElementById('lineChart'); if(cv){ cv.getContext('2d').clearRect(0,0,cv.width,cv.height); } document.getElementById('lineMeta').textContent='Draw a line across the city for an LST profile.'; };
map.on('click', function(e){
  if(!lineActive) return;
  if(!lineStart){ lineStart=e.latlng; L.circleMarker(lineStart,{radius:4,color:'#1a1a2e'}).addTo(lineLayer); document.getElementById('lineMeta').textContent='Now click the end point.'; return; }
  const end=e.latlng; lineLayer.clearLayers();
  L.polyline([lineStart,end],{color:'#1a1a2e',weight:2,dashArray:'4'}).addTo(lineLayer);
  const g=activeGrid(); const N=40; const labels=[], vals=[];
  for (let i=0;i<=N;i++){ const lat=lineStart.lat+(end.lat-lineStart.lat)*i/N, lng=lineStart.lng+(end.lng-lineStart.lng)*i/N; const rc=rcFor(lat,lng); vals.push(rc&&g?g[rc[0]][rc[1]]:null); labels.push(''); }
  const cv=document.getElementById('lineChart'); if(cv) drawLine(cv, ['start','end'], vals);
  const km=(map.distance(lineStart,end)/1000).toFixed(1);
  document.getElementById('lineMeta').textContent='Profile along '+km+' km transect.';
  lineActive=false; window.__lineActive=false; lineStart=null;
});
