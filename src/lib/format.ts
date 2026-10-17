import type { StaffMember } from './types';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

export function friendlyDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('row-level security') || m.includes('permission denied')) {
    return 'You do not have permission to do that.';
  }
  if (m.includes('duplicate key') && m.includes('batches')) return 'This batch was already recorded.';
  if (m.includes('duplicate key') && m.includes('waste')) return 'This waste entry was already recorded.';
  if (m.includes('duplicate key') && m.includes('replenishment')) return 'This replenishment was already recorded.';
  if (m.includes('a shift is already open')) return 'A shift is already open. Close it first.';
  if (m.includes('shift is already closed')) return 'This shift was already closed.';
  if (m.includes('explanation required for')) {
    const name = message.replace(/^.*Explanation required for ([^([]+).*$/, '$1').trim();
    return `Unreconciled difference for ${name} needs a written explanation.`;
  }
  if (m.includes('handover message is required')) return 'Please write a handover note before closing.';
  if (m.includes('remaining quantities are required')) return 'Please record remaining quantities.';
  if (m.includes('invalid remaining quantity')) return 'Remaining quantities must be zero or more.';
  if (m.includes('you cannot acknowledge your own note')) return 'You cannot acknowledge your own handover note.';
  if (m.includes('not authorized')) return 'Only managers can do that.';
  if (m.includes('item not found')) return 'That item no longer exists.';
  if (m.includes('user already belongs to a workspace')) return 'This account already belongs to a workspace.';
  if (m.includes('issued to a different email')) {
    return 'This invitation was issued to a different email address. Sign in with the exact email your manager used, or ask them for a new invitation.';
  }
  if (m.includes('invitation code not recognized')) {
    return 'That code is not recognized. Check it with your manager and try again.';
  }
  if (m.includes('no longer valid') || m.includes('has expired')) {
    return 'This invitation is no longer valid or has expired. Ask your manager for a new one.';
  }
  if (m.includes('invalid display name')) return 'Please enter your name (80 characters or fewer).';
  if (m.includes('quantity > 0') || m.includes('check constraint')) return 'Quantity must be greater than zero.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Network error. Check your connection and try again.';
  return GENERIC_ERROR;
}

export function formatQty(n: number): string {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function relativeDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isSameDay = d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatDate(iso);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

type StaffName = Pick<StaffMember, 'id' | 'full_name'>;

export function fullNameOf(staffList: StaffName[], id: string): string {
  return staffList.find((s) => s.id === id)?.full_name ?? 'Unknown';
}

export function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
