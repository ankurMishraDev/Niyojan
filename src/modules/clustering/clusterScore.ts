type NeedData = {
  id: string;
  category: string;
  lat: number | null;
  lng: number | null;
  createdAt: Date;
  summary: string;
};

type ClusterPolicy = {
  categoryWeight: number;
  locationWeight: number;
  timeWeight: number;
  semanticWeight: number;
  threshold: number;
  timeWindowDays: number;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getTokens(text: string): Set<string> {
  const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
  return new Set(words);
}

function calculateJaccardSimilarity(text1: string, text2: string): number {
  const set1 = getTokens(text1);
  const set2 = getTokens(text2);
  if (set1.size === 0 && set2.size === 0) return 1;
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

export function clusterScore(needA: NeedData, needB: NeedData, policy: ClusterPolicy): number {
  // 1. Category Score
  const categoryMatch = needA.category === needB.category ? 1.0 : 0.0;

  // 2. Location Score
  let locationScore = 0;
  if (needA.lat !== null && needA.lng !== null && needB.lat !== null && needB.lng !== null) {
    const distKm = calculateHaversineDistance(needA.lat, needA.lng, needB.lat, needB.lng);
    if (distKm <= 2) locationScore = 1.0;
    else if (distKm <= 5) locationScore = 0.75;
    else if (distKm <= 10) locationScore = 0.5;
    else locationScore = 0.0;
  } else {
    // If location is missing for either, we can't reliably cluster based on location.
    // For safety, we penalize it.
    locationScore = 0.0;
  }

  // 3. Time Proximity
  const msDiff = Math.abs(needA.createdAt.getTime() - needB.createdAt.getTime());
  const daysDiff = msDiff / (1000 * 60 * 60 * 24);
  const timeProximity = Math.max(0, 1 - (daysDiff / policy.timeWindowDays));

  // 4. Semantic Similarity (Jaccard fallback)
  const semanticSimilarity = calculateJaccardSimilarity(needA.summary, needB.summary);

  // Total Score
  const totalScore = 
    (policy.categoryWeight * categoryMatch) +
    (policy.locationWeight * locationScore) +
    (policy.timeWeight * timeProximity) +
    (policy.semanticWeight * semanticSimilarity);

  return totalScore;
}
