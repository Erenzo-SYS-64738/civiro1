export interface Ticket {
  id: string;
  photo_before_url: string; // base64 string
  photo_after_url: string | null; // base64 string
  description: string;
  category: 'pothole' | 'garbage' | 'streetlight' | 'water_leak';
  severity: number; // 1-10
  department: 'Roads Dept' | 'Sanitation Dept' | 'Electrical Dept';
  status: 'Open' | 'Resolved Claimed' | 'Verified Resolved' | 'Reopened';
  lat: number;
  lng: number;
  created_at: string; // ISO date string for standard cross-compatibility
  resolved_claimed_at: string | null; // ISO date string
  reasoning_log: string[];
  trust_impact: number;
}

export interface Department {
  name: string;
  trust_score: number;
  tickets_resolved_verified: number;
  tickets_resolved_rejected: number;
}

export interface NewTicketInput {
  description: string;
  lat: number;
  lng: number;
  photo_before_url: string;
}
