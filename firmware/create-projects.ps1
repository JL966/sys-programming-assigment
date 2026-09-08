$ErrorActionPreference = 'Stop'
$firmware = $PSScriptRoot
$projectRoot = Split-Path -Parent $firmware
$workspace = Split-Path -Parent (Split-Path -Parent $projectRoot)
$templateProject = Get-ChildItem -LiteralPath $workspace -Recurse -Filter '01-Uart1.uvproj' |
    Select-Object -First 1
if (-not $templateProject) { throw 'Cannot locate 01-Uart1.uvproj.' }

$roles = @(
    @{ Dir='ctrl'; Name='AcceptanceCtrl' },
    @{ Dir='dut';  Name='AcceptanceDut' },
    @{ Dir='ref';  Name='AcceptanceRef' }
)
$sources = @('main.c','firmware_app.c','protocol.c','session.c','records.c','test_engine.c')

foreach ($role in $roles) {
    $targetPath = Join-Path (Join-Path $firmware $role.Dir) ($role.Name + '.uvproj')
    Copy-Item -LiteralPath $templateProject.FullName -Destination $targetPath -Force
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
    foreach ($source in $sources) {
        $file = $xml.CreateElement('File')
        $fileName = $xml.CreateElement('FileName')
        $fileName.InnerText = $source
        $fileType = $xml.CreateElement('FileType')
        $fileType.InnerText = '1'
        $filePath = $xml.CreateElement('FilePath')
        $filePath.InnerText = '.\source\' + $source
        [void]$file.AppendChild($fileName)
        [void]$file.AppendChild($fileType)
        [void]$file.AppendChild($filePath)
        [void]$filesNode.AppendChild($file)
    }
    $library = $xml.CreateElement('File')
    foreach ($entry in @(
        @('FileName','STCBSP_V3.6.LIB'),
        @('FileType','4'),
        @('FilePath','.\source\STCBSP_V3.6.LIB')
    )) {
        $node = $xml.CreateElement($entry[0])
        $node.InnerText = $entry[1]
        [void]$library.AppendChild($node)
    }
    [void]$filesNode.AppendChild($library)
    $settings = New-Object System.Xml.XmlWriterSettings
    $settings.Indent = $true
    $settings.Encoding = New-Object System.Text.UTF8Encoding($false)
    $writer = [System.Xml.XmlWriter]::Create($targetPath, $settings)
    $xml.Save($writer)
    $writer.Close()
}

Write-Output 'Three Keil projects generated from the verified BSP template.'
