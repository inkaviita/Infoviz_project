import * as THREE from "three";
import { OrbitControls } from 'jsm/controls/OrbitControls.js';
import { drawThreeGeo } from "./src/threeGeoJSON.js";

const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.3);

const globeGroup = new THREE.Group()
scene.add(globeGroup)

const camera = new THREE.PerspectiveCamera(75, w / h, 1, 100);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);


const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Globe base
const geometry = new THREE.SphereGeometry(2);
const lineMat = new THREE.LineBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.4,
});
const edges = new THREE.EdgesGeometry(geometry, 1);
const line = new THREE.LineSegments(edges, lineMat);
globeGroup.add(line);

// Global data
let centroids = [];
let emissionsData = {};
let emissionDots = {};
let disasterDots = {};

let currentYear = 2000;

let disastersData = {}
let suffererData = {}




// Load globe geometry
fetch('./geojson/ne_110m_land.json')
  .then(response => response.text())
  .then(text => {
    const data = JSON.parse(text);
    const countries = drawThreeGeo({
      json: data,
      radius: 2,
      materialOptions: { color: 0x80FF80 },
    });
    globeGroup.add(countries);
  });

// Load centroids from CSV using PapaParse
let centroidsLoaded = false;
let emissionsLoaded = false;
let disastersLoaded = false; 
let sufferersLoaded = false;

Papa.parse("datasets/countries.csv", {
  download: true,
  header: true,
  dynamicTyping: true,
  complete: function(results) {
    centroids = results.data;
    centroidsLoaded = true;
    if (emissionsLoaded) createDots(currentYear);
  }
});

// Load emissions data
fetch('datasets/normalized_emissions.json')
  .then(res => res.json())
  .then(data => {
    emissionsData = data;
    emissionsLoaded = true;
    if (centroidsLoaded) createEmissionDots(currentYear);
  });

fetch('datasets/combined_disasters_aggregated.json')
  .then(res => res.json())
  .then(data => {
    disastersData = data;
    disastersLoaded = true;
    if (disastersLoaded) createDisasterDots(currentYear);
  }

  )

fetch('datasets/combined_disasters_suffering.json')
  .then(res => res.json())
  .then(data => {
    suffererData = data;
    console.log(data)
    sufferersLoaded = true;
    if (sufferersLoaded) getTopCountries(currentYear);
  })


function createEmissionDots(year) {
  console.log("Creating emission dots for year:", year);
  Object.values(emissionDots).forEach(dot => globeGroup.remove(dot));
  emissionDots = {};

  centroids.forEach(point => {
    const country = point.COUNTRY;
    const lat = parseFloat(point.latitude);
    const lon = parseFloat(point.longitude);

    if (isNaN(lat) || isNaN(lon)) return;

    const emission = getEmissionForYear(country, year);
    if (!emission) return;

    const size = emission.raw / 20000000000; // normalized value used for size

    const dot = addDot(lat, lon, 2, "red", size);
    emissionDots[country] = dot;
  });
}



function createDisasterDots(year) {
  console.log("Creating disaster dots for year:", year);

  // Optionally, keep emission dots separate
  Object.values(disasterDots).forEach(dot => globeGroup.remove(dot));
  disasterDots = {};

  disastersData.forEach(disaster => {

    
    const disasterYear = parseInt(disaster.year);
    if (disasterYear !== year) return; // Only show disasters for the selected year

    const lat = parseFloat(disaster.latitude);
    const lon = parseFloat(disaster.longitude);
    const level = parseInt(disaster.level);

    if (isNaN(lat) || isNaN(lon) || isNaN(level)) return;

    // Size can scale with level
    const size = 0.015*level; // base size + multiplier per level
    const color = "blue";

    const dot = addDot(lat, lon, 2, color, size);
    const key = `${disaster.disaster_types}_${lat}_${lon}_${year}`;
    disasterDots[key] = dot;
  });
}





function getEmissionForYear(country, year) {
  const data = emissionsData[country];
  if (!data) return null;
  return data.find(d => d.year === year) || null;
}


function addDot(lat, lon, radius = 2, color = 0xff0000, size = 0.05) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  const geometry = new THREE.SphereGeometry(size, 8, 8);
  const material = new THREE.MeshBasicMaterial({ color });
  const dot = new THREE.Mesh(geometry, material);
  dot.position.set(x, y, z);

  globeGroup.add(dot);
  return dot;
}


