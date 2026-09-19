import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Bike, Layers, LocateFixed, Shield, TrainFront, X } from 'lucide-react';
import { CommuterProfile, RouteOption, RouteStep, TrafficSpeedBand } from '../types';
import { COVERED_LINKWAYS, CYCLING_PATHS, STATIONS } from '../data/mockGeospatial';

interface MapComponentProps {
  activeRoute: RouteOption | null;
  selectedStep: RouteStep | null;
  showShelterLayer: boolean;
  showCyclingLayer: boolean;
  showStations: boolean;
  onToggleShelterLayer: () => void;
  onToggleCyclingLayer: () => void;
  onToggleStations: () => void;
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
  showStations,
  onToggleShelterLayer,
  onToggleCyclingLayer,
  onToggleStations,
  isRaining,
  isDisrupted,
  isMotorcycleMode,
  speedBands = [],
  profile,
}) => {
  const [showLayerMenu, setShowLayerMenu] = useState(false);
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

    L.control.zoom({ position: 'bottomright' }).addTo(map);

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

  const fitActiveRoute = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeRoute) return;
    const points = activeRoute.steps.flatMap((step) => step.coordinates);
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map(([lat, lng]) => [lat, lng])), { padding: [48, 48], maxZoom: 14 });
    }
  }, [activeRoute]);

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
          .bindTooltip('REFERENCE OVERLAY: illustrative CoveredLinkWay subset', { direction: 'top' })
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
          .bindTooltip('REFERENCE OVERLAY: illustrative CyclingPath subset', { direction: 'top' })
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
          .bindPopup(`<b>${band.RoadName}</b><br/>LIVE API — LTA TrafficSpeedBands<br/>Speed Band ${band.SpeedBand} (${band.MinimumSpeed}-${band.MaximumSpeed} km/h)<br/>${isCongested ? 'Congested speed band' : 'Higher speed band'}`)
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
        .bindTooltip('SIMULATION: 18.4 mm/h heavy-rain test area', { permanent: true, direction: 'center' })
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

    // Reference station markers. No crowd value is inferred for static markers.
    if (showStations) Object.values(STATIONS).forEach((stn) => {
      let badgeColor = 'bg-slate-600';
      let badgeText = 'REF';

      if (isDisrupted && (stn.code.includes('PE') || stn.code.includes('PTC'))) {
        badgeColor = 'bg-rose-500 animate-pulse';
        badgeText = 'SIM';
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
        .bindPopup(`<b>${stn.name} (${stn.code})</b><br/>Line: ${stn.line}<br/>REFERENCE station marker${isDisrupted ? '<br/>SIMULATION disruption overlay' : ''}`)
        .addTo(layerGroup);
    });
  }, [activeRoute, selectedStep, showShelterLayer, showCyclingLayer, showStations, isRaining, isDisrupted, isMotorcycleMode, speedBands, profile]);

  return (
    <div className="relative w-full h-full">
      {/* Map Canvas */}
      <div id="clearpath-map" ref={mapContainerRef} className="w-full h-full z-0 bg-slate-950" />

      <div className="absolute right-3 top-3 z-[400] flex flex-col items-end gap-2">
        <button onClick={() => setShowLayerMenu(!showLayerMenu)} className="flex h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-3 text-xs font-bold text-slate-100 shadow-lg backdrop-blur-md"><Layers className="h-4 w-4 text-cyan-400"/>Layers</button>
        {showLayerMenu && (
          <div className="w-56 rounded-2xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-white">Map layers</span><button onClick={() => setShowLayerMenu(false)} className="p-1 text-slate-400"><X className="h-4 w-4"/></button></div>
            {[
              { label: 'Sheltered walkways', active: showShelterLayer, onClick: onToggleShelterLayer, icon: Shield, color: 'text-emerald-400' },
              { label: 'Cycling paths', active: showCyclingLayer, onClick: onToggleCyclingLayer, icon: Bike, color: 'text-cyan-400' },
              { label: 'Reference stations', active: showStations, onClick: onToggleStations, icon: TrainFront, color: 'text-pink-400' },
            ].map(({ label, active, onClick, icon: Icon, color }) => (
              <button key={label} onClick={onClick} className="flex min-h-10 w-full items-center justify-between rounded-xl px-2 text-left text-xs text-slate-300 hover:bg-slate-800">
                <span className="flex items-center gap-2"><Icon className={`h-4 w-4 ${color}`}/>{label}</span>
                <span className={`h-5 w-9 rounded-full p-0.5 ${active ? 'bg-cyan-500' : 'bg-slate-700'}`}><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${active ? 'translate-x-4' : ''}`}/></span>
              </button>
            ))}
            <p className="mt-2 border-t border-slate-800 pt-2 text-[9px] leading-relaxed text-slate-500">These are reference overlays, not live coverage.</p>
          </div>
        )}
        <button onClick={fitActiveRoute} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/90 text-slate-200 shadow-lg" aria-label="Recenter active route"><LocateFixed className="h-4 w-4"/></button>
      </div>

      {/* Mandatory Exact Attribution as required by PS2 Section 2.3 */}
      <div
        id="osm-attribution-badge"
        className="absolute bottom-2 left-2 z-[400] bg-slate-900/90 backdrop-blur-xs text-slate-400 text-[10px] px-2 py-0.5 rounded shadow border border-slate-700 select-none pointer-events-auto"
      >
        © OpenStreetMap contributors
      </div>

    </div>
  );
};
