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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContext = getContext;
exports.setSchemaValidator = setSchemaValidator;
exports.setDOMParserOptions = setDOMParserOptions;
/**
 * @file api.ts
 * @author tngan
 * @desc Global module configuration: XML schema validator and DOM parser.
 */
var xmldom_1 = require("@xmldom/xmldom");
var XXE_SAFE_OPTIONS = {
    /**
     * Treat XML parsing errors as fatal to prevent XXE attacks.
     * Entity references (e.g. &xxe;) and malformed XML in SAML messages
     * are not expected and may indicate an attack attempt.
     */
    errorHandler: {
        error: function (msg) { throw new Error("XML parsing error: ".concat(msg)); },
        fatalError: function (msg) { throw new Error("XML fatal error: ".concat(msg)); },
    },
};
var context = {
    validate: undefined,
    dom: new xmldom_1.DOMParser(XXE_SAFE_OPTIONS),
};
/**
 * Return the module-wide runtime context (DOM parser and validator).
 *
 * @returns shared context object
 */
function getContext() {
    return context;
}
/**
 * Register the caller-supplied SAML schema validator. Throws when the
 * supplied value does not expose a `validate` callback.
 *
 * @param params object with a `validate(xml)` callback
 */
function setSchemaValidator(params) {
    if (typeof params.validate !== 'function') {
        throw new Error('validate must be a callback function having one argument as xml input');
    }
    context.validate = params.validate;
}
/**
 * Replace the module-wide DOM parser with one configured by the caller.
 *
 * The XXE-safe error handlers are merged into the supplied options as a
 * baseline so callers can override unrelated settings without
 * accidentally disabling XXE protection (`saml-core §6.4`,
 * `saml-sec-consider §6.3.1`). A caller can still opt out by passing
 * its own `errorHandler`, but it must do so explicitly.
 *
 * @param options xmldom parser options
 */
function setDOMParserOptions(options) {
    var _a;
    if (options === void 0) { options = {}; }
    context.dom = new xmldom_1.DOMParser(__assign(__assign(__assign({}, XXE_SAFE_OPTIONS), options), { errorHandler: (_a = options.errorHandler) !== null && _a !== void 0 ? _a : XXE_SAFE_OPTIONS.errorHandler }));
}
//# sourceMappingURL=api.js.map