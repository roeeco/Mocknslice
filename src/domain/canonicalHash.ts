function stable(value: unknown, path = '$'): string {
  if (value === null) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} must be finite.`);
    return JSON.stringify(value);
  }
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry, index) => stable(entry, `${path}[${index}]`)).join(',')}]`;
  }
  if (typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => {
        const entry = (value as Record<string, unknown>)[key];
        if (entry === undefined) throw new TypeError(`${path}.${key} cannot be undefined.`);
        return `${JSON.stringify(key)}:${stable(entry, `${path}.${key}`)}`;
      })
      .join(',')}}`;
  }
  throw new TypeError(`${path} is not serializable.`);
}

export function hashSerializable(value: unknown): string {
  let hash = 2166136261;
  for (const character of stable(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `sf9-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
