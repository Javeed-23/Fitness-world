require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const SQLiteStoreFactory = require("connect-sqlite3");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === "production";
const dbFile = path.resolve(process.env.DATABASE_FILE || path.join(__dirname, "data", "fitnessworld.sqlite"));
const dataDir = path.dirname(dbFile);   /* sessions are stored next to the database */
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','gym_manager','admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  image_url TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS likes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, post_id)
);
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'pro_trial' CHECK(plan IN ('beginner','pro','pro_trial')),
  trial_ends_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  price_paise INTEGER NOT NULL CHECK(price_paise > 0),
  stock INTEGER NOT NULL DEFAULT 1 CHECK(stock >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_id INTEGER NOT NULL REFERENCES users(id),
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  subtotal_paise INTEGER NOT NULL,
  platform_fee_rate REAL NOT NULL,
  platform_fee_paise INTEGER NOT NULL,
  seller_payout_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'demo_pending' CHECK(status IN ('demo_pending','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

if (!db.prepare("PRAGMA table_info(users)").all().some(c => c.name === "session_version")) db.exec("ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0");
if (!db.prepare("PRAGMA table_info(users)").all().some(c => c.name === "goal")) db.exec("ALTER TABLE users ADD COLUMN goal TEXT");
db.exec(`CREATE TABLE IF NOT EXISTS password_resets (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL PRIMARY KEY,
  expires_at TEXT NOT NULL
);`);

db.exec(`CREATE TABLE IF NOT EXISTS user_data (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)`);
const SQLiteStore = SQLiteStoreFactory(session);
if (isProd && (process.env.SESSION_SECRET || "").length < 32) { console.error("Set SESSION_SECRET (32+ characters) before running in production."); process.exit(1); }
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: { directives: { "default-src": ["'self'"], "style-src": ["'self'", "'unsafe-inline'"], "upgrade-insecure-requests": isProd ? [] : null } } }));
const jsonSmall = express.json({ limit: "100kb" }), jsonAccount = express.json({ limit: "1mb" });
app.use((req, res, next) => (req.path === "/api/me/data" ? jsonAccount : jsonSmall)(req, res, next));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: dataDir }),
  name: "fw.sid",
  secret: process.env.SESSION_SECRET || "local-development-only-change-me-before-deploying",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: isProd, maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use("/api", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin) { let host = null; try { host = new URL(origin).host; } catch {} if (host !== req.get("host")) return res.status(403).json({ error: "Cross-site request blocked." }); }
  if (!req.is("application/json")) return res.status(415).json({ error: "Send JSON." });
  next();
});
app.use("/api/auth", rateLimit({ windowMs: 15*60*1000, limit: 60, standardHeaders: true, legacyHeaders: false }));
const loginLimiter = rateLimit({ windowMs: 15*60*1000, limit: 10, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, message: { error: "Too many attempts. Try again in 15 minutes." } });
app.use("/api/marketplace/orders", rateLimit({ windowMs: 60*1000, limit: 20, standardHeaders: true, legacyHeaders: false }));

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, goal: u.goal || null });
function getSessionUser(req) {
  if (!req.session.userId) return null;
  const u = db.prepare("SELECT id,name,email,role,goal,session_version FROM users WHERE id=?").get(req.session.userId);
  return u && u.session_version === (req.session.sv || 0) ? u : null;
}
function requireAuth(req,res,next) {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Please log in first." });
  req.user = user; next();
}
function requirePage(req,res,next) { const u = getSessionUser(req); if (!u) return res.redirect("/login"); req.user = u; next(); }
app.use(["/api/posts", "/api/groups", "/api/marketplace"], requireAuth);

/* Account data: one versioned JSON document per account. A save must name the version it was based on,
   so two open windows cannot silently overwrite each other (the second one gets a 409 and reloads). */
