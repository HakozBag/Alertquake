const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let activeTab = 'login';
let currentScreenId = 'auth-screen';
let isOfflineMode = false;

let map = null;
let evacuationRouteLayer = null;
let shelterMarker = null;
let quakeMarkersLayer = null; 

let floodRiskLayer = null;
let landslideRiskLayer = null;
let hospitalMarker = null;
let evacuationCenterLayer = null;

const USER_LOCATION = [14.5615, 121.0260];
const SHELTER_LOCATION = [14.5690, 121.0420]; 
const HOSPITAL_LOCATION = [14.5580, 121.0150];

const EVACUATION_ROUTE_COORDS = [
    USER_LOCATION,
    [14.5620, 121.0300], 
    [14.5650, 121.0350], 
    SHELTER_LOCATION
];

const FLOOD_ZONE_COORDS = [
    [[14.5600, 121.0200], [14.5620, 121.0250], [14.5610, 121.0280], [14.5590, 121.0230]]
];
const LANDSLIDE_ZONE_COORDS = [
    [14.5650, 121.0200], 
    [14.5660, 121.0230], 
    [14.5645, 121.0250], 
    [14.5630, 121.0220]
];

const PHILIPPINES_BOUNDS = {
    lat: { min: 4, max: 21 },
    lng: { min: 116, max: 128 }
};

// New bounding boxes focused on landmasses to avoid placing markers in the open sea
const LAND_REGIONS = [
    // Luzon (North) - including Metro Manila area
    { lat: { min: 13, max: 19 }, lng: { min: 119, max: 123 } },
    // Visayas (Center) - including Cebu/Leyte area
    { lat: { min: 9, max: 13 }, lng: { min: 121, max: 125 } },
    // Mindanao (South) - including Davao area
    { lat: { min: 5, max: 9 }, lng: { min: 121, max: 126 } }
];


const ICON_PATHS = {
    'home-screen': {
        idle: "https://github.com/HakozBag/Alertquake/blob/main/icons/home.png?raw=true",
        active: "https://github.com/HakozBag/Alertquake/blob/main/icons/home_select.png?raw=true"
    },
    'map-screen': {
        idle: "https://github.com/HakozBag/Alertquake/blob/main/icons/map.png?raw=true",
        active: "https://github.com/HakozBag/Alertquake/blob/main/icons/map_select.png?raw=true"
    },
    'tips-screen': {
        idle: "https://github.com/HakozBag/Alertquake/blob/main/icons/bulb.png?raw=true",
        active: "https://github.com/HakozBag/Alertquake/blob/main/icons/bulb_select.png?raw=true"
    },
    'contacts-screen': {
        idle: "https://github.com/HakozBag/Alertquake/blob/main/icons/contacts.png?raw=true",
        active: "https://github.com/HakozBag/Alertquake/blob/main/icons/contact_select.png?raw=true"
    }
};


const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const loginFields = document.getElementById('login-fields');
const signupFields = document.getElementById('signup-fields');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const homeHeader = document.getElementById('home-header');
const bottomNav = document.getElementById('bottom-nav');
const screens = document.querySelectorAll('.screen');
const authContinueButton = document.getElementById('auth-continue-button'); 

const SWIPEABLE_SCREENS = ['home-screen', 'map-screen', 'tips-screen', 'contacts-screen'];
const mainContentWrapper = document.getElementById('main-content-wrapper');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');


function getRandomLatLngInBounds(bounds) {
    const lat = Math.random() * (bounds.lat.max - bounds.lat.min) + bounds.lat.min;
    const lng = Math.random() * (bounds.lng.max - bounds.lng.min) + bounds.lng.min;
    return [lat, lng];
}

function getRandomLatLngOnLand() {
    // Select one of the three main land regions randomly
    const selectedRegion = LAND_REGIONS[Math.floor(Math.random() * LAND_REGIONS.length)];
    
    // Generate a random coordinate within that specific region
    const lat = Math.random() * (selectedRegion.lat.max - selectedRegion.lat.min) + selectedRegion.lat.min;
    const lng = Math.random() * (selectedRegion.lng.max - selectedRegion.lng.min) + selectedRegion.lng.min;
    return [lat, lng];
}


