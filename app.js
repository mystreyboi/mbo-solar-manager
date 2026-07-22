/* ==========================================================================
   1. FIREBASE SETUP
   ========================================================================== */
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "123456789",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();


/* ==========================================================================
   2. GLOBAL STATE
   ========================================================================== */
let products = [];
let cart = [];
let cartTotal = 0;
let allSales = [];
let customers = [];
let suppliers = [];
let expenses = [];
let currentReportFilter = 'today';


/* ==========================================================================
   3. AUTHENTICATION & INITIALIZATION
   ========================================================================== */
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');

document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault(); 
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    
    if (user === 'admin' && pass === 'mbo12345') {
        localStorage.setItem('isLoggedIn', 'true');
        loginScreen.classList.replace('active', 'hidden');
        dashboardScreen.classList.replace('hidden', 'active');
        loadSettingsToUI();
    } else {
        alert('Invalid username or password!');
    }
});

function logout() {
    localStorage.removeItem('isLoggedIn');
    document.querySelectorAll('.screen').forEach(s => s.classList.replace('active', 'hidden'));
    loginScreen.classList.replace('hidden', 'active');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

window.onload = () => {
    if (localStorage.getItem('isLoggedIn') === 'true') {
        loginScreen.classList.replace('active', 'hidden');
        dashboardScreen.classList.replace('hidden', 'active');
        loadSettingsToUI();
    }
};


/* ==========================================================================
   4. NAVIGATION
   ========================================================================== */
function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(s => s.classList.replace('active', 'hidden'));
}

document.getElementById('fab-pos').addEventListener('click', () => {
    hideAllScreens();
    document.getElementById('pos-screen').classList.replace('hidden', 'active');
    renderProducts();
});

function closePOS() {
    hideAllScreens();
    dashboardScreen.classList.replace('hidden', 'active');
}

function openInventory() {
    hideAllScreens();
    document.getElementById('inventory-screen').classList.replace('hidden', 'active');
    renderInventory();
}

function showDashboard() {
    hideAllScreens();
    dashboardScreen.classList.replace('hidden', 'active');
}

function openReports() {
    hideAllScreens();
    document.getElementById('reports-screen').classList.replace('hidden', 'active');
    generateReport('today');
}

function closeReports() {
    hideAllScreens();
    dashboardScreen.classList.replace('hidden', 'active');
}

function openCustomers() {
    hideAllScreens();
    document.getElementById('customers-screen').classList.replace('hidden', 'active');
    renderCustomers();
}

function showDashboardFromCustomers() {
    hideAllScreens();
    dashboardScreen.classList.replace('hidden', 'active');
}

function openSuppliers() {
    hideAllScreens();
    document.getElementById('suppliers-screen').classList.replace('hidden', 'active');
    renderSuppliers();
}

function showDashboardFromSuppliers() {
    hideAllScreens();
    dashboardScreen.classList.replace('hidden', 'active');
}

function openExpenses() {
    hideAllScreens();
    document.getElementById('expenses-screen').classList.replace('hidden', 'active');
    renderExpenses();
}

function showDashboardFromExpenses() {
    hideAllScreens();
    dashboardScreen.classList.replace('hidden', 'active');
}

function openSettings() {
    hideAllScreens();
    document.getElementById('settings-screen').classList.replace('hidden', 'active');
}

function closeSettings() {
    hideAllScreens();
    dashboardScreen.classList.replace('hidden', 'active');
}


/* ==========================================================================
   5. REAL-TIME FIREBASE LISTENERS
   ========================================================================== */
db.collection("products").onSnapshot((snapshot) => {
    products = [];
    snapshot.forEach((doc) => {
        products.push({ id: doc.id, ...doc.data() }); 
    });
    updateDashboardStats();
    if (document.getElementById('inventory-screen').classList.contains('active')) renderInventory();
    if (document.getElementById('pos-screen').classList.contains('active')) renderProducts();
});

