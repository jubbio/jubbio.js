import { Readable } from 'stream';
/** Optional extraction adapter. Its process starts only when the stream is read. */
export declare function extractAudioWithYtDlp(input: string, binary?: string): Readable;
/**
 * Probe audio info from a URL or search query
 * If input is not a URL, it will search YouTube
 */
export declare function probeAudioInfo(input: string, ytDlpPath?: string): Promise<{
    title: string;
    duration: number;
    thumbnail?: string;
    url: string;
}>;
