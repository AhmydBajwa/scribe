"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @file binding-redirect.ts
 * @author tngan
 * @desc Binding-level API for SAML HTTP-Redirect. Builds signed/unsigned
 * redirect URLs for login/logout requests and responses.
 */
var utility_1 = __importStar(require("./utility"));
var libsaml_1 = __importDefault(require("./libsaml"));
var url = __importStar(require("url"));
var urn_1 = require("./urn");
var binding = urn_1.wording.binding;
var urlParams = urn_1.wording.urlParams;
/**
 * Build a `key=value` URL fragment prefixed with the correct separator.
 *
 * @param param key name
 * @param value key value
 * @param first when true, use `?` instead of `&`
 */
function pvPair(param, value, first) {
    return (first === true ? '?' : '&') + param + '=' + value;
}
/**
 * Compose the final redirect URL, deflate/base64/urlencode the SAML message,
 * optionally append the detached signature.
 *
 * @param opts redirect configuration
 * @returns absolute redirect URL
 */
function buildRedirectURL(opts) {
    var baseUrl = opts.baseUrl, type = opts.type, isSigned = opts.isSigned, context = opts.context, entitySetting = opts.entitySetting;
    var _a = opts.relayState, relayState = _a === void 0 ? '' : _a;
    var noParams = (url.parse(baseUrl).query || []).length === 0;
    var queryParam = libsaml_1.default.getQueryParamByType(type);
    // SAML redirect binding: deflate → base64 → URL-encode.
    var samlRequest = encodeURIComponent(utility_1.default.base64Encode(utility_1.default.deflateString(context)));
    if (relayState !== '') {
        relayState = pvPair(urlParams.relayState, encodeURIComponent(relayState));
    }
    if (isSigned) {
        var sigAlg = pvPair(urlParams.sigAlg, encodeURIComponent(entitySetting.requestSignatureAlgorithm));
        var octetString = samlRequest + relayState + sigAlg;
        return baseUrl
            + pvPair(queryParam, octetString, noParams)
            + pvPair(urlParams.signature, encodeURIComponent(libsaml_1.default.constructMessageSignature(queryParam + '=' + octetString, entitySetting.privateKey, entitySetting.privateKeyPass, undefined, entitySetting.requestSignatureAlgorithm).toString()));
    }
    return baseUrl + pvPair(queryParam, samlRequest + relayState, noParams);
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
function loginRequestRedirectURL(entity, customTagReplacement, relayState, forceAuthn, assertionConsumerServiceIndex) {
    var _a, _b;
    var metadata = { idp: entity.idp.entityMeta, sp: entity.sp.entityMeta };
    var spSetting = entity.sp.entitySetting;
    var id = '';
    /* v8 ignore start */
    if (!metadata.idp || !metadata.sp) {
        throw new Error('ERR_GENERATE_REDIRECT_LOGIN_REQUEST_MISSING_METADATA');
    }
    /* v8 ignore stop */
    var base = metadata.idp.getSingleSignOnService(binding.redirect);
    // saml-bindings §3.4 / saml-metadata §2.4.3: the IdP must declare a
    // <SingleSignOnService> entry with the HTTP-Redirect Binding URI.
    // When that endpoint is absent, getSingleSignOnService returns the raw
    // service map (an object) rather than a URL string — surface a clear
    // error instead of letting it crash inside url.parse downstream.
    if (typeof base !== 'string') {
        throw new Error('ERR_NO_REDIRECT_SSO_ENDPOINT');
    }
    var rawSamlRequest;
    if (customTagReplacement) {
        // saml-bindings §3.4 — the AuthnRequest template is informative, not
        // normative. Honour the callback regardless of whether the caller
        // supplied a custom template (closes #549). Pass the user-supplied
        // template when present; otherwise the library default.
        var templateContext = (_b = (_a = spSetting.loginRequestTemplate) === null || _a === void 0 ? void 0 : _a.context) !== null && _b !== void 0 ? _b : libsaml_1.default.defaultLoginRequestTemplate.context;
        var info = customTagReplacement(templateContext);
        id = (0, utility_1.get)(info, 'id');
        rawSamlRequest = (0, utility_1.get)(info, 'context');
        // Support callback returning { context: string } or { context: { context: string } }.
        if (typeof rawSamlRequest === 'object' && rawSamlRequest !== null && 'context' in rawSamlRequest) {
            rawSamlRequest = rawSamlRequest.context;
        }
    }
    else {
        var nameIDFormat = spSetting.nameIDFormat;
        var selectedNameIDFormat = Array.isArray(nameIDFormat) ? nameIDFormat[0] : nameIDFormat;
        id = spSetting.generateID();
        // saml-core §3.4.1 — `AssertionConsumerServiceIndex` is mutually
        // exclusive with `AssertionConsumerServiceURL` / `ProtocolBinding`.
        // When the caller supplies the index we set the URL+ProtocolBinding
        // tags to undefined so `replaceTagsByValue` drops both attributes
        // from the rendered XML (closes #437).
        var useAcsIndex = assertionConsumerServiceIndex !== undefined;
        var tags = {
            ID: id,
            Destination: base,
            Issuer: metadata.sp.getEntityID(),
            IssueInstant: new Date().toISOString(),
            NameIDFormat: selectedNameIDFormat,
            ProtocolBinding: useAcsIndex
                ? undefined
                : 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
            AssertionConsumerServiceURL: useAcsIndex
                ? undefined
                : metadata.sp.getAssertionConsumerService(binding.post),
            AssertionConsumerServiceIndex: assertionConsumerServiceIndex,
            EntityID: metadata.sp.getEntityID(),
            AllowCreate: spSetting.allowCreate,
            // saml-core §3.4.1 — `replaceTagsByValue` drops the attribute when
            // `forceAuthn` is undefined, matching `use="optional"`.
            ForceAuthn: forceAuthn,
        };
        rawSamlRequest = libsaml_1.default.replaceTagsByValue(libsaml_1.default.defaultLoginRequestTemplate.context, tags);
    }
    return {
        id: id,
        context: buildRedirectURL({
            context: rawSamlRequest,
            type: urlParams.samlRequest,
            isSigned: metadata.sp.isAuthnRequestSigned(),
            entitySetting: spSetting,
            baseUrl: base,
            relayState: relayState !== null && relayState !== void 0 ? relayState : spSetting.relayState,
        }),
    };
}
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
function loginResponseRedirectURL(requestInfo, entity, user, relayState, customTagReplacement) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (user === void 0) { user = {}; }
    var idpSetting = entity.idp.entitySetting;
    var spSetting = entity.sp.entitySetting;
    var metadata = {
        idp: entity.idp.entityMeta,
        sp: entity.sp.entityMeta,
    };
    var id = idpSetting.generateID();
    /* v8 ignore start */
    if (!metadata.idp || !metadata.sp) {
        throw new Error('ERR_GENERATE_REDIRECT_LOGIN_RESPONSE_MISSING_METADATA');
    }
    /* v8 ignore stop */
    var base = metadata.sp.getAssertionConsumerService(binding.redirect);
    // saml-bindings §3.4 / saml-metadata §2.4.3: the SP must declare an
    // <AssertionConsumerService> entry with the HTTP-Redirect Binding URI.
    // When that endpoint is absent, getAssertionConsumerService returns
    // undefined or the raw service list — reject with a clear error rather
    // than crashing in url.parse.
    if (typeof base !== 'string') {
        throw new Error('ERR_NO_REDIRECT_SSO_ENDPOINT');
    }
    var rawSamlResponse;
    var nameIDFormat = idpSetting.nameIDFormat;
    var selectedNameIDFormat = Array.isArray(nameIDFormat) ? nameIDFormat[0] : nameIDFormat;
    var nowTime = new Date();
    var fiveMinutesLaterTime = new Date(nowTime.getTime() + 300000);
    var tvalue = {
        ID: id,
        AssertionID: idpSetting.generateID(),
        Destination: base,
        SubjectRecipient: base,
        Issuer: metadata.idp.getEntityID(),
        Audience: metadata.sp.getEntityID(),
        EntityID: metadata.sp.getEntityID(),
        IssueInstant: nowTime.toISOString(),
        AssertionConsumerServiceURL: base,
        StatusCode: urn_1.namespace.statusCode.success,
        ConditionsNotBefore: nowTime.toISOString(),
        ConditionsNotOnOrAfter: fiveMinutesLaterTime.toISOString(),
        SubjectConfirmationDataNotOnOrAfter: fiveMinutesLaterTime.toISOString(),
        NameIDFormat: selectedNameIDFormat,
        NameID: user.email || '',
        InResponseTo: (0, utility_1.get)(requestInfo, 'extract.request.id', ''),
        AuthnStatement: '',
        AttributeStatement: '',
    };
    if (customTagReplacement) {
        // saml-bindings §3.4 — honour the callback even when the caller did
        // not override `loginResponseTemplate` (closes #549). Prefer the
        // user-supplied template, then the tag-prefixed default (closes #388),
        // and finally the library default.
        var templateContext = (_e = (_b = (_a = idpSetting.loginResponseTemplate) === null || _a === void 0 ? void 0 : _a.context) !== null && _b !== void 0 ? _b : (_d = (_c = idpSetting.tagPrefixedDefaults) === null || _c === void 0 ? void 0 : _c.loginResponseTemplate) === null || _d === void 0 ? void 0 : _d.context) !== null && _e !== void 0 ? _e : libsaml_1.default.defaultLoginResponseTemplate.context;
        var template = customTagReplacement(templateContext);
        id = (0, utility_1.get)(template, 'id');
        rawSamlResponse = (0, utility_1.get)(template, 'context');
    }
    else {
        if (requestInfo !== null && ((_f = requestInfo.extract) === null || _f === void 0 ? void 0 : _f.request)) {
            tvalue.InResponseTo = requestInfo.extract.request.id;
        }
        // saml-core §1.4: prefer the IdP-rewritten default when tagPrefix is
        // overridden (closes #388); otherwise fall back to the library default.
        var baseTemplate = (_j = (_h = (_g = idpSetting.tagPrefixedDefaults) === null || _g === void 0 ? void 0 : _g.loginResponseTemplate) === null || _h === void 0 ? void 0 : _h.context) !== null && _j !== void 0 ? _j : libsaml_1.default.defaultLoginResponseTemplate.context;
        rawSamlResponse = libsaml_1.default.replaceTagsByValue(baseTemplate, tvalue);
    }
    var privateKey = idpSetting.privateKey, privateKeyPass = idpSetting.privateKeyPass, signatureAlgorithm = idpSetting.requestSignatureAlgorithm;
    var config = {
        privateKey: privateKey,
        privateKeyPass: privateKeyPass,
        signatureAlgorithm: signatureAlgorithm,
        signingCert: metadata.idp.getX509Certificate('signing'),
        isBase64Output: false,
    };
    if (metadata.sp.isWantAssertionsSigned()) {
        rawSamlResponse = libsaml_1.default.constructSAMLSignature(__assign(__assign({}, config), { rawSamlMessage: rawSamlResponse, transformationAlgorithms: spSetting.transformationAlgorithms, referenceTagXPath: "/*[local-name(.)='Response']/*[local-name(.)='Assertion']", signatureConfig: {
                prefix: 'ds',
                location: { reference: "/*[local-name(.)='Response']/*[local-name(.)='Assertion']/*[local-name(.)='Issuer']", action: 'after' },
            } }));
    }
    // SAML response over redirect binding is always signed (see SAML core 3.4.4).
    return {
        id: id,
        context: buildRedirectURL({
            baseUrl: base,
            type: urlParams.samlResponse,
            isSigned: true,
            context: rawSamlResponse,
            entitySetting: idpSetting,
            relayState: relayState,
        }),
    };
}
/**
 * Build a redirect URL carrying a SAML LogoutRequest.
 *
 * @param user currently authenticated user
 * @param entity `{ init, target }` handles
 * @param relayState caller-supplied redirect URL
 * @param customTagReplacement optional custom template transformer
 * @returns id + redirect URL wrapped in a {@link BindingContext}
 */
