# Keil C51 Eval Compact HEX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate three honest, role-specific, burnable Intel HEX files whose linked MCU CODE usage is at most 2048 bytes under the installed legal Keil C51 Eval toolchain.

**Architecture:** Add a separate bare-metal `firmware/compact` profile so the full BSP firmware remains intact. Each compact role links only a small shared C51 module, responds only to validated 24-byte HELLO frames, and is guarded by scripts that parse the linker map before accepting artifacts.

**Tech Stack:** Keil C51 V9.51 Eval, BL51, STC15F2K60S2, STCBSP V3.6, C89, PowerShell, Intel HEX.

**Spec:** `docs/superpowers/specs/2026-09-08-keil-eval-compact-hex-design.md`

## Global Constraints

- Linked `Program Size ... code=N` must satisfy `N <= 2048` for every role.
- Keep the full `firmware/ctrl|dut|ref` projects unchanged in capability and naming.
- Compact artifacts and projects must include `Compact` in their names.
- Compact projects use the verified STC15F2K60S2 register header but do not link the BSP; the full projects retain the verified BSP unchanged.
- MCU is `STC15F2K60S2 Series`, clock is `11059200`, and XDATA must stop at `0x06FF`.
- The compact profile never writes EEPROM or drives motors and never emits a test PASS.

---

### Task 1: Compact artifact gate

**Files:**
- Create: `firmware/compact/verify-compact.ps1`
- Create: `tests/compact/test-compact-gate.ps1`

**Interfaces:**
- Consumes: role project, build log, map and HEX paths.
- Produces: nonzero exit when any role is missing, has linker errors, exceeds 2048 CODE bytes, or has invalid Intel HEX; zero exit with a summary table otherwise.

- [x] **Step 1: Write the failing gate test.** Invoke `verify-compact.ps1`; require failure containing `missing` before compact projects exist.
- [x] **Step 2: Run `powershell -File tests/compact/test-compact-gate.ps1 -ExpectMissing` and verify it passes by observing the intended missing-artifact failure.**
- [x] **Step 3: Implement log parsing for `Program Size: ... code=(\d+)`, reject `FATAL ERROR`, validate the first HEX record begins with `:` and the final nonblank record is `:00000001FF`.**
- [x] **Step 4: Keep the final success path red until all three builds exist.**

### Task 2: Minimal role firmware and Keil projects

**Files:**
- Create: `firmware/compact/common/compact_app.c`, `firmware/compact/common/compact_app.h`, `firmware/compact/common/compact_protocol.c`, `firmware/compact/common/compact_protocol.h`
- Create: `firmware/compact/create-projects.ps1`, `firmware/compact/sync-assets.ps1`
- Create: `firmware/compact/ctrl|dut|ref/source/main.c`
- Create: `firmware/compact/ctrl|dut|ref/inc/app_role.h`
- Generate: `firmware/compact/ctrl/AcceptanceCtrlCompact.uvproj`
- Generate: `firmware/compact/dut/AcceptanceDutCompact.uvproj`
- Generate: `firmware/compact/ref/AcceptanceRefCompact.uvproj`

**Interfaces:**
- Consumes: `STC15F2K60S2.H` register definitions and the shared 24-byte protocol layout.
- Produces: `CompactApp_Init(void)` and three role-specific targets.

- [x] **Step 1: Add a source verifier requiring compile-time `SYS_CLOCK=11059200UL`, a fixed `APP_ROLE` of 1/2/3, `while (1) MySTC_OS();`, UART1 reload `0xFB80` for 2400 bps, 24-byte buffers, no BSP library, compact output names and XRAM `0x0000..0x06FF`.**
- [x] **Step 2: Run the verifier before generation and confirm it fails.**
- [x] **Step 3: Implement the smallest safe app: initialize UART1 registers, poll RX/TX through `MySTC_OS`, collect 24 bytes, validate SOF/version/payload length/CRC/destination, and return only role HELLO.**
- [x] **Step 4: Generate three projects from the verified template, linking only `main.c`, `compact_app.c` and host-tested `compact_protocol.c`; copy only the STC register header.**
- [x] **Step 5: Run the source verifier and confirm all three projects pass.**

### Task 3: Build, size verification and release manifest

**Files:**
- Create: `firmware/compact/build-role.ps1`, `firmware/compact/build-all.ps1`
- Create: `scripts/generate-compact-manifest.ps1`
- Generate: `firmware/compact/*/output/*Compact.hex`
- Generate: `compact-release-manifest.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: generated projects and installed `UV4.exe`.
- Produces: three valid HEX files and a manifest containing profile, role, code bytes, SHA-256 and `hardwareValidated=false`.

- [x] **Step 1: Build one role and inspect its full log/map; record the first measured CODE size.**
- [x] **Step 2: If CODE exceeds 2048, remove one identified cost source at a time and rebuild; never remove CRC, role identity, safe initialization or size verification.** The first build was already below the limit; no feature removal was required.
- [x] **Step 3: Build all three roles and run `verify-compact.ps1`; require three rows with `CodeBytes <= 2048`.**
- [x] **Step 4: Generate `compact-release-manifest.json` only after the gate passes; include SHA-256 and the honest capability boundary.**
- [x] **Step 5: Run `scripts/verify-all.ps1 -SoftwareOnly` to prove the original platform did not regress.**
- [x] **Step 6: Update README with exact artifact paths, size results, burn instructions and the compact/full distinction.**

### Task 4: Final independent verification

**Files:**
- Modify: this plan's checkboxes with actual evidence.

**Interfaces:**
- Consumes: all compact outputs and original regression suite.
- Produces: reproducible evidence for delivery.

- [x] **Step 1: Fresh-run `firmware/compact/build-all.ps1`.**
- [x] **Step 2: Fresh-run `firmware/compact/verify-compact.ps1` and inspect all rows and exit code.**
- [x] **Step 3: Fresh-run `scripts/generate-compact-manifest.ps1` and independently recompute each SHA-256.**
- [x] **Step 4: Fresh-run `scripts/verify-all.ps1 -SoftwareOnly`; report exact test counts and any remaining hardware-validation gap.**
