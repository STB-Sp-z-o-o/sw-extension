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

// This function will now be the core logic, callable whenever the address changes.
async function runRouteCalculation(startAddress) {
    const endAddressElement = document.querySelector('#commission__address .select__single-value__label');
    const mapContent = document.getElementById('map-content');
    const startAddressDisplay = document.getElementById('start-address-display');
    const etaValue = document.getElementById('eta-value');

    if (startAddressDisplay) {
        startAddressDisplay.textContent = startAddress || 'Brak adresu początkowego.';
    }

    if (endAddressElement && endAddressElement.textContent.trim() && startAddress) {
        // Clean the address by removing text in parentheses and street prefixes
        const cleanedEndAddress = endAddressElement.textContent
            .trim()
            .replace(/\s*\([^)]*\)/g, '')
            .replace(/^ul\.\s*/, '');

        mapContent.innerHTML = '<p>Geokodowanie adresów...</p>';
        etaValue.textContent = 'obliczanie...';
        const startCoords = await geocodeAddress(startAddress);
        const endCoords = await geocodeAddress(cleanedEndAddress);

        if (startCoords && endCoords) {
            await displayMap('map-content', startCoords, endCoords, startAddress, cleanedEndAddress);
        } else {
            mapContent.innerHTML = '<p style="color: red;">Błąd: Nie można było znaleźć współrzędnych dla jednego z adresów.</p>';
            etaValue.textContent = 'Błąd';
        }
    } else {
        mapContent.innerHTML = '<p>Nie znaleziono adresu początkowego lub końcowego.</p>';
        etaValue.textContent = 'Brak danych';
    }
}

// Main function to initialize the route planner feature
export function initializeRoutePlanner() {
    chrome.storage.sync.get({ featureSettings: { routePlanner: true } }, (data) => {
        if (!data.featureSettings.routePlanner) {
            console.log("Route planner feature is disabled.");
            return;
        }

        const pageObserver = new MutationObserver(async (mutations, obs) => {
            const docSeriesElement = document.querySelector('.commission__document-series .select__single-value__label');
            const detailsContainer = document.querySelector('.commission__details');
            const endAddressElement = document.querySelector('#commission__address .select__single-value__label');

            if (docSeriesElement && docSeriesElement.textContent.trim() === 'Montaż' && detailsContainer && endAddressElement && endAddressElement.textContent.trim()) {
                console.log("'Montaż' commission and address detected. Initializing route planner UI.");

                if (document.getElementById('route-planner-container')) {
                    obs.disconnect();
                    return;
                }

                const routePlannerContainer = document.createElement('div');
                routePlannerContainer.id = 'route-planner-container';
                routePlannerContainer.className = 'css-l7va25';
                routePlannerContainer.style.marginTop = '20px';
                routePlannerContainer.innerHTML = `
                    <div class="chakra-stack css-1fv6v2f">
                        <div class="chakra-stack css-1oeb4ru">
                            <h2 class="chakra-heading css-18j379d">Plan Trasy</h2>
                        </div>
                    </div>
                    <div class="chakra-stack css-9d72bo" style="margin-top: 10px;">
                        <p class="chakra-form__label"><strong>Adres początkowy (z atrybutu):</strong></p>
                        <p id="start-address-display" class="chakra-text">Oczekiwanie na atrybut...</p>
                    </div>
                    <div id="map-content" class="">
                        <p>Ładowanie mapy...</p>
                    </div>
                    <div id="eta-content" class="chakra-stack css-9d72bo" style="margin-top: 10px;">
                        <p><strong>Szacowany czas dojazdu (ETA):</strong> <span id="eta-value">wkrótce...</span></p>
                    </div>
                `;
                detailsContainer.prepend(routePlannerContainer);
                
                // Now that the UI is in place, start observing for the attribute textarea
                const attributeObserver = new MutationObserver((attributeMutations, attrObs) => {
                    const startAddressTextarea = document.querySelector('textarea[id*="475"]');
                    if (startAddressTextarea) {
                        console.log("Start address textarea found. Performing initial route calculation.");
                        
                        // Perform the route calculation only once when the textarea is found.
                        const initialStartAddress = startAddressTextarea.value.trim();
                        if (initialStartAddress) {
                            runRouteCalculation(initialStartAddress);
                        } else {
                             document.getElementById('start-address-display').textContent = "Atrybut jest pusty.";
                        }

                        // Disconnect the observer that was looking for the textarea itself, as we don't need to watch for changes.
                        attrObs.disconnect();
                    }
                });

                // Start observing the whole document for the textarea to appear.
                attributeObserver.observe(document.body, { childList: true, subtree: true });

                // Disconnect the observer that was looking for the commission page elements.
                obs.disconnect();
            }
        });

        pageObserver.observe(document.body, { childList: true, subtree: true });
    });
}
