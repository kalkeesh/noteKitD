param(
    [string]$OutputPath = "apk-link.txt"
)

$buildsJson = & eas build:list --platform android --status finished --limit 1 --json --non-interactive

if (-not $buildsJson) {
    throw "No finished Android EAS build was returned."
}

$builds = $buildsJson | ConvertFrom-Json
if (-not $builds) {
    throw "Unable to parse EAS build output."
}

$build = @($builds)[0]
if (-not $build) {
    throw "No finished Android EAS build was found."
}

$candidates = @(
    $build.artifacts.buildUrl,
    $build.artifacts.applicationArchiveUrl,
    $build.buildArtifactUrl,
    $build.apkUrl,
    $build.url,
    $build.webpageUrl
) | Where-Object { $_ }

$selectedUrl = $candidates | Select-Object -First 1

if (-not $selectedUrl) {
    throw "Could not find an APK or build URL in the latest EAS build response."
}

Set-Content -Path $OutputPath -Value $selectedUrl
Write-Output "Saved APK/build URL to $OutputPath"