function generateRandomQuakeMarkers(center, radiusInDegrees, count) {
    const markers = [];
    const y0 = center[0];
    const x0 = center[1];
    for (let i = 0; i < count; i++) {
        const randomRadius = radiusInDegrees * Math.sqrt(Math.random());
        const randomAngle = Math.random() * 2 * Math.PI;
        const y = y0 + randomRadius * Math.cos(randomAngle);
        const x = x0 + randomRadius * Math.sin(randomAngle);
        const magnitude = (Math.random() * 2) + 3; 
        const markerSize = 10 + magnitude * 2;
        const redIcon = L.divIcon({
            className: 'custom-div-icon red-quake-marker',
            html: `<i class="fa-solid fa-circle text-red-600" style="font-size: ${markerSize}px; text-shadow: 0 0 5px rgba(220, 38, 38, 0.5);"></i>`,
            iconAnchor: [markerSize / 2, markerSize / 2]
        });
        const marker = L.marker([y, x], { icon: redIcon })
            .bindPopup(`Magnitude **M${magnitude.toFixed(1)}**<br>Simulated Quake Location`);
        markers.push(marker);
    }
    return L.layerGroup(markers);
}

function addEvacuationCenters() {
    
    const centers = [];
    // Custom icon for the center point (Shelter)
    const greenShelterIcon = L.divIcon({
        className: 'custom-div-icon green-shelter-marker',
        html: '<i class="fa-solid fa-house-shelter" style="font-size: 25px; color: #67925f; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"></i>',
        iconAnchor: [12, 25] 
    });

    for (let i = 0; i < 50; i++) { 
        // Use the new function to keep the center on land
        const latLng = getRandomLatLngOnLand(); 
        
        // 1. Add the marker icon for the center point
        const marker = L.marker(latLng, { icon: greenShelterIcon })
            .bindPopup(`**Evacuation Center #${i+1}**<br>Simulated Temporary Shelter`);
        centers.push(marker);
        
        // 2. Add a small green circle around the marker to show the safe area
        const circle = L.circle(latLng, {
            color: '#67925f',
            fillColor: '#afe6bb', 
            fillOpacity: 0.3,
            radius: 500 // 500 meters radius for a small safe zone
        }).bindPopup(`Safe Zone Radius`);
        centers.push(circle);
    }
    
    evacuationCenterLayer = L.layerGroup(centers).addTo(map);
    
    map.fitBounds([
        [PHILIPPINES_BOUNDS.lat.min, PHILIPPINES_BOUNDS.lng.min],
        [PHILIPPINES_BOUNDS.lat.max, PHILIPPINES_BOUNDS.lng.max]
    ]);
}


