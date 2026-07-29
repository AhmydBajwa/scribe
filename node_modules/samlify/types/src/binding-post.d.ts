/**
 * @file binding-post.ts
 * @author tngan
 * @desc Binding-level API for SAML HTTP-POST. Builds base64 login/logout
 * request and response payloads that callers embed in an auto-submitting
 * HTML form.
 */
import type { BindingContext, RequestInfo, SAMLUser } from './types';
import type { IdentityProvider as Idp } from './entity-idp';
import type { ServiceProvider as Sp } from './entity-sp';
import type Entity from './entity';
/** Shape passed to builder functions that need both IdP and SP handles. */
interface PostIdpSpPair {
    idp: Idp;
    sp: Sp;
}
/** Shape passed to builder functions for logout (initiator + target). */
interface PostInitTargetPair {
    init: Entity;
    target: Entity;
}
/**
 * Generate a base64-encoded AuthnRequest for the HTTP-POST binding.
 *
 * @param referenceTagXPath XPath used when signing the request
 * @param entity `{ idp, sp }` handles
 * @param customTagReplacement optional custom template transformer
 * @param forceAuthn per-request `ForceAuthn` flag (saml-core §3.4.1)
 * @param assertionConsumerServiceIndex per-request ACS index (saml-core §3.4.1).
 *   Mutually exclusive with `AssertionConsumerServiceURL` / `ProtocolBinding`;
 *   when supplied, both of those attributes are dropped from the rendered XML.
 * @returns id / base64-XML pair
 */
declare function base64LoginRequest(referenceTagXPath: string, entity: PostIdpSpPair, customTagReplacement?: (template: string) => BindingContext, forceAuthn?: boolean, assertionConsumerServiceIndex?: number): BindingContext;
/**
 * Generate a base64-encoded login response for the HTTP-POST binding.
 * Supports the sign-then-encrypt and encrypt-then-sign pipelines based on
 * `encryptThenSign`.
 *
 * @param requestInfo parsed login request used to link `InResponseTo`
 * @param entity `{ idp, sp }` handles
 * @param user authenticated user
 * @param customTagReplacement optional custom template transformer
 * @param encryptThenSign when true, encrypt the assertion first then sign
 * @returns id / base64-XML pair
 */
declare function base64LoginResponse(requestInfo: (RequestInfo | {
    extract?: {
        request?: {
            id?: string;
        };
    };
}) | undefined, entity: PostIdpSpPair, user?: SAMLUser, customTagReplacement?: (template: string) => BindingContext, encryptThenSign?: boolean): Promise<BindingContext>;
/**
 * Generate a base64-encoded LogoutRequest for the HTTP-POST binding.
 *
 * @param user currently authenticated user
 * @param referenceTagXPath XPath used when signing the request
 * @param entity `{ init, target }` handles
 * @param customTagReplacement optional custom template transformer
 * @returns id / base64-XML pair
 */
declare function base64LogoutRequest(user: SAMLUser, referenceTagXPath: string, entity: PostInitTargetPair, customTagReplacement?: (template: string) => BindingContext): BindingContext;
/**
 * Generate a base64-encoded LogoutResponse for the HTTP-POST binding.
 *
 * @param requestInfo parsed request used to link `InResponseTo`
 * @param entity `{ init, target }` handles
 * @param customTagReplacement optional custom template transformer
 * @returns id / base64-XML pair
 */
declare function base64LogoutResponse(requestInfo: RequestInfo, entity: PostInitTargetPair, customTagReplacement?: (template: string) => BindingContext): BindingContext;
declare const postBinding: {
    base64LoginRequest: typeof base64LoginRequest;
    base64LoginResponse: typeof base64LoginResponse;
    base64LogoutRequest: typeof base64LogoutRequest;
    base64LogoutResponse: typeof base64LogoutResponse;
};
export default postBinding;
