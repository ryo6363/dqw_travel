const MAP_LAT_MIN = 24;
const MAP_LAT_MAX = 46;
const MAP_LNG_MIN = 122;
const MAP_LNG_MAX = 146;
const MAP_VIEWBOX_SIZE = 480;

const mapMarkerEl = document.getElementById('map-marker');
const mapCaptionEl = document.getElementById('map-caption');

function latLngToMapXY(lat, lng) {
  const x = ((lng - MAP_LNG_MIN) / (MAP_LNG_MAX - MAP_LNG_MIN)) * MAP_VIEWBOX_SIZE;
  const y = ((MAP_LAT_MAX - lat) / (MAP_LAT_MAX - MAP_LAT_MIN)) * MAP_VIEWBOX_SIZE;
  return { x, y };
}

function showSpotOnMap(spot) {
  if (!mapMarkerEl || typeof spot.lat !== 'number' || typeof spot.lng !== 'number') {
    return;
  }

  const { x, y } = latLngToMapXY(spot.lat, spot.lng);
  mapMarkerEl.setAttribute('transform', `translate(${x.toFixed(1)}, ${y.toFixed(1)})`);
  mapMarkerEl.classList.add('is-active');

  if (mapCaptionEl) {
    mapCaptionEl.textContent = `げんざいち：${spot.pref}　${spot.landmark}`;
  }
}

function hideMapMarker() {
  if (!mapMarkerEl) {
    return;
  }
  mapMarkerEl.classList.remove('is-active');

  if (mapCaptionEl) {
    mapCaptionEl.textContent = 'まだ　もくてきちは　きまっていない……';
  }
}

window.DQWMap = { showSpotOnMap, hideMapMarker, latLngToMapXY };
