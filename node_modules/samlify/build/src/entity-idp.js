"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.IdentityProvider = void 0;
exports.default = default_1;
/**
 * @file entity-idp.ts
 * @author tngan
 * @desc Identity provider: builds login responses and parses inbound
 * login requests coming from a service provider.
 */
var entity_1 = __importDefault(require("./entity"));
var options_1 = require("./options");
var libsaml_1 = __importDefault(require("./libsaml"));
var urn_1 = require("./urn");
var binding_post_1 = __importDefault(require("./binding-post"));
var binding_redirect_1 = __importDefault(require("./binding-redirect"));
var binding_simplesign_1 = __importDefault(require("./binding-simplesign"));
var flow_1 = require("./flow");
var utility_1 = require("./utility");
/**
 * Factory returning a new {@link IdentityProvider}. An IdP can be built
 * from an XML metadata document or from a programmatic settings object.
 *
 * @param props IdP settings
 */
function default_1(props) {
    return new IdentityProvider(props);
}
/**
 * Swap the default `samlp:` / `saml:` prefixes inside an XML template
 * with caller-supplied prefixes. Both the prefix occurrences and the
 * `xmlns:` namespace bindings are rewritten so the resulting XML
 * remains well-formed and namespace-correct (saml-core §1.4 — prefix
 * choice is not normative).
 */
