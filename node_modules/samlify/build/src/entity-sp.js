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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceProvider = void 0;
exports.default = default_1;
/**
 * @file entity-sp.ts
 * @author tngan
 * @desc Service provider: builds login requests and parses inbound login
 * responses coming from an identity provider.
 */
var entity_1 = __importDefault(require("./entity"));
var options_1 = require("./options");
var urn_1 = require("./urn");
var binding_redirect_1 = __importDefault(require("./binding-redirect"));
var binding_post_1 = __importDefault(require("./binding-post"));
var binding_simplesign_1 = __importDefault(require("./binding-simplesign"));
var flow_1 = require("./flow");
/**
 * Factory returning a new {@link ServiceProvider}. An SP can be built from
 * an XML metadata document or from a programmatic settings object.
 *
 * @param props SP settings
 */
function default_1(props) {
    return new ServiceProvider(props);
}
/** Service-provider entity. */
var ServiceProvider = /** @class */ (function (_super) {
    __extends(ServiceProvider, _super);
    /**
     * Build an SP with sensible defaults for signing flags.
     *
     * @param spSetting SP settings object
     */
    function ServiceProvider(spSetting) {
        var entitySetting = Object.assign({
            authnRequestsSigned: false,
            wantAssertionsSigned: false,
            wantMessageSigned: false,
        }, spSetting);
        if (entitySetting.wantMessageSigned && entitySetting.signatureConfig === undefined) {
            // saml-bindings §3.5 — default signature placement when the SP wants
            // a signed message but didn't declare where. Matches the fallback the
            // binding builders already use at sign time, so downstream consumers
            // (e.g. `getEntitySetting().signatureConfig`) see a populated value
            // for already-working configurations instead of `undefined`.
            entitySetting.signatureConfig = {
                prefix: 'ds',
                location: {
                    reference: "/*[local-name(.)='Response']/*[local-name(.)='Issuer']",
                    action: 'after',
                },
            };
        }
        return _super.call(this, entitySetting, 'sp') || this;
    }
    /**
     * Build a login request targeting the supplied identity provider.
     *
     * The third parameter accepts either a callback (legacy shape) or an
     * options bag `{ relayState?, customTagReplacement? }`. Per
     * `saml-bindings §3.4.3 / §3.5.3`, RelayState is request-scoped — pass
     * it via the options bag instead of `entitySetting.relayState`.
     *
     * @param idp target identity provider
     * @param binding `redirect` (default), `post`, or `simpleSign`
     * @param optionsOrCallback per-request options or a custom-template callback
     */
    ServiceProvider.prototype.createLoginRequest = function (idp, binding, optionsOrCallback) {
        var _a;
        var opts = (0, options_1.normalizeCreateLoginRequestOptions)(optionsOrCallback);
        var customTagReplacement = opts.customTagReplacement;
        var requestRelayState = (_a = opts.relayState) !== null && _a !== void 0 ? _a : this.entitySetting.relayState;
        // saml-core §3.4.1 — `ForceAuthn` is a per-request boolean flag; when
        // true the IdP MUST re-authenticate the user instead of relying on a
        // previous security context (saml-profiles §4.1.4.1).
        var forceAuthn = opts.forceAuthn;
        // saml-core §3.4.1 — `AssertionConsumerServiceIndex` is mutually
        // exclusive with `AssertionConsumerServiceURL` / `ProtocolBinding`.
        // When set, the binding builders omit both of those attributes so the
        // request only references the metadata-declared endpoint by index
        // (saml-profiles §4.1.4.1).
        var assertionConsumerServiceIndex = opts.assertionConsumerServiceIndex;
        var selectedBinding = binding !== null && binding !== void 0 ? binding : 'redirect';
        var nsBinding = urn_1.namespace.binding;
        var protocol = nsBinding[selectedBinding];
        // saml-core §3.4.1 / saml-metadata §2.4.4: the SP's `AuthnRequestsSigned`
        // attribute and the IdP's `WantAuthnRequestsSigned` attribute must agree;
        // surface both observed values so the operator can tell which side is
        // misconfigured. The error code stays first so prefix-based handlers
        // (per saml-conformance §3) keep working.
        var spSigned = this.entityMeta.isAuthnRequestSigned();
        var idpWants = idp.entityMeta.isWantAuthnRequestsSigned();
        if (spSigned !== idpWants) {
            throw new Error("ERR_METADATA_CONFLICT_REQUEST_SIGNED_FLAG: SP AuthnRequestsSigned=".concat(spSigned, " but IdP WantAuthnRequestsSigned=").concat(idpWants));
        }
        var context = null;
        switch (protocol) {
            case nsBinding.redirect:
                return binding_redirect_1.default.loginRequestRedirectURL({ idp: idp, sp: this }, customTagReplacement, requestRelayState, forceAuthn, assertionConsumerServiceIndex);
            case nsBinding.post:
                context = binding_post_1.default.base64LoginRequest("/*[local-name(.)='AuthnRequest']", { idp: idp, sp: this }, customTagReplacement, forceAuthn, assertionConsumerServiceIndex);
                break;
            case nsBinding.simpleSign:
                context = binding_simplesign_1.default.base64LoginRequest({ idp: idp, sp: this }, customTagReplacement, requestRelayState, forceAuthn, assertionConsumerServiceIndex);
                break;
            default:
                throw new Error('ERR_SP_LOGIN_REQUEST_UNDEFINED_BINDING');
        }
        return __assign(__assign({}, context), { relayState: requestRelayState, entityEndpoint: idp.entityMeta.getSingleSignOnService(selectedBinding), type: 'SAMLRequest' });
    };
    /**
     * Parse, validate and verify an inbound login response.
     *
     * @param idp identity provider that produced the response
     * @param binding `redirect`, `post`, or `simpleSign`
     * @param request HTTP request envelope
     */
    ServiceProvider.prototype.parseLoginResponse = function (idp, binding, request) {
        return (0, flow_1.flow)({
            from: idp,
            self: this,
            // SAML response is always required to be signed.
            checkSignature: true,
            parserType: 'SAMLResponse',
            type: 'login',
            binding: binding,
            request: request,
        });
    };
    return ServiceProvider;
}(entity_1.default));
exports.ServiceProvider = ServiceProvider;
//# sourceMappingURL=entity-sp.js.map