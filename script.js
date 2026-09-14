const COLLECTED_STORAGE_KEY = 'dqw-omiyage-collected-ids';

const NARA_LAT = 34.6851;
const NARA_LNG = 135.8048;
const EARTH_RADIUS_KM = 6371;

const NARA_STATION_NAME = 'JR奈良駅';

const DISTANCE_TIER_ABYSS_EPITHETS = [
  '深淵なる　異境の地',
  '魔の気配　ただよう　辺境',
  '常人　立ち入れぬ　封印の地',
  '旅人の　覚悟を試す　果ての国',
];

const ROULETTE_MODE_STORAGE_KEY = 'dqw-omiyage-roulette-mode';
const MIN_SPIN_MS = 2500;
const MAX_SPIN_MS = 10000;
const SCROLL_FAST_INTERVAL_MS = 45;
const COMPASS_FAST_DEG_PER_MS = 0.9;
const COMPASS_HUB_RADIUS = 120;

let spotsData = [];
let collectedIds = new Set();
let selectedRegions = new Set();
let selectedDistanceKm = 'all';
let selectedDistanceMode = 'within';

let selectedListRegion = 'all';
let selectedListPref = 'all';

let rouletteMode = 'scroll';
let spinState = 'idle';
let currentFinalSpot = null;
let currentEligiblePool = [];
let minStopTimerId = null;
let autoStopTimerId = null;
let scrollFastTimerId = null;
let currentWheelInfo = { level: 'landmark', items: [] };
let compassWedgeEls = [];
let compassLabelEls = [];
let compassAngle = 0;
let compassRafId = null;
let compassLastFrameTime = 0;

const spotListEl = document.getElementById('spot-list');
const spotCountEl = document.getElementById('spot-count');
const regionFilterEl = document.getElementById('region-filter');
const distanceModeFilterEl = document.getElementById('distance-mode-filter');
const distanceFilterEl = document.getElementById('distance-filter');
const filterCountEl = document.getElementById('filter-count');
const listRegionTabsEl = document.getElementById('list-region-tabs');
const listPrefTabsEl = document.getElementById('list-pref-tabs');
const bulkCheckButton = document.getElementById('bulk-check-button');
const bulkUncheckButton = document.getElementById('bulk-uncheck-button');
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmMessageEl = document.getElementById('confirm-message');
const confirmYesButton = document.getElementById('confirm-yes-button');
const confirmNoButton = document.getElementById('confirm-no-button');
const modeScrollButton = document.getElementById('mode-scroll-button');
const modeCompassButton = document.getElementById('mode-compass-button');
const rouletteButton = document.getElementById('roulette-button');
const stopButton = document.getElementById('stop-button');
const scrollStageEl = document.getElementById('scroll-stage');
const scrollFlashEl = document.getElementById('scroll-flash');
const scrollImpactEl = document.getElementById('scroll-impact');
const compassStageEl = document.getElementById('compass-stage');
const compassWheelGroupEl = document.getElementById('compass-wheel-group');
const resultPlaceholder = document.getElementById('result-placeholder');
const resultSlot = document.getElementById('result-slot');
const resultDetail = document.getElementById('result-detail');
const resultMessage = document.getElementById('result-message');
const resultLines = document.getElementById('result-lines');
const resultPref = document.getElementById('result-pref');
const resultLandmark = document.getElementById('result-landmark');
const resultSouvenir = document.getElementById('result-souvenir');
const resultDistanceEl = document.getElementById('result-distance');
const resultDistanceValueEl = document.getElementById('result-distance-value');
const resultDistanceEpithetEl = document.getElementById('result-distance-epithet');
const resultActionsEl = document.getElementById('result-actions');
const mapLinkButton = document.getElementById('map-link-button');
const driveLinkButton = document.getElementById('drive-link-button');

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function getDistanceTier(km) {
  if (km < 100) {
    return 'safe';
  }
  if (km < 300) {
    return 'day';
  }
  if (km < 500) {
    return 'expedition';
  }
  return 'abyss';
}

function buildDriveUrl(spot) {
  const origin = encodeURIComponent(NARA_STATION_NAME);
  const destination = `${spot.lat},${spot.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travel_mode=driving`;
}

