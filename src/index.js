import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls, earth, timeDisplay, timeSlider, speedButton, heatmapToggle;
let fullEarthquakeData = [];
let simData = [];
let ringMesh;
let activeRings = [];
const MAX_INSTANCES = 25000;
const BASE_SIM_SPEED = 1000 * 60 * 60 * 24 * 10;
const speedLevels = [1, 4, 16, 64];
let currentSpeedMultiplier = 1;
let simClock = new THREE.Clock();
let simStart = 0, simEnd = 0, currentTime = 0;
let isDraggingSlider = false;

// Heatmap Globals
let heatmapMesh, heatmapTexture, heatmapContext;

function init() {
  const container = document.getElementById('app');
  timeDisplay = document.getElementById('timeDisplay');
  timeSlider = document.getElementById('timeSlider');
  speedButton = document.getElementById('speedButton');
  heatmapToggle = document.getElementById('heatmapToggle');

  // Scene & Camera
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 3.5);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 3, 5);
  camera.add(dirLight);
  scene.add(camera);

  // Loading Manager
  const manager = new THREE.LoadingManager();
  manager.onLoad = () => {
    scene.add(earth);
    initHeatmap(); // Initialize heatmap

    fetch('data/database.csv')
        .then(res => res.ok ? res.text() : Promise.reject(res.statusText))
        .then(parseCSV)
        .then(setupSimulation)
        .catch(err => console.error('Error loading data:', err));

    animate();
  };

  // Textures
  const loader = new THREE.TextureLoader(manager);
  const earth_tex = loader.load('textures/earth-gs.jpg');
  const bump_tex = loader.load('textures/bump.jpg');
  const spec_tex = loader.load('textures/spec.jpg');

  // Earth Mesh
  earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshPhongMaterial({
        map: earth_tex,
        bumpMap: bump_tex,
        bumpScale: 0.05,
        displacementMap: bump_tex,
        displacementScale: 0.01,
        specularMap: spec_tex,
        specular: new THREE.Color(0x222222),
        shininess: 20,
      })
  );

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, {
    enableDamping: true,
    dampingFactor: 0.05,
    enablePan: false,
    minDistance: 1.5,
    maxDistance: 6
  });

  window.addEventListener('resize', onWindowResize);

  // Instanced Rings
  const ringGeometry = new THREE.RingGeometry(0.002, 0.0024, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xcc3333),
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  ringMesh = new THREE.InstancedMesh(ringGeometry, ringMaterial, MAX_INSTANCES);
  ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ringMesh.count = 0;
  earth.add(ringMesh);

  // Event Listeners
  speedButton.addEventListener('click', changeSpeed);
  timeSlider.addEventListener('input', onSliderInput);
  timeSlider.addEventListener('mousedown', () => { isDraggingSlider = true; });
  timeSlider.addEventListener('mouseup', () => { isDraggingSlider = false; simClock.getDelta(); });

  // Toggle Heatmap Listener
  heatmapToggle.addEventListener('change', (e) => {
    if(heatmapMesh) heatmapMesh.visible = e.target.checked;
  });
}

