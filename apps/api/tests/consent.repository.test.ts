import { describe, expect, it } from 'vitest';

import { InMemoryConsentRepository } from '../src/consent/repository.js';

describe('consent repository idempotency', () => {
  it('deduplicates the same submission and consent type within a notice version', async () => {
    const repository = new InMemoryConsentRepository();
    const event = {
      userId: 'user-1',
      consentType: 'terms' as const,
      granted: true,
      noticeVersion: 'notice-1',
      idempotencyKey: 'submission-key-12345',
    };

    await repository.record([event]);
    await repository.record([event]);

    expect(await repository.listForUser('user-1')).toHaveLength(1);
  });

  it('records a new event when the notice version changes for the same submission key', async () => {
    const repository = new InMemoryConsentRepository();
    const event = {
      userId: 'user-1',
      consentType: 'terms' as const,
      granted: true,
      noticeVersion: 'notice-1',
      idempotencyKey: 'submission-key-12345',
    };

    await repository.record([event]);
    await repository.record([{ ...event, noticeVersion: 'notice-2' }]);

    const stored = await repository.listForUser('user-1');
    expect(stored).toHaveLength(2);
    expect(stored.map((item) => item.noticeVersion)).toEqual(['notice-1', 'notice-2']);
  });
});
