/**
 * Serialized (API-facing) shapes of our domain entities.
 *
 * Why extract here?
 * - Multiple features reference the "shape of a pet" as it appears in the API.
 *   The dashboard is one; future endpoints that embed pets (search results,
 *   lost-pet public pages) are others.
 * - Types here have NO runtime dependency — they're pure interfaces. Services
 *   produce them; nothing else.
 * - This avoids circular imports like `types/dashboard.ts -> services/petService.ts`.
 */

export interface SerializedPet {
  id: string;
  ownerId: string;
  currentUserRole: 'owner' | 'admin' | 'caregiver' | 'viewer';
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed: string | null;
  gender: 'male' | 'female' | 'unknown';
  dateOfBirth: string | null;
  weight: number | null;
  weightUnit: 'kg' | 'lb';
  color: string | null;
  microchipNumber: string | null;
  notes: string | null;
  photoUrl: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}