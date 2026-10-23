import React, { useEffect, useRef, useState, useCallback } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { useCivic } from '../../context/CivicContext';
import { Complaint, PriorityLevel, CivicCategory, ComplaintStatus } from '../../types/civic';
import { PriorityIndicator, StatusIndicator } from '../common/StatusBadge';
import { ComplaintDetailModal } from './ComplaintDetailModal';
import {
  MapPin,
  Layers,
  Filter,
  Eye,
  AlertTriangle,
  RotateCcw,
  Navigation,
  Compass,
  Maximize2,
  Minimize2,
  Info,
  CheckCircle2,
  Key,
  ExternalLink,
  Loader2,
  Sun,
  Moon,
} from 'lucide-react';

interface CivicMapViewProps {
  onSelectComplaint?: (complaint: Complaint) => void;
  onSelectIncident?: (incidentId: string) => void;
}

// Sleek dark tactical theme for Google Maps matching CivicSense AI dark UI
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94a3b8' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#143329' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4ade80' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f1f5f9' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#475569' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f8fafc' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0b2444' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#071526' }],
  },
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createPriorityPinSvg(level: PriorityLevel, score: number): string {
  const color =
    level === 'Critical'
      ? '#EF4444'
      : level === 'High'
      ? '#F97316'
      : level === 'Medium'
      ? '#F59E0B'
      : '#10B981';

  const displayScore = score > 0 ? Math.round(score) : '!';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
    <defs>
      <filter id="p-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#000000" flood-opacity="0.5"/>
      </filter>
    </defs>
    <path d="M17 0 C7.6 0 0 7.6 0 17 C0 28.5 17 44 17 44 C17 44 34 28.5 34 17 C34 7.6 26.4 0 17 0 Z" fill="${color}" stroke="#FFFFFF" stroke-width="2" filter="url(#p-shadow)"/>
    <circle cx="17" cy="17" r="10.5" fill="#0F172A" fill-opacity="0.3"/>
    <text x="17" y="21" font-size="11" font-weight="bold" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, monospace" fill="#FFFFFF" text-anchor="middle">${displayScore}</text>
  </svg>`;

  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

export const CivicMapView: React.FC<CivicMapViewProps> = ({ onSelectComplaint, onSelectIncident }) => {
  const { complaints } = useCivic();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const userLocationMarkerRef = useRef<google.maps.Marker | null>(null);

  // API Key state: check env or localStorage fallback
  const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';
  const [apiKey, setApiKey] = useState<string>(() => {
    return envKey || localStorage.getItem('civic_custom_maps_key') || '';
  });
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [showIncidentsOnly, setShowIncidentsOnly] = useState(false);

  // View & Theme State
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [mapTheme, setMapTheme] = useState<'dark' | 'standard' | 'satellite'>('dark');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Verify and fetch server config if envKey wasn't bundled
  useEffect(() => {
    if (!apiKey) {
      fetch('/api/config/maps')
        .then((res) => res.json())
        .then((data) => {
          if (data && data.apiKey) {
            setApiKey(data.apiKey);
          } else {
            setIsMapLoading(false);
          }
        })
        .catch(() => {
          setIsMapLoading(false);
        });
    }
  }, [apiKey]);

  // Apply custom key manually
  const handleApplyCustomKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (customKeyInput.trim()) {
      const clean = customKeyInput.trim();
      localStorage.setItem('civic_custom_maps_key', clean);
      setApiKey(clean);
      setMapLoadError(null);
      setIsMapLoading(true);
    }
  };

  // Helper to filter complaints
  const getFilteredComplaints = useCallback(() => {
    return complaints.filter((c) => {
      if (typeof c.latitude !== 'number' || typeof c.longitude !== 'number') return false;
      if (isNaN(c.latitude) || isNaN(c.longitude)) return false;
      if (filterCategory !== 'ALL' && c.category !== filterCategory) return false;
      if (filterPriority !== 'ALL' && c.priority_level !== filterPriority) return false;
      if (filterStatus !== 'ALL' && c.status !== filterStatus) return false;
      if (showIncidentsOnly && !c.related_incident_id) return false;
      return true;
    });
  }, [complaints, filterCategory, filterPriority, filterStatus, showIncidentsOnly]);

  // Initialize Google Maps instance
  useEffect(() => {
    if (viewMode !== 'map') return;
    if (!apiKey) {
      setIsMapLoading(false);
      return;
    }
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    let isMounted = true;
    setIsMapLoading(true);
    setMapLoadError(null);

    try {
      setOptions({
        key: apiKey,
        v: 'weekly',
        solutionChannel: 'GMP_git_agentskills_v1',
      });
    } catch {
      // Options already set
    }

    Promise.all([importLibrary('maps'), importLibrary('marker')])
      .then(([mapsLib]) => {
        if (!isMounted || !mapContainerRef.current) return;

        // Default center on valid coordinates or San Francisco municipal corridor
        const validCoords = complaints.filter(
          (c) => typeof c.latitude === 'number' && typeof c.longitude === 'number'
        );
        const centerLat = validCoords.length > 0 ? validCoords[0].latitude! : 37.7749;
        const centerLng = validCoords.length > 0 ? validCoords[0].longitude! : -122.4194;

        const map = new mapsLib.Map(mapContainerRef.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 13,
          mapId: 'DEMO_MAP_ID',
          mapTypeId: mapTheme === 'satellite' ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP,
          styles: mapTheme === 'dark' ? DARK_MAP_STYLES : [],
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          scaleControl: true,
          streetViewControl: false,
          rotateControl: true,
          fullscreenControl: false,
        });

        const infoWindow = new mapsLib.InfoWindow({
          maxWidth: 340,
        });

        mapInstanceRef.current = map;
        infoWindowRef.current = infoWindow;
        setIsMapLoading(false);
      })
      .catch((err: unknown) => {
        console.error('Google Maps JavaScript API loader error:', err);
        if (isMounted) {
          const errorMsg =
            err instanceof Error
              ? err.message
              : 'Unable to load Google Maps. Please check that Maps JavaScript API is enabled in your Google Cloud Console.';
          setMapLoadError(errorMsg);
          setIsMapLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setMap(null);
        userLocationMarkerRef.current = null;
      }
      mapInstanceRef.current = null;
    };
  }, [apiKey, viewMode]);

  // Update Map Styles when mapTheme changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (mapTheme === 'satellite') {
      mapInstanceRef.current.setMapTypeId(google.maps.MapTypeId.HYBRID);
      mapInstanceRef.current.setOptions({ styles: [] });
    } else if (mapTheme === 'dark') {
      mapInstanceRef.current.setMapTypeId(google.maps.MapTypeId.ROADMAP);
      mapInstanceRef.current.setOptions({ styles: DARK_MAP_STYLES });
    } else {
      mapInstanceRef.current.setMapTypeId(google.maps.MapTypeId.ROADMAP);
      mapInstanceRef.current.setOptions({ styles: [] });
    }
  }, [mapTheme]);

  // Re-render markers and clusterer whenever complaints or filters change
  useEffect(() => {
    if (!mapInstanceRef.current || viewMode !== 'map') return;

    // Clear existing markers and clusterer
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const filtered = getFilteredComplaints();
    const newMarkers: google.maps.Marker[] = [];
    const bounds = new google.maps.LatLngBounds();

    filtered.forEach((c) => {
      const pos = { lat: c.latitude!, lng: c.longitude! };
      bounds.extend(pos);

      const marker = new google.maps.Marker({
        position: pos,
        title: `[${c.priority_level} ${Math.round(c.priority_score)}] ${c.title}`,
        icon: {
          url: createPriorityPinSvg(c.priority_level, c.priority_score),
          scaledSize: new google.maps.Size(34, 44),
          anchor: new google.maps.Point(17, 44),
        },
      });

      marker.addListener('click', () => {
        if (!infoWindowRef.current || !mapInstanceRef.current) return;

        const priorityColor =
          c.priority_level === 'Critical'
            ? '#EF4444'
            : c.priority_level === 'High'
            ? '#F97316'
            : c.priority_level === 'Medium'
            ? '#F59E0B'
            : '#10B981';

        const submittedDateStr = new Date(c.submitted_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        const content = document.createElement('div');
        content.className = 'p-3 text-xs font-sans text-slate-100 bg-slate-900 rounded-xl space-y-2 max-w-[320px]';
        content.innerHTML = `
          <div class="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <span class="font-mono font-bold text-sky-400 text-xs">${escapeHtml(c.id)}</span>
            <span class="px-2 py-0.5 rounded-full text-[11px] font-bold" style="background-color: ${priorityColor}25; color: ${priorityColor}; border: 1px solid ${priorityColor}60;">
              ${c.priority_level} (${Math.round(c.priority_score)})
            </span>
          </div>
          <div class="font-bold text-white text-xs leading-snug">${escapeHtml(c.title)}</div>
          <div class="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span>📍 ${escapeHtml(c.location_name)}</span>
          </div>
          <div class="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Status: <strong class="text-slate-200">${c.status}</strong></span>
            <span>${submittedDateStr}</span>
          </div>
          ${
            c.image_url
              ? `<div class="rounded-lg overflow-hidden border border-slate-800 my-1">
                  <img src="${escapeHtml(c.image_url)}" alt="Issue Attachment" class="w-full h-24 object-cover" />
                 </div>`
              : ''
          }
          <div class="pt-1.5 flex flex-col gap-1.5">
            <button id="btn-inspect-${c.id}" class="w-full py-1.5 px-3 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm">
              Inspect Complaint Details →
            </button>
            ${
              c.related_incident_id
                ? `<button id="btn-incident-${c.id}" class="w-full py-1 px-3 bg-slate-800 hover:bg-slate-700 text-sky-300 font-medium rounded-lg text-[11px] border border-slate-700 transition-colors">
                    ⚡ View Incident Cluster (${escapeHtml(c.related_incident_id)})
                   </button>`
                : ''
            }
          </div>
        `;

        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open({
          anchor: marker,
          map: mapInstanceRef.current,
        });

        // Add domready listener to bind button actions
        google.maps.event.addListenerOnce(infoWindowRef.current, 'domready', () => {
          const inspectBtn = document.getElementById(`btn-inspect-${c.id}`);
          if (inspectBtn) {
            inspectBtn.onclick = () => {
              setSelectedComplaint(c);
              if (onSelectComplaint) onSelectComplaint(c);
            };
          }

          const incidentBtn = document.getElementById(`btn-incident-${c.id}`);
          if (incidentBtn && c.related_incident_id && onSelectIncident) {
            incidentBtn.onclick = () => {
              onSelectIncident(c.related_incident_id!);
            };
          }
        });
      });

      newMarkers.push(marker);
    });

    markersRef.current = newMarkers;

    // Initialize or update MarkerClusterer
    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({
        map: mapInstanceRef.current,
        markers: newMarkers,
      });
    } else {
      clustererRef.current.clearMarkers();
      clustererRef.current.addMarkers(newMarkers);
    }

    // Auto-fit bounds if we have markers
    if (newMarkers.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds, {
        top: 60,
        right: 60,
        bottom: 60,
        left: 60,
      });
      // Don't over-zoom if single marker
      if (newMarkers.length === 1) {
        google.maps.event.addListenerOnce(mapInstanceRef.current, 'bounds_changed', () => {
          if (mapInstanceRef.current && (mapInstanceRef.current.getZoom() ?? 0) > 15) {
            mapInstanceRef.current.setZoom(15);
          }
        });
      }
    }
  }, [complaints, filterCategory, filterPriority, filterStatus, showIncidentsOnly, viewMode, onSelectComplaint, onSelectIncident, getFilteredComplaints]);

  // Center / Reset View Button
  const handleResetView = () => {
    if (!mapInstanceRef.current) return;
    const filtered = getFilteredComplaints();
    if (filtered.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      filtered.forEach((c) => bounds.extend({ lat: c.latitude!, lng: c.longitude! }));
      mapInstanceRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    } else {
      mapInstanceRef.current.setCenter({ lat: 37.7749, lng: -122.4194 });
      mapInstanceRef.current.setZoom(13);
    }
  };

  // HTML5 Geolocation "Locate Me"
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo({ lat, lng });
          mapInstanceRef.current.setZoom(15);

          if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.setMap(null);
          }

          userLocationMarkerRef.current = new google.maps.Marker({
            position: { lat, lng },
            map: mapInstanceRef.current,
            title: 'Your Current Location',
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#38BDF8',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 3,
            },
          });
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation failed or permission denied:', err);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Fullscreen container toggle
  const handleToggleFullscreen = () => {
    if (!mapContainerRef.current) return;
    const container = mapContainerRef.current.parentElement;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const mappedCount = complaints.filter(
    (c) => typeof c.latitude === 'number' && typeof c.longitude === 'number'
  ).length;
  const unmappedCount = complaints.length - mappedCount;

  return (
    <div className="space-y-4">
      {/* Top Header & View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              <span>Civic Spatial Intelligence Map</span>
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/80 font-bold">
              Google Maps Platform
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time geospatial distribution of municipal civic defects color-coded by AI priority scores.
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'map'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Interactive Map</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Spatial Coordinates List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        {/* Priority Filter */}
        <div>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Priorities</option>
            <option value="Critical">Critical (80–100)</option>
            <option value="High">High (60–79)</option>
            <option value="Medium">Medium (35–59)</option>
            <option value="Low">Low (0–34)</option>
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Categories</option>
            <option value="Potholes & Road Damage">Potholes & Roads</option>
            <option value="Water Leakage & Drainage">Water & Drainage</option>
            <option value="Broken Streetlights & Electrical">Power & Lighting</option>
            <option value="Garbage & Sanitation">Garbage & Sanitation</option>
            <option value="Pedestrian & Traffic Safety">Pedestrian & Traffic</option>
            <option value="Public Infrastructure Damage">Infrastructure Damage</option>
            <option value="Other Civic Issues">Other Civic Issues</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Review">Under Review</option>
            <option value="Verified">Verified</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        {/* Show Incident Clusters Only toggle */}
        <label className="flex items-center gap-2 cursor-pointer ml-auto text-slate-700 dark:text-slate-300 font-medium hover:text-slate-900 dark:hover:text-white">
          <input
            type="checkbox"
            checked={showIncidentsOnly}
            onChange={(e) => setShowIncidentsOnly(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-teal-600 focus:ring-teal-500 focus:ring-offset-0 cursor-pointer"
          />
          <span className="flex items-center gap-1">
            <span>Show Incident Clusters Only</span>
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          </span>
        </label>
      </div>

      {/* Main Map Presentation */}
      {viewMode === 'map' ? (
        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md h-[600px] bg-slate-950">
          {/* Missing or Invalid API Key Setup Guide */}
          {!apiKey || mapLoadError ? (
            <div className="absolute inset-0 z-30 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-6 text-slate-100">
              <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Google Maps API Key Setup</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {mapLoadError
                      ? `Failed to load map: ${mapLoadError}`
                      : 'Please provide a valid Google Maps API Key to render real interactive tiles, satellite views, and spatial markers.'}
                  </p>
                </div>

                <form onSubmit={handleApplyCustomKey} className="space-y-3 pt-2">
                  <input
                    type="text"
                    value={customKeyInput}
                    onChange={(e) => setCustomKeyInput(e.target.value)}
                    placeholder="Enter Google Maps API Key (AIzaSy...)"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!customKeyInput.trim()}
                      className="flex-1 py-2 px-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition-colors"
                    >
                      Apply Key & Load Map
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors"
                    >
                      Use List View
                    </button>
                  </div>
                </form>

                <div className="text-left bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
                  <div className="font-semibold text-slate-300">Google Cloud Console Checklist:</div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Enable <strong>Maps JavaScript API</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Ensure billing is linked to your Cloud project</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Set Referrer: authorized website origins</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Map Loading Spinner */}
          {isMapLoading && !mapLoadError && (
            <div className="absolute inset-0 z-20 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl shadow-lg">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Initializing Google Maps & Clusters...
                </span>
              </div>
            </div>
          )}

          {/* Google Maps Canvas */}
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Top-Right Floating Controls (Map Style, Locate Me, Fit Bounds, Fullscreen) */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            {/* Map Theme Toggle */}
            <div className="bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-lg flex items-center gap-1 text-xs text-white">
              <button
                onClick={() => setMapTheme('dark')}
                title="Tactical Dark Map"
                className={`p-1.5 rounded-lg transition-colors ${
                  mapTheme === 'dark' ? 'bg-teal-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setMapTheme('standard')}
                title="Roadmap Style"
                className={`p-1.5 rounded-lg transition-colors ${
                  mapTheme === 'standard' ? 'bg-teal-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setMapTheme('satellite')}
                title="Satellite Imagery"
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  mapTheme === 'satellite' ? 'bg-teal-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Satellite
              </button>
            </div>

            {/* Reset View Button */}
            <button
              onClick={handleResetView}
              title="Fit Map to All Active Markers"
              className="p-2 bg-slate-900/90 backdrop-blur-md hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 shadow-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Locate Me Geolocation Button */}
            <button
              onClick={handleLocateMe}
              title="Locate My Position"
              disabled={isLocating}
              className="p-2 bg-slate-900/90 backdrop-blur-md hover:bg-slate-800 text-slate-300 hover:text-teal-400 rounded-xl border border-slate-800 shadow-lg transition-colors disabled:opacity-50"
            >
              {isLocating ? (
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={handleToggleFullscreen}
              title="Toggle Fullscreen"
              className="p-2 bg-slate-900/90 backdrop-blur-md hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 shadow-lg transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Floating Priority Legend */}
          <div className="absolute bottom-4 left-4 z-20 bg-slate-900/95 backdrop-blur-md p-3.5 rounded-xl border border-slate-800 shadow-xl text-xs space-y-2 text-slate-200">
            <div className="flex items-center justify-between gap-4">
              <span className="font-bold text-white text-[11px] uppercase tracking-wider">
                Priority Index
              </span>
              <span className="text-[10px] text-slate-400">0 - 100</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-600 shadow-xs" />
                <span className="font-medium text-slate-300">Critical (80–100)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-500 shadow-xs" />
                <span className="font-medium text-slate-300">High (60–79)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 shadow-xs" />
                <span className="font-medium text-slate-300">Medium (35–59)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs" />
                <span className="font-medium text-slate-300">Low (0–34)</span>
              </div>
            </div>
          </div>

          {/* Unmapped count badge notice */}
          {unmappedCount > 0 && mappedCount > 0 && (
            <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-lg text-xs text-slate-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span>{unmappedCount} report(s) without GPS coordinates excluded from map</span>
            </div>
          )}

          {/* Empty state overlay when no complaints with GPS coordinates exist */}
          {mappedCount === 0 && !isMapLoading && !mapLoadError && (
            <div className="absolute inset-0 z-20 bg-slate-950/60 backdrop-blur-2xs flex items-center justify-center p-4">
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-2xl max-w-sm text-center space-y-2 text-white">
                <MapPin className="w-8 h-8 text-slate-500 mx-auto" />
                <h3 className="text-sm font-semibold text-white">
                  No complaints with GPS coordinates
                </h3>
                <p className="text-xs text-slate-400">
                  Reports submitted with latitude and longitude will appear as interactive priority markers here.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Spatial Coordinates List View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Spatial Complaint Registry</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detailed coordinate mapping and geographic metadata for municipal triage.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {complaints.length} Total Registered
            </span>
          </div>

          {complaints.length > 0 ? (
            <div className="space-y-2">
              {complaints.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedComplaint(c)}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{c.id}</span>
                      <PriorityIndicator level={c.priority_level} score={c.priority_score} />
                      <StatusIndicator status={c.status} />
                      {c.related_incident_id && (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 font-bold border border-teal-200 dark:border-teal-800">
                          ⚡ {c.related_incident_id}
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{c.title}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <span>📍 {c.location_name}</span>
                      <span>·</span>
                      <span>{c.category}</span>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    {typeof c.latitude === 'number' && typeof c.longitude === 'number' ? (
                      <div className="font-mono text-xs text-teal-600 dark:text-teal-400 font-bold">
                        {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-500 italic flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Coordinates missing</span>
                      </div>
                    )}
                    <button className="text-sky-600 dark:text-sky-400 font-semibold hover:underline text-[11px]">
                      Inspect Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              No complaints currently registered in municipal database.
            </div>
          )}
        </div>
      )}

      {/* Complaint Detail Modal */}
      {selectedComplaint && (
        <ComplaintDetailModal
          complaint={selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          onSelectIncident={onSelectIncident}
        />
      )}
    </div>
  );
};
