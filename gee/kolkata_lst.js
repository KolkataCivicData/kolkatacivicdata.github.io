/**
 * Kolkata Land Surface Temperature (LST) — Landsat 8/9
 * Period: 2026-04-01 to 2026-06-01
 * Run in the Google Earth Engine Code Editor: https://code.earthengine.google.com
 *
 * Output:
 *   1. An interactive LST layer in the Code Editor map.
 *   2. A GeoTIFF export to Google Drive (for the static overlay).
 *   3. An LST tile/thumbnail you can reference from the web map.
 */

// ---------- 1. Area of interest: Kolkata ----------
var kolkata = ee.Geometry.Rectangle([88.20, 22.40, 88.50, 22.70]);
Map.centerObject(kolkata, 11);

var START = '2026-04-01';
var END   = '2026-06-01';

// ---------- 2. Cloud mask (QA_PIXEL bits) ----------
function maskL89(image) {
  var qa = image.select('QA_PIXEL');
  var dilatedCloud = 1 << 1;
  var cloud        = 1 << 3;
  var cloudShadow  = 1 << 4;
  var mask = qa.bitwiseAnd(dilatedCloud).eq(0)
              .and(qa.bitwiseAnd(cloud).eq(0))
              .and(qa.bitwiseAnd(cloudShadow).eq(0));
  return image.updateMask(mask);
}

// ---------- 3. Collection 2 Level-2 (surface temp band ST_B10) ----------
// Scale factor for ST_B10: multiply by 0.00341802, add 149.0 -> Kelvin
function toCelsius(image) {
  var lst = image.select('ST_B10')
                 .multiply(0.00341802).add(149.0)   // -> Kelvin
                 .subtract(273.15)                   // -> Celsius
                 .rename('LST');
  return lst.copyProperties(image, ['system:time_start']);
}

var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2');
var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2');

var collection = l8.merge(l9)
  .filterBounds(kolkata)
  .filterDate(START, END)
  .filter(ee.Filter.lt('CLOUD_COVER', 60))
  .map(maskL89)
  .map(toCelsius);

print('Scenes found:', collection.size());

// ---------- 4. Median LST composite ----------
var lstMean = collection.select('LST').mean().clip(kolkata);

// ---------- 5. Visualisation ----------
var vis = {
  min: 24, max: 45,
  palette: ['040274','0502a3','0502ce','235cb1','307ef3',
            '30c8e2','3be285','86e26f','b5e22e','d28e00',
            'd06d00','e03f00','c61700','911003']
};
Map.addLayer(lstMean, vis, 'LST (°C)');

// ---------- 6. Export GeoTIFF to Drive (for static overlay) ----------
Export.image.toDrive({
  image: lstMean,
  description: 'kolkata_lst_apr_jun_2026',
  folder: 'kolkata_lst',
  region: kolkata,
  scale: 30,
  crs: 'EPSG:4326',
  maxPixels: 1e9
});

// ---------- 7. Generate a public tile URL for the interactive map ----------
lstMean.getMap(vis, function(mapInfo) {
  print('Tile URL template (paste into map.js):');
  print(mapInfo.urlFormat);
});

// ---------- 8. PNG thumbnail for the static page ----------
print('Static PNG thumbnail URL:');
print(lstMean.getThumbURL({
  region: kolkata, dimensions: 1024, format: 'png', min: 24, max: 45,
  palette: vis.palette
}));


// ---------- 9. Export LST grid to Drive (for client-side hover read-out) ----------
// A regular grid of points sampled from the mean LST, exported as CSV (r,c,lon,lat,lst).
// 60 x 60 = 3600 points over the AOI (~500 m spacing). Runs server-side via the Tasks tab.
var GRID_LON0 = 88.20, GRID_LON1 = 88.50, GRID_LAT0 = 22.40, GRID_LAT1 = 22.70;
var NCOLS = 60, NROWS = 60;
var dLon = (GRID_LON1 - GRID_LON0) / (NCOLS - 1);
var dLat = (GRID_LAT1 - GRID_LAT0) / (NROWS - 1);

var gridCols = ee.List.sequence(0, NCOLS - 1);
var gridRows = ee.List.sequence(0, NROWS - 1);

var gridPts = ee.FeatureCollection(gridRows.map(function(ri) {
  ri = ee.Number(ri);
  var lat = ee.Number(GRID_LAT1).subtract(ri.multiply(dLat));   // row 0 = north
  return gridCols.map(function(ci) {
    ci = ee.Number(ci);
    var lon = ee.Number(GRID_LON0).add(ci.multiply(dLon));
    return ee.Feature(ee.Geometry.Point([lon, lat]), { r: ri, c: ci });
  });
}).flatten());

var gridSampled = lstMean.reduceRegions({
  collection: gridPts,
  reducer: ee.Reducer.mean(),
  scale: 100
}).map(function(f) {
  var m = ee.Number(f.get('mean'));
  var lstRounded = ee.Algorithms.If(m, m.multiply(10).round().divide(10), null);
  var coords = f.geometry().coordinates();
  return f.set({ lon: coords.get(0), lat: coords.get(1), lst: lstRounded }).setGeometry(null);
});

Export.table.toDrive({
  collection: gridSampled,
  description: 'kolkata_lst_grid',
  folder: 'kolkata_lst',
  fileNamePrefix: 'kolkata_lst_grid',
  fileFormat: 'CSV',
  selectors: ['r', 'c', 'lon', 'lat', 'lst']
});
// After the task finishes, download the CSV from Drive and upload it to
// public/lst/assets/kolkata_lst_grid.csv so the hover read-out in map.js works.
