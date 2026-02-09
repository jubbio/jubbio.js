interface TranscriptionSegment {
    id: string;
    text: string;
    startTime: bigint;
    endTime: bigint;
    language: string;
    final: boolean;
}
interface Transcription {
    participantIdentity: string;
    trackSid: string;
    segments: TranscriptionSegment[];
}

export type { Transcription, TranscriptionSegment };
