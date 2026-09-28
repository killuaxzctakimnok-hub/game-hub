
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

app.get("/",(q,r)=>r.redirect(q.session.userId?"/member":"/login"));

app.get("/login",(q,r)=>r.send(page("Login",`
<style>
.auth-page{
  min-height:75vh;
  background:#050914;
  border-radius:20px;
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
</style>

<main class="auth-page">
  <div class="auth-card">
    <div class="auth-logo">
      <div class="v-logo">V</div>
      <h1>VOIDARK</h1>
      <p>PLAY • SCORE • RANK</p>
    </div>

    <h2>🔐 เข้าสู่ระบบ</h2>

    <form method="post">
      <input name="username" placeholder="ชื่อผู้ใช้" required>
      <input name="password" type="password" placeholder="รหัสผ่าน" required>
      <button type="submit">เข้าสู่ระบบ</button>
    </form>

    <p class="auth-link">
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

  r.send(page("Game Hub",`
<main class="box">
  <h1>🎮 VOIDARK</h1>
  <h2>สวัสดี ${user.username} 👋</h2>
  <p class="score">🏆 คะแนน: ${user.score||0}</p>

  <div class="games">
    <a class="game-card" href="/game/target">
      <div class="game-icon">🎯</div>
      <h2>เกมกดเป้า</h2>
      <p>กดเป้าให้ไว เก็บคะแนนให้ได้มากที่สุด</p>
      <span>เล่นเกม →</span>
    </a>

    <a class="game-card" href="/game/reaction">
      <div class="game-icon">⚡</div>
      <h2>เกมกดให้ไว</h2>
      <p>ทดสอบความเร็วในการตอบสนอง</p>
      <span>เล่นเกม →</span>
    </a>

    <a class="game-card" href="/game/third">
      <div class="game-icon">🏆</div>
      <h2>เกมที่ 3</h2>
      <p>เกมใหม่สำหรับสะสมคะแนน</p>
      <span>เล่นเกม →</span>
    </a>
  </div>

  <div class="menu">
    <a href="/leaderboard">🏆 อันดับ</a>
    <a href="/stats">📊 สถิติ</a>
    <a href="/logout">🚪 ออกจากระบบ</a>
  </div>
</main>

<style>
.games{
  display:grid;
  gap:14px;
  margin:20px 0;
}
.game-card{
  display:block;
  padding:18px;
  border-radius:18px;
  background:#f5f5f5;
  color:#222;
  text-decoration:none;
  border:1px solid #ddd;
  transition:.2s;
}
.game-card:hover{
  transform:translateY(-2px);
}
.game-icon{
  font-size:42px;
}
.game-card h2{
  margin:8px 0 5px;
}
.game-card p{
  margin:0 0 10px;
  color:#666;
}
.game-card span{
  font-weight:bold;
}
.menu{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  justify-content:center;
}
.menu a{
  text-decoration:none;
}
</style>
`));
});

app.listen(PORT,"0.0.0.0",()=>console.log("VOIDARK READY on port "+PORT));
