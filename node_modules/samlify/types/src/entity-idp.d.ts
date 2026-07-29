/**
 * @file entity-idp.ts
 * @author tngan
 * @desc Identity provider: builds login responses and parses inbound
 * login requests coming from a service provider.
 */
import Entity from './entity';
import type { BindingContext, ESamlHttpRequest, PostBindingContext, SimpleSignBindingContext, RequestInfo, SAMLUser, IdentityProviderSettings, IdentityProviderMetadata, ServiceProviderConstructor as ServiceProvider, CreateLoginResponseOptions, CustomTagReplacement } from './types';
/**
 * Factory returning a new {@link IdentityProvider}. An IdP can be built
 * from an XML metadata document or from a programmatic settings object.
 *
 * @param props IdP settings
 */
export default function (props: IdentityProviderSettings): IdentityProvider;
/** Identity-provider entity. */
export declare class IdentityProvider extends Entity {
    entityMeta: IdentityProviderMetadata;
    /**
     * Build an IdP, expanding `loginResponseTemplate.attributes` into a
     * pre-baked AttributeStatement template when supplied.
     */
    constructor(idpSetting: IdentityProviderSettings);
    /**
     * Build a login response for delivery to the supplied service provider.
     *
     * The fifth parameter accepts either a callback (legacy positional shape)
     * or an options bag `{ relayState?, customTagReplacement?, encryptThenSign? }`.
     * When the legacy shape is used, the trailing `legacyEncryptThenSign` and
     * `legacyRelayState` positional arguments are honoured. Per
     * `saml-bindings §3.4.3 / §3.5.3`, RelayState is request-scoped — pass it
     * via the options bag instead of `entitySetting.relayState`.
     *
     * @param sp target service provider
     * @param requestInfo parsed request used to set `InResponseTo`
     * @param binding `post`, `simpleSign`, or `redirect`
     * @param user authenticated user
     * @param optionsOrCallback per-request options or legacy custom-template callback
     * @param legacyEncryptThenSign legacy positional `encryptThenSign`; ignored when options bag is used
     * @param legacyRelayState legacy positional `relayState`; ignored when options bag is used
     */
    createLoginResponse(sp: ServiceProvider, requestInfo: RequestInfo, binding: string, user: SAMLUser, optionsOrCallback?: CreateLoginResponseOptions | CustomTagReplacement, legacyEncryptThenSign?: boolean, legacyRelayState?: string): Promise<BindingContext | PostBindingContext | SimpleSignBindingContext>;
    /**
     * Parse, validate and verify an inbound login request.
     *
     * @param sp service provider that produced the request
     * @param binding `redirect`, `post`, or `simpleSign`
     * @param req HTTP request envelope
     */
    parseLoginRequest(sp: ServiceProvider, binding: string, req: ESamlHttpRequest): Promise<import("./flow").FlowResult>;
}
