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
export {};
//# sourceMappingURL=serialized.js.map