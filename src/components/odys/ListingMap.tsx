import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

const icon = L.divIcon({
  className: "",
  html: '<span class="odys-marker odys-marker-strong" style="width:22px;height:22px"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function ListingMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <MapContainer center={[lat, lng]} zoom={13} scrollWheelZoom={false} className="map-tone-tiles h-full w-full">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
      <Marker position={[lat, lng]} icon={icon} />
    </MapContainer>
  );
}
