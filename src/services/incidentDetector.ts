import { Complaint, Incident, CivicCategory, PriorityLevel } from '../types/civic';

/**
 * Calculates distance in kilometers between two geo-coordinates using Haversine formula
 */
export function getCoordinatesDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extracts normalized tokens from a text string, ignoring common filler words
 */
function extractSignificantTokens(text: string): Set<string> {
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'to', 'of', 'for', 'with', 'near',
    'by', 'this', 'that', 'there', 'it', 'from', 'be', 'are', 'was', 'were', 'very', 'please', 'help',
    'issue', 'problem', 'complaint', 'reported', 'need', 'needs', 'urgent', 'road', 'street'
  ]);
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
  return new Set(words);
}

/**
 * Calculates Jaccard token overlap between two strings
 */
function tokenSimilarity(a: string, b: string): number {
  const setA = extractSignificantTokens(a);
  const setB = extractSignificantTokens(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/**
 * Category compatibility check (some categories naturally correlate, e.g. Water Leakage with Road Damage or Potholes)
 */
function areCategoriesCompatible(c1: CivicCategory, c2: CivicCategory): boolean {
  if (c1 === c2) return true;
  const waterRoad =
    (c1 === 'Water Leakage & Drainage' && c2 === 'Potholes & Road Damage') ||
    (c2 === 'Water Leakage & Drainage' && c1 === 'Potholes & Road Damage');
  const infraPedestrian =
    (c1 === 'Public Infrastructure Damage' && c2 === 'Pedestrian & Traffic Safety') ||
    (c2 === 'Public Infrastructure Damage' && c1 === 'Pedestrian & Traffic Safety');
  return waterRoad || infraPedestrian;
}

/**
 * Evaluates pairwise similarity score (0 to 100) between two complaints
 */
export function calculateComplaintPairSimilarity(
  c1: Complaint,
  c2: Complaint
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // 1. Category match
  if (c1.category === c2.category) {
    score += 35;
    reasons.push(`Identical domain category (${c1.category})`);
  } else if (areCategoriesCompatible(c1.category, c2.category)) {
    score += 20;
    reasons.push(`Interconnected civic categories (${c1.category} & ${c2.category})`);
  } else {
    return { score: 0, reasons: [] }; // Incompatible categories rarely share an incident
  }

  // 2. Spatial proximity
  if (c1.latitude && c1.longitude && c2.latitude && c2.longitude) {
    const distKm = getCoordinatesDistanceKm(c1.latitude, c1.longitude, c2.latitude, c2.longitude);
    if (distKm <= 0.25) {
      score += 35;
      reasons.push(`Immediate geographic proximity (~${Math.round(distKm * 1000)}m apart)`);
    } else if (distKm <= 0.8) {
      score += 20;
      reasons.push(`Within same neighborhood corridor (~${Math.round(distKm * 1000)}m apart)`);
    } else if (distKm <= 2.0) {
      score += 10;
      reasons.push(`Within same municipal ward (~${distKm.toFixed(1)}km apart)`);
    }
  } else {
    // Fallback: check location name token overlap
    const locSim = tokenSimilarity(c1.location_name, c2.location_name);
    if (locSim > 0.4) {
      score += 25;
      reasons.push(`Matching reported landmark: "${c1.location_name}" / "${c2.location_name}"`);
    } else if (locSim > 0.2) {
      score += 15;
      reasons.push(`Partial location overlap: "${c1.location_name}" / "${c2.location_name}"`);
    }
  }

  // 3. Text description / symptom similarity
  const descSim = tokenSimilarity(`${c1.title} ${c1.description}`, `${c2.title} ${c2.description}`);
  if (descSim > 0.35) {
    score += 20;
    reasons.push('High descriptive keyword overlap in citizen reports');
  } else if (descSim > 0.18) {
    score += 12;
    reasons.push('Shared symptom vocabulary across descriptions');
  }

  // 4. Temporal proximity
  const t1 = new Date(c1.submitted_at).getTime();
  const t2 = new Date(c2.submitted_at).getTime();
  const hoursDiff = Math.abs(t1 - t2) / (1000 * 60 * 60);
  if (hoursDiff <= 48) {
    score += 10;
    reasons.push(`Submitted within 48 hours of each other (${Math.round(hoursDiff)}h window)`);
  } else if (hoursDiff <= 120) {
    score += 5;
    reasons.push(`Submitted within same workweek (${Math.round(hoursDiff / 24)}d window)`);
  }

  return { score: Math.min(100, score), reasons };
}

/**
 * Groups unlinked or active complaints into proposed incident clusters
 */
export function detectPotentialIncidents(
  complaints: Complaint[],
  existingIncidents: Incident[]
): Incident[] {
  // Exclude resolved or rejected complaints from new groupings
  const activeComplaints = complaints.filter(
    (c) => c.status !== 'Resolved' && c.status !== 'Rejected' && !c.related_incident_id
  );

  const proposedIncidents: Incident[] = [];
  const assignedComplaintIds = new Set<string>();

  // Check existing proposed/confirmed incidents first to see if any complaints should be added
  // ...

  // Group unlinked complaints
  for (let i = 0; i < activeComplaints.length; i++) {
    const c1 = activeComplaints[i];
    if (assignedComplaintIds.has(c1.id)) continue;

    const cluster: Complaint[] = [c1];
    const clusterReasons: string[] = [];

    for (let j = i + 1; j < activeComplaints.length; j++) {
      const c2 = activeComplaints[j];
      if (assignedComplaintIds.has(c2.id)) continue;

      const { score, reasons } = calculateComplaintPairSimilarity(c1, c2);
      if (score >= 55) {
        cluster.push(c2);
        clusterReasons.push(...reasons);
      }
    }

    if (cluster.length >= 2) {
      cluster.forEach((c) => assignedComplaintIds.add(c.id));

      const highestPriorityLevel: PriorityLevel = cluster.some((c) => c.priority_level === 'Critical')
        ? 'Critical'
        : cluster.some((c) => c.priority_level === 'High')
        ? 'High'
        : cluster.some((c) => c.priority_level === 'Medium')
        ? 'Medium'
        : 'Low';

      const avgLat = cluster.reduce((sum, c) => sum + (c.latitude || 0), 0) / cluster.length;
      const avgLon = cluster.reduce((sum, c) => sum + (c.longitude || 0), 0) / cluster.length;
      const hasCoords = cluster.some((c) => c.latitude !== null);

      const uniqueReasons = Array.from(new Set(clusterReasons)).slice(0, 4);

      // Estimate population impact responsibly based on known factors
      const maxPopScore = Math.max(...cluster.map((c) => c.population_impact_score));
      let estPop: number | null = null;
      if (maxPopScore > 70) estPop = 1200 + cluster.length * 250;
      else if (maxPopScore > 40) estPop = 400 + cluster.length * 100;
      else estPop = 150 + cluster.length * 40;

      const incidentId = `INC-${Math.floor(100 + Math.random() * 900)}`;

      proposedIncidents.push({
        id: incidentId,
        title: `Cluster: ${cluster[0].category} near ${cluster[0].location_name}`,
        description: `Correlated civic issue group detected across ${cluster.length} independent reports: "${cluster.map((c) => c.title).slice(0, 3).join('", "')}".`,
        category: cluster[0].category,
        location_name: cluster[0].location_name,
        latitude: hasCoords ? avgLat : null,
        longitude: hasCoords ? avgLon : null,
        related_complaint_ids: cluster.map((c) => c.id),
        grouping_confidence: Math.min(95, 60 + cluster.length * 10),
        explanation: uniqueReasons.join('. ') || 'Multiple geographically and chronologically aligned reports in this corridor.',
        status: 'Proposed',
        assigned_department_id: cluster[0].assigned_department_id || null,
        highest_priority: highestPriorityLevel,
        estimated_affected_population: estPop,
        recommended_next_action:
          cluster[0].category === 'Water Leakage & Drainage'
            ? 'Coordinate joint inspection with Water Supply & Sewerage before structural road resurfacing.'
            : cluster[0].category === 'Broken Streetlights & Electrical'
            ? 'Dispatch electrical technician for circuit-wide transformer check along the line.'
            : 'Issue combined departmental work-order for root-cause resolution.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  return proposedIncidents;
}
