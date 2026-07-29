import type { ExtractorFields } from './types';
/** Public interface exposed by every metadata instance. */
export interface MetadataInterface {
    xmlString: string;
    getMetadata: () => string;
    exportMetadata: (exportFile: string) => void;
    getEntityID: () => string;
    getX509Certificate: (certType: string) => string | string[];
    getNameIDFormat: () => string[];
    getSingleLogoutService: (binding: string | undefined) => string | object;
    getSupportBindings: (services: string[]) => string[];
}
/** Parsed metadata bag exposed under `meta`. */
export interface MetadataBag {
    [key: string]: unknown;
    entityDescriptor?: string | string[];
    entityID?: string;
    sharedCertificate?: string;
    certificate?: {
        signing?: string | string[];
        encryption?: string | string[];
    } | Record<string, string | string[]>;
    singleLogoutService?: Array<{
        binding: string;
        location: string;
    }> | {
        binding: string;
        location: string;
    };
    nameIDFormat?: string | string[];
}
export default class Metadata implements MetadataInterface {
    xmlString: string;
    meta: MetadataBag;
    /**
     * Parse a SAML metadata XML document and hydrate a typed `meta` bag.
     *
     * @param xml raw metadata XML (string or Buffer)
     * @param extraParse additional extractor fields merged into the standard set
     */
    constructor(xml: string | Buffer, extraParse?: ExtractorFields);
    /**
     * Return the underlying metadata XML.
     */
    getMetadata(): string;
    /**
     * Write the metadata XML to disk at the given path.
     *
     * @param exportFile absolute file path
     */
    exportMetadata(exportFile: string): void;
    /**
     * Return the metadata `entityID`.
     */
    getEntityID(): string;
    /**
     * Return the X.509 certificate(s) declared in metadata for a given use.
     *
     * @param use `signing` or `encryption`
     * @returns certificate body or list, or `null` when missing
     */
    getX509Certificate(use: string): string | string[];
    /**
     * Return the supported NameID formats declared in metadata.
     */
    getNameIDFormat(): string[];
    /**
     * Return the single-logout service endpoint for the requested binding.
     * When no binding is provided, returns the raw service list.
     *
     * @param binding `redirect`, `post`, etc.
     * @returns endpoint URL or raw service list
     */
    getSingleLogoutService(binding: string | undefined): string | object;
    /**
     * Reduce a service descriptor array to the list of bindings it declares.
     *
     * @param services list of service descriptor objects
     * @returns supported binding keys
     */
    getSupportBindings(services: string[]): string[];
}
