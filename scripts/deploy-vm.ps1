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

Write-Host "Building the application..."
& pnpm build
if ($LASTEXITCODE -ne 0) {
    throw "pnpm build failed."
}

Write-Host "Preparing ${Remote}:$DeployPath..."
& ssh @SshOptions $Remote "mkdir -p '$DeployPath/dist' '$DeployPath/server' '$DeployPath/scripts'"
if ($LASTEXITCODE -ne 0) {
    throw "Remote directory preparation failed."
}

Write-Host "Uploading application files..."
& scp @ScpOptions -r "dist" "server" "scripts" "package.json" "pnpm-lock.yaml" "${Remote}:$DeployPath/"
if ($LASTEXITCODE -ne 0) {
    throw "Application upload failed."
}

Write-Host "Installing dependencies and restarting $DeployService..."
$RemoteCommand = "cd '$DeployPath' && pnpm install --frozen-lockfile && systemctl restart '$DeployService' && for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl --fail --silent --show-error http://127.0.0.1:8787/healthz && exit 0; sleep 2; done; exit 1"
& ssh @SshOptions $Remote $RemoteCommand
if ($LASTEXITCODE -ne 0) {
    throw "Remote installation, restart, or health check failed."
}

Write-Host "Deployment completed successfully."