function logoutRequestRedirectURL(user, entity, relayState, customTagReplacement) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var metadata = { init: entity.init.entityMeta, target: entity.target.entityMeta };
    var initSetting = entity.init.entitySetting;
    var id = initSetting.generateID();
    var nameIDFormat = initSetting.nameIDFormat;
    var selectedNameIDFormat = Array.isArray(nameIDFormat) ? nameIDFormat[0] : nameIDFormat;
    /* v8 ignore start */
    if (!metadata.init || !metadata.target) {
        throw new Error('ERR_GENERATE_REDIRECT_LOGOUT_REQUEST_MISSING_METADATA');
    }
    /* v8 ignore stop */
    var base = metadata.target.getSingleLogoutService(binding.redirect);
    // saml-bindings §3.4 / saml-metadata §2.4.3: the target entity must declare
    // a <SingleLogoutService> with the HTTP-Redirect Binding URI. Otherwise the
    // service map leaks through and crashes inside url.parse downstream.
    if (typeof base !== 'string') {
        throw new Error('ERR_NO_REDIRECT_SLO_ENDPOINT');
    }
    var rawSamlRequest = '';
    var requiredTags = {
        ID: id,
        Destination: base,
        EntityID: metadata.init.getEntityID(),
        Issuer: metadata.init.getEntityID(),
        IssueInstant: new Date().toISOString(),
        NameIDFormat: selectedNameIDFormat,
        NameID: user.logoutNameID,
        SessionIndex: user.sessionIndex,
    };
    if (customTagReplacement) {
        // saml-bindings §3.4 — honour the callback even when the caller did
        // not override `logoutRequestTemplate` (closes #549). Prefer the
        // user-supplied template, then the tag-prefixed default (closes #388),
        // and finally the library default.
        var templateContext = (_e = (_b = (_a = initSetting.logoutRequestTemplate) === null || _a === void 0 ? void 0 : _a.context) !== null && _b !== void 0 ? _b : (_d = (_c = initSetting.tagPrefixedDefaults) === null || _c === void 0 ? void 0 : _c.logoutRequestTemplate) === null || _d === void 0 ? void 0 : _d.context) !== null && _e !== void 0 ? _e : libsaml_1.default.defaultLogoutRequestTemplate.context;
        var info = customTagReplacement(templateContext, requiredTags);
        id = (0, utility_1.get)(info, 'id');
        rawSamlRequest = (0, utility_1.get)(info, 'context');
    }
    else {
        var baseTemplate = (_h = (_g = (_f = initSetting.tagPrefixedDefaults) === null || _f === void 0 ? void 0 : _f.logoutRequestTemplate) === null || _g === void 0 ? void 0 : _g.context) !== null && _h !== void 0 ? _h : libsaml_1.default.defaultLogoutRequestTemplate.context;
        rawSamlRequest = libsaml_1.default.replaceTagsByValue(baseTemplate, requiredTags);
    }
    return {
        id: id,
        context: buildRedirectURL({
            context: rawSamlRequest,
            relayState: relayState,
            type: urlParams.logoutRequest,
            isSigned: entity.target.entitySetting.wantLogoutRequestSigned,
            entitySetting: initSetting,
            baseUrl: base,
        }),
    };
}
/**
 * Build a redirect URL carrying a SAML LogoutResponse.
 *
 * @param requestInfo parsed request used to link `InResponseTo`
 * @param entity `{ init, target }` handles
 * @param relayState caller-supplied redirect URL
 * @param customTagReplacement optional custom template transformer
 * @returns id + redirect URL wrapped in a {@link BindingContext}
 */
