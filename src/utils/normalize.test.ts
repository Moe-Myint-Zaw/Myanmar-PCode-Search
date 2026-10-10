import { normalizeSearchTerm } from './normalize';

describe('normalizeSearchTerm', () => {
  it('normalizes case, spacing, and punctuation', () => {
    expect(normalizeSearchTerm('  Yangon-Region! ')).toBe('yangon region');
  });

  it('preserves Myanmar letters while normalizing the string', () => {
    expect(normalizeSearchTerm('ရန်ကုန် မြို့')).toBe('ရန်ကုန် မြို့');
  });
});