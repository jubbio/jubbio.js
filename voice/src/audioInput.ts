import os from 'os';
import path from 'path';
import { existsSync } from 'fs';

export function resolveYtDlpPath(): string {
  const local = path.join(os.homedir(), '.local', 'bin', 'yt-dlp');
  return process.platform !== 'win32' && existsSync(local) ? local : 'yt-dlp';
}
