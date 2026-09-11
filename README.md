# Hamsterball · DirectWebGPU

A browser play harness for a user-supplied `Hamsterball.exe`, powered by [DirectWebGPU](https://github.com/evangit2/DirectWebGPU). The executable stays inside the browser tab and is never uploaded.

[Theseus](https://github.com/evmar/theseus) is a major component of the runtime. It translates the original 32-bit x86 Windows executable into Rust/WebAssembly and provides the DOS/Win32 environment that DirectWebGPU extends with Direct3D, input, audio, and browser integration. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for all credited runtime components, pinned versions, licenses, and retained notice files.

## Use it

1. Open <https://evangit2.github.io/Hamsterball/>.
2. Choose `Hamsterball.exe`.
3. The game opens in the DirectWebGPU play harness.

The supporting game assets and browser runtime are included in this repository.

## Current architecture

DirectWebGPU translates the original Win32 x86 executable ahead of time. This repository stores that translated payload encrypted with a key derived from the complete bytes of the exact supported executable. The browser hashes the file selected by the user, decrypts the payload in memory with Web Crypto, verifies it, and runs it through the DirectWebGPU Win32 and WineD3D-compatible WebGPU runtime. The unencrypted translated payload and original executable are not published.

Hamsterball is copyright Raptisoft. This project is an independent compatibility launcher and is not affiliated with Raptisoft.
