// Frame raw Opus packets as Ogg so FFmpeg can decode them without a platform-specific SDK.
// Each iterable item must be exactly one Opus packet, not an arbitrary byte chunk.
function crc32(bytes: Buffer): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 24;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x80000000 ? (crc << 1) ^ 0x04c11db7 : crc << 1;
  }
  return crc >>> 0;
}

function page(packet: Buffer, sequence: number, granule: bigint, flags = 0): Buffer {
  const segments = flags === 4 && packet.length === 0 ? 0 : Math.floor(packet.length / 255) + 1;
  if (segments > 255) throw new Error('Opus packet exceeds the Ogg page size');
  const header = Buffer.alloc(27 + segments);
  header.write('OggS'); header[5] = flags;
  header.writeBigUInt64LE(granule, 6);
  header.writeUInt32LE(1, 14); header.writeUInt32LE(sequence, 18);
  header[26] = segments;
  for (let i = 0; i < segments; i++) header[27 + i] = Math.min(255, packet.length - i * 255);
  const result = Buffer.concat([header, packet]);
  result.writeUInt32LE(crc32(result), 22);
  return result;
}

function packetSamples(packet: Buffer): number {
  if (!packet.length) throw new Error('Empty Opus packet');
  const config = packet[0] >> 3, code = packet[0] & 3;
  const duration = config < 12 ? [10, 20, 40, 60][config & 3]
    : config < 16 ? [10, 20][config & 1] : [2.5, 5, 10, 20][config & 3];
  if (code === 3 && packet.length < 2) throw new Error('Invalid Opus packet');
  const frames = code === 0 ? 1 : code === 3 ? packet[1] & 63 : 2;
  if (!frames || duration * frames > 120) throw new Error('Invalid Opus packet duration');
  return duration * frames * 48;
}

export async function* opusPacketsToOgg(input: AsyncIterable<Uint8Array>, channels: number): AsyncGenerator<Buffer> {
  if (channels !== 1 && channels !== 2) throw new Error('Raw Opus supports mono or stereo packets');
  const head = Buffer.alloc(19);
  head.write('OpusHead'); head[8] = 1; head[9] = channels; head.writeUInt32LE(48000, 12);
  const tags = Buffer.alloc(16); tags.write('OpusTags');
  yield page(head, 0, 0n, 2);
  yield page(tags, 1, 0n);
  let sequence = 2, granule = 0n;
  for await (const bytes of input) {
    if (!(bytes instanceof Uint8Array)) throw new TypeError('Audio streams must yield Uint8Array or Buffer chunks');
    const packet = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    granule += BigInt(packetSamples(packet));
    yield page(packet, sequence++, granule);
  }
  yield page(Buffer.alloc(0), sequence, granule, 4);
}
