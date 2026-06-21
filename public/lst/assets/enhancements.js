/* UX/UI enhancements for the Kolkata LST map (added Jun 2026).
 * Loaded after map.js. Self-contained: reaches the Leaflet map via a
 * one-time event hook so it does not depend on map.js internal variables.
 *   - Lock map to West Bengal & sensible zoom range
 *   - Interactive legend (click a band to focus it)
 *   - Plain-language difference-map labels (Baseline A / Compare to B)
 *   - Friendlier hover empty-state message
 *   - LST tile loading indicator
 *   - Responsive bottom-sheet panel + default-closed on small screens
 *   - Accessibility labels & keyboard focus on controls
 */
(function(){
  if (typeof L === 'undefined') return;

  // --- Capture the Leaflet map instance created in map.js ---
  // Top-level const/let in map.js are not on window, so we hook L.Map.fire
  // and trigger one synthetic mousemove to grab the live instance.
  var captured = null;
  var proto = L.Map.prototype;
  var origFire = proto.fire;
  proto.fire = function(){ captured = this; return origFire.apply(this, arguments); };

  function withMap(cb){
    var el = document.getElementById('map');
    if (!el){ return setTimeout(function(){ withMap(cb); }, 200); }
    var r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('mousemove',
      { clientX: r.left + r.width/2, clientY: r.top + r.height/2, bubbles: true }));
    if (captured){ proto.fire = origFire; cb(captured); }
    else setTimeout(function(){ withMap(cb); }, 200);
  }

  function init(map){
    // 1) Lock map + zoom to the Kolkata LST heatmap extent so it fills the frame
    try {map.setMaxBounds(L.latLngBounds([22.40, 88.20], [22.70, 88.50]));      map.options.maxBoundsViscosity = 1.0;
      map.setMinZoom(11);
      map.setMaxZoom(16);
      map.fitBounds(map.options.maxBounds);    } catch(e){}

    // 2) Difference-map labels + date select aria-label
    function addLabel(id, text){
      var el = document.getElementById(id);
      if (!el || document.getElementById(id+'-lbl')) return;
      var l = document.createElement('label');
      l.id = id+'-lbl'; l.htmlFor = id; l.textContent = text;
      l.style.cssText = 'display:block;font-size:11px;font-weight:600;color:rgba(245,220,218,0.7);margin-bottom:2px;';
      el.parentNode.insertBefore(l, el);
      el.setAttribute('aria-label', text);
    }
    addLabel('diffA', 'Baseline (A)');
    addLabel('diffB', 'Compare to (B)');
    var dateSel = document.getElementById('dateSel');
    if (dateSel) dateSel.setAttribute('aria-label', 'Select acquisition date or seasonal mean');

    // 3) Interactive legend bands
    var legendEl = document.querySelector('.legend');
    if (legendEl && !legendEl.dataset.enhanced){
      legendEl.dataset.enhanced = '1';
      var swatches = Array.prototype.slice.call(legendEl.querySelectorAll('i'));
      swatches.forEach(function(sw){
        var txt = (sw.nextSibling && sw.nextSibling.textContent) ? sw.nextSibling.textContent.trim() : '';
        sw.style.cursor = 'pointer';
        sw.title = txt ? (txt + ' C - click to focus this band') : 'click to focus';
        sw.setAttribute('tabindex', '0');
        sw.setAttribute('role', 'button');
        sw.setAttribute('aria-label', 'Highlight temperature band ' + txt + ' degrees Celsius');
        function toggle(){
          var active = sw.dataset.active === '1';
          swatches.forEach(function(s){ s.style.opacity=''; s.dataset.active=''; s.style.boxShadow=''; });
          if (!active){
            swatches.forEach(function(s){ if (s !== sw) s.style.opacity = '0.3'; });
            sw.dataset.active = '1';
            sw.style.boxShadow = '0 0 0 2px #ff8a85';
          }
        }
        sw.addEventListener('click', toggle);
        sw.addEventListener('keydown', function(e){ if (e.key==='Enter'||e.key===' '){ e.preventDefault(); toggle(); } });
      });
      if (L.DomEvent) L.DomEvent.disableClickPropagation(legendEl);
    }

    // 4) Friendlier hover empty-state. Observe the readout panel text and
    //    rewrite the cryptic "outside area" message.
    var readoutEl = document.querySelector('.leaflet-bottom.leaflet-left .panel');
    if (readoutEl && !readoutEl.dataset.obs){
      readoutEl.dataset.obs = '1';
      var obs = new MutationObserver(function(){
        if (/outside area/.test(readoutEl.textContent) && !readoutEl.dataset.fixed){
          readoutEl.dataset.fixed = '1';
          readoutEl.innerHTML = '<span style="color:rgba(245,210,208,0.6)">No reading here - move over the colored area</span>';
          setTimeout(function(){ readoutEl.dataset.fixed = ''; }, 50);
        }
      });
      obs.observe(readoutEl, { childList:true, subtree:true, characterData:true });
    }

    // 5) LST tile loading indicator
    var ld = document.createElement('div');
    ld.id = 'lst-loading';
    ld.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:lstspin .8s linear infinite;vertical-align:middle;margin-right:6px"></span>Loading temperature tiles...';
    ld.style.cssText = 'position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:1000;background:rgba(15,23,42,.85);color:#fff;font-size:12px;padding:6px 12px;border-radius:16px;display:none;';
    document.getElementById('map').appendChild(ld);
    var loading = 0;
    Object.keys(map._layers).forEach(function(k){
      var layer = map._layers[k];
      if (layer instanceof L.TileLayer){
        layer.on('loading', function(){ loading++; ld.style.display = 'block'; });
        layer.on('load', function(){ loading = Math.max(0, loading-1); if (!loading) ld.style.display = 'none'; });
      }
    });

    // 6) Responsive bottom-sheet panel + default closed on small screens
    var rcss = document.createElement('style');
    rcss.textContent = [
      '@media (max-width:760px){',
      '  .side{position:fixed;left:0;right:0;top:auto;bottom:0;width:100%;max-width:100%;',
      '    height:62vh;max-height:62vh;border-radius:16px 16px 0 0;',
      '    box-shadow:0 -6px 24px rgba(0,0,0,.25);transform:translateY(100%);',
      '    transition:transform .28s ease;-webkit-overflow-scrolling:touch;}',
      '  .side.open{transform:translateY(0);}',
      '  .side::before{content:"";position:sticky;top:6px;display:block;width:40px;height:4px;',
      '    margin:6px auto 10px;border-radius:2px;background:#cbd5e1;}',
      '  .side-toggle{position:fixed;right:12px;bottom:12px;top:auto;}',
      '}'
    ].join('\n');
    document.head.appendChild(rcss);
    var sideEl = document.querySelector('.side');
    if (sideEl && window.innerWidth <= 760) sideEl.classList.remove('open');

    // 7) Accessibility labels on controls
    document.querySelectorAll('input[type=checkbox],input[type=radio]').forEach(function(inp){
      if (!inp.getAttribute('aria-label')){
        var lab = inp.closest('label') ? inp.closest('label').innerText.trim()
          : (inp.nextSibling && inp.nextSibling.textContent ? inp.nextSibling.textContent.trim() : '');
        if (lab) inp.setAttribute('aria-label', lab);
      }
    });
    var op = document.getElementById('op');
    if (op) op.setAttribute('aria-label', 'LST layer opacity');
    var sideBtn = document.querySelector('.side-toggle');
    if (sideBtn) sideBtn.title = 'Stats, time-series, date comparison and heat-island profile';
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ withMap(init); });
  } else {
    withMap(init);
  }
})();
