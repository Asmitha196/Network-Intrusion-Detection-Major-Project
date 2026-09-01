$taskName = "InstallNpcapTask"
$action = "C:\Users\Ashmitha\Downloads\npcap-installer.exe /S /winpcap_mode=yes"

Write-Host "Creating elevated scheduled task..."
schtasks.exe /Create /TN $taskName /TR $action /SC ONCE /ST "23:59" /RL HIGHEST /F

Write-Host "Running scheduled task..."
schtasks.exe /Run /TN $taskName

Write-Host "Waiting 15 seconds for installer to execute..."
Start-Sleep -Seconds 15

Write-Host "Querying task info..."
schtasks.exe /Query /TN $taskName /FO LIST /V

Write-Host "Cleaning up task..."
schtasks.exe /Delete /TN $taskName /F
