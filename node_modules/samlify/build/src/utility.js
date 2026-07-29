"use strict";
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zipObject = zipObject;
exports.flattenDeep = flattenDeep;
exports.last = last;
exports.uniq = uniq;
exports.get = get;
exports.isString = isString;
exports.base64Decode = base64Decode;
exports.inflateString = inflateString;
exports.readPrivateKey = readPrivateKey;
exports.isNonEmptyArray = isNonEmptyArray;
exports.castArrayOpt = castArrayOpt;
exports.notEmpty = notEmpty;
exports.escapeXPathValue = escapeXPathValue;
exports.camelCase = camelCase;
/**
 * @file utility.ts
 * @author tngan
 * @desc Common helpers (encoding, compression, certificate / key handling).
 */
var crypto_1 = require("crypto");
var zlib_1 = require("zlib");
var BASE64_STR = 'base64';
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
function zipObject(arr1, arr2, skipDuplicated) {
    if (skipDuplicated === void 0) { skipDuplicated = true; }
    return arr1.reduce(function (res, l, i) {
        if (skipDuplicated) {
            res[l] = arr2[i];
            return res;
        }
        if (res[l] !== undefined) {
            res[l] = Array.isArray(res[l])
                ? res[l].concat(arr2[i])
                : [res[l]].concat(arr2[i]);
            return res;
        }
        res[l] = arr2[i];
        return res;
    }, {});
}
/**
 * Recursively flatten a nested array into a single-level array.
 *
 * @param input nested array input
 * @returns flattened array
 */
function flattenDeep(input) {
    return Array.isArray(input)
        ? input.reduce(function (a, b) { return a.concat(flattenDeep(b)); }, [])
        : [input];
}
/**
 * Return the last element of an array.
 *
 * @param input source array
 * @returns the final element, or undefined when the array is empty
 */
function last(input) {
    return input.slice(-1)[0];
}
/**
 * Return a copy of a string array with duplicates removed.
 *
 * @param input array with possible duplicates
 * @returns array in original order without duplicates
 */
function uniq(input) {
    var set = new Set(input);
    return __spreadArray([], __read(set), false);
}
/**
 * Safely read a dotted path from an object, returning `defaultValue` when
 * any segment is missing.
 *
 * @param obj source object
 * @param path dotted path expression (e.g. "a.b.c")
 * @param defaultValue fallback when the path does not resolve
 * @returns resolved value or the default
 */
function get(obj, path, defaultValue) {
    if (defaultValue === void 0) { defaultValue = null; }
    return path
        .split('.')
        .reduce(function (a, c) {
        if (a && typeof a === 'object' && c in a) {
            var next = a[c];
            return next !== null && next !== void 0 ? next : defaultValue;
        }
        return defaultValue;
    }, obj);
}
/**
 * Type guard for strings.
 *
 * @param input value to test
 * @returns true when the input is a string primitive
 */
function isString(input) {
    return typeof input === 'string';
}
/**
 * Encode a string or byte array as base64.
 *
 * @param message plain text or raw bytes
 * @returns base64 encoded string
 */
function base64Encode(message) {
    return Buffer.from(message).toString(BASE64_STR);
}
/**
 * Decode a base64 message. Returns either the decoded string or the raw
 * Buffer depending on `isBytes`.
 *
 * @param base64Message base64 encoded payload
 * @param isBytes when true, return a Buffer instead of a string
 * @returns decoded string or Buffer
 */
function base64Decode(base64Message, isBytes) {
    var bytes = Buffer.from(base64Message, BASE64_STR);
    return Boolean(isBytes) ? bytes : bytes.toString();
}
/**
 * Raw-deflate a UTF-8 string and return the compressed bytes.
 *
 * @param message plain text
 * @returns compressed bytes as a number array
 */
function deflateString(message) {
    var input = Buffer.from(message, 'utf8');
    return Array.from((0, zlib_1.deflateRawSync)(input));
}
/**
 * Raw-inflate a base64 string that was produced by {@link deflateString}.
 *
 * @param compressedString base64-encoded raw-deflate payload
 * @returns decompressed UTF-8 string
 */
function inflateString(compressedString) {
    var inputBuffer = Buffer.from(compressedString, BASE64_STR);
    return (0, zlib_1.inflateRawSync)(inputBuffer).toString('utf8');
}
/**
 * Strip PEM header/footer, whitespace and newlines from a PEM payload.
 */
function _normalizeCerString(bin, format) {
    return bin
        .toString()
        .replace(/\n/g, '')
        .replace(/\r/g, '')
        .replace("-----BEGIN ".concat(format, "-----"), '')
        .replace("-----END ".concat(format, "-----"), '')
        .replace(/ /g, '')
        .replace(/\t/g, '');
}
/**
 * Normalise a PEM certificate string to its base64 body.
 *
 * @param certString PEM-encoded X.509 certificate
 * @returns certificate body without headers/whitespace
 */
