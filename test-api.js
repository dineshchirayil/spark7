/**
 * POS + Inventory + SaaS Application - Automated Integration Tests
 * 
 * This script automates the manual testing steps described in QUICKSTART.md.
 * It uses dynamic data to ensure tests can be run repeatedly without collision errors.
 * 
 * Usage: node test-api.js
 */

const BASE_URL = 'http://localhost:3000/api';
const COLORS = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m"
};

// State to carry over between steps
let state = {
    token: null,
    userId: null,
    productId: null,
    orderId: null,
    sku: `SKU-${Date.now()}`,
    email: `test.user.${Date.now()}@example.com`
};

async function runTests() {
    console.log(`${COLORS.cyan}🚀 Starting POS System Integration Tests...${COLORS.reset}\n`);

    try {
        // 1. Health Check
        await testStep('Health Check', async () => {
            const res = await fetch(`${BASE_URL}/health`);
            // Some implementations might not have health endpoint active, checking auth instead if 404
            if (res.status === 404) return { skipped: true, msg: 'Health endpoint not found, skipping' };
            return res.status === 200;
        });

        // 2. Register User
        await testStep('Register User', async () => {
            const payload = {
                email: state.email,
                password: "TestPassword123!",
                firstName: "Test",
                lastName: "User",
                phoneNumber: "9876543210",
                businessName: "Test Automation Store",
                gstin: "27AABCC0001R1ZM"
            };

            const res = await fetch(`${BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success && data.token) {
                state.token = data.token;
                state.userId = data.user._id;
                return true;
            }
            throw new Error(data.error || 'Registration failed');
        });

        // 3. Login User (Verification)
        await testStep('Login User', async () => {
            const payload = {
                email: state.email,
                password: "TestPassword123!"
            };

            const res = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success && data.token) {
                // Update token just in case
                state.token = data.token;
                return true;
            }
            throw new Error(data.error || 'Login failed');
        });

        // 4. Create Product
        await testStep('Create Product', async () => {
            const payload = {
                name: "Automated Test Product",
                sku: state.sku,
                category: "Testing",
                price: 1000,
                cost: 600,
                gstRate: 18,
                stock: 100,
                minStock: 10,
                unit: "piece"
            };

            const res = await fetch(`${BASE_URL}/products`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                // Handle both array (from list) or single object response formats
                state.productId = data.data?._id || data.product?._id || data.data?.[0]?._id;
                if (!state.productId) throw new Error('Product ID not found in response');
                return true;
            }
            throw new Error(data.error || 'Product creation failed');
        });

        // 5. Create Order
        await testStep('Create Order', async () => {
            const payload = {
                items: [
                    {
                        productId: state.productId,
                        quantity: 5
                    }
                ],
                paymentMethod: "cash",
                notes: "Automated test order"
            };

            const res = await fetch(`${BASE_URL}/orders`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                state.orderId = data.data?._id || data.order?._id;
                return true;
            }
            throw new Error(data.error || 'Order creation failed');
        });

        // 6. Verify Inventory Deduction
        await testStep('Verify Inventory Deduction', async () => {
            // We started with 100, bought 5. Should be 95.
            const res = await fetch(`${BASE_URL}/products/${state.productId}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            const data = await res.json();
            if (data.success) {
                const product = data.data || data.product;
                if (product.stock === 95) return true;
                throw new Error(`Expected stock 95, got ${product.stock}`);
            }
            throw new Error(data.error || 'Fetch product failed');
        });

        console.log(`\n${COLORS.green}✅ All Tests Passed Successfully!${COLORS.reset}`);
        process.exit(0);

    } catch (error) {
        console.error(`\n${COLORS.red}❌ Tests Failed: ${error.message}${COLORS.reset}`);
        process.exit(1);
    }
}

async function testStep(name, fn) {
    process.stdout.write(`Testing ${name}... `);
    try {
        const result = await fn();
        if (result && result.skipped) {
            console.log(`${COLORS.yellow}SKIPPED${COLORS.reset} (${result.msg})`);
        } else {
            console.log(`${COLORS.green}PASS${COLORS.reset}`);
        }
    } catch (e) {
        console.log(`${COLORS.red}FAIL${COLORS.reset}`);
        throw e;
    }
}

runTests();