# Hamsterball · DirectWebGPU

A DirectWebGPU play harness for a user-supplied `Hamsterball.exe`. The supporting game asset pack is included; the executable stays on the user's computer and is translated by the local companion.

## Use it

1. Open <https://evangit2.github.io/Hamsterball/>.
2. Clone this repository and run `python3 companion.py`.
3. Choose `Hamsterball.exe`.
4. Select **Start Hamsterball**. The companion builds and launches the game through [DirectWebGPU](https://github.com/evangit2/DirectWebGPU).

Set `DIRECTWEBGPU_HOME=/path/to/DirectWebGPU` when the DirectWebGPU checkout is not next to this repository. `HAMSTERBALL_ASSET_ROOT` can override the included asset pack.

The GitHub Pages host never receives the selected executable. This repository contains no `Hamsterball.exe` or translated Hamsterball WASM.

## Current architecture

DirectWebGPU currently translates Win32 x86 code ahead of time. Browsers cannot run that compiler directly yet, so the small local companion performs translation and serves the generated runtime on localhost. Moving this translation step fully into the browser is tracked as future DirectWebGPU work.

Hamsterball is copyright Raptisoft. This project is an independent compatibility launcher and is not affiliated with Raptisoft.
