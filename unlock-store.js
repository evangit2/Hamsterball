const LEGACY_DATABASE = 'directwebgpu-hamsterball';
const DATABASE = `${LEGACY_DATABASE}:${new URL('.', location.href).pathname}`;
const STORE = 'runtime';
const KEY = 'unlocked-guest';

function openDatabase(name = DATABASE) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveUnlockPayload(payload) {
  const database = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(payload, KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function loadUnlockPayload(executableSha256, wasmSha256) {
  let payload = await readPayload(DATABASE);
  if (!payload) payload = await readPayload(LEGACY_DATABASE);
  if (!payload || payload.executableSha256 !== executableSha256 || payload.wasmSha256 !== wasmSha256) {
    throw new Error('Choose Hamsterball.exe on the launch page first.');
  }
  if (!(payload.executable instanceof ArrayBuffer) || !(payload.wasm instanceof ArrayBuffer)) {
    throw new Error('The saved runtime is incomplete. Choose Hamsterball.exe again.');
  }
  return payload;
}

async function readPayload(databaseName) {
  const database = await openDatabase(databaseName);
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE).objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}
