import { useEffect, useRef, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDirections from '@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions';
import '@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css';
import { useLocation } from '../contexts/LocationContext';

const PURDUE_CENTER = [-86.9125, 40.4237];
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Random status for MVP (will be replaced by real check-in data later)
function getRandomStatus() {
    const statuses = ['open', 'moderate', 'busy'];
    return statuses[Math.floor(Math.random() * statuses.length)];
}

export default function CampusMap({ buildings, selectedBuilding, onSelectBuilding }) {
    const mapContainer = useRef(null);
    const [isRouting, setIsRouting] = useState(false);
    const [routeSteps, setRouteSteps] = useState([]);
    const [routeSummary, setRouteSummary] = useState(null);
    const [isDirectionsOpen, setIsDirectionsOpen] = useState(true);
    const map = useRef(null);
    const markersRef = useRef([]);
    const popupRef = useRef(null);
    const directionsRef = useRef(null);
    const { requestLocationAccess, userLocation } = useLocation();

    // Store buildings map for easy lookup
    const buildingsMap = useRef(new Map());
    useEffect(() => {
        buildingsMap.current = new Map(buildings.map(b => [b._id, b]));
    }, [buildings]);

    const calcDistance = (lat1, lon1, lat2, lon2) => {
        const R = 3958.8;
        const latDistance = (lat2 - lat1) * Math.PI / 180;
        const lonDistance = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(latDistance / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(lonDistance / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Initialize map
    useEffect(() => {
        if (map.current) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;
        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: PURDUE_CENTER,
            zoom: 15.5,
            pitch: 45,
            bearing: -17.6,
            antialias: true,
        });

        // Add zoom and navigation controls
        map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
        map.current.addControl(
            new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
            }),
            'bottom-right'
        );

        // Initialize Directions
        directionsRef.current = new MapboxDirections({
            accessToken: mapboxgl.accessToken,
            unit: 'imperial',
            profile: 'mapbox/walking',
            interactive: false,
            controls: {
                inputs: false,
                instructions: false,
                profileSwitcher: false
            }
        });

        directionsRef.current.on('route', (e) => {
            if (e.route && e.route[0] && e.route[0].legs && e.route[0].legs[0].steps) {
                setRouteSteps(e.route[0].legs[0].steps);
                // calculate summary
                const mins = Math.ceil(e.route[0].duration / 60);
                const miles = (e.route[0].distance * 0.000621371).toFixed(1);
                setRouteSummary({ time: `${mins} min`, dist: `${miles} mi` });
                setIsDirectionsOpen(true);
            }
        });

        map.current.addControl(directionsRef.current, 'bottom-left');

        return () => {
            map.current?.remove();
            map.current = null;
        };
    }, []);

    const clearRoute = useCallback(() => {
        if (!directionsRef.current) return;

        // Tell the routing engine to clear its internal state
        directionsRef.current.setOrigin('');
        directionsRef.current.setDestination('');

        if (typeof directionsRef.current.removeRoutes === 'function') {
            directionsRef.current.removeRoutes();
        }

        setIsRouting(false);
        setRouteSteps([]);
        setRouteSummary(null);
    }, []);

    // Listen to global clear events
    useEffect(() => {
        const handleClear = () => clearRoute();
        document.addEventListener('clearDirections', handleClear);
        return () => document.removeEventListener('clearDirections', handleClear);
    }, [clearRoute]);

    // Listen for custom trigger to start directions
    useEffect(() => {
        const handleGetDirections = (e) => {
            const detail = e.detail;
            const destId = typeof detail === 'string' ? detail : detail.destId;
            const originId = typeof detail === 'string' ? null : detail.originId;

            const destB = buildingsMap.current.get(destId);
            if (!destB || !directionsRef.current) return;

            if (originId) {
                const originB = buildingsMap.current.get(originId);
                if (originB) {
                    directionsRef.current.setOrigin([originB.longitude, originB.latitude]);
                    directionsRef.current.setDestination([destB.longitude, destB.latitude]);
                    setIsRouting(true);
                }
            } else {
                requestLocationAccess((coords) => {
                    directionsRef.current.setOrigin(coords);
                    directionsRef.current.setDestination([destB.longitude, destB.latitude]);
                    setIsRouting(true);
                });
            }
        };

        document.addEventListener('getDirections', handleGetDirections);
        return () => document.removeEventListener('getDirections', handleGetDirections);
    }, [requestLocationAccess]);

    // Add building markers
    useEffect(() => {
        if (!map.current || !buildings.length) return;

        // Remove existing markers
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        buildings.forEach((building) => {
            const status = getRandomStatus();

            // Create marker element
            const el = document.createElement('div');
            el.className = `building-marker status-${status}`;
            el.setAttribute('tabindex', '0');
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', `${building.name} (${building.abbreviation}) — ${status}`);

            // Abbreviation label on hover
            const label = document.createElement('span');
            label.className = 'building-marker-label';
            label.textContent = building.abbreviation;
            el.appendChild(label);

            // Inner dot
            const dot = document.createElement('span');
            dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,0.85);';
            el.appendChild(dot);

            const marker = new mapboxgl.Marker({ element: el })
                .setLngLat([building.longitude, building.latitude])
                .addTo(map.current);

            // Click handler
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                onSelectBuilding(building);
                flyToBuilding(building);
                showPopup(building, status);
            });

            // Keyboard handler
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectBuilding(building);
                    flyToBuilding(building);
                    showPopup(building, status);
                }
            });

            markersRef.current.push(marker);
        });
    }, [buildings, onSelectBuilding]);

    // Fly to selected building from sidebar
    useEffect(() => {
        if (!map.current || !selectedBuilding) return;
        flyToBuilding(selectedBuilding);
        showPopup(selectedBuilding, getRandomStatus());
    }, [selectedBuilding]);

    const flyToBuilding = useCallback((building) => {
        map.current?.flyTo({
            center: [building.longitude, building.latitude],
            zoom: 17,
            pitch: 50,
            duration: 1200,
            essential: true,
        });
    }, []);

    const showPopup = useCallback((building, status) => {
        if (popupRef.current) popupRef.current.remove();
        let displayDistance = building.distance;
        if (displayDistance == null && userLocation) {
            displayDistance = calcDistance(userLocation[1], userLocation[0], building.latitude, building.longitude);
        }


        const statusColors = {
            open: '#22c55e',
            moderate: '#eab308',
            busy: '#ef4444',
        };
        const statusLabels = {
            open: 'Quiet — Seats Available',
            moderate: 'Moderate — Some Seats',
            busy: 'Busy — Limited Seats',
        };

        const html = `
      <div style="padding: 16px 18px; position: relative;">
        ${displayDistance != null ? `
        <div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: linear-gradient(to right, #2a2215, #1f1a10); color: #CEB888; border: 1px solid rgba(206, 184, 136, 0.3); font-weight: 600; font-size: 10px; padding: 4px 14px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;">
            ${displayDistance.toFixed(2)} mi away
        </div>` : ''}
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="width:10px;height:10px;border-radius:50%;background:${statusColors[status]};display:inline-block;"></span>
          <span style="font-size:11px;color:${statusColors[status]};font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${statusLabels[status]}</span>
        </div>
        <h3 style="font-size:16px;font-weight:700;margin-bottom:2px;color:#f5f5f5;">${building.name}</h3>
        <p style="font-size:12px;color:#a0a0a0;margin-bottom:10px;">${building.abbreviation} · ${building.address || 'Purdue University'}</p>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;">
          ${(building.amenities || [])
                .map(
                    (a) =>
                        `<span style="font-size:10px;background:rgba(206,184,136,0.12);color:#CEB888;padding:3px 8px;border-radius:20px;border:1px solid rgba(206,184,136,0.2);">${a}</span>`
                )
                .join('')}
        </div>
        <button
            onclick="document.dispatchEvent(new CustomEvent('viewRooms', {detail: '${building._id}'}))"
            style="width:100%;padding:10px;background:linear-gradient(135deg, #CEB888, #C28E0E);color:#000;border:none;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;transition:transform 0.2s ease;"
            onmouseover="this.style.transform='scale(1.02)'"
            onmouseout="this.style.transform='scale(1)'"
        >
            View Rooms
        </button>
      </div>
    `;

        popupRef.current = new mapboxgl.Popup({
            offset: 25,
            closeOnClick: true,
            maxWidth: '280px',
        })
            .setLngLat([building.longitude, building.latitude])
            .setHTML(html)
            .addTo(map.current);
    }, [userLocation]);

    return (
        <div className="flex-1 h-full relative">
            <div ref={mapContainer} className="w-full h-full" />
            
            {/* Directions Overlay */}
            {isRouting && routeSteps.length > 0 && (
                <div className="absolute top-4 right-4 z-40 w-80 bg-[var(--color-surface-light)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-all duration-300">
                    <button 
                        onClick={() => setIsDirectionsOpen(!isDirectionsOpen)}
                        className="flex items-center justify-between p-4 bg-[var(--color-surface-hover)] border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer w-full text-left"
                    >
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-[var(--color-purdue-gold)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            <div className="flex flex-col">
                                <span className="font-bold text-sm leading-tight text-white">Walking Directions</span>
                                {routeSummary && (
                                    <span className="text-[11px] text-[var(--color-purdue-gold)] font-medium">
                                        {routeSummary.dist} • {routeSummary.time}
                                    </span>
                                )}
                            </div>
                        </div>
                        <svg className={`w-5 h-5 text-[var(--color-text-secondary)] transition-transform duration-300 ${isDirectionsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    
                    {isDirectionsOpen && (
                        <div className="flex-1 overflow-y-auto p-2 w-full">
                            {routeSteps.map((step, i) => (
                                <div key={i} className="flex gap-3 p-3 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg transition-colors">
                                    <div className="mt-0.5 text-[var(--color-purdue-gold)] shrink-0">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7-7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium leading-snug">{step.maneuver.instruction}</p>
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                                            {Math.round(step.distance)} ft
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isRouting && (
                <button
                    onClick={clearRoute}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-[var(--color-surface-light)] text-[var(--color-text-primary)] border border-[var(--color-text-secondary)]/20 rounded-full shadow-2xl font-bold flex items-center gap-2 transition-all hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear Route
                </button>
            )}
        </div>
    );
}
