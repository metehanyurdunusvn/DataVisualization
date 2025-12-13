// Global State
let map;
let marker;
let polyline;
let qrMarker;
let boundaryLayer;
let planeIcon;
let currentPlaneId = null;
let flightData = [];
let isPlaying = false;
let playbackSpeed = 1;
let currentIndex = 0;
let animationFrameId;

// HTML Elements
const els = {
    planeList: document.getElementById('plane-list'),
    valAlt: document.getElementById('val-alt'),
    valSpeed: document.getElementById('val-speed'),
    valHeading: document.getElementById('val-heading'),
    valBatt: document.getElementById('val-batt'),
    valLatLon: document.getElementById('val-latlon'),
    valTime: document.getElementById('val-time'),
    timeline: document.getElementById('timeline'),
    btnPlayPause: document.getElementById('btn-play-pause'),
    iconPlay: document.getElementById('icon-play'),
    iconPause: document.getElementById('icon-pause'),
    frameIdx: document.getElementById('frame-idx'),
    frameTotal: document.getElementById('frame-total'),
    activeLabel: document.getElementById('active-plane-label'),
    chkFullPath: document.getElementById('chk-full-path')
};

const TRAIL_LENGTH = 50;

// --- Initialization ---

function initMap() {
    map = L.map('map').setView([40.20, 25.88], 13);

    // Google Satellite Hybrid layer
    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        attribution: 'Map data ©2025 Google',
        maxZoom: 20
    }).addTo(map);

    updatePlaneIcon();
    addStaticLayers();
    initSettingsUI();
}