const DATA_KEYS = ["profile", "points", "workouts", "measurements", "foods", "water", "gyms", "challenges", "activity", "posts", "recovery", "extra"];
const MAX_ACCOUNT_BYTES = 900 * 1024;
const getAccountData = db.prepare("SELECT body, version, updated_at FROM user_data WHERE user_id=?");
const saveAccountData = db.prepare("INSERT INTO user_data (user_id, body, version, updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET body=excluded.body, version=excluded.version, updated_at=excluded.updated_at");
const dataLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { error: "Too many saves. Wait a moment and try again." } });
app.get("/api/me/data", requireAuth, (req, res) => {
  const row = getAccountData.get(req.user.id);
  res.set("Cache-Control", "no-store").json(row
    ? { version: row.version, updatedAt: row.updated_at, data: JSON.parse(row.body) }
    : { version: 0, updatedAt: null, data: null });
});
app.put("/api/me/data", requireAuth, dataLimiter, (req, res) => {
  const { baseVersion, data } = req.body || {};
  if (!data || typeof data !== "object" || Array.isArray(data)) return res.status(400).json({ error: "Send the account data as an object." });
  if (!Number.isInteger(baseVersion) || baseVersion < 0) return res.status(400).json({ error: "Send the version you loaded." });
  const picked = {};
  for (const k of DATA_KEYS) if (data[k] !== undefined) picked[k] = data[k];
  const body = JSON.stringify(picked);
  if (Buffer.byteLength(body) > MAX_ACCOUNT_BYTES) return res.status(413).json({ error: "Account data is too large to save." });
  const result = db.transaction(() => {
    const row = getAccountData.get(req.user.id);
    const current = row ? row.version : 0;
    if (current !== baseVersion) return { conflict: true, version: current };
    const version = current + 1;
    saveAccountData.run(req.user.id, body, version, new Date().toISOString());
    return { version };
  })();
  if (result.conflict) return res.status(409).json({ error: "This account was changed in another window. Load the latest data and try again.", version: result.version });
  res.json({ ok: true, version: result.version });
});
function cleanText(v,max) { return typeof v === "string" ? v.trim().slice(0,max) : ""; }
function money(n) { return Math.round(n); }

app.get("/api/health",(req,res)=>res.json({ok:true,service:"FitnessWorld API"}));
app.get("/api/plans",(req,res)=>res.json({
  plans: [
    {id:"beginner",name:"Gym Beginner",priceRupees:199,period:"month",challengeCredits:4,platformFeePercent:5},
    {id:"pro",name:"Gym Pro",priceRupees:499,period:"month",challengeCredits:10,platformFeePercent:1}
  ],
  groupCreationFeeRupees:50,
  eligibleNewGroupTrialDays:7,
  note:"Marketplace fee applies only to marketplace sales, not subscriptions or group creation."
}));

