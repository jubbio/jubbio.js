"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveYtDlpPath = resolveYtDlpPath;
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
function resolveYtDlpPath() {
    const local = path_1.default.join(os_1.default.homedir(), '.local', 'bin', 'yt-dlp');
    return process.platform !== 'win32' && (0, fs_1.existsSync)(local) ? local : 'yt-dlp';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9JbnB1dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9hdWRpb0lucHV0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBSUEsNENBR0M7QUFQRCw0Q0FBb0I7QUFDcEIsZ0RBQXdCO0FBQ3hCLDJCQUFnQztBQUVoQyxTQUFnQixnQkFBZ0I7SUFDOUIsTUFBTSxLQUFLLEdBQUcsY0FBSSxDQUFDLElBQUksQ0FBQyxZQUFFLENBQUMsT0FBTyxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNqRSxPQUFPLE9BQU8sQ0FBQyxRQUFRLEtBQUssT0FBTyxJQUFJLElBQUEsZUFBVSxFQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUM5RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgZXhpc3RzU3luYyB9IGZyb20gJ2ZzJztcblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVZdERscFBhdGgoKTogc3RyaW5nIHtcbiAgY29uc3QgbG9jYWwgPSBwYXRoLmpvaW4ob3MuaG9tZWRpcigpLCAnLmxvY2FsJywgJ2JpbicsICd5dC1kbHAnKTtcbiAgcmV0dXJuIHByb2Nlc3MucGxhdGZvcm0gIT09ICd3aW4zMicgJiYgZXhpc3RzU3luYyhsb2NhbCkgPyBsb2NhbCA6ICd5dC1kbHAnO1xufVxyXG4iXX0=