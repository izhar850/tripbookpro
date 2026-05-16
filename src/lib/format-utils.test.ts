
import { describe, it, expect } from 'vitest';
import { numberToWords } from './format-utils';

describe('numberToWords utility', () => {
  it('should convert single digits correctly', () => {
    expect(numberToWords(1)).toBe('One');
    expect(numberToWords(5)).toBe('Five');
    expect(numberToWords(9)).toBe('Nine');
  });

  it('should handle zero correctly', () => {
    expect(numberToWords(0)).toBe('Zero');
  });

  it('should convert tens correctly', () => {
    expect(numberToWords(10)).toBe('Ten');
    expect(numberToWords(15)).toBe('Fifteen');
    expect(numberToWords(25)).toBe('Twenty Five');
  });

  it('should convert hundreds correctly', () => {
    expect(numberToWords(100)).toBe('One Hundred');
    expect(numberToWords(105)).toBe('One Hundred and Five');
    expect(numberToWords(150)).toBe('One Hundred and Fifty');
  });

  it('should convert thousands correctly', () => {
    expect(numberToWords(1000)).toBe('One Thousand');
    expect(numberToWords(5500)).toBe('Five Thousand Five Hundred');
    expect(numberToWords(10000)).toBe('Ten Thousand');
  });

  it('should handle Lakhs correctly (Indian System)', () => {
    expect(numberToWords(100000)).toBe('One Lakh');
    expect(numberToWords(250000)).toBe('Two Lakh Fifty Thousand');
  });

  it('should handle Crores correctly (Indian System)', () => {
    expect(numberToWords(10000000)).toBe('One Crore');
    expect(numberToWords(150000000)).toBe('Fifteen Crore');
  });

  it('should handle large complex numbers', () => {
    expect(numberToWords(1234567)).toBe('Twelve Lakh Thirty Four Thousand Five Hundred and Sixty Seven');
  });
});
