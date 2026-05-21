require("dotenv").config();
const express = require("express");
const sql = require("mssql");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT !== "false",
    trustServerCertificate: process.env.DB_TRUST_CERTIFICATE !== "false"
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise = null;
async function getPool() {
  if (poolPromise) return poolPromise;
  poolPromise = sql.connect(dbConfig);
  return poolPromise;
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

app.get("/api/customers", authenticateToken, async (req, res) => {
    try {
    const pool = await getPool();
    const result = await pool.request()
      .query("SELECT CustCode, CustName FROM Customer");
    const rows = result.recordset.map(r => ({
      id: r.CustCode,
      name: r.CustName
    }));
    res.json(rows);
  } catch (err) {
    console.error("DB error (customers):", err);
    res.status(500).json({ error: "Failed to fetch customers" });
  } });

app.get("/api/products", authenticateToken, async (req, res) => { 
    try {
    const pool = await getPool();
    const result = await pool.request()
      .query("SELECT Prod_Code, Prod_Name, Selling_Price, PackSize FROM Product WHERE Prod_Code BETWEEN '100100' AND '100120'");
    const rows = result.recordset.map(r => ({
      code: r.Prod_Code,
      name: r.Prod_Name,
      price: r.Selling_Price,
      packSize: r.PackSize
    }));
    res.json(rows);
  } catch (err) {
    console.error("DB error (products):", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }});

app.post("/api/orders", authenticateToken, async (req, res) => {
  const { orderNo, customerId, billing = [], free = [], returns = [], discountAmount = 0, insertUser } = req.body;

  if (!orderNo || !customerId) {
    return res.status(400).json({ error: "Missing order or customer" });
  }

  try {
    const pool = await getPool();
    const user = insertUser || "System";

    const insertQuery = `
      INSERT INTO Orders (OrderNo, CustCode, ProdCode, Tid, Pack, Qty, Discount, InsertUser, InsertDate)
      VALUES (@OrderNo, @CustCode, @ProdCode, @Tid, @Pack, @Qty, @Discount, @InsertUser, GETDATE())
    `;

    const insert = async (items, tid) => {
      for (const item of items) {
        await pool.request()
          .input("OrderNo", sql.VarChar, String(orderNo))
          .input("CustCode", sql.VarChar, customerId)
          .input("ProdCode", sql.VarChar, item.code)
          .input("Tid", sql.VarChar, tid)
          .input("Pack", sql.Decimal(10, 0), Number(item.pack))
          .input("Qty", sql.Decimal(10, 0), Number(item.qty))
          .input("Discount", sql.Decimal(10, 2), Number(discountAmount))
          .input("InsertUser", sql.VarChar, user)
          .query(insertQuery);
      }
    };

    await insert(billing, "BIL");
    await insert(free, "FREE");
    await insert(returns, "RET");

    res.json({ success: true, message: "Order saved successfully" });
  } catch (err) {
    console.error("DB error (save order):", err);
    res.status(500).json({ error: "Failed to save order" });
  }
});

app.get("/api/newOrderNo", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        CASE 
          WHEN MAX(OrderNo) IS NULL OR MAX(OrderNo) = '' THEN 10001 
          ELSE MAX(OrderNo) + 1 
        END AS NextOrderNo
      FROM Orders
    `);
    const nextNo = result.recordset[0].NextOrderNo;
    res.json({ orderNo: nextNo });
  } catch (err) {
    console.error("DB error (new order no):", err);
    res.status(500).json({ error: "Failed to fetch new order number" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Username", sql.VarChar, username)
      .input("Password", sql.VarChar, password)
      .query("SELECT * FROM Users WHERE Username = @Username AND Password = @Password");

    if (result.recordset.length === 0)
      return res.status(401).json({ error: "Invalid username or password" });

    const user = result.recordset[0];

    const token = jwt.sign(
      { id: user.UserID, username: user.Username },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ success: true, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = app;
