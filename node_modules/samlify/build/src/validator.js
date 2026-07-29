"use strict";
/**
 * @file validator.ts
 * @author tngan
 * @desc Time-window validators for SAML `NotBefore` / `NotOnOrAfter` conditions.
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTime = verifyTime;
/**
 * Check whether the current clock falls within the provided SAML time
 * window, applying a symmetric drift tolerance to both ends.
 *
 * Behaviour:
 *   - Both bounds missing: logs a warning and returns `true`.
 *   - Only `utcNotBefore` given: returns true when now is at or after it.
 *   - Only `utcNotOnOrAfter` given: returns true when now is strictly before it.
 *   - Both given: returns true only when both individual checks pass.
 *
 * @param utcNotBefore ISO-8601 lower bound (inclusive) or undefined
 * @param utcNotOnOrAfter ISO-8601 upper bound (exclusive) or undefined
 * @param drift tolerance applied to each bound, defaults to `[0, 0]`
 * @returns whether the current time is within the configured window
 */
function verifyTime(utcNotBefore, utcNotOnOrAfter, drift) {
    if (drift === void 0) { drift = [0, 0]; }
    var now = new Date();
    if (!utcNotBefore && !utcNotOnOrAfter) {
        console.warn("You intend to have time validation however the document doesn't include the valid range.");
        return true;
    }
    var _a = __read(drift, 2), notBeforeDrift = _a[0], notOnOrAfterDrift = _a[1];
    if (utcNotBefore && !utcNotOnOrAfter) {
        var notBeforeLocal_1 = new Date(utcNotBefore);
        return +notBeforeLocal_1 + notBeforeDrift <= +now;
    }
    if (!utcNotBefore && utcNotOnOrAfter) {
        var notOnOrAfterLocal_1 = new Date(utcNotOnOrAfter);
        return +now < +notOnOrAfterLocal_1 + notOnOrAfterDrift;
    }
    var notBeforeLocal = new Date(utcNotBefore);
    var notOnOrAfterLocal = new Date(utcNotOnOrAfter);
    return (+notBeforeLocal + notBeforeDrift <= +now &&
        +now < +notOnOrAfterLocal + notOnOrAfterDrift);
}
//# sourceMappingURL=validator.js.map