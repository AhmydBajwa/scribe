"use strict";
/**
 * @file binding-simplesign.ts
 * @author Orange
 * @desc Binding-level API for SAML HTTP-POST-SimpleSign. Produces base64
 * payloads alongside a detached signature over the canonical octet string.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var urn_1 = require("./urn");
var libsaml_1 = __importDefault(require("./libsaml"));
var utility_1 = __importStar(require("./utility"));
var binding = urn_1.wording.binding;
var urlParams = urn_1.wording.urlParams;
/**
 * Build a `key=value` URL fragment prefixed with the correct separator.
 */
function pvPair(param, value, first) {
    return (first === true ? '?' : '&') + param + '=' + value;
}
/**
 * Compute a detached RSA signature over a SimpleSign canonical octet string.
 *
 * @param opts signing inputs
 * @returns base64-encoded signature
 */
function buildSimpleSignature(opts) {
    var type = opts.type, context = opts.context, entitySetting = opts.entitySetting;
    var _a = opts.relayState, relayState = _a === void 0 ? '' : _a;
    var queryParam = libsaml_1.default.getQueryParamByType(type);
    if (relayState !== '') {
        relayState = pvPair(urlParams.relayState, relayState);
    }
    var sigAlg = pvPair(urlParams.sigAlg, entitySetting.requestSignatureAlgorithm);
    var octetString = context + relayState + sigAlg;
    return libsaml_1.default.constructMessageSignature(queryParam + '=' + octetString, entitySetting.privateKey, entitySetting.privateKeyPass, undefined, entitySetting.requestSignatureAlgorithm).toString();
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
function base64LoginRequest(entity, customTagReplacement, relayState, forceAuthn, assertionConsumerServiceIndex) {
    var _a, _b;
    var metadata = { idp: entity.idp.entityMeta, sp: entity.sp.entityMeta };
    var spSetting = entity.sp.entitySetting;
    var id = '';
    /* v8 ignore start */
    if (!metadata.idp || !metadata.sp) {
        throw new Error('ERR_GENERATE_POST_SIMPLESIGN_LOGIN_REQUEST_MISSING_METADATA');
    }
    /* v8 ignore stop */
    var base = metadata.idp.getSingleSignOnService(binding.simpleSign);
    var rawSamlRequest;
    if (customTagReplacement) {
        // saml-binding-simplesign §2 — the AuthnRequest template is informative,
        // not normative. Honour the callback regardless of whether the caller
        // supplied a custom template (closes #549).
        var templateContext = (_b = (_a = spSetting.loginRequestTemplate) === null || _a === void 0 ? void 0 : _a.context) !== null && _b !== void 0 ? _b : libsaml_1.default.defaultLoginRequestTemplate.context;
        var info = customTagReplacement(templateContext);
        id = (0, utility_1.get)(info, 'id');
        rawSamlRequest = (0, utility_1.get)(info, 'context');
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
            ProtocolBinding: useAcsIndex
                ? undefined
                : 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
            AssertionConsumerServiceURL: useAcsIndex
                ? undefined
                : metadata.sp.getAssertionConsumerService(binding.simpleSign),
            AssertionConsumerServiceIndex: assertionConsumerServiceIndex,
            EntityID: metadata.sp.getEntityID(),
            AllowCreate: spSetting.allowCreate,
            NameIDFormat: selectedNameIDFormat,
            // saml-core §3.4.1 — `replaceTagsByValue` drops the attribute when
            // `forceAuthn` is undefined, matching `use="optional"`.
            ForceAuthn: forceAuthn,
        };
        rawSamlRequest = libsaml_1.default.replaceTagsByValue(libsaml_1.default.defaultLoginRequestTemplate.context, tags);
    }
    var simpleSignatureContext = null;
    if (metadata.idp.isWantAuthnRequestsSigned()) {
        var simpleSignature = buildSimpleSignature({
            type: urlParams.samlRequest,
            context: rawSamlRequest,
            entitySetting: spSetting,
            relayState: relayState !== null && relayState !== void 0 ? relayState : spSetting.relayState,
        });
        simpleSignatureContext = {
            signature: simpleSignature,
            sigAlg: spSetting.requestSignatureAlgorithm,
        };
    }
    return __assign({ id: id, context: utility_1.default.base64Encode(rawSamlRequest) }, (simpleSignatureContext !== null && simpleSignatureContext !== void 0 ? simpleSignatureContext : {}));
}
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
function base64LoginResponse() {
    return __awaiter(this, arguments, void 0, function (requestInfo, entity, user, relayState, customTagReplacement) {
        var idpSetting, spSetting, id, metadata, nameIDFormat, selectedNameIDFormat, base, rawSamlResponse, nowTime, fiveMinutesLaterTime, tvalue, templateContext, template, baseTemplate, privateKey, privateKeyPass, signatureAlgorithm, config, simpleSignature;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        if (requestInfo === void 0) { requestInfo = {}; }
        if (user === void 0) { user = {}; }
        return __generator(this, function (_k) {
            idpSetting = entity.idp.entitySetting;
            spSetting = entity.sp.entitySetting;
            id = idpSetting.generateID();
            metadata = {
                idp: entity.idp.entityMeta,
                sp: entity.sp.entityMeta,
            };
            nameIDFormat = idpSetting.nameIDFormat;
            selectedNameIDFormat = Array.isArray(nameIDFormat) ? nameIDFormat[0] : nameIDFormat;
            /* v8 ignore start */
            if (!metadata.idp || !metadata.sp) {
                throw new Error('ERR_GENERATE_POST_SIMPLESIGN_LOGIN_RESPONSE_MISSING_METADATA');
            }
            base = metadata.sp.getAssertionConsumerService(binding.simpleSign);
            nowTime = new Date();
            fiveMinutesLaterTime = new Date(nowTime.getTime() + 300000);
            tvalue = {
                ID: id,
                AssertionID: idpSetting.generateID(),
                Destination: base,
                Audience: metadata.sp.getEntityID(),
                EntityID: metadata.sp.getEntityID(),
                SubjectRecipient: base,
                Issuer: metadata.idp.getEntityID(),
                IssueInstant: nowTime.toISOString(),
                AssertionConsumerServiceURL: base,
                StatusCode: urn_1.StatusCode.Success,
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
                templateContext = (_e = (_b = (_a = idpSetting.loginResponseTemplate) === null || _a === void 0 ? void 0 : _a.context) !== null && _b !== void 0 ? _b : (_d = (_c = idpSetting.tagPrefixedDefaults) === null || _c === void 0 ? void 0 : _c.loginResponseTemplate) === null || _d === void 0 ? void 0 : _d.context) !== null && _e !== void 0 ? _e : libsaml_1.default.defaultLoginResponseTemplate.context;
                template = customTagReplacement(templateContext);
                rawSamlResponse = (0, utility_1.get)(template, 'context');
            }
            else {
                if (requestInfo !== null && ((_f = requestInfo.extract) === null || _f === void 0 ? void 0 : _f.request)) {
                    tvalue.InResponseTo = requestInfo.extract.request.id;
                }
                baseTemplate = (_j = (_h = (_g = idpSetting.tagPrefixedDefaults) === null || _g === void 0 ? void 0 : _g.loginResponseTemplate) === null || _h === void 0 ? void 0 : _h.context) !== null && _j !== void 0 ? _j : libsaml_1.default.defaultLoginResponseTemplate.context;
                rawSamlResponse = libsaml_1.default.replaceTagsByValue(baseTemplate, tvalue);
            }
            privateKey = idpSetting.privateKey, privateKeyPass = idpSetting.privateKeyPass, signatureAlgorithm = idpSetting.requestSignatureAlgorithm;
            config = {
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
            simpleSignature = buildSimpleSignature({
                type: urlParams.samlResponse,
                context: rawSamlResponse,
                entitySetting: idpSetting,
                relayState: relayState,
            });
            return [2 /*return*/, Promise.resolve({
                    id: id,
                    context: utility_1.default.base64Encode(rawSamlResponse),
                    signature: simpleSignature,
                    sigAlg: idpSetting.requestSignatureAlgorithm,
                })];
        });
    });
}
/**
 * Generate a base64-encoded LogoutRequest together with a detached simple
 * signature when the receiving entity requires signed logout requests.
 *
 * @param user currently authenticated user
 * @param entity `{ init, target }` handles
 * @param relayState caller-supplied redirect URL
 * @param customTagReplacement optional custom template transformer
 */
function base64LogoutRequest(user, entity, relayState, customTagReplacement) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var metadata = { init: entity.init.entityMeta, target: entity.target.entityMeta };
    var initSetting = entity.init.entitySetting;
    var nameIDFormat = initSetting.nameIDFormat;
    var selectedNameIDFormat = Array.isArray(nameIDFormat) ? nameIDFormat[0] : nameIDFormat;
    var id = '';
    /* v8 ignore start */
    if (!metadata.init || !metadata.target) {
        throw new Error('ERR_GENERATE_POST_SIMPLESIGN_LOGOUT_REQUEST_MISSING_METADATA');
    }
    /* v8 ignore stop */
    var rawSamlRequest;
    if (customTagReplacement) {
        // saml-binding-simplesign §2 — honour the callback even when the
        // caller did not override `logoutRequestTemplate` (closes #549).
        // Prefer the user-supplied template, then the tag-prefixed default
        // (closes #388), and finally the library default.
        var templateContext = (_e = (_b = (_a = initSetting.logoutRequestTemplate) === null || _a === void 0 ? void 0 : _a.context) !== null && _b !== void 0 ? _b : (_d = (_c = initSetting.tagPrefixedDefaults) === null || _c === void 0 ? void 0 : _c.logoutRequestTemplate) === null || _d === void 0 ? void 0 : _d.context) !== null && _e !== void 0 ? _e : libsaml_1.default.defaultLogoutRequestTemplate.context;
        var template = customTagReplacement(templateContext);
        id = (0, utility_1.get)(template, 'id');
        rawSamlRequest = (0, utility_1.get)(template, 'context');
    }
    else {
        id = initSetting.generateID();
        var tvalue = {
            ID: id,
            Destination: metadata.target.getSingleLogoutService(binding.simpleSign),
            Issuer: metadata.init.getEntityID(),
            IssueInstant: new Date().toISOString(),
            EntityID: metadata.init.getEntityID(),
            NameIDFormat: selectedNameIDFormat,
            NameID: user.logoutNameID,
            // saml-core §3.7.1 — SessionIndex is optional; replaceTagsByValue
            // drops the element when undefined (closes #470).
            SessionIndex: user.sessionIndex,
        };
        var baseTemplate = (_h = (_g = (_f = initSetting.tagPrefixedDefaults) === null || _f === void 0 ? void 0 : _f.logoutRequestTemplate) === null || _g === void 0 ? void 0 : _g.context) !== null && _h !== void 0 ? _h : libsaml_1.default.defaultLogoutRequestTemplate.context;
        rawSamlRequest = libsaml_1.default.replaceTagsByValue(baseTemplate, tvalue);
    }
    var simpleSignatureContext = null;
    if (entity.target.entitySetting.wantLogoutRequestSigned) {
        var simpleSignature = buildSimpleSignature({
            type: urlParams.logoutRequest,
            context: rawSamlRequest,
            entitySetting: initSetting,
            relayState: relayState,
        });
        simpleSignatureContext = {
            signature: simpleSignature,
            sigAlg: initSetting.requestSignatureAlgorithm,
        };
    }
    return __assign({ id: id, context: utility_1.default.base64Encode(rawSamlRequest) }, (simpleSignatureContext !== null && simpleSignatureContext !== void 0 ? simpleSignatureContext : {}));
}
/**
 * Generate a base64-encoded LogoutResponse together with a detached simple
 * signature when the receiving entity requires signed logout responses.
 *
 * @param requestInfo parsed request used to link `InResponseTo`
 * @param entity `{ init, target }` handles
 * @param relayState caller-supplied redirect URL
 * @param customTagReplacement optional custom template transformer
 */
