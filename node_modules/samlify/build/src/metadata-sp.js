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
exports.SpMetadata = void 0;
exports.default = default_1;
/**
 * @file metadata-sp.ts
 * @author tngan
 * @desc Metadata of a service provider (SP). Accepts either a raw XML
 * document or a structured options object and presents a normalised API.
 */
var metadata_1 = __importDefault(require("./metadata"));
var urn_1 = require("./urn");
var libsaml_1 = __importDefault(require("./libsaml"));
var utility_1 = require("./utility");
var xml_1 = __importDefault(require("xml"));
/**
 * Factory returning a new {@link SpMetadata} instance.
 *
 * @param meta XML metadata document or structured options
 * @returns fresh SpMetadata
 */
function default_1(meta) {
    return new SpMetadata(meta);
}
/**
 * SP metadata abstraction — constructs a valid EntityDescriptor/SPSSODescriptor
 * from options, and exposes inspection helpers used by the flow layer.
 */
var SpMetadata = /** @class */ (function (_super) {
    __extends(SpMetadata, _super);
    /**
     * Build SP metadata from XML or programmatic options.
     *
     * @param meta XML string/Buffer or {@link MetadataSpOptions}
     */
    function SpMetadata(meta) {
        var e_1, _a, e_2, _b;
        var isFile = (0, utility_1.isString)(meta) || meta instanceof Buffer;
        if (!isFile) {
            var _c = meta, _d = _c.elementsOrder, elementsOrder = _d === void 0 ? urn_1.elementsOrder.default : _d, entityID = _c.entityID, signingCert = _c.signingCert, encryptCert = _c.encryptCert, _e = _c.authnRequestsSigned, authnRequestsSigned = _e === void 0 ? false : _e, _f = _c.wantAssertionsSigned, wantAssertionsSigned = _f === void 0 ? false : _f, _g = _c.wantMessageSigned, wantMessageSigned = _g === void 0 ? false : _g, _h = _c.nameIDFormat, nameIDFormat = _h === void 0 ? [] : _h, _j = _c.singleLogoutService, singleLogoutService = _j === void 0 ? [] : _j, _k = _c.assertionConsumerService, assertionConsumerService = _k === void 0 ? [] : _k;
            var signatureConfig = meta.signatureConfig;
            var descriptors_1 = {
                KeyDescriptor: [],
                NameIDFormat: [],
                SingleLogoutService: [],
                AssertionConsumerService: [],
                AttributeConsumingService: [],
            };
            var SPSSODescriptor_1 = [{
                    _attr: {
                        AuthnRequestsSigned: String(authnRequestsSigned),
                        WantAssertionsSigned: String(wantAssertionsSigned),
                        protocolSupportEnumeration: urn_1.namespace.names.protocol,
                    },
                }];
            if (wantMessageSigned && signatureConfig === undefined) {
                // saml-bindings §3.5 — default signature placement when the SP wants
                // a signed message but didn't declare where. Matches the fallback the
                // binding builders already use at sign time, so this is observably
                // a no-op for already-working configurations.
                signatureConfig = {
                    prefix: 'ds',
                    location: {
                        reference: "/*[local-name(.)='Response']/*[local-name(.)='Issuer']",
                        action: 'after',
                    },
                };
                meta.signatureConfig = signatureConfig;
            }
            try {
                for (var _l = __values((0, utility_1.castArrayOpt)(signingCert)), _m = _l.next(); !_m.done; _m = _l.next()) {
                    var cert = _m.value;
                    var section = libsaml_1.default.createKeySection('signing', cert);
                    descriptors_1.KeyDescriptor.push(section.KeyDescriptor);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_m && !_m.done && (_a = _l.return)) _a.call(_l);
                }
                finally { if (e_1) throw e_1.error; }
            }
            try {
                for (var _o = __values((0, utility_1.castArrayOpt)(encryptCert)), _p = _o.next(); !_p.done; _p = _o.next()) {
                    var cert = _p.value;
                    var section = libsaml_1.default.createKeySection('encryption', cert);
                    descriptors_1.KeyDescriptor.push(section.KeyDescriptor);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_p && !_p.done && (_b = _o.return)) _b.call(_o);
                }
                finally { if (e_2) throw e_2.error; }
            }
            if ((0, utility_1.isNonEmptyArray)(nameIDFormat)) {
                nameIDFormat.forEach(function (f) { return descriptors_1.NameIDFormat.push(f); });
            }
            else {
                descriptors_1.NameIDFormat.push(urn_1.namespace.format.emailAddress);
            }
            if ((0, utility_1.isNonEmptyArray)(singleLogoutService)) {
                singleLogoutService.forEach(function (a) {
                    var attr = {
                        Binding: a.Binding,
                        Location: a.Location,
                    };
                    if (a.isDefault) {
                        attr.isDefault = true;
                    }
                    descriptors_1.SingleLogoutService.push([{ _attr: attr }]);
                });
            }
            if ((0, utility_1.isNonEmptyArray)(assertionConsumerService)) {
                var indexCount_1 = 0;
                assertionConsumerService.forEach(function (a) {
                    var attr = {
                        index: String(indexCount_1++),
                        Binding: a.Binding,
                        Location: a.Location,
                    };
                    if (a.isDefault) {
                        attr.isDefault = true;
                    }
                    descriptors_1.AssertionConsumerService.push([{ _attr: attr }]);
                });
            }
            var existedElements = elementsOrder.filter(function (name) { return (0, utility_1.isNonEmptyArray)(descriptors_1[name]); });
            existedElements.forEach(function (name) {
                descriptors_1[name].forEach(function (e) {
                    var _a;
                    return SPSSODescriptor_1.push((_a = {}, _a[name] = e, _a));
                });
            });
            meta = (0, xml_1.default)([{
                    EntityDescriptor: [{
                            _attr: {
                                entityID: entityID,
                                'xmlns': urn_1.namespace.names.metadata,
                                'xmlns:assertion': urn_1.namespace.names.assertion,
                                'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
                            },
                        }, { SPSSODescriptor: SPSSODescriptor_1 }],
                }]);
        }
        return _super.call(this, meta, [
            {
                key: 'spSSODescriptor',
                localPath: ['EntityDescriptor', 'SPSSODescriptor'],
                attributes: ['WantAssertionsSigned', 'AuthnRequestsSigned'],
            },
            {
                key: 'assertionConsumerService',
                localPath: ['EntityDescriptor', 'SPSSODescriptor', 'AssertionConsumerService'],
                attributes: ['Binding', 'Location', 'isDefault', 'index'],
            },
        ]) || this;
    }
    /**
     * Return whether the SP requires signed assertions.
     */
    SpMetadata.prototype.isWantAssertionsSigned = function () {
        return this.meta.spSSODescriptor.wantAssertionsSigned === 'true';
    };
    /**
     * Return whether the SP signs its `AuthnRequest` messages.
     */
    SpMetadata.prototype.isAuthnRequestSigned = function () {
        return this.meta.spSSODescriptor.authnRequestsSigned === 'true';
    };
    /**
     * Return the AssertionConsumerService endpoint URL(s) for the requested
     * binding.
     *
     * @param binding protocol binding key (`redirect`, `post`, etc.)
     * @returns endpoint URL, list of URLs, or raw service list
     */
    SpMetadata.prototype.getAssertionConsumerService = function (binding) {
        if ((0, utility_1.isString)(binding)) {
            var location_1;
            var bindName_1 = urn_1.namespace.binding[binding];
            var acs = this.meta.assertionConsumerService;
            if ((0, utility_1.isNonEmptyArray)(acs)) {
                acs.forEach(function (obj) {
                    if (obj.binding === bindName_1) {
                        location_1 = obj.location;
                    }
                });
            }
            else if (acs.binding === bindName_1) {
                location_1 = acs.location;
            }
            return location_1;
        }
        return this.meta.assertionConsumerService;
    };
    return SpMetadata;
}(metadata_1.default));
exports.SpMetadata = SpMetadata;
//# sourceMappingURL=metadata-sp.js.map