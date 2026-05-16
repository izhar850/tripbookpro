
/**
 * Converts a numeric amount into words (Indian System)
 */
export function numberToWords(num: number): string {
  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'Zero';
  
  const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(val: number): string {
    if (val < 10) return single[val];
    if (val < 20) return double[val - 10];
    if (val < 100) return tens[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + single[val % 10] : '');
    if (val < 1000) return single[Math.floor(val / 100)] + ' Hundred' + (val % 100 !== 0 ? ' and ' + convert(val % 100) : '');
    return '';
  }

  function handleLarge(val: number): string {
    let res = '';
    let temp = val;
    
    if (temp >= 10000000) {
      res += convert(Math.floor(temp / 10000000)) + ' Crore ';
      temp %= 10000000;
    }
    if (temp >= 100000) {
      res += convert(Math.floor(temp / 100000)) + ' Lakh ';
      temp %= 100000;
    }
    if (temp >= 1000) {
      res += convert(Math.floor(temp / 1000)) + ' Thousand ';
      temp %= 1000;
    }
    if (temp > 0) {
      res += convert(temp);
    }
    return res.trim();
  }

  return handleLarge(n);
}

/**
 * Formats a number as Indian Currency (INR)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount);
}
