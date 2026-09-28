const products=require("./products.json");
const orders=require("./orders.json");

const supabase=require("./supabase");const express=require("express"),session=require("express-session"),bcrypt=require("bcryptjs"),fs=require("fs");

const app=express(),PORT=process.env.PORT||3000,DB="./database.json";

if(!fs.existsSync(DB))fs.writeFileSync(DB,JSON.stringify({users:[],scores:[]},null,2));
const read=()=>JSON.parse(fs.readFileSync(DB,"utf8"));
const write=x=>fs.writeFileSync(DB,JSON.stringify(x,null,2));

app.use(express.urlencoded({extended:false}));
app.use(express.json());
app.use(express.static("public"));

app.use(session({
  secret:process.env.SESSION_SECRET||"CHANGE_ME",
  resave:false,
  saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:"lax",maxAge:86400000}
}));

const page=(t,b)=>`<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<link rel="stylesheet" href="/style.css">
<style>
.game-area{position:relative;height:360px;margin:15px 0;border:2px solid #ddd;border-radius:18px;overflow:hidden;background:#f7f7f7}
.target{position:absolute;width:55px;height:55px;border:0;border-radius:50%;background:#222;color:white;font-size:24px;display:none}
.timer{font-size:22px;font-weight:bold}
.score{font-size:24px;font-weight:bold}
</style>
</head>
<body>${b}</body></html>`;
const auth=async(q,r,n)=>{
  if(!q.session.userId)return r.redirect("/login");

  const {data:user,error}=await supabase
    .from("users")
    .select("id,username,role,score")
    .eq("id",q.session.userId)
    .maybeSingle();

  if(error||!user){
    console.error("AUTH ERROR:",error);
    return r.status(500).send("AUTH ERROR: "+(error?.message||"ไม่พบผู้ใช้"));
  }

  q.session.user=user;
  q.session.role=user.role;
  n();
};

const adminAuth=async(q,r,n)=>{
  if(!q.session.userId)return r.redirect("/admin/login");

  const {data:user,error}=await supabase
    .from("users")
    .select("id,username,role,score")
    .eq("id",q.session.userId)
    .maybeSingle();

  if(error||!user){
    return r.status(500).send("ADMIN AUTH ERROR");
  }

  if(user.role!=="admin"){
    return r.status(403).send("ไม่มีสิทธิ์เข้าถึง Admin");
  }

  q.session.user=user;
  q.session.role=user.role;
  n();
};

app.get("/",(q,r)=>r.redirect(q.session.userId?"/member":"/login"));

app.get("/orders",auth,(q,r)=>{
  const userOrders=orders.filter(o=>o.username===q.session.user.username);

  const list=userOrders.length
    ? userOrders.map(o=>`
      <div class="order-card">
        <h3>🧾 ${o.id}</h3>
        <p>🎮 ${o.game}</p>
        <p>💎 ${o.productName}</p>
        <p>🆔 Player ID: ${o.playerId}</p>
        <p>💰 ฿${o.price}</p>
        <p>สถานะ: ⏳ ${o.status}</p>
      </div>
    `).join("")
    : "<p>ยังไม่มีคำสั่งซื้อ</p>";

  r.send(page("Orders",`
    <main class="box">
      <h1>📦 ออเดอร์ของฉัน</h1>
      ${list}
      <a class="back" href="/member">← กลับหน้าหลัก</a>
    </main>
  `));
});

app.get("/profile",auth,(q,r)=>{
  const userOrders=orders.filter(o=>o.username===q.session.user.username);

  r.send(page("บัญชี",`
    <main class="box">
      <h1>👤 บัญชีของฉัน</h1>

      <div class="order-card">
        <h3>👋 ${q.session.user.username}</h3>
        <p>📦 จำนวนออเดอร์: ${userOrders.length}</p>
      </div>

      <a class="back" href="/member">← กลับหน้าหลัก</a>
    </main>
  `));
});

app.get("/admin/login",(q,r)=>r.send(page("Admin Login",`
<main class="auth-page">
  <div class="auth-card">
    <h1>👑 Admin Login</h1>
    <p>เข้าสู่ระบบหลังบ้าน VOIDARK</p>

    <form method="POST" action="/admin/login">
      <input
        type="text"
        name="username"
        placeholder="Admin Username"
        required
      >

      <input
        type="password"
        name="password"
        placeholder="Admin Password"
        required
      >

      <button type="submit">เข้าสู่ระบบ Admin</button>
    </form>

    <a class="back" href="/login">← กลับหน้า Login</a>
  </div>
</main>
`)));

