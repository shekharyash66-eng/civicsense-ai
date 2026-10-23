import { Complaint, Department, Incident, StatusHistoryEntry } from '../types/civic';

export const INITIAL_DEPARTMENTS: Department[] = [
  {
    id: 'dept-roads',
    name: 'Department of Public Works (Roads)',
    category_specialty: ['Potholes & Road Damage', 'Public Infrastructure Damage'],
    description: 'Responsible for municipal roadway paving, asphalt maintenance, bridges, sidewalks, and structural repairs.',
    head_officer: 'Marcus Vance, Chief Engineer',
    contact_email: 'dpw.roads@civicsense.gov',
    contact_phone: '+1 (555) 019-4821',
    active: true,
    sla_target_hours: 48,
  },
  {
    id: 'dept-water',
    name: 'Municipal Water & Sewerage Board',
    category_specialty: ['Water Leakage & Drainage'],
    description: 'Manages municipal water mains, supply lines, sewer mains, storm drains, and flood mitigation.',
    head_officer: 'Elena Rostova, Director of Utilities',
    contact_email: 'water.dispatch@civicsense.gov',
    contact_phone: '+1 (555) 019-4822',
    active: true,
    sla_target_hours: 24,
  },
  {
    id: 'dept-electric',
    name: 'City Power & Electrical Authority',
    category_specialty: ['Broken Streetlights & Electrical'],
    description: 'Oversees municipal street lighting grids, traffic signals, transformers, and public electrical safety.',
    head_officer: 'David Chen, Grid Operations Supervisor',
    contact_email: 'grid.operations@civicsense.gov',
    contact_phone: '+1 (555) 019-4823',
    active: true,
    sla_target_hours: 36,
  },
  {
    id: 'dept-sanitation',
    name: 'Waste & Environmental Sanitation',
    category_specialty: ['Garbage & Sanitation'],
    description: 'Directs municipal solid waste collection, illegal dumping removal, hazardous debris clearance, and public bins.',
    head_officer: 'Sarah Jenkins, Sanitation Superintendent',
    contact_email: 'sanitation.support@civicsense.gov',
    contact_phone: '+1 (555) 019-4824',
    active: true,
    sla_target_hours: 24,
  },
  {
    id: 'dept-traffic',
    name: 'Pedestrian & Traffic Safety Board',
    category_specialty: ['Pedestrian & Traffic Safety', 'Other Civic Issues'],
    description: 'Manages pedestrian crosswalks, traffic calming, school safety corridors, signage, and accessibility ramps.',
    head_officer: 'Rajiv Patel, Safety Director',
    contact_email: 'pedestrian.safety@civicsense.gov',
    contact_phone: '+1 (555) 019-4825',
    active: true,
    sla_target_hours: 72,
  },
];

// No demo complaints or fabricated records
export const INITIAL_COMPLAINTS: Complaint[] = [];

// No fake incidents
export const INITIAL_INCIDENTS: Incident[] = [];

// No simulated audit trail records
export const INITIAL_STATUS_HISTORY: StatusHistoryEntry[] = [];
