"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutResponseFields = exports.logoutRequestFields = exports.loginResponseFields = exports.logoutResponseStatusFields = exports.loginResponseStatusFields = exports.loginRequestFields = void 0;
exports.extract = extract;
/**
 * @file extractor.ts
 * @author tngan
 * @desc Declarative XPath extractor for SAML messages. Defines the field
 * catalogs (login/logout request & response) and a generic `extract` that
 * evaluates them against an XML document.
 */
var xpath_1 = require("xpath");
var utility_1 = require("./utility");
var api_1 = require("./api");
/**
 * Coerce the heterogeneous return type of `xpath.select` into a Node array.
 */
function toNodeArray(result) {
    if (Array.isArray(result))
        return result;
    if (result != null && typeof result === 'object' && 'nodeType' in result) {
        return [result];
    }
    return [];
}
/**
 * Build an absolute XPath expression from a list of local-name segments.
 * A segment prefixed with `~` matches any element whose local-name contains
 * the remaining text (case-sensitive substring).
 */
function buildAbsoluteXPath(paths) {
    return paths.reduce(function (currentPath, name) {
        var isWildcard = name.startsWith('~');
        if (isWildcard) {
            var pathName = name.replace('~', '');
            return currentPath + "/*[contains(local-name(), ".concat((0, utility_1.escapeXPathValue)(pathName), ")]");
        }
        return currentPath + "/*[local-name(.)=".concat((0, utility_1.escapeXPathValue)(name), "]");
    }, '');
}
/**
 * Append an attribute selector to an XPath. Zero attributes select text
 * content; one attribute selects that attribute; multiple attributes use an
 * `or` filter.
 */
function buildAttributeXPath(attributes) {
    if (attributes.length === 0) {
        return '/text()';
    }
    if (attributes.length === 1) {
        return "/@".concat(attributes[0]);
    }
    var filters = attributes.map(function (attribute) { return "name()=".concat((0, utility_1.escapeXPathValue)(attribute)); }).join(' or ');
    return "/@*[".concat(filters, "]");
}
/** Default extractor fields for an inbound `AuthnRequest` (login request). */
exports.loginRequestFields = [
    {
        key: 'request',
        localPath: ['AuthnRequest'],
        attributes: ['ID', 'IssueInstant', 'Destination', 'AssertionConsumerServiceURL'],
    },
    {
        key: 'issuer',
        localPath: ['AuthnRequest', 'Issuer'],
        attributes: [],
    },
    {
        key: 'nameIDPolicy',
        localPath: ['AuthnRequest', 'NameIDPolicy'],
        attributes: ['Format', 'AllowCreate'],
    },
    {
        key: 'authnContextClassRef',
        localPath: ['AuthnRequest', 'AuthnContextClassRef'],
        attributes: [],
    },
    {
        key: 'signature',
        localPath: ['AuthnRequest', 'Signature'],
        attributes: [],
        context: true,
    },
];
/** Two-tier status code extractor for login responses. */
exports.loginResponseStatusFields = [
    {
        key: 'top',
        localPath: ['Response', 'Status', 'StatusCode'],
        attributes: ['Value'],
    },
    {
        key: 'second',
        localPath: ['Response', 'Status', 'StatusCode', 'StatusCode'],
        attributes: ['Value'],
    },
];
/** Two-tier status code extractor for logout responses. */
exports.logoutResponseStatusFields = [
    {
        key: 'top',
        localPath: ['LogoutResponse', 'Status', 'StatusCode'],
        attributes: ['Value'],
    },
    {
        key: 'second',
        localPath: ['LogoutResponse', 'Status', 'StatusCode', 'StatusCode'],
        attributes: ['Value'],
    },
];
/**
 * Build the login-response extractor bound to a particular assertion XML.
 * Assertion-scoped fields are re-rooted at the assertion fragment via the
 * `shortcut` mechanism so that wrapping attacks can't redirect extraction.
 *
 * @param assertion XML string of the (verified) assertion node
 * @returns extractor fields ready for `extract`
 */
