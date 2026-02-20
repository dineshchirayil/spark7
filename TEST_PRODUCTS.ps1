# Test Script - Register and Add Sample Products

# Step 1: Register User
Write-Host "1. Registering test user..." -ForegroundColor Green
$registerBody = @{
    email = "test@example.com"
    password = "Test123456"
    firstName = "Test"
    lastName = "User"
    businessName = "Test Store"
    phoneNumber = "9876543210"
    gstin = "27AABCC0001R1ZM"
} | ConvertTo-Json

$registerResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/register" -Method POST -ContentType "application/json" -Body $registerBody -UseBasicParsing -ErrorAction SilentlyContinue
$registerData = $registerResponse.Content | ConvertFrom-Json
Write-Host "Register Response: $($registerData | ConvertTo-Json -Depth 2)"

# Step 2: If user already exists, try login
if ($registerData.success -eq $false -and $registerData.error -match "already exists") {
    Write-Host "User already exists, attempting login..." -ForegroundColor Yellow
    $loginBody = @{
        email = "spark@example.com"
        password = "spark"
    } | ConvertTo-Json
    
    $loginResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
    $loginData = $loginResponse.Content | ConvertFrom-Json
    $token = $loginData.token
} else {
    $token = $registerData.token
}

Write-Host "Token: $token" -ForegroundColor Green

# Step 3: Add Sample Products
Write-Host "`n2. Adding sample products..." -ForegroundColor Green

$products = @(
    @{
        name = "MacBook Pro 16"
        sku = "LAP001"
        category = "Laptops"
        description = "High-performance laptop for professionals"
        price = 250000
        cost = 180000
        gstRate = 18
        stock = 5
        minStock = 1
        unit = "piece"
    },
    @{
        name = "iPhone 15 Pro"
        sku = "MOB001"
        category = "Smartphones"
        description = "Latest iPhone with advanced features"
        price = 130000
        cost = 90000
        gstRate = 18
        stock = 10
        minStock = 2
        unit = "piece"
    },
    @{
        name = "Dell Monitor 27\""
        sku = "MON001"
        category = "Monitors"
        description = "4K Ultra HD Monitor"
        price = 35000
        cost = 25000
        gstRate = 18
        stock = 8
        minStock = 2
        unit = "piece"
    },
    @{
        name = "USB-C Cable"
        sku = "ACC001"
        category = "Accessories"
        description = "2 meter USB-C cable"
        price = 1500
        cost = 800
        gstRate = 5
        stock = 100
        minStock = 10
        unit = "piece"
    }
)

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
}

foreach ($product in $products) {
    Write-Host "Adding: $($product.name)" -ForegroundColor Cyan
    $productJson = $product | ConvertTo-Json
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/products" -Method POST -ContentType "application/json" -Body $productJson -Headers $headers -UseBasicParsing
        $result = $response.Content | ConvertFrom-Json
        Write-Host "✓ Success: $($result.product.name)" -ForegroundColor Green
    } catch {
        Write-Host "✗ Failed: $_" -ForegroundColor Red
    }
}

Write-Host "`n3. Fetching all products..." -ForegroundColor Green
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/products" -Method GET -Headers $headers -UseBasicParsing
$data = $response.Content | ConvertFrom-Json
Write-Host "Total Products: $($data.products.Count)" -ForegroundColor Green
$data.products | ForEach-Object {
    Write-Host "  - $($_.name) (SKU: $($_.sku)) - Stock: $($_.stock)" -ForegroundColor Yellow
}
