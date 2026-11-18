import { describe, expect, it } from 'vitest';

import { InMemoryNeedRepository } from '../src/needs/repository.js';

const input = { title: 'Improve sales strategy', challenge: 'We need practical help improving our sales strategy.', expertise: ['strategy'] as ['strategy'], industry: 'retail' as const, timeline: 'Within three months' };

describe('owner need lifecycle', () => {
  it('keeps legacy records readable and requires ownership for mutation', async () => {
    const repository = new InMemoryNeedRepository();
    const legacy = { title: input.title, challenge: input.challenge, expertise: input.expertise, industry: input.industry };
    const need = await repository.create('owner', legacy);
    expect((await repository.findById(need.id))?.timeline).toBeUndefined();
    expect(await repository.update('other', need.id, input)).toBeNull();
    expect(await repository.close('other', need.id)).toBeNull();
    expect((await repository.findById(need.id))?.status).toBe('open');
    const updated = await repository.update('owner', need.id, input);
    expect(updated?.timeline).toBe(input.timeline);
    expect(updated?.id).toBe(need.id);
  });

  it('removes closed needs from discovery, preserves history and blocks edits', async () => {
    const repository = new InMemoryNeedRepository();
    const need = await repository.create('owner', input);
    expect(await repository.close('owner', need.id)).toMatchObject({ id: need.id, status: 'closed' });
    expect(await repository.listOpen()).toEqual([]);
    expect(await repository.listByOwner('owner')).toHaveLength(1);
    expect(await repository.update('owner', need.id, input)).toBeNull();
    expect(await repository.close('owner', need.id)).toMatchObject({ status: 'closed' });
  });
});
