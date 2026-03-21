'use client';

import 'leaflet/dist/leaflet.css';

import type { LatLngTuple } from 'leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';

interface RouteMapLeafletProps {
  latlng: readonly number[][];
}

function FitBounds({ positions }: { positions: LatLngTuple[] }): ReactNode {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 1) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, positions]);

  return null;
}

export default function RouteMapLeaflet({ latlng }: Readonly<RouteMapLeafletProps>): ReactNode {
  if (latlng.length < 2) return null;

  const positions: LatLngTuple[] = latlng.map(
    (coord) => [coord[0] ?? 0, coord[1] ?? 0] as LatLngTuple,
  );
  const start = positions[0] ?? ([0, 0] as LatLngTuple);
  const end = positions[positions.length - 1] ?? start;

  return (
    <div className="route-map overflow-hidden rounded-2xl">
      <MapContainer
        center={start}
        zoom={13}
        style={{ height: '16rem', width: '100%', background: 'var(--surface-tooltip)' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CARTO"
        />
        <Polyline
          positions={positions}
          pathOptions={{ color: '#6366f1', weight: 3, opacity: 0.9 }}
        />
        <CircleMarker
          center={start}
          radius={6}
          pathOptions={{ color: '#34d399', fillColor: '#34d399', fillOpacity: 1, weight: 2 }}
        />
        <CircleMarker
          center={end}
          radius={6}
          pathOptions={{ color: '#f87171', fillColor: '#f87171', fillOpacity: 1, weight: 2 }}
        />
        <FitBounds positions={positions} />
      </MapContainer>
    </div>
  );
}