function base64LogoutResponse(requestInfo, entity, relayState, customTagReplacement) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var metadata = { init: entity.init.entityMeta, target: entity.target.entityMeta };
    var initSetting = entity.init.entitySetting;
    var id = '';
    /* v8 ignore start */
    if (!metadata.init || !metadata.target) {
        throw new Error('ERR_GENERATE_POST_SIMPLESIGN_LOGOUT_RESPONSE_MISSING_METADATA');
    }
    /* v8 ignore stop */
    var rawSamlResponse;
    if (customTagReplacement) {
        // saml-binding-simplesign §2 — honour the callback even when the
        // caller did not override `logoutResponseTemplate` (closes #549).
        // Prefer the user-supplied template, then the tag-prefixed default
        // (closes #388), and finally the library default.
        var templateContext = (_e = (_b = (_a = initSetting.logoutResponseTemplate) === null || _a === void 0 ? void 0 : _a.context) !== null && _b !== void 0 ? _b : (_d = (_c = initSetting.tagPrefixedDefaults) === null || _c === void 0 ? void 0 : _c.logoutResponseTemplate) === null || _d === void 0 ? void 0 : _d.context) !== null && _e !== void 0 ? _e : libsaml_1.default.defaultLogoutResponseTemplate.context;
        var template = customTagReplacement(templateContext);
        id = template.id;
        rawSamlResponse = template.context;
    }
    else {
        id = initSetting.generateID();
        var tvalue = {
            ID: id,
            Destination: metadata.target.getSingleLogoutService(binding.simpleSign),
            EntityID: metadata.init.getEntityID(),
            Issuer: metadata.init.getEntityID(),
            IssueInstant: new Date().toISOString(),
            StatusCode: urn_1.StatusCode.Success,
            InResponseTo: (0, utility_1.get)(requestInfo, 'extract.request.id'),
        };
        var baseTemplate = (_h = (_g = (_f = initSetting.tagPrefixedDefaults) === null || _f === void 0 ? void 0 : _f.logoutResponseTemplate) === null || _g === void 0 ? void 0 : _g.context) !== null && _h !== void 0 ? _h : libsaml_1.default.defaultLogoutResponseTemplate.context;
        rawSamlResponse = libsaml_1.default.replaceTagsByValue(baseTemplate, tvalue);
    }
    var simpleSignatureContext = null;
    if (entity.target.entitySetting.wantLogoutResponseSigned) {
        var simpleSignature = buildSimpleSignature({
            type: urlParams.logoutResponse,
            context: rawSamlResponse,
            entitySetting: initSetting,
            relayState: relayState,
        });
        simpleSignatureContext = {
            signature: simpleSignature,
            sigAlg: initSetting.requestSignatureAlgorithm,
        };
    }
    return __assign({ id: id, context: utility_1.default.base64Encode(rawSamlResponse) }, (simpleSignatureContext !== null && simpleSignatureContext !== void 0 ? simpleSignatureContext : {}));
}
var simpleSignBinding = {
    base64LoginRequest: base64LoginRequest,
    base64LoginResponse: base64LoginResponse,
    base64LogoutRequest: base64LogoutRequest,
    base64LogoutResponse: base64LogoutResponse,
};
exports.default = simpleSignBinding;
//# sourceMappingURL=binding-simplesign.js.map