function initMap() {
    if (map === null) {
        map = L.map('map-container', { zoomControl: false }).setView(USER_LOCATION, 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        L.marker(USER_LOCATION).addTo(map)
            .bindPopup('Your Current Location').openPopup();
        // Set Evacuation Centers as default
        toggleMapFeatures('evac_centers'); 
    } else {
        map.invalidateSize();
        map.setView(USER_LOCATION, 14);
    }
}

function clearMapLayers() {
    if (evacuationRouteLayer) { map.removeLayer(evacuationRouteLayer); evacuationRouteLayer = null; }
    if (shelterMarker) { map.removeLayer(shelterMarker); shelterMarker = null; }
    if (quakeMarkersLayer) { map.removeLayer(quakeMarkersLayer); quakeMarkersLayer = null; }
    if (floodRiskLayer) { map.removeLayer(floodRiskLayer); floodRiskLayer = null; }
    if (landslideRiskLayer) { map.removeLayer(landslideRiskLayer); landslideRiskLayer = null; }
    if (hospitalMarker) { map.removeLayer(hospitalMarker); hospitalMarker = null; }
    if (evacuationCenterLayer) { map.removeLayer(evacuationCenterLayer); evacuationCenterLayer = null; }
}

function toggleMapFeatures(mapType) {
    clearMapLayers();

    if (mapType === 'local_route') {
        evacuationRouteLayer = L.polyline(EVACUATION_ROUTE_COORDS, {
            color: '#67925f', weight: 6, opacity: 0.8, dashArray: '10, 5' 
        }).addTo(map);
        map.fitBounds(evacuationRouteLayer.getBounds(), { padding: [40, 40] });
        const greenIcon = L.divIcon({
            className: 'custom-div-icon',
            html: '<i class="fa-solid fa-location-dot" style="font-size: 30px; color: #4CAF50; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"></i>',
            iconAnchor: [15, 30] 
        });
        shelterMarker = L.marker(SHELTER_LOCATION, { icon: greenIcon }).addTo(map)
            .bindPopup('<span style="font-weight: bold; color: #4CAF50;">Evacuation Center</span><br>Nearest and Safest Shelter').openPopup();
    } else if (mapType === 'evac_centers') { 
        addEvacuationCenters();
    } else if (mapType === 'faults') {
        quakeMarkersLayer = generateRandomQuakeMarkers(USER_LOCATION, 0.1, 10).addTo(map);
        map.setView(USER_LOCATION, 14);
    } else if (mapType === 'flood') {
        floodRiskLayer = L.polygon(FLOOD_ZONE_COORDS, {
            color: 'blue',
            fillColor: '#3498db',
            fillOpacity: 0.4
        }).addTo(map).bindPopup('High Flood Risk Zone');
        map.setView(USER_LOCATION, 14);
    } else if (mapType === 'landslide') {
        landslideRiskLayer = L.polygon(LANDSLIDE_ZONE_COORDS, {
            color: 'brown',
            fillColor: '#a0522d',
            fillOpacity: 0.5
        }).addTo(map).bindPopup('High Landslide Risk Zone');
        map.setView(USER_LOCATION, 14);
    } else if (mapType === 'hospital') {
        const hospitalIcon = L.divIcon({
            className: 'custom-div-icon',
            html: '<i class="fa-solid fa-hospital" style="font-size: 30px; color: #E74C3C; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"></i>',
            iconAnchor: [15, 30] 
        });
        hospitalMarker = L.marker(HOSPITAL_LOCATION, { icon: hospitalIcon }).addTo(map)
            .bindPopup('<span style="font-weight: bold; color: #E74C3C;">Nearest Hospital</span><br>St. Jude Medical Center').openPopup();
        map.setView(HOSPITAL_LOCATION, 14); 
    } else {
         map.setView(USER_LOCATION, 14);
    }
}

function callForHelp() {
    showMessageModal("Distress signal sent! Your location (within 80m) is being transmitted to emergency contacts and nearby users.");
    
    if (map) {
        const helpCircle = L.circle(USER_LOCATION, {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.2,
            radius: 80
        }).addTo(map);

        setTimeout(() => {
            map.removeLayer(helpCircle);
        }, 4000);
    }
}

function navigateTo(targetScreenId, direction = 'right') {
    const currentScreen = document.getElementById(currentScreenId);
    const targetScreen = document.getElementById(targetScreenId);

    if (!targetScreen) {
        return;
    }
    
    const isSwipeableTarget = SWIPEABLE_SCREENS.includes(targetScreenId);
    const isSwipeableCurrent = SWIPEABLE_SCREENS.includes(currentScreenId);

    let isSwipeNav = false;
    if (isSwipeableTarget && isSwipeableCurrent) {
        const currentIndex = SWIPEABLE_SCREENS.indexOf(currentScreenId);
        const targetIndex = SWIPEABLE_SCREENS.indexOf(targetScreenId);
        if (Math.abs(currentIndex - targetIndex) === 1) {
            isSwipeNav = true;
        }
    }
    
    if (isSwipeNav) {
        const currentIndex = SWIPEABLE_SCREENS.indexOf(currentScreenId);
        const targetIndex = SWIPEABLE_SCREENS.indexOf(targetScreenId);
        direction = targetIndex > currentIndex ? 'right' : 'left';
    }


    currentScreen.classList.remove('screen-visible');
    if (direction === 'right') {
        currentScreen.classList.add('screen-hidden-left');
    } else {
        currentScreen.classList.add('screen-hidden-right');
    }
    
    if (direction === 'right') {
        targetScreen.classList.remove('screen-hidden-left', 'screen-hidden-right');
    } else {
        targetScreen.classList.remove('screen-hidden-left', 'screen-hidden-right');
    }
    
    setTimeout(() => {
        targetScreen.classList.add('screen-visible');
        
        setTimeout(() => {
            if (direction === 'right') {
                currentScreen.classList.remove('screen-hidden-left');
            } else {
                currentScreen.classList.remove('screen-hidden-right');
            }
        }, 400); 

        targetScreen.scrollTop = 0;
        
        if (targetScreenId === 'map-screen') {
            initMap();
        }

    }, 50); 
    
    const showFixedUI = SWIPEABLE_SCREENS.includes(targetScreenId);
    
    if (showFixedUI) {
        homeHeader.classList.remove('hidden');
        bottomNav.classList.remove('hidden');
    } else {
        homeHeader.classList.add('hidden');
        bottomNav.classList.add('hidden');
    }
    
    if (targetScreenId === 'map-screen') {
        homeHeader.classList.remove('header-border');
        homeHeader.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
    } else {
        homeHeader.classList.add('header-border');
        homeHeader.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    }

    currentScreenId = targetScreenId;
    updateNavBar(targetScreenId);
}

function toggleSidebar() {
    const mainWrapper = document.getElementById('main-content-wrapper');
    const header = document.getElementById('home-header');
    const nav = document.getElementById('bottom-nav');

    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        mainWrapper.classList.remove('slide-right');
        header.classList.remove('slide-right');
        nav.classList.remove('slide-right');
        sidebarOverlay.style.display = 'none';
    } else {
        sidebar.classList.add('open');
        mainWrapper.classList.add('slide-right');
        header.classList.add('slide-right');
        nav.classList.add('slide-right');
        sidebarOverlay.style.display = 'block';
    }
}

