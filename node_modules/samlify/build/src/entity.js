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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @file entity.ts
 * @author tngan
 * @desc Shared base class for identity-provider and service-provider
 * entities. Owns configuration merging, metadata delegation, and the
 * high-level parse/create helpers used by both sides.
 */
var crypto_1 = require("crypto");
var utility_1 = require("./utility");
var urn_1 = require("./urn");
var metadata_idp_1 = __importDefault(require("./metadata-idp"));
var metadata_sp_1 = __importDefault(require("./metadata-sp"));
var binding_redirect_1 = __importDefault(require("./binding-redirect"));
var binding_post_1 = __importDefault(require("./binding-post"));
var binding_simplesign_1 = __importDefault(require("./binding-simplesign"));
var options_1 = require("./options");
var flow_1 = require("./flow");
var dataEncryptionAlgorithm = urn_1.algorithms.encryption.data;
var keyEncryptionAlgorithm = urn_1.algorithms.encryption.key;
var signatureAlgorithms = urn_1.algorithms.signature;
var messageSigningOrders = urn_1.messageConfigurations.signingOrder;
var defaultEntitySetting = {
    wantLogoutResponseSigned: false,
    messageSigningOrder: messageSigningOrders.SIGN_THEN_ENCRYPT,
    wantLogoutRequestSigned: false,
    allowCreate: false,
    isAssertionEncrypted: false,
    requestSignatureAlgorithm: signatureAlgorithms.RSA_SHA256,
    dataEncryptionAlgorithm: dataEncryptionAlgorithm.AES_256,
    keyEncryptionAlgorithm: keyEncryptionAlgorithm.RSA_OAEP_MGF1P,
    generateID: function () { return '_' + (0, crypto_1.randomUUID)(); },
    relayState: '',
};
var Entity = /** @class */ (function () {
    /**
     * Build an entity, merging the provided configuration with defaults and
     * hydrating the metadata abstraction for its role.
     *
     * @param entitySetting IdP or SP settings (metadata XML or options)
     * @param entityType `idp` or `sp`
     */
    function Entity(entitySetting, entityType) {
        this.entitySetting = Object.assign({}, defaultEntitySetting, entitySetting);
        this.entityType = entityType;
        var metadata = entitySetting.metadata || entitySetting;
        switch (entityType) {
            case 'idp':
                this.entityMeta = (0, metadata_idp_1.default)(metadata);
                // Metadata takes precedence over settings when both supply the same key.
                this.entitySetting.wantAuthnRequestsSigned = this.entityMeta.isWantAuthnRequestsSigned();
                this.entitySetting.nameIDFormat = this.entityMeta.getNameIDFormat() || this.entitySetting.nameIDFormat;
                break;
            case 'sp':
                this.entityMeta = (0, metadata_sp_1.default)(metadata);
                // Metadata takes precedence over settings when both supply the same key.
                this.entitySetting.authnRequestsSigned = this.entityMeta.isAuthnRequestSigned();
                this.entitySetting.wantAssertionsSigned = this.entityMeta.isWantAssertionsSigned();
                this.entitySetting.nameIDFormat = this.entityMeta.getNameIDFormat() || this.entitySetting.nameIDFormat;
                break;
            default:
                throw new Error('ERR_UNDEFINED_ENTITY_TYPE');
        }
    }
    /**
     * Return the effective entity settings (defaults merged with overrides).
     */
    Entity.prototype.getEntitySetting = function () {
        return this.entitySetting;
    };
    /**
     * Return the serialized metadata XML for this entity.
     */
    Entity.prototype.getMetadata = function () {
        return this.entityMeta.getMetadata();
    };
    /**
     * Persist the metadata XML to disk.
     *
     * @param exportFile absolute file path
     */
    Entity.prototype.exportMetadata = function (exportFile) {
        return this.entityMeta.exportMetadata(exportFile);
    };
    /**
     * Equality check between a field value extracted from a SAML message and
     * the value declared in the peer's metadata. Arrays must match on every
     * entry.
     *
     * @param field value(s) from the inbound SAML message
     * @param metaField value from peer metadata
     * @returns true when every provided value equals `metaField`
     */
    Entity.prototype.verifyFields = function (field, metaField) {
        if ((0, utility_1.isString)(field)) {
            return field === metaField;
        }
        if ((0, utility_1.isNonEmptyArray)(field)) {
            var res_1 = true;
            field.forEach(function (f) {
                if (f !== metaField) {
                    res_1 = false;
                }
            });
            return res_1;
        }
        return false;
    };
    /**
     * Build a logout request targeting `targetEntity`. The return type depends
     * on the binding: `redirect` produces a URL; `post` and `simpleSign`
     * produce a base64 envelope (the latter with a detached signature).
     *
     * The fourth parameter accepts either a string (legacy `relayState`
     * positional shape) or an options bag `{ relayState?, customTagReplacement? }`.
     * Per `saml-bindings §3.4.3 / §3.5.3`, RelayState is request-scoped — pass
     * it via the options bag instead of `entitySetting.relayState`.
     *
     * @param targetEntity peer to receive the logout request
     * @param binding `redirect`, `post`, or `simpleSign`
     * @param user currently authenticated user
     * @param optionsOrRelayState per-request options or legacy RelayState string
     * @param legacyCustomTagReplacement optional custom template transformer (legacy positional form)
     */
    Entity.prototype.createLogoutRequest = function (targetEntity, binding, user, optionsOrRelayState, legacyCustomTagReplacement) {
        var _a, _b;
        var opts = (0, options_1.normalizeCreateLogoutRequestOptions)(optionsOrRelayState, legacyCustomTagReplacement);
        var relayState = (_b = (_a = opts.relayState) !== null && _a !== void 0 ? _a : this.entitySetting.relayState) !== null && _b !== void 0 ? _b : '';
        var customTagReplacement = opts.customTagReplacement;
        if (binding === urn_1.wording.binding.redirect) {
            return binding_redirect_1.default.logoutRequestRedirectURL(user, {
                init: this,
                target: targetEntity,
            }, relayState, customTagReplacement);
        }
        if (binding === urn_1.wording.binding.post) {
            var entityEndpoint = targetEntity.entityMeta.getSingleLogoutService(binding);
            var context = binding_post_1.default.base64LogoutRequest(user, "/*[local-name(.)='LogoutRequest']", { init: this, target: targetEntity }, customTagReplacement);
            return __assign(__assign({}, context), { relayState: relayState, entityEndpoint: entityEndpoint, type: 'SAMLRequest' });
        }
        if (binding === urn_1.wording.binding.simpleSign) {
            var entityEndpoint = targetEntity.entityMeta.getSingleLogoutService(binding);
            var context = binding_simplesign_1.default.base64LogoutRequest(user, { init: this, target: targetEntity }, relayState, customTagReplacement);
            return __assign(__assign({}, context), { relayState: relayState, entityEndpoint: entityEndpoint, type: 'SAMLRequest' });
        }
        // Artifact binding is not yet implemented.
        throw new Error('ERR_UNDEFINED_BINDING');
    };
    /**
     * Build a logout response to the peer that initiated logout.
     *
     * The fourth parameter accepts either a string (legacy `relayState`
     * positional shape) or an options bag `{ relayState?, customTagReplacement? }`.
     * Per `saml-bindings §3.4.3 / §3.5.3`, RelayState is request-scoped — pass
     * it via the options bag instead of `entitySetting.relayState`.
     *
     * @param target peer that sent the corresponding logout request
     * @param requestInfo parsed request used to link `InResponseTo`
     * @param binding `redirect`, `post`, or `simpleSign`
     * @param optionsOrRelayState per-request options or legacy RelayState string
     * @param legacyCustomTagReplacement optional custom template transformer (legacy positional form)
     */
    Entity.prototype.createLogoutResponse = function (target, requestInfo, binding, optionsOrRelayState, legacyCustomTagReplacement) {
        var _a, _b;
        var opts = (0, options_1.normalizeCreateLogoutResponseOptions)(optionsOrRelayState, legacyCustomTagReplacement);
        var relayState = (_b = (_a = opts.relayState) !== null && _a !== void 0 ? _a : this.entitySetting.relayState) !== null && _b !== void 0 ? _b : '';
        var customTagReplacement = opts.customTagReplacement;
        var protocol = urn_1.namespace.binding[binding];
        if (protocol === urn_1.namespace.binding.redirect) {
            return binding_redirect_1.default.logoutResponseRedirectURL(requestInfo, {
                init: this,
                target: target,
            }, relayState, customTagReplacement);
        }
        if (protocol === urn_1.namespace.binding.post) {
            var context = binding_post_1.default.base64LogoutResponse(requestInfo, {
                init: this,
                target: target,
            }, customTagReplacement);
            return __assign(__assign({}, context), { relayState: relayState, entityEndpoint: target.entityMeta.getSingleLogoutService(binding), type: 'SAMLResponse' });
        }
        if (protocol === urn_1.namespace.binding.simpleSign) {
            var context = binding_simplesign_1.default.base64LogoutResponse(requestInfo, { init: this, target: target }, relayState, customTagReplacement);
            return __assign(__assign({}, context), { relayState: relayState, entityEndpoint: target.entityMeta.getSingleLogoutService(binding), type: 'SAMLResponse' });
        }
        throw new Error('ERR_CREATE_LOGOUT_RESPONSE_UNDEFINED_BINDING');
    };
    /**
     * Parse, validate and verify an inbound logout request.
     *
     * @param from peer entity that produced the request
     * @param binding `redirect`, `post`, or `simpleSign`
     * @param request HTTP request envelope
     */
    Entity.prototype.parseLogoutRequest = function (from, binding, request) {
        return (0, flow_1.flow)({
            from: from,
            self: this,
            type: 'logout',
            parserType: 'LogoutRequest',
            checkSignature: this.entitySetting.wantLogoutRequestSigned,
            binding: binding,
            request: request,
        });
    };
    /**
     * Parse, validate and verify an inbound logout response.
     *
     * @param from peer entity that produced the response
     * @param binding `redirect`, `post`, or `simpleSign`
     * @param request HTTP request envelope
     */
    Entity.prototype.parseLogoutResponse = function (from, binding, request) {
        return (0, flow_1.flow)({
            from: from,
            self: this,
            type: 'logout',
            parserType: 'LogoutResponse',
            checkSignature: this.entitySetting.wantLogoutResponseSigned,
            binding: binding,
            request: request,
        });
    };
    return Entity;
}());
exports.default = Entity;
//# sourceMappingURL=entity.js.map