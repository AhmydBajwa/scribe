/**
 * @file entity-sp.ts
 * @author tngan
 * @desc Service provider: builds login requests and parses inbound login
 * responses coming from an identity provider.
 */
import Entity from './entity';
import type { BindingContext, PostBindingContext, ESamlHttpRequest, SimpleSignBindingContext, IdentityProviderConstructor as IdentityProvider, ServiceProviderMetadata, ServiceProviderSettings, CreateLoginRequestOptions, CustomTagReplacement } from './types';
/**
 * Factory returning a new {@link ServiceProvider}. An SP can be built from
 * an XML metadata document or from a programmatic settings object.
 *
 * @param props SP settings
 */
export default function (props: ServiceProviderSettings): ServiceProvider;
/** Service-provider entity. */
export declare class ServiceProvider extends Entity {
    entityMeta: ServiceProviderMetadata;
    /**
     * Build an SP with sensible defaults for signing flags.
     *
     * @param spSetting SP settings object
     */
    constructor(spSetting: ServiceProviderSettings);
    /**
     * Build a login request targeting the supplied identity provider.
     *
     * The third parameter accepts either a callback (legacy shape) or an
     * options bag `{ relayState?, customTagReplacement? }`. Per
     * `saml-bindings §3.4.3 / §3.5.3`, RelayState is request-scoped — pass
     * it via the options bag instead of `entitySetting.relayState`.
     *
     * @param idp target identity provider
     * @param binding `redirect` (default), `post`, or `simpleSign`
     * @param optionsOrCallback per-request options or a custom-template callback
     */
    createLoginRequest(idp: IdentityProvider, binding?: string, optionsOrCallback?: CreateLoginRequestOptions | CustomTagReplacement): BindingContext | PostBindingContext | SimpleSignBindingContext;
    /**
     * Parse, validate and verify an inbound login response.
     *
     * @param idp identity provider that produced the response
     * @param binding `redirect`, `post`, or `simpleSign`
     * @param request HTTP request envelope
     */
    parseLoginResponse(idp: IdentityProvider, binding: string, request: ESamlHttpRequest): Promise<import("./flow").FlowResult>;
}