function toggleOfflineMode() {
    isOfflineMode = !isOfflineMode;
    const phoneTemplate = document.getElementById('phone-template');
    const offlineBtn = document.getElementById('offline-mode-btn');
    const offlineText = document.getElementById('offline-mode-text');
    const offlineIcon = document.getElementById('offline-mode-icon');
    const bottomNav = document.getElementById('bottom-nav');

    if (isOfflineMode) {
        phoneTemplate.classList.add('grayscale-mode');
        offlineText.textContent = 'Online Mode';
        offlineIcon.classList.remove('fa-plug-circle-xmark', 'text-gray-600');
        offlineIcon.classList.add('fa-plug-circle-bolt', 'text-app-blue');
        offlineBtn.classList.add('bg-blue-50'); 
        bottomNav.style.backgroundColor = '#d1d5db';
    } else {
        phoneTemplate.classList.remove('grayscale-mode');
        offlineText.textContent = 'Offline Mode';
        offlineIcon.classList.add('fa-plug-circle-xmark', 'text-gray-600');
        offlineIcon.classList.remove('fa-plug-circle-bolt', 'text-app-blue');
        offlineBtn.classList.remove('bg-blue-50'); 
        bottomNav.style.backgroundColor = 'white'; 
    }
}


function handleSettingsClick() {
    toggleSidebar();
    showMessageModal("Settings screen is not yet implemented.");
}

function handleTermsClick() {
    toggleSidebar();
    showMessageModal("ey ka muna");
}

