import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

const PURDUE_CENTER = [-86.9125, 40.4237];
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Random status for MVP (will be replaced by real check-in data later)
function getRandomStatus() {
    const statuses = ['open', 'moderate', 'busy'];
    return statuses[Math.floor(Math.random() * statuses.length)];
}

export default function CampusMap({ buildings, selectedBuilding, onSelectBuilding }) {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markersRef = useRef([]);
    const popupRef = useRef(null);

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

        return () => {
            map.current?.remove();
            map.current = null;
        };
    }, []);

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
            el.addEventListener('click', () => {
                onSelectBuilding(building);
                flyToBuilding(building);
                showPopup(building, status);
            });

            // Keyboard handler
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
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
      <div style="padding: 16px 18px;">
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
          style="width:100%;padding:8px;background:linear-gradient(135deg, #CEB888, #C28E0E);color:#000;border:none;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;letter-spacing:0.3px;"
        >
          View Rooms →
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
    }, []);

    return (
        <div ref={mapContainer} className="flex-1 h-full relative" />
    );
}
