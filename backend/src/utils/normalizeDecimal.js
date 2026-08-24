const DECIMAL_PATTERN = /^-?\d+(?:\.(\d+))?$/;

export const normalizeDecimal = ({
  value,
  field,
  label,
  precision,
  scale,
  allowZero,
  details,
}) => {
  const rawValue = typeof value === 'number' ? String(value) : value;

  if (typeof rawValue !== 'string' || !DECIMAL_PATTERN.test(rawValue.trim())) {
    details.push({
      field,
      message: `${label} must be a decimal number with at most ${scale} decimal places.`,
    });
    return undefined;
  }

  const normalizedInput = rawValue.trim();
  const isNegative = normalizedInput.startsWith('-');
  const unsignedInput = isNegative ? normalizedInput.slice(1) : normalizedInput;
  const [rawWhole, rawFraction = ''] = unsignedInput.split('.');
  if (rawFraction.length > scale) {
    details.push({
      field,
      message: `${label} must have at most ${scale} decimal places.`,
    });
    return undefined;
  }

  const factor = 10n ** BigInt(scale);
  const fraction = rawFraction.padEnd(scale, '0');
  const scaledValue = BigInt(rawWhole) * factor + BigInt(fraction || '0');
  const maximumScaledValue = 10n ** BigInt(precision) - 1n;

  if (
    isNegative ||
    (!allowZero && scaledValue === 0n) ||
    scaledValue > maximumScaledValue
  ) {
    details.push({
      field,
      message: allowZero
        ? `${label} must be greater than or equal to zero and fit DECIMAL(${precision},${scale}).`
        : `${label} must be greater than zero and fit DECIMAL(${precision},${scale}).`,
    });
    return undefined;
  }

  return `${BigInt(rawWhole)}.${fraction}`;
};
