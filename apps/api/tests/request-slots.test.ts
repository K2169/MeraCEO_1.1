import { describe, expect, it } from 'vitest';
import { InMemoryRequestRepository, occupiedMinutes, SlotConflictError } from '../src/requests/repository.js';

describe('consultation slot occupancy', () => {
  it('uses UTC minutes including quarter-hour timezone offsets', () => {
    expect(occupiedMinutes(new Date('2030-01-01T03:15:00Z'), 30)).toHaveLength(30);
    expect(() => occupiedMinutes(new Date('2030-01-01T03:15:01Z'), 30)).toThrow();
  });
  it('rejects overlapping unequal-start bookings and releases cancellation occupancy', async () => {
    const repository = new InMemoryRequestRepository();
    const first = await repository.create({ needId: 'need1', ownerId: 'owner1', professionalId: 'pro' });
    const second = await repository.create({ needId: 'need2', ownerId: 'owner2', professionalId: 'pro' });
    await repository.setStatus(first.id, 'accepted');
    await repository.setStatus(second.id, 'accepted');
    await repository.setSchedule(first.id, new Date('2030-01-01T03:15:00Z'), 60);
    await expect(repository.setSchedule(second.id, new Date('2030-01-01T03:45:00Z'), 30)).rejects.toBeInstanceOf(SlotConflictError);
    expect(await repository.setSchedule(second.id, new Date('2030-01-01T04:15:00Z'), 30)).not.toBeNull();
    await repository.setStatus(first.id, 'cancelled');
    expect(await repository.setSchedule(second.id, new Date('2030-01-01T03:15:00Z'), 60)).not.toBeNull();
    expect(await repository.setSchedule(first.id, new Date('2030-01-01T03:15:00Z'), 30)).toBeNull();
  });
});
