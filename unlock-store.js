const DATABASE = 'directwebgpu-hamsterball';
const STORE = 'runtime';
const KEY = 'unlocked-guest';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
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
  const database = await openDatabase();
  try {
    const payload = await new Promise((resolve, reject) => {
      const request = database.transaction(STORE).objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!payload || payload.executableSha256 !== executableSha256 || payload.wasmSha256 !== wasmSha256) {
      throw new Error('Choose Hamsterball.exe on the launch page first.');
    }
    if (!(payload.executable instanceof ArrayBuffer) || !(payload.wasm instanceof ArrayBuffer)) {
      throw new Error('The saved runtime is incomplete. Choose Hamsterball.exe again.');
    }
    return payload;
  } finally {
    database.close();
  }
}