const GOALS = ["lose","build","fit","endure"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);
const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
function passwordProblem(p) {
  if (typeof p !== "string" || p.length < 10 || p.length > 128) return "Password must be 10–128 characters.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Password must include a letter and a number.";
  return null;
}
function startSession(req, res, next, user, status) {
  req.session.regenerate(err => {
    if (err) return next(err);
    req.session.userId = user.id; req.session.sv = user.session_version;
    res.status(status).json({ user: publicUser(user) });
  });
}
app.post("/api/auth/register", async (req,res,next)=>{
  try {
    const name=cleanText(req.body.name,60), email=cleanText(req.body.email,160).toLowerCase(), goal=cleanText(req.body.goal,10), { password, confirmPassword } = req.body;
    if(!GOALS.includes(goal)) return res.status(400).json({error:"Choose your fitness goal."});
    if(name.length<2) return res.status(400).json({error:"Enter your full name."});
    if(!EMAIL_RE.test(email)) return res.status(400).json({error:"Enter a valid email address."});
    const pp=passwordProblem(password); if(pp) return res.status(400).json({error:pp});
    if(password!==confirmPassword) return res.status(400).json({error:"Passwords do not match."});
    const info=db.prepare("INSERT INTO users (name,email,password_hash,goal) VALUES (?,?,?,?)").run(name,email,await bcrypt.hash(password,12),goal);
    startSession(req,res,next,db.prepare("SELECT id,name,email,role,goal,session_version FROM users WHERE id=?").get(info.lastInsertRowid),201);
  } catch(e) { if(String(e.code)==="SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({error:"An account with this email already exists."}); next(e); }
});
app.post("/api/auth/login", loginLimiter, async (req,res,next)=>{
  try {
    const email=cleanText(req.body.email,160).toLowerCase(), password=typeof req.body.password==="string"?req.body.password:"";
    const u=db.prepare("SELECT * FROM users WHERE email=?").get(email);
    const ok=await bcrypt.compare(password,u?u.password_hash:DUMMY_HASH);
    if(!u||!ok) return res.status(401).json({error:"Email or password is incorrect."});
    startSession(req,res,next,u,200);
  } catch(e) { next(e); }
});
app.post("/api/auth/logout",(req,res)=>req.session.destroy(()=>{res.clearCookie("fw.sid");res.json({ok:true});}));
app.get("/api/auth/me",(req,res)=>{ const u=getSessionUser(req); res.set("Cache-Control","no-store").json({user:u?publicUser(u):null}); });

const mailer = process.env.SMTP_HOST ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === "true", auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined }) : null;
app.post("/api/auth/forgot-password", async (req,res,next)=>{
  try {
    if(!mailer) return res.status(503).json({error:"Password reset email is not set up on this server."});
    const email=cleanText(req.body.email,160).toLowerCase();
    if(!EMAIL_RE.test(email)) return res.status(400).json({error:"Enter a valid email address."});
    const u=db.prepare("SELECT id,email FROM users WHERE email=?").get(email);
    if(u) {
      const token=crypto.randomBytes(32).toString("hex");
      db.prepare("DELETE FROM password_resets WHERE user_id=?").run(u.id);
      db.prepare("INSERT INTO password_resets (user_id,token_hash,expires_at) VALUES (?,?,?)").run(u.id,sha256(token),new Date(Date.now()+60*60*1000).toISOString());
      const link=`${(process.env.APP_URL||`http://localhost:${PORT}`).replace(/\/$/,"")}/reset-password?token=${token}`;
      try { await mailer.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: u.email, subject: "Reset your FitnessWorld password", text: `Use this link to choose a new password. It expires in 1 hour.\n\n${link}\n\nIf you did not ask for this, ignore this email.` }); }
      catch(e) { console.error("Reset email failed:", e.message); return res.status(502).json({error:"We couldn't send the email. Try again later."}); }
    }
    res.json({ok:true,message:"If an account exists for that email, a reset link is on its way."});
  } catch(e) { next(e); }
});
app.post("/api/auth/reset-password", async (req,res,next)=>{
  try {
    const token=typeof req.body.token==="string"?req.body.token:"", { password, confirmPassword } = req.body;
    const pp=passwordProblem(password); if(pp) return res.status(400).json({error:pp});
    if(password!==confirmPassword) return res.status(400).json({error:"Passwords do not match."});
    const row=db.prepare("SELECT user_id FROM password_resets WHERE token_hash=? AND expires_at>?").get(sha256(token),new Date().toISOString());
    if(!row) return res.status(400).json({error:"This reset link is invalid or has expired."});
    const hash=await bcrypt.hash(password,12);
    db.transaction(()=>{ db.prepare("UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?").run(hash,row.user_id); db.prepare("DELETE FROM password_resets WHERE user_id=?").run(row.user_id); })();
    res.json({ok:true});
  } catch(e) { next(e); }
});

app.get("/api/posts",(req,res)=>{
  const posts=db.prepare(`
    SELECT p.id,p.body,p.image_url,p.is_demo,p.created_at,u.id AS user_id,u.name AS user_name,
    (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) AS like_count,
    CASE WHEN ? IS NULL THEN 0 ELSE EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.user_id=?) END AS liked_by_me
    FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC,p.id DESC LIMIT 100
  `).all(req.session.userId||null,req.session.userId||null);
  res.json({posts});
});
app.post("/api/posts",requireAuth,(req,res)=>{
  const body=cleanText(req.body.body,1000), imageUrl=cleanText(req.body.imageUrl,500);
  if(body.length<1) return res.status(400).json({error:"Write something before posting."});
  if(imageUrl && !/^https:\/\/\S+$/i.test(imageUrl)) return res.status(400).json({error:"Image URL must start with https://."});
  const info=db.prepare("INSERT INTO posts (user_id,body,image_url) VALUES (?,?,?)").run(req.user.id,body,imageUrl||null);
  res.status(201).json({post:db.prepare("SELECT p.id,p.body,p.image_url,p.is_demo,p.created_at,u.id AS user_id,u.name AS user_name,0 AS like_count,0 AS liked_by_me FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=?").get(info.lastInsertRowid)});
});
app.post("/api/posts/:id/like",requireAuth,(req,res)=>{
  const postId=Number(req.params.id);
  if(!Number.isSafeInteger(postId)) return res.status(400).json({error:"Invalid post id."});
  if(!db.prepare("SELECT id FROM posts WHERE id=?").get(postId)) return res.status(404).json({error:"Post not found."});
  const existing=db.prepare("SELECT 1 FROM likes WHERE user_id=? AND post_id=?").get(req.user.id,postId);
  if(existing) db.prepare("DELETE FROM likes WHERE user_id=? AND post_id=?").run(req.user.id,postId);
  else db.prepare("INSERT INTO likes (user_id,post_id) VALUES (?,?)").run(req.user.id,postId);
  res.json({liked:!existing,likeCount:db.prepare("SELECT COUNT(*) AS n FROM likes WHERE post_id=?").get(postId).n});
});

