"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var rpc_exports = {};
__export(rpc_exports, {
  RpcError: () => RpcError
});
module.exports = __toCommonJS(rpc_exports);
const _RpcError = class _RpcError extends Error {
  /**
   * Creates an error object with the given code and message, plus an optional data payload.
   *
   * If thrown in an RPC method handler, the error will be sent back to the caller.
   *
   * Error codes 1001-1999 are reserved for built-in errors (see RpcError.ErrorCode for their meanings).
   */
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.message = message;
    this.data = data;
  }
  static fromProto(proto) {
    return new _RpcError(proto.code, proto.message, proto.data);
  }
  toProto() {
    return {
      code: this.code,
      message: this.message,
      data: this.data
    };
  }
  /**
   * Creates an error object from the code, with an auto-populated message.
   *
   * @internal
   */
  static builtIn(key, data) {
    return new _RpcError(_RpcError.ErrorCode[key], _RpcError.ErrorMessage[key], data);
  }
};
_RpcError.ErrorCode = {
  APPLICATION_ERROR: 1500,
  CONNECTION_TIMEOUT: 1501,
  RESPONSE_TIMEOUT: 1502,
  RECIPIENT_DISCONNECTED: 1503,
  RESPONSE_PAYLOAD_TOO_LARGE: 1504,
  SEND_FAILED: 1505,
  UNSUPPORTED_METHOD: 1400,
  RECIPIENT_NOT_FOUND: 1401,
  REQUEST_PAYLOAD_TOO_LARGE: 1402,
  UNSUPPORTED_SERVER: 1403
};
/**
 * @internal
 */
_RpcError.ErrorMessage = {
  APPLICATION_ERROR: "Application error in method handler",
  CONNECTION_TIMEOUT: "Connection timeout",
  RESPONSE_TIMEOUT: "Response timeout",
  RECIPIENT_DISCONNECTED: "Recipient disconnected",
  RESPONSE_PAYLOAD_TOO_LARGE: "Response payload too large",
  SEND_FAILED: "Failed to send",
  UNSUPPORTED_METHOD: "Method not supported at destination",
  RECIPIENT_NOT_FOUND: "Recipient not found",
  REQUEST_PAYLOAD_TOO_LARGE: "Request payload too large",
  UNSUPPORTED_SERVER: "RPC not supported by server"
};
let RpcError = _RpcError;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RpcError
});
//# sourceMappingURL=rpc.cjs.map