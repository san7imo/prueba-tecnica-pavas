import { describe, expect, it } from 'vitest';

import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  AUDIT_TRANSITION_KIND,
} from '../src/constants/audit.js';
import { USER_ROLE } from '../src/constants/auth.js';
import {
  buildAuditSnapshot,
  sanitizeAuditMetadata,
} from '../src/utils/auditSnapshots.js';

describe('audit snapshot allowlists', () => {
  it('serializes USER fields explicitly and excludes credentials and secrets', () => {
    const snapshot = buildAuditSnapshot(AUDIT_ENTITY_TYPE.USER, {
      id: 42,
      name: 'Safe User',
      email: 'safe@example.test',
      role: USER_ROLE.ADMIN,
      active: 1,
      password: 'must-not-appear',
      passwordHash: 'must-not-appear',
      accessToken: 'must-not-appear',
      refreshToken: 'must-not-appear',
      cookie: 'must-not-appear',
      secret: 'must-not-appear',
    });

    expect(snapshot).toEqual({
      id: '42',
      name: 'Safe User',
      email: 'safe@example.test',
      role: USER_ROLE.ADMIN,
      active: true,
    });
    expect(JSON.stringify(snapshot)).not.toMatch(
      /password|hash|token|cookie|secret/i,
    );
  });

  it('normalizes ids, dates and exact decimals for every domain snapshot', () => {
    expect(buildAuditSnapshot(AUDIT_ENTITY_TYPE.CLIENT, {
      id: 1,
      name: 'Client',
      phone: '3000000000',
      email: null,
      deletedAt: null,
      deletedByUserId: null,
      deleteReason: null,
    })).toEqual({
      id: '1',
      name: 'Client',
      phone: '3000000000',
      email: null,
      deletedAt: null,
      deletedByUserId: null,
      deleteReason: null,
    });
    expect(buildAuditSnapshot(AUDIT_ENTITY_TYPE.BIKE, {
      id: 2,
      plate: 'ABC123',
      brand: 'Yamaha',
      model: 'FZ',
      cylinder: '149',
      clientId: 1,
    })).toMatchObject({ id: '2', clientId: '1', deletedAt: null });
    expect(buildAuditSnapshot(AUDIT_ENTITY_TYPE.WORK_ORDER, {
      id: 3,
      bikeId: 2,
      entryDate: '2026-09-03T12:00:00.000Z',
      faultDescription: 'Noise',
      status: 'RECIBIDA',
      total: '0.00',
      assignedMechanicId: null,
    })).toEqual({
      id: '3',
      bikeId: '2',
      entryDate: '2026-09-03T12:00:00.000Z',
      faultDescription: 'Noise',
      status: 'RECIBIDA',
      total: '0.00',
      assignedMechanicId: null,
    });
    expect(buildAuditSnapshot(AUDIT_ENTITY_TYPE.WORK_ORDER_ITEM, {
      id: 4,
      workOrderId: 3,
      type: 'MANO_OBRA',
      description: 'Diagnosis',
      count: '1.00',
      unitValue: '50000.00',
      createdByUserId: null,
    })).toMatchObject({
      id: '4',
      workOrderId: '3',
      unitValue: '50000.00',
      createdByUserId: null,
    });
  });
});

describe('audit metadata allowlists', () => {
  it('drops unknown keys and sorts allowed arrays deterministically', () => {
    const metadata = sanitizeAuditMetadata({
      entityType: AUDIT_ENTITY_TYPE.CLIENT,
      action: AUDIT_ACTION.CREATED,
      metadata: {
        duplicateOverride: true,
        matchedFields: ['phone', 'email', 'phone', 'name'],
        candidateIds: [12, 2, 12],
        passwordHash: 'forbidden',
      },
    });

    expect(metadata).toEqual({
      duplicateOverride: true,
      matchedFields: ['email', 'phone'],
      candidateIds: ['2', '12'],
    });
  });

  it('keeps only contractual values for transitions, roles and active state', () => {
    expect(sanitizeAuditMetadata({
      entityType: AUDIT_ENTITY_TYPE.WORK_ORDER,
      action: AUDIT_ACTION.STATUS_CHANGED,
      metadata: {
        transitionKind: AUDIT_TRANSITION_KIND.FORWARD,
        arbitrary: true,
      },
    })).toEqual({ transitionKind: AUDIT_TRANSITION_KIND.FORWARD });

    expect(sanitizeAuditMetadata({
      entityType: AUDIT_ENTITY_TYPE.USER,
      action: AUDIT_ACTION.ROLE_CHANGED,
      metadata: { previousRole: 'ROOT', newRole: USER_ROLE.MECHANIC },
    })).toEqual({ newRole: USER_ROLE.MECHANIC });

    expect(sanitizeAuditMetadata({
      entityType: AUDIT_ENTITY_TYPE.USER,
      action: AUDIT_ACTION.DEACTIVATED,
      metadata: { previousActive: true, newActive: false },
    })).toEqual({ previousActive: true, newActive: false });
  });

  it('returns null for metadata that an action does not allow', () => {
    expect(sanitizeAuditMetadata({
      entityType: AUDIT_ENTITY_TYPE.BIKE,
      action: AUDIT_ACTION.ITEM_ADDED,
      metadata: { arbitrary: 'discarded' },
    })).toBeNull();
  });
});
