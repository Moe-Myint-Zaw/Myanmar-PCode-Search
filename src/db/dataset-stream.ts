import { sha256 } from '@noble/hashes/sha2.js';

import { AppError } from '@/types/errors';
import type { DatasetMetadata, PlaceInput } from '@/types/pcode';
import { validatePlaceInput } from './dataset-validation';
import { validateDatasetMetadata } from './metadata';

const MAX_TOKEN_SIZE = 1_048_576; // 1MB per token
const MAX_DATASET_STREAM_SIZE = 100 * 1024 * 1024; // 100MB total
const MAX_NESTING_DEPTH = 100;

type Punctuation = '{' | '}' | '[' | ']' | ':' | ',';

type Token =
  | { type: 'punctuation'; value: Punctuation }
  | { type: 'string'; value: string }
  | { type: 'value'; value: unknown };

export type DatasetStreamSummary = {
  metadata: DatasetMetadata;
  recordCount: number;
  checksum: string;
};

class JsonTokenizer {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly decoder = new TextDecoder();
  private buffer = '';
  private ended = false;
  private totalBytesRead = 0;
  private nestingDepth = 0;

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
  }

  async next(): Promise<Token | null> {
    while (true) {
      let index = 0;
      while (index < this.buffer.length && /\s/.test(this.buffer[index]!)) index++;
      if (index === this.buffer.length) {
        this.buffer = '';
        if (this.ended) return null;
        await this.readMore();
        continue;
      }

      const first = this.buffer[index]!;
      if ('{}[]:,'.includes(first)) {
        this.buffer = this.buffer.slice(index + 1);
        if (first === '{' || first === '[') {
          this.nestingDepth++;
          if (this.nestingDepth > MAX_NESTING_DEPTH) {
            throw new AppError('DATASET_INVALID', 'JSON nesting depth exceeds maximum limit.');
          }
        } else if (first === '}' || first === ']') {
          this.nestingDepth--;
        }
        return { type: 'punctuation', value: first as Punctuation };
      }

      if (first === '"') {
        let escaped = false;
        let end = index + 1;
        for (; end < this.buffer.length; end++) {
          const character = this.buffer[end]!;
          if (escaped) {
            escaped = false;
          } else if (character === '\\') {
            escaped = true;
          } else if (character === '"') {
            const jsonString = this.buffer.slice(index, end + 1);
            if (jsonString.length > MAX_TOKEN_SIZE) {
              throw new AppError('DATASET_INVALID', 'JSON token size exceeds maximum limit.');
            }
            const value: unknown = JSON.parse(jsonString);
            this.buffer = this.buffer.slice(end + 1);
            if (typeof value !== 'string') throw new Error('Invalid JSON string token.');
            return { type: 'string', value };
          }
        }
        if (this.ended) throw new Error('Unterminated JSON string.');
        await this.readMore();
        continue;
      }

      let end = index;
      while (end < this.buffer.length && !/[\s{}\[\]:,]/.test(this.buffer[end]!)) end++;
      if (end === this.buffer.length && !this.ended) {
        await this.readMore();
        continue;
      }
      if (end === index) throw new Error('Invalid JSON token.');
      const raw = this.buffer.slice(index, end);
      if (raw.length > MAX_TOKEN_SIZE) {
        throw new AppError('DATASET_INVALID', 'JSON token size exceeds maximum limit.');
      }
      const value: unknown = JSON.parse(raw);
      this.buffer = this.buffer.slice(end);
      return { type: 'value', value };
    }
  }

  async nextRawValue(): Promise<string | null> {
    while (true) {
      let whitespaceEnd = 0;
      while (whitespaceEnd < this.buffer.length && /\s/.test(this.buffer[whitespaceEnd]!)) {
        whitespaceEnd++;
      }
      if (whitespaceEnd > 0) this.buffer = this.buffer.slice(whitespaceEnd);
      if (this.buffer.length > 0) break;
      if (this.ended) throw new Error('Unexpected end of JSON.');
      await this.readMore();
    }

    const first = this.buffer[0]!;
    if (first === ']') {
      this.buffer = this.buffer.slice(1);
      return null;
    }
    if (first !== '{' && first !== '[') {
      const token = await this.next();
      if (!token) throw new Error('Unexpected end of JSON.');
      if (token.type === 'punctuation') {
        throw new Error(`Expected a JSON value but found ${JSON.stringify(token.value)}.`);
      }
      return JSON.stringify(token.value);
    }

    let cursor = 0;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let rawPrefix = '';
    while (true) {
      while (cursor < this.buffer.length) {
        const character = this.buffer[cursor]!;
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (character === '\\') {
            escaped = true;
          } else if (character === '"') {
            inString = false;
          }
        } else if (character === '"') {
          inString = true;
        } else if (character === '{' || character === '[') {
          depth++;
        } else if (character === '}' || character === ']') {
          depth--;
          if (depth === 0) {
            const raw = rawPrefix + this.buffer.slice(0, cursor + 1);
            this.buffer = this.buffer.slice(cursor + 1);
            return raw;
          }
        }
        cursor++;
      }

      if (this.ended) throw new Error('Unexpected end of JSON value.');
      rawPrefix += this.buffer.slice(0, cursor);
      this.buffer = this.buffer.slice(cursor);
      cursor = 0;
      await this.readMore();
    }
  }

  async close(): Promise<void> {
    try {
      await this.reader.cancel();
    } finally {
      this.reader.releaseLock();
    }
  }

  private async readMore(): Promise<void> {
    const result = await this.reader.read();
    if (result.value) {
      this.totalBytesRead += result.value.length;
      if (this.totalBytesRead > MAX_DATASET_STREAM_SIZE) {
        throw new AppError(
          'DATASET_INVALID',
          `Dataset file is too large. Maximum size is ${(MAX_DATASET_STREAM_SIZE / 1024 / 1024).toFixed(0)}MB.`,
        );
      }
    }
    this.buffer += this.decoder.decode(result.value, { stream: !result.done });
    if (result.done) {
      this.buffer += this.decoder.decode();
      this.ended = true;
    }
  }
}

