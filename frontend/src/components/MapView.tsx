import { useEffect } from 'react';
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { PontoReferencia } from '../types';

const pin = L.divIcon({
  className: 'pin',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function Recenter({ lat, lng, flyKey }: { lat: number; lng: number; flyKey: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 15, { duration: flyKey === 0 ? 0 : 0.65 });
    // O pino arrastado atualiza lat/lng sem recentralizar o mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyKey, map]);
  return null;
}

type MapViewProps = {
  lat: number;
  lng: number;
  flyKey: number;
  draggable?: boolean;
  pontos?: PontoReferencia[];
  onDrag?: (lat: number, lng: number) => void;
};

export function MapView({ lat, lng, flyKey, draggable = false, pontos = [], onDrag }: MapViewProps) {
  return (
    <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} className="map">
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter lat={lat} lng={lng} flyKey={flyKey} />
      <Marker
        position={[lat, lng]}
        draggable={draggable}
        icon={pin}
        eventHandlers={{
          dragend: (event) => {
            const next = event.target.getLatLng();
            onDrag?.(next.lat, next.lng);
          },
        }}
      />
      {pontos.map((ponto) => (
        <CircleMarker
          key={ponto.id}
          center={[ponto.latitude, ponto.longitude]}
          radius={6}
          pathOptions={{ color: '#1C1917', weight: 2, fillColor: '#F4EFE8', fillOpacity: 1 }}
        >
          <Tooltip direction="top">{ponto.nome}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
