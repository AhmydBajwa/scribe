/**
 * Build an object by zipping two parallel arrays of keys and values.
 * When `skipDuplicated` is false, colliding keys are aggregated into arrays
 * so duplicate keys do not clobber earlier values.
 *
 * @param arr1 key array
 * @param arr2 value array (same index as keys)
 * @param skipDuplicated when true (default) later writes overwrite earlier ones
 * @returns object composed from key/value pairs
 */
export declare function zipObject<T>(arr1: string[], arr2: T[], skipDuplicated?: boolean): Record<string, T | T[]>;
/**
 * Recursively flatten a nested array into a single-level array.
 *
 * @param input nested array input
 * @returns flattened array
 */
export declare function flattenDeep<T>(input: T | T[]): T[];
/**
 * Return the last element of an array.
 *
 * @param input source array
 * @returns the final element, or undefined when the array is empty
 */
export declare function last<T>(input: T[]): T;
/**
 * Return a copy of a string array with duplicates removed.
 *
 * @param input array with possible duplicates
 * @returns array in original order without duplicates
 */
export declare function uniq(input: string[]): string[];
/**
 * Safely read a dotted path from an object, returning `defaultValue` when
 * any segment is missing.
 *
 * @param obj source object
 * @param path dotted path expression (e.g. "a.b.c")
 * @param defaultValue fallback when the path does not resolve
 * @returns resolved value or the default
 */
export declare function get<T = unknown>(obj: Record<string, unknown> | null | undefined, path: string, defaultValue?: T | null): T | null;
/**
 * Type guard for strings.
 *
 * @param input value to test
 * @returns true when the input is a string primitive
 */
export declare function isString(input: unknown): input is string;
/**
 * Encode a string or byte array as base64.
 *
 * @param message plain text or raw bytes
 * @returns base64 encoded string
 */
declare function base64Encode(message: string | number[]): string;
/**
 * Decode a base64 message. Returns either the decoded string or the raw
 * Buffer depending on `isBytes`.
 *
 * @param base64Message base64 encoded payload
 * @param isBytes when true, return a Buffer instead of a string
 * @returns decoded string or Buffer
 */
export declare function base64Decode(base64Message: string, isBytes?: boolean): string | Buffer;
/**
 * Raw-deflate a UTF-8 string and return the compressed bytes.
 *
 * @param message plain text
 * @returns compressed bytes as a number array
 */
declare function deflateString(message: string): number[];
/**
 * Raw-inflate a base64 string that was produced by {@link deflateString}.
 *
 * @param compressedString base64-encoded raw-deflate payload
 * @returns decompressed UTF-8 string
 */
export declare function inflateString(compressedString: string): string;
/**
 * Normalise a PEM certificate string to its base64 body.
 *
 * @param certString PEM-encoded X.509 certificate
 * @returns certificate body without headers/whitespace
 */
declare function normalizeCerString(certString: string | Buffer): string;
/**
 * Normalise a PEM RSA private key string to its base64 body.
 *
 * @param pemString PEM-encoded RSA private key
 * @returns key body without headers/whitespace
 */
declare function normalizePemString(pemString: string | Buffer): string;
/**
 * Reconstruct the full URL (protocol + host + path) from an Express-style
 * HTTP request.
 *
 * @param req Express-compatible request object
 * @returns absolute URL string
 */
declare function getFullURL(req: {
    protocol: string;
    get: (name: string) => string | undefined;
    originalUrl: string;
}): string;
/**
 * Return `str` when it is truthy, otherwise the provided default.
 */
declare function parseString(str: string | undefined | null, defaultValue?: string): string;
/**
 * Shallow-merge `obj2` on top of `obj1`, returning a new object.
 */
declare function applyDefault<A extends object, B extends object>(obj1: A, obj2: B): A & B;
/**
 * Extract the SPKI PEM public key from a base64 X.509 certificate body.
 *
 * @param x509Certificate normalised certificate body (no PEM wrappers)
 * @returns PEM-encoded public key
 */
declare function getPublicKeyPemFromCertificate(x509Certificate: string): string | Buffer;
/**
 * Read a PEM private key, optionally decrypting it with a passphrase.
 *
 * @param keyString PEM key contents
 * @param passphrase optional passphrase protecting the key
 * @param isOutputString when true, always return a string
 * @returns PEM key as string or Buffer
 */
export declare function readPrivateKey(keyString: string | Buffer, passphrase: string | undefined, isOutputString?: boolean): string | Buffer;
/**
 * Coerce a value to a string when `isOutputString` is true, otherwise pass
 * it through untouched.
 */
declare function convertToString(input: string | Buffer, isOutputString?: boolean): string | Buffer;
/**
 * Check that the input is an array with at least one element.
 *
 * @param a candidate value
 * @returns true when the argument is a non-empty array
 */
export declare function isNonEmptyArray<T>(a: unknown): a is T[];
/**
 * Wrap a single value in an array, or return the array unchanged.
 * An undefined input returns an empty array.
 *
 * @param a scalar, array, or undefined
 * @returns array form of the input
 */
export declare function castArrayOpt<T>(a?: T | T[]): T[];
/**
 * Type guard removing `null` and `undefined` from a union.
 *
 * @param value value to narrow
 * @returns true when the value is neither null nor undefined
 */
export declare function notEmpty<TValue>(value: TValue | null | undefined): value is TValue;
/**
 * Escape a string for safe use inside an XPath single-quoted string literal.
 * Prevents XPath injection by splitting on single quotes and using concat().
 *
 * @param value raw string that may contain quotes
 * @returns XPath-safe string expression
 */
export declare function escapeXPathValue(value: string): string;
/**
 * Convert a string to camelCase, splitting on whitespace, `-`, `_`, `.`,
 * and inferred case boundaries.
 *
 * @param input source string
 * @returns camelCased output
 */
export declare function camelCase(input: string): string;
declare const utility: {
    isString: typeof isString;
    base64Encode: typeof base64Encode;
    base64Decode: typeof base64Decode;
    deflateString: typeof deflateString;
    inflateString: typeof inflateString;
    normalizeCerString: typeof normalizeCerString;
    normalizePemString: typeof normalizePemString;
    getFullURL: typeof getFullURL;
    parseString: typeof parseString;
    applyDefault: typeof applyDefault;
    getPublicKeyPemFromCertificate: typeof getPublicKeyPemFromCertificate;
    readPrivateKey: typeof readPrivateKey;
    convertToString: typeof convertToString;
    isNonEmptyArray: typeof isNonEmptyArray;
};
export default utility;
