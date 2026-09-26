const express=require("express"),session=require("express-session"),bcrypt=require("bcryptjs"),fs=require("fs");

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

const auth=(q,r,n)=>q.session.userId?n():r.redirect("/login");

app.get("/",(q,r)=>r.redirect(q.session.userId?"/member":"/login"));

app.get("/login",(q,r)=>r.send(page("Login",`
<main class="box">
<h1>🔐 เข้าสู่ระบบ</h1>
<form method="post">
<input name="username" placeholder="ชื่อผู้ใช้" required>
<input name="password" type="password" placeholder="รหัสผ่าน" required>
<button>เข้าสู่ระบบ</button>
</form>
<p>ยังไม่มีบัญชี? <a href="/register">สมัครสมาชิก</a></p>
</main>`)));

app.post("/login",async(q,r)=>{
  let d=read(),u=d.users.find(x=>x.username===q.body.username);
  if(!u||!(await bcrypt.compare(q.body.password,u.password)))
    return r.status(401).send(page("Login",'<main class="box"><h1>เข้าสู่ระบบไม่สำเร็จ</h1><a href="/login">ลองอีกครั้ง</a></main>'));
  q.session.userId=u.id;
  q.session.role=u.role;
  r.redirect("/member");
});

app.get("/register",(q,r)=>r.send(page("Register",`
<main class="box">
<h1>📝 สมัครสมาชิก</h1>
<form method="post">
<input name="username" placeholder="ชื่อผู้ใช้ 3-24 ตัว" required>
<input name="password" type="password" placeholder="รหัสผ่านอย่างน้อย 8 ตัว" required>
<button>สมัครสมาชิก</button>
</form>
<p><a href="/login">กลับเข้าสู่ระบบ</a></p>
</main>`)));

app.post("/register",async(q,r)=>{
  let {username,password}=q.body,d=read();
  if(!/^[A-Za-z0-9_]{3,24}$/.test(username)||password.length<8)
    return r.status(400).send("ข้อมูลไม่ถูกต้อง");
  if(d.users.some(x=>x.username===username))
    return r.status(409).send("ชื่อผู้ใช้นี้มีแล้ว");
  let u={
    id:Date.now().toString(),
    username,
    password:await bcrypt.hash(password,8),
    role:"member",
    score:0
  };
  d.users.push(u);
  write(d);
  q.session.userId=u.id;
  q.session.role=u.role;
  r.redirect("/member");
});

app.get("/member",auth,(q,r)=>{
  let u=read().users.find(x=>x.id===q.session.userId);
  r.send(page("Member",`
<main class="box">
<h1>สวัสดี ${u.username} 👋</h1>
<div class="card">🏆 คะแนน: ${u.score||0}</div>
<a class="btn" href="/game">🎮 เกม</a>
<a class="btn" href="/leaderboard">🏆 อันดับ</a>
<form method="post" action="/logout"><button class="danger">ออกจากระบบ</button></form>
</main>`));
});

app.post("/logout",(q,r)=>q.session.destroy(()=>r.redirect("/login")));

app.get("/game",auth,(q,r)=>r.send(page("Game",`
<main class="box">
<h1>🎯 กดเป้าให้ไว!</h1>
<p>มีเวลา <b>20 วินาที</b> กดเป้าให้ได้มากที่สุด</p>
<div class="timer">เวลา: <span id="time">20</span></div>
<div class="score">คะแนนรอบนี้: <span id="score">0</span></div>
<button id="start">เริ่มเกม</button>
<div class="game-area" id="area">
<button class="target" id="target">●</button>
</div>
<p id="result"></p>
<a class="btn" href="/member">กลับหน้าสมาชิก</a>

<script>
const start=document.getElementById("start");
const target=document.getElementById("target");
const area=document.getElementById("area");
const timeEl=document.getElementById("time");
const scoreEl=document.getElementById("score");
const result=document.getElementById("result");

let score=0,time=20,running=false,timer;

function moveTarget(){
  const maxX=area.clientWidth-55;
  const maxY=area.clientHeight-55;
  target.style.left=Math.floor(Math.random()*Math.max(maxX,1))+"px";
  target.style.top=Math.floor(Math.random()*Math.max(maxY,1))+"px";
}

target.onclick=()=>{
  if(!running)return;
  score++;
  scoreEl.textContent=score;
  moveTarget();
};

start.onclick=async()=>{
  if(running)return;
  running=true;
  score=0;
  time=20;
  scoreEl.textContent=0;
  timeEl.textContent=20;
  result.textContent="";
  start.disabled=true;
  target.style.display="block";
  moveTarget();

  timer=setInterval(async()=>{
    time--;
    timeEl.textContent=time;
    if(time<=0){
      clearInterval(timer);
      running=false;
      target.style.display="none";
      start.disabled=false;
      result.textContent="กำลังบันทึกคะแนน...";

      const res=await fetch("/api/score",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({score})
      });

      const data=await res.json();
      result.textContent=data.ok
        ? "🎉 จบเกม! ได้ "+score+" คะแนน"
        : "บันทึกคะแนนไม่สำเร็จ";
    }
  },1000);
};
</script>
</main>`)));

app.post("/api/score",auth,(q,r)=>{
  const score=Math.max(0,Math.min(1000,Number(q.body.score)||0));
  let d=read();
  let u=d.users.find(x=>x.id===q.session.userId);
  if(!u)return r.status(404).json({ok:false});

  u.score=(u.score||0)+score;
  d.scores.push({
    userId:u.id,
    username:u.username,
    score,
    at:new Date().toISOString()
  });
  write(d);
  r.json({ok:true,total:u.score});
});

app.get("/leaderboard",auth,(q,r)=>{
  let u=read().users
    .sort((a,b)=>(b.score||0)-(a.score||0));

  r.send(page("Leaderboard",`
<main class="box">
<h1>🏆 อันดับ</h1>
${u.slice(0,20).map((x,i)=>
`<div class="card">#${i+1} ${x.username} — ${x.score||0} คะแนน</div>`
).join("")}
<a class="btn" href="/member">กลับ</a>
</main>`));
});

app.listen(PORT,"0.0.0.0",()=>console.log("GAME HUB READY on port "+PORT));
