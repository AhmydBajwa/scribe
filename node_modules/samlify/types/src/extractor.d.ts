import type { ExtractorField, ExtractorFields, ExtractorResult } from './types';
export type { ExtractorField, ExtractorFields, ExtractorResult } from './types';
/** Default extractor fields for an inbound `AuthnRequest` (login request). */
export declare const loginRequestFields: ExtractorFields;
/** Two-tier status code extractor for login responses. */
export declare const loginResponseStatusFields: ExtractorFields;
/** Two-tier status code extractor for logout responses. */
export declare const logoutResponseStatusFields: ExtractorFields;
/**
 * Build the login-response extractor bound to a particular assertion XML.
 * Assertion-scoped fields are re-rooted at the assertion fragment via the
 * `shortcut` mechanism so that wrapping attacks can't redirect extraction.
 *
 * @param assertion XML string of the (verified) assertion node
 * @returns extractor fields ready for `extract`
 */
export declare const loginResponseFields: (assertion: string) => ExtractorFields;
/** Default extractor fields for an inbound `LogoutRequest`. */
export declare const logoutRequestFields: ExtractorFields;
/** Default extractor fields for an inbound `LogoutResponse`. */
export declare const logoutResponseFields: ExtractorFields;
/**
 * Evaluate the given extractor fields against an XML document and return
 * a flat object keyed by `field.key`. Handles:
 *   - multi-path localPaths (`string[][]`) collected with `|`
 *   - parent/child attribute aggregation (`index` + `attributePath`)
 *   - whole-subtree extraction (`context: true`)
 *   - single/multiple/zero-attribute text extraction
 *
 * @param context XML string to parse
 * @param fields extractor field definitions
 * @returns extracted SAML values keyed by field name
 */
export declare function extract(context: string, fields: ExtractorField[]): ExtractorResult;
