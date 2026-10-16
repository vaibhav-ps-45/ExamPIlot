import { describe, expect, it } from 'vitest';
import { validateMock } from './mock-test-dialog';

const valid = {
  name: 'Full test 1',
  takenOn: '2026-10-10',
  totalMarks: '100',
  marksObtained: '62.5',
  durationMinutes: '180',
  notes: '',
  reviewed: false,
  sections: [{ name: 'Maths', totalMarks: '30', marksObtained: '20' }],
};

describe('validateMock', () => {
  it('accepts a complete result', () => {
    expect(validateMock(valid)).toEqual({});
  });

  it('requires a name, a date and both marks', () => {
    const errors = validateMock({ ...valid, name: ' ', takenOn: '', totalMarks: '', marksObtained: '' });
    expect(Object.keys(errors).sort()).toEqual(['marksObtained', 'name', 'takenOn', 'totalMarks']);
  });

  it('rejects scoring more than the total, for the test and for a section', () => {
    expect(validateMock({ ...valid, marksObtained: '101' }).marksObtained).toMatch(/more than the total/i);
    expect(validateMock({ ...valid, sections: [{ name: 'Maths', totalMarks: '30', marksObtained: '31' }] })['section-0']).toBeDefined();
  });

  it('rejects non-numeric marks and fractional minutes', () => {
    expect(validateMock({ ...valid, totalMarks: 'abc' }).totalMarks).toBeDefined();
    expect(validateMock({ ...valid, durationMinutes: '1.5' }).durationMinutes).toBeDefined();
  });

  it('allows a section total that differs from the test total (it only warns)', () => {
    expect(validateMock({ ...valid, sections: [{ name: 'Maths', totalMarks: '30', marksObtained: '20' }] })).toEqual({});
  });
});
