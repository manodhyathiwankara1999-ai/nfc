import { describe, expect, it } from 'vitest';
import { superAdminEmailForUsername } from './seed';

describe('super-admin seed identity', () => {
  it('maps usernames to a reserved synthetic email deterministically', () => {
    expect(superAdminEmailForUsername(' Root.Admin ')).toBe(
      'super-admin.root.admin@internal.nfc-ecard.invalid',
    );
    expect(superAdminEmailForUsername('root.admin')).toBe(superAdminEmailForUsername('ROOT.ADMIN'));
  });

  it('rejects usernames outside the supported character and length rules', () => {
    expect(() => superAdminEmailForUsername('x')).toThrow();
    expect(() => superAdminEmailForUsername('not a username')).toThrow();
    expect(() => superAdminEmailForUsername('x'.repeat(65))).toThrow();
  });
});