function logoutResponseRedirectURL(requestInfo, entity, relayState, customTagReplacement) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var metadata = {
        init: entity.init.entityMeta,
        target: entity.target.entityMeta,
    };
    var initSetting = entity.init.entitySetting;
    var id = initSetting.generateID();
    /* v8 ignore start */
    if (!metadata.init || !metadata.target) {
        throw new Error('ERR_GENERATE_REDIRECT_LOGOUT_RESPONSE_MISSING_METADATA');
    }
    /* v8 ignore stop */
    var base = metadata.target.getSingleLogoutService(binding.redirect);
    // saml-bindings §3.4 / saml-metadata §2.4.3: same constraint as the
    // logout request path — the target must advertise a HTTP-Redirect SLO
    // endpoint before we can build a URL.
    if (typeof base !== 'string') {
        throw new Error('ERR_NO_REDIRECT_SLO_ENDPOINT');
    }
    var rawSamlResponse;
    if (customTagReplacement) {
        // saml-bindings §3.4 — honour the callback even when the caller did
        // not override `logoutResponseTemplate` (closes #549). Prefer the
        // user-supplied template, then the tag-prefixed default (closes #388),
        // and finally the library default.
        var templateContext = (_e = (_b = (_a = initSetting.logoutResponseTemplate) === null || _a === void 0 ? void 0 : _a.context) !== null && _b !== void 0 ? _b : (_d = (_c = initSetting.tagPrefixedDefaults) === null || _c === void 0 ? void 0 : _c.logoutResponseTemplate) === null || _d === void 0 ? void 0 : _d.context) !== null && _e !== void 0 ? _e : libsaml_1.default.defaultLogoutResponseTemplate.context;
        var template = customTagReplacement(templateContext);
        id = (0, utility_1.get)(template, 'id');
        rawSamlResponse = (0, utility_1.get)(template, 'context');
    }
    else {
        var tvalue = {
            ID: id,
            Destination: base,
            Issuer: metadata.init.getEntityID(),
            EntityID: metadata.init.getEntityID(),
            IssueInstant: new Date().toISOString(),
            StatusCode: urn_1.namespace.statusCode.success,
        };
        if (requestInfo && requestInfo.extract && requestInfo.extract.request) {
            tvalue.InResponseTo = requestInfo.extract.request.id;
        }
        var baseTemplate = (_h = (_g = (_f = initSetting.tagPrefixedDefaults) === null || _f === void 0 ? void 0 : _f.logoutResponseTemplate) === null || _g === void 0 ? void 0 : _g.context) !== null && _h !== void 0 ? _h : libsaml_1.default.defaultLogoutResponseTemplate.context;
        rawSamlResponse = libsaml_1.default.replaceTagsByValue(baseTemplate, tvalue);
    }
    return {
        id: id,
        context: buildRedirectURL({
            baseUrl: base,
            type: urlParams.logoutResponse,
            isSigned: entity.target.entitySetting.wantLogoutResponseSigned,
            context: rawSamlResponse,
            entitySetting: initSetting,
            relayState: relayState,
        }),
    };
}
var redirectBinding = {
    loginRequestRedirectURL: loginRequestRedirectURL,
    loginResponseRedirectURL: loginResponseRedirectURL,
    logoutRequestRedirectURL: logoutRequestRedirectURL,
    logoutResponseRedirectURL: logoutResponseRedirectURL,
};
exports.default = redirectBinding;
//# sourceMappingURL=binding-redirect.js.map