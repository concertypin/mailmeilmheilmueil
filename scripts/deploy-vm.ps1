$ErrorActionPreference = "Stop"

function Require-EnvironmentVariable([string]$Name) {
    $Value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Set $Name before running deployment."
    }
    return $Value
}

$DeployHost = Require-EnvironmentVariable "DEPLOY_HOST"
$DeployUser = if ([string]::IsNullOrWhiteSpace($env:DEPLOY_USER)) { "root" } else { $env:DEPLOY_USER }
$DeployPath = if ([string]::IsNullOrWhiteSpace($env:DEPLOY_PATH)) { "/opt/mailmeilmheilmueil" } else { $env:DEPLOY_PATH }
$DeployService = if ([string]::IsNullOrWhiteSpace($env:DEPLOY_SERVICE)) { "mailmeilmheilmueil.service" } else { $env:DEPLOY_SERVICE }
$DeployPort = if ([string]::IsNullOrWhiteSpace($env:DEPLOY_PORT)) { "22" } else { $env:DEPLOY_PORT }
$SshKey = $env:DEPLOY_SSH_KEY
$Remote = "$DeployUser@$DeployHost"

$SshOptions = @("-p", $DeployPort)
$ScpOptions = @("-P", $DeployPort)
if (-not [string]::IsNullOrWhiteSpace($SshKey)) {
    $SshOptions += @("-i", $SshKey)
    $ScpOptions += @("-i", $SshKey)
}

Write-Host "Preparing ${Remote}:$DeployPath..."
& ssh @SshOptions $Remote "mkdir -p '$DeployPath/server' '$DeployPath/scripts' '$DeployPath/src/lib'"
if ($LASTEXITCODE -ne 0) {
    throw "Remote directory preparation failed."
}

Write-Host "Uploading application files..."
& scp @ScpOptions -r "server" "scripts" "package.json" "pnpm-lock.yaml" "${Remote}:$DeployPath/"
if ($LASTEXITCODE -ne 0) {
    throw "Application upload failed."
}
& scp @ScpOptions "src/lib/mail-schema.ts" "${Remote}:$DeployPath/src/lib/mail-schema.ts"
if ($LASTEXITCODE -ne 0) {
    throw "Schema file upload failed."
}

Write-Host "Installing dependencies and restarting $DeployService..."
$RemoteCommand = "cd '$DeployPath' && systemctl show '$DeployService' --property=ExecStart --value | grep -Fq -- 'start:smtp' && pnpm install --frozen-lockfile && systemctl restart '$DeployService' && sleep 2 && systemctl is-active --quiet '$DeployService'"
& ssh @SshOptions $Remote $RemoteCommand
if ($LASTEXITCODE -ne 0) {
    throw "Remote installation, restart, or service activation check failed."
}

Write-Host "Deployment completed successfully."
