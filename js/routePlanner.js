// js/routePlanner.js
// This module will handle the ETA and map functionality for "Montaż" commissions.

// The Leaflet CSS and JS are now injected via manifest.json, so these functions are no longer needed.

// Function to geocode an address using Nominatim (OpenStreetMap)
async function geocodeAddress(address) {
    console.log(`Geocoding address: ${address}`);
    const endpoint = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;

    try {
        const response = await fetch(endpoint, {
            headers: {
                'Accept': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Nominatim API returned status ${response.status}`);
        }
        const data = await response.json();
        if (data && data.length > 0) {
            const { lat, lon } = data[0];
            console.log(`Geocoded successfully: [${lat}, ${lon}]`);
            return { lat: parseFloat(lat), lon: parseFloat(lon) };
        } else {
            console.warn('No results found for the address.');
            return null;
        }
    } catch (error) {
        console.error('Error during geocoding:', error);
        return null;
    }
}

// Function to get route and ETA from OSRM
async function getRouteAndEta(startCoords, endCoords) {
    const endpoint = `https://router.project-osrm.org/route/v1/driving/${startCoords.lon},${startCoords.lat};${endCoords.lon},${endCoords.lat}?overview=full&geometries=geojson`;

    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`OSRM API returned status ${response.status}`);
        }
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            return {
                duration: route.duration, // in seconds
                geometry: route.geometry
            };
        } else {
            console.warn('No route found by OSRM.');
            return null;
        }
    } catch (error) {
        console.error('Error fetching route from OSRM:', error);
        return null;
    }
}

