"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @file metadata.ts
 * @author tngan
 * @desc Abstraction for SAML entity metadata (IdP and SP share this base).
 */
var fs = __importStar(require("fs"));
var urn_1 = require("./urn");
var extractor_1 = require("./extractor");
var utility_1 = require("./utility");
var Metadata = /** @class */ (function () {
    /**
     * Parse a SAML metadata XML document and hydrate a typed `meta` bag.
     *
     * @param xml raw metadata XML (string or Buffer)
     * @param extraParse additional extractor fields merged into the standard set
     */
    function Metadata(xml, extraParse) {
        if (extraParse === void 0) { extraParse = []; }
        this.xmlString = xml.toString();
        this.meta = (0, extractor_1.extract)(this.xmlString, extraParse.concat([
            {
                key: 'entityDescriptor',
                localPath: ['EntityDescriptor'],
                attributes: [],
                context: true,
            },
            {
                key: 'entityID',
                localPath: ['EntityDescriptor'],
                attributes: ['entityID'],
            },
            {
                // shared certificate for both encryption and signing
                key: 'sharedCertificate',
                localPath: ['EntityDescriptor', '~SSODescriptor', 'KeyDescriptor', 'KeyInfo', 'X509Data', 'X509Certificate'],
                attributes: [],
            },
            {
                // explicit certificate declaration for encryption and signing
                key: 'certificate',
                localPath: ['EntityDescriptor', '~SSODescriptor', 'KeyDescriptor'],
                index: ['use'],
                attributePath: ['KeyInfo', 'X509Data', 'X509Certificate'],
                attributes: [],
            },
            {
                key: 'singleLogoutService',
                localPath: ['EntityDescriptor', '~SSODescriptor', 'SingleLogoutService'],
                attributes: ['Binding', 'Location'],
            },
            {
                key: 'nameIDFormat',
                localPath: ['EntityDescriptor', '~SSODescriptor', 'NameIDFormat'],
                attributes: [],
            },
        ]));
        var sharedCertificate = this.meta.sharedCertificate;
        if (typeof sharedCertificate === 'string') {
            this.meta.certificate = {
                signing: sharedCertificate,
                encryption: sharedCertificate,
            };
            delete this.meta.sharedCertificate;
        }
        if (Array.isArray(this.meta.entityDescriptor) &&
            this.meta.entityDescriptor.length > 1) {
            throw new Error('ERR_MULTIPLE_METADATA_ENTITYDESCRIPTOR');
        }
    }
    /**
     * Return the underlying metadata XML.
     */
    Metadata.prototype.getMetadata = function () {
        return this.xmlString;
    };
    /**
     * Write the metadata XML to disk at the given path.
     *
     * @param exportFile absolute file path
     */
    Metadata.prototype.exportMetadata = function (exportFile) {
        fs.writeFileSync(exportFile, this.xmlString);
    };
    /**
     * Return the metadata `entityID`.
     */
    Metadata.prototype.getEntityID = function () {
        return this.meta.entityID;
    };
    /**
     * Return the X.509 certificate(s) declared in metadata for a given use.
     *
     * @param use `signing` or `encryption`
     * @returns certificate body or list, or `null` when missing
     */
    Metadata.prototype.getX509Certificate = function (use) {
        var certificate = this.meta.certificate;
        return (certificate && certificate[use]) || null;
    };
    /**
     * Return the supported NameID formats declared in metadata.
     */
    Metadata.prototype.getNameIDFormat = function () {
        return this.meta.nameIDFormat;
    };
    /**
     * Return the single-logout service endpoint for the requested binding.
     * When no binding is provided, returns the raw service list.
     *
     * @param binding `redirect`, `post`, etc.
     * @returns endpoint URL or raw service list
     */
    Metadata.prototype.getSingleLogoutService = function (binding) {
        if (binding && (0, utility_1.isString)(binding)) {
            var bindType_1 = urn_1.namespace.binding[binding];
            var singleLogoutService = this.meta.singleLogoutService;
            if (!(singleLogoutService instanceof Array)) {
                singleLogoutService = [singleLogoutService];
            }
            var service = singleLogoutService.find(function (obj) { return obj.binding === bindType_1; });
            if (service) {
                return service.location;
            }
        }
        return this.meta.singleLogoutService;
    };
    /**
     * Reduce a service descriptor array to the list of bindings it declares.
     *
     * @param services list of service descriptor objects
     * @returns supported binding keys
     */
    Metadata.prototype.getSupportBindings = function (services) {
        var supportBindings = [];
        if (services) {
            services.forEach(function (service) {
                var supportBinding = Object.keys(service)[0];
                supportBindings.push(supportBinding);
            });
        }
        return supportBindings;
    };
    return Metadata;
}());
exports.default = Metadata;
//# sourceMappingURL=metadata.js.map