async function parseValue(tokenizer: JsonTokenizer, firstToken?: Token | null): Promise<unknown> {
  const token = firstToken === undefined ? await tokenizer.next() : firstToken;
  if (!token) throw new Error('Unexpected end of JSON.');
  if (token.type === 'string' || token.type === 'value') return token.value;

  if (token.value === '{') {
    const object: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    let next = await tokenizer.next();
    if (next?.type === 'punctuation' && next.value === '}') return object;

    while (true) {
      if (next?.type !== 'string') throw new Error('Expected a JSON object key.');
      const key = next.value;
      const colon = await tokenizer.next();
      if (colon?.type !== 'punctuation' || colon.value !== ':') throw new Error('Expected a colon.');
      object[key] = await parseValue(tokenizer);
      const separator = await tokenizer.next();
      if (separator?.type === 'punctuation' && separator.value === '}') return object;
      if (separator?.type !== 'punctuation' || separator.value !== ',') {
        throw new Error('Expected a comma or closing brace.');
      }
      next = await tokenizer.next();
    }
  }

  if (token.value === '[') {
    const values: unknown[] = [];
    let next = await tokenizer.next();
    if (next?.type === 'punctuation' && next.value === ']') return values;
    while (true) {
      values.push(await parseValue(tokenizer, next));
      const separator = await tokenizer.next();
      if (separator?.type === 'punctuation' && separator.value === ']') return values;
      if (separator?.type !== 'punctuation' || separator.value !== ',') {
        throw new Error('Expected a comma or closing bracket.');
      }
      next = await tokenizer.next();
    }
  }

  throw new Error('Unexpected JSON punctuation.');
}

function isDatasetMetadata(value: unknown): value is DatasetMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const metadata = value as Partial<DatasetMetadata>;
  return (
    typeof metadata.datasetVersion === 'string' &&
    typeof metadata.generatedAt === 'string' &&
    typeof metadata.source === 'string' &&
    typeof metadata.recordCount === 'number' &&
    typeof metadata.schemaVersion === 'number' &&
    typeof metadata.checksum === 'string'
  );
}

