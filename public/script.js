let selectedProduct = null;
let billingItems = [];
let freeItems = [];
let returnItems = [];
let currentOrderNo = null;
let allCustomers = [];
let selectedCustomer = null;

const packInput = document.getElementById("packInput");
const qtyInput = document.getElementById("qtyInput");
const discountPercent = document.getElementById("discountPercent");
const discountAmount = document.getElementById("discountAmount");
const billingTotalEl = document.getElementById("billingTotal");
const returnTotalEl = document.getElementById("returnTotal");
const discountDisplay = document.getElementById("discountDisplay");
const netTotalEl = document.getElementById("netTotal");
const orderJson = document.getElementById("orderJson");
const summary = document.getElementById("summary");
const orderNoDisplay = document.getElementById("orderNoDisplay");

const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "login.html";
}

// Display logged in username
const loginUserLabel = document.getElementById("loginUser");
const savedUsername = localStorage.getItem("username");

if (savedUsername) {
    loginUserLabel.textContent = "👤 " + savedUsername;
}

// ✅ LOAD CUSTOMERS
async function loadCustomers() {
  try {
    const res = await fetch("/api/customers", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) throw new Error(`Failed to fetch customers (${res.status})`);
    allCustomers = await res.json();
    renderCustomerList(allCustomers);
  } catch (err) {
    console.error("❌ Could not load customers:", err);
    alert("⚠️ Failed to load customers from server. Please log in again.");
    localStorage.removeItem("token");
    window.location.href = "login.html";
  }
}

// ✅ DISPLAY CUSTOMER LIST
function renderCustomerList(customers) {
  const list = document.getElementById("customerList");
  list.innerHTML = "";

  if (customers.length === 0) {
    list.innerHTML = `<div>No results found</div>`;
    return;
  }

  customers.forEach(c => {
    const div = document.createElement("div");
    div.textContent = c.name;
    div.onclick = () => {
      selectedCustomer = c;
      document.getElementById("customerSearch").value = c.name;
      list.classList.add("hidden");
    };
    list.appendChild(div);
  });
}