// Initialize Heatmap
function initHeatmap() {
  // Virtual Canvas
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  heatmapContext = canvas.getContext('2d');

  // Initialize Black (Intensity 0)
  // Shader will interpret 0 as the base Purple color with base Opacity
  heatmapContext.fillStyle = 'black';
  heatmapContext.fillRect(0, 0, width, height);

  // 2. Texture
  heatmapTexture = new THREE.CanvasTexture(canvas);
  heatmapTexture.minFilter = THREE.LinearFilter;
  heatmapTexture.magFilter = THREE.LinearFilter;

  // Shader
  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform sampler2D tData;
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      // Read accumulated intensity from texture
      float intensity = texture2D(tData, vUv).r;

      // Gradient
      vec3 colorLow = vec3(0.2, 0.0, 0.3); 
      vec3 colorMid = vec3(0.8, 0.2, 0.2); 
      vec3 colorHigh = vec3(1.0, 0.9, 0.5); 

      // Color Mixing
      vec3 col = mix(colorLow, colorMid, smoothstep(0.0, 0.5, intensity));
      col = mix(col, colorHigh, smoothstep(0.5, 1.0, intensity));

      // Opacity
      float alpha = 0.5 + (0.4 * intensity);
      
      gl_FragColor = vec4(col, alpha);
    }
  `;

  const geometry = new THREE.SphereGeometry(1.01, 128, 128);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tData: { value: heatmapTexture }
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending
  });

  heatmapMesh = new THREE.Mesh(geometry, material);
  scene.add(heatmapMesh);
}

function parseCSV(content) {
  const rows = content.split(/\r?\n/).filter(Boolean);
  if (rows.length <= 1) return;

  const headers = rows[0].split(',').map(h => h.trim());
  const getIndex = name => headers.indexOf(name);

  fullEarthquakeData = rows.slice(1).map(r => {
    const cols = r.split(',').map(c => c.trim());
    const dateStr = cols[getIndex('Date')];
    if(!dateStr) return null;

    const [d, m, y] = dateStr.split('/');
    const date = new Date(`${y}-${m}-${d}T${cols[getIndex('Time')]}Z`);

    if (isNaN(date)) return null;
    return {
      date,
      lat: +cols[getIndex('Latitude')],
      lon: +cols[getIndex('Longitude')],
      mag: +cols[getIndex('Magnitude')],
    };
  }).filter(Boolean);
}

function resetSimulationData() {
  simData = [...fullEarthquakeData];

  // Clear heatmap on reset
  if(heatmapContext) {
    heatmapContext.globalCompositeOperation = 'source-over';
    heatmapContext.fillStyle = 'black';
    heatmapContext.fillRect(0, 0, heatmapContext.canvas.width, heatmapContext.canvas.height);
    heatmapTexture.needsUpdate = true;
  }
}

function setupSimulation() {
  if (!fullEarthquakeData.length) return;
  fullEarthquakeData.sort((a, b) => a.date - b.date);

  simStart = fullEarthquakeData[0].date.getTime();
  simEnd = fullEarthquakeData.at(-1).date.getTime();
  currentTime = simStart;

  resetSimulationData();

  timeSlider.min = simStart;
  timeSlider.max = simEnd;
  timeSlider.value = currentTime;
  const dayInMillis = 1000 * 60 * 60 * 24;
  timeSlider.step = dayInMillis / 10;
}

function coordToVector3(lat, lon, radius = 1) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
  );
}

function triggerEarthquake(lat, lon, mag) {
  // Rings
  activeRings.push({
    pos: coordToVector3(lat, lon, 1.008),
    start: performance.now(),
    magnitude: mag
  });

  // Heatmap
  if (heatmapContext) {
    const width = heatmapContext.canvas.width;
    const height = heatmapContext.canvas.height;

    // Map Coordinates
    const x = ((lon + 180) / 360) * width;
    const y = ((1 - (lat + 90) / 180)) * height;

    // Fix stretching
    const latRad = (lat * Math.PI) / 180;
    let scaleX = 1 / Math.cos(latRad);

    // Clamp scale
    scaleX = Math.min(scaleX, 6.0);

    // Radius
    const radius = mag * 1.5;

    heatmapContext.globalCompositeOperation = 'screen';
    heatmapContext.beginPath();

    heatmapContext.ellipse(x, y, radius * scaleX, radius, 0, 0, Math.PI * 2);

    // Accumulation
    heatmapContext.fillStyle = `rgba(255, 255, 255, 0.03)`;
    heatmapContext.fill();
  }
}

function updateRings() {
  const now = performance.now();
  const tempMat = new THREE.Matrix4();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();

  let visible = 0;
  activeRings = activeRings.filter(r => (now - r.start) / 1000 < 1);

  const maxVisible = Math.min(activeRings.length, MAX_INSTANCES);

  for (let i = 0; i < maxVisible; i++) {
    const r = activeRings[i];
    const age = (now - r.start) / 1000;
    const magnitudeScale = Math.pow(2, (r.magnitude - 5));
    const scale = 1 + age * 4 * magnitudeScale;

    tmpScale.setScalar(scale);
    tmpQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), r.pos.clone().normalize());
    tempMat.compose(r.pos, tmpQuat, tmpScale);
    ringMesh.setMatrixAt(visible, tempMat);

    visible++;
  }

  ringMesh.count = visible;
  ringMesh.instanceMatrix.needsUpdate = true;
}

function simulate() {
  const deltaTime = simClock.getDelta();

  if (!isDraggingSlider) {
    currentTime += deltaTime * 1000 * (BASE_SIM_SPEED / 1000) * currentSpeedMultiplier;
  }

  if (currentTime > simEnd) {
    return;
  }

  let dataProcessed = false;

  while (simData.length && simData[0].date <= currentTime) {
    const e = simData.shift();
    triggerEarthquake(e.lat, e.lon, e.mag);
    dataProcessed = true;
  }

  // Update texture only if data changed to save performance
  if (heatmapContext && heatmapTexture && dataProcessed) {
    heatmapTexture.needsUpdate = true;
  }

  updateRings();
  updateTimeDisplay();
}

function updateTimeDisplay() {
  if (!timeDisplay) return;
  const date = new Date(currentTime);
  const [day, time] = date.toISOString().split('T');
  timeDisplay.textContent = `${day} ${time.split('.')[0]} UTC`;

  if (timeSlider && !isDraggingSlider) {
    timeSlider.value = currentTime;
  }
}

function changeSpeed() {
  let currentIndex = speedLevels.indexOf(currentSpeedMultiplier);
  currentIndex = (currentIndex + 1) % speedLevels.length;
  currentSpeedMultiplier = speedLevels[currentIndex];
  speedButton.textContent = `${currentSpeedMultiplier}x`;
}

function onSliderInput() {
  currentTime = parseFloat(timeSlider.value);
  simData = fullEarthquakeData.filter(e => e.date.getTime() >= currentTime);
  activeRings = [];
  ringMesh.count = 0;

  // Reset Heatmap on drag
  resetSimulationData();

  updateTimeDisplay();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  earth.rotation.y += 0.0002;
  if(heatmapMesh) heatmapMesh.rotation.y = earth.rotation.y;

  controls.update();
  simulate();
  renderer.render(scene, camera);
}

init();