var loginResponseFields = function (assertion) { return [
    {
        key: 'conditions',
        localPath: ['Assertion', 'Conditions'],
        attributes: ['NotBefore', 'NotOnOrAfter'],
        shortcut: assertion,
    },
    {
        key: 'response',
        localPath: ['Response'],
        attributes: ['ID', 'IssueInstant', 'Destination', 'InResponseTo'],
    },
    {
        key: 'audience',
        localPath: ['Assertion', 'Conditions', 'AudienceRestriction', 'Audience'],
        attributes: [],
        shortcut: assertion,
    },
    {
        key: 'issuer',
        localPath: ['Assertion', 'Issuer'],
        attributes: [],
        shortcut: assertion,
    },
    {
        key: 'nameID',
        localPath: ['Assertion', 'Subject', 'NameID'],
        attributes: [],
        shortcut: assertion,
    },
    {
        key: 'sessionIndex',
        localPath: ['Assertion', 'AuthnStatement'],
        attributes: ['AuthnInstant', 'SessionNotOnOrAfter', 'SessionIndex'],
        shortcut: assertion,
    },
    {
        key: 'attributes',
        localPath: ['Assertion', 'AttributeStatement', 'Attribute'],
        index: ['Name'],
        attributePath: ['AttributeValue'],
        attributes: [],
        shortcut: assertion,
    },
]; };
exports.loginResponseFields = loginResponseFields;
/** Default extractor fields for an inbound `LogoutRequest`. */
exports.logoutRequestFields = [
    {
        key: 'request',
        localPath: ['LogoutRequest'],
        attributes: ['ID', 'IssueInstant', 'Destination'],
    },
    {
        key: 'issuer',
        localPath: ['LogoutRequest', 'Issuer'],
        attributes: [],
    },
    {
        key: 'nameID',
        localPath: ['LogoutRequest', 'NameID'],
        attributes: [],
    },
    {
        key: 'sessionIndex',
        localPath: ['LogoutRequest', 'SessionIndex'],
        attributes: [],
    },
    {
        key: 'signature',
        localPath: ['LogoutRequest', 'Signature'],
        attributes: [],
        context: true,
    },
];
/** Default extractor fields for an inbound `LogoutResponse`. */
exports.logoutResponseFields = [
    {
        key: 'response',
        localPath: ['LogoutResponse'],
        attributes: ['ID', 'Destination', 'InResponseTo'],
    },
    {
        key: 'issuer',
        localPath: ['LogoutResponse', 'Issuer'],
        attributes: [],
    },
    {
        key: 'signature',
        localPath: ['LogoutResponse', 'Signature'],
        attributes: [],
        context: true,
    },
];
/**
 * Evaluate the given extractor fields against an XML document and return
 * a flat object keyed by `field.key`. Handles:
 *   - multi-path localPaths (`string[][]`) collected with `|`
 *   - parent/child attribute aggregation (`index` + `attributePath`)
 *   - whole-subtree extraction (`context: true`)
 *   - single/multiple/zero-attribute text extraction
 *
 * @param context XML string to parse
 * @param fields extractor field definitions
 * @returns extracted SAML values keyed by field name
 */