db.collection("sales").orderBy("date", "desc").onSnapshot((snapshot) => {
    allSales = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.date) {
            allSales.push({ id: doc.id, ...data, date: data.date.toDate() });
        }
    });
    updateDashboardStats();
    if (document.getElementById('reports-screen').classList.contains('active')) generateReport(currentReportFilter);
});

db.collection("customers").orderBy("name").onSnapshot((snapshot) => {
    customers = [];
    snapshot.forEach((doc) => {
        customers.push({ id: doc.id, ...doc.data() });
    });
    updateDashboardStats();
    if (document.getElementById('customers-screen').classList.contains('active')) renderCustomers();
    
    const dropdown = document.getElementById('checkout-customer');
    if (dropdown) {
        dropdown.innerHTML = '<option value="">Walk-in Customer (No Tracking)</option>';
        customers.forEach(c => {
            dropdown.innerHTML += `<option value="${c.id}">${c.name} - Owe: ₦${(c.balance || 0).toFixed(2)}</option>`;
        });
    }
});

db.collection("suppliers").orderBy("name").onSnapshot((snapshot) => {
    suppliers = [];
    snapshot.forEach((doc) => {
        suppliers.push({ id: doc.id, ...doc.data() });
    });
    updateDashboardStats();
    if (document.getElementById('suppliers-screen').classList.contains('active')) renderSuppliers();
});

db.collection("expenses").orderBy("date", "desc").onSnapshot((snapshot) => {
    expenses = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        expenses.push({ id: doc.id, ...data, date: data.date ? data.date.toDate() : new Date() });
    });
    if (document.getElementById('expenses-screen').classList.contains('active')) renderExpenses();
});

function updateDashboardStats() {
    const totalRevenue = allSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    document.getElementById('dash-total-sales').innerText = `₦${totalRevenue.toFixed(2)}`;
    document.getElementById('dash-total-products').innerText = products.length;
    document.getElementById('dash-total-customers').innerText = customers.length;
    document.getElementById('dash-total-suppliers').innerText = suppliers.length;
    
    const lowStockCount = products.filter(p => p.stock <= 10).length;
    document.getElementById('dash-low-stock').innerText = lowStockCount;
}


/* ==========================================================================
   6. POINT OF SALE (POS) LOGIC
   ========================================================================== */
const amountPaidInput = document.getElementById('amount-paid');
const balanceDueText = document.getElementById('balance-due');

function renderProducts() {
    const list = document.getElementById('product-list');
    list.innerHTML = '';
    products.forEach(p => {
        list.innerHTML += `
            <div class="product-item">
                <div class="product-info">
                    <h4>${p.name}</h4>
                    <p>${p.category || 'Item'} | Stock: ${p.stock}</p>
                </div>
                <div style="display: flex; align-items: center;">
                    <span class="product-price">₦${p.price.toFixed(2)}</span>
                    <button class="add-btn" onclick="addToCart('${p.id}')">
                        <span class="material-icons" style="font-size: 18px;">add_shopping_cart</span>
                    </button>
                </div>
            </div>
        `;
    });
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    updateCartUI();
}

function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    document.getElementById('cart-count').innerText = `${count} Items`;
    document.getElementById('cart-total').innerText = `₦${cartTotal.toFixed(2)}`;
    document.getElementById('modal-total').innerText = `₦${cartTotal.toFixed(2)}`;
    amountPaidInput.value = cartTotal; 
    calculateBalance();
}

function openCheckoutModal() {
    if (cart.length === 0) return alert('Cart is empty!');
    const preview = document.getElementById('cart-items-preview');
    preview.innerHTML = cart.map(item => `
        <div class="cart-item-row">
            <span>${item.qty}x ${item.name}</span>
            <span>₦${(item.price * item.qty).toFixed(2)}</span>
        </div>
    `).join('');
    document.getElementById('checkout-modal').classList.remove('hidden');
    calculateBalance();
}

function closeCheckoutModal() {
    document.getElementById('checkout-modal').classList.add('hidden');
}