function updatePlaneIcon() {
    const color = appSettings.get('primaryPlaneColor');
    planeIcon = L.divIcon({
        html: `<i class="ph ph-airplane-tilt" style="font-size: 24px; color: ${color}; transform: rotate(0deg); display:block; filter: drop-shadow(0 0 5px ${color}80);"></i>`,
        className: 'plane-marker-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    if (marker) marker.setIcon(planeIcon);
}

function initSettingsUI() {
    const modal = document.getElementById('settings-modal');
    const btnParams = [
        { id: 'btn-settings', action: 'open' },
        { id: 'btn-close-settings', action: 'close' }
    ];

    btnParams.forEach(p => {
        const el = document.getElementById(p.id);
        if (el) el.addEventListener('click', () => {
            if (p.action === 'open') {
                loadSettingsToUI();
                modal.classList.remove('hidden');
            } else {
                modal.classList.add('hidden');
            }
        });
    });

    // Binding Inputs
    const bindings = [
        { id: 'set-primary-color', key: 'primaryPlaneColor' },
        { id: 'set-secondary-color', key: 'secondaryPlaneColor' },
        { id: 'set-primary-path-color', key: 'primaryPathColor' },
        { id: 'set-secondary-path-color', key: 'secondaryPathColor' },
        { id: 'set-boundary-color', key: 'boundaryColor' },
        { id: 'set-fill-color', key: 'boundaryFillColor' },
        { id: 'set-fill-opacity', key: 'boundaryFillOpacity' }
    ];

    bindings.forEach(b => {
        const el = document.getElementById(b.id);
        if (el) {
            el.addEventListener('input', (e) => {
                const val = e.target.value;
                appSettings.saveSettings({ [b.key]: val });
                refreshVisuals();
            });
        }
    });

    document.getElementById('btn-reset-settings').addEventListener('click', () => {
        appSettings.saveSettings(appSettings.defaults);
        loadSettingsToUI();
        refreshVisuals();
    });
}

function loadSettingsToUI() {
    document.getElementById('set-primary-color').value = appSettings.get('primaryPlaneColor');
    document.getElementById('set-secondary-color').value = appSettings.get('secondaryPlaneColor');
    document.getElementById('set-primary-path-color').value = appSettings.get('primaryPathColor');
    document.getElementById('set-secondary-path-color').value = appSettings.get('secondaryPathColor');
    document.getElementById('set-boundary-color').value = appSettings.get('boundaryColor');
    document.getElementById('set-fill-color').value = appSettings.get('boundaryFillColor');
    document.getElementById('set-fill-opacity').value = appSettings.get('boundaryFillOpacity');
}

function refreshVisuals() {
    updatePlaneIcon();
    initSecondaryVisuals();
    if (markerSec) markerSec.setIcon(planeIconSec);

    if (polyline) polyline.setStyle({ color: appSettings.get('primaryPathColor') });
    if (polylineSec) polylineSec.setStyle({ color: appSettings.get('secondaryPathColor') });

    addStaticLayers();
}

function addStaticLayers() {
    // QR Code Marker
    const qrCoords = [40.20323, 25.88129];
    const qrIcon = L.divIcon({
        html: '<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=CelebiLogViewer" style="width: 100%; height: 100%; display: block;">',
        className: 'qr-marker-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    if (qrMarker) map.removeLayer(qrMarker);
    qrMarker = L.marker(qrCoords, {
        icon: qrIcon,
        title: "QR Location",
        zIndexOffset: 1
    }).addTo(map);

    // Competition Boundary
    const boundaryCoords = [
        [40.19891, 25.88131],
        [40.20009, 25.87654],
        [40.20727, 25.87931],
        [40.20612, 25.88425]
    ];

    if (boundaryLayer) map.removeLayer(boundaryLayer);

    boundaryLayer = L.polygon(boundaryCoords, {
        color: appSettings.get('boundaryColor'),
        weight: 2,
        fillColor: appSettings.get('boundaryFillColor'),
        fillOpacity: parseFloat(appSettings.get('boundaryFillOpacity')),
        dashArray: '5, 5'
    }).addTo(map);
}

// --- Data Fetching ---

async function fetchIds() {
    try {
        const res = await fetch('/api/ids');
        const ids = await res.json();
        renderIdList(ids);
    } catch (err) {
        console.error("Failed to fetch IDs:", err);
    }
}

function renderIdList(ids) {
    els.planeList.innerHTML = '';
    ids.forEach(id => {
        const item = document.createElement('div');
        item.className = 'id-item';
        item.innerHTML = `
            <span>Plane #${id}</span>
            <i class="ph ph-airplane-tilt plane-icon"></i>
        `;
        item.onclick = () => {
            if (isCompareMode) {
                loadSecondaryPlane(id, item);
            } else {
                loadPlaneData(id, item);
            }
        };
        els.planeList.appendChild(item);
    });
}

// --- Data Loading ---

async function loadPlaneData(id, domItem) {
    if (currentPlaneId === id) return;

    // Active UI State
    document.querySelectorAll('.id-item').forEach(el => el.classList.remove('active'));
    domItem.classList.add('active');

    els.activeLabel.innerText = `PLANE #${id}`;

    currentPlaneId = id;
    pause();

    try {
        const res = await fetch(`/api/data/${id}`);
        const data = await res.json();

        flightData = data;
        currentIndex = 0;

        // Reset Timeline
        els.timeline.max = flightData.length - 1;
        els.timeline.value = 0;
        els.frameTotal.innerText = flightData.length;

        // Reset Map Visuals
        if (polyline) map.removeLayer(polyline);
        if (marker) map.removeLayer(marker);

        polyline = L.polyline([], {
            color: appSettings.get('primaryPathColor'),
            weight: 3,
            opacity: 0.8
        }).addTo(map);

        const allPoints = flightData.map(d => [d.lat, d.lon]);
        if (allPoints.length > 0) {
            map.fitBounds(L.polyline(allPoints).getBounds());
            marker = L.marker(allPoints[0], { icon: planeIcon }).addTo(map);
        }

        updateFrame(0);

    } catch (err) {
        console.error("Failed to load plane data:", err);
    }
}

let isFullPathRendered = false;

function updateFrame(index) {
    if (!flightData[index]) return;

    const d = flightData[index];
    const latlng = [d.lat, d.lon];

    marker.setLatLng(latlng);

    // Path Rendering Optimization
    if (els.chkFullPath.checked) {
        if (!isFullPathRendered) {
            const fullPath = flightData.map(d => [d.lat, d.lon]);
            polyline.setLatLngs(fullPath);
            isFullPathRendered = true;
        }
    } else {
        isFullPathRendered = false;
        const start = Math.max(0, index - TRAIL_LENGTH);
        const trailData = flightData.slice(start, index + 1);
        const trailLatLngs = trailData.map(d => [d.lat, d.lon]);
        polyline.setLatLngs(trailLatLngs);
    }

    // Rotate Icon based on Heading
    const cssRotation = d.heading - 45; // Adjust for Phosphor icon initial correct orientation
    const iconEl = marker.getElement();
    if (iconEl) {
        const iTag = iconEl.querySelector('i');
        if (iTag) iTag.style.transform = `rotate(${cssRotation}deg)`;
    }

    // Update HUD
    els.valAlt.innerText = d.alt != null ? d.alt.toFixed(1) : '--';
    els.valSpeed.innerText = d.speed != null ? d.speed.toFixed(1) : '--';
    els.valHeading.innerText = d.heading != null ? d.heading.toFixed(0) : '--';
    els.valBatt.innerText = d.battery != null ? d.battery : '--';
    els.valLatLon.innerText = `${d.lat.toFixed(5)} / ${d.lon.toFixed(5)}`;
    els.valTime.innerText = d.timestamp.split(' ')[1];

    els.frameIdx.innerText = index;
    els.timeline.value = index;

    // secondary sync
    if (secondaryPlaneId && flightDataSec.length > 0) {
        const targetTime = d.timestamp;
        const secIndex = flightDataSec.findIndex(s => s.timestamp === targetTime);
        const bestSec = flightDataSec[secIndex];

        if (bestSec) {
            const secLL = [bestSec.lat, bestSec.lon];
            markerSec.setLatLng(secLL);

            document.getElementById('sec-alt').innerText = bestSec.alt.toFixed(1);
            document.getElementById('sec-speed').innerText = bestSec.speed.toFixed(1);

            const dist = map.distance(latlng, secLL);
            document.getElementById('sec-dist').innerText = dist.toFixed(0) + ' m';

            if (polylineSec && document.getElementById('chk-sec-path').checked) {
                const start = Math.max(0, secIndex - TRAIL_LENGTH);
                const trailData = flightDataSec.slice(start, secIndex + 1);
                const trailLatLngs = trailData.map(d => [d.lat, d.lon]);
                polylineSec.setLatLngs(trailLatLngs);
            }

            const rotSec = bestSec.heading - 45;
            const iconElSec = markerSec.getElement();
            if (iconElSec) {
                const iTag = iconElSec.querySelector('i');
                if (iTag) iTag.style.transform = `rotate(${rotSec}deg)`;
            }
        } else {
            document.getElementById('sec-alt').innerText = '--';
            document.getElementById('sec-speed').innerText = '--';
        }
    }
}

// --- Playback Logic ---

function play() {
    if (isPlaying) return;
    isPlaying = true;
    lastTime = performance.now();
    accumTime = 0;
    animationFrameId = requestAnimationFrame((ts) => loop(ts));
    updatePlayIcon();
}

function pause() {
    isPlaying = false;
    cancelAnimationFrame(animationFrameId);
    updatePlayIcon();
}

function updatePlayIcon() {
    if (isPlaying) {
        els.iconPlay.classList.add('hidden');
        els.iconPause.classList.remove('hidden');
    } else {
        els.iconPlay.classList.remove('hidden');
        els.iconPause.classList.add('hidden');
    }
}

function togglePlay() {
    if (isPlaying) pause();
    else play();
}

let lastTime = 0;
let accumTime = 0;

function loop(timestamp) {
    if (!isPlaying) return;

    if (!lastTime) lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    const samplesPerSecond = 10 * playbackSpeed;
    const msPerSample = 1000 / samplesPerSecond;

    accumTime += dt;

    if (accumTime > msPerSample) {
        const framesToAdvance = Math.floor(accumTime / msPerSample);
        accumTime -= framesToAdvance * msPerSample;

        currentIndex += framesToAdvance;

        if (currentIndex >= flightData.length) {
            currentIndex = 0;
        }

        updateFrame(currentIndex);
    }

    animationFrameId = requestAnimationFrame(loop);
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    fetchIds();

    els.btnPlayPause.addEventListener('click', togglePlay);

    els.timeline.addEventListener('input', (e) => {
        pause();
        currentIndex = parseInt(e.target.value);
        updateFrame(currentIndex);
    });

    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');

    if (speedSlider && speedVal) {
        speedSlider.addEventListener('input', (e) => {
            playbackSpeed = parseFloat(e.target.value);
            speedVal.innerText = playbackSpeed.toFixed(1) + 'x';
        });
    }

    document.getElementById('id-filter').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.id-item').forEach(item => {
            const text = item.innerText.toLowerCase();
            item.style.display = text.includes(term) ? 'flex' : 'none';
        });
    });

    if (els.chkFullPath) {
        els.chkFullPath.addEventListener('change', () => {
            isFullPathRendered = false;
            if (flightData && flightData.length > 0) {
                updateFrame(currentIndex);
            }
        });
    }

    const btnCompare = document.getElementById('btn-compare-mode');
    if (btnCompare) {
        btnCompare.addEventListener('click', () => {
            isCompareMode = !isCompareMode;
            btnCompare.classList.toggle('active', isCompareMode);

            if (!isCompareMode) {
                secondaryPlaneId = null;
                clearSecondaryVisuals();
                document.getElementById('hud-secondary').classList.add('hidden');
            }
        });
    }

    initSecondaryVisuals();

    const chkSecPath = document.getElementById('chk-sec-path');
    if (chkSecPath) {
        chkSecPath.addEventListener('change', () => {
            if (polylineSec) {
                if (chkSecPath.checked) {
                    polylineSec.addTo(map);
                } else {
                    polylineSec.remove();
                }
            }
        });
    }
});