function getTopCountries(year, n = 5) {
  if (!Array.isArray(suffererData)) {
    console.warn("suffererData is not an array:", suffererData);
    return { polluters: [], sufferers: [] };
  }

  const validCountries = new Set(centroids.map(c => c.COUNTRY));

  // Top polluters
  const polluters = Object.entries(emissionsData)
    .filter(([country]) => validCountries.has(country))
    .map(([country, data]) => {
      const record = data.find(d => d.year === year);
      return record ? { country, value: record.raw } : null;
    })
    .filter(Boolean)
    .sort((a,b) => b.value - a.value)
    .slice(0, n);

  // Top sufferers using suffering_index
  const sufferersMap = {};
  suffererData.forEach(d => {
    if (parseInt(d.year) !== year) return;
    const countryName = d.country;
    if (!countryName) return;
    sufferersMap[countryName] = (sufferersMap[countryName] || 0) + parseFloat(d.suffering_index);
  });

  const sufferers = Object.entries(sufferersMap)
    .map(([country, index]) => ({ country, suffering_index: index }))
    .sort((a,b) => b.suffering_index - a.suffering_index)
    .slice(0, n);

  return { polluters, sufferers };
}

function updateTopLists(year) {
  const { polluters, sufferers } = getTopCountries(year);

  const pollutersList = document.getElementById("pollutersList");
  const sufferersList = document.getElementById("sufferersList");

  pollutersList.innerHTML = polluters
    .map(p => `<li>${p.country}: ${p.value.toLocaleString()}</li>`)
    .join('');

  sufferersList.innerHTML = sufferers
    .map(s => `<li>${s.country}: ${s.suffering_index.toFixed(2)}</li>`)
    .join('');
}


function updatePollutersChart(polluters) {
  const chart = document.getElementById("pollutersChart");
  chart.innerHTML = "";

  if (!polluters || polluters.length === 0) return;

  const chartHeight = chart.clientHeight;  // total height in px
  const maxVal = Math.max(...polluters.map(p => p.value));

  polluters.forEach(p => {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "center";

    const bar = document.createElement("div");
    bar.style.width = "40px";
    // Use px instead of %:
    bar.style.height = `${(p.value / maxVal) * chartHeight}px`;
    bar.style.backgroundColor = "red";
    bar.title = `${p.country}: ${p.value.toLocaleString()}`;

    const label = document.createElement("div");
    label.textContent = p.country;
    label.style.color = "#fff";
    label.style.fontSize = "12px";
    label.style.marginTop = "4px";

    wrapper.appendChild(bar);
    wrapper.appendChild(label);
    chart.appendChild(wrapper);
  });
}





// YEAR SLIDER
const slider = document.getElementById("yearSlider");
const label = document.getElementById("yearLabel");


let autoPlay = true;           // whether time is passing automatically
const minYear = 1968;
const maxYear = 2018;
const autoInterval = 2000;     // milliseconds per year
const pauseButton = document.getElementById("PlayBtn")
const rotationSpeed = 0.002

pauseButton.addEventListener("click", () => {
  autoPlay = !autoPlay; // toggle state
  pauseButton.textContent = autoPlay ? "⏸ Pause" : "▶ Play";
});

// Function to advance the year
function advanceYear() {
  if (!autoPlay) return;       // skip if paused
  currentYear++;
  if (currentYear > maxYear) currentYear = minYear;

  // Update slider and label
  slider.value = currentYear;
  label.innerText = currentYear;

  // Update visuals
  createEmissionDots(currentYear);
  createDisasterDots(currentYear);
  const { polluters, sufferers } = getTopCountries(currentYear);
  updateTopLists(currentYear);
  updatePollutersChart(polluters);
}

// Auto-play interval
setInterval(advanceYear, autoInterval);

// Allow user to change year manually
slider.addEventListener("input", e => {
  currentYear = +e.target.value;
  label.innerText = currentYear;

  // Update visuals
  createEmissionDots(currentYear);
  createDisasterDots(currentYear);
  const { polluters, sufferers } = getTopCountries(currentYear);
  updateTopLists(currentYear);
  updatePollutersChart(polluters);

  // Optionally pause auto-play while dragging
  autoPlay = false;
});

// Optional: resume auto-play after user stops interacting
slider.addEventListener("change", () => {
  autoPlay = true;
});


let isUserInteracting = false;
controls.addEventListener('start', () => (isUserInteracting = true));
controls.addEventListener('end', () => (isUserInteracting = false));

function animate() {
  requestAnimationFrame(animate);

  // Spin slowly if the user isn’t dragging
  if (!isUserInteracting && autoPlay) {
    globeGroup.rotation.y += rotationSpeed;
  }

  controls.update();
  renderer.render(scene, camera);
}


animate();

function handleWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleWindowResize, false);