// Function to create and display the map.
// This now runs directly in the content script context and can access the `L` object.
async function displayMap(containerId, startCoords, endCoords, startAddress, endAddress) {
    const container = document.getElementById(containerId);
    const etaValue = document.getElementById('eta-value');
    etaValue.textContent = 'obliczanie...';

    if (!startCoords || !endCoords) {
        container.innerHTML = '<p>Nie udało się zlokalizować adresu początkowego lub końcowego.</p>';
        etaValue.textContent = 'Błąd geokodowania.';
        return;
    }

    const mapDiv = document.createElement('div');
    mapDiv.id = 'leaflet-map';
    mapDiv.style.height = '400px';
    mapDiv.style.marginTop = '10px';
    container.innerHTML = ''; // Clear previous content (e.g., "Ładowanie mapy...")
    container.appendChild(mapDiv);

    // FIX: Set the default icon path for Leaflet to use a public CDN.
    // This prevents Leaflet from trying to load images from the host page's domain
    // and avoids needing to bundle the images with the extension.
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    // `L` is available directly because it's loaded as a content script.
    const map = L.map('leaflet-map').setView([endCoords.lat, endCoords.lon], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    L.marker([startCoords.lat, startCoords.lon]).addTo(map).bindPopup(`Początek: ${startAddress}`);
    L.marker([endCoords.lat, endCoords.lon]).addTo(map).bindPopup(`Cel: ${endAddress}`);

    const routeData = await getRouteAndEta(startCoords, endCoords);

    if (routeData && routeData.geometry) {
        const routeLayer = L.geoJSON(routeData.geometry).addTo(map);
        map.fitBounds(routeLayer.getBounds());

        const duration = routeData.duration;
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        etaValue.textContent = `${hours > 0 ? hours + 'h ' : ''}${minutes}min`;
    } else {
        // Still fit the map to the markers even if routing fails
        map.fitBounds(L.latLngBounds([
            [startCoords.lat, startCoords.lon],
            [endCoords.lat, endCoords.lon]
        ]));
        etaValue.textContent = 'Nie udało się wyznaczyć trasy.';
        const routeMessage = document.createElement('p');
        routeMessage.textContent = 'Nie udało się wyznaczyć trasy. Sprawdź adresy.';
        routeMessage.style.color = 'orange';
        routeMessage.style.marginTop = '10px';
        container.appendChild(routeMessage);
    }

    // Force map to re-render correctly after container is settled
    setTimeout(() => map.invalidateSize(), 100);
}


// Main function to initialize the route planner feature
export function initializeRoutePlanner() {
    chrome.storage.sync.get({ featureSettings: { routePlanner: true } }, (data) => {
        if (!data.featureSettings.routePlanner) {
            console.log("Route planner feature is disabled.");
            return;
        }

        const observer = new MutationObserver(async (mutations, obs) => {
            const docSeriesElement = document.querySelector('.commission__document-series .select__single-value__label');
            const detailsContainer = document.querySelector('.commission__details');
            const endAddressElement = document.querySelector('#commission__address .select__single-value__label');

            // Wait for the "Montaż" series, the details container, and the commission address to be present.
            if (docSeriesElement && docSeriesElement.textContent.trim() === 'Montaż' && detailsContainer && endAddressElement && endAddressElement.textContent.trim()) {
                console.log("'Montaż' commission and address detected. Initializing route planner.");
                
                // Prevent re-initialization
                if (document.getElementById('route-planner-container')) {
                    obs.disconnect();
                    return;
                }

                // Leaflet is now loaded via manifest.json, so no injection is needed.
                const routePlannerContainer = document.createElement('div');
                routePlannerContainer.id = 'route-planner-container';
                routePlannerContainer.className = 'css-l7va25'; // Match styling of other sections
                routePlannerContainer.style.marginTop = '20px';
                routePlannerContainer.innerHTML = `
                    <div class="chakra-stack css-1fv6v2f">
                        <div class="chakra-stack css-1oeb4ru">
                            <h2 class="chakra-heading css-18j379d">Plan Trasy</h2>
                        </div>
                    </div>
                    <div class="chakra-stack css-9d72bo" style="margin-top: 10px;">
                        <label for="start-address-input" class="chakra-form__label">Adres początkowy:</label>
                        <input id="start-address-input" class="chakra-input" placeholder="Wpisz adres początkowy" value="Bielany Wrocławskie, Polska">
                        <button id="recalculate-route-btn" class="chakra-button css-14aipv" style="margin-top: 5px;">Przelicz trasę</button>
                    </div>
                    <div id="map-content" class="">
                        <p>Ładowanie mapy...</p>
                    </div>
                    <div id="eta-content" class="chakra-stack css-9d72bo" style="margin-top: 10px;">
                        <p><strong>Szacowany czas dojazdu (ETA):</strong> <span id="eta-value">wkrótce...</span></p>
                    </div>
                `;
                
                // Prepend to the top of the details container
                detailsContainer.prepend(routePlannerContainer);

                const recalculateBtn = document.getElementById('recalculate-route-btn');
                recalculateBtn.addEventListener('click', runRouteCalculation);

                async function runRouteCalculation() {
                    const startAddress = document.getElementById('start-address-input').value;
                    const endAddressElement = document.querySelector('#commission__address .select__single-value__label');
                    const mapContent = document.getElementById('map-content');

                    if (endAddressElement && startAddress) {
                        // Clean the address by removing text in parentheses and street prefixes
                        const cleanedEndAddress = endAddressElement.textContent
                            .trim()
                            .replace(/\s*\([^)]*\)/g, '') // Corrected regex for parentheses
                            .replace(/^ul\.\s*/, '');   // Corrected regex for "ul. " prefix

                        mapContent.innerHTML = '<p>Geokodowanie adresów...</p>';
                        const startCoords = await geocodeAddress(startAddress);
                        const endCoords = await geocodeAddress(cleanedEndAddress);

                        if (startCoords && endCoords) {
                            // Call displayMap directly. No need for page context injection.
                            await displayMap('map-content', startCoords, endCoords, startAddress, cleanedEndAddress);
                        } else {
                            mapContent.innerHTML = '<p style="color: red;">Błąd: Nie można było znaleźć współrzędnych dla jednego z adresów.</p>';
                            document.getElementById('eta-value').textContent = 'Błąd';
                        }
                    } else {
                        mapContent.innerHTML = '<p>Nie znaleziono adresu początkowego lub końcowego.</p>';
                    }
                }
                
                // Initial calculation
                await runRouteCalculation();

                // Disconnect the observer once we've added the elements
                obs.disconnect();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
}
