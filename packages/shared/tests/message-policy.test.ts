import { describe, expect, it } from 'vitest';

import { hasContactInformation } from '../src/message-policy.js';

describe('chat contact information policy', () => {
  it('rejects numeric characters and English number words', () => {
    for (const message of ['Call me at 9876543210', 'my number is one two three', 'send two files', 'use १२३']) {
      expect(hasContactInformation(message), message).toBe(true);
    }
  });

  it('rejects email, web links, social handles and spelled-out email formats', () => {
    for (const message of ['write to ceo@example.com', 'visit https://example.com', 'my handle is @meraceo', 'name at gmail dot com']) {
      expect(hasContactInformation(message), message).toBe(true);
    }
  });

  it('allows ordinary messages that do not contain contact details or number words', () => {
    expect(hasContactInformation('Could you help us plan our next growth steps?')).toBe(false);
  });
});
