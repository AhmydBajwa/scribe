"use strict";
/**
 * @file libsaml.ts
 * @author tngan
 * @desc SAML primitives: templates, XML signing/verification, assertion
 * encryption/decryption, and XPath helpers used by the higher-level flows.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var utility_1 = __importStar(require("./utility"));
var urn_1 = require("./urn");
var xpath_1 = require("xpath");
var node_rsa_1 = __importDefault(require("node-rsa"));
var xml_crypto_1 = require("xml-crypto");
var xmlenc = __importStar(require("@authenio/xml-encryption"));
var api_1 = require("./api");
var xml_escape_1 = __importDefault(require("xml-escape"));
var crypto = __importStar(require("crypto"));
var fs = __importStar(require("fs"));
var signatureAlgorithms = urn_1.algorithms.signature;
var digestAlgorithms = urn_1.algorithms.digest;
var certUse = urn_1.wording.certUse;
var urlParams = urn_1.wording.urlParams;
/** Coerce the heterogeneous return of `xpath.select` into a Node array. */
function toNodeArray(result) {
    if (Array.isArray(result))
        return result;
    if (result != null && typeof result === 'object' && 'nodeType' in result) {
        return [result];
    }
    return [];
}
var libSaml = function () {
    /**
     * Map a SAML URL parameter type onto its canonical query-string key
     * (`SAMLRequest` or `SAMLResponse`).
     *
     * @param type SAML URL parameter name
     * @returns `SAMLRequest` or `SAMLResponse`
     */
    function getQueryParamByType(type) {
        if ([urlParams.logoutRequest, urlParams.samlRequest].indexOf(type) !== -1) {
            return 'SAMLRequest';
        }
        if ([urlParams.logoutResponse, urlParams.samlResponse].indexOf(type) !== -1) {
            return 'SAMLResponse';
        }
        throw new Error('ERR_UNDEFINED_QUERY_PARAMS');
    }
    /**
     * Mapping from XML-DSig signature algorithm URIs to node-rsa schemes.
     *
     * The PSS entry covers the redirect-binding detached signature path:
     * `node-rsa` accepts `pss-sha256` directly as a `signingScheme` value.
     * The `xmldsig-more#sha256-rsa-MGF1` URI (W3C Note, 2007-05) is listed
     * in `xmldsig-core §6.4.2` as the recommended successor to PKCS#1 v1.5
     * RSA-SHA256 (`saml-sec-consider §6.5`).
     */
    var nrsaAliasMapping = {
        'http://www.w3.org/2000/09/xmldsig#rsa-sha1': 'pkcs1-sha1',
        'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256': 'pkcs1-sha256',
        'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512': 'pkcs1-sha512',
        'http://www.w3.org/2007/05/xmldsig-more#sha256-rsa-MGF1': 'pss-sha256',
    };
    /**
     * RSASSA-PSS plugin class for `xml-crypto`'s `SignedXml.SignatureAlgorithms`
     * registry (`xmldsig-core §6.4.2`).
     *
     * **Temporary shim.** xml-crypto already implements PSS-SHA256 on its
     * master branch (PR node-saml/xml-crypto#488, merged 2025-10-17), but
     * the latest published npm version (6.1.2, 2024-08) predates that
     * commit. Once xml-crypto cuts a release containing #488, delete this
     * class and the `registerPssAlgorithms` helper below — the URI alone
     * in `algorithms.signature` is sufficient and the constructor will
     * seed `SignatureAlgorithms` with the upstream implementation.
     *
     * `RSA_PKCS1_PSS_PADDING` with `RSA_PSS_SALTLEN_DIGEST` matches the
     * MGF1+SHA-256 convention referenced by the `sha256-rsa-MGF1` URI
     * (xmldsig-more, W3C Note 2007-05).
     */
    var pssPaddingOptions = {
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    };
    var RsaSha256Mgf1 = /** @class */ (function () {
        function RsaSha256Mgf1() {
            this.getSignature = function (signedInfo, privateKey) {
                var signOpts = {
                    key: privateKey,
                    padding: pssPaddingOptions.padding,
                    saltLength: pssPaddingOptions.saltLength,
                };
                return crypto.sign('RSA-SHA256', Buffer.from(signedInfo), signOpts).toString('base64');
            };
            this.verifySignature = function (material, key, signatureValue) {
                var verifyOpts = {
                    key: key,
                    padding: pssPaddingOptions.padding,
                    saltLength: pssPaddingOptions.saltLength,
                };
                return crypto.verify('RSA-SHA256', Buffer.from(material), verifyOpts, Buffer.from(signatureValue, 'base64'));
            };
            this.getAlgorithmName = function () { return 'http://www.w3.org/2007/05/xmldsig-more#sha256-rsa-MGF1'; };
        }
        return RsaSha256Mgf1;
    }());
    /**
     * Register the RSASSA-PSS SHA-256 signature class on a fresh `SignedXml`
     * instance so the algorithm-agility surface from `xmldsig-core §6.4` is
     * available for both signing and verification. PKCS#1 v1.5 entries are
     * preserved untouched.
     */
    function registerPssAlgorithms(sig) {
        sig.SignatureAlgorithms = __assign(__assign({}, sig.SignatureAlgorithms), { 'http://www.w3.org/2007/05/xmldsig-more#sha256-rsa-MGF1': RsaSha256Mgf1 });
    }
    /**
     * Default AuthnRequest XML template.
     *
     * Per saml-core §3.4.1, `ProtocolBinding`, `AssertionConsumerServiceURL`,
     * and `AssertionConsumerServiceIndex` are all `use="optional"` and
     * mutually exclusive — when the index is set, neither URL nor
     * ProtocolBinding may be present. All three are placeholders here so
     * that `replaceTagsByValue` drops whichever the caller leaves
     * undefined (closes #437).
     */
    var defaultLoginRequestTemplate = {
        context: '<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="{ID}" Version="2.0" ForceAuthn="{ForceAuthn}" IssueInstant="{IssueInstant}" Destination="{Destination}" ProtocolBinding="{ProtocolBinding}" AssertionConsumerServiceURL="{AssertionConsumerServiceURL}" AssertionConsumerServiceIndex="{AssertionConsumerServiceIndex}"><saml:Issuer>{Issuer}</saml:Issuer><samlp:NameIDPolicy Format="{NameIDFormat}" AllowCreate="{AllowCreate}"/></samlp:AuthnRequest>',
    };
    /**
     * Default LogoutRequest XML template.
     *
     * The optional `<samlp:SessionIndex>` element (saml-core §3.7.1) is
     * included with a placeholder body. When the caller leaves
     * `user.sessionIndex` undefined, `replaceTagsByValue` drops the whole
     * element from the rendered XML, matching the schema's
     * `minOccurs="0"` declaration.
     */
    var defaultLogoutRequestTemplate = {
        context: '<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="{ID}" Version="2.0" IssueInstant="{IssueInstant}" Destination="{Destination}"><saml:Issuer>{Issuer}</saml:Issuer><saml:NameID Format="{NameIDFormat}">{NameID}</saml:NameID><samlp:SessionIndex>{SessionIndex}</samlp:SessionIndex></samlp:LogoutRequest>',
    };
    /** Default AttributeStatement XML fragment template. */
    var defaultAttributeStatementTemplate = {
        context: '<saml:AttributeStatement>{Attributes}</saml:AttributeStatement>',
    };
    /** Default Attribute XML fragment template. */
    var defaultAttributeTemplate = {
        context: '<saml:Attribute Name="{Name}" NameFormat="{NameFormat}"><saml:AttributeValue xmlns:xs="{ValueXmlnsXs}" xmlns:xsi="{ValueXmlnsXsi}" xsi:type="{ValueXsiType}">{Value}</saml:AttributeValue></saml:Attribute>',
    };
    /** Default LoginResponse XML template. */
    var defaultLoginResponseTemplate = {
        context: '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="{ID}" Version="2.0" IssueInstant="{IssueInstant}" Destination="{Destination}" InResponseTo="{InResponseTo}"><saml:Issuer>{Issuer}</saml:Issuer><samlp:Status><samlp:StatusCode Value="{StatusCode}"/></samlp:Status><saml:Assertion xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="{AssertionID}" Version="2.0" IssueInstant="{IssueInstant}"><saml:Issuer>{Issuer}</saml:Issuer><saml:Subject><saml:NameID Format="{NameIDFormat}">{NameID}</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="{SubjectConfirmationDataNotOnOrAfter}" Recipient="{SubjectRecipient}" InResponseTo="{InResponseTo}"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="{ConditionsNotBefore}" NotOnOrAfter="{ConditionsNotOnOrAfter}"><saml:AudienceRestriction><saml:Audience>{Audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions>{AuthnStatement}{AttributeStatement}</saml:Assertion></samlp:Response>',
        attributes: [],
        additionalTemplates: {
            attributeStatementTemplate: defaultAttributeStatementTemplate,
            attributeTemplate: defaultAttributeTemplate,
        },
    };
    /** Default LogoutResponse XML template. */
    var defaultLogoutResponseTemplate = {
        context: '<samlp:LogoutResponse xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="{ID}" Version="2.0" IssueInstant="{IssueInstant}" Destination="{Destination}" InResponseTo="{InResponseTo}"><saml:Issuer>{Issuer}</saml:Issuer><samlp:Status><samlp:StatusCode Value="{StatusCode}"/></samlp:Status></samlp:LogoutResponse>',
    };
    /**
     * Map a SAML signature algorithm URI to its node-rsa signing scheme.
     *
     * - When `sigAlg` is omitted, the default RSA-SHA256 scheme is used
     *   (per `saml-bindings §3.4.4.1` recommendation).
     * - When `sigAlg` is supplied but does not match a known URI, the
     *   function throws. Silently downgrading to RSA-SHA1 (the previous
     *   behaviour) was a verification-time vulnerability: an attacker
     *   could supply an unknown `SigAlg` query parameter to coerce
     *   verification onto SHA-1, which is collision-broken
     *   (`saml-sec-consider §6.5`, `xmldsig-core §6.4`).
     *
     * @param sigAlg signature algorithm URI
     * @returns node-rsa signing scheme string
     * @throws when `sigAlg` is supplied and does not match a supported URI
     */
    function getSigningScheme(sigAlg) {
        if (sigAlg === undefined) {
            return nrsaAliasMapping[signatureAlgorithms.RSA_SHA256];
        }
        var algAlias = nrsaAliasMapping[sigAlg];
        if (algAlias === undefined) {
            throw new Error('ERR_UNSUPPORTED_SIGNATURE_ALGORITHM');
        }
        return algAlias;
    }
    /**
     * Return the companion digest URI for a given signature algorithm URI.
     *
     * @param sigAlg signature algorithm URI
     * @returns digest algorithm URI or undefined when unsupported
     */
    function getDigestMethod(sigAlg) {
        return digestAlgorithms[sigAlg];
    }
    /**
     * Build an XPath expression that matches either a named element or one of
     * its attributes.
     *
     * @param local element name, or `{ name, attr }` for an attribute selector
     * @param isExtractAll when true the element selector resolves to its text()
     * @returns XPath expression
     */
    function createXPath(local, isExtractAll) {
        if ((0, utility_1.isString)(local)) {
            var escaped = (0, utility_1.escapeXPathValue)(local);
            return isExtractAll === true
                ? '//*[local-name(.)=' + escaped + ']/text()'
                : '//*[local-name(.)=' + escaped + ']';
        }
        var _a = local, name = _a.name, attr = _a.attr;
        return '//*[local-name(.)=' + (0, utility_1.escapeXPathValue)(name) + ']/@' + attr;
    }
    /**
     * Capitalise a content string after camel-casing and optionally prefix it.
     */
    function tagging(prefix, content) {
        var camelContent = (0, utility_1.camelCase)(content);
        return prefix + camelContent.charAt(0).toUpperCase() + camelContent.slice(1);
    }
    /**
     * Replacer for {@link replaceTagsByValue}. Always XML-escapes the
     * replacement text, in both attribute and element-text contexts, to
     * prevent SAML attribute/element injection through user-controlled
     * template values.
     */
    function escapeTag(replacement) {
        return function (_match, quote) {
            var text = replacement === null || replacement === undefined ? '' : String(replacement);
            return quote ? "".concat(quote).concat((0, xml_escape_1.default)(text)) : (0, xml_escape_1.default)(text);
        };
    }
    return {
        createXPath: createXPath,
        getQueryParamByType: getQueryParamByType,
        defaultLoginRequestTemplate: defaultLoginRequestTemplate,
        defaultLoginResponseTemplate: defaultLoginResponseTemplate,
        defaultAttributeStatementTemplate: defaultAttributeStatementTemplate,
        defaultAttributeTemplate: defaultAttributeTemplate,
        defaultLogoutRequestTemplate: defaultLogoutRequestTemplate,
        defaultLogoutResponseTemplate: defaultLogoutResponseTemplate,
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
        replaceTagsByValue: function (rawXML, tagValues) {
            Object.keys(tagValues).forEach(function (t) {
                var value = tagValues[t];
                if (value === null || value === undefined) {
                    // Drop the entire `\s+name="{Tag}"` (or single-quoted) attribute.
                    rawXML = rawXML.replace(new RegExp("\\s+[A-Za-z_:][\\w:.-]*=(\"|')\\{".concat(t, "\\}\\1"), 'g'), '');
                    // Drop the entire `<X ...>{Tag}</X>` element when the placeholder
                    // is the only body content (allows optional elements to be omitted
                    // rather than rendered empty).
                    rawXML = rawXML.replace(new RegExp("<([A-Za-z_:][\\w:.-]*)((?:\\s+[^>]*)?)>\\{".concat(t, "\\}</\\1>"), 'g'), '');
                    // Replace any remaining `{Tag}` occurrences with empty string.
                    rawXML = rawXML.replace(new RegExp("\\{".concat(t, "\\}"), 'g'), '');
                    return;
                }
                rawXML = rawXML.replace(new RegExp("(\"?)\\{".concat(t, "\\}"), 'g'), escapeTag(value));
            });
            return rawXML;
        },
        /**
         * Build a serialized `<AttributeStatement>` from attribute descriptors
         * by applying the attribute and statement templates.
         *
         * @param attributes attribute descriptors (name, format, value)
         * @param attributeTemplate per-attribute template
         * @param attributeStatementTemplate wrapping statement template
         * @returns serialized XML fragment
         */
        attributeStatementBuilder: function (attributes, attributeTemplate, attributeStatementTemplate) {
            if (attributeTemplate === void 0) { attributeTemplate = defaultAttributeTemplate; }
            if (attributeStatementTemplate === void 0) { attributeStatementTemplate = defaultAttributeStatementTemplate; }
            var attr = attributes.map(function (_a) {
                var name = _a.name, nameFormat = _a.nameFormat, valueTag = _a.valueTag, valueXsiType = _a.valueXsiType, valueXmlnsXs = _a.valueXmlnsXs, valueXmlnsXsi = _a.valueXmlnsXsi;
                var defaultValueXmlnsXs = 'http://www.w3.org/2001/XMLSchema';
                var defaultValueXmlnsXsi = 'http://www.w3.org/2001/XMLSchema-instance';
                var attributeLine = attributeTemplate.context;
                attributeLine = attributeLine.replace('{Name}', name);
                attributeLine = attributeLine.replace('{NameFormat}', nameFormat);
                attributeLine = attributeLine.replace('{ValueXmlnsXs}', valueXmlnsXs ? valueXmlnsXs : defaultValueXmlnsXs);
                attributeLine = attributeLine.replace('{ValueXmlnsXsi}', valueXmlnsXsi ? valueXmlnsXsi : defaultValueXmlnsXsi);
                attributeLine = attributeLine.replace('{ValueXsiType}', valueXsiType);
                attributeLine = attributeLine.replace('{Value}', "{".concat(tagging('attr', valueTag), "}"));
                return attributeLine;
            }).join('');
            return attributeStatementTemplate.context.replace('{Attributes}', attr);
        },
        /**
         * Compute an XML-DSig signature over the supplied SAML message. Can
         * sign the message root (`isMessageSigned`), a referenced subtree
         * (`referenceTagXPath`), or both.
         *
         * @param opts signature inputs and layout options
         * @returns base64 (default) or raw signed XML string
         */
        constructSAMLSignature: function (opts) {
            var rawSamlMessage = opts.rawSamlMessage, referenceTagXPath = opts.referenceTagXPath, privateKey = opts.privateKey, privateKeyPass = opts.privateKeyPass, _a = opts.signatureAlgorithm, signatureAlgorithm = _a === void 0 ? signatureAlgorithms.RSA_SHA256 : _a, _b = opts.transformationAlgorithms, transformationAlgorithms = _b === void 0 ? [
                'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
                'http://www.w3.org/2001/10/xml-exc-c14n#',
            ] : _b, signingCert = opts.signingCert, signatureConfig = opts.signatureConfig, _c = opts.isBase64Output, isBase64Output = _c === void 0 ? true : _c, _d = opts.isMessageSigned, isMessageSigned = _d === void 0 ? false : _d;
            var sig = new xml_crypto_1.SignedXml();
            // xmldsig-core §6.4.2 — make PSS variants available alongside the
            // PKCS#1 v1.5 set built into xml-crypto v6.x. No-op for callers
            // staying on RSA-SHA*; required when `signatureAlgorithm` is one of
            // the `xmldsig-more 2007-05` PSS URIs.
            registerPssAlgorithms(sig);
            var digestAlgorithm = getDigestMethod(signatureAlgorithm);
            if (referenceTagXPath) {
                sig.addReference({
                    xpath: referenceTagXPath,
                    transforms: transformationAlgorithms,
                    digestAlgorithm: digestAlgorithm,
                });
            }
            if (isMessageSigned) {
                sig.addReference({
                    xpath: '/*',
                    transforms: transformationAlgorithms,
                    digestAlgorithm: digestAlgorithm,
                });
            }
            sig.signatureAlgorithm = signatureAlgorithm;
            sig.publicCert = this.getKeyInfo(signingCert, signatureConfig).getKey();
            sig.getKeyInfoContent = this.getKeyInfo(signingCert, signatureConfig).getKeyInfo;
            sig.privateKey = utility_1.default.readPrivateKey(privateKey, privateKeyPass, true);
            sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';
            if (signatureConfig) {
                sig.computeSignature(rawSamlMessage, signatureConfig);
            }
            else {
                sig.computeSignature(rawSamlMessage);
            }
            return isBase64Output !== false
                ? utility_1.default.base64Encode(sig.getSignedXml())
                : sig.getSignedXml();
        },
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
        verifySignature: function (xml, opts) {
            var e_1, _a;
            var _b;
            var dom = (0, api_1.getContext)().dom;
            var doc = dom.parseFromString(xml);
            var contextDom = (0, api_1.getContext)().dom;
            var docParser = contextDom;
            // Absolute XPaths defend against signature-wrapping attacks.
            var messageSignatureXpath = "/*[contains(local-name(), 'Response') or contains(local-name(), 'Request')]/*[local-name(.)='Signature']";
            var assertionSignatureXpath = "/*[contains(local-name(), 'Response') or contains(local-name(), 'Request')]/*[local-name(.)='Assertion']/*[local-name(.)='Signature']";
            var wrappingElementsXPath = "/*[contains(local-name(), 'Response')]/*[local-name(.)='Assertion']/*[local-name(.)='Subject']/*[local-name(.)='SubjectConfirmation']/*[local-name(.)='SubjectConfirmationData']//*[local-name(.)='Assertion' or local-name(.)='Signature']";
            var selection = [];
            var messageSignatureNode = toNodeArray((0, xpath_1.select)(messageSignatureXpath, doc));
            var assertionSignatureNode = toNodeArray((0, xpath_1.select)(assertionSignatureXpath, doc));
            var wrappingElementNode = toNodeArray((0, xpath_1.select)(wrappingElementsXPath, doc));
            selection = selection.concat(messageSignatureNode);
            selection = selection.concat(assertionSignatureNode);
            if (wrappingElementNode.length !== 0) {
                throw new Error('ERR_POTENTIAL_WRAPPING_ATTACK');
            }
            if (selection.length === 0) {
                return [false, null];
            }
            var _loop_1 = function (signatureNode) {
                var sig = new xml_crypto_1.SignedXml();
                // Register PSS plugins on the verifier instance so the algorithm
                // declared inside the signed XML can resolve to a SignatureAlgorithm
                // class (xmldsig-core §6.4.2; see `registerPssAlgorithms`).
                registerPssAlgorithms(sig);
                var verified = false;
                sig.signatureAlgorithm = opts.signatureAlgorithm;
                if (!opts.keyFile && !opts.metadata) {
                    throw new Error('ERR_UNDEFINED_SIGNATURE_VERIFIER_OPTIONS');
                }
                if (opts.keyFile) {
                    sig.publicCert = fs.readFileSync(opts.keyFile);
                }
                if (opts.metadata) {
                    var certificateNode = toNodeArray((0, xpath_1.select)(".//*[local-name(.)='X509Certificate']", signatureNode));
                    var metadataCert = opts.metadata.getX509Certificate(certUse.signing);
                    if (Array.isArray(metadataCert)) {
                        metadataCert = (0, utility_1.flattenDeep)(metadataCert);
                    }
                    else if (typeof metadataCert === 'string') {
                        metadataCert = [metadataCert];
                    }
                    metadataCert = metadataCert.map(utility_1.default.normalizeCerString);
                    if (certificateNode.length === 0 && metadataCert.length === 0) {
                        throw new Error('NO_SELECTED_CERTIFICATE');
                    }
                    if (certificateNode.length !== 0) {
                        var certEl = certificateNode[0];
                        var x509CertificateData = (_b = certEl.textContent) !== null && _b !== void 0 ? _b : '';
                        var x509Certificate_1 = utility_1.default.normalizeCerString(x509CertificateData);
                        if (metadataCert.length >= 1 &&
                            !metadataCert.find(function (cert) { return cert.trim() === x509Certificate_1.trim(); })) {
                            throw new Error('ERROR_UNMATCH_CERTIFICATE_DECLARATION_IN_METADATA');
                        }
                        sig.publicCert = this_1.getKeyInfo(x509Certificate_1).getKey();
                    }
                    else {
                        sig.publicCert = this_1.getKeyInfo(metadataCert[0]).getKey();
                    }
                }
                sig.loadSignature(signatureNode);
                verified = sig.checkSignature(doc.toString());
                if (!verified) {
                    return "continue";
                }
                if (!(sig.getSignedReferences().length >= 1)) {
                    throw new Error('NO_SIGNATURE_REFERENCES');
                }
                var signedVerifiedXML = sig.getSignedReferences()[0];
                var rootNode = docParser.parseFromString(signedVerifiedXML, 'text/xml').documentElement;
                if (rootNode.localName === 'Response') {
                    var assertions = toNodeArray((0, xpath_1.select)("./*[local-name()='Assertion']", rootNode));
                    var encryptedAssertions = toNodeArray((0, xpath_1.select)("./*[local-name()='EncryptedAssertion']", rootNode));
                    if (assertions.length === 1) {
                        return { value: [true, assertions[0].toString()] };
                    }
                    else if (encryptedAssertions.length >= 1) {
                        return { value: [true, rootNode.toString()] };
                    }
                    return { value: [true, null] };
                }
                else if (rootNode.localName === 'Assertion') {
                    return { value: [true, rootNode.toString()] };
                }
                return { value: [true, null] };
            };
            var this_1 = this;
            try {
                for (var selection_1 = __values(selection), selection_1_1 = selection_1.next(); !selection_1_1.done; selection_1_1 = selection_1.next()) {
                    var signatureNode = selection_1_1.value;
                    var state_1 = _loop_1(signatureNode);
                    if (typeof state_1 === "object")
                        return state_1.value;
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (selection_1_1 && !selection_1_1.done && (_a = selection_1.return)) _a.call(selection_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return [false, null];
        },
        /**
         * Build the metadata `<KeyDescriptor>` fragment for a certificate use.
         *
         * @param use `signing` or `encryption`
         * @param certString PEM certificate body or Buffer
         * @returns element tree consumable by the `xml` module
         */
        createKeySection: function (use, certString) {
            return {
                KeyDescriptor: [
                    {
                        _attr: { use: use },
                    },
                    {
                        'ds:KeyInfo': [
                            {
                                _attr: {
                                    'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
                                },
                            },
                            {
                                'ds:X509Data': [{
                                        'ds:X509Certificate': utility_1.default.normalizeCerString(certString),
                                    }],
                            },
                        ],
                    },
                ],
            };
        },
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
        constructMessageSignature: function (octetString, key, passphrase, isBase64, signingAlgorithm) {
            var decryptedKey = new node_rsa_1.default(utility_1.default.readPrivateKey(key, passphrase), undefined, {
                signingScheme: getSigningScheme(signingAlgorithm),
            });
            var signature = decryptedKey.sign(octetString);
            return isBase64 !== false ? signature.toString('base64') : signature;
        },
        /**
         * Verify a detached RSA signature over a redirect-binding octet string.
         *
         * @param metadata peer metadata carrying the signing certificate
         * @param octetString canonical query-string that was signed
         * @param signature signature bytes
         * @param verifyAlgorithm signature algorithm URI (optional)
         * @returns true when the signature verifies
         */
        verifyMessageSignature: function (metadata, octetString, signature, verifyAlgorithm) {
            var signCert = metadata.getX509Certificate(certUse.signing);
            var signingScheme = getSigningScheme(verifyAlgorithm);
            var key = new node_rsa_1.default(utility_1.default.getPublicKeyPemFromCertificate(signCert), 'public', { signingScheme: signingScheme });
            return key.verify(Buffer.from(octetString), Buffer.from(signature));
        },
        /**
         * Build the KeyInfo XML fragment and PEM public key for a certificate.
         *
         * @param x509Certificate certificate body (no PEM wrappers)
         * @param signatureConfig optional prefix/location for the KeyInfo element
         */
        getKeyInfo: function (x509Certificate, signatureConfig) {
            if (signatureConfig === void 0) { signatureConfig = {}; }
            var prefix = signatureConfig.prefix ? "".concat(signatureConfig.prefix, ":") : '';
            return {
                getKeyInfo: function () {
                    return "<".concat(prefix, "X509Data><").concat(prefix, "X509Certificate>").concat(x509Certificate, "</").concat(prefix, "X509Certificate></").concat(prefix, "X509Data>");
                },
                getKey: function () {
                    return utility_1.default.getPublicKeyPemFromCertificate(x509Certificate).toString();
                },
            };
        },
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
        encryptAssertion: function (sourceEntity, targetEntity, xml) {
            return new Promise(function (resolve, reject) {
                if (!xml) {
                    return reject(new Error('ERR_UNDEFINED_ASSERTION'));
                }
                var sourceEntitySetting = sourceEntity.entitySetting;
                var targetEntityMetadata = targetEntity.entityMeta;
                var dom = (0, api_1.getContext)().dom;
                var doc = dom.parseFromString(xml);
                var assertions = (0, xpath_1.select)("//*[local-name(.)='Assertion']", doc);
                if (!Array.isArray(assertions) || assertions.length === 0) {
                    throw new Error('ERR_NO_ASSERTION');
                }
                if (assertions.length > 1) {
                    throw new Error('ERR_MULTIPLE_ASSERTION');
                }
                var rawAssertionNode = assertions[0];
                if (sourceEntitySetting.isAssertionEncrypted) {
                    var encryptCert = targetEntityMetadata.getX509Certificate(certUse.encrypt);
                    var publicKeyPem = utility_1.default.getPublicKeyPemFromCertificate(encryptCert);
                    xmlenc.encrypt(rawAssertionNode.toString(), {
                        rsa_pub: Buffer.from(publicKeyPem),
                        pem: Buffer.from("-----BEGIN CERTIFICATE-----".concat(encryptCert, "-----END CERTIFICATE-----")),
                        encryptionAlgorithm: sourceEntitySetting.dataEncryptionAlgorithm,
                        keyEncryptionAlgorithm: sourceEntitySetting.keyEncryptionAlgorithm,
                    }, function (err, res) {
                        /* v8 ignore start */
                        if (err) {
                            console.error(err);
                            return reject(new Error('ERR_EXCEPTION_OF_ASSERTION_ENCRYPTION'));
                        }
                        if (!res) {
                            return reject(new Error('ERR_UNDEFINED_ENCRYPTED_ASSERTION'));
                        }
                        /* v8 ignore stop */
                        var encAssertionPrefix = sourceEntitySetting.tagPrefix.encryptedAssertion;
                        var encryptAssertionDoc = dom.parseFromString("<".concat(encAssertionPrefix, ":EncryptedAssertion xmlns:").concat(encAssertionPrefix, "=\"").concat(urn_1.namespace.names.assertion, "\">").concat(res, "</").concat(encAssertionPrefix, ":EncryptedAssertion>"));
                        doc.documentElement.replaceChild(encryptAssertionDoc.documentElement, rawAssertionNode);
                        return resolve(utility_1.default.base64Encode(doc.toString()));
                    });
                }
                else {
                    return resolve(utility_1.default.base64Encode(xml));
                }
            });
        },
        /**
         * Decrypt the `<EncryptedAssertion>` inside a SAML response using the
         * local entity's private key. Returns both the decrypted document XML
         * and the raw assertion fragment for downstream extraction.
         *
         * @param here local entity performing decryption
         * @param entireXML SAML response XML containing `<EncryptedAssertion>`
         * @returns tuple `[decryptedDocumentXml, rawAssertionXml]`
         */
        decryptAssertion: function (here, entireXML) {
            return new Promise(function (resolve, reject) {
                if (!entireXML) {
                    return reject(new Error('ERR_UNDEFINED_ASSERTION'));
                }
                var hereSetting = here.entitySetting;
                var dom = (0, api_1.getContext)().dom;
                var doc = dom.parseFromString(entireXML);
                var encryptedAssertions = (0, xpath_1.select)("/*[contains(local-name(), 'Response')]/*[local-name(.)='EncryptedAssertion']", doc);
                if (!Array.isArray(encryptedAssertions) || encryptedAssertions.length === 0) {
                    throw new Error('ERR_UNDEFINED_ENCRYPTED_ASSERTION');
                }
                if (encryptedAssertions.length > 1) {
                    throw new Error('ERR_MULTIPLE_ASSERTION');
                }
                var encAssertionNode = encryptedAssertions[0];
                return xmlenc.decrypt(encAssertionNode.toString(), {
                    key: utility_1.default.readPrivateKey(hereSetting.encPrivateKey, hereSetting.encPrivateKeyPass),
                }, function (err, res) {
                    /* v8 ignore start */
                    if (err) {
                        console.error(err);
                        return reject(new Error('ERR_EXCEPTION_OF_ASSERTION_DECRYPTION'));
                    }
                    if (!res) {
                        return reject(new Error('ERR_UNDEFINED_ENCRYPTED_ASSERTION'));
                    }
                    /* v8 ignore stop */
                    var rawAssertionDoc = dom.parseFromString(res);
                    doc.documentElement.replaceChild(rawAssertionDoc.documentElement, encAssertionNode);
                    return resolve([doc.toString(), res]);
                });
            });
        },
        /**
         * Validate the SAML XML against the registered schema validator. Throws
         * when no validator has been configured via {@link setSchemaValidator}
         * so consumers can't silently ship without schema checks.
         *
         * @param input SAML XML string
         */
        isValidXml: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var validate;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            validate = (0, api_1.getContext)().validate;
                            if (!validate) {
                                return [2 /*return*/, Promise.reject(new Error('Your application is potentially vulnerable because no validation function found. Please read the documentation on how to setup the validator. (https://github.com/tngan/samlify#installation)'))];
                            }
                            return [4 /*yield*/, validate(input)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
    };
};
exports.default = libSaml();
//# sourceMappingURL=libsaml.js.map