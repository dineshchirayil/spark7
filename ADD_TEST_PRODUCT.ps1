# Simple test to add sample products
$token = ""

# First, login
$loginBody = '{"email":"test@example.com","password":"Test123456"}'
Write-Host "Attempting login..."
$loginResp = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing -ErrorAction Stop
$loginData = $loginResp.Content | ConvertFrom-Json
$token = $loginData.token
Write-Host "Login successful, token: $($token.substring(0,20))..."

# Add a sample product
$productBody = @{
    name = "MacBook Pro 16"
    sku = "LAP001"
    category = "Laptops"
    description = "High-performance laptop"
    price = 250000
    cost = 180000
    gstRate = 18
    stock = 5
    minStock = 1
    unit = "piece"
} | ConvertTo-Json

Write-Host "Adding product..."
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
}

$prodResp = Invoke-WebRequest -Uri "http://localhost:3000/api/products" -Method POST -ContentType "application/json" -Body $productBody -Headers $headers -UseBasicParsing -ErrorAction Stop
$prodData = $prodResp.Content | ConvertFrom-Json
Write-Host "Product added: $($prodData | ConvertTo-Json)"

# Fetch all products
Write-Host "Fetching all products..."
$getResp = Invoke-WebRequest -Uri "http://localhost:3000/api/products" -Method GET -UseBasicParsing
$getData = $getResp.Content | ConvertFrom-Json
Write-Host "Total products: $($getData.data.Count)"
$getData.data | ForEach-Object { Write-Host "  - $($_.name) (SKU: $($_.sku))" }
