import { AIAnalysis, CivicCategory } from '../types/civic';

export interface AnalyzeComplaintInput {
  title: string;
  description: string;
  category?: string;
  location?: string;
  imageBase64?: string;
}

export async function analyzeComplaintWithAI(input: AnalyzeComplaintInput): Promise<AIAnalysis> {
  try {
    const res = await fetch('/api/analyze-complaint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        category: (data.category as CivicCategory) || 'Other Civic Issues',
        summary: data.summary || `${input.title.slice(0, 60)}: Reported civic defect.`,
        severity_score: typeof data.severity_score === 'number' ? data.severity_score : 50,
        safety_risk_score: typeof data.safety_risk_score === 'number' ? data.safety_risk_score : 45,
        affected_population_score: typeof data.affected_population_score === 'number' ? data.affected_population_score : null,
        suggested_department: data.suggested_department || 'Department of Public Works (Roads)',
        possible_emergency: !!data.possible_emergency,
        reasoning: Array.isArray(data.reasoning) && data.reasoning.length > 0 ? data.reasoning : ['Automated evaluation of defect description.'],
        missing_information: Array.isArray(data.missing_information) ? data.missing_information : [],
        isFallback: !!data.isFallback,
      };
    }
  } catch (err) {
    console.warn('Network call to /api/analyze-complaint failed; engaging client-side fallback:', err);
  }

  // Pure client-side fallback if server unreachable
  return runClientHeuristicFallback(input.title, input.description, input.category);
}

function runClientHeuristicFallback(title: string, description: string, userCategory?: string): AIAnalysis {
  const combined = `${title} ${description}`.toLowerCase();
  let category: CivicCategory = (userCategory as CivicCategory) || 'Other Civic Issues';
  let suggestedDept = 'Department of Public Works (Roads)';
  let safety = 40;
  let severity = 45;
  let emergency = false;
  const reasoning: string[] = [];

  if (/live wire|sparking wire|electrocution|sinkhole|fissure|gas leak|toxic|deep manhole/.test(combined)) {
    emergency = true;
    safety = 95;
    severity = 88;
    reasoning.push('Critical safety keywords identified requiring urgent review.');
  }

  if (/water|leak|pipe|drain|flood|burst|sewer|waterlogging/.test(combined)) {
    category = 'Water Leakage & Drainage';
    suggestedDept = 'Municipal Water & Sewerage Board';
    severity = Math.max(severity, 70);
    reasoning.push('Surface water or sub-surface supply distribution defect.');
  } else if (/pothole|road|crater|asphalt|trench|crack|pavement/.test(combined)) {
    category = 'Potholes & Road Damage';
    suggestedDept = 'Department of Public Works (Roads)';
    severity = Math.max(severity, 65);
    safety = Math.max(safety, 60);
    reasoning.push('Pavement crater risks vehicular axle shock or cyclist collision.');
  } else if (/light|lamp|streetlight|dark|blackout|pole|wire|spark/.test(combined)) {
    category = 'Broken Streetlights & Electrical';
    suggestedDept = 'City Power & Electrical Authority';
    safety = Math.max(safety, 60);
    reasoning.push('Public lighting outage creates night visibility and safety hazard.');
  } else if (/garbage|trash|waste|dump|rubbish|bin/.test(combined)) {
    category = 'Garbage & Sanitation';
    suggestedDept = 'Waste & Environmental Sanitation';
    severity = Math.max(severity, 50);
    reasoning.push('Sanitary waste backlog creates hygiene issues.');
  } else if (/crosswalk|bollard|crossing|zebra|signal|pedestrian/.test(combined)) {
    category = 'Pedestrian & Traffic Safety';
    suggestedDept = 'Pedestrian & Traffic Safety Board';
    safety = Math.max(safety, 70);
    reasoning.push('Pedestrian traffic control equipment malfunction.');
  }

  return {
    category,
    summary: `${title.slice(0, 60)}: Reported civic issue requiring municipal action.`,
    severity_score: severity,
    safety_risk_score: safety,
    affected_population_score: null,
    suggested_department: suggestedDept,
    possible_emergency: emergency,
    reasoning: reasoning.length > 0 ? reasoning : ['Baseline heuristic classification.'],
    missing_information: ['Visual dimensions', 'Exact ward identifier'],
    isFallback: true,
  };
}
