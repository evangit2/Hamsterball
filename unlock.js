import {saveUnlockPayload} from './unlock-store.js?v=scoped-runtime-1';

const $ = id => document.getElementById(id);
const dropZone = $('drop-zone');
const input = $('exe-input');
const KEY_CONTEXT = new TextEncoder().encode('DirectWebGPU Hamsterball guest payload v1');

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}

async function sha256(bytes) {
  return crypto.subtle.digest('SHA-256', bytes);
}

function status(message, busy = false) {
  $('status').textContent = message;
  $('progress').hidden = !busy;
  $('exe-button').disabled = busy;
}

async function decompressGzip(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser is missing a required decompression feature. Use a current Chrome, Edge, Firefox, or Safari release.');
  }
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

async function unlock(file) {
  status('Checking executable…', true);
  try {
    const manifestResponse = await fetch('./build-manifest.json', {cache: 'no-store'});
    if (!manifestResponse.ok) throw new Error(`Could not load runtime manifest (${manifestResponse.status}).`);
    const manifest = await manifestResponse.json();
    const executable = await file.arrayBuffer();
    const digest = await sha256(executable);
    const executableSha256 = hex(digest);
    if (executableSha256 !== manifest.dependencies.executable.sha256) {
      throw new Error('That is not the supported Hamsterball.exe.');
    }

    status('Loading DirectWebGPU…', true);
    const payloadUrl = new URL(manifest.encryptedGuest.url, location.href);
    payloadUrl.searchParams.set('sha256', manifest.encryptedGuest.sha256);
    const payloadResponse = await fetch(payloadUrl, {cache: 'no-store'});
    if (!payloadResponse.ok) throw new Error(`Could not load game runtime (${payloadResponse.status}).`);
    const payload = await payloadResponse.arrayBuffer();
    if (payload.byteLength !== manifest.encryptedGuest.bytes || hex(await sha256(payload)) !== manifest.encryptedGuest.sha256) {
      throw new Error('Downloaded runtime integrity check failed.');
    }
    const ivBytes = manifest.encryptedGuest.ivBytes;
    const keyMaterial = new Uint8Array(executable.byteLength + KEY_CONTEXT.byteLength);
    keyMaterial.set(new Uint8Array(executable));
    keyMaterial.set(KEY_CONTEXT, executable.byteLength);
    const key = await crypto.subtle.importKey('raw', await sha256(keyMaterial), {name: 'AES-GCM'}, false, ['decrypt']);
    status('Preparing game…', true);
    const decrypted = await crypto.subtle.decrypt(
      {name: 'AES-GCM', iv: new Uint8Array(payload, 0, ivBytes)},
      key,
      payload.slice(ivBytes),
    );
    if (decrypted.byteLength !== manifest.encryptedGuest.decryptedBytes) throw new Error('Runtime payload size check failed.');
    const wasm = manifest.encryptedGuest.compression === 'gzip' ? await decompressGzip(decrypted) : decrypted;
    if (wasm.byteLength !== manifest.encryptedGuest.wasmBytes) throw new Error('Runtime size check failed.');
    const wasmSha256 = hex(await sha256(wasm));
    if (wasmSha256 !== manifest.encryptedGuest.plaintextSha256) {
      throw new Error('Runtime integrity check failed.');
    }
    await saveUnlockPayload({executable, wasm, executableSha256, wasmSha256});
    location.replace('./play.html?mode=wined3d-webgpu&assetCache=warm');
  } catch (error) {
    status(error.message);
  }
}

$('exe-button').addEventListener('click', () => input.click());
input.addEventListener('change', () => input.files[0] && unlock(input.files[0]));
dropZone.addEventListener('dragover', event => {
  event.preventDefault();
  dropZone.classList.add('dragging');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', event => {
  event.preventDefault();
  dropZone.classList.remove('dragging');
  const file = event.dataTransfer.files[0];
  if (file) void unlock(file);
});
