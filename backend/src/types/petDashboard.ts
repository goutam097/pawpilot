import type { SerializedPet } from "./serialized.js";

export interface DashboardWeight {
  current: number | null;
  unit: "kg" | "lb";
  previous: number | null;
  change: number | null;
  recordedAt: string | null;
}

export interface DashboardTrip {
  id: string;
  name: string;
  destination: string | null;
  departureDate: string;
  daysUntilDeparture: number;
  checklistProgress: { completed: number; total: number };
}

export interface PetDashboard {
  pet: SerializedPet;
  weight: DashboardWeight;
  upcoming: UpcomingEvent[];
  health: DashboardHealth;
  stats: DashboardStats;
  nextTrip: DashboardTrip | null;
  generatedAt: string;
}

export type UpcomingEventType =
  | "vaccination"
  | "medication"
  | "vet_visit"
  | "grooming"
  | "feeding"
  | "reminder"
  | "custom";

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

export interface DashboardLostReport {
  id: string;
  shareToken: string;
  shareUrl: string;
  lastSeenAt: string;
  lastSeenLocation: string;
  daysLost: number;
  foundAt: string | null;
}

export interface PetDashboard {
  pet: SerializedPet;
  weight: DashboardWeight;
  upcoming: UpcomingEvent[];
  health: DashboardHealth;
  stats: DashboardStats;
  nextTrip: DashboardTrip | null;
  /**
   * If the pet is marked as lost, this holds the active report.
   * The dashboard UI shows a prominent banner when this is non-null.
   */
  lostReport: DashboardLostReport | null;
  generatedAt: string;
}