export async function scanCompactDatasetStream(
  stream: ReadableStream<Uint8Array>,
  onPlace: (place: PlaceInput) => Promise<void> = async () => {},
): Promise<DatasetStreamSummary> {
  const tokenizer = new JsonTokenizer(stream);
  const hash = sha256.create();
  const encoder = new TextEncoder();
  const pcodes = new Set<string>();
  let metadata: unknown;
  let metadataSeen = false;
  let placesSeen = false;
  let recordCount = 0;

  try {
    const opening = await tokenizer.next();
    if (opening?.type !== 'punctuation' || opening.value !== '{') {
      throw new Error('Dataset must be a JSON object.');
    }
    let next = await tokenizer.next();
    if (next?.type === 'punctuation' && next.value === '}') {
      throw new AppError('DATASET_INVALID', 'Dataset must contain metadata and a places array.');
    }

    while (true) {
      if (next?.type !== 'string') throw new Error('Expected a top-level JSON key.');
      const key = next.value;
      const colon = await tokenizer.next();
      if (colon?.type !== 'punctuation' || colon.value !== ':') throw new Error('Expected a colon.');

      if (key === 'metadata') {
        if (metadataSeen) throw new AppError('DATASET_INVALID', 'Dataset contains duplicate metadata.');
        metadata = await parseValue(tokenizer);
        metadataSeen = true;
      } else if (key === 'places') {
        if (placesSeen) throw new AppError('DATASET_INVALID', 'Dataset contains duplicate places arrays.');
        placesSeen = true;
        const placesOpening = await tokenizer.next();
        if (placesOpening?.type !== 'punctuation' || placesOpening.value !== '[') {
          throw new AppError('DATASET_INVALID', 'Dataset must contain a places array.');
        }
        hash.update(encoder.encode('['));
        let placeRaw = await tokenizer.nextRawValue();
        if (placeRaw === null) {
          hash.update(encoder.encode(']'));
        } else {
          while (true) {
            const value: unknown = JSON.parse(placeRaw);
            const validationError = validatePlaceInput(value);
            if (validationError) throw new AppError('DATASET_INVALID', validationError);
            const place = value as PlaceInput;
            if (pcodes.has(place.pcode)) {
              throw new AppError('DATASET_INVALID', `Duplicate PCode: ${place.pcode}`);
            }
            pcodes.add(place.pcode);
            if (recordCount > 0) hash.update(encoder.encode(','));
            hash.update(encoder.encode(JSON.stringify(place)));
            recordCount++;
            await onPlace(place);

            const separator = await tokenizer.next();
            if (separator?.type === 'punctuation' && separator.value === ']') {
              hash.update(encoder.encode(']'));
              break;
            }
            if (separator?.type !== 'punctuation' || separator.value !== ',') {
              throw new Error('Expected a comma or closing bracket.');
            }
            const nextPlaceRaw = await tokenizer.nextRawValue();
            if (nextPlaceRaw === null) throw new Error('Expected a JSON value after the comma.');
            placeRaw = nextPlaceRaw;
          }
        }
      } else {
        await parseValue(tokenizer);
      }

      const separator = await tokenizer.next();
      if (separator?.type === 'punctuation' && separator.value === '}') break;
      if (separator?.type !== 'punctuation' || separator.value !== ',') {
        throw new Error('Expected a comma or closing brace.');
      }
      next = await tokenizer.next();
    }

    if (await tokenizer.next()) throw new Error('Unexpected data after the dataset object.');
    if (!metadataSeen || !placesSeen) {
      throw new AppError('DATASET_INVALID', 'Dataset must contain metadata and a places array.');
    }
    if (!isDatasetMetadata(metadata)) {
      throw new AppError('DATASET_INVALID', 'Dataset metadata is incomplete or invalid.');
    }
    const metadataError = validateDatasetMetadata(metadata, recordCount);
    if (metadataError) throw new AppError('DATASET_INVALID', metadataError);

    const checksum = Array.from(hash.digest(), (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (checksum.toLowerCase() !== metadata.checksum.toLowerCase()) {
      throw new AppError('DATASET_INVALID', 'Dataset checksum does not match its places array.');
    }
    return { metadata, recordCount, checksum };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('DATASET_INVALID', 'Dataset file is not valid JSON.', { cause: error });
  } finally {
    await tokenizer.close();
  }
}