// ✅ LOAD PRODUCTS
async function loadProducts() {
  try {
    const res = await fetch("/api/products", {
      headers: {
        "Authorization": `Bearer ${token}`,
      }
    });

    if (!res.ok) throw new Error("Failed to fetch products");
    const products = await res.json();

    const grid = document.getElementById("productsGrid");
    grid.innerHTML = "";
    products.forEach(p => {
      const div = document.createElement("div");
      div.className = "product";
      div.innerHTML = `<strong>${p.name}</strong><br>Rs.${p.price}`;
      div.onclick = () => {
        const selected = div.classList.contains("selected");
        document.querySelectorAll(".product").forEach(x => x.classList.remove("selected"));
        if (!selected) {
          div.classList.add("selected");
          selectedProduct = p;
        } else selectedProduct = null;
      };
      grid.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    alert("⚠️ Failed to load products.");
  }
}

// ✅ ORDER NUMBER
async function loadNextOrderNo() {
  try {
    const res = await fetch("/api/newOrderNo");
    const data = await res.json();
    currentOrderNo = data.orderNo;
    orderNoDisplay.textContent = currentOrderNo;
  } catch (err) {
    console.error("Failed to load order number:", err);
    orderNoDisplay.textContent = "Error";
  }
}

// ✅ CALCULATE TOTALS
function calculateTotals() {
  const billingTotal = billingItems.reduce((sum, i) => sum + (i.qty + i.pack * i.packSize) * i.price, 0);
  const returnTotal = returnItems.reduce((sum, i) => sum + (i.qty + i.pack * i.packSize) * i.price, 0);

  let discount = 0;
  if (discountPercent.value) discount = (billingTotal * discountPercent.value) / 100;
  else if (discountAmount.value) discount = parseFloat(discountAmount.value);

  const netTotal = billingTotal - discount - returnTotal;

  billingTotalEl.textContent = billingTotal.toFixed(2);
  returnTotalEl.textContent = returnTotal.toFixed(2);
  discountDisplay.textContent = discount.toFixed(2);
  netTotalEl.textContent = netTotal.toFixed(2);
}

// ✅ REFRESH TABLES
function refreshTables() {
  const tables = [
    {items: billingItems, tbody: document.querySelector("#billingTable tbody"), table: document.getElementById("billingTable")},
    {items: freeItems, tbody: document.querySelector("#freeTable tbody"), table: document.getElementById("freeTable")},
    {items: returnItems, tbody: document.querySelector("#returnTable tbody"), table: document.getElementById("returnTable")},
  ];

  tables.forEach(t => {
    if(t.items.length > 0) t.table.classList.remove("hidden");
    else t.table.classList.add("hidden");
    t.tbody.innerHTML = t.items.map(i => `
      <tr>
        <td>${i.name}</td>
        <td>${i.pack}</td>
        <td>${i.qty}</td>
        <td>${((i.qty + (i.pack * i.packSize)) * i.price).toFixed(2)}</td>
      </tr>
    `).join("");
  });

  calculateTotals();
}

// ✅ ADD ITEM
function addItem(type) {
  if (!selectedCustomer?.id || !selectedProduct || !packInput.value || !qtyInput.value) {
    alert("⚠️ Fill all fields");
    return;
  }

  const item = {
    code: selectedProduct.code,
    name: selectedProduct.name,
    pack: Number(packInput.value),
    qty: Number(qtyInput.value),
    price: selectedProduct.price,
    packSize: Number(selectedProduct.packSize)
  };

  // ✅ Decide which list to add/update
  let targetArray;
  if (type === "billing") targetArray = billingItems;
  else if (type === "free") targetArray = freeItems;
  else if (type === "return") targetArray = returnItems;

  // ✅ Check if item already exists
  const existing = targetArray.find(i => i.code === item.code);

  if (existing) {
    // ✅ Update existing item quantities instead of adding duplicate
    existing.pack = item.pack;
    existing.qty = item.qty;
  } else {
    targetArray.push(item);
  }

  // Clear inputs and selections
  packInput.value = "";
  qtyInput.value = "";
  selectedProduct = null;
  document.querySelectorAll(".product").forEach(p => p.classList.remove("selected"));

  refreshTables();
}


// ✅ SAVE ORDER
async function saveOrder() {
  const billingTotal = billingItems.reduce((sum, i) => sum + (i.qty + i.pack * i.packSize) * i.price, 0);
  const returnTotal = returnItems.reduce((sum, i) => sum + (i.qty + i.pack * i.packSize) * i.price, 0);

  let discountAmt = 0;
  if (discountPercent.value) discountAmt = (billingTotal * discountPercent.value) / 100;
  else if (discountAmount.value) discountAmt = parseFloat(discountAmount.value);

  const order = {
    orderNo: currentOrderNo,
    customerId: selectedCustomer?.id,
    billing: billingItems,
    free: freeItems,
    returns: returnItems,
    discountAmount: discountAmt,
    insertUser: savedUsername,
  };

  if (!order.customerId) return alert("⚠️ Please select a customer!");
  if (billingItems.length === 0 && freeItems.length === 0 && returnItems.length === 0) {
    return alert("⚠️ No items to save!");
  }

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(order),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save order");

    orderJson.textContent = JSON.stringify(order, null, 2);
    summary.classList.remove("hidden");
    alert("✅ Order saved successfully!");
    billingItems = [];
    freeItems = [];
    returnItems = [];
    discountPercent.value = "";
    discountAmount.value = "";
    refreshTables();
    loadNextOrderNo();
  } catch (err) {
    console.error(err);
    alert("❌ Failed to save order!");
  }
}

// ✅ FILTER CUSTOMER LIST WHILE TYPING
document.getElementById("customerSearch").addEventListener("input", e => {
  const text = e.target.value.toLowerCase();
  const filtered = allCustomers.filter(c => c.name.toLowerCase().includes(text));
  renderCustomerList(filtered);
  document.getElementById("customerList").classList.remove("hidden");
});

// ✅ HIDE DROPDOWN WHEN CLICK OUTSIDE
document.addEventListener("click", e => {
  if (!e.target.closest(".customer-select-box")) {
    document.getElementById("customerList").classList.add("hidden");
  }
});

discountPercent.addEventListener("input", () => {
  if (discountPercent.value) discountAmount.value = "";
  calculateTotals();
});
discountAmount.addEventListener("input", () => {
  if (discountAmount.value) discountPercent.value = "";
  calculateTotals();
});

document.getElementById("getBtn").onclick = () => addItem("billing");
document.getElementById("addFreeBtn").onclick = () => addItem("free");
document.getElementById("addReturnBtn").onclick = () => addItem("return");
document.getElementById("saveBtn").onclick = saveOrder;
document.getElementById("newBtn").onclick = () => {
  summary.classList.add("hidden");
  billingItems = [];
  freeItems = [];
  returnItems = [];
  refreshTables();
  loadNextOrderNo();
  loadCustomers();
};
document.getElementById("logoutBtn").onclick = () => {
  localStorage.removeItem("token");
  window.location.href = "login.html";
};
document.getElementById("themeToggle").onclick = () => {
  document.body.classList.toggle("light");
  themeToggle.textContent = document.body.classList.contains("light") ? "☀️" : "🌙";
};

// ✅ INITIAL LOAD
loadCustomers();
loadProducts();
loadNextOrderNo();
