/**
 * @file libsaml.ts
 * @author tngan
 * @desc SAML primitives: templates, XML signing/verification, assertion
 * encryption/decryption, and XPath helpers used by the higher-level flows.
 */
import { MetadataInterface } from './metadata';
import { SigningSchemeHash } from 'node-rsa';
import type { EntitySetting, SignatureConfig, TagReplacementMap, XmlElementArray } from './types';
/** Options accepted by {@link LibSamlInterface.constructSAMLSignature}. */
export interface SignatureConstructor {
    rawSamlMessage: string;
    referenceTagXPath?: string;
    privateKey: string;
    privateKeyPass?: string;
    signatureAlgorithm: string;
    signingCert: string | Buffer;
    isBase64Output?: boolean;
    signatureConfig?: SignatureConfig;
    isMessageSigned?: boolean;
    transformationAlgorithms?: string[];
}
/** Options accepted by {@link LibSamlInterface.verifySignature}. */
export interface SignatureVerifierOptions {
    metadata?: MetadataInterface;
    keyFile?: string;
    signatureAlgorithm?: string;
}
/**
 * Generic extracted SAML result shape retained for backwards compatibility.
 * Prefer {@link import('./types').ExtractorResult} in new code.
 */
export interface ExtractorResult {
    [key: string]: unknown;
    signature?: string | string[];
    issuer?: string | string[];
    nameID?: string;
    notexist?: boolean;
}
/** Attribute configuration used when building an AttributeStatement. */
export interface LoginResponseAttribute {
    name: string;
    nameFormat: string;
    valueXsiType: string;
    valueTag: string;
    valueXmlnsXs?: string;
    valueXmlnsXsi?: string;
}
/** Overridable templates used when building a LoginResponse. */
export interface LoginResponseAdditionalTemplates {
    attributeStatementTemplate?: AttributeStatementTemplate;
    attributeTemplate?: AttributeTemplate;
}
/** Shared shape for all SAML document templates. */
export interface BaseSamlTemplate {
    context: string;
}
export interface LoginResponseTemplate extends BaseSamlTemplate {
    attributes?: LoginResponseAttribute[];
    additionalTemplates?: LoginResponseAdditionalTemplates;
}
export interface AttributeStatementTemplate extends BaseSamlTemplate {
}
export interface AttributeTemplate extends BaseSamlTemplate {
}
export interface LoginRequestTemplate extends BaseSamlTemplate {
}
export interface LogoutRequestTemplate extends BaseSamlTemplate {
}
export interface LogoutResponseTemplate extends BaseSamlTemplate {
}
/** Valid certificate `use` attribute values in metadata KeyDescriptor. */
export type KeyUse = 'signing' | 'encryption';
/** Shape of a KeyDescriptor element assembled by `createKeySection`. */
export interface KeyComponent {
    [key: string]: unknown;
    KeyDescriptor: XmlElementArray;
}
/** Structural shape of an Entity (IdP or SP) consumed by libsaml. */
export interface EntityLike {
    entitySetting: EntitySetting & {
        isAssertionEncrypted?: boolean;
        dataEncryptionAlgorithm?: string;
        keyEncryptionAlgorithm?: string;
        tagPrefix?: {
            protocol?: string;
            assertion?: string;
            encryptedAssertion?: string;
            [key: string]: string | undefined;
        };
        encPrivateKey?: string | Buffer;
        encPrivateKeyPass?: string | Buffer;
    };
    entityMeta: MetadataInterface;
}
/** Public surface exposed by the libsaml singleton. */
export interface LibSamlInterface {
    getQueryParamByType: (type: string) => string;
    createXPath: (local: string | {
        name: string;
        attr: string;
    }, isExtractAll?: boolean) => string;
    replaceTagsByValue: (rawXML: string, tagValues: TagReplacementMap) => string;
    attributeStatementBuilder: (attributes: LoginResponseAttribute[], attributeTemplate: AttributeTemplate, attributeStatementTemplate: AttributeStatementTemplate) => string;
    constructSAMLSignature: (opts: SignatureConstructor) => string;
    verifySignature: (xml: string, opts: SignatureVerifierOptions) => [boolean, string | null];
    createKeySection: (use: KeyUse, cert: string | Buffer) => KeyComponent;
    constructMessageSignature: (octetString: string, key: string, passphrase?: string, isBase64?: boolean, signingAlgorithm?: string) => string | Buffer;
    verifyMessageSignature: (metadata: MetadataInterface, octetString: string, signature: string | Buffer, verifyAlgorithm?: string) => boolean;
    getKeyInfo: (x509Certificate: string, signatureConfig?: SignatureConfig) => {
        getKeyInfo: () => string;
        getKey: () => string;
    };
    encryptAssertion: (sourceEntity: EntityLike, targetEntity: EntityLike, entireXML: string) => Promise<string>;
    decryptAssertion: (here: EntityLike, entireXML: string) => Promise<[string, string]>;
    getSigningScheme: (sigAlg: string) => SigningSchemeHash | null;
    getDigestMethod: (sigAlg: string) => string | null;
    nrsaAliasMapping: Record<string, SigningSchemeHash>;
    defaultLoginRequestTemplate: LoginRequestTemplate;
    defaultLoginResponseTemplate: LoginResponseTemplate;
    defaultAttributeStatementTemplate: AttributeStatementTemplate;
    defaultAttributeTemplate: AttributeTemplate;
    defaultLogoutRequestTemplate: LogoutRequestTemplate;
    defaultLogoutResponseTemplate: LogoutResponseTemplate;
}
declare const _default: {
    createXPath: (local: string | {
        name: string;
        attr: string;
    }, isExtractAll?: boolean) => string;
    getQueryParamByType: (type: string) => string;
    defaultLoginRequestTemplate: LoginRequestTemplate;
    defaultLoginResponseTemplate: LoginResponseTemplate;
    defaultAttributeStatementTemplate: AttributeStatementTemplate;
    defaultAttributeTemplate: AttributeTemplate;
    defaultLogoutRequestTemplate: LogoutRequestTemplate;
    defaultLogoutResponseTemplate: LogoutResponseTemplate;
    /**
     * Substitute `{Tag}` placeholders inside an XML template with the given
     * replacement map. Replacement text is XML-escaped in both attribute and
     * element-text positions to prevent SAML element/attribute injection.
     *
     * When a tag's value is `null` or `undefined`:
     *   - in **attribute position** (`name="{Tag}"`) the entire attribute is
     *     omitted from the rendered XML, per `saml-core §3.4.1` (every
     *     `<AuthnRequest>` attribute is `use="optional"`); previously samlify
     *     emitted `name=""` or the literal `name="undefined"`, which is
     *     invalid for typed attributes (e.g. `AssertionConsumerServiceURL`
     *     declared as `xs:anyURI`).
     *   - in **element-only-body position** (`<X>{Tag}</X>` or
     *     `<X attr="...">{Tag}</X>`) the entire element is dropped — per
     *     `saml-core §3.7.1` for `<samlp:SessionIndex>` and any other
     *     `minOccurs="0"` element where the body is solely a placeholder.
     *   - in **mixed-text position** (`<X>prefix{Tag}suffix</X>`) the
     *     placeholder is replaced with the empty string (legacy behaviour).
     *
     * @param rawXML template with `{Tag}` placeholders
     * @param tagValues replacement map keyed by tag name
     * @returns XML with placeholders resolved
     */
    replaceTagsByValue(rawXML: string, tagValues: TagReplacementMap): string;
    /**
     * Build a serialized `<AttributeStatement>` from attribute descriptors
     * by applying the attribute and statement templates.
     *
     * @param attributes attribute descriptors (name, format, value)
     * @param attributeTemplate per-attribute template
     * @param attributeStatementTemplate wrapping statement template
     * @returns serialized XML fragment
     */
    attributeStatementBuilder(attributes: LoginResponseAttribute[], attributeTemplate?: AttributeTemplate, attributeStatementTemplate?: AttributeStatementTemplate): string;
    /**
     * Compute an XML-DSig signature over the supplied SAML message. Can
     * sign the message root (`isMessageSigned`), a referenced subtree
     * (`referenceTagXPath`), or both.
     *
     * @param opts signature inputs and layout options
     * @returns base64 (default) or raw signed XML string
     */
    constructSAMLSignature(opts: SignatureConstructor): string;
    /**
     * Verify an XML-DSig signature on a SAML payload and, on success, return
     * the cryptographically authenticated assertion node.
     *
     * Defends against classic wrapping attacks by rejecting assertions that
     * appear inside a `SubjectConfirmationData` subtree.
     *
     * @param xml SAML message XML
     * @param opts metadata or key file plus signature algorithm
     * @returns tuple `[verified, authenticatedAssertion | null]`
     */
    verifySignature(xml: string, opts: SignatureVerifierOptions): [boolean, string | null];
    /**
     * Build the metadata `<KeyDescriptor>` fragment for a certificate use.
     *
     * @param use `signing` or `encryption`
     * @param certString PEM certificate body or Buffer
     * @returns element tree consumable by the `xml` module
     */
    createKeySection(use: KeyUse, certString: string | Buffer): KeyComponent;
    /**
     * Produce a detached RSA signature over a SAML redirect-binding octet
     * string. See SAML bindings spec §3.4.4.1.
     *
     * @param octetString canonical query-string to sign
     * @param key PEM private key
     * @param passphrase optional passphrase for the key
     * @param isBase64 when true (default), base64-encode the signature
     * @param signingAlgorithm signature algorithm URI
     * @returns base64 string (default) or raw Buffer signature
     */
    constructMessageSignature(octetString: string, key: string, passphrase?: string, isBase64?: boolean, signingAlgorithm?: string): string | Buffer;
    /**
     * Verify a detached RSA signature over a redirect-binding octet string.
     *
     * @param metadata peer metadata carrying the signing certificate
     * @param octetString canonical query-string that was signed
     * @param signature signature bytes
     * @param verifyAlgorithm signature algorithm URI (optional)
     * @returns true when the signature verifies
     */
    verifyMessageSignature(metadata: MetadataInterface, octetString: string, signature: string | Buffer, verifyAlgorithm?: string): boolean;
    /**
     * Build the KeyInfo XML fragment and PEM public key for a certificate.
     *
     * @param x509Certificate certificate body (no PEM wrappers)
     * @param signatureConfig optional prefix/location for the KeyInfo element
     */
    getKeyInfo(x509Certificate: string, signatureConfig?: SignatureConfig): {
        getKeyInfo: () => string;
        getKey: () => string;
    };
    /**
     * Encrypt the `<Assertion>` inside a SAML response using the target
     * entity's encryption certificate. Returns the base64-encoded XML
     * containing the `<EncryptedAssertion>` element in place of the plaintext.
     *
     * @param sourceEntity entity initiating the encryption (its settings drive the algorithms)
     * @param targetEntity entity whose certificate is used
     * @param xml response XML containing a single `<Assertion>`
     * @returns promise resolving to base64-encoded XML
     */
    encryptAssertion(sourceEntity: EntityLike, targetEntity: EntityLike, xml?: string): Promise<string>;
    /**
     * Decrypt the `<EncryptedAssertion>` inside a SAML response using the
     * local entity's private key. Returns both the decrypted document XML
     * and the raw assertion fragment for downstream extraction.
     *
     * @param here local entity performing decryption
     * @param entireXML SAML response XML containing `<EncryptedAssertion>`
     * @returns tuple `[decryptedDocumentXml, rawAssertionXml]`
     */
    decryptAssertion(here: EntityLike, entireXML: string): Promise<[string, string]>;
    /**
     * Validate the SAML XML against the registered schema validator. Throws
     * when no validator has been configured via {@link setSchemaValidator}
     * so consumers can't silently ship without schema checks.
     *
     * @param input SAML XML string
     */
    isValidXml(input: string): Promise<unknown>;
};
export default _default;