amountPaidInput.addEventListener('input', calculateBalance);

function calculateBalance() {
    const paid = parseFloat(amountPaidInput.value) || 0;
    const balance = cartTotal - paid;
    if (balance > 0) {
        balanceDueText.style.display = 'block';
        balanceDueText.innerText = `Balance Due: ₦${balance.toFixed(2)}`;
    } else {
        balanceDueText.style.display = 'none';
    }
}

function processSale() {
    const paid = parseFloat(document.getElementById('amount-paid').value) || 0;
    const method = document.getElementById('payment-method').value;
    const customerId = document.getElementById('checkout-customer').value;
    
    if (paid < 0) return alert('Invalid payment amount');
    
    const balance = cartTotal - paid;
    const status = balance > 0 ? "Half Paid" : "Paid";

    db.collection("sales").add({
        items: cart,
        total_amount: cartTotal,
        paid_amount: paid,
        balance: balance,
        payment_method: method,
        status: status,
        customer_id: customerId,
        date: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        cart.forEach(item => {
            db.collection("products").doc(item.id).update({
                stock: firebase.firestore.FieldValue.increment(-item.qty)
            });
        });

        if (balance > 0 && customerId) {
            db.collection("customers").doc(customerId).update({
                balance: firebase.firestore.FieldValue.increment(balance)
            });
        }

        alert(`Sale Completed Successfully!\nTotal: ₦${cartTotal.toFixed(2)}\nPaid: ₦${paid.toFixed(2)}`);
        cart = [];
        updateCartUI();
        closeCheckoutModal();
        closePOS();
    }).catch((error) => {
        console.error("Sale Error: ", error);
        alert("Failed to process sale.");
    });
}


/* ==========================================================================
   7. INVENTORY MANAGEMENT LOGIC
   ========================================================================== */
function renderInventory() {
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';
    products.forEach(p => {
        const isLow = p.stock <= 10; 
        list.innerHTML += `
            <div class="product-item">
                <div class="product-info">
                    <h4>${p.name}</h4>
                    <p style="font-size:11px; color:var(--text-light);">${p.category || 'General'}</p>
                    <span class="stock-badge ${isLow ? 'stock-low' : 'stock-good'}">
                        ${isLow ? 'Low Stock: ' : 'Stock: '} ${p.stock}
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="product-price">₦${p.price.toFixed(2)}</span>
                    <button class="action-btn" onclick="openProductModal('${p.id}')">
                        <span class="material-icons">edit</span>
                    </button>
                </div>
            </div>
        `;
    });
}