function openInNewTab(url) {
  if (!url) {
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function loadCollectedIds() {
  try {
    const raw = localStorage.getItem(COLLECTED_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch (err) {
    console.error('取得済み状態の読み込みに失敗しました', err);
    return new Set();
  }
}

function saveCollectedIds() {
  try {
    localStorage.setItem(COLLECTED_STORAGE_KEY, JSON.stringify([...collectedIds]));
  } catch (err) {
    console.error('取得済み状態の保存に失敗しました', err);
  }
}

async function loadSpots() {
  collectedIds = loadCollectedIds();

  try {
    const res = await fetch('spots.json');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    spotsData = await res.json();
    renderListRegionTabs();
    renderListPrefTabs();
    renderSpots(getVisibleSpots());
    updateSpotCount();
    renderRegionFilters();
    setupDistanceFilter();
    setupDistanceModeFilter();
    setupBulkActions();
    setupModeButtons();
    renderCompassWheel(getEligibleSpots());
    setRouletteMode(loadRouletteMode());
    updateFilterCount();
  } catch (err) {
    console.error('おみやげスポットの読み込みに失敗しました', err);
    spotListEl.textContent = 'おみやげスポットの読み込みに失敗しました。';
  }
}

function renderSpots(spots) {
  spotListEl.innerHTML = '';

  spots.forEach((spot) => {
    const li = document.createElement('li');
    li.className = 'spot-item';
    li.dataset.id = spot.id;
    if (collectedIds.has(spot.id)) {
      li.classList.add('is-collected');
    }

    const checkboxWrap = document.createElement('label');
    checkboxWrap.className = 'spot-checkbox-wrap';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'spot-checkbox-input';
    checkbox.checked = collectedIds.has(spot.id);
    checkbox.setAttribute('aria-label', `${spot.landmark}を取得済みにする`);
    checkbox.addEventListener('change', () => {
      toggleCollected(spot.id, checkbox.checked, li);
    });

    const checkboxBox = document.createElement('span');
    checkboxBox.className = 'spot-checkbox-box';
    checkboxBox.setAttribute('aria-hidden', 'true');

    checkboxWrap.append(checkbox, checkboxBox);

    const region = document.createElement('span');
    region.className = 'spot-region';
    region.textContent = spot.region;

    const pref = document.createElement('span');
    pref.className = 'spot-pref';
    pref.textContent = spot.pref;

    const landmark = document.createElement('span');
    landmark.className = 'spot-landmark';
    landmark.textContent = spot.landmark;

    const mapButton = document.createElement('button');
    mapButton.type = 'button';
    mapButton.className = 'spot-map-button';
    mapButton.textContent = '地図';
    mapButton.setAttribute('aria-label', `${spot.landmark}を地図で見る`);
    mapButton.addEventListener('click', (event) => {
      event.stopPropagation();
      openInNewTab(spot.mapsUrl);
    });

    const collectedLabel = document.createElement('span');
    collectedLabel.className = 'spot-collected-label';
    collectedLabel.textContent = '取得済み';

    li.append(checkboxWrap, region, pref, landmark, mapButton, collectedLabel);
    spotListEl.appendChild(li);
  });
}

function toggleCollected(id, isCollected, listItemEl) {
  if (isCollected) {
    collectedIds.add(id);
  } else {
    collectedIds.delete(id);
  }
  saveCollectedIds();
  listItemEl.classList.toggle('is-collected', isCollected);
  updateSpotCount();
  updateFilterCount();
}

function updateSpotCount() {
  const total = spotsData.length;
  const uncollected = spotsData.filter((spot) => !collectedIds.has(spot.id)).length;
  spotCountEl.textContent = `未取得 ${uncollected}件 / 全${total}件`;
}

function getVisibleSpots() {
  return spotsData.filter((spot) => {
    if (selectedListRegion !== 'all' && spot.region !== selectedListRegion) {
      return false;
    }
    if (selectedListPref !== 'all' && spot.pref !== selectedListPref) {
      return false;
    }
    return true;
  });
}

function getListScopeLabel() {
  if (selectedListPref !== 'all') {
    return selectedListPref;
  }
  if (selectedListRegion !== 'all') {
    return selectedListRegion;
  }
  return '全国のスポット全て';
}

function renderListRegionTabs() {
  const regions = [...new Set(spotsData.map((spot) => spot.region))];

  listRegionTabsEl.innerHTML = '';

  const allTab = createListTab('全国', selectedListRegion === 'all', () => {
    selectedListRegion = 'all';
    selectedListPref = 'all';
    renderListRegionTabs();
    renderListPrefTabs();
    renderSpots(getVisibleSpots());
  });
  listRegionTabsEl.appendChild(allTab);

  regions.forEach((region) => {
    const tab = createListTab(region, selectedListRegion === region, () => {
      selectedListRegion = region;
      selectedListPref = 'all';
      renderListRegionTabs();
      renderListPrefTabs();
      renderSpots(getVisibleSpots());
    });
    listRegionTabsEl.appendChild(tab);
  });
}

function renderListPrefTabs() {
  listPrefTabsEl.innerHTML = '';

  if (selectedListRegion === 'all') {
    listPrefTabsEl.hidden = true;
    return;
  }

  const prefs = [
    ...new Set(spotsData.filter((spot) => spot.region === selectedListRegion).map((spot) => spot.pref)),
  ];

  listPrefTabsEl.hidden = false;

  const allTab = createListTab('すべて', selectedListPref === 'all', () => {
    selectedListPref = 'all';
    renderListPrefTabs();
    renderSpots(getVisibleSpots());
  });
  listPrefTabsEl.appendChild(allTab);

  prefs.forEach((pref) => {
    const tab = createListTab(pref, selectedListPref === pref, () => {
      selectedListPref = pref;
      renderListPrefTabs();
      renderSpots(getVisibleSpots());
    });
    listPrefTabsEl.appendChild(tab);
  });
}

function createListTab(label, isActive, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'list-tab';
  button.classList.toggle('is-active', isActive);
  button.textContent = label;
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-selected', String(isActive));
  button.addEventListener('click', onClick);
  return button;
}

function showConfirm(message, variant, onConfirm) {
  confirmMessageEl.textContent = message;
  confirmYesButton.classList.remove('is-success', 'is-danger');
  confirmYesButton.classList.add(variant === 'danger' ? 'is-danger' : 'is-success');
  confirmOverlay.hidden = false;

  const cleanup = () => {
    confirmOverlay.hidden = true;
    confirmYesButton.removeEventListener('click', handleYes);
    confirmNoButton.removeEventListener('click', handleNo);
    confirmOverlay.removeEventListener('click', handleOverlayClick);
  };
  const handleYes = () => {
    cleanup();
    onConfirm();
  };
  const handleNo = () => {
    cleanup();
  };
  const handleOverlayClick = (event) => {
    if (event.target === confirmOverlay) {
      cleanup();
    }
  };

  confirmYesButton.addEventListener('click', handleYes);
  confirmNoButton.addEventListener('click', handleNo);
  confirmOverlay.addEventListener('click', handleOverlayClick);
}

function setupBulkActions() {
  bulkCheckButton.addEventListener('click', () => {
    const visibleSpots = getVisibleSpots();
    if (visibleSpots.length === 0) {
      return;
    }
    const label = getListScopeLabel();
    showConfirm(`${label}を　すべて取得済みに　します。よろしいですか？`, 'success', () => {
      visibleSpots.forEach((spot) => collectedIds.add(spot.id));
      saveCollectedIds();
      renderSpots(getVisibleSpots());
      updateSpotCount();
      updateFilterCount();
    });
  });

  bulkUncheckButton.addEventListener('click', () => {
    const visibleSpots = getVisibleSpots();
    if (visibleSpots.length === 0) {
      return;
    }
    const label = getListScopeLabel();
    showConfirm(`${label}を　すべて未取得に　もどします。よろしいですか？`, 'danger', () => {
      visibleSpots.forEach((spot) => collectedIds.delete(spot.id));
      saveCollectedIds();
      renderSpots(getVisibleSpots());
      updateSpotCount();
      updateFilterCount();
    });
  });
}

function renderRegionFilters() {
  const regions = [...new Set(spotsData.map((spot) => spot.region))];
  selectedRegions = new Set(regions);

  regionFilterEl.innerHTML = '';

  regions.forEach((region) => {
    const label = document.createElement('label');
    label.className = 'region-option';

    const checkboxWrap = document.createElement('span');
    checkboxWrap.className = 'spot-checkbox-wrap';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'spot-checkbox-input';
    checkbox.checked = true;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedRegions.add(region);
      } else {
        selectedRegions.delete(region);
      }
      updateFilterCount();
    });

    const checkboxBox = document.createElement('span');
    checkboxBox.className = 'spot-checkbox-box';
    checkboxBox.setAttribute('aria-hidden', 'true');

    checkboxWrap.append(checkbox, checkboxBox);

    const text = document.createElement('span');
    text.className = 'region-option-text';
    text.textContent = region;

    label.append(checkboxWrap, text);
    regionFilterEl.appendChild(label);
  });
}

function setupDistanceFilter() {
  const buttons = [...distanceFilterEl.querySelectorAll('.filter-chip')];

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('is-active'));
      button.classList.add('is-active');

      const value = button.dataset.distance;
      selectedDistanceKm = value === 'all' ? 'all' : Number(value);
      updateFilterCount();
    });
  });
}

