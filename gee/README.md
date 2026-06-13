# Kolkata Land Surface Temperature (LST)

Land Surface Temperature for Kolkata derived from Landsat 8/9 Collection 2
Level-2 imagery (surface temperature band `ST_B10`), for the period
**1 Apr – 1 Jun 2026**. The result is published as two web pages: an
interactive Leaflet/OpenStreetMap map and a static heatmap overlay.

## Contents

| Path | Description |
| --- | --- |
| `gee/kolkata_lst.js` | Earth Engine script that builds the median LST composite, exports a GeoTIFF, and prints a tile URL and a PNG thumbnail URL. |
| `public/lst/index.html` | Interactive map page (Leaflet + OSM base + Earth Engine tile overlay). |
| `public/lst/assets/map.js` | Map logic: overlay, legend, opacity slider, click-to-show-coordinates. |
| `public/lst/static.html` | Static heatmap page that overlays a pre-rendered PNG on OSM. |
| `public/lst/assets/lst_static.png` | Rendered LST thumbnail used by the static page. |

The pages are linked from the site navigation as **LST Map** and **LST Heatmap**.

## How it works

1. **Area of interest** — a rectangle covering Kolkata (88.20–88.50 E, 22.40–22.70 N).
2. **Cloud masking** — pixels flagged as cloud, dilated cloud, or cloud shadow in `QA_PIXEL` are removed.
3. **Temperature conversion** — `ST_B10` is scaled to Kelvin (× 0.00341802 + 149.0) and converted to Celsius.
4. **Composite** — the mean LST across all clear scenes in the period is computed and clipped to the AOI.
5. **Visualisation** — a 14-colour palette spanning **24 °C to 45 °C**.

## Regenerating the data

Run `gee/kolkata_lst.js` in the [Earth Engine Code Editor](https://code.earthengine.google.com),
then update two outputs:

1. **Interactive tiles** — copy the printed `urlFormat` and paste it into the
   `GEE_TILE_URL` constant in `public/lst/assets/map.js`.
2. **Static overlay** — open the printed `getThumbURL` link, save the image, and
   upload it to `public/lst/assets/lst_static.png`.

> **Note:** Earth Engine tile URLs are tied to the project and can expire after a
> period of inactivity. If the interactive overlay stops loading, re-run the
> script and paste the fresh `urlFormat`. The static PNG lives in the repo and
> does not expire.

## Data source & attribution

LST derived from **NASA/USGS Landsat 8/9 Collection 2 Level-2** via Google Earth
Engine. Base map © OpenStreetMap contributors.
