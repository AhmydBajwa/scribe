/**
 * @file options.ts
 * @desc Backwards-compatible discriminators for the options-bag /
 * legacy-positional shapes accepted by the create* methods on
 * Entity / IdentityProvider / ServiceProvider.
 *
 * Per `saml-bindings §3.4.3, §3.5.3`, RelayState is request-scoped.
 * These helpers let callers pass it as part of an options bag while
 * preserving the legacy callback-only / string-only positional shapes.
 */
import type { CreateLoginRequestOptions, CreateLoginResponseOptions, CreateLogoutRequestOptions, CreateLogoutResponseOptions, CustomTagReplacement } from './types';
/**
 * Resolve the 3rd-position parameter of `ServiceProvider#createLoginRequest`.
 * Accepts a callback (legacy), an options bag, or undefined.
 */
export declare function normalizeCreateLoginRequestOptions(input: CreateLoginRequestOptions | CustomTagReplacement | undefined): CreateLoginRequestOptions;
/**
 * Resolve the 5th-position parameter of `IdentityProvider#createLoginResponse`.
 * Accepts a callback (legacy), an options bag, or undefined.
 *
 * Legacy positional `encryptThenSign` (6th) and `relayState` (7th) are
 * folded into the bag when the 5th argument is the legacy callback form.
 */
export declare function normalizeCreateLoginResponseOptions(optionsOrCallback: CreateLoginResponseOptions | CustomTagReplacement | undefined, legacyEncryptThenSign?: boolean, legacyRelayState?: string): CreateLoginResponseOptions;
/**
 * Resolve the 4th-position parameter of `Entity#createLogoutRequest`.
 * Accepts a string (legacy `relayState`), an options bag, or undefined.
 *
 * Legacy positional `customTagReplacement` (5th) is folded into the bag
 * when the 4th argument is the legacy string form.
 */
export declare function normalizeCreateLogoutRequestOptions(optionsOrRelayState: CreateLogoutRequestOptions | string | undefined, legacyCustomTagReplacement?: CustomTagReplacement): CreateLogoutRequestOptions;
/**
 * Resolve the 4th-position parameter of `Entity#createLogoutResponse`.
 * Same dispatch rules as {@link normalizeCreateLogoutRequestOptions}.
 */
export declare function normalizeCreateLogoutResponseOptions(optionsOrRelayState: CreateLogoutResponseOptions | string | undefined, legacyCustomTagReplacement?: CustomTagReplacement): CreateLogoutResponseOptions;
