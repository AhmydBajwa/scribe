import type { BindingContext, RequestInfo, SAMLUser } from './types';
import type { IdentityProvider as Idp } from './entity-idp';
import type { ServiceProvider as Sp } from './entity-sp';
import type Entity from './entity';
/** Options consumed by {@link buildRedirectURL}. */
export interface BuildRedirectConfig {
    baseUrl: string;
    type: string;
    isSigned: boolean;
    context: string;
    entitySetting: {
        requestSignatureAlgorithm?: string;
        privateKey?: string | Buffer;
        privateKeyPass?: string;
    };
    relayState?: string;
}
/** Initiator/target entity pair used for logout redirects. */
interface RedirectInitTargetPair {
    init: Entity;
    target: Entity;
}
/**
 * Build a redirect URL carrying a SAML AuthnRequest.
 *
 * @param entity `{ idp, sp }` handles
 * @param customTagReplacement optional custom template transformer
 * @param relayState per-request RelayState; falls back to `entitySetting.relayState`
 * @param forceAuthn per-request `ForceAuthn` flag (saml-core §3.4.1)
 * @param assertionConsumerServiceIndex per-request ACS index (saml-core §3.4.1).
 *   Mutually exclusive with `AssertionConsumerServiceURL` / `ProtocolBinding`;
 *   when supplied, both of those attributes are dropped from the rendered XML.
 * @returns id + redirect URL wrapped in a {@link BindingContext}
 */
declare function loginRequestRedirectURL(entity: {
    idp: Idp;
    sp: Sp;
}, customTagReplacement?: (template: string) => BindingContext, relayState?: string, forceAuthn?: boolean, assertionConsumerServiceIndex?: number): BindingContext;
/**
 * Build a redirect URL carrying a SAML login Response.
 *
 * @param requestInfo parsed request used to link `InResponseTo`
 * @param entity `{ idp, sp }` handles
 * @param user authenticated user
 * @param relayState caller-supplied redirect URL
 * @param customTagReplacement optional custom template transformer
 * @returns id + redirect URL wrapped in a {@link BindingContext}
 */
declare function loginResponseRedirectURL(requestInfo: RequestInfo, entity: {
    idp: Idp;
    sp: Sp;
}, user?: SAMLUser, relayState?: string, customTagReplacement?: (template: string) => BindingContext): BindingContext;
/**
 * Build a redirect URL carrying a SAML LogoutRequest.
 *
 * @param user currently authenticated user
 * @param entity `{ init, target }` handles
 * @param relayState caller-supplied redirect URL
 * @param customTagReplacement optional custom template transformer
 * @returns id + redirect URL wrapped in a {@link BindingContext}
 */
declare function logoutRequestRedirectURL(user: SAMLUser, entity: RedirectInitTargetPair, relayState?: string, customTagReplacement?: (template: string, tags: object) => BindingContext): BindingContext;
/**
 * Build a redirect URL carrying a SAML LogoutResponse.
 *
 * @param requestInfo parsed request used to link `InResponseTo`
 * @param entity `{ init, target }` handles
 * @param relayState caller-supplied redirect URL
 * @param customTagReplacement optional custom template transformer
 * @returns id + redirect URL wrapped in a {@link BindingContext}
 */
declare function logoutResponseRedirectURL(requestInfo: RequestInfo, entity: RedirectInitTargetPair, relayState?: string, customTagReplacement?: (template: string) => BindingContext): BindingContext;
declare const redirectBinding: {
    loginRequestRedirectURL: typeof loginRequestRedirectURL;
    loginResponseRedirectURL: typeof loginResponseRedirectURL;
    logoutRequestRedirectURL: typeof logoutRequestRedirectURL;
    logoutResponseRedirectURL: typeof logoutResponseRedirectURL;
};
export default redirectBinding;
