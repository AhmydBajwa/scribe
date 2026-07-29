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
exports.IdpMetadata = void 0;
exports.default = default_1;
/**
 * @file metadata-idp.ts
 * @author tngan
 * @desc Metadata of an identity provider (IdP). Accepts either a raw XML
 * document or a structured options object and presents a normalised API.
 */
var metadata_1 = __importDefault(require("./metadata"));
var urn_1 = require("./urn");
var libsaml_1 = __importDefault(require("./libsaml"));
var utility_1 = require("./utility");
var xml_1 = __importDefault(require("xml"));
/**
 * Factory returning a new {@link IdpMetadata} instance.
 *
 * @param meta XML metadata document or structured options
 * @returns fresh IdpMetadata
 */
function default_1(meta) {
    return new IdpMetadata(meta);
}
var IdpMetadata = /** @class */ (function (_super) {
    __extends(IdpMetadata, _super);
    /**
     * Build IdP metadata from XML or programmatic options.
     *
     * @param meta XML string/Buffer or {@link MetadataIdpOptions}
     */
    function IdpMetadata(meta) {
        var e_1, _a, e_2, _b;
        var isFile = (0, utility_1.isString)(meta) || meta instanceof Buffer;
        if (!isFile) {
            var _c = meta, _d = _c.elementsOrder, elementsOrder = _d === void 0 ? urn_1.elementsOrder.idp.default : _d, entityID = _c.entityID, signingCert = _c.signingCert, encryptCert = _c.encryptCert, _e = _c.wantAuthnRequestsSigned, wantAuthnRequestsSigned = _e === void 0 ? false : _e, _f = _c.nameIDFormat, nameIDFormat = _f === void 0 ? [] : _f, _g = _c.singleSignOnService, singleSignOnService = _g === void 0 ? [] : _g, _h = _c.singleLogoutService, singleLogoutService = _h === void 0 ? [] : _h;
            var descriptors_1 = {
                KeyDescriptor: [],
                NameIDFormat: [],
                SingleSignOnService: [],
                SingleLogoutService: [],
            };
            var IDPSSODescriptor_1 = [{
                    _attr: {
                        WantAuthnRequestsSigned: String(wantAuthnRequestsSigned),
                        protocolSupportEnumeration: urn_1.namespace.names.protocol,
                    },
                }];
            try {
                for (var _j = __values((0, utility_1.castArrayOpt)(signingCert)), _k = _j.next(); !_k.done; _k = _j.next()) {
                    var cert = _k.value;
                    var section = libsaml_1.default.createKeySection('signing', cert);
                    descriptors_1.KeyDescriptor.push(section.KeyDescriptor);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_k && !_k.done && (_a = _j.return)) _a.call(_j);
                }
                finally { if (e_1) throw e_1.error; }
            }
            try {
                for (var _l = __values((0, utility_1.castArrayOpt)(encryptCert)), _m = _l.next(); !_m.done; _m = _l.next()) {
                    var cert = _m.value;
                    var section = libsaml_1.default.createKeySection('encryption', cert);
                    descriptors_1.KeyDescriptor.push(section.KeyDescriptor);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_m && !_m.done && (_b = _l.return)) _b.call(_l);
                }
                finally { if (e_2) throw e_2.error; }
            }
            if ((0, utility_1.isNonEmptyArray)(nameIDFormat)) {
                nameIDFormat.forEach(function (f) { return descriptors_1.NameIDFormat.push(f); });
            }
            if ((0, utility_1.isNonEmptyArray)(singleSignOnService)) {
                singleSignOnService.forEach(function (a) {
                    var attr = {
                        Binding: a.Binding,
                        Location: a.Location,
                    };
                    if (a.isDefault) {
                        attr.isDefault = true;
                    }
                    descriptors_1.SingleSignOnService.push([{ _attr: attr }]);
                });
            }
            else {
                throw new Error('ERR_IDP_METADATA_MISSING_SINGLE_SIGN_ON_SERVICE');
            }
            if ((0, utility_1.isNonEmptyArray)(singleLogoutService)) {
                singleLogoutService.forEach(function (a) {
                    var attr = {};
                    if (a.isDefault) {
                        attr.isDefault = true;
                    }
                    attr.Binding = a.Binding;
                    attr.Location = a.Location;
                    descriptors_1.SingleLogoutService.push([{ _attr: attr }]);
                });
            }
            else {
                console.warn('Construct identity  provider - missing endpoint of SingleLogoutService');
            }
            // saml-metadata §2.4.3 — emit IDPSSODescriptor children in the
            // caller-supplied order (default mirrors the historical sequence so
            // existing metadata is byte-identical). Closes #429.
            var existedElements = elementsOrder.filter(function (name) { return (0, utility_1.isNonEmptyArray)(descriptors_1[name]); });
            existedElements.forEach(function (name) {
                descriptors_1[name].forEach(function (e) {
                    var _a;
                    return IDPSSODescriptor_1.push((_a = {}, _a[name] = e, _a));
                });
            });
            meta = (0, xml_1.default)([{
                    EntityDescriptor: [{
                            _attr: {
                                'xmlns': urn_1.namespace.names.metadata,
                                'xmlns:assertion': urn_1.namespace.names.assertion,
                                'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
                                entityID: entityID,
                            },
                        }, { IDPSSODescriptor: IDPSSODescriptor_1 }],
                }]);
        }
        return _super.call(this, meta, [
            {
                key: 'wantAuthnRequestsSigned',
                localPath: ['EntityDescriptor', 'IDPSSODescriptor'],
                attributes: ['WantAuthnRequestsSigned'],
            },
            {
                key: 'singleSignOnService',
                localPath: ['EntityDescriptor', 'IDPSSODescriptor', 'SingleSignOnService'],
                index: ['Binding'],
                attributePath: [],
                attributes: ['Location'],
            },
        ]) || this;
    }
    /**
     * Return whether the IdP requires signed `AuthnRequest` messages.
     *
     * @returns true when the metadata advertises `WantAuthnRequestsSigned="true"`
     */
    IdpMetadata.prototype.isWantAuthnRequestsSigned = function () {
        var was = this.meta.wantAuthnRequestsSigned;
        if (was === undefined) {
            return false;
        }
        return String(was) === 'true';
    };
    /**
     * Return the single sign-on endpoint URL for the given binding, or the
     * full service map when the binding isn't a string.
     *
     * @param binding protocol binding key (`redirect`, `post`, etc.)
     * @returns endpoint URL or raw service map
     */
    IdpMetadata.prototype.getSingleSignOnService = function (binding) {
        if ((0, utility_1.isString)(binding)) {
            var bindName = urn_1.namespace.binding[binding];
            var services = this.meta.singleSignOnService;
            var service = services && services[bindName];
            if (service) {
                return service;
            }
        }
        return this.meta.singleSignOnService;
    };
    return IdpMetadata;
}(metadata_1.default));
exports.IdpMetadata = IdpMetadata;
//# sourceMappingURL=metadata-idp.js.map