app.get("/api/groups",(req,res)=>{
  const rows=db.prepare("SELECT g.id,g.name,g.description,g.plan,g.trial_ends_at,g.created_at,u.name AS owner_name FROM groups g JOIN users u ON u.id=g.owner_id ORDER BY g.id DESC").all();
  res.json({groups:rows});
});
app.post("/api/groups",requireAuth,(req,res)=>{
  const name=cleanText(req.body.name,80), description=cleanText(req.body.description,500);
  if(name.length<3) return res.status(400).json({error:"Group name must be at least 3 characters."});
  // Fee is recorded as a disclosed rule only; no money is collected by this local demo.
  const trialEnds=new Date(Date.now()+7*24*60*60*1000).toISOString();
  const info=db.prepare("INSERT INTO groups (owner_id,name,description,plan,trial_ends_at) VALUES (?,?,?,'pro_trial',?)").run(req.user.id,name,description,trialEnds);
  res.status(201).json({group:{id:Number(info.lastInsertRowid),name,description,plan:"pro_trial",trial_ends_at:trialEnds},groupCreationFeeRupees:50,paymentStatus:"not_collected_demo"});
});

app.get("/api/marketplace/listings",(req,res)=>{
  const q=cleanText(req.query.q,80), category=cleanText(req.query.category,60);
  let sql=`SELECT l.id,l.title,l.description,l.category,l.price_paise,l.stock,l.created_at,u.id AS seller_id,u.name AS seller_name,u.role AS seller_role,
  (SELECT plan FROM groups g WHERE g.owner_id=u.id ORDER BY g.id DESC LIMIT 1) AS group_plan FROM listings l JOIN users u ON u.id=l.seller_id WHERE l.stock>0`;
  const params=[];
  if(q){sql+=" AND (l.title LIKE ? OR l.description LIKE ?)";params.push(`%${q}%`,`%${q}%`);}
  if(category){sql+=" AND l.category=?";params.push(category);}
  sql+=" ORDER BY l.created_at DESC,l.id DESC LIMIT 100";
  const listings=db.prepare(sql).all(...params).map(l=>({...l,priceRupees:l.price_paise/100,platformFeePercent:l.group_plan==="pro"?1:5}));
  res.json({listings});
});
app.post("/api/marketplace/listings",requireAuth,(req,res)=>{
  const title=cleanText(req.body.title,100), description=cleanText(req.body.description,1000), category=cleanText(req.body.category,60);
  const price=Number(req.body.priceRupees), stock=Number(req.body.stock??1);
  const allowed=["Equipment","Physical products","Coaching & services","Digital fitness product","Gym pass","Program or workshop"];
  if(title.length<3 || description.length<5) return res.status(400).json({error:"Add a title and a longer description."});
  if(!allowed.includes(category)) return res.status(400).json({error:"Choose a supported category."});
  if(!Number.isFinite(price)||price<=0||price>1000000) return res.status(400).json({error:"Enter a valid price."});
  if(!Number.isInteger(stock)||stock<0||stock>10000) return res.status(400).json({error:"Stock must be a whole number from 0 to 10,000."});
  const info=db.prepare("INSERT INTO listings (seller_id,title,description,category,price_paise,stock) VALUES (?,?,?,?,?,?)").run(req.user.id,title,description,category,money(price*100),stock);
  res.status(201).json({listing:{id:Number(info.lastInsertRowid),title,description,category,priceRupees:price,stock}});
});
app.post("/api/marketplace/orders",requireAuth,(req,res)=>{
  const listingId=Number(req.body.listingId), quantity=Number(req.body.quantity||1);
  if(!Number.isSafeInteger(listingId)||!Number.isInteger(quantity)||quantity<1||quantity>20) return res.status(400).json({error:"Invalid listing or quantity."});
  const listing=db.prepare(`SELECT l.*,u.id AS seller_id FROM listings l JOIN users u ON u.id=l.seller_id WHERE l.id=?`).get(listingId);
  if(!listing) return res.status(404).json({error:"Listing not found."});
  if(listing.seller_id===req.user.id) return res.status(400).json({error:"You cannot order your own listing."});
  if(listing.stock<quantity) return res.status(400).json({error:"Not enough stock available."});
  const latestPlan=db.prepare("SELECT plan FROM groups WHERE owner_id=? ORDER BY id DESC LIMIT 1").get(listing.seller_id);
  const feeRate=latestPlan && latestPlan.plan==="pro" ? 0.01 : 0.05;
  const subtotal=listing.price_paise*quantity, fee=money(subtotal*feeRate), payout=subtotal-fee;
  const create=db.transaction(()=>{
    const result=db.prepare("INSERT INTO orders (buyer_id,listing_id,quantity,subtotal_paise,platform_fee_rate,platform_fee_paise,seller_payout_paise) VALUES (?,?,?,?,?,?,?)")
      .run(req.user.id,listingId,quantity,subtotal,feeRate,fee,payout);
    db.prepare("UPDATE listings SET stock=stock-? WHERE id=?").run(quantity,listingId);
    return Number(result.lastInsertRowid);
  });
  const id=create();
  res.status(201).json({order:{id,listingId,quantity,subtotalRupees:subtotal/100,platformFeePercent:feeRate*100,platformFeeRupees:fee/100,sellerPayoutRupees:payout/100,status:"demo_pending"},paymentStatus:"not_collected_demo",message:"Demo order created. No payment was taken. Marketplace fee is not added to subscriptions or group creation."});
});
app.get("/api/marketplace/orders/mine",requireAuth,(req,res)=>{
  const orders=db.prepare(`SELECT o.*,l.title,bu.name AS buyer_name,su.name AS seller_name FROM orders o JOIN listings l ON l.id=o.listing_id JOIN users bu ON bu.id=o.buyer_id JOIN users su ON su.id=l.seller_id WHERE o.buyer_id=? OR l.seller_id=? ORDER BY o.id DESC LIMIT 100`).all(req.user.id,req.user.id)
    .map(o=>({...o,subtotalRupees:o.subtotal_paise/100,platformFeeRupees:o.platform_fee_paise/100,sellerPayoutRupees:o.seller_payout_paise/100,platformFeePercent:o.platform_fee_rate*100}));
  res.json({orders});
});

