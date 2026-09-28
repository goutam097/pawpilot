import type { SerializedPet } from './serialized.js';

export interface DashboardWeight {
  current: number | null;
  unit: 'kg' | 'lb';
  previous: number | null;
  change: number | null;
  recordedAt: string | null;
}

export type UpcomingEventType =
  | 'vaccination'
  | 'medication'
  | 'vet_visit'
  | 'grooming'
  | 'feeding'
  | 'reminder'
  | 'custom';

export interface UpcomingEvent {
  id: string;
  type: UpcomingEventType;
  title: string;
  dueAt: string;
  overdue: boolean;
}

export interface DashboardHealth {
  lastVaccinationAt: string | null;
  nextVaccinationDueAt: string | null;
  activeMedications: number;
}

export interface DashboardStats {
  remindersDueThisWeek: number;
  expensesThisMonthCents: number | null;
}

export interface PetDashboard {
  pet: SerializedPet;
  weight: DashboardWeight;
  upcoming: UpcomingEvent[];
  health: DashboardHealth;
  stats: DashboardStats;
  generatedAt: string;
}