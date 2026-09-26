'use strict';

jest.mock('../../src/config/database', () => ({ query: jest.fn(), connect: jest.fn() }));

const sra = require('../../src/services/hipaaSraService');

function q(overrides) {
  return { level: 'required', answer: null, severity: null, addressable_decision: null, ...overrides };
}

describe('hipaaSraService', () => {
  it('classifies requirement level from the title and safeguard from the citation', () => {
    expect(sra.levelFor('Risk Analysis (Required)')).toBe('required');
    expect(sra.levelFor('Automatic Logoff (Addressable)')).toBe('addressable');
    expect(sra.levelFor('Audit Controls')).toBe('standard');
    expect(sra.safeguardFor('HIPAA-164.312(a)(2)(iii)')).toBe('technical');
    expect(sra.safeguardFor('HIPAA-164.310(d)(2)(i)')).toBe('physical');
  });

  it('answers specifications, or the standard itself when it has none', () => {
    const safeguards = [{
      id: 'technical',
      label: 'Technical',
      standards: [
        { ...q({ id: 's1' }), answerable: false, specifications: [q({ id: 'a' }), q({ id: 'b' })] },
        { ...q({ id: 's2' }), answerable: true, specifications: [] }
      ]
    }];
    expect(sra.answerableQuestions(safeguards).map((x) => x.id)).toEqual(['a', 'b', 's2']);
  });

  it('summarizes progress, required gaps and missing addressable decisions', () => {
    const safeguards = [{
      id: 'technical',
      label: 'Technical',
      standards: [{
        answerable: false,
        specifications: [
          q({ answer: 'not_implemented', severity: 'high' }),
          q({ level: 'addressable', answer: 'partially_implemented', severity: 'medium' }),
          q({ level: 'addressable', answer: 'not_applicable', addressable_decision: 'not_reasonable' }),
          q({ answer: 'implemented' }),
          q({})
        ]
      }]
    }];
    const summary = sra.summarize(safeguards);
    expect(summary).toEqual(expect.objectContaining({
      total: 5, answered: 4, percent_complete: 80, gaps: 2, required_gaps: 1, undecided_addressable: 1
    }));
    expect(summary.risk_bands).toEqual({ low: 0, medium: 1, high: 1, critical: 0 });
  });
});
