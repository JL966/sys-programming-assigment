$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $PSScriptRoot 'bin'
New-Item -ItemType Directory -Force -Path $out | Out-Null

gcc -std=c89 -Wall -Wextra -Werror `
  (Join-Path $PSScriptRoot 'c\test_protocol.c') `
  (Join-Path $root 'shared\protocol.c') `
  -o (Join-Path $out 'test_protocol.exe')
if ($LASTEXITCODE -ne 0) { throw 'C protocol test compilation failed' }
& (Join-Path $out 'test_protocol.exe')
if ($LASTEXITCODE -ne 0) { throw 'C protocol tests failed' }

gcc -std=c89 -Wall -Wextra -Werror `
  (Join-Path $PSScriptRoot 'c\test_engine.c') `
  (Join-Path $root 'shared\protocol.c') `
  (Join-Path $root 'shared\session.c') `
  (Join-Path $root 'shared\records.c') `
  (Join-Path $root 'shared\test_engine.c') `
  -o (Join-Path $out 'test_engine.exe')
if ($LASTEXITCODE -ne 0) { throw 'C engine test compilation failed' }
& (Join-Path $out 'test_engine.exe')
if ($LASTEXITCODE -ne 0) { throw 'C engine tests failed' }

gcc -std=c89 -Wall -Wextra -Werror `
  (Join-Path $PSScriptRoot 'c\test_checkpoint.c') `
  (Join-Path $root 'shared\protocol.c') `
  (Join-Path $root 'firmware\common\checkpoint.c') `
  (Join-Path $root 'firmware\common\test_adapters.c') `
  -I (Join-Path $root 'shared') `
  -o (Join-Path $out 'test_checkpoint.exe')
if ($LASTEXITCODE -ne 0) { throw 'C checkpoint test compilation failed' }
& (Join-Path $out 'test_checkpoint.exe')
if ($LASTEXITCODE -ne 0) { throw 'C checkpoint tests failed' }

gcc -std=c89 -Wall -Wextra -Werror `
  (Join-Path $PSScriptRoot 'c\test_compact_protocol.c') `
  (Join-Path $root 'firmware\compact\common\compact_protocol.c') `
  -I (Join-Path $root 'firmware\compact\common') `
  -o (Join-Path $out 'test_compact_protocol.exe')
if ($LASTEXITCODE -ne 0) { throw 'C compact protocol test compilation failed' }
& (Join-Path $out 'test_compact_protocol.exe')
if ($LASTEXITCODE -ne 0) { throw 'C compact protocol tests failed' }
