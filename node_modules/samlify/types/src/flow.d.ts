import type { ESamlHttpRequest, ExtractorResult } from './types';
import type Entity from './entity';
import { ParserType } from './urn';
/** Result emitted by the flow dispatcher for successful inbound messages. */
export interface FlowResult {
    samlContent: string;
    extract: ExtractorResult;
    sigAlg?: string | null;
}
/** Options consumed by {@link flow} and its internal dispatch helpers. */
export interface FlowOptions {
    request: ESamlHttpRequest;
    parserType: ParserType | string;
    self: Entity;
    from: Entity;
    checkSignature?: boolean;
    type: 'login' | 'logout';
    binding: string;
    supportBindings?: string[];
}
/**
 * Entry point: dispatch an inbound SAML message to the matching binding
 * handler based on `options.binding`.
 *
 * @param options flow inputs (request, parserType, entities, binding)
 * @returns resolved {@link FlowResult} on success
 */
export declare function flow(options: FlowOptions): Promise<FlowResult>;
