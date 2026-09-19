import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CommuterProfile, RouteOption, RouteStep, TrafficSpeedBand } from '../types';
import { COVERED_LINKWAYS, CYCLING_PATHS, STATIONS } from '../data/mockGeospatial';

interface MapComponentProps {
  activeRoute: RouteOption | null;
  selectedStep: RouteStep | null;
  showShelterLayer: boolean;
  showCyclingLayer: boolean;
  isRaining: boolean;
  isDisrupted: boolean;
  isMotorcycleMode: boolean;
  speedBands?: TrafficSpeedBand[];
  profile: CommuterProfile;
  onSelectStation?: (stationName: string) => void;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  activeRoute,
  selectedStep,
  showShelterLayer,
  showCyclingLayer,
  isRaining,
  isDisrupted,
  isMotorcycleMode,
  speedBands = [],
  profile,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Centered on central-northeast Singapore transit corridor
    const map = L.map(mapContainerRef.current, {
      center: [1.3521, 103.8498],
      zoom: 12,
      zoomControl: false,
      attributionControl: false, // We explicitly embed the exact required attribution
    });

    // Add OpenStreetMap base tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
    }).addTo(map);

    // Zoom control in top-right for mobile ergonomics
    L.control.zoom({ position: 'topright' }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    // Ensure Leaflet recalculates dimensions properly
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Layers whenever state changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // 1. Render LTA CoveredLinkWay overlay if toggled
    if (showShelterLayer) {
      COVERED_LINKWAYS.forEach((pathCoords) => {
        L.polyline(pathCoords as L.LatLngExpression[], {
          color: '#10b981', // Emerald green
          weight: 4,
          dashArray: '4, 6',
          opacity: 0.9,
        })
          .bindTooltip('LTA CoveredLinkWay (Sheltered Walkway)', { direction: 'top' })
          .addTo(layerGroup);
      });
    }

    // 2. Render LTA CyclingPath overlay if toggled
    if (showCyclingLayer) {
      CYCLING_PATHS.forEach((pathCoords) => {
        L.polyline(pathCoords as L.LatLngExpression[], {
          color: '#06b6d4', // Cyan
          weight: 4,
          dashArray: '6, 4',
          opacity: 0.9,
        })
          .bindTooltip('LTA CyclingPath / Park Connector', { direction: 'top' })
          .addTo(layerGroup);
      });
    }

    // 3. Render Motorcycle Speed Bands if in Motorcycle Mode
    if (isMotorcycleMode && speedBands.length > 0) {
      speedBands.forEach((band) => {
        const isCongested = band.SpeedBand <= 2;
        L.polyline(
          [
            [band.StartCoordinates.lat, band.StartCoordinates.lng],
            [band.EndCoordinates.lat, band.EndCoordinates.lng],
          ],
          {
            color: isCongested ? '#ef4444' : '#22c55e',
            weight: 6,
            opacity: 0.85,
          }
        )
          .bindPopup(`<b>${band.RoadName}</b><br/>Speed Band ${band.SpeedBand} (${band.MinimumSpeed}-${band.MaximumSpeed} km/h)<br/>${isCongested ? '⚠️ Severe Stop-and-Go (Clutch Slip)' : '✅ Free Flowing'}`)
          .addTo(layerGroup);
      });
    }

    // 4. Render Rain Cell overlay if raining
    if (isRaining) {
      // Rain radar circle over the configured origin.
      L.circle([profile.homeCoords.lat, profile.homeCoords.lng], {
        radius: 2500,
        color: '#3b82f6',
        fillColor: '#60a5fa',
        fillOpacity: 0.35,
        weight: 1.5,
      })
        .bindTooltip('data.gov.sg: Heavy Rain Cell (18.4 mm/h)', { permanent: true, direction: 'center' })
        .addTo(layerGroup);
    }

    // 5. Render Active Route Polyline
    if (activeRoute) {
      const allPoints: [number, number][] = [];

      activeRoute.steps.forEach((step) => {
        if (step.coordinates.length > 0) {
          allPoints.push(...step.coordinates);

          let strokeColor = '#3b82f6'; // default blue
          let dashArray = undefined;

          if (step.mode === 'cycle') {
            strokeColor = '#06b6d4'; // Cyan
            dashArray = '5, 5';
          } else if (step.mode === 'walk') {
            strokeColor = step.isSheltered ? '#10b981' : '#a855f7';
            dashArray = '3, 6';
          } else if (step.mode === 'mrt' || step.mode === 'lrt') {
            strokeColor = '#ec4899'; // Vibrant transit pink/purple
          } else if (step.mode === 'bus' || step.mode === 'shuttle') {
            strokeColor = step.freeMitigation ? '#f59e0b' : '#3b82f6';
          } else if (step.mode === 'motorcycle') {
            strokeColor = activeRoute.id === 'moto-route-smooth' ? '#10b981' : '#f97316';
          }

          L.polyline(step.coordinates as L.LatLngExpression[], {
            color: strokeColor,
            weight: 6,
            opacity: 0.9,
            dashArray,
          }).addTo(layerGroup);
        }
      });

      // Fit map bounds to route if points exist
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints.map(([lat, lng]) => [lat, lng]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
      }
    }

    // 6. Highlight selected step if commuter taps a timeline item
    if (selectedStep && selectedStep.coordinates.length > 0) {
      L.polyline(selectedStep.coordinates as L.LatLngExpression[], {
        color: '#facc15', // bright yellow highlight
        weight: 9,
        opacity: 1,
      }).addTo(layerGroup);
    }

    // 7. Station & Origin/Destination Markers
    // Parameter-driven origin
    const originIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div class="w-8 h-8 rounded-full bg-cyan-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold ring-4 ring-cyan-500/30">🚴</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    const originPopup = document.createElement('div');
    const originTitle = document.createElement('strong');
    originTitle.textContent = 'Origin';
    originPopup.append(originTitle, document.createElement('br'), document.createTextNode(profile.homeAddress));
    L.marker([profile.homeCoords.lat, profile.homeCoords.lng], { icon: originIcon })
      .bindPopup(originPopup)
      .addTo(layerGroup);

    // Parameter-driven destination
    const destIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div class="w-8 h-8 rounded-full bg-rose-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold ring-4 ring-rose-500/30">🏢</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    const destinationPopup = document.createElement('div');
    const destinationTitle = document.createElement('strong');
    destinationTitle.textContent = 'Destination';
    destinationPopup.append(destinationTitle, document.createElement('br'), document.createTextNode(profile.officeAddress));
    L.marker([profile.officeCoords.lat, profile.officeCoords.lng], { icon: destIcon })
      .bindPopup(destinationPopup)
      .addTo(layerGroup);

    // Transit Stations with Crowd Badges
    Object.values(STATIONS).forEach((stn) => {
      let badgeColor = 'bg-emerald-500';
      let badgeText = 'L';

      if (isDisrupted && (stn.code.includes('PE') || stn.code.includes('PTC'))) {
        badgeColor = 'bg-rose-500 animate-pulse';
        badgeText = 'ALERT';
      } else if (stn.code.includes('NE17') || stn.code.includes('PE7')) {
        badgeColor = 'bg-amber-500';
        badgeText = 'M';
      }

      const stnIcon = L.divIcon({
        className: 'custom-stn-icon',
        html: `
          <div class="flex flex-col items-center group cursor-pointer">
            <div class="px-1.5 py-0.5 rounded-full ${badgeColor} text-white font-bold text-[10px] shadow border border-white tracking-wider">
              ${stn.code} ${badgeText}
            </div>
            <div class="w-2.5 h-2.5 rounded-full bg-slate-900 border-2 border-white -mt-0.5"></div>
          </div>
        `,
        iconSize: [50, 30],
        iconAnchor: [25, 25],
      });

      L.marker([stn.lat, stn.lng], { icon: stnIcon })
        .bindPopup(`<b>${stn.name} (${stn.code})</b><br/>Line: ${stn.line}<br/>Crowd Forecast: ${badgeText === 'L' ? 'Low' : badgeText === 'M' ? 'Moderate' : 'High'}`)
        .addTo(layerGroup);
    });
  }, [activeRoute, selectedStep, showShelterLayer, showCyclingLayer, isRaining, isDisrupted, isMotorcycleMode, speedBands, profile]);

  return (
    <div className="relative w-full h-full">
      {/* Map Canvas */}
      <div id="clearpath-map" ref={mapContainerRef} className="w-full h-full z-0 bg-slate-950" />

      {/* Mandatory Exact Attribution as required by PS2 Section 2.3 */}
      <div
        id="osm-attribution-badge"
        className="absolute bottom-2 left-2 z-[400] bg-slate-900/90 backdrop-blur-xs text-slate-400 text-[10px] px-2 py-0.5 rounded shadow border border-slate-700 select-none pointer-events-auto"
      >
        © OpenStreetMap contributors
      </div>

      {/* Floating Map Legend Pill */}
      <div className="absolute top-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/80 shadow-lg text-xs space-y-1.5 pointer-events-auto max-w-[220px]">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
          <span>Active Route</span>
          <span className="text-cyan-400 font-mono truncate max-w-[130px]">{profile.homeAddress} → {profile.officeAddress}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-cyan-400 rounded-full"></span>
            <span>Cycle / PCN</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-pink-500 rounded-full"></span>
            <span>MRT / LRT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-emerald-400 border-b border-dashed border-emerald-300"></span>
            <span>Sheltered Link</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-amber-400 rounded-full"></span>
            <span>Mitigation Bus</span>
          </div>
        </div>
      </div>
    </div>
  );
};
