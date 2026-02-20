# Script to register test user
$url = "http://localhost:3000/api/auth/register"
$body = @{
    email = "spark@example.com"
    password = "spark"
    firstName = "Test"
    lastName = "User"
    businessName = "Test Store"
    phoneNumber = "9876543210"
    gstin = "27AABCC0001R1ZM"
} | ConvertTo-Json

Write-Host "Registering test user..."
Write-Host "Endpoint: $url"
Write-Host "Body: $body"

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json" -Body $body -UseBasicParsing
    Write-Host "Response: $($response.Content)"
    $response.Content | ConvertFrom-Json | Format-Table
} catch {
    Write-Host "Error: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body: $($reader.ReadToEnd())"
    }
}