function setupDistanceModeFilter() {
  const buttons = [...distanceModeFilterEl.querySelectorAll('.filter-chip')];

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('is-active'));
      button.classList.add('is-active');

      selectedDistanceMode = button.dataset.mode;
      updateFilterCount();
    });
  });
}

function matchesRegionFilter(spot) {
  return selectedRegions.size === 0 || selectedRegions.has(spot.region);
}

function matchesDistanceFilter(spot) {
  if (selectedDistanceKm === 'all') {
    return true;
  }
  const distance = haversineDistanceKm(NARA_LAT, NARA_LNG, spot.lat, spot.lng);
  return selectedDistanceMode === 'atLeast' ? distance >= selectedDistanceKm : distance <= selectedDistanceKm;
}

function getEligibleSpots() {
  return spotsData.filter(
    (spot) => !collectedIds.has(spot.id) && matchesRegionFilter(spot) && matchesDistanceFilter(spot)
  );
}

function updateFilterCount() {
  filterCountEl.textContent = `対象: ${getEligibleSpots().length}件`;
  if (spinState === 'idle') {
    renderCompassWheel(getEligibleSpots());
  }
}

function loadRouletteMode() {
  try {
    const saved = localStorage.getItem(ROULETTE_MODE_STORAGE_KEY);
    return saved === 'compass' ? 'compass' : 'scroll';
  } catch (err) {
    return 'scroll';
  }
}