app.post("/admin/login",async(q,r)=>{
  const {username,password}=q.body;

  if(username!==process.env.ADMIN_USERNAME){
    return r.status(401).send("Admin Login ไม่สำเร็จ");
  }

  const valid=await bcrypt.compare(
    password,
    process.env.ADMIN_PASSWORD_HASH
  );

  if(!valid){
    return r.status(401).send("Admin Login ไม่สำเร็จ");
  }

  const {data:user,error}=await supabase
    .from("users")
    .select("id,username,role,score")
    .eq("username",username)
    .eq("role","admin")
    .maybeSingle();

  if(error||!user){
    return r.status(403).send("บัญชีนี้ไม่มีสิทธิ์ Admin");
  }

  q.session.userId=user.id;
  q.session.user=user;
  q.session.role="admin";

  r.redirect("/admin");
});

app.get("/admin",adminAuth,(q,r)=>{
  const list=orders.length
    ? orders.map(o=>`
      <div class="order-card">
        <h3>🧾 ${o.id}</h3>
        <p>👤 Username: ${o.username}</p>
        <p>🎮 ${o.game}</p>
        <p>💎 ${o.productName}</p>
        <p>🆔 Player ID: ${o.playerId}</p>
        <p>💰 ฿${o.price}</p>
        <p>📌 สถานะ: ${o.status}</p>
      </div>
    `).join("")
    : "<p>ยังไม่มีออเดอร์</p>";

  r.send(page("Admin Dashboard",`
    <main class="box">
      <h1>👑 Admin Dashboard</h1>
      <p>จัดการออเดอร์ทั้งหมด</p>

      ${list}

      <a class="back" href="/member">← กลับหน้าหลัก</a>
    </main>
  `));
});

app.get("/login",(q,r)=>r.send(page("Login",`
<style>
.login-page{
  min-height:75vh;
  background:#050914;
  border-radius:20px;
  padding:25px 15px 45px;
  box-sizing:border-box;
}

/* กลับหน้าหลัก */
.login-back{
  display:block;
  max-width:410px;
  margin:0 auto 25px;
  color:#8da8d2;
  text-decoration:none;
  font-size:14px;
}

/* โลโก้อยู่นอกกรอบ */
.login-brand{
  text-align:center;
  color:#fff;
  margin-bottom:28px;
}

.login-brand .v{
  width:62px;
  height:62px;
  margin:0 auto 12px;
  border:2px solid #438cff;
  border-radius:18px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:32px;
  font-weight:900;
  box-shadow:0 0 25px rgba(67,140,255,.35);
}

.login-brand h1{
  margin:0;
  font-size:30px;
  letter-spacing:2px;
}

.login-brand p{
  margin:6px 0 0;
  color:#7898c5;
  font-size:12px;
  letter-spacing:2px;
}

/* กรอบ Login */
.login-card{
  width:100%;
  max-width:410px;
  margin:auto;
  padding:30px 24px;
  box-sizing:border-box;
  background:#080f1e;
  border:1px solid #1d3d70;
  border-radius:24px;
  color:#fff;
  box-shadow:0 15px 45px rgba(0,0,0,.4);
}

.login-card h2{
  text-align:center;
  margin:0 0 8px;
  font-size:25px;
}

.login-welcome{
  text-align:center;
  color:#7898c5;
  margin:0 0 25px;
  font-size:14px;
}

.login-form{
  display:flex;
  flex-direction:column;
  gap:12px;
}

.login-form input{
  width:100%;
  box-sizing:border-box;
  padding:14px 15px;
  border:1px solid #254875;
  border-radius:12px;
  background:#06142b;
  color:#fff;
  font-size:16px;
  outline:none;
}

.login-form input:focus{
  border-color:#438cff;
  box-shadow:0 0 12px rgba(67,140,255,.2);
}

.login-options{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin:2px 0 5px;
  font-size:13px;
  color:#91a9ce;
}

.remember{
  display:flex;
  align-items:center;
  gap:6px;
}

.remember input{
  width:auto;
  accent-color:#438cff;
}

.forgot{
  color:#4d9aff;
  text-decoration:none;
}

.login-btn{
  width:100%;
  border:0;
  border-radius:12px;
  padding:14px;
  background:linear-gradient(90deg,#286fff,#438cff);
  color:#fff;
  font-size:16px;
  font-weight:bold;
  cursor:pointer;
}

.divider{
  display:flex;
  align-items:center;
  gap:10px;
  margin:20px 0;
  color:#60799e;
  font-size:13px;
}

.divider:before,
.divider:after{
  content:"";
  height:1px;
  flex:1;
  background:#20385d;
}

.google-btn{
  width:100%;
  border:1px solid #315987;
  border-radius:12px;
  padding:13px;
  background:#0a172c;
  color:#fff;
  font-size:15px;
  cursor:pointer;
}

.google-btn b{
  margin-right:7px;
  font-size:18px;
}

.login-link{
  text-align:center;
  margin:20px 0 0;
  color:#7890b3;
}

.login-link a{
  color:#4d9aff;
  font-weight:bold;
  text-decoration:none;
}
</style>

<main class="login-page">

  <a class="login-back" href="/">
    ← กลับสู่หน้าหลัก
  </a>

  <!-- โลโก้อยู่นอกกรอบ -->
  <div class="login-brand">
    <div class="v">V</div>
    <h1>VOIDARK</h1>
    <p>PLAY • SCORE • RANK</p>
  </div>

  <!-- กรอบ Login -->
  <div class="login-card">

    <h2>เข้าสู่ระบบ</h2>

    <p class="login-welcome">
      ยินดีต้อนรับสู่ VOIDARK
    </p>

    <form class="login-form" method="post" action="/login">

      <input
        name="username"
        placeholder="ชื่อผู้ใช้งาน"
        autocomplete="username"
        required
      >

      <input
        name="password"
        type="password"
        placeholder="รหัสผ่าน"
        autocomplete="current-password"
        required
      >

      <div class="login-options">

        <label class="remember">
          <input type="checkbox" name="remember">
          จดจำฉันไว้
        </label>

        <a
          class="forgot"
          href="#"
          onclick="alert('ระบบลืมรหัสผ่านกำลังพัฒนา');return false;"
        >
          ลืมรหัสผ่าน?
        </a>

      </div>

      <button class="login-btn" type="submit">
        เข้าสู่ระบบ →
      </button>

    </form>

    <div class="divider">หรือ</div>

    <button
      class="google-btn"
      type="button"
      onclick="alert('เข้าสู่ระบบด้วย Google กำลังพัฒนา')"
    >
      <b>G</b> เข้าสู่ระบบด้วย Google
    </button>

    <p class="login-link">
      ยังไม่มีบัญชี?
      <a href="/register">สมัครสมาชิก</a>
    </p>

  </div>

</main>
`)));

