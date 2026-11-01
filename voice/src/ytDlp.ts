import { spawn, ChildProcess } from 'child_process';
import { Readable } from 'stream';
import { resolveYtDlpPath } from './audioInput';

/** Optional extraction adapter. Its process starts only when the stream is read. */
export function extractAudioWithYtDlp(input: string, binary = resolveYtDlpPath()): Readable {
  let child: ChildProcess | undefined, timeout: NodeJS.Timeout | undefined, stderr = '';
  const output = new Readable({
    read() {
      if (child) { child.stdout?.resume(); return; }
      child = spawn(binary, ['-f', 'bestaudio/best', '-o', '-', '--no-playlist', '--no-warnings', '--default-search', 'ytsearch', '--', input],
        { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      timeout = setTimeout(() => output.destroy(new Error('Timeout waiting for extraction output')), 30000);
      child.stdout?.on('data', bytes => {
        clearTimeout(timeout);
        if (!output.push(bytes)) child?.stdout?.pause();
      });
      child.stdout?.on('error', error => output.destroy(error));
      child.stderr?.on('data', bytes => { stderr = (stderr + bytes.toString()).slice(-8192); });
      child.on('error', error => output.destroy(error));
      child.on('close', code => {
        clearTimeout(timeout);
        if (output.destroyed) return;
        if (code !== 0) output.destroy(new Error('yt-dlp exited with code ' + code + ': ' + stderr));
        else output.push(null);
      });
    },
    destroy(error, callback) {
      clearTimeout(timeout); child?.stdout?.destroy(); child?.kill(); callback(error);
    },
  });
  return output;
}

/**
 * Probe audio info from a URL or search query
 * If input is not a URL, it will search YouTube
 */
export async function probeAudioInfo(input: string, ytDlpPath?: string): Promise<{
  title: string;
  duration: number;
  thumbnail?: string;
  url: string;
}> {
  return new Promise((resolve, reject) => {
    let searchQuery = input;
    if (!/^https?:\/\//.test(input) && !input.startsWith('ytsearch')) {
      searchQuery = 'ytsearch1:' + input;
    }
    const ytdlp = spawn(ytDlpPath || resolveYtDlpPath(),
      ['--no-playlist', '--no-warnings', '-j', '--', searchQuery],
      { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => finish(new Error('Timeout waiting for audio info')), 30000);
    const finish = (error?: Error, info?: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) {
        ytdlp.kill();
        reject(error);
      } else {
        resolve({ title: info?.title || 'Unknown', duration: info?.duration || 0,
          thumbnail: info?.thumbnail, url: info?.webpage_url || info?.url || input });
      }
    };
    ytdlp.stdout?.on('data', data => {
      stdout += data.toString();
      if (Buffer.byteLength(stdout) > 1024 * 1024) finish(new Error('Audio info response exceeds size limit'));
    });
    ytdlp.stderr?.on('data', data => { stderr = (stderr + data.toString()).slice(-8192); });
    ytdlp.on('error', error => finish(new Error('Failed to probe audio info: ' + error.message)));
    ytdlp.on('close', code => {
      if (settled) return;
      if (code !== 0) return finish(new Error('yt-dlp failed (code ' + code + '): ' + stderr));
      try { finish(undefined, JSON.parse(stdout)); }
      catch { finish(new Error('Failed to parse yt-dlp output')); }
    });
  });
}
