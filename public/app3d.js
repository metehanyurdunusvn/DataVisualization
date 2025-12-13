

// Configuration & State
let viewer;
let currentPlaneEntity = null;
let currentPlaneId = null;

let secondaryPlaneEntity = null;
let secondaryPlaneId = null;
let isCompareMode = false;

const els = {
    planeList: document.getElementById('plane-list'),
    valAlt: document.getElementById('val-alt'),
    valSpeed: document.getElementById('val-speed'),
    valHeading: document.getElementById('val-heading'),
    valPitchRoll: document.getElementById('val-pitch-roll'),
    valLatLon: document.getElementById('val-latlon'),
    valTime: document.getElementById('val-time'),
    btnPlayPause: document.getElementById('btn-play-pause'),
    iconPlay: document.getElementById('icon-play'),
    iconPause: document.getElementById('icon-pause'),
    btnCompare: document.getElementById('btn-compare-mode'),
    hudSecondary: document.getElementById('hud-secondary'),
    secPlaneLabel: document.getElementById('sec-plane-label'),
    secAlt: document.getElementById('sec-alt'),
    secSpeed: document.getElementById('sec-speed'),
    secDist: document.getElementById('sec-dist'),
    chkSecPath: document.getElementById('chk-sec-path'),
    btnSwap: document.getElementById('btn-swap-planes'),
};

// --- Initialization ---

function initViewer() {
    viewer = new Cesium.Viewer('cesiumContainer', {
        terrain: undefined,
        imageryProvider: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: true,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        animation: false,
        shouldAnimate: false
    });

    // Imagery Provider (Esri World Imagery via ArcGIS)
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        credit: 'Esri World Imagery',
        maximumLevel: 18
    }));

    viewer.scene.globe.enableLighting = true;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0e121a');

    viewer.clock.onTick.addEventListener(handleTick);

    addQRCode();
    addBoundaries();
}

function addBoundaries() {
    const boundaryDegrees = [
        25.88131, 40.19891,
        25.87654, 40.20009,
        25.87931, 40.20727,
        25.88425, 40.20612
    ];

    viewer.entities.add({
        polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(boundaryDegrees),
            height: 0,
            material: Cesium.Color.RED.withAlpha(0.1),
            outline: true,
            outlineColor: Cesium.Color.RED,
            outlineWidth: 2
        }
    });

    // Polyline outline for better visibility
    viewer.entities.add({
        polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([
                ...boundaryDegrees,
                boundaryDegrees[0], boundaryDegrees[1]
            ]),
            width: 2,
            material: new Cesium.PolylineGlowMaterialProperty({
                color: Cesium.Color.RED
            }),
            clampToGround: true
        }
    });
}

function addQRCode() {
    const lat = 40.20323;
    const lon = 25.88129;
    const size = 0.00005;

    viewer.entities.add({
        rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(lon - size, lat - size, lon + size, lat + size),
            material: new Cesium.ImageMaterialProperty({
                image: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=CelebiLogViewer',
                transparent: true
            }),
            rotation: 0,
            stRotation: 0,
            classificationType: Cesium.ClassificationType.TERRAIN
        },
        description: "Target location QR Code"
    });
}

// --- Render Loop (Tick) ---

