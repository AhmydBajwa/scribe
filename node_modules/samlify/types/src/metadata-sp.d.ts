/**
 * @file metadata-sp.ts
 * @author tngan
 * @desc Metadata of a service provider (SP). Accepts either a raw XML
 * document or a structured options object and presents a normalised API.
 */
import Metadata, { MetadataInterface } from './metadata';
import { MetadataSpConstructor } from './types';
/** Public interface exposed by SP metadata instances. */
export interface SpMetadataInterface extends MetadataInterface {
}
/**
 * Factory returning a new {@link SpMetadata} instance.
 *
 * @param meta XML metadata document or structured options
 * @returns fresh SpMetadata
 */
export default function (meta: MetadataSpConstructor): SpMetadata;
/**
 * SP metadata abstraction — constructs a valid EntityDescriptor/SPSSODescriptor
 * from options, and exposes inspection helpers used by the flow layer.
 */
export declare class SpMetadata extends Metadata {
    /**
     * Build SP metadata from XML or programmatic options.
     *
     * @param meta XML string/Buffer or {@link MetadataSpOptions}
     */
    constructor(meta: MetadataSpConstructor);
    /**
     * Return whether the SP requires signed assertions.
     */
    isWantAssertionsSigned(): boolean;
    /**
     * Return whether the SP signs its `AuthnRequest` messages.
     */
    isAuthnRequestSigned(): boolean;
    /**
     * Return the AssertionConsumerService endpoint URL(s) for the requested
     * binding.
     *
     * @param binding protocol binding key (`redirect`, `post`, etc.)
     * @returns endpoint URL, list of URLs, or raw service list
     */
    getAssertionConsumerService(binding: string): string | string[];
}
