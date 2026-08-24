const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/;
const MULTIPLIERS = Object.freeze({ ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 });

export const parseDurationMs = (value, name = 'Duration') => {
  const match = typeof value === 'string' ? value.match(DURATION_PATTERN) : null;
  if (!match) {
    throw new Error(`${name} must use a positive duration such as 15m or 7d.`);
  }

  const duration = Number(match[1]) * MULTIPLIERS[match[2]];
  if (!Number.isSafeInteger(duration) || duration <= 0) {
    throw new Error(`${name} is outside the supported range.`);
  }
  return duration;
};