function handleLogout() {
    toggleSidebar(); 
    if (isOfflineMode) {
        toggleOfflineMode(); 
    }
    navigateTo('auth-screen', 'left');
}

function updateNavBar(screenId) {
    document.querySelectorAll('.bottom-nav button').forEach(button => {
        const targetId = button.getAttribute('data-target-screen');
        const iconKey = targetId.split('-')[0];
        const iconElement = document.getElementById(`icon-${iconKey}`);
        if (iconElement && ICON_PATHS[targetId]) {
            iconElement.src = ICON_PATHS[targetId].idle;
            button.classList.remove('text-medium-green');
            button.classList.add('text-nav-color');
        }
    });

    if (screenId in ICON_PATHS) {
        const iconElement = document.getElementById(`icon-${screenId.split('-')[0]}`);
        const activeButton = document.querySelector(`.bottom-nav button[data-target-screen="${screenId}"]`);

        if (iconElement) {
            iconElement.src = ICON_PATHS[screenId].active;
        }
         if (activeButton) {
            activeButton.classList.remove('text-nav-color');
            activeButton.classList.add('text-medium-green');
        }
    }
}


function updateTabs() {
    if (activeTab === 'login') {
        loginTab.classList.add('bg-medium-green', 'text-white', 'shadow-md');
        signupTab.classList.remove('bg-medium-green', 'text-white', 'shadow-md');
        
        loginFields.classList.remove('hidden-content');
        signupFields.classList.add('hidden-content');
        forgotPasswordLink.classList.remove('hidden-content');
        
        authContinueButton.textContent = 'Login';
        
    } else {
        signupTab.classList.add('bg-medium-green', 'text-white', 'shadow-md');
        loginTab.classList.remove('bg-medium-green', 'text-white', 'shadow-md');

        loginFields.classList.add('hidden-content');
        signupFields.classList.remove('hidden-content');
        forgotPasswordLink.classList.add('hidden-content');
        
        authContinueButton.textContent = 'Sign Up';
    }
}

function setActiveTab(tab) {
    if (activeTab !== tab) {
        activeTab = tab;
        updateTabs();
    }
}

function handleContinue() {
    if (activeTab === 'login') {
        navigateTo('home-screen', 'right');
    } else {
        navigateTo('detailed-signup-screen', 'right');
    }
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(inputId + '-eye');
    
    if (input && icon) {
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

let touchStartX = 0;
let touchStartY = 0;
const swipeThreshold = 75;
const lockSwipeY = 50;

mainContentWrapper.addEventListener('touchstart', (e) => {
    if (!SWIPEABLE_SCREENS.includes(currentScreenId)) return;
    
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true }); 

mainContentWrapper.addEventListener('touchend', (e) => {
    if (!SWIPEABLE_SCREENS.includes(currentScreenId)) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    if (Math.abs(diffX) > swipeThreshold && Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffY) < lockSwipeY) {
        
        const currentIndex = SWIPEABLE_SCREENS.indexOf(currentScreenId);
        let newIndex = currentIndex;

        if (diffX > 0) {
            newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
        } else {
            newIndex = currentIndex < SWIPEABLE_SCREENS.length - 1 ? currentIndex + 1 : currentIndex;
        }
        
        const nextPageId = SWIPEABLE_SCREENS[newIndex];
        if (nextPageId !== currentScreenId) {
            navigateTo(nextPageId, diffX > 0 ? 'left' : 'right');
        }
    }
});


function showMessageModal(message) {
    document.getElementById('modal-message').innerText = message;
    document.getElementById('custom-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('custom-modal').classList.add('hidden');
}


window.onload = () => {
    updateTabs();
    screens.forEach(screen => {
        if (screen.id !== 'auth-screen') {
            screen.classList.add('screen-hidden-right');
        } else {
            screen.classList.add('screen-visible');
            screen.classList.remove('screen-hidden-left', 'screen-hidden-right');
        }
    });
    homeHeader.classList.add('hidden');
    bottomNav.classList.add('hidden');
    updateNavBar('home-screen');
};
