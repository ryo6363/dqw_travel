const COLLECTED_STORAGE_KEY = 'dqw-omiyage-collected-ids';

const NARA_LAT = 34.6851;
const NARA_LNG = 135.8048;
const EARTH_RADIUS_KM = 6371;

let spotsData = [];
let collectedIds = new Set();
let selectedRegions = new Set();
let selectedDistanceKm = 'all';
let spinning = false;

let selectedListRegion = 'all';
let selectedListPref = 'all';

const spotListEl = document.getElementById('spot-list');
const spotCountEl = document.getElementById('spot-count');
const regionFilterEl = document.getElementById('region-filter');
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
const rouletteButton = document.getElementById('roulette-button');
const resultPlaceholder = document.getElementById('result-placeholder');
const resultSlot = document.getElementById('result-slot');
const resultDetail = document.getElementById('result-detail');
const resultMessage = document.getElementById('result-message');
const resultLines = document.getElementById('result-lines');
const resultPref = document.getElementById('result-pref');
const resultLandmark = document.getElementById('result-landmark');
const resultSouvenir = document.getElementById('result-souvenir');

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
    updateFilterCount();
    setupBulkActions();
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

    const collectedLabel = document.createElement('span');
    collectedLabel.className = 'spot-collected-label';
    collectedLabel.textContent = '取得済み';

    li.append(checkboxWrap, region, pref, landmark, collectedLabel);
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

function matchesRegionFilter(spot) {
  return selectedRegions.size === 0 || selectedRegions.has(spot.region);
}

function matchesDistanceFilter(spot) {
  if (selectedDistanceKm === 'all') {
    return true;
  }
  const distance = haversineDistanceKm(NARA_LAT, NARA_LNG, spot.lat, spot.lng);
  return distance <= selectedDistanceKm;
}

function getEligibleSpots() {
  return spotsData.filter(
    (spot) => !collectedIds.has(spot.id) && matchesRegionFilter(spot) && matchesDistanceFilter(spot)
  );
}

function updateFilterCount() {
  filterCountEl.textContent = `対象: ${getEligibleSpots().length}件`;
}

function spinRoulette() {
  if (spinning) {
    return;
  }

  const availableSpots = getEligibleSpots();
  if (availableSpots.length === 0) {
    showNoDestination();
    return;
  }

  spinning = true;
  rouletteButton.disabled = true;
  resultPlaceholder.hidden = true;
  resultDetail.hidden = true;
  resultSlot.hidden = false;
  window.DQWMap?.hideMapMarker();

  const finalSpot = availableSpots[Math.floor(Math.random() * availableSpots.length)];
  const totalDuration = 500 + Math.random() * 1000;
  const startTime = performance.now();
  let delay = 60;

  function tick() {
    resultSlot.textContent = availableSpots[Math.floor(Math.random() * availableSpots.length)].landmark;

    if (performance.now() - startTime >= totalDuration) {
      showResult(finalSpot);
      return;
    }

    delay = Math.min(delay * 1.15, 260);
    setTimeout(tick, delay);
  }

  tick();
}

function showResult(spot) {
  resultSlot.hidden = true;
  resultMessage.classList.remove('is-warning');
  resultMessage.textContent = 'たびの　ゆくえが　きまった！';
  resultLines.hidden = false;
  resultPref.textContent = spot.pref;
  resultLandmark.textContent = spot.landmark;
  resultSouvenir.textContent = spot.souvenir;
  resultDetail.hidden = false;
  window.DQWMap?.showSpotOnMap(spot);

  spinning = false;
  rouletteButton.disabled = false;
}

function showNoDestination() {
  resultPlaceholder.hidden = true;
  resultSlot.hidden = true;
  resultLines.hidden = true;
  resultMessage.classList.add('is-warning');
  resultMessage.textContent = 'もう　いきさきが　ありません！';
  resultDetail.hidden = false;
  window.DQWMap?.hideMapMarker();
}

rouletteButton.addEventListener('click', spinRoulette);

loadSpots();
