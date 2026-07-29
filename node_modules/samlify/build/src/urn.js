"use strict";
/**
* @file urn.ts
* @author tngan
* @desc  Includes all keywords need in samlify
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageConfigurations = exports.elementsOrder = exports.wording = exports.algorithms = exports.tags = exports.namespace = exports.ParserType = exports.StatusCode = exports.MessageSignatureOrder = exports.BindingNamespace = void 0;
var BindingNamespace;
(function (BindingNamespace) {
    BindingNamespace["Redirect"] = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect";
    BindingNamespace["Post"] = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST";
    BindingNamespace["SimpleSign"] = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST-SimpleSign";
    BindingNamespace["Artifact"] = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Artifact";
})(BindingNamespace || (exports.BindingNamespace = BindingNamespace = {}));
var MessageSignatureOrder;
(function (MessageSignatureOrder) {
    MessageSignatureOrder["STE"] = "sign-then-encrypt";
    MessageSignatureOrder["ETS"] = "encrypt-then-sign";
})(MessageSignatureOrder || (exports.MessageSignatureOrder = MessageSignatureOrder = {}));
var StatusCode;
(function (StatusCode) {
    // top-tier
    StatusCode["Success"] = "urn:oasis:names:tc:SAML:2.0:status:Success";
    StatusCode["Requester"] = "urn:oasis:names:tc:SAML:2.0:status:Requester";
    StatusCode["Responder"] = "urn:oasis:names:tc:SAML:2.0:status:Responder";
    StatusCode["VersionMismatch"] = "urn:oasis:names:tc:SAML:2.0:status:VersionMismatch";
    // second-tier to provide more information
    StatusCode["AuthFailed"] = "urn:oasis:names:tc:SAML:2.0:status:AuthnFailed";
    StatusCode["InvalidAttrNameOrValue"] = "urn:oasis:names:tc:SAML:2.0:status:InvalidAttrNameOrValue";
    StatusCode["InvalidNameIDPolicy"] = "urn:oasis:names:tc:SAML:2.0:status:InvalidNameIDPolicy";
    StatusCode["NoAuthnContext"] = "urn:oasis:names:tc:SAML:2.0:status:NoAuthnContext";
    StatusCode["NoAvailableIDP"] = "urn:oasis:names:tc:SAML:2.0:status:NoAvailableIDP";
    StatusCode["NoPassive"] = "urn:oasis:names:tc:SAML:2.0:status:NoPassive";
    StatusCode["NoSupportedIDP"] = "urn:oasis:names:tc:SAML:2.0:status:NoSupportedIDP";
    StatusCode["PartialLogout"] = "urn:oasis:names:tc:SAML:2.0:status:PartialLogout";
    StatusCode["ProxyCountExceeded"] = "urn:oasis:names:tc:SAML:2.0:status:ProxyCountExceeded";
    StatusCode["RequestDenied"] = "urn:oasis:names:tc:SAML:2.0:status:RequestDenied";
    StatusCode["RequestUnsupported"] = "urn:oasis:names:tc:SAML:2.0:status:RequestUnsupported";
    StatusCode["RequestVersionDeprecated"] = "urn:oasis:names:tc:SAML:2.0:status:RequestVersionDeprecated";
    StatusCode["RequestVersionTooHigh"] = "urn:oasis:names:tc:SAML:2.0:status:RequestVersionTooHigh";
    StatusCode["RequestVersionTooLow"] = "urn:oasis:names:tc:SAML:2.0:status:RequestVersionTooLow";
    StatusCode["ResourceNotRecognized"] = "urn:oasis:names:tc:SAML:2.0:status:ResourceNotRecognized";
    StatusCode["TooManyResponses"] = "urn:oasis:names:tc:SAML:2.0:status:TooManyResponses";
    StatusCode["UnknownAttrProfile"] = "urn:oasis:names:tc:SAML:2.0:status:UnknownAttrProfile";
    StatusCode["UnknownPrincipal"] = "urn:oasis:names:tc:SAML:2.0:status:UnknownPrincipal";
    StatusCode["UnsupportedBinding"] = "urn:oasis:names:tc:SAML:2.0:status:UnsupportedBinding";
})(StatusCode || (exports.StatusCode = StatusCode = {}));
var namespace = {
    binding: {
        redirect: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
        post: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        simpleSign: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST-SimpleSign',
        artifact: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Artifact',
    },
    names: {
        protocol: 'urn:oasis:names:tc:SAML:2.0:protocol',
        assertion: 'urn:oasis:names:tc:SAML:2.0:assertion',
        metadata: 'urn:oasis:names:tc:SAML:2.0:metadata',
        userLogout: 'urn:oasis:names:tc:SAML:2.0:logout:user',
        adminLogout: 'urn:oasis:names:tc:SAML:2.0:logout:admin',
    },
    authnContextClassRef: {
        password: 'urn:oasis:names:tc:SAML:2.0:ac:classes:Password',
        passwordProtectedTransport: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport',
    },
    format: {
        emailAddress: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        persistent: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
        transient: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
        entity: 'urn:oasis:names:tc:SAML:2.0:nameid-format:entity',
        unspecified: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
        kerberos: 'urn:oasis:names:tc:SAML:2.0:nameid-format:kerberos',
        windowsDomainQualifiedName: 'urn:oasis:names:tc:SAML:1.1:nameid-format:WindowsDomainQualifiedName',
        x509SubjectName: 'urn:oasis:names:tc:SAML:1.1:nameid-format:X509SubjectName',
    },
    statusCode: {
        // permissible top-level status codes
        success: 'urn:oasis:names:tc:SAML:2.0:status:Success',
        requester: 'urn:oasis:names:tc:SAML:2.0:status:Requester',
        responder: 'urn:oasis:names:tc:SAML:2.0:status:Responder',
        versionMismatch: 'urn:oasis:names:tc:SAML:2.0:status:VersionMismatch',
        // second-level status codes
        authFailed: 'urn:oasis:names:tc:SAML:2.0:status:AuthnFailed',
        invalidAttrNameOrValue: 'urn:oasis:names:tc:SAML:2.0:status:InvalidAttrNameOrValue',
        invalidNameIDPolicy: 'urn:oasis:names:tc:SAML:2.0:status:InvalidNameIDPolicy',
        noAuthnContext: 'urn:oasis:names:tc:SAML:2.0:status:NoAuthnContext',
        noAvailableIDP: 'urn:oasis:names:tc:SAML:2.0:status:NoAvailableIDP',
        noPassive: 'urn:oasis:names:tc:SAML:2.0:status:NoPassive',
        noSupportedIDP: 'urn:oasis:names:tc:SAML:2.0:status:NoSupportedIDP',
        partialLogout: 'urn:oasis:names:tc:SAML:2.0:status:PartialLogout',
        proxyCountExceeded: 'urn:oasis:names:tc:SAML:2.0:status:ProxyCountExceeded',
        requestDenied: 'urn:oasis:names:tc:SAML:2.0:status:RequestDenied',
        requestUnsupported: 'urn:oasis:names:tc:SAML:2.0:status:RequestUnsupported',
        requestVersionDeprecated: 'urn:oasis:names:tc:SAML:2.0:status:RequestVersionDeprecated',
        requestVersionTooHigh: 'urn:oasis:names:tc:SAML:2.0:status:RequestVersionTooHigh',
        requestVersionTooLow: 'urn:oasis:names:tc:SAML:2.0:status:RequestVersionTooLow',
        resourceNotRecognized: 'urn:oasis:names:tc:SAML:2.0:status:ResourceNotRecognized',
        tooManyResponses: 'urn:oasis:names:tc:SAML:2.0:status:TooManyResponses',
        unknownAttrProfile: 'urn:oasis:names:tc:SAML:2.0:status:UnknownAttrProfile',
        unknownPrincipal: 'urn:oasis:names:tc:SAML:2.0:status:UnknownPrincipal',
        unsupportedBinding: 'urn:oasis:names:tc:SAML:2.0:status:UnsupportedBinding',
    },
};
exports.namespace = namespace;
var tags = {
    request: {
        AllowCreate: '{AllowCreate}',
        AssertionConsumerServiceURL: '{AssertionConsumerServiceURL}',
        AuthnContextClassRef: '{AuthnContextClassRef}',
        AssertionID: '{AssertionID}',
        Audience: '{Audience}',
        AuthnStatement: '{AuthnStatement}',
        AttributeStatement: '{AttributeStatement}',
        ConditionsNotBefore: '{ConditionsNotBefore}',
        ConditionsNotOnOrAfter: '{ConditionsNotOnOrAfter}',
        Destination: '{Destination}',
        EntityID: '{EntityID}',
        ID: '{ID}',
        Issuer: '{Issuer}',
        IssueInstant: '{IssueInstant}',
        InResponseTo: '{InResponseTo}',
        NameID: '{NameID}',
        NameIDFormat: '{NameIDFormat}',
        ProtocolBinding: '{ProtocolBinding}',
        SessionIndex: '{SessionIndex}',
        SubjectRecipient: '{SubjectRecipient}',
        SubjectConfirmationDataNotOnOrAfter: '{SubjectConfirmationDataNotOnOrAfter}',
        StatusCode: '{StatusCode}',
    },
    xmlTag: {
        loginRequest: 'AuthnRequest',
        logoutRequest: 'LogoutRequest',
        loginResponse: 'Response',
        logoutResponse: 'LogoutResponse',
    },
};
exports.tags = tags;
var messageConfigurations = {
    signingOrder: {
        SIGN_THEN_ENCRYPT: 'sign-then-encrypt',
        ENCRYPT_THEN_SIGN: 'encrypt-then-sign',
    },
};
exports.messageConfigurations = messageConfigurations;
var algorithms = {
    signature: {
        RSA_SHA1: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
        RSA_SHA256: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
        RSA_SHA512: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512',
        // RSASSA-PSS with MGF1 — `xmldsig-core §6.4.2`, `xmldsig-more` (W3C
        // Note, 2007-05). Recommended over PKCS#1 v1.5 for new deployments
        // per `saml-sec-consider §6.5` and the audit follow-up F-7
        // (`.skills/audits/2026-04-security-audit.md`). The default signing
        // algorithm remains RSA-SHA256 (PKCS#1 v1.5); PSS is opt-in.
        RSA_SHA256_MGF1: 'http://www.w3.org/2007/05/xmldsig-more#sha256-rsa-MGF1',
    },
    encryption: {
        data: {
            AES_128: 'http://www.w3.org/2001/04/xmlenc#aes128-cbc',
            AES_256: 'http://www.w3.org/2001/04/xmlenc#aes256-cbc',
            TRI_DEC: 'http://www.w3.org/2001/04/xmlenc#tripledes-cbc',
            AES_128_GCM: 'http://www.w3.org/2009/xmlenc11#aes128-gcm'
        },
        key: {
            RSA_OAEP_MGF1P: 'http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p',
            RSA_1_5: 'http://www.w3.org/2001/04/xmlenc#rsa-1_5',
        },
    },
    digest: {
        'http://www.w3.org/2000/09/xmldsig#rsa-sha1': 'http://www.w3.org/2000/09/xmldsig#sha1',
        'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256': 'http://www.w3.org/2001/04/xmlenc#sha256',
        'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512': 'http://www.w3.org/2001/04/xmlenc#sha512', // support hashing algorithm sha512 in xml-crypto after 0.8.0
        // PSS variant — `xmldsig-more` (2007-05) — pairs with the SHA-256
        // digest URI per the OASIS-published mapping.
        'http://www.w3.org/2007/05/xmldsig-more#sha256-rsa-MGF1': 'http://www.w3.org/2001/04/xmlenc#sha256',
    },
};
exports.algorithms = algorithms;
var ParserType;
(function (ParserType) {
    ParserType["SAMLRequest"] = "SAMLRequest";
    ParserType["SAMLResponse"] = "SAMLResponse";
    ParserType["LogoutRequest"] = "LogoutRequest";
    ParserType["LogoutResponse"] = "LogoutResponse";
})(ParserType || (exports.ParserType = ParserType = {}));
var wording = {
    urlParams: {
        samlRequest: 'SAMLRequest',
        samlResponse: 'SAMLResponse',
        logoutRequest: 'LogoutRequest',
        logoutResponse: 'LogoutResponse',
        sigAlg: 'SigAlg',
        signature: 'Signature',
        relayState: 'RelayState',
    },
    binding: {
        redirect: 'redirect',
        post: 'post',
        simpleSign: 'simpleSign',
        artifact: 'artifact',
    },
    certUse: {
        signing: 'signing',
        encrypt: 'encryption',
    },
    metadata: {
        sp: 'metadata-sp',
        idp: 'metadata-idp',
    },
};
exports.wording = wording;
// https://wiki.shibboleth.net/confluence/display/CONCEPT/MetadataForSP
// some idps restrict the order of elements in entity descriptors.
//
// Top-level keys (default / onelogin / shibboleth) describe SP-side
// orderings and are kept at the root for backwards compatibility with
// callers that read `Constants.elementsOrder.shibboleth` directly.
//
// IdP-side orderings live under the `idp` sub-key. The default sequence
// matches `saml-metadata §2.4.3` (the schema-declared `<IDPSSODescriptor>`
// child sequence) restricted to the elements samlify currently emits.
var elementsOrder = {
    default: ['KeyDescriptor', 'NameIDFormat', 'SingleLogoutService', 'AssertionConsumerService'],
    onelogin: ['KeyDescriptor', 'NameIDFormat', 'SingleLogoutService', 'AssertionConsumerService'],
    shibboleth: ['KeyDescriptor', 'SingleLogoutService', 'NameIDFormat', 'AssertionConsumerService', 'AttributeConsumingService'],
    idp: {
        // Default mirrors the historical (pre-#429) emission order so callers
        // that don't supply `elementsOrder` continue to receive byte-identical
        // metadata XML. saml-metadata §2.4.3 permits this subset.
        default: ['KeyDescriptor', 'NameIDFormat', 'SingleSignOnService', 'SingleLogoutService'],
        // OneLogin-style: NameIDFormat ahead of the service endpoints.
        onelogin: ['KeyDescriptor', 'NameIDFormat', 'SingleLogoutService', 'SingleSignOnService'],
        // Shibboleth IdP convention puts SLO ahead of NameIDFormat.
        shibboleth: ['KeyDescriptor', 'SingleLogoutService', 'NameIDFormat', 'SingleSignOnService'],
    },
};
exports.elementsOrder = elementsOrder;
//# sourceMappingURL=urn.js.map