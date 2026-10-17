export type Role = 'manager' | 'staff';

export interface Workspace {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface StaffMember {
  id: string;
  workspace_id: string;
  full_name: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface FoodItem {
  id: string;
  workspace_id: string;
  name: string;
  category: string;
  unit: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Batch {
  id: string;
  workspace_id: string;
  item_id: string;
  quantity: number;
  produced_at: string;
  status: 'open' | 'closed';
  created_by: string;
  created_at: string;
}

export interface Replenishment {
  id: string;
  workspace_id: string;
  item_id: string;
  batch_id: string | null;
  quantity: number;
  note: string | null;
  recorded_at: string;
  created_by: string;
  created_at: string;
}

export const WASTE_REASONS = [
  'Expired',
  'Damaged',
  'Burnt',
  'Dropped',
  'Quality issue',
  'Overproduction',
  'Other',
] as const;

export type WasteReason = (typeof WASTE_REASONS)[number];

export interface WasteEvent {
  id: string;
  workspace_id: string;
  item_id: string;
  quantity: number;
  reason: WasteReason;
  note: string | null;
  wasted_at: string;
  created_by: string;
  created_at: string;
}

export interface Shift {
  id: string;
  workspace_id: string;
  opened_by: string;
  opened_at: string;
  closed_by: string | null;
  closed_at: string | null;
  status: 'open' | 'closed';
  closing_note: string | null;
}

export interface ShiftCloseout {
  id: string;
  shift_id: string;
  item_id: string;
  produced: number;
  replenished: number;
  wasted: number;
  remaining: number;
  sold_estimate: number;
  difference: number;
  explanation: string | null;
}

export interface HandoverNote {
  id: string;
  workspace_id: string;
  shift_id: string;
  message: string;
  author_id: string;
  created_at: string;
}

export interface HandoverAcknowledgment {
  id: string;
  note_id: string;
  acknowledged_by: string;
  acknowledged_at: string;
}

export interface ActivityEntry {
  id: number;
  workspace_id: string;
  actor_id: string | null;
  entity_type: 'item' | 'batch' | 'replenishment' | 'waste' | 'shift' | 'handover';
  entity_id: string | null;
  action: string;
  summary: string;
  created_at: string;
}

export interface CountRow {
  item_id: string;
  name: string;
  unit: string;
  produced: number;
  replenished: number;
  wasted: number;
  expected: number;
  remaining: string;
  explanation: string;
  inactive: boolean;
}