function normalizeCerString(certString) {
    return _normalizeCerString(certString, 'CERTIFICATE');
}
/**
 * Normalise a PEM RSA private key string to its base64 body.
 *
 * @param pemString PEM-encoded RSA private key
 * @returns key body without headers/whitespace
 */
function normalizePemString(pemString) {
    return _normalizeCerString(pemString.toString(), 'RSA PRIVATE KEY');
}
/**
 * Reconstruct the full URL (protocol + host + path) from an Express-style
 * HTTP request.
 *
 * @param req Express-compatible request object
 * @returns absolute URL string
 */
function getFullURL(req) {
    return "".concat(req.protocol, "://").concat(req.get('host')).concat(req.originalUrl);
}
/**
 * Return `str` when it is truthy, otherwise the provided default.
 */
function parseString(str, defaultValue) {
    if (defaultValue === void 0) { defaultValue = ''; }
    return str || defaultValue;
}
/**
 * Shallow-merge `obj2` on top of `obj1`, returning a new object.
 */
function applyDefault(obj1, obj2) {
    return Object.assign({}, obj1, obj2);
}
/**
 * Extract the SPKI PEM public key from a base64 X.509 certificate body.
 *
 * @param x509Certificate normalised certificate body (no PEM wrappers)
 * @returns PEM-encoded public key
 */
function getPublicKeyPemFromCertificate(x509Certificate) {
    var der = Buffer.from(x509Certificate, 'base64');
    var cert = new crypto_1.X509Certificate(der);
    return cert.publicKey.export({ type: 'spki', format: 'pem' });
}
/**
 * Read a PEM private key, optionally decrypting it with a passphrase.
 *
 * @param keyString PEM key contents
 * @param passphrase optional passphrase protecting the key
 * @param isOutputString when true, always return a string
 * @returns PEM key as string or Buffer
 */
function readPrivateKey(keyString, passphrase, isOutputString) {
    if (isString(passphrase)) {
        var key = (0, crypto_1.createPrivateKey)({ key: keyString, format: 'pem', passphrase: passphrase });
        var pem = key.export({ type: 'pkcs1', format: 'pem' });
        return convertToString(pem, isOutputString);
    }
    return keyString;
}
/**
 * Coerce a value to a string when `isOutputString` is true, otherwise pass
 * it through untouched.
 */
function convertToString(input, isOutputString) {
    return Boolean(isOutputString) ? String(input) : input;
}
/**
 * Check that the input is an array with at least one element.
 *
 * @param a candidate value
 * @returns true when the argument is a non-empty array
 */
function isNonEmptyArray(a) {
    return Array.isArray(a) && a.length > 0;
}
/**
 * Wrap a single value in an array, or return the array unchanged.
 * An undefined input returns an empty array.
 *
 * @param a scalar, array, or undefined
 * @returns array form of the input
 */
function castArrayOpt(a) {
    if (a === undefined)
        return [];
    return Array.isArray(a) ? a : [a];
}
/**
 * Type guard removing `null` and `undefined` from a union.
 *
 * @param value value to narrow
 * @returns true when the value is neither null nor undefined
 */
function notEmpty(value) {
    return value !== null && value !== undefined;
}
/**
 * Escape a string for safe use inside an XPath single-quoted string literal.
 * Prevents XPath injection by splitting on single quotes and using concat().
 *
 * @param value raw string that may contain quotes
 * @returns XPath-safe string expression
 */
function escapeXPathValue(value) {
    if (!value.includes("'")) {
        return "'" + value + "'";
    }
    var parts = value.split("'").map(function (part) { return "'" + part + "'"; });
    return 'concat(' + parts.join(",\"'\",") + ')';
}
/**
 * Convert a string to camelCase, splitting on whitespace, `-`, `_`, `.`,
 * and inferred case boundaries.
 *
 * @param input source string
 * @returns camelCased output
 */
function camelCase(input) {
    var words = input
        .replace(/([a-z\d])([A-Z])/g, '$1\0$2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1\0$2')
        .split(/[\0\s\-_\.]+/)
        .filter(function (w) { return w.length > 0; });
    return words
        .map(function (word, i) {
        var lower = word.toLocaleLowerCase('en-US');
        return i === 0 ? lower : lower.charAt(0).toLocaleUpperCase('en-US') + lower.slice(1);
    })
        .join('');
}
var utility = {
    isString: isString,
    base64Encode: base64Encode,
    base64Decode: base64Decode,
    deflateString: deflateString,
    inflateString: inflateString,
    normalizeCerString: normalizeCerString,
    normalizePemString: normalizePemString,
    getFullURL: getFullURL,
    parseString: parseString,
    applyDefault: applyDefault,
    getPublicKeyPemFromCertificate: getPublicKeyPemFromCertificate,
    readPrivateKey: readPrivateKey,
    convertToString: convertToString,
    isNonEmptyArray: isNonEmptyArray,
};
exports.default = utility;
//# sourceMappingURL=utility.js.map