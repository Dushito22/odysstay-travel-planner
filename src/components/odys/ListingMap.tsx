import L from "leaflet";
import { LayersControl, MapContainer, Marker, TileLayer } from "react-leaflet";

const icon = L.divIcon({
  className: "",
  html: '<span class="odys-marker odys-marker-strong" style="width:22px;height:22px"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function ListingMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <MapContainer center={[lat, lng]} zoom={14} scrollWheelZoom={false} className="h-full w-full">
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Satellite">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Map">
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        </LayersControl.BaseLayer>
      </LayersControl>
      <Marker position={[lat, lng]} icon={icon} />
    </MapContainer>
  );
}