function saveRouletteMode(mode) {
  try {
    localStorage.setItem(ROULETTE_MODE_STORAGE_KEY, mode);
  } catch (err) {
    console.error('えんしゅつモードの保存に失敗しました', err);
  }
}

function setRouletteMode(mode) {
  rouletteMode = mode;
  modeScrollButton.classList.toggle('is-active', mode === 'scroll');
  modeCompassButton.classList.toggle('is-active', mode === 'compass');
  scrollStageEl.hidden = mode !== 'scroll';
  compassStageEl.hidden = mode !== 'compass';
  saveRouletteMode(mode);
}

function setupModeButtons() {
  modeScrollButton.addEventListener('click', () => {
    if (spinState === 'idle') {
      setRouletteMode('scroll');
    }
  });
  modeCompassButton.addEventListener('click', () => {
    if (spinState === 'idle') {
      setRouletteMode('compass');
      renderCompassWheel(getEligibleSpots());
    }
  });
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function computeWheelInfo(pool) {
  if (pool.length === 0) {
    return { level: 'landmark', items: [] };
  }
  const regions = [...new Set(pool.map((spot) => spot.region))];
  if (regions.length >= 2) {
    return { level: 'region', items: regions.map((region) => ({ key: region, label: region })) };
  }
  const prefs = [...new Set(pool.map((spot) => spot.pref))];
  if (prefs.length >= 2) {
    return { level: 'pref', items: prefs.map((pref) => ({ key: pref, label: pref })) };
  }
  return { level: 'landmark', items: pool.map((spot) => ({ key: spot.id, label: spot.landmark })) };
}

function segmentIndexForSpot(spot, wheelInfo) {
  const matchKey = wheelInfo.level === 'region' ? spot.region : wheelInfo.level === 'pref' ? spot.pref : spot.id;
  const index = wheelInfo.items.findIndex((item) => item.key === matchKey);
  return index === -1 ? 0 : index;
}

function renderCompassWheel(pool) {
  currentWheelInfo = computeWheelInfo(pool);
  compassWheelGroupEl.innerHTML = '';
  compassWedgeEls = [];
  compassLabelEls = [];

  const items = currentWheelInfo.items;
  const n = items.length;
  if (n === 0) {
    return;
  }

  const segAngle = 360 / n;
  const cx = 150;
  const cy = 150;
  const r = COMPASS_HUB_RADIUS;
  const svgNs = 'http://www.w3.org/2000/svg';

  items.forEach((item, i) => {
    const a0 = i * segAngle;
    const a1 = (i + 1) * segAngle;
    const p0 = polarToCartesian(cx, cy, r, a0);
    const p1 = polarToCartesian(cx, cy, r, a1);
    const largeArc = a1 - a0 > 180 ? 1 : 0;

    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute(
      'd',
      `M ${cx} ${cy} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`
    );
    path.setAttribute('class', `compass-wedge ${i % 2 === 0 ? 'is-even' : 'is-odd'}`);
    compassWheelGroupEl.appendChild(path);
    compassWedgeEls.push(path);

    const mid = a0 + segAngle / 2;
    const text = document.createElementNS(svgNs, 'text');
    text.setAttribute('x', String(cx));
    text.setAttribute('y', String(cy - r * 0.68));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('transform', `rotate(${mid.toFixed(2)} ${cx} ${cy})`);
    text.setAttribute('class', 'compass-label');
    text.textContent = item.label;
    compassWheelGroupEl.appendChild(text);
    compassLabelEls.push(text);
  });
}

function applyCompassRotation(angle) {
  compassWheelGroupEl.setAttribute('transform', `rotate(${angle.toFixed(2)} 150 150)`);
}

function startCompassFastPhase() {
  compassLastFrameTime = performance.now();

  function frame(now) {
    const dt = now - compassLastFrameTime;
    compassLastFrameTime = now;
    compassAngle = (compassAngle + COMPASS_FAST_DEG_PER_MS * dt) % 360;
    applyCompassRotation(compassAngle);
    if (spinState === 'fast') {
      compassRafId = requestAnimationFrame(frame);
    }
  }

  compassRafId = requestAnimationFrame(frame);
}

function landCompassEffect(targetIndex) {
  compassWedgeEls.forEach((el, i) => el.classList.toggle('is-landed', i === targetIndex));
  compassLabelEls.forEach((el, i) => el.classList.toggle('is-landed', i === targetIndex));
  setTimeout(() => {
    compassWedgeEls.forEach((el) => el.classList.remove('is-landed'));
    compassLabelEls.forEach((el) => el.classList.remove('is-landed'));
  }, 2200);
}

function runCompassDecel(target) {
  cancelAnimationFrame(compassRafId);

  const targetIndex = segmentIndexForSpot(target, currentWheelInfo);
  const segAngle = 360 / currentWheelInfo.items.length;
  const targetCenter = targetIndex * segAngle + segAngle / 2;
  const targetMod = ((360 - targetCenter) % 360 + 360) % 360;
  const extraTurns = 3 + Math.floor(Math.random() * 2);

  let base = targetMod;
  while (base < compassAngle) {
    base += 360;
  }
  const finalAngle = base + extraTurns * 360;
  const startAngle = compassAngle;
  const startTime = performance.now();
  const decelDuration = 1800 + Math.random() * 700;

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / decelDuration, 1);
    const eased = 1 - (1 - t) ** 3;
    compassAngle = startAngle + (finalAngle - startAngle) * eased;
    applyCompassRotation(compassAngle);

    if (t < 1) {
      compassRafId = requestAnimationFrame(step);
    } else {
      landCompassEffect(targetIndex);
      finishRoulette(target);
    }
  }

  compassRafId = requestAnimationFrame(step);
}