function handleTick(clock) {
    if (!currentPlaneEntity) return;

    const time = clock.currentTime;

    // Primary Plane Data
    const position = currentPlaneEntity.position.getValue(time);
    const orientation = currentPlaneEntity.orientation.getValue(time);

    if (position) {
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const alt = cartographic.height;

        els.valLatLon.innerText = `${lat.toFixed(5)} / ${lon.toFixed(5)}`;
        els.valAlt.innerText = alt.toFixed(1);

        const jsDate = Cesium.JulianDate.toDate(time);
        els.valTime.innerText = jsDate.toLocaleTimeString();

        if (currentPlaneEntity.properties && currentPlaneEntity.properties.speed) {
            const speed = currentPlaneEntity.properties.speed.getValue(time);
            els.valSpeed.innerText = speed !== undefined ? speed.toFixed(1) : '--';
        }

        if (orientation) {
            const hpr = Cesium.HeadingPitchRoll.fromQuaternion(orientation);

            // Correct heading for display (undo -90 shift)
            let headingDeg = Cesium.Math.toDegrees(hpr.heading) + 90;
            if (headingDeg < 0) headingDeg += 360;
            if (headingDeg >= 360) headingDeg -= 360;

            const pitch = Cesium.Math.toDegrees(hpr.pitch);
            const roll = Cesium.Math.toDegrees(hpr.roll);

            els.valHeading.innerText = headingDeg.toFixed(0);
            els.valPitchRoll.innerText = `${pitch.toFixed(1)} / ${roll.toFixed(1)}`;
        }
    }

    // Secondary Plane Data
    if (secondaryPlaneEntity && isCompareMode) {
        const secPos = secondaryPlaneEntity.position.getValue(time);
        if (secPos) {
            const cartSec = Cesium.Cartographic.fromCartesian(secPos);
            els.secAlt.innerText = cartSec.height.toFixed(1);

            if (secondaryPlaneEntity.properties && secondaryPlaneEntity.properties.speed) {
                const sSpeed = secondaryPlaneEntity.properties.speed.getValue(time);
                els.secSpeed.innerText = sSpeed !== undefined ? sSpeed.toFixed(1) : '--';
            }

            if (position) {
                const dist = Cesium.Cartesian3.distance(position, secPos);
                els.secDist.innerText = dist.toFixed(0) + ' m';
            }
        } else {
            els.secAlt.innerText = '--';
            els.secSpeed.innerText = '--';
            els.secDist.innerText = '--';
        }
    }
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
            <i class="ph ph-cube plane-icon"></i>
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

function parseTimestamp(str) {
    let clean = str.replace(',', '.').replace(' ', 'T');
    return Cesium.JulianDate.fromDate(new Date(clean));
}

// --- Data Loading ---

async function loadPlaneData(id, domItem) {
    if (currentPlaneId === id) return;
    currentPlaneId = id;

    document.querySelectorAll('.id-item').forEach(el => el.classList.remove('active'));
    domItem.classList.add('active');
    document.getElementById('active-plane-label').innerText = `PLANE #${id}`;

    try {
        const res = await fetch(`/api/data/${id}`);
        const data = await res.json();
        if (data.length === 0) return;

        if (currentPlaneEntity) {
            viewer.entities.remove(currentPlaneEntity);
            currentPlaneEntity = null;
        }

        const entity = createPlaneEntity(data, Cesium.Color.CYAN, true, {
            uri: 'https://raw.githubusercontent.com/CesiumGS/cesium/master/Apps/SampleData/models/CesiumAir/Cesium_Air.glb',
            scale: 0.15
        });
        currentPlaneEntity = viewer.entities.add(entity);
        viewer.trackedEntity = currentPlaneEntity;

    } catch (err) {
        console.error("Failed to load plane 3D data:", err);
    }
}

async function loadSecondaryPlane(id, domItem) {
    if (secondaryPlaneId === id) return;
    secondaryPlaneId = id;

    document.querySelectorAll('.id-item').forEach(el => el.classList.remove('active-sec'));
    domItem.classList.add('active-sec');
    els.secPlaneLabel.innerText = `PLANE #${id}`;
    els.hudSecondary.classList.remove('hidden');

    try {
        const res = await fetch(`/api/data/${id}`);
        const data = await res.json();
        if (data.length === 0) return;

        if (secondaryPlaneEntity) {
            viewer.entities.remove(secondaryPlaneEntity);
            secondaryPlaneEntity = null;
        }

        const entity = createPlaneEntity(data, Cesium.Color.fromCssColorString('#00ff00'), false, {
            uri: 'https://raw.githubusercontent.com/CesiumGS/cesium/master/Apps/SampleData/models/CesiumAir/Cesium_Air.glb',
            scale: 0.15,
            color: Cesium.Color.LIME,
            colorBlendMode: Cesium.ColorBlendMode.MIX,
            colorBlendAmount: 0.5
        });

        entity.path.material = new Cesium.PolylineGlowMaterialProperty({
            color: Cesium.Color.YELLOW
        });

        if (els.chkSecPath) {
            entity.path.show = els.chkSecPath.checked;
        }

        secondaryPlaneEntity = viewer.entities.add(entity);

    } catch (err) {
        console.error("Failed to load secondary plane:", err);
    }
}

function createPlaneEntity(data, pathColor, isPrimary, modelConfig) {
    const positionProperty = new Cesium.SampledPositionProperty();
    const orientationProperty = new Cesium.SampledProperty(Cesium.Quaternion);
    const speedProperty = new Cesium.SampledProperty(Number);

    const start = parseTimestamp(data[0].timestamp);
    const stop = parseTimestamp(data[data.length - 1].timestamp);

    for (let i = 0; i < data.length; i++) {
        const d = data[i];
        const time = parseTimestamp(d.timestamp);

        const position = Cesium.Cartesian3.fromDegrees(d.lon, d.lat, d.alt);
        positionProperty.addSample(time, position);

        // Adjust Heading by -90 degrees for visual correction
        let headingDeg = d.heading - 90;
        const headingRad = Cesium.Math.toRadians(headingDeg);
        const pitchRad = Cesium.Math.toRadians(d.pitch);
        const rollRad = Cesium.Math.toRadians(d.roll);

        const hpr = new Cesium.HeadingPitchRoll(headingRad, pitchRad, rollRad);
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

        orientationProperty.addSample(time, orientation);
        speedProperty.addSample(time, d.speed);
    }

    if (isPrimary) {
        viewer.clock.startTime = start.clone();
        viewer.clock.stopTime = stop.clone();
        viewer.clock.currentTime = start.clone();
        viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
        viewer.clock.multiplier = 1;
        viewer.timeline.zoomTo(start, stop);
    }

    const mc = modelConfig || {
        uri: 'https://raw.githubusercontent.com/CesiumGS/cesium/master/Apps/SampleData/models/CesiumAir/Cesium_Air.glb',
        scale: 0.15
    };

    return {
        availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({ start: start, stop: stop })]),
        position: positionProperty,
        orientation: orientationProperty,
        model: {
            uri: mc.uri,
            scale: mc.scale,
            minimumPixelSize: 48,
            maximumScale: 20000,
            runAnimations: true,
            color: mc.color,
            colorBlendMode: mc.colorBlendMode,
            colorBlendAmount: mc.colorBlendAmount
        },
        path: {
            resolution: 1,
            material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.1,
                color: pathColor
            }),
            width: 10,
            leadTime: 0,
            trailTime: 60
        },
        properties: {
            speed: speedProperty
        }
    };
}

