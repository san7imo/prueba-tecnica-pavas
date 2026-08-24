const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const INTEGER_FORMATTER = new Intl.NumberFormat('es-CO');

const parseDecimal = (value) => {
  const normalized = String(value ?? '0').trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return { negative: false, digits: 0n, scale: 0 };

  const fraction = match[3] ?? '';
  return {
    negative: match[1] === '-',
    digits: BigInt(`${match[2]}${fraction}`),
    scale: fraction.length,
  };
};

const roundToCents = ({ negative, digits, scale }) => {
  if (scale <= 2) {
    return {
      negative,
      cents: digits * 10n ** BigInt(2 - scale),
    };
  }

  const divisor = 10n ** BigInt(scale - 2);
  const quotient = digits / divisor;
  const remainder = digits % divisor;
  return {
    negative,
    cents: quotient + (remainder * 2n >= divisor ? 1n : 0n),
  };
};

export const multiplyDecimals = (left, right) => {
  const first = parseDecimal(left);
  const second = parseDecimal(right);
  const digits = first.digits * second.digits;
  const scale = first.scale + second.scale;
  const sign = first.negative !== second.negative && digits !== 0n ? '-' : '';

  if (scale === 0) return `${sign}${digits}`;

  const padded = digits.toString().padStart(scale + 1, '0');
  return `${sign}${padded.slice(0, -scale)}.${padded.slice(-scale)}`;
};

export const formatCurrency = (value) => {
  const { negative, cents } = roundToCents(parseDecimal(value));
  const major = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  const sign = negative && cents !== 0n ? '-' : '';
  return `${sign}$\u00a0${INTEGER_FORMATTER.format(major)},${fraction}`;
};

export const formatDateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : DATE_TIME_FORMATTER.format(date);
};