function extract(context, fields) {
    var dom = (0, api_1.getContext)().dom;
    var rootDoc = dom.parseFromString(context);
    return fields.reduce(function (result, field) {
        var key = field.key, localPath = field.localPath, attributes = field.attributes, isEntire = field.context, shortcut = field.shortcut, index = field.index, attributePath = field.attributePath;
        var targetDoc = rootDoc;
        if (shortcut) {
            targetDoc = dom.parseFromString(shortcut);
        }
        // Multi-path union: each entry is a separate localPath whose text()
        // values are merged.
        if (localPath.every(function (path) { return Array.isArray(path); })) {
            var multiXPaths = localPath
                .map(function (path) { return "".concat(buildAbsoluteXPath(path), "/text()"); })
                .join(' | ');
            result[key] = (0, utility_1.uniq)(toNodeArray((0, xpath_1.select)(multiXPaths, targetDoc))
                .map(function (n) { return n.nodeValue; })
                .filter(utility_1.notEmpty));
            return result;
        }
        var baseXPath = buildAbsoluteXPath(localPath);
        var attributeXPath = buildAttributeXPath(attributes);
        // Parent/child aggregation (e.g. SAML Attribute → AttributeValue).
        if (index && attributePath) {
            var indexPath = buildAttributeXPath(index);
            var fullLocalXPath = "".concat(baseXPath).concat(indexPath);
            var parentNodes = toNodeArray((0, xpath_1.select)(baseXPath, targetDoc));
            var parentAttributes = toNodeArray((0, xpath_1.select)(fullLocalXPath, targetDoc)).map(function (n) { return n.value; });
            var childXPath = buildAbsoluteXPath([(0, utility_1.last)(localPath)].concat(attributePath));
            var childAttributeXPath = buildAttributeXPath(attributes);
            var fullChildXPath_1 = "".concat(childXPath).concat(childAttributeXPath);
            var childAttributes = parentNodes.map(function (node) {
                var nodeDoc = dom.parseFromString(node.toString());
                if (attributes.length === 0) {
                    var childValues = toNodeArray((0, xpath_1.select)(fullChildXPath_1, nodeDoc)).map(function (n) { return n.nodeValue; });
                    return childValues.length === 1 ? childValues[0] : childValues;
                }
                if (attributes.length > 0) {
                    var childValues = toNodeArray((0, xpath_1.select)(fullChildXPath_1, nodeDoc)).map(function (n) { return n.value; });
                    return childValues.length === 1 ? childValues[0] : childValues;
                }
                return null;
            });
            result[key] = (0, utility_1.zipObject)(parentAttributes, childAttributes, false);
            return result;
        }
        // Whole-subtree capture.
        if (isEntire) {
            var nodes = toNodeArray((0, xpath_1.select)(baseXPath, targetDoc));
            var value = null;
            if (nodes.length === 1) {
                value = nodes[0].toString();
            }
            else if (nodes.length > 1) {
                value = nodes.map(function (n) { return n.toString(); });
            }
            result[key] = value;
            return result;
        }
        // Multi-attribute capture: produce one record per parent node.
        if (attributes.length > 1) {
            var baseNode = toNodeArray((0, xpath_1.select)(baseXPath, targetDoc)).map(function (n) { return n.toString(); });
            var childXPath_1 = "".concat(buildAbsoluteXPath([(0, utility_1.last)(localPath)])).concat(attributeXPath);
            var attributeValues = baseNode.map(function (node) {
                var nodeDoc = dom.parseFromString(node);
                return toNodeArray((0, xpath_1.select)(childXPath_1, nodeDoc)).reduce(function (r, n) {
                    r[(0, utility_1.camelCase)(n.name)] = n.value;
                    return r;
                }, {});
            });
            result[key] = (attributeValues.length === 1 ? attributeValues[0] : attributeValues);
            return result;
        }
        // Single-attribute capture.
        if (attributes.length === 1) {
            var fullPath = "".concat(baseXPath).concat(attributeXPath);
            var attributeValues = toNodeArray((0, xpath_1.select)(fullPath, targetDoc)).map(function (n) { return n.value; });
            result[key] = attributeValues[0];
            return result;
        }
        // Zero-attribute capture: element text content.
        if (attributes.length === 0) {
            var attributeValue = null;
            var nodes = toNodeArray((0, xpath_1.select)(baseXPath, targetDoc));
            if (nodes.length === 1) {
                var fullPath = "string(".concat(baseXPath).concat(attributeXPath, ")");
                var strResult = (0, xpath_1.select)(fullPath, targetDoc);
                // `string(...)` always evaluates to a string in XPath 1.0, but the
                // type signature is wider — the alternative branches are defensive.
                /* v8 ignore next 7 */
                attributeValue =
                    typeof strResult === 'string'
                        ? strResult
                        : strResult === null
                            ? null
                            : Array.isArray(strResult)
                                ? strResult
                                : null;
            }
            if (nodes.length > 1) {
                attributeValue = nodes
                    .filter(function (n) { return n.firstChild; })
                    .map(function (n) { return n.firstChild.nodeValue; });
            }
            result[key] = attributeValue;
            return result;
        }
        /* v8 ignore next */
        return result;
    }, {});
}
//# sourceMappingURL=extractor.js.map