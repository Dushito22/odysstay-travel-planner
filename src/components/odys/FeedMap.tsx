import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

import type { FeedRow } from "@/lib/feed";
import type { Profile } from "@/lib/profile";
import { ListingCard } from "./ListingCard";

export type Bounds = { n: number; s: number; e: number; w: number };

function icon(score: number | null) {
  const s = score ?? 0;
  const size = Math.round(14 + (s / 100) * 10);
  return L.divIcon({
    className: "",
    html: `<span class="odys-marker ${s >= 70 ? "odys-marker-strong" : ""}" style="width:${size}px;height:${size}px"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function clusterIcon(c: { getChildCount(): number }) {
  const n = c.getChildCount();
  return L.divIcon({ className: "", html: `<span class="odys-cluster">${n}</span>`, iconSize: [36, 36] });
}

function BoundsWatcher({ onBounds }: { onBounds: (b: Bounds) => void }) {
  const map = useMapEvents({
    moveend: () => report(),
    zoomend: () => report(),
  });
  function report() {
    const b = map.getBounds();
    onBounds({ n: b.getNorth(), s: b.getSouth(), e: b.getEast(), w: b.getWest() });
  }
  useEffect(() => { report(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function FeedMap({ rows, profile, onBounds }: { rows: FeedRow[]; profile: Profile | null; onBounds: (b: Bounds) => void }) {
  const markers = useMemo(() => rows.map((r) => ({ r, icon: icon(r.score) })), [rows]);
  return (
    <MapContainer center={[42.0, 12.6]} zoom={6} minZoom={4} className="map-warm-tiles h-full w-full" zoomControl={false}>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <BoundsWatcher onBounds={onBounds} />
      <MarkerClusterGroup iconCreateFunction={clusterIcon} showCoverageOnHover={false} maxClusterRadius={45}>
        {markers.map(({ r, icon }) => (
          <Marker key={r.id} position={[r.lat!, r.lng!]} icon={icon}>
            <Popup minWidth={260} maxWidth={280} className="odys-popup">
              <ListingCard row={r} profile={profile} compact />
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
