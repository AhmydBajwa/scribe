/**
 * @file metadata-idp.ts
 * @author tngan
 * @desc Metadata of an identity provider (IdP). Accepts either a raw XML
 * document or a structured options object and presents a normalised API.
 */
import Metadata, { MetadataInterface } from './metadata';
import { MetadataIdpConstructor } from './types';
/** Public interface exposed by IdP metadata instances. */
export interface IdpMetadataInterface extends MetadataInterface {
}
/**
 * Factory returning a new {@link IdpMetadata} instance.
 *
 * @param meta XML metadata document or structured options
 * @returns fresh IdpMetadata
 */
export default function (meta: MetadataIdpConstructor): IdpMetadata;
export declare class IdpMetadata extends Metadata {
    /**
     * Build IdP metadata from XML or programmatic options.
     *
     * @param meta XML string/Buffer or {@link MetadataIdpOptions}
     */
    constructor(meta: MetadataIdpConstructor);
    /**
     * Return whether the IdP requires signed `AuthnRequest` messages.
     *
     * @returns true when the metadata advertises `WantAuthnRequestsSigned="true"`
     */
    isWantAuthnRequestsSigned(): boolean;
    /**
     * Return the single sign-on endpoint URL for the given binding, or the
     * full service map when the binding isn't a string.
     *
     * @param binding protocol binding key (`redirect`, `post`, etc.)
     * @returns endpoint URL or raw service map
     */
    getSingleSignOnService(binding: string): string | object;
}
