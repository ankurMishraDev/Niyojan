import type { MapPoint } from "../pages/MapPage";

// Re-export for external use
export type { MapPoint };

export type GeoMapFilters = {
  types?: string;
  bbox?: string;
  category?: string;
  status?: string;
};

export type GeoMapResponse = {
  points: MapPoint[];
  counts: Record<string, number>;
  bounds: {
    center: [number, number];
    southWest: [number, number];
    northEast: [number, number];
  };
};

// Note: fetchMapPoints in MapPage.tsx uses the global fetch directly for simplicity.
// This file exists for re-use and testing.
export async function fetchGeoMap(filters: GeoMapFilters = {}): Promise<GeoMapResponse> {
  const params = new URLSearchParams();
  if (filters.types) params.set("types", filters.types);
  if (filters.bbox) params.set("bbox", filters.bbox);
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();
  const res = await fetch(`/api/geo/map${query ? `?${query}` : ""}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Geo request failed: ${res.status}`);
  const json = await res.json();
  return json.data as GeoMapResponse;
}
