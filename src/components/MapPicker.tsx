import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface MapPickerProps {
  position: { lat: number; lng: number } | null;
  onPositionChange: (coords: { lat: number; lng: number }) => void;
}

// Component to handle map clicks and marker dragging
const DraggableMarker = ({ 
  position, 
  onPositionChange 
}: { 
  position: { lat: number; lng: number }; 
  onPositionChange: (coords: { lat: number; lng: number }) => void;
}) => {
  const markerRef = useRef<L.Marker>(null);

  useMapEvents({
    click(e) {
      onPositionChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const latlng = marker.getLatLng();
        onPositionChange({ lat: latlng.lat, lng: latlng.lng });
      }
    },
  };

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={[position.lat, position.lng]}
      ref={markerRef}
    />
  );
};

// Component to recenter map when position changes
const RecenterMap = ({ position }: { position: { lat: number; lng: number } }) => {
  const map = useMap();
  
  useEffect(() => {
    map.setView([position.lat, position.lng], map.getZoom());
  }, [position, map]);

  return null;
};

const MapPicker = ({ position, onPositionChange }: MapPickerProps) => {
  // Default to Biguaçu center
  const defaultPosition = { lat: -27.4944, lng: -48.6553 };
  const currentPosition = position || defaultPosition;

  return (
    <div className="w-full h-[250px] rounded-xl overflow-hidden border border-border shadow-sm">
      <MapContainer
        center={[currentPosition.lat, currentPosition.lng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DraggableMarker position={currentPosition} onPositionChange={onPositionChange} />
        <RecenterMap position={currentPosition} />
      </MapContainer>
    </div>
  );
};

export default MapPicker;
