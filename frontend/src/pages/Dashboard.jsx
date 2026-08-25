import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LocationMap } from "@/components/LocationMap";
import { toast } from "sonner";
import {
  Radar, Link2, Copy, Trash2, MapPin, Download, Zap, ExternalLink,
  MousePointerClick, Globe, Send, CheckCircle2, Clock, XCircle,
} from "lucide-react";

const STATUS_STYLES = {
  pending: { color: "#F59E0B", icon: Clock, label: "Pending" },
  dispatched: { color: "#06B6D4", icon: Send, label: "Dispatched" },
  delivered: { color: "#10B981", icon: CheckCircle2, label: "Delivered" },
  unreachable: { color: "#EF4444", icon: XCircle, label: "Unreachable" },
};

const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div className="bg-[#111622] border border-[#26334D] rounded-xl p-5 flex items-center gap-4" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
    <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: `${accent}1a` }}>
      <Icon size={20} style={{ color: accent }} />
    </div>
    <div>
      <div className="text-2xl font-bold font-head">{value}</div>
      <div className="text-xs text-[#94A3B8] uppercase tracking-wider font-mono">{label}</div>
    </div>
  </div>
);

export default function Dashboard() {
  const [links, setLinks] = useState([]);
  const [records, setRecords] = useState([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const origin = window.location.origin;

  const load = async () => {
    try {
      const [l, r] = await Promise.all([api.get("/links"), api.get("/records")]);
      setLinks(l.data);
      setRecords(r.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const createLink = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    try {
      await api.post("/links", { original_url: url.trim(), title: title.trim() || null });
      setUrl("");
      setTitle("");
      toast.success("Tracking beacon created");
      load();
    } catch (e) {
      toast.error("Failed to create link");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (code) => {
    navigator.clipboard.writeText(`${origin}/r/${code}`);
    toast.success("Link copied to clipboard");
  };

  const deleteLink = async (code) => {
    await api.delete(`/links/${code}`);
    toast.success("Link deleted");
    load();
  };

  const simulate = async (code) => {
    const lat = 40.7128 + (Math.random() - 0.5) * 80;
    const lng = -74.006 + (Math.random() - 0.5) * 160;
    await api.post("/simulate", { short_code: code, lat, lng, accuracy: 20 });
    toast.success("Simulated visitor location captured");
    load();
  };

  const updateStatus = async (id, status) => {
    await api.patch(`/records/${id}`, { dispatch_status: status });
    load();
  };

  const exportCsv = () => {
    window.open(`${api.defaults.baseURL}/export`, "_blank");
  };

  const totalClicks = links.reduce((s, l) => s + (l.click_count || 0), 0);
  const gpsCount = records.filter((r) => r.method === "gps").length;

  return (
    <div className="min-h-screen bg-[#0A0D14]">
      {/* Header */}
      <header className="border-b border-[#26334D] bg-[#0A0D14]/90 backdrop-blur sticky top-0 z-[500]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#10B981]/15 flex items-center justify-center">
              <Radar className="text-[#10B981]" size={22} />
            </div>
            <div>
              <h1 className="font-head text-xl font-extrabold tracking-tight">GeoReach<span className="text-[#10B981]">Aid</span></h1>
              <p className="text-[10px] text-[#94A3B8] font-mono uppercase tracking-widest">Link Location Beacon</p>
            </div>
          </div>
          <button
            onClick={exportCsv}
            data-testid="export-logs-button"
            className="flex items-center gap-2 text-sm bg-[#182030] hover:bg-[#1f2a3d] border border-[#26334D] px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard icon={Link2} label="Active Links" value={links.length} accent="#10B981" />
          <StatCard icon={MousePointerClick} label="Total Clicks" value={totalClicks} accent="#F59E0B" />
          <StatCard icon={MapPin} label="Locations" value={records.length} accent="#06B6D4" />
          <StatCard icon={Globe} label="GPS Pins" value={gpsCount} accent="#10B981" />
        </div>

        {/* Create link */}
        <section className="bg-[#111622] border border-[#26334D] rounded-2xl p-6">
          <h2 className="font-head text-lg font-bold mb-1 flex items-center gap-2">
            <Zap size={18} className="text-[#F59E0B]" /> Generate Tracking Beacon
          </h2>
          <p className="text-sm text-[#94A3B8] mb-5">Paste any URL (YouTube or other). Visitors are located, then instantly redirected.</p>
          <form onSubmit={createLink} className="grid md:grid-cols-[1fr_240px_auto] gap-3">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              data-testid="youtube-url-input"
              className="bg-[#0A0D14] border border-[#26334D] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#10B981] transition-colors"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Campaign label (optional)"
              data-testid="link-title-input"
              className="bg-[#0A0D14] border border-[#26334D] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#10B981] transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              data-testid="generate-link-button"
              className="bg-[#10B981] hover:bg-[#0ea472] text-[#0A0D14] font-semibold px-6 py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Link2 size={16} /> Generate
            </button>
          </form>
        </section>

        {/* Links list */}
        <section>
          <h2 className="font-head text-lg font-bold mb-4">Your Beacons</h2>
          {links.length === 0 ? (
            <div className="text-center py-12 text-[#94A3B8] bg-[#111622] border border-dashed border-[#26334D] rounded-2xl">
              No links yet. Generate your first tracking beacon above.
            </div>
          ) : (
            <div className="grid gap-3">
              {links.map((l) => (
                <div key={l.id} className="bg-[#111622] border border-[#26334D] rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3" data-testid={`link-row-${l.short_code}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-[#10B981] font-bold">/r/{l.short_code}</span>
                      {l.title && <span className="text-xs bg-[#182030] px-2 py-0.5 rounded text-[#94A3B8]">{l.title}</span>}
                    </div>
                    <a href={l.original_url} target="_blank" rel="noreferrer" className="text-xs text-[#94A3B8] hover:text-[#06B6D4] flex items-center gap-1 truncate">
                      <ExternalLink size={12} className="shrink-0" /> {l.original_url}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-[#182030] px-3 py-1.5 rounded-lg text-[#F59E0B]">{l.click_count} clicks</span>
                    <button onClick={() => copyLink(l.short_code)} title="Copy link" data-testid={`copy-${l.short_code}`} className="p-2 bg-[#182030] hover:bg-[#1f2a3d] rounded-lg transition-colors">
                      <Copy size={16} />
                    </button>
                    <button onClick={() => simulate(l.short_code)} title="Simulate a visitor" data-testid={`simulate-${l.short_code}`} className="p-2 bg-[#182030] hover:bg-[#1f2a3d] rounded-lg transition-colors text-[#06B6D4]">
                      <Zap size={16} />
                    </button>
                    <button onClick={() => deleteLink(l.short_code)} title="Delete" data-testid={`delete-${l.short_code}`} className="p-2 bg-[#182030] hover:bg-[#EF4444]/20 rounded-lg transition-colors text-[#EF4444]">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Map */}
        <section>
          <h2 className="font-head text-lg font-bold mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-[#06B6D4]" /> Live Location Map
          </h2>
          <LocationMap records={records} />
        </section>

        {/* Records table */}
        <section>
          <h2 className="font-head text-lg font-bold mb-4">Location Records</h2>
          <div className="bg-[#111622] border border-[#26334D] rounded-2xl overflow-hidden" data-testid="visitor-location-table">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#26334D] text-left text-[#94A3B8] font-mono text-xs uppercase tracking-wider">
                    <th className="px-4 py-3">Link</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Coordinates</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Dispatch</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-[#94A3B8]">No location signals captured yet.</td></tr>
                  ) : (
                    records.map((r) => {
                      const st = STATUS_STYLES[r.dispatch_status] || STATUS_STYLES.pending;
                      return (
                        <tr key={r.id} className="border-b border-[#26334D]/60 hover:bg-[#182030]/50 transition-colors" data-testid={`record-row-${r.id}`}>
                          <td className="px-4 py-3 font-mono text-[#10B981]">/{r.short_code}</td>
                          <td className="px-4 py-3 max-w-[240px] truncate">{r.place || r.city || "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[#94A3B8]">{r.lat != null ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : "—"}</td>
                          <td className="px-4 py-3"><span className="text-xs uppercase font-mono text-[#06B6D4]">{r.method}</span></td>
                          <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">{new Date(r.timestamp).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <select
                              value={r.dispatch_status}
                              onChange={(e) => updateStatus(r.id, e.target.value)}
                              data-testid={`dispatch-select-${r.id}`}
                              className="bg-[#0A0D14] border border-[#26334D] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#10B981]"
                              style={{ color: st.color }}
                            >
                              <option value="pending">Pending</option>
                              <option value="dispatched">Dispatched</option>
                              <option value="delivered">Delivered</option>
                              <option value="unreachable">Unreachable</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
