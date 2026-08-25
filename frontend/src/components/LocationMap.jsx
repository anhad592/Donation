import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

const liveIcon = L.divIcon({
  className: "",
  html: '<div class="pulse-marker"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const offlineIcon = L.divIcon({
  className: "",
  html: '<div class="offline-marker"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });
    }
  }, [points.length]); // eslint-disable-line
  return null;
}

export const LocationMap = ({ sessions }) => {
  const located = sessions.filter((s) => s.lat != null && s.lng != null);
  const center = located.length ? [located[0].lat, located[0].lng] : [20, 0];

  return (
    <div
      className="w-full h-[440px] rounded-xl overflow-hidden border border-[#26334D]"
      data-testid="interactive-map-container"
    >
      <MapContainer center={center} zoom={located.length ? 5 : 2} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <FitBounds points={located} />
        {located.map((s) => {
          const trail = (s.points || []).filter((p) => p.lat != null).map((p) => [p.lat, p.lng]);
          return (
            <div key={s.session_id}>
              {trail.length > 1 && (
                <Polyline
                  positions={trail}
                  pathOptions={{ color: s.active ? "#10B981" : "#475569", weight: 3, opacity: 0.7, dashArray: s.active ? null : "6 8" }}
                />
              )}
              <Marker position={[s.lat, s.lng]} icon={s.active ? liveIcon : offlineIcon}>
                <Popup>
                  <div className="font-mono text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[#10B981] font-bold uppercase tracking-wider">/{s.short_code}</span>
                      {s.active ? <span className="text-[#10B981]">● LIVE</span> : <span className="text-[#94A3B8]">○ offline {s.seconds_ago}s</span>}
                    </div>
                    <div className="text-[#F1F5F9]">{s.place || s.city || "Unknown area"}</div>
                    <div>{s.lat?.toFixed(5)}, {s.lng?.toFixed(5)}</div>
                    <div className="text-[#F1F5F9]">{[s.device_brand, s.device_model].filter(Boolean).join(" ") || s.device_type || "Unknown device"}</div>
                    <div className="text-[#94A3B8]">{[s.os, s.browser].filter(Boolean).join(" · ")}</div>
                    <div className="text-[#F59E0B]">{(s.points || []).length} points · {s.dispatch_status}</div>
                  </div>
                </Popup>
              </Marker>
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
};
