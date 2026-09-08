$ErrorActionPreference = 'Stop'
$compactRoot = $PSScriptRoot
$workspace = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $compactRoot)))
$templateProject = Join-Path $workspace '作业5-0\file\01-Uart1\01-Uart1.uvproj'
if (-not (Test-Path -LiteralPath $templateProject)) { throw "Keil template missing: $templateProject" }
$roles = @(
    @{ Dir='ctrl'; Name='AcceptanceCtrlCompact' },
    @{ Dir='dut'; Name='AcceptanceDutCompact' },
    @{ Dir='ref'; Name='AcceptanceRefCompact' }
)

foreach ($role in $roles) {
    $targetPath = Join-Path (Join-Path $compactRoot $role.Dir) ($role.Name + '.uvproj')
    Copy-Item -LiteralPath $templateProject -Destination $targetPath -Force
    [xml]$xml = Get-Content -Raw -LiteralPath $targetPath
    $target = $xml.Project.Targets.Target
    $target.TargetName = $role.Name
    $common = $target.TargetOption.TargetCommonOption
    $common.OutputName = $role.Name
    $common.OutputDirectory = '.\output\'
    $common.ListingPath = '.\list\'
    $target.TargetOption.Target51.Lx51.UseMemoryFromTarget = '0'
    $target.TargetOption.Target51.Lx51.XDataBaseAddress = '0X0000-0X06FF'
    $filesNode = $xml.SelectSingleNode('//Groups/Group/Files')
    $filesNode.RemoveAll()
    foreach ($sourceName in @('main.c','compact_app.c','compact_protocol.c')) {
        $file = $xml.CreateElement('File')
        foreach ($entry in @(@('FileName',$sourceName),@('FileType','1'),@('FilePath',('.\source\' + $sourceName)))) {
            $node = $xml.CreateElement($entry[0])
            $node.InnerText = $entry[1]
            [void]$file.AppendChild($node)
        }
        [void]$filesNode.AppendChild($file)
    }
    $settings = New-Object System.Xml.XmlWriterSettings
    $settings.Indent = $true
    $settings.Encoding = New-Object System.Text.UTF8Encoding($false)
    $writer = [System.Xml.XmlWriter]::Create($targetPath, $settings)
    $xml.Save($writer)
    $writer.Close()
}
Write-Output 'Three bare-metal Compact Keil projects generated.'
