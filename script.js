let spotsData = [];
let spinning = false;

const spotListEl = document.getElementById('spot-list');
const rouletteButton = document.getElementById('roulette-button');
const resultPlaceholder = document.getElementById('result-placeholder');
const resultSlot = document.getElementById('result-slot');
const resultDetail = document.getElementById('result-detail');
const resultMessage = document.getElementById('result-message');
const resultPref = document.getElementById('result-pref');
const resultLandmark = document.getElementById('result-landmark');
const resultSouvenir = document.getElementById('result-souvenir');

async function loadSpots() {
  try {
    const res = await fetch('spots.json');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    spotsData = await res.json();
    renderSpots(spotsData);
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

    const region = document.createElement('span');
    region.className = 'spot-region';
    region.textContent = spot.region;

    const pref = document.createElement('span');
    pref.className = 'spot-pref';
    pref.textContent = spot.pref;

    const landmark = document.createElement('span');
    landmark.className = 'spot-landmark';
    landmark.textContent = spot.landmark;

    li.append(region, pref, landmark);
    spotListEl.appendChild(li);
  });
}

function pickRandomSpot() {
  return spotsData[Math.floor(Math.random() * spotsData.length)];
}

function spinRoulette() {
  if (spinning || spotsData.length === 0) {
    return;
  }

  spinning = true;
  rouletteButton.disabled = true;
  resultPlaceholder.hidden = true;
  resultDetail.hidden = true;
  resultSlot.hidden = false;

  const finalSpot = pickRandomSpot();
  const totalDuration = 500 + Math.random() * 1000;
  const startTime = performance.now();
  let delay = 60;

  function tick() {
    resultSlot.textContent = pickRandomSpot().landmark;

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
  resultMessage.textContent = 'たびの　ゆくえが　きまった！';
  resultPref.textContent = spot.pref;
  resultLandmark.textContent = spot.landmark;
  resultSouvenir.textContent = spot.souvenir;
  resultDetail.hidden = false;

  spinning = false;
  rouletteButton.disabled = false;
}

rouletteButton.addEventListener('click', spinRoulette);

loadSpots();
