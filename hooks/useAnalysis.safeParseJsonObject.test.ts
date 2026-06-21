import { safeParseJsonObject } from './useAnalysis';

describe('safeParseJsonObject', () => {
  it('parses valid json object correctly', () => {
    expect(safeParseJsonObject('{"a": 1}')).toEqual({ a: 1 });
  });

  it('strips markdown code fences before parsing', () => {
    expect(safeParseJsonObject('```json\n{"b": 2}\n```')).toEqual({ b: 2 });
    expect(safeParseJsonObject('```\n{"c": 3}\n```')).toEqual({ c: 3 });
  });

  it('returns empty object for invalid json', () => {
    expect(safeParseJsonObject('invalid json string')).toEqual({});
  });

  it('returns empty object for non-object JSON values', () => {
    expect(safeParseJsonObject('[1, 2, 3]')).toEqual({});
    expect(safeParseJsonObject('"string"')).toEqual({});
    expect(safeParseJsonObject('42')).toEqual({});
    expect(safeParseJsonObject('true')).toEqual({});
    expect(safeParseJsonObject('null')).toEqual({});
  });
});