function applyTagPrefixes(xml, prefixes) {
    var out = xml;
    if (prefixes.protocol && prefixes.protocol !== 'samlp') {
        var p = prefixes.protocol;
        out = out
            .replace(/<samlp:/g, "<".concat(p, ":"))
            .replace(/<\/samlp:/g, "</".concat(p, ":"))
            .replace(/xmlns:samlp="/g, "xmlns:".concat(p, "=\""));
    }
    if (prefixes.assertion && prefixes.assertion !== 'saml') {
        var a = prefixes.assertion;
        out = out
            .replace(/<saml:/g, "<".concat(a, ":"))
            .replace(/<\/saml:/g, "</".concat(a, ":"))
            .replace(/xmlns:saml="/g, "xmlns:".concat(a, "=\""));
    }
    return out;
}
/** Identity-provider entity. */
var IdentityProvider = /** @class */ (function (_super) {
    __extends(IdentityProvider, _super);
    /**
     * Build an IdP, expanding `loginResponseTemplate.attributes` into a
     * pre-baked AttributeStatement template when supplied.
     */
    function IdentityProvider(idpSetting) {
        var _a, _b, _c;
        var defaultIdpEntitySetting = {
            wantAuthnRequestsSigned: false,
            tagPrefix: {
                encryptedAssertion: 'saml',
            },
        };
        var entitySetting = Object.assign({}, defaultIdpEntitySetting, idpSetting);
        // Deep-merge tagPrefix so callers can override `protocol` / `assertion`
        // without dropping the `encryptedAssertion: 'saml'` default that
        // libsaml.encryptAssertion depends on (#388, saml-core §1.4).
        entitySetting.tagPrefix = __assign(__assign({}, defaultIdpEntitySetting.tagPrefix), idpSetting.tagPrefix);
        if (idpSetting.loginResponseTemplate) {
            var template = idpSetting.loginResponseTemplate;
            if ((0, utility_1.isString)(template.context) && Array.isArray(template.attributes)) {
                var additional = template.additionalTemplates;
                var attributeStatementTemplate = additional && additional.attributeStatementTemplate
                    ? additional.attributeStatementTemplate
                    : libsaml_1.default.defaultAttributeStatementTemplate;
                var attributeTemplate = additional && additional.attributeTemplate
                    ? additional.attributeTemplate
                    : libsaml_1.default.defaultAttributeTemplate;
                var attributeStatement = libsaml_1.default.attributeStatementBuilder(template.attributes, attributeTemplate, attributeStatementTemplate);
                entitySetting.loginResponseTemplate = __assign(__assign({}, entitySetting.loginResponseTemplate), { context: entitySetting.loginResponseTemplate.context.replace('{AttributeStatement}', attributeStatement) });
            }
            else {
                console.warn('Invalid login response template');
            }
        }
        // saml-core §1.4 — XML namespace prefixes are not normative; only the
        // URI bindings are. When the caller overrides `tagPrefix.protocol` or
        // `tagPrefix.assertion`, rewrite both the caller's templates and the
        // built-in defaults so the bindings emit the rebound prefixes
        // downstream (closes #388). The rewritten defaults land on a separate
        // `tagPrefixedDefaults` slot so users that only set
        // `loginResponseTemplate` (without `tagPrefix`) continue to follow the
        // legacy binding fallback path.
        var tp = entitySetting.tagPrefix;
        var protocolPrefix = tp === null || tp === void 0 ? void 0 : tp.protocol;
        var assertionPrefix = tp === null || tp === void 0 ? void 0 : tp.assertion;
        var overridesProtocol = !!protocolPrefix && protocolPrefix !== 'samlp';
        var overridesAssertion = !!assertionPrefix && assertionPrefix !== 'saml';
        if (overridesProtocol || overridesAssertion) {
            var prefixes = { protocol: protocolPrefix, assertion: assertionPrefix };
            // Rewrite any caller-supplied templates in place so customTagReplacement
            // consumers see the rebound prefixes too.
            var callerLoginCtx = (_a = entitySetting.loginResponseTemplate) === null || _a === void 0 ? void 0 : _a.context;
            if ((0, utility_1.isString)(callerLoginCtx)) {
                entitySetting.loginResponseTemplate = __assign(__assign({}, entitySetting.loginResponseTemplate), { context: applyTagPrefixes(callerLoginCtx, prefixes) });
            }
            var callerLogoutReqCtx = (_b = entitySetting.logoutRequestTemplate) === null || _b === void 0 ? void 0 : _b.context;
            if ((0, utility_1.isString)(callerLogoutReqCtx)) {
                entitySetting.logoutRequestTemplate = __assign(__assign({}, entitySetting.logoutRequestTemplate), { context: applyTagPrefixes(callerLogoutReqCtx, prefixes) });
            }
            var callerLogoutRespCtx = (_c = entitySetting.logoutResponseTemplate) === null || _c === void 0 ? void 0 : _c.context;
            if ((0, utility_1.isString)(callerLogoutRespCtx)) {
                entitySetting.logoutResponseTemplate = __assign(__assign({}, entitySetting.logoutResponseTemplate), { context: applyTagPrefixes(callerLogoutRespCtx, prefixes) });
            }
            // Pre-rewrite copies of the default templates so the bindings emit
            // rebound prefixes when no caller template is supplied.
            entitySetting.tagPrefixedDefaults = {
                loginResponseTemplate: {
                    context: applyTagPrefixes(libsaml_1.default.defaultLoginResponseTemplate.context, prefixes),
                },
                logoutRequestTemplate: {
                    context: applyTagPrefixes(libsaml_1.default.defaultLogoutRequestTemplate.context, prefixes),
                },
                logoutResponseTemplate: {
                    context: applyTagPrefixes(libsaml_1.default.defaultLogoutResponseTemplate.context, prefixes),
                },
            };
        }
        return _super.call(this, entitySetting, 'idp') || this;
    }
    /**
     * Build a login response for delivery to the supplied service provider.
     *
     * The fifth parameter accepts either a callback (legacy positional shape)
     * or an options bag `{ relayState?, customTagReplacement?, encryptThenSign? }`.
     * When the legacy shape is used, the trailing `legacyEncryptThenSign` and
     * `legacyRelayState` positional arguments are honoured. Per
     * `saml-bindings §3.4.3 / §3.5.3`, RelayState is request-scoped — pass it
     * via the options bag instead of `entitySetting.relayState`.
     *
     * @param sp target service provider
     * @param requestInfo parsed request used to set `InResponseTo`
     * @param binding `post`, `simpleSign`, or `redirect`
     * @param user authenticated user
     * @param optionsOrCallback per-request options or legacy custom-template callback
     * @param legacyEncryptThenSign legacy positional `encryptThenSign`; ignored when options bag is used
     * @param legacyRelayState legacy positional `relayState`; ignored when options bag is used
     */
    IdentityProvider.prototype.createLoginResponse = function (sp, requestInfo, binding, user, optionsOrCallback, legacyEncryptThenSign, legacyRelayState) {
        return __awaiter(this, void 0, void 0, function () {
            var opts, customTagReplacement, encryptThenSign, relayState, protocol, context, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        opts = (0, options_1.normalizeCreateLoginResponseOptions)(optionsOrCallback, legacyEncryptThenSign, legacyRelayState);
                        customTagReplacement = opts.customTagReplacement;
                        encryptThenSign = opts.encryptThenSign;
                        relayState = opts.relayState;
                        protocol = urn_1.namespace.binding[binding];
                        context = null;
                        _a = protocol;
                        switch (_a) {
                            case urn_1.namespace.binding.post: return [3 /*break*/, 1];
                            case urn_1.namespace.binding.simpleSign: return [3 /*break*/, 3];
                            case urn_1.namespace.binding.redirect: return [3 /*break*/, 5];
                        }
                        return [3 /*break*/, 6];
                    case 1: return [4 /*yield*/, binding_post_1.default.base64LoginResponse(requestInfo, {
                            idp: this,
                            sp: sp,
                        }, user, customTagReplacement, encryptThenSign)];
                    case 2:
                        context = _b.sent();
                        return [3 /*break*/, 7];
                    case 3: return [4 /*yield*/, binding_simplesign_1.default.base64LoginResponse(requestInfo, {
                            idp: this,
                            sp: sp,
                        }, user, relayState, customTagReplacement)];
                    case 4:
                        context = (_b.sent());
                        return [3 /*break*/, 7];
                    case 5: return [2 /*return*/, binding_redirect_1.default.loginResponseRedirectURL(requestInfo, {
                            idp: this,
                            sp: sp,
                        }, user, relayState, customTagReplacement)];
                    case 6: throw new Error('ERR_CREATE_RESPONSE_UNDEFINED_BINDING');
                    case 7: return [2 /*return*/, __assign(__assign({}, context), { relayState: relayState, entityEndpoint: sp.entityMeta.getAssertionConsumerService(binding), type: 'SAMLResponse' })];
                }
            });
        });
    };
    /**
     * Parse, validate and verify an inbound login request.
     *
     * @param sp service provider that produced the request
     * @param binding `redirect`, `post`, or `simpleSign`
     * @param req HTTP request envelope
     */
    IdentityProvider.prototype.parseLoginRequest = function (sp, binding, req) {
        return (0, flow_1.flow)({
            from: sp,
            self: this,
            checkSignature: this.entityMeta.isWantAuthnRequestsSigned(),
            parserType: 'SAMLRequest',
            type: 'login',
            binding: binding,
            request: req,
        });
    };
    return IdentityProvider;
}(entity_1.default));
exports.IdentityProvider = IdentityProvider;
//# sourceMappingURL=entity-idp.js.map