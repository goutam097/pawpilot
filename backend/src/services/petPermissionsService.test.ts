import { describe, expect, it } from 'vitest';
import { roleHasPermission, type Permission } from './petPermissionsService.js';
import type { PetRole } from '../models/FamilyMember.js';

const criticalPermissions: Permission[] = [
  'pet:read',
  'pet:update',
  'pet:delete',
  'records:read',
  'records:write',
  'records:delete',
  'members:view',
  'members:invite',
  'members:manage',
];

const expected: Record<PetRole, readonly Permission[]> = {
  owner: criticalPermissions,
  admin: [
    'pet:read', 'pet:update', 'records:read', 'records:write', 'records:delete',
    'members:view', 'members:invite', 'members:manage',
  ],
  caregiver: ['pet:read', 'records:read', 'records:write', 'members:view'],
  viewer: ['pet:read', 'records:read', 'members:view'],
};

describe('pet role permission matrix', () => {
  for (const role of ['owner', 'admin', 'caregiver', 'viewer'] as const) {
    for (const permission of criticalPermissions) {
      it(`${role} ${expected[role].includes(permission) ? 'can' : 'cannot'} ${permission}`, () => {
        expect(roleHasPermission(role, permission)).toBe(expected[role].includes(permission));
      });
    }
  }
});