const sendFile = (res, dir, f) => res.set("Cache-Control", "no-store").sendFile(path.join(__dirname, dir, f));
for (const p of ["login", "register", "forgot-password"]) app.get("/" + p, (req,res)=> getSessionUser(req) ? res.redirect("/") : sendFile(res, "public", p + ".html"));
app.get("/reset-password", (req,res)=>sendFile(res, "public", "reset-password.html"));
app.get("/", requirePage, (req,res)=>sendFile(res, "private", "index.html"));
app.get("/app.js", requirePage, (req,res)=>sendFile(res, "private", "app.js"));
app.get("/session.js", requirePage, (req,res)=>res.type("js").set("Cache-Control","no-store").send("window.FW_USER="+JSON.stringify({id:req.user.id,name:req.user.name,goal:req.user.goal||null}).replace(/</g,"\u003c")+";"));
app.use(express.static(path.join(__dirname,"public"),{index:false}));
app.use("/api",(req,res)=>res.status(404).json({error:"Not found."}));
app.get("*",(req,res)=>res.redirect("/"));
app.use((err,req,res,next)=>{
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.expose ? err.message : "Request not accepted." });
  console.error(err); res.status(500).json({error:"Unexpected server error."});
});

app.listen(PORT,()=>console.log(`FitnessWorld running at http://localhost:${PORT}`));
