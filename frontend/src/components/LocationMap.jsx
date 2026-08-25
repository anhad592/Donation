import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

const pulseIcon = L.divIcon({
  className: "",
  html: '<div class="pulse-marker"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [points, map]);
  return null;
}

export const LocationMap = ({ records }) => {
  const points = records.filter((r) => r.lat != null && r.lng != null);
  const center = points.length ? [points[0].lat, points[0].lng] : [20, 0];

  return (
    <div
      className="w-full h-[420px] rounded-xl overflow-hidden border border-[#26334D]"
      data-testid="interactive-map-container"
    >
      <MapContainer center={center} zoom={points.length ? 4 : 2} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <FitBounds points={points} />
        {points.map((r) => (
          <Marker key={r.id} position={[r.lat, r.lng]} icon={pulseIcon}>
            <Popup>
              <div className="font-mono text-xs space-y-1">
                <div className="text-[#10B981] font-bold uppercase tracking-wider">/{r.short_code}</div>
                <div>{r.place || r.city || "Unknown location"}</div>
                <div>{r.lat?.toFixed(5)}, {r.lng?.toFixed(5)}</div>
                <div className="text-[#94A3B8]">{new Date(r.timestamp).toLocaleString()}</div>
                <div className="text-[#F59E0B] uppercase">{r.method} · {r.dispatch_status}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
