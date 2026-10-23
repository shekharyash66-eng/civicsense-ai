import React, { useState, useEffect, useRef } from "react";
import { Map, AdvancedMarker, Pin, useMap, useMapsLibrary, InfoWindow } from "@vis.gl/react-google-maps";
import { Complaint } from "../../types";

interface GoogleInteractiveMapProps {
  complaints?: Complaint[];
  selectedComplaintId?: string;
  onSelectComplaint?: (complaint: Complaint) => void;
  isPicker?: boolean;
  pickerCoords?: { lat: number; lng: number };
  onLocationPick?: (coords: { lat: number; lng: number; address: string; ward: string }) => void;
  heightClass?: string;
}

const LUCKNOW_CENTER = { lat: 26.8467, lng: 80.9462 };

export const InteractiveMap: React.FC<GoogleInteractiveMapProps> = ({
  complaints = [],
  selectedComplaintId,
  onSelectComplaint,
  isPicker = false,
  pickerCoords,
  onLocationPick,
  heightClass = "h-[500px]",
}) => {
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const map = useMap();
  const autocompleteRef = useRef<any>(null);
  const placesLib = useMapsLibrary('places');

  useEffect(() => {
    if (!autocompleteRef.current || !placesLib) return;

    const autocomplete = autocompleteRef.current;
    
    const handlePlaceSelect = async () => {
      const placePrediction = autocomplete.getPlacePrediction();
      if (!placePrediction) return;
      const place = placePrediction.toPlace();
      await place.fetchFields({ fields: ['location', 'viewport'] });
      if (place.viewport) {
        map?.fitBounds(place.viewport);
      } else if (place.location) {
        map?.setCenter(place.location);
        map?.setZoom(15);
      }
    };

    autocomplete.addEventListener('gmp-select', handlePlaceSelect);
    return () => autocomplete.removeEventListener('gmp-select', handlePlaceSelect);
  }, [map, placesLib]);

  useEffect(() => {
    if (selectedComplaintId) {
      const match = complaints.find((c) => c.id === selectedComplaintId);
      if (match) setSelectedComplaint(match);
    }
  }, [selectedComplaintId, complaints]);

  const handleMarkerClick = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    onSelectComplaint?.(complaint);
  };

  const handleMapClick = (e: any) => {
    if (isPicker && e.detail.latLng) {
      onLocationPick?.({
        lat: e.detail.latLng.lat,
        lng: e.detail.latLng.lng,
        address: "Selected Location",
        ward: "Unknown",
      });
    }
  };

  return (
    <div className={`w-full ${heightClass} rounded-2xl overflow-hidden shadow-md relative`}>
      <Map
        center={pickerCoords || LUCKNOW_CENTER}
        defaultZoom={12}
        mapId="DEMO_MAP_ID"
        onClick={handleMapClick}
        internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
      >
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <div className="w-64">
            <gmp-place-autocomplete ref={autocompleteRef} />
          </div>
          <button
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
                    map?.setCenter(pos);
                    map?.setZoom(15);
                  },
                  () => alert("Location access denied")
                );
              }
            }}
            className="bg-white p-2 rounded shadow text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Use My Current Location
          </button>
        </div>
        {complaints.map((complaint) => (
          <AdvancedMarker
            key={complaint.id}
            position={{ lat: complaint.latitude, lng: complaint.longitude }}
            onClick={() => handleMarkerClick(complaint)}
          >
            <Pin
              background={
                complaint.status === "RESOLVED" ? "#10b981" :
                complaint.status === "IN_PROGRESS" ? "#f59e0b" :
                complaint.status === "ASSIGNED" ? "#3b82f6" : "#ef4444"
              }
              glyphColor="#fff"
            />
          </AdvancedMarker>
        ))}

        {isPicker && pickerCoords && (
          <AdvancedMarker
            position={pickerCoords}
            draggable={true}
            onDragEnd={(e) => {
              if (e.latLng) {
                onLocationPick?.({
                  lat: e.latLng.lat,
                  lng: e.latLng.lng,
                  address: "Selected Location",
                  ward: "Unknown",
                });
              }
            }}
          >
            <Pin background="#3b82f6" glyphColor="#fff" />
          </AdvancedMarker>
        )}

        {selectedComplaint && (
          <InfoWindow
            position={{ lat: selectedComplaint.latitude, lng: selectedComplaint.longitude }}
            onCloseClick={() => setSelectedComplaint(null)}
          >
            <div className="text-xs">
              <h3 className="font-bold">{selectedComplaint.title}</h3>
              <p>{selectedComplaint.category}</p>
              <p className="font-semibold text-teal-600">{selectedComplaint.status}</p>
            </div>
          </InfoWindow>
        )}
      </Map>
    </div>
  );
};
