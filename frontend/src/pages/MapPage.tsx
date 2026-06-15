import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { api } from "@/lib/api";
import "leaflet/dist/leaflet.css";

// ─── India defaults ────────────────────────────────────────────────────────────
const INDIA_CENTER: [number, number] = [22.5937, 78.9629];
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.55, 68.11],
  [37.1, 97.4],
];

// ─── Types ───────────────────────────────────────────────────────────────────
export type PointType = "survey" | "need" | "aggregate_need" | "volunteer";

export type MapPoint = {
  type: PointType;
  id: string;
  lat: number;
  lng: number;
  label: string;
  category: string | null;
  urgency?: number;
  status?: string;
  count: number;
};

// ─── Marker colors by type ────────────────────────────────────────────────────
const POINT_COLORS: Record<PointType, string> = {
  survey: "#3b82f6",         // blue
  need: "#f59e0b",           // amber
  aggregate_need: "#ef4444", // red
  volunteer: "#22c55e",      // green
};

// ─── API helper — uses the authenticated api client so the Bearer token is sent ──
async function fetchMapPoints(filters: {
  types?: string;
  category?: string;
  status?: string;
}): Promise<{ points: MapPoint[]; counts: Record<string, number> }> {
  const query: Record<string, unknown> = {};
  if (filters.types) query.types = filters.types;
  if (filters.category) query.category = filters.category;
  if (filters.status) query.status = filters.status;

  const envelope = await api.get<{ points: MapPoint[]; counts: Record<string, number> }>(
    "/geo/map",
    query,
  );
  return envelope.data;
}

// ─── Component ────────────────────────────────────────────────────────────────
const ALL_TYPES: PointType[] = ["survey", "need", "aggregate_need", "volunteer"];
const TYPE_LABELS: Record<PointType, string> = {
  survey: "Surveys",
  need: "Needs",
  aggregate_need: "Clusters",
  volunteer: "Volunteers",
};

export default function MapPage() {
  const [selectedTypes, setSelectedTypes] = useState<Set<PointType>>(new Set(ALL_TYPES));
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filters = {
    types: Array.from(selectedTypes).join(",") || undefined,
    category: categoryFilter || undefined,
    status: statusFilter || undefined,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["geo-map", filters],
    queryFn: () => fetchMapPoints(filters),
    retry: 1,
  });

  const toggleType = (type: PointType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const points = data?.points ?? [];
  const counts = data?.counts ?? {};

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* Header + filters */}
      <div className="p-4 border-b border-hairline bg-canvas flex flex-wrap gap-3 items-center">
        <div>
          <h2 className="text-lg font-bold text-ink">India Map</h2>
          <p className="text-xs text-mute">Survey requests, needs, clusters, and volunteer locations</p>
        </div>

        {/* Type toggles */}
        <div className="flex flex-wrap gap-2 ml-auto">
          {ALL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                selectedTypes.has(type)
                  ? "border-transparent text-white"
                  : "bg-canvas border-hairline text-mute"
              }`}
              style={
                selectedTypes.has(type)
                  ? { backgroundColor: POINT_COLORS[type] }
                  : {}
              }
            >
              <span>{TYPE_LABELS[type]}</span>
              {counts[type] !== undefined && (
                <span className="opacity-80">({counts[type]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <input
          type="text"
          placeholder="Filter by category..."
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-hairline rounded px-3 py-1.5 text-xs text-ink bg-canvas-soft-2 w-36"
        />

        {/* Status filter */}
        <input
          type="text"
          placeholder="Filter by status..."
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-hairline rounded px-3 py-1.5 text-xs text-ink bg-canvas-soft-2 w-36"
        />
      </div>

      {/* Error banner */}
      {isError && (
        <div className="bg-danger/10 border border-danger/30 text-danger-deep px-4 py-3 text-sm">
          Failed to load map data:{" "}
          {error instanceof Error ? error.message : "Unknown error"}. Please try again.
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-canvas/60 z-50 flex items-center justify-center">
            <p className="text-sm text-mute">Loading markers…</p>
          </div>
        )}

        <MapContainer
          center={INDIA_CENTER}
          bounds={INDIA_BOUNDS}
          minZoom={4}
          zoom={5}
          style={{ height: "100%", width: "100%", minHeight: "500px" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {points.map((point) => (
            <CircleMarker
              key={`${point.type}-${point.id}`}
              center={[point.lat, point.lng]}
              radius={point.type === "aggregate_need" ? Math.min(6 + Math.log2(point.count + 1) * 3, 18) : 7}
              pathOptions={{
                color: "white",
                weight: 1.5,
                fillColor: POINT_COLORS[point.type],
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div className="text-xs space-y-1 min-w-[140px]">
                  <div className="font-semibold text-sm capitalize">
                    {TYPE_LABELS[point.type]}
                  </div>
                  <div className="text-ink font-medium">{point.label}</div>
                  {point.category && (
                    <div>
                      <span className="text-mute">Category: </span>
                      {point.category}
                    </div>
                  )}
                  {point.urgency !== undefined && (
                    <div>
                      <span className="text-mute">Urgency: </span>
                      {point.urgency.toFixed(0)}
                    </div>
                  )}
                  {point.status && (
                    <div>
                      <span className="text-mute">Status: </span>
                      {point.status}
                    </div>
                  )}
                  {point.type === "aggregate_need" && (
                    <div>
                      <span className="text-mute">Members: </span>
                      {point.count}
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* No markers message */}
        {!isLoading && !isError && points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-canvas border border-hairline rounded-lg px-6 py-4 text-center shadow-sm">
              <p className="text-sm text-mute">No markers match the current filters.</p>
            </div>
          </div>
        )}
      </div>

      {/* OSM attribution note (accessibility duplicate) */}
      <div className="px-4 py-1 text-[10px] text-mute border-t border-hairline bg-canvas">
        Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a> contributors
      </div>
    </div>
  );
}