app.post("/login",async(q,r)=>{
console.log("LOGIN REQUEST:",
q.body.username);
  const {username,password}=q.body;

  const {data:u,error}=await supabase
    .from("users")
    .select("id,username,password,role,score")
    .eq("username",username)
    .maybeSingle();

console.log("LOGIN USER FOUND:", !!u);

  if(error){
    console.error("LOGIN ERROR:",error);
    return r.status(500).send("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
  }

  if(!u || !(await bcrypt.compare(password,u.password)))
    return r.status(401).send(page("Login",'<main class="box"><h1>เข้าสู่ระบบไม่สำเร็จ</h1><a href="/login">ลองอีกครั้ง</a></main>'));

  q.session.userId=u.id;
  q.session.role=u.role;
  r.redirect("/member");
});

app.get("/register",(q,r)=>r.send(page("Register",`
<style>
.auth-page{
  min-height:75vh;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:30px 15px;
}
.auth-card{
  width:100%;
  max-width:390px;
  background:#080f1e;
  color:#fff;
  border-radius:24px;
  padding:30px 24px;
  box-shadow:0 15px 40px rgba(0,0,0,.25);
  box-sizing:border-box;
}
.auth-logo{
  text-align:center;
  margin-bottom:22px;
}
.auth-logo .icon{
  font-size:48px;
}
.auth-logo h1{
  margin:5px 0 0;
  font-size:30px;
}
.auth-logo p{
  margin:5px 0 0;
  color:#777;
}
.auth-card h2{
  text-align:center;
  margin:0 0 22px;
}
.auth-card form{
  display:flex;
  flex-direction:column;
  gap:12px;
}
.auth-card input{
  width:100%;
  box-sizing:border-box;
  padding:14px 15px;
  border:1px solid #ddd;
  border-radius:12px;
  font-size:16px;
  outline:none;
}
.auth-card input:focus{
  border-color:#667eea;
}
.auth-card button{
  border:0;
  border-radius:12px;
  padding:14px;
  background:#222;
  color:#fff;
  font-size:16px;
  font-weight:bold;
  cursor:pointer;
}
.auth-link{
  text-align:center;
  margin:20px 0 0;
  color:#666;
}
.auth-link a{
  font-weight:bold;
  color:#536dfe;
  text-decoration:none;
}
.hint{
  text-align:center;
  color:#888;
  font-size:13px;
  margin-top:12px;
}
</style>

<main class="auth-page">
  <div class="auth-card">
    <div class="auth-logo">
      <div class="v-logo">V</div>
      <h1>VOIDARK</h1>
      <p>JOIN VOIDARK</p>
    </div>

    <h2>📝 สร้างบัญชี</h2>

    <form method="post">
      <input name="username" placeholder="ชื่อผู้ใช้ 3-24 ตัว" required>
      <input name="password" type="password" placeholder="รหัสผ่านอย่างน้อย 8 ตัว" required>
      <button type="submit">สมัครสมาชิก</button>
    </form>

    <p class="auth-link">
      มีบัญชีอยู่แล้ว?
      <a href="/login">เข้าสู่ระบบ</a>
    </p>

    <p class="hint">ใช้ตัวอักษรภาษาอังกฤษ ตัวเลข หรือ _</p>
  </div>
</main>
`)));

app.post("/register",async(q,r)=>{
  console.log("REGISTER REQUEST:", q.body.username);

  const {username,password}=q.body;

  if(!/^[A-Za-z0-9_]{3,24}$/.test(username)||password.length<8){
    return r.status(400).send("ข้อมูลไม่ถูกต้อง");
  }

  const {data:existing,error:checkError}=await supabase
    .from("users")
    .select("id")
    .eq("username",username)
    .maybeSingle();

  if(checkError){
    console.error("REGISTER CHECK ERROR:",checkError);
    return r.status(500).send("ตรวจสอบผู้ใช้ไม่สำเร็จ: "+checkError.message);
  }

  if(existing){
    return r.status(409).send(page("Register","\n<style>\n.auth-page{\n  min-height:75vh;\n  display:flex;\n  align-items:center;\n  justify-content:center;\n  padding:30px 15px;\n}\n.auth-card{\n  width:100%;\n  max-width:390px;\n  background:#080f1e;\n  color:#fff;\n  border-radius:24px;\n  padding:30px 24px;\n  box-shadow:0 15px 40px rgba(0,0,0,.25);\n  box-sizing:border-box;\n}\n.auth-logo{\n  text-align:center;\n  margin-bottom:22px;\n}\n.auth-logo .icon{\n  font-size:48px;\n}\n.auth-logo h1{\n  margin:5px 0 0;\n  font-size:30px;\n}\n.auth-logo p{\n  margin:5px 0 0;\n  color:#777;\n}\n.auth-card h2{\n  text-align:center;\n  margin:0 0 22px;\n}\n.auth-card form{\n  display:flex;\n  flex-direction:column;\n  gap:12px;\n}\n.auth-card input{\n  width:100%;\n  box-sizing:border-box;\n  padding:14px 15px;\n  border:1px solid #ddd;\n  border-radius:12px;\n  font-size:16px;\n  outline:none;\n}\n.auth-card input:focus{\n  border-color:#667eea;\n}\n.auth-card button{\n  border:0;\n  border-radius:12px;\n  padding:14px;\n  background:#222;\n  color:#fff;\n  font-size:16px;\n  font-weight:bold;\n  cursor:pointer;\n}\n.auth-link{\n  text-align:center;\n  margin:20px 0 0;\n  color:#666;\n}\n.auth-link a{\n  font-weight:bold;\n  color:#536dfe;\n  text-decoration:none;\n}\n.hint{\n  text-align:center;\n  color:#888;\n  font-size:13px;\n  margin-top:12px;\n}\n</style>\n\n<main class=\"auth-page\">\n  <div class=\"auth-card\">\n    <div class=\"auth-logo\">\n      <div class=\"v-logo\">V</div>\n      <h1>VOIDARK</h1>\n      <p>JOIN VOIDARK</p>\n    </div>\n\n    \n<div style=\"background:#3b1118;color:#ffb4bd;padding:12px 16px;border-radius:12px;text-align:center;margin:0 0 18px;font-weight:bold;line-height:1.5\">\n  ⚠️ ชื่อผู้ใช้นี้มีคนใช้แล้ว<br>\n  <small style=\"font-weight:normal\">ลองใช้ชื่ออื่นดูนะ</small>\n</div>\n    <h2>📝 สร้างบัญชี</h2>\n\n    <form method=\"post\">\n      <input name=\"username\" placeholder=\"ชื่อผู้ใช้ 3-24 ตัว\" required>\n      <input name=\"password\" type=\"password\" placeholder=\"รหัสผ่านอย่างน้อย 8 ตัว\" required>\n      <button type=\"submit\">สมัครสมาชิก</button>\n    </form>\n\n    <p class=\"auth-link\">\n      มีบัญชีอยู่แล้ว?\n      <a href=\"/login\">เข้าสู่ระบบ</a>\n    </p>\n\n    <p class=\"hint\">ใช้ตัวอักษรภาษาอังกฤษ ตัวเลข หรือ _</p>\n  </div>\n</main>\n"));
  }

  const hashedPassword=await bcrypt.hash(password,8);

  const {data:u,error}=await supabase
    .from("users")
    .insert({
      username,
      password:hashedPassword,
      role:"member",
      score:0
    })
    .select("id,username,role,score")
    .single();

  if(error){
    console.error("REGISTER INSERT ERROR:",error);
    if(error.code==="23505"){
      return r.status(409).send(page("Register",`<main class="box"><h1>ชื่อผู้ใช้นี้มีคนใช้แล้ว</h1><p>ลองใช้ชื่ออื่นดูนะ</p><a href="/register">กลับไปสมัครสมาชิก</a></main>`));
    }
    return r.status(500).send("สมัครสมาชิกไม่สำเร็จ");
  }

  console.log("REGISTER SUCCESS:",u.username);

  q.session.userId=u.id;
  q.session.role=u.role;

  r.redirect("/member");
});

app.get("/logout",(q,r)=>{
  q.session.destroy(()=>{
    r.redirect("/login");
  });
});

app.get("/member",auth,(q,r)=>{
  const user=q.session.user;

  r.send(page("VOIDARK Store",`
<style>
.store{
  max-width:560px;
  margin:0 auto;
  padding:16px 14px 30px;
}

.store-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:18px;
}

.brand{
  display:flex;
  align-items:center;
  gap:10px;
}

.brand-logo{
  width:42px;
  height:42px;
  border-radius:13px;
  background:linear-gradient(135deg,#2563eb,#0f172a);
  color:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:23px;
  font-weight:900;
  box-shadow:0 8px 20px rgba(37,99,235,.25);
}

.brand-name{
  font-size:21px;
  font-weight:900;
  letter-spacing:1px;
}

.account{
  text-decoration:none;
  color:#222;
  width:40px;
  height:40px;
  border-radius:50%;
  background:#f1f1f1;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:19px;
}

.hero{
  position:relative;
  overflow:hidden;
  border-radius:25px;
  padding:26px 22px;
  background:linear-gradient(135deg,#07101f,#132a55);
  color:#fff;
  margin-bottom:22px;
  box-shadow:0 14px 35px rgba(0,0,0,.18);
}

.hero:after{
  content:"";
  position:absolute;
  width:180px;
  height:180px;
  right:-65px;
  top:-65px;
  border-radius:50%;
  background:#2563eb;
  opacity:.2;
}

.hero-label{
  color:#60a5fa;
  font-size:12px;
  font-weight:bold;
  letter-spacing:1.5px;
}

.hero h1{
  position:relative;
  z-index:1;
  margin:8px 0;
  font-size:28px;
}

.hero p{
  position:relative;
  z-index:1;
  margin:0;
  color:#cbd5e1;
}

.hero-user{
  margin-top:17px;
  position:relative;
  z-index:1;
  color:#fff;
  font-weight:bold;
}

.section-title{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin:22px 2px 12px;
}

.section-title h2{
  margin:0;
  font-size:19px;
}

.section-title span{
  color:#777;
  font-size:13px;
}

.games{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:12px;
}

.game{
  text-decoration:none;
  color:#222;
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:20px;
  padding:18px 14px;
  min-height:125px;
  box-sizing:border-box;
  box-shadow:0 5px 15px rgba(0,0,0,.05);
}

.game:hover{
  transform:translateY(-2px);
}

.game-icon{
  font-size:35px;
}

.game h3{
  margin:9px 0 4px;
  font-size:16px;
}

.game p{
  margin:0;
  color:#888;
  font-size:12px;
}

.topup-box{
  background:#f5f7fb;
  border:1px solid #e5e7eb;
  border-radius:22px;
  padding:16px;
}

.topup-options{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:9px;
}

.topup{
  border:1px solid #ddd;
  background:#fff;
  border-radius:14px;
  padding:13px 5px;
  text-align:center;
  font-weight:bold;
  font-size:12px;
}

.topup-icon{
  font-size:22px;
  margin-bottom:5px;
}

.products{
  display:grid;
  gap:10px;
}

.product{
  display:flex;
  align-items:center;
  justify-content:space-between;
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:18px;
  padding:14px;
}

.product-left{
  display:flex;
  align-items:center;
  gap:12px;
}

.product-icon{
  width:44px;
  height:44px;
  border-radius:13px;
  background:#eef4ff;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:22px;
}

.product h3{
  margin:0 0 4px;
  font-size:15px;
}

.product p{
  margin:0;
  color:#888;
  font-size:12px;
}

.product-price{
  font-weight:900;
  color:#2563eb;
}

.bottom-nav{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:7px;
  margin-top:25px;
  background:#f5f5f5;
  border-radius:19px;
  padding:8px;
}

.bottom-nav a{
  text-decoration:none;
  text-align:center;
  color:#333;
  padding:10px 3px;
  border-radius:12px;
  font-size:12px;
  font-weight:bold;
}

.bottom-nav a:first-child{
  background:#fff;
  box-shadow:0 2px 8px rgba(0,0,0,.07);
}

.logout{
  display:block;
  text-align:center;
  margin-top:17px;
  color:#888;
  text-decoration:none;
  font-size:13px;
}

@media(max-width:380px){
  .topup-options{
    grid-template-columns:1fr;
  }
}
</style>

<main class="store">

  <header class="store-header">
    <div class="brand">
      <div class="brand-logo">V</div>
      <div class="brand-name">VOIDARK</div>
    </div>

    <a class="account" href="/profile">👤</a>
  </header>

  <section class="hero">
    <div class="hero-label">VOIDARK GAMING STORE</div>
    <h1>เติมเกมง่าย ๆ ในที่เดียว</h1>
    <p>เลือกเกม • เลือกบริการ • พร้อมเล่น</p>
    <div class="hero-user">สวัสดี ${user.username} 👋</div>
  </section>

  <div class="section-title">
    <h2>🔥 เกมยอดนิยม</h2>
    <span>ดูทั้งหมด →</span>
  </div>

  <section class="games">

    <a class="game" href="/topup/freefire">
      <div class="game-icon">🔥</div>
      <h3>Free Fire</h3>
      <p>เติมเพชร</p>
    </a>

    <a class="game" href="/topup/valorant">
      <div class="game-icon">⚡</div>
      <h3>VALORANT</h3>
      <p>เติม VP</p>
    </a>

    <a class="game" href="/topup/roblox">
      <div class="game-icon">🧱</div>
      <h3>Roblox</h3>
      <p>เติม Robux</p>
    </a>

    <a class="game" href="/topup/rov">
      <div class="game-icon">🏆</div>
      <h3>ROV</h3>
      <p>เติมคูปอง</p>
    </a>

  </section>

  <div class="section-title">
    <h2>💎 เติมเกม</h2>
    <span>เลือกบริการ</span>
  </div>

  <section class="topup-box">
    <div class="topup-options">

      <div class="topup">
        <div class="topup-icon">🆔</div>
        UID
      </div>

      <div class="topup">
        <div class="topup-icon">🔐</div>
        ID-PASS
      </div>

      <div class="topup">
        <div class="topup-icon">🔑</div>
        GAME CODE
      </div>

    </div>
  </section>

  <div class="section-title">
    <h2>🛍️ สินค้าแนะนำ</h2>
    <span>เร็ว ๆ นี้</span>
  </div>

  <section class="products">

    <div class="product">
      <div class="product-left">
        <div class="product-icon">💎</div>
        <div>
          <h3>Game Top Up</h3>
          <p>เติมเกมราคาพิเศษ</p>
        </div>
      </div>
      <div class="product-price">เร็ว ๆ นี้</div>
    </div>

    <div class="product">
      <div class="product-left">
        <div class="product-icon">🔑</div>
        <div>
          <h3>Game Code</h3>
          <p>รหัสเกมและไอเทมดิจิทัล</p>
        </div>
      </div>
      <div class="product-price">เร็ว ๆ นี้</div>
    </div>

  </section>

  <nav class="bottom-nav">
    <a href="/member">🏠<br>หน้าหลัก</a>
    <a href="/orders">📦<br>ออเดอร์</a>
    <a href="/profile">👤<br>บัญชี</a>
  </nav>

  <a class="logout" href="/logout">🚪 ออกจากระบบ</a>

</main>
`));
});

app.post("/order/create",auth,(q,r)=>{
  const {productId,playerId}=q.body;

  if(!productId||!playerId){
    return r.status(400).send("ข้อมูลไม่ครบ");
  }

  const product=products.find(p=>p.id===productId&&p.status==="active");

  if(!product){
    return r.status(404).send("ไม่พบสินค้า");
  }

  const order={
    id:"VDK"+Date.now(),
    username:q.session.user.username,
    productId:product.id,
    productName:product.name,
    game:product.game,
    playerId:playerId,
    price:product.price,
    status:"pending",
    createdAt:new Date().toISOString()
  };

  orders.push(order);
  require("fs").writeFileSync("orders.json",JSON.stringify(orders,null,2));

  r.json({
    success:true,
    orderId:order.id,
    status:order.status
  });
});
app.get("/topup/freefire",auth,(q,r)=>{
  const user=q.session.user;
const freefireProducts=products.filter(p=>p.game==="Free Fire"&&p.status==="active");
  r.send(page("Free Fire Top Up",`
<style>
.topup-page{
  max-width:560px;
  margin:0 auto;
  padding:16px 14px 30px;
}

.topup-header{
  display:flex;
  align-items:center;
  gap:12px;
  margin-bottom:20px;
}

.back{
  width:40px;
  height:40px;
  border-radius:12px;
  background:#f1f1f1;
  display:flex;
  align-items:center;
  justify-content:center;
  text-decoration:none;
  color:#222;
}

.game-banner{
  background:linear-gradient(135deg,#351000,#ff7a00);
  color:#fff;
  border-radius:24px;
  padding:24px;
  margin-bottom:20px;
  box-shadow:0 12px 30px rgba(0,0,0,.15);
}

.game-banner .icon{
  font-size:48px;
}

.game-banner h1{
  margin:8px 0 5px;
}

.game-banner p{
  margin:0;
  color:#ffe7cc;
}

.form-card{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:20px;
  padding:18px;
}

.form-card h2{
  margin:0 0 15px;
  font-size:19px;
}

.uid-input{
  width:100%;
  box-sizing:border-box;
  padding:14px;
  border:1px solid #ddd;
  border-radius:12px;
  font-size:16px;
  outline:none;
}

.uid-input:focus{
  border-color:#ff7a00;
}

.packages{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:10px;
  margin-top:15px;
}

.package{
  border:1px solid #ddd;
  background:#fff;
  border-radius:17px;
  padding:16px 10px;
  text-align:center;
  cursor:pointer;
}

.package:hover{
  border-color:#ff7a00;
  transform:translateY(-2px);
}

.diamond{
  font-size:28px;
}

.package h3{
  margin:7px 0 3px;
}

.package p{
  margin:0;
  color:#888;
  font-size:13px;
}

.price{
  margin-top:9px;
  color:#ff7a00;
  font-weight:900;
}

.notice{
  margin-top:15px;
  padding:13px;
  border-radius:13px;
  background:#fff7ed;
  color:#9a4b00;
  font-size:13px;
}

.back-home{
  display:block;
  text-align:center;
  margin-top:18px;
  color:#666;
  text-decoration:none;
}

@media(max-width:380px){
  .packages{
    grid-template-columns:1fr;
  }
}
</style>

<main class="topup-page">

  <header class="topup-header">
    <a class="back" href="/member">←</a>
    <div>
      <strong>VOIDARK</strong>
      <div style="font-size:12px;color:#777">Game Top Up</div>
    </div>
  </header>

  <section class="game-banner">
    <div class="icon">🔥</div>
    <h1>Free Fire</h1>
    <p>เติมเพชร Free Fire</p>
  </section>

  <section class="form-card">

    <h2>🆔 ใส่ Player ID</h2>

    <input
      class="uid-input"
      type="text"
      id="playerId"
      placeholder="กรอก Player ID ของคุณ"
    >

    <h2 style="margin-top:22px">💎 เลือกจำนวนเพชร</h2>

    <div class="packages">

      <button class="package" type="button"
      onclick="selectPack('ff100')">
        <div class="diamond">💎</div>
        <h3>100 Diamonds</h3>
        <p>เพชร Free Fire</p>
        <div class="price">฿35</div>
      </button>

      <button class="package" type="button"
      onclick="selectPack('ff310')">
        <div class="diamond">💎</div>
        <h3>310 Diamonds</h3>
        <p>เพชร Free Fire</p>
        <div class="price">฿99</div>
      </button>

      <button class="package" type="button"
      onclick="selectPack('ff520')">
        <div class="diamond">💎</div>
        <h3>520 Diamonds</h3>
        <p>เพชร Free Fire</p>
        <div class="price">฿159</div>
      </button>

      <button class="package" type="button"
      onclick="selectPack('ff1060')">
        <div class="diamond">💎</div>
        <h3>1060 Diamonds</h3>
        <p>เพชร Free Fire</p>
        <div class="price">฿299</div>
      </button>

    </div>

    <div class="notice">
      ⚠️ ตอนนี้เป็นโหมดทดลอง ระบบยังไม่หักเงินจริง
    </div>

  </section>

  <a class="back-home" href="/member">← กลับหน้าหลัก VOIDARK</a>

</main>

<script>
async function selectPack(productId){
  const playerId=document.getElementById("playerId").value.trim();

  if(!playerId){
    alert("กรุณากรอก Player ID ก่อน");
    return;
  }

  const response=await fetch("/order/create",{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      productId:productId,
      playerId:playerId
    })
  });

  const data=await response.json();

  if(!data.success){
    alert("สร้างออเดอร์ไม่สำเร็จ");
    return;
  }

  alert("สร้างออเดอร์สำเร็จ!\\nOrder: "+data.orderId);
}
</script>
`));
});

app.get("/game/target",auth,(q,r)=>{
  r.send(page("เกมกดเป้า",`
<style>
.target-game{
  text-align:center;
  padding:20px;
}
.target-game h1{
  margin-bottom:8px;
}
.target-score{
  font-size:22px;
  font-weight:bold;
  margin:15px 0;
}
.target-area{
  position:relative;
  width:100%;
  max-width:420px;
  height:420px;
  margin:20px auto;
  background:#080f1e;
  border-radius:24px;
  overflow:hidden;
  border:2px solid #1d4ed8;
}
.target{
  position:absolute;
  left:50%;
  top:50%;
  transform:translate(-50%,-50%);
  width:64px;
  height:64px;
  border-radius:50%;
  border:3px solid #fff;
  background:#2563eb;
  color:#fff;
  font-size:28px;
  cursor:pointer;
  z-index:10;
  box-shadow:0 0 25px rgba(37,99,235,.8);
}
.target:hover{
  transform:scale(1.08);
}
.finish{
  border:0;
  border-radius:12px;
  padding:13px 22px;
  background:#2563eb;
  color:#fff;
  font-size:16px;
  font-weight:bold;
  cursor:pointer;
}
.back{
  display:inline-block;
  margin-top:12px;
  text-decoration:none;
  font-weight:bold;
}
</style>

<main class="box target-game">
  <h1>🎯 เกมกดเป้า</h1>
  <p>กดเป้าให้ไวที่สุด!</p>

  <div class="target-score">
    คะแนนรอบนี้: <span id="score">0</span>
  </div>

  <div class="target-area" id="area">
    <button type="button" class="target" id="target">🎯</button>
  </div>

  <button type="button" class="finish" id="finish">🏆 จบเกมและบันทึกคะแนน</button>

  <br>
  <a class="back" href="/member">← กลับหน้าเกม</a>
</main>

<script>
const target=document.getElementById("target");
const area=document.getElementById("area");
const scoreEl=document.getElementById("score");
const finish=document.getElementById("finish");

let score=0;
let finished=false;

function moveTarget(){
  const maxX=area.clientWidth-target.offsetWidth;
  const maxY=area.clientHeight-target.offsetHeight;

  target.style.left=Math.floor(Math.random()*maxX)+"px";
  target.style.top=Math.floor(Math.random()*maxY)+"px";
}

target.addEventListener("click",()=>{
  if(finished)return;
  score++;
  scoreEl.textContent=score;
  moveTarget();
});

finish.addEventListener("click",async()=>{
  if(finished)return;

  finished=true;
  finish.disabled=true;
  finish.textContent="กำลังบันทึก...";

  try{
    const response=await fetch("/game/target/score",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({score})
    });

    if(!response.ok){
      throw new Error("save failed");
    }

    location.href="/member";
  }catch(error){
    finished=false;
    finish.disabled=false;
    finish.textContent="🏆 จบเกมและบันทึกคะแนน";
    alert("บันทึกคะแนนไม่สำเร็จ ลองอีกครั้งนะ");
  }
});

moveTarget();
</script>
`));
});

app.post("/game/target/score",auth,async(q,r)=>{
  const score=Number(q.body.score);

  if(!Number.isInteger(score)||score<0||score>1000){
    return r.status(400).json({ok:false,message:"คะแนนไม่ถูกต้อง"});
  }

  const newScore=(q.session.user.score||0)+score;

  const {data:user,error}=await supabase
    .from("users")
    .update({score:newScore})
    .eq("id",q.session.userId)
    .select("id,username,role,score")
    .single();

  if(error){
    console.error("TARGET SCORE UPDATE ERROR:",error);
    return r.status(500).json({ok:false,message:"บันทึกคะแนนไม่สำเร็จ"});
  }

  q.session.user=user;

  console.log("TARGET SCORE SAVED:",user.username,"+",score,"=>",user.score);

  r.json({ok:true,score:user.score});
});

app.listen(PORT,"0.0.0.0",()=>console.log("VOIDARK READY on port "+PORT));