function startScrollFastPhase(pool) {
  resultSlot.classList.add('is-spinning');
  scrollFastTimerId = setInterval(() => {
    resultSlot.textContent = pool[Math.floor(Math.random() * pool.length)].landmark;
  }, SCROLL_FAST_INTERVAL_MS);
}

function landScrollEffect() {
  resultSlot.classList.remove('is-spinning');
  scrollFlashEl.classList.remove('is-flashing');
  scrollImpactEl.classList.remove('is-visible');
  scrollStageEl.classList.remove('is-shaking');
  void scrollFlashEl.offsetWidth;
  scrollFlashEl.classList.add('is-flashing');
  scrollImpactEl.classList.add('is-visible');
  scrollStageEl.classList.add('is-shaking');
  setTimeout(() => {
    scrollFlashEl.classList.remove('is-flashing');
    scrollImpactEl.classList.remove('is-visible');
    scrollStageEl.classList.remove('is-shaking');
  }, 750);
}

function runScrollDecel(target, pool) {
  clearInterval(scrollFastTimerId);

  let delay = 55;
  const totalTicks = 9 + Math.floor(Math.random() * 5);
  let tick = 0;

  function step() {
    tick += 1;
    if (tick >= totalTicks) {
      resultSlot.textContent = target.landmark;
      landScrollEffect();
      finishRoulette(target);
      return;
    }
    resultSlot.textContent = pool[Math.floor(Math.random() * pool.length)].landmark;
    delay = Math.min(delay * 1.28, 260);
    setTimeout(step, delay);
  }

  setTimeout(step, delay);
}

