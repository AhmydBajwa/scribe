"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCreateLoginRequestOptions = normalizeCreateLoginRequestOptions;
exports.normalizeCreateLoginResponseOptions = normalizeCreateLoginResponseOptions;
exports.normalizeCreateLogoutRequestOptions = normalizeCreateLogoutRequestOptions;
exports.normalizeCreateLogoutResponseOptions = normalizeCreateLogoutResponseOptions;
/**
 * Resolve the 3rd-position parameter of `ServiceProvider#createLoginRequest`.
 * Accepts a callback (legacy), an options bag, or undefined.
 */
function normalizeCreateLoginRequestOptions(input) {
    if (input == null)
        return {};
    if (typeof input === 'function')
        return { customTagReplacement: input };
    return input;
}
/**
 * Resolve the 5th-position parameter of `IdentityProvider#createLoginResponse`.
 * Accepts a callback (legacy), an options bag, or undefined.
 *
 * Legacy positional `encryptThenSign` (6th) and `relayState` (7th) are
 * folded into the bag when the 5th argument is the legacy callback form.
 */
function normalizeCreateLoginResponseOptions(optionsOrCallback, legacyEncryptThenSign, legacyRelayState) {
    if (optionsOrCallback == null) {
        return { encryptThenSign: legacyEncryptThenSign, relayState: legacyRelayState };
    }
    if (typeof optionsOrCallback === 'function') {
        return {
            customTagReplacement: optionsOrCallback,
            encryptThenSign: legacyEncryptThenSign,
            relayState: legacyRelayState,
        };
    }
    return optionsOrCallback;
}
/**
 * Resolve the 4th-position parameter of `Entity#createLogoutRequest`.
 * Accepts a string (legacy `relayState`), an options bag, or undefined.
 *
 * Legacy positional `customTagReplacement` (5th) is folded into the bag
 * when the 4th argument is the legacy string form.
 */
function normalizeCreateLogoutRequestOptions(optionsOrRelayState, legacyCustomTagReplacement) {
    if (optionsOrRelayState == null) {
        return { customTagReplacement: legacyCustomTagReplacement };
    }
    if (typeof optionsOrRelayState === 'string') {
        return {
            relayState: optionsOrRelayState,
            customTagReplacement: legacyCustomTagReplacement,
        };
    }
    return optionsOrRelayState;
}
/**
 * Resolve the 4th-position parameter of `Entity#createLogoutResponse`.
 * Same dispatch rules as {@link normalizeCreateLogoutRequestOptions}.
 */
function normalizeCreateLogoutResponseOptions(optionsOrRelayState, legacyCustomTagReplacement) {
    if (optionsOrRelayState == null) {
        return { customTagReplacement: legacyCustomTagReplacement };
    }
    if (typeof optionsOrRelayState === 'string') {
        return {
            relayState: optionsOrRelayState,
            customTagReplacement: legacyCustomTagReplacement,
        };
    }
    return optionsOrRelayState;
}
//# sourceMappingURL=options.js.map