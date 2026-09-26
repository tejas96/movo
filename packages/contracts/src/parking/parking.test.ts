import { describe, expect, it } from 'vitest';
import { DialNumberSchema } from '../emergency/emergency.contract';
import { RegistrationNoSchema } from './parking.contract';

describe('vehicle registration', () => {
  it('normalises spacing, case and dashes', () => {
    expect(RegistrationNoSchema.parse(' mh 12 ab-1234 ')).toBe('MH12AB1234');
    expect(RegistrationNoSchema.parse('22BH1234AA')).toBe('22BH1234AA');
  });
  it('rejects too short or too long', () => {
    expect(RegistrationNoSchema.safeParse('ab').success).toBe(false);
    expect(RegistrationNoSchema.safeParse('MH12AB1234567890').success).toBe(false);
  });
});

describe('emergency dial numbers', () => {
  it('accepts short public numbers and full phones', () => {
    for (const n of ['112', '101', '+91 98765 43210', '020-2612-3456'])
      expect(DialNumberSchema.safeParse(n).success).toBe(true);
  });
  it('rejects letters', () => {
    expect(DialNumberSchema.safeParse('call me').success).toBe(false);
  });
});
