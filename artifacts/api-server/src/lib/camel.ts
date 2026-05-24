function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function camelize<T = Record<string, unknown>>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[toCamelCase(key)] = obj[key];
  }
  return result as T;
}

export function camelizeArr<T = Record<string, unknown>>(arr: Record<string, unknown>[]): T[] {
  return arr.map(o => camelize<T>(o));
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, c => `_${c.toLowerCase()}`);
}

export function snakify(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      result[toSnakeCase(key)] = obj[key];
    }
  }
  return result;
}
