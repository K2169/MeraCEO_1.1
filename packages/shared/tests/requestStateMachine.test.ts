import { describe, expect, it } from 'vitest';
import { availableActions, REQUEST_ERROR_CODES, transitionRequest } from '../src/requestStateMachine';

const past = new Date('2026-11-01T10:00:00Z');
const future = new Date('2026-12-01T10:00:00Z');
const now = new Date('2026-11-15T10:00:00Z');

describe('transitionRequest', () => {
  it('lets only the professional accept or decline a pending request', () => {
    const ctx = { actor: 'professional' as const, now, startsAt: future };
    expect(transitionRequest('pending', 'accept', ctx)).toEqual({ ok: true, status: 'accepted' });
    expect(transitionRequest('pending', 'decline', ctx)).toEqual({ ok: true, status: 'declined' });
    const owner = transitionRequest('pending', 'accept', { ...ctx, actor: 'owner' });
    expect(owner).toEqual({ ok: false, code: REQUEST_ERROR_CODES.forbidden });
  });

  it('lets either party cancel a pending or accepted request', () => {
    for (const actor of ['owner', 'professional'] as const) {
      const ctx = { actor, now, startsAt: future };
      expect(transitionRequest('pending', 'cancel', ctx).ok).toBe(true);
      expect(transitionRequest('accepted', 'cancel', ctx).ok).toBe(true);
    }
  });

  it('allows completion only after the scheduled start time', () => {
    const ctx = { actor: 'owner' as const, now, startsAt: future };
    expect(transitionRequest('accepted', 'complete', ctx)).toEqual({
      ok: false,
      code: REQUEST_ERROR_CODES.notYetStarted,
    });
    expect(transitionRequest('accepted', 'complete', { ...ctx, startsAt: past })).toEqual({
      ok: true,
      status: 'completed',
    });
  });

  it('rejects every transition out of a terminal state', () => {
    const ctx = { actor: 'professional' as const, now, startsAt: past };
    for (const status of ['declined', 'cancelled', 'completed'] as const) {
      expect(availableActions(status, ctx)).toEqual([]);
      expect(transitionRequest(status, 'cancel', ctx)).toEqual({
        ok: false,
        code: REQUEST_ERROR_CODES.invalidTransition,
      });
    }
  });

  it('rejects invalid edges such as accepting an already accepted request', () => {
    const ctx = { actor: 'professional' as const, now, startsAt: future };
    expect(transitionRequest('accepted', 'accept', ctx)).toEqual({
      ok: false,
      code: REQUEST_ERROR_CODES.invalidTransition,
    });
    expect(transitionRequest('pending', 'complete', ctx)).toEqual({
      ok: false,
      code: REQUEST_ERROR_CODES.invalidTransition,
    });
  });
});

describe('availableActions', () => {
  it('shows the professional accept and decline on a pending request', () => {
    const actions = availableActions('pending', {
      actor: 'professional',
      now,
      startsAt: future,
    });
    expect(actions.sort()).toEqual(['accept', 'cancel', 'decline']);
  });

  it('shows the owner only cancel on a pending request', () => {
    expect(availableActions('pending', { actor: 'owner', now, startsAt: future })).toEqual([
      'cancel',
    ]);
  });
});