// --- Event Listeners ---

document.getElementById('btn-play-pause').addEventListener('click', () => {
    viewer.clock.shouldAnimate = !viewer.clock.shouldAnimate;
    updatePlayIcon();
});


setTimeout(updatePlayIcon, 500);

function updatePlayIcon() {
    if (viewer.clock.shouldAnimate) {
        els.iconPlay.classList.add('hidden');
        els.iconPause.classList.remove('hidden');
    } else {
        els.iconPlay.classList.remove('hidden');
        els.iconPause.classList.add('hidden');
    }
}

// Speed Slider
const speedSlider = document.getElementById('speed-slider');
const speedVal = document.getElementById('speed-val');

if (speedSlider && speedVal) {
    speedSlider.addEventListener('input', (e) => {
        const speed = parseFloat(e.target.value);
        viewer.clock.multiplier = speed;
        speedVal.innerText = speed.toFixed(1) + 'x';
    });
}

// Compare Mode
els.btnCompare.addEventListener('click', () => {
    isCompareMode = !isCompareMode;
    els.btnCompare.classList.toggle('active', isCompareMode);

    if (!isCompareMode) {
        secondaryPlaneId = null;
        if (secondaryPlaneEntity) {
            viewer.entities.remove(secondaryPlaneEntity);
            secondaryPlaneEntity = null;
        }
        els.hudSecondary.classList.add('hidden');
        document.querySelectorAll('.id-item').forEach(el => el.classList.remove('active-sec'));
    }
});

document.getElementById('btn-2d-mode').addEventListener('click', () => {
    window.location.href = 'index.html';
});

if (els.chkSecPath) {
    els.chkSecPath.addEventListener('change', () => {
        if (secondaryPlaneEntity && secondaryPlaneEntity.path) {
            secondaryPlaneEntity.path.show = els.chkSecPath.checked;
        }
    });
}

// Swap Planes
if (els.btnSwap) {
    els.btnSwap.addEventListener('click', () => {
        if (!isCompareMode || !currentPlaneId || !secondaryPlaneId) return;

        const tempId = currentPlaneId;
        const newPrimaryId = secondaryPlaneId;
        const newSecondaryId = tempId;

        const preservedTime = viewer.clock.currentTime.clone();

        currentPlaneId = null;

        if (secondaryPlaneEntity) {
            viewer.entities.remove(secondaryPlaneEntity);
            secondaryPlaneEntity = null;
        }
        secondaryPlaneId = null;

        const findDomItem = (pid) => {
            const items = document.querySelectorAll('.id-item');
            for (let item of items) {
                if (item.innerText.includes(`Plane #${pid}`)) return item;
            }
            return null;
        };

        const domPrim = findDomItem(newPrimaryId);
        if (domPrim) loadPlaneData(newPrimaryId, domPrim).then(() => {
            if (viewer.clock.startTime && Cesium.JulianDate.lessThan(preservedTime, viewer.clock.stopTime) && Cesium.JulianDate.greaterThan(preservedTime, viewer.clock.startTime)) {
                viewer.clock.currentTime = preservedTime;
            }

            const domSec = findDomItem(newSecondaryId);
            if (domSec) loadSecondaryPlane(newSecondaryId, domSec);
        });
    });
}

// Start
initViewer();
fetchIds();
