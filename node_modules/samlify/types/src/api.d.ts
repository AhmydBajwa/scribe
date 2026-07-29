/**
 * @file api.ts
 * @author tngan
 * @desc Global module configuration: XML schema validator and DOM parser.
 */
import { DOMParser as Dom, Options as DOMParserOptions } from '@xmldom/xmldom';
/** Module-wide runtime configuration. */
interface Context extends ValidatorContext, DOMParserContext {
}
/** Caller-supplied SAML XML schema validator. */
interface ValidatorContext {
    validate?: (xml: string) => Promise<unknown>;
}
/** DOM parser used to decode SAML messages. */
interface DOMParserContext {
    dom: Dom;
}
/**
 * Return the module-wide runtime context (DOM parser and validator).
 *
 * @returns shared context object
 */
export declare function getContext(): Context;
/**
 * Register the caller-supplied SAML schema validator. Throws when the
 * supplied value does not expose a `validate` callback.
 *
 * @param params object with a `validate(xml)` callback
 */
export declare function setSchemaValidator(params: ValidatorContext): void;
/**
 * Replace the module-wide DOM parser with one configured by the caller.
 *
 * The XXE-safe error handlers are merged into the supplied options as a
 * baseline so callers can override unrelated settings without
 * accidentally disabling XXE protection (`saml-core §6.4`,
 * `saml-sec-consider §6.3.1`). A caller can still opt out by passing
 * its own `errorHandler`, but it must do so explicitly.
 *
 * @param options xmldom parser options
 */
export declare function setDOMParserOptions(options?: DOMParserOptions): void;
export {};
