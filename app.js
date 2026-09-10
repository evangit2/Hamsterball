const COMPANION = 'http://127.0.0.1:8799';
const $ = id => document.getElementById(id);
const state = {companion: false, executable: null};

function setStatus(message, detail = '') {
  $('status').textContent = message;
  $('detail').textContent = detail;
}

function updateStart() {
  $('launch-button').disabled = !(state.companion && state.executable);
}

async function chooseExecutable(file) {
  if (!file || file.name.toLowerCase() !== 'hamsterball.exe') {
    throw new Error('Choose Hamsterball.exe');
  }
  const signature = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (signature[0] !== 0x4d || signature[1] !== 0x5a) throw new Error('That file is not a Windows executable');
  state.executable = file;
  setStatus('Ready', `${file.name} · ${(file.size / 1048576).toFixed(1)} MB`);
  updateStart();
}

async function checkCompanion() {
  try {
    const response = await fetch(`${COMPANION}/health`, {signal: AbortSignal.timeout(1500)});
    if (!response.ok) throw new Error();
    state.companion = true;
    if (!state.executable) setStatus('DirectWebGPU ready', 'Choose Hamsterball.exe');
  } catch {
    state.companion = false;
    setStatus('Start the local companion', 'Run: python3 companion.py');
  }
  updateStart();
}

async function start() {
  $('launch-button').disabled = true;
  $('progress').hidden = false;
  $('progress').removeAttribute('value');
  setStatus('Building…', 'The first DirectWebGPU translation can take a few minutes.');
  try {
    const response = await fetch(`${COMPANION}/build`, {
      method: 'POST',
      headers: {'Content-Type': 'application/octet-stream', 'X-Executable-Name': state.executable.name},
      body: state.executable,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Build failed (${response.status})`);
    $('progress').hidden = true;
    $('setup').hidden = true;
    $('toolbar-status').textContent = 'Running';
    $('game-frame').src = result.url;
  } catch (error) {
    $('progress').hidden = true;
    setStatus('Could not start', error.message);
    updateStart();
  }
}

function showError(error) {
  state.executable = null;
  setStatus(error.message);
  updateStart();
}

$('exe-button').addEventListener('click', () => $('exe-input').click());
$('exe-input').addEventListener('change', event => chooseExecutable(event.target.files[0]).catch(showError));
$('launch-button').addEventListener('click', start);

const drop = $('drop-zone');
for (const name of ['dragenter', 'dragover']) drop.addEventListener(name, event => {
  event.preventDefault();
  drop.classList.add('dragging');
});
for (const name of ['dragleave', 'drop']) drop.addEventListener(name, event => {
  event.preventDefault();
  drop.classList.remove('dragging');
});
drop.addEventListener('drop', event => chooseExecutable(event.dataTransfer.files[0]).catch(showError));
drop.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') $('exe-input').click();
});

$('restart-button').addEventListener('click', () => {
  const frame = $('game-frame');
  if (frame.src && frame.src !== 'about:blank') frame.src = frame.src;
});
$('stop-button').addEventListener('click', () => {
  $('game-frame').src = 'about:blank';
  $('setup').hidden = false;
  $('toolbar-status').textContent = 'Stopped';
  updateStart();
});
$('fullscreen-button').addEventListener('click', async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await $('stage').requestFullscreen();
});

checkCompanion();
setInterval(checkCompanion, 5000);