function startRoulette() {
  if (spinState !== 'idle') {
    return;
  }

  const eligible = getEligibleSpots();
  if (eligible.length === 0) {
    showNoDestination();
    return;
  }

  currentEligiblePool = eligible;
  currentFinalSpot = eligible[Math.floor(Math.random() * eligible.length)];
  spinState = 'fast';

  rouletteButton.disabled = true;
  modeScrollButton.disabled = true;
  modeCompassButton.disabled = true;
  resultPlaceholder.hidden = true;
  resultDetail.hidden = true;
  window.DQWMap?.hideMapMarker();

  stopButton.hidden = false;
  stopButton.disabled = true;

  if (rouletteMode === 'compass') {
    renderCompassWheel(currentEligiblePool);
    startCompassFastPhase();
  } else {
    startScrollFastPhase(currentEligiblePool);
  }

  minStopTimerId = setTimeout(() => {
    if (spinState === 'fast') {
      stopButton.disabled = false;
    }
  }, MIN_SPIN_MS);

  autoStopTimerId = setTimeout(() => {
    triggerStop();
  }, MAX_SPIN_MS);
}

function triggerStop() {
  if (spinState !== 'fast') {
    return;
  }
  spinState = 'decel';
  clearTimeout(minStopTimerId);
  clearTimeout(autoStopTimerId);
  stopButton.disabled = true;

  if (rouletteMode === 'compass') {
    runCompassDecel(currentFinalSpot);
  } else {
    runScrollDecel(currentFinalSpot, currentEligiblePool);
  }
}

function finishRoulette(spot) {
  spinState = 'idle';
  rouletteButton.disabled = false;
  modeScrollButton.disabled = false;
  modeCompassButton.disabled = false;
  stopButton.hidden = true;
  showResult(spot);
}

function showResult(spot) {
  resultMessage.classList.remove('is-warning');
  resultMessage.textContent = 'たびの　ゆくえが　きまった！';
  resultLines.hidden = false;
  resultPref.textContent = spot.pref;
  resultLandmark.textContent = spot.landmark;
  resultSouvenir.textContent = spot.souvenir;

  const distanceKm = haversineDistanceKm(NARA_LAT, NARA_LNG, spot.lat, spot.lng);
  const tier = getDistanceTier(distanceKm);
  resultDistanceEl.hidden = false;
  resultDistanceEl.className = `result-distance tier-${tier}`;
  resultDistanceValueEl.textContent = `奈良市から　約${Math.round(distanceKm)}km`;

  if (tier === 'abyss') {
    const epithet = DISTANCE_TIER_ABYSS_EPITHETS[Math.floor(Math.random() * DISTANCE_TIER_ABYSS_EPITHETS.length)];
    resultDistanceEpithetEl.textContent = epithet;
    resultDistanceEpithetEl.hidden = false;
  } else {
    resultDistanceEpithetEl.hidden = true;
    resultDistanceEpithetEl.textContent = '';
  }

  resultActionsEl.hidden = false;
  mapLinkButton.onclick = () => openInNewTab(spot.mapsUrl);
  driveLinkButton.onclick = () => openInNewTab(buildDriveUrl(spot));

  resultDetail.hidden = false;
  window.DQWMap?.showSpotOnMap(spot);
}

function showNoDestination() {
  resultPlaceholder.hidden = true;
  resultLines.hidden = true;
  resultDistanceEl.hidden = true;
  resultActionsEl.hidden = true;
  resultMessage.classList.add('is-warning');
  resultMessage.textContent = 'もう　いきさきが　ありません！';
  resultDetail.hidden = false;
  window.DQWMap?.hideMapMarker();
}

rouletteButton.addEventListener('click', startRoulette);
stopButton.addEventListener('click', () => {
  if (!stopButton.disabled) {
    triggerStop();
  }
});

loadSpots();
