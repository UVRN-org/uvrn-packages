/**
 * Strict canonical JSON serialization for new signed-byte producers.
 *
 * This module is intentionally environment-pure: no crypto, Node APIs, I/O, or package-local
 * runtime imports. Browser and worker consumers should import `@uvrn/core/canonical-serialize-2`.
 */

export const CANONICAL_SERIALIZATION_V2 = 'canonical-serialize-2' as const;

export type CanonicalSerializationErrorCode =
  | 'TOP_LEVEL_UNDEFINED'
  | 'NON_FINITE_NUMBER'
  | 'UNSUPPORTED_TYPE'
  | 'UNSUPPORTED_OBJECT';

/** Typed strict-input failure; callers may branch on `code` without parsing messages. */
export class CanonicalSerializationError extends TypeError {
  readonly code: CanonicalSerializationErrorCode;

  constructor(code: CanonicalSerializationErrorCode, message: string) {
    super(message);
    this.name = 'CanonicalSerializationError';
    this.code = code;
  }
}

/**
 * Serializes declared JSON input using the strict canonical-serialize-2 policy.
 *
 * - object keys are lexicographically sorted; undefined members are omitted
 * - dense undefined array elements and true sparse holes become JSON null
 * - top-level undefined, non-finite numbers, and non-JSON values are rejected
 */
export function canonicalSerializeV2(value: unknown): string {
  if (value === undefined) {
    throw new CanonicalSerializationError(
      'TOP_LEVEL_UNDEFINED',
      'canonical-serialize-2: top-level value must not be undefined'
    );
  }
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) {
        throw new CanonicalSerializationError(
          'NON_FINITE_NUMBER',
          'canonical-serialize-2: non-finite numbers are not allowed'
        );
      }
      return JSON.stringify(value);
    case 'undefined':
    case 'function':
    case 'symbol':
    case 'bigint':
      throw new CanonicalSerializationError(
        'UNSUPPORTED_TYPE',
        `canonical-serialize-2: cannot serialize a ${typeof value} value`
      );
    case 'object':
      break;
    default:
      throw new CanonicalSerializationError(
        'UNSUPPORTED_TYPE',
        `canonical-serialize-2: cannot serialize a ${typeof value} value`
      );
  }

  if (Array.isArray(value)) {
    const items: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const item = value[index];
      items.push(item === undefined ? 'null' : serialize(item));
    }
    return '[' + items.join(',') + ']';
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new CanonicalSerializationError(
      'UNSUPPORTED_OBJECT',
      'canonical-serialize-2: only plain JSON objects are supported'
    );
  }

  const record = value as Record<string, unknown>;
  const members: string[] = [];
  for (const key of Object.keys(record).sort()) {
    const member = record[key];
    if (member !== undefined) {
      members.push(JSON.stringify(key) + ':' + serialize(member));
    }
  }
  return '{' + members.join(',') + '}';
}
