import { IdpMetadata as IdpMetadataConstructor } from './metadata-idp';
import { SpMetadata as SpMetadataConstructor } from './metadata-sp';
import type { MetadataIdpConstructor, MetadataSpConstructor, EntitySetting, ESamlHttpRequest, BindingContext, PostBindingContext, SimpleSignBindingContext, RequestInfo, SAMLUser, CreateLogoutRequestOptions, CreateLogoutResponseOptions, CustomTagReplacement } from './types';
export type { ESamlHttpRequest, BindingContext, PostBindingContext, SimpleSignBindingContext, SimpleSignComputedContext, ParseResult, } from './types';
/** Constructor argument shared by both SP and IdP factories. */
export type EntityConstructor = (MetadataIdpConstructor | MetadataSpConstructor) & {
    metadata?: string | Buffer;
};
export default class Entity {
    entitySetting: EntitySetting;
    entityType: string;
    entityMeta: IdpMetadataConstructor | SpMetadataConstructor;
    /**
     * Build an entity, merging the provided configuration with defaults and
     * hydrating the metadata abstraction for its role.
     *
     * @param entitySetting IdP or SP settings (metadata XML or options)
     * @param entityType `idp` or `sp`
     */
    constructor(entitySetting: EntityConstructor, entityType: 'idp' | 'sp');
    /**
     * Return the effective entity settings (defaults merged with overrides).
     */
    getEntitySetting(): EntitySetting;
    /**
     * Return the serialized metadata XML for this entity.
     */
    getMetadata(): string;
    /**
     * Persist the metadata XML to disk.
     *
     * @param exportFile absolute file path
     */
    exportMetadata(exportFile: string): void;
    /**
     * Equality check between a field value extracted from a SAML message and
     * the value declared in the peer's metadata. Arrays must match on every
     * entry.
     *
     * @param field value(s) from the inbound SAML message
     * @param metaField value from peer metadata
     * @returns true when every provided value equals `metaField`
     */
    verifyFields(field: string | string[], metaField: string): boolean;
    /**
     * Build a logout request targeting `targetEntity`. The return type depends
     * on the binding: `redirect` produces a URL; `post` and `simpleSign`
     * produce a base64 envelope (the latter with a detached signature).
     *
     * The fourth parameter accepts either a string (legacy `relayState`
     * positional shape) or an options bag `{ relayState?, customTagReplacement? }`.
     * Per `saml-bindings §3.4.3 / §3.5.3`, RelayState is request-scoped — pass
     * it via the options bag instead of `entitySetting.relayState`.
     *
     * @param targetEntity peer to receive the logout request
     * @param binding `redirect`, `post`, or `simpleSign`
     * @param user currently authenticated user
     * @param optionsOrRelayState per-request options or legacy RelayState string
     * @param legacyCustomTagReplacement optional custom template transformer (legacy positional form)
     */
    createLogoutRequest(targetEntity: Entity, binding: string, user: SAMLUser, optionsOrRelayState?: CreateLogoutRequestOptions | string, legacyCustomTagReplacement?: CustomTagReplacement): BindingContext | PostBindingContext | SimpleSignBindingContext;
    /**
     * Build a logout response to the peer that initiated logout.
     *
     * The fourth parameter accepts either a string (legacy `relayState`
     * positional shape) or an options bag `{ relayState?, customTagReplacement? }`.
     * Per `saml-bindings §3.4.3 / §3.5.3`, RelayState is request-scoped — pass
     * it via the options bag instead of `entitySetting.relayState`.
     *
     * @param target peer that sent the corresponding logout request
     * @param requestInfo parsed request used to link `InResponseTo`
     * @param binding `redirect`, `post`, or `simpleSign`
     * @param optionsOrRelayState per-request options or legacy RelayState string
     * @param legacyCustomTagReplacement optional custom template transformer (legacy positional form)
     */
    createLogoutResponse(target: Entity, requestInfo: RequestInfo, binding: string, optionsOrRelayState?: CreateLogoutResponseOptions | string, legacyCustomTagReplacement?: CustomTagReplacement): BindingContext | PostBindingContext | SimpleSignBindingContext;
    /**
     * Parse, validate and verify an inbound logout request.
     *
     * @param from peer entity that produced the request
     * @param binding `redirect`, `post`, or `simpleSign`
     * @param request HTTP request envelope
     */
    parseLogoutRequest(from: Entity, binding: string, request: ESamlHttpRequest): Promise<import("./flow").FlowResult>;
    /**
     * Parse, validate and verify an inbound logout response.
     *
     * @param from peer entity that produced the response
     * @param binding `redirect`, `post`, or `simpleSign`
     * @param request HTTP request envelope
     */
    parseLogoutResponse(from: Entity, binding: string, request: ESamlHttpRequest): Promise<import("./flow").FlowResult>;
}
