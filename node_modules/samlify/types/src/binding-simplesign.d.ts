/**
 * @file binding-simplesign.ts
 * @author Orange
 * @desc Binding-level API for SAML HTTP-POST-SimpleSign. Produces base64
 * payloads alongside a detached signature over the canonical octet string.
 */
import type { BindingContext, SimpleSignComputedContext, RequestInfo, SAMLUser } from './types';
import type { IdentityProvider as Idp } from './entity-idp';
import type { ServiceProvider as Sp } from './entity-sp';
import type Entity from './entity';
/** Options consumed by {@link buildSimpleSignature}. */
export interface BuildSimpleSignConfig {
    type: string;
    context: string;
    entitySetting: {
        requestSignatureAlgorithm?: string;
        privateKey?: string | Buffer;
        privateKeyPass?: string;
    };
    relayState?: string;
}
/** Return value for login-response building with simple signatures. */
export interface BindingSimpleSignContext {
    id: string;
    context: string;
    signature: string | Buffer;
    sigAlg: string;
}
/** `{ idp, sp }` handle used by simple-sign builders. */
interface SimpleSignIdpSpPair {
    idp: Idp;
    sp: Sp;
}
/** `{ init, target }` handle used by simple-sign logout builders. */
interface SimpleSignInitTargetPair {
    init: Entity;
    target: Entity;
}
/**
 * Generate a base64-encoded AuthnRequest together with a detached simple
 * signature when the IdP advertises `WantAuthnRequestsSigned`.
 *
 * @param entity `{ idp, sp }` handles
 * @param customTagReplacement optional custom template transformer
 * @param relayState per-request RelayState; falls back to `entitySetting.relayState`
 * @param forceAuthn per-request `ForceAuthn` flag (saml-core §3.4.1)
 * @param assertionConsumerServiceIndex per-request ACS index (saml-core §3.4.1).
 *   Mutually exclusive with `AssertionConsumerServiceURL` / `ProtocolBinding`;
 *   when supplied, both of those attributes are dropped from the rendered XML.
 */
declare function base64LoginRequest(entity: SimpleSignIdpSpPair, customTagReplacement?: (template: string) => BindingContext, relayState?: string, forceAuthn?: boolean, assertionConsumerServiceIndex?: number): SimpleSignComputedContext;
/**
 * Generate a base64-encoded login response together with a detached simple
 * signature. Login responses are always signed under this binding.
 *
 * @param requestInfo parsed request used to link `InResponseTo`
 * @param entity `{ idp, sp }` handles
 * @param user authenticated user
 * @param relayState caller-supplied redirect URL
 * @param customTagReplacement optional custom template transformer
 */
declare function base64LoginResponse(requestInfo: (RequestInfo | {
    extract?: {
        request?: {
            id?: string;
        };
    };
}) | undefined, entity: SimpleSignIdpSpPair, user?: SAMLUser, relayState?: string, customTagReplacement?: (template: string) => BindingContext): Promise<BindingSimpleSignContext>;
/**
 * Generate a base64-encoded LogoutRequest together with a detached simple
 * signature when the receiving entity requires signed logout requests.
 *
 * @param user currently authenticated user
 * @param entity `{ init, target }` handles
 * @param relayState caller-supplied redirect URL
 * @param customTagReplacement optional custom template transformer
 */
declare function base64LogoutRequest(user: SAMLUser, entity: SimpleSignInitTargetPair, relayState?: string, customTagReplacement?: (template: string) => BindingContext): SimpleSignComputedContext;
/**
 * Generate a base64-encoded LogoutResponse together with a detached simple
 * signature when the receiving entity requires signed logout responses.
 *
 * @param requestInfo parsed request used to link `InResponseTo`
 * @param entity `{ init, target }` handles
 * @param relayState caller-supplied redirect URL
 * @param customTagReplacement optional custom template transformer
 */
declare function base64LogoutResponse(requestInfo: RequestInfo, entity: SimpleSignInitTargetPair, relayState?: string, customTagReplacement?: (template: string) => BindingContext): SimpleSignComputedContext;
declare const simpleSignBinding: {
    base64LoginRequest: typeof base64LoginRequest;
    base64LoginResponse: typeof base64LoginResponse;
    base64LogoutRequest: typeof base64LogoutRequest;
    base64LogoutResponse: typeof base64LogoutResponse;
};
export default simpleSignBinding;