// --- Compare Mode Logic ---

let isCompareMode = false;
let secondaryPlaneId = null;
let flightDataSec = [];
let polylineSec;
let markerSec;
let planeIconSec;

function initSecondaryVisuals() {
    const color = appSettings.get('secondaryPlaneColor');
    planeIconSec = L.divIcon({
        html: `<i class="ph ph-airplane-tilt" style="font-size: 24px; color: ${color}; transform: rotate(0deg); display:block; filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.8));"></i>`,
        className: 'plane-marker-icon-sec',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

function clearSecondaryVisuals() {
    if (polylineSec) map.removeLayer(polylineSec);
    if (markerSec) map.removeLayer(markerSec);
    flightDataSec = [];
    document.querySelectorAll('.id-item').forEach(el => el.classList.remove('active-sec'));
}

async function loadSecondaryPlane(id, domItem) {
    if (secondaryPlaneId === id) return;
    secondaryPlaneId = id;

    document.querySelectorAll('.id-item').forEach(el => el.classList.remove('active-sec'));
    domItem.classList.add('active-sec');
    document.getElementById('hud-secondary').classList.remove('hidden');
    document.getElementById('sec-plane-label').innerText = `PLANE #${id}`;

    try {
        const res = await fetch(`/api/data/${id}`);
        const data = await res.json();
        flightDataSec = data;

        if (polylineSec) map.removeLayer(polylineSec);
        if (markerSec) map.removeLayer(markerSec);

        polylineSec = L.polyline([], {
            color: appSettings.get('secondaryPathColor'),
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 10'
        });

        if (document.getElementById('chk-sec-path') && document.getElementById('chk-sec-path').checked) {
            polylineSec.addTo(map);
        }

        if (flightDataSec.length > 0) {
            const startPt = [flightDataSec[0].lat, flightDataSec[0].lon];
            markerSec = L.marker(startPt, { icon: planeIconSec }).addTo(map);
        }

        updateFrame(currentIndex);

    } catch (err) {
        console.error("Failed to load secondary:", err);
    }
}
