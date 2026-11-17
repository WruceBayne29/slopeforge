/**
 * Shareable URLs: the whole project is stored in the URL fragment (`#m=…`), so sharing needs
 * no server and the model never leaves the browser. Payload: `1.` + base64url(deflate(JSON))
 * where the browser supports CompressionStream, otherwise `0.` + base64url(JSON).
 */
import type { Project } from '../model/project';
import { parseProject, ProjectFormatError } from './projectFile';

const PARAM = 'm';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipe(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const source = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(source).arrayBuffer());
}

/** Drops fields that only bloat the URL. */
function compact(project: Project): unknown {
  return JSON.parse(JSON.stringify(project)) as unknown;
}

export async function encodeProject(project: Project): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(compact(project)));
  if (typeof CompressionStream === 'function') {
    return `1.${toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')))}`;
  }
  return `0.${toBase64Url(bytes)}`;
}

export async function decodeProject(payload: string): Promise<Project> {
  const dot = payload.indexOf('.');
  const mode = payload.slice(0, dot);
  const body = payload.slice(dot + 1);
  if (dot < 1 || (mode !== '0' && mode !== '1')) {
    throw new ProjectFormatError('This link does not contain an SlopeForge section.');
  }
  try {
    let bytes = fromBase64Url(body);
    if (mode === '1') {
      if (typeof DecompressionStream !== 'function') {
        throw new ProjectFormatError('This browser cannot open compressed share links.');
      }
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    }
    return parseProject(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (e) {
    if (e instanceof ProjectFormatError) throw e;
    throw new ProjectFormatError('This link is damaged or incomplete.');
  }
}

/** Builds a full share URL for the given page URL. */
export async function shareUrl(project: Project, pageUrl: string): Promise<string> {
  const url = new URL(pageUrl);
  url.hash = `${PARAM}=${await encodeProject(project)}`;
  return url.toString();
}

/** Extracts the model payload from a URL fragment, if there is one. */
export function payloadFromHash(hash: string): string | null {
  const match = /^#?m=(.+)$/.exec(hash);
  return match ? match[1] : null;
}