function openProductModal(id = null) {
    if (id) {
        const p = products.find(x => x.id === id);
        document.getElementById('edit-product-id').value = p.id;
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-category').value = p.category || '';
        document.getElementById('prod-price').value = p.price;
        document.getElementById('prod-cost').value = p.cost || '';
        document.getElementById('prod-stock').value = p.stock;
        document.getElementById('product-modal-title').innerText = 'Edit Product';
    } else {
        document.getElementById('edit-product-id').value = '';
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-category').value = '';
        document.getElementById('prod-price').value = '';
        document.getElementById('prod-cost').value = '';
        document.getElementById('prod-stock').value = '';
        document.getElementById('product-modal-title').innerText = 'Add Product';
    }
    document.getElementById('product-modal').classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

function saveProduct() {
    const id = document.getElementById('edit-product-id').value;
    const name = document.getElementById('prod-name').value;
    const category = document.getElementById('prod-category').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const cost = parseFloat(document.getElementById('prod-cost').value) || 0;
    const stock = parseInt(document.getElementById('prod-stock').value);

    if (!name || !category || isNaN(price) || isNaN(stock)) {
        return alert('Please fill in all fields including the category.');
    }

    if (id) {
        db.collection("products").doc(id).update({ name, category, price, cost, stock }).then(() => closeProductModal());
    } else {
        db.collection("products").add({ name, category, price, cost, stock }).then(() => closeProductModal());
    }
}


/* ==========================================================================
   8. CUSTOMER MANAGEMENT LOGIC
   ========================================================================== */
function renderCustomers() {
    const list = document.getElementById('customer-list');
    list.innerHTML = '';
    customers.forEach(c => {
        const owesMoney = (c.balance || 0) > 0;
        list.innerHTML += `
            <div class="customer-card">
                <div class="customer-info">
                    <h4>${c.name}</h4>
                    <p><span class="material-icons" style="font-size:14px;">phone</span> ${c.phone || 'No phone'}</p>
                    <p><span class="material-icons" style="font-size:14px;">home</span> ${c.address || 'No address'}</p>
                </div>
                <div class="customer-balance">
                    <p>Outstanding Balance</p>
                    <span class="balance-amount ${owesMoney ? 'text-red' : 'text-green'}">
                        ₦${(c.balance || 0).toFixed(2)}
                    </span>
                    ${owesMoney ? `<br><button class="settle-btn" onclick="settleDebt('${c.id}', ${c.balance})">Clear Debt</button>` : ''}
                </div>
            </div>
        `;
    });
}

function openCustomerModal() { document.getElementById('customer-modal').classList.remove('hidden'); }
function closeCustomerModal() { document.getElementById('customer-modal').classList.add('hidden'); }

function saveCustomer() {
    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value;
    const address = document.getElementById('cust-address').value;

    if (!name) return alert('Customer Name is required!');

    db.collection("customers").add({ name, phone, address, balance: 0 }).then(() => {
        document.getElementById('cust-name').value = '';
        document.getElementById('cust-phone').value = '';
        document.getElementById('cust-address').value = '';
        closeCustomerModal();
    });
}

function settleDebt(customerId, amount) {
    if(confirm(`Mark ₦${amount.toFixed(2)} as paid for this customer?`)) {
        db.collection("customers").doc(customerId).update({ balance: 0 });
        alert('Debt cleared successfully!');
    }
}


/* ==========================================================================
   9. SUPPLIER MANAGEMENT LOGIC
   ========================================================================== */
function openSupplierModal() { document.getElementById('supplier-modal').classList.remove('hidden'); }
function closeSupplierModal() { document.getElementById('supplier-modal').classList.add('hidden'); }

function saveSupplier() {
    const name = document.getElementById('supp-name').value;
    const phone = document.getElementById('supp-phone').value;
    const email = document.getElementById('supp-email').value;
    const address = document.getElementById('supp-address').value;
    const productsSupplied = document.getElementById('supp-products').value;

    if (!name) return alert('Supplier Name is required!');

    db.collection("suppliers").add({ name, phone, email, address, productsSupplied }).then(() => {
        document.getElementById('supp-name').value = '';
        document.getElementById('supp-phone').value = '';
        document.getElementById('supp-email').value = '';
        document.getElementById('supp-address').value = '';
        document.getElementById('supp-products').value = '';
        closeSupplierModal();
    });
}

function renderSuppliers() {
    const list = document.getElementById('supplier-list');
    list.innerHTML = '';
    if (suppliers.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:gray; margin-top: 20px;">No suppliers added yet.</p>';
        return;
    }
    suppliers.forEach(s => {
        list.innerHTML += `
            <div class="customer-card">
                <div class="customer-info">
                    <h4>${s.name}</h4>
                    <p><span class="material-icons" style="font-size:14px;">phone</span> ${s.phone || 'No phone'}</p>
                    <p><span class="material-icons" style="font-size:14px;">email</span> ${s.email || 'No email'}</p>
                    <p><span class="material-icons" style="font-size:14px;">inventory</span> Supplies: ${s.productsSupplied || 'General'}</p>
                </div>
            </div>
        `;
    });
}


/* ==========================================================================
   10. EXPENSE MANAGEMENT LOGIC
   ========================================================================== */
function openExpenseModal() { document.getElementById('expense-modal').classList.remove('hidden'); }
function closeExpenseModal() { document.getElementById('expense-modal').classList.add('hidden'); }

function saveExpense() {
    const category = document.getElementById('exp-category').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const notes = document.getElementById('exp-notes').value;

    if (isNaN(amount) || amount <= 0) return alert('Please enter a valid amount.');

    db.collection("expenses").add({
        category,
        amount,
        notes,
        date: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        document.getElementById('exp-amount').value = '';
        document.getElementById('exp-notes').value = '';
        closeExpenseModal();
    });
}

function renderExpenses() {
    const list = document.getElementById('expense-list');
    list.innerHTML = '';
    if (expenses.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:gray; margin-top: 20px;">No expenses recorded yet.</p>';
        return;
    }
    expenses.forEach(e => {
        list.innerHTML += `
            <div class="customer-card">
                <div class="customer-info">
                    <h4>${e.category}</h4>
                    <p>${e.notes || 'No description'}</p>
                    <p style="font-size: 10px; color: gray;">${e.date ? e.date.toLocaleDateString() : ''}</p>
                </div>
                <div class="customer-balance">
                    <span class="balance-amount text-red">₦${e.amount.toFixed(2)}</span>
                </div>
            </div>
        `;
    });
}


/* ==========================================================================
   11. SETTINGS LOGIC
   ========================================================================== */
function saveSettings() {
    const name = document.getElementById('set-company-name').value;
    localStorage.setItem('company_name', name);
    document.getElementById('app-title-header').innerText = name;
    alert('Settings saved successfully!');
    closeSettings();
}

function loadSettingsToUI() {
    const savedName = localStorage.getItem('company_name');
    if (savedName) {
        document.getElementById('app-title-header').innerText = savedName;
        document.getElementById('set-company-name').value = savedName;
    }
}


/* ==========================================================================
   12. REPORTS & ANALYTICS LOGIC
   ========================================================================== */
function generateReport(timeframe) {
    currentReportFilter = timeframe;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${timeframe}`).classList.add('active');

    const now = new Date();
    let filteredSales = allSales.filter(sale => {
        const saleDate = sale.date;
        if (timeframe === 'today') return saleDate.toDateString() === now.toDateString();
        if (timeframe === 'week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            return saleDate >= oneWeekAgo;
        }
        if (timeframe === 'month') return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
        return true;
    });

    let revenue = 0;
    let unpaid = 0;
    let totalCost = 0;

    filteredSales.forEach(sale => {
        revenue += sale.total_amount;
        unpaid += sale.balance;
        sale.items.forEach(item => {
            const itemCost = item.cost ? item.cost : (item.price * 0.75);
            totalCost += (itemCost * item.qty);
        });
    });

    const profit = revenue - totalCost;

    document.getElementById('rep-revenue').innerText = `₦${revenue.toFixed(2)}`;
    document.getElementById('rep-profit').innerText = `₦${profit.toFixed(2)}`;
    document.getElementById('rep-unpaid').innerText = `₦${unpaid.toFixed(2)}`;

    const list = document.getElementById('transaction-list');
    list.innerHTML = '';

    if (filteredSales.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:gray; margin-top: 20px;">No sales found for this period.</p>';
        return;
    }

    filteredSales.forEach(sale => {
        const isPaid = sale.balance === 0;
        const timeString = sale.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        list.innerHTML += `
            <div class="transaction-card">
                <div class="tx-header">
                    <span>${sale.date.toLocaleDateString()} at ${timeString}</span>
                    <span>${sale.payment_method}</span>
                </div>
                <div class="tx-details">
                    <span>₦${sale.total_amount.toFixed(2)}</span>
                    <span class="status-badge ${isPaid ? 'status-paid' : 'status-half'}">
                        ${isPaid ? 'Fully Paid' : 'Owes ₦' + sale.balance.toFixed(2)}
                    </span>
                </div>
                <p style="font-size: 11px; color: gray; margin-top: 8px;">
                    ${sale.items.map(i => `${i.qty}x ${i.name}`).join(', ')}
                </p>
            </div>
        `;
    });
}
