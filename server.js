
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
console.log("LOGIN REQUEST:",
q.body.username);
  const {username,password}=q.body;

  const {data:u,error}=await supabase
    .from("users")
    .select("id,username,password,role,score")
    .eq("username",username)
    .maybeSingle();

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
  console.log("REGISTER REQUEST RECEIVED", q.body);
  const {username,password}=q.body;

  if(!/^[A-Za-z0-9_]{3,24}$/.test(username)||password.length<8)
    return r.status(400).send("ข้อมูลไม่ถูกต้อง");

  const {data:existing,error:checkError}=await supabase
    .from("users")
    .select("id")
    .eq("username",username)
    .maybeSingle();

  if(checkError){ console.error("CHECK USER ERROR:",checkError); return r.status(500).send("เกิดข้อผิดพลาด: "+checkError.message); }
    return r.status(500).send("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล");

  if(existing)
    return r.status(409).send("ชื่อผู้ใช้นี้มีแล้ว");

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

  if(error){ console.error("REGISTER ERROR:",error); return r.status(500).send("สมัครสมาชิกไม่สำเร็จ: "+error.message); }

  q.session.userId=u.id;
  q.session.role=u.role;
  r.redirect("/member");
});app.get("/member",auth,(q,r)=>{
    let u=q.session.user;
  r.send(page("Member",`
<main class="box">
<h1>สวัสดี ${u.username} 👋</h1>
<div class="card">🏆 คะแนน: ${u.score||0}</div>
<a class="btn" href="/game">🎯 เกมกดเป้า</a><a class="btn" href="/game2">⚡ เกมกดให้ไว</a>
<a class="btn" href="/leaderboard">🏆 อันดับ</a><a class="btn" href="/stats">📊 สถิติ</a>
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

app.get("/game2",auth,(q,r)=>r.send(page("Game 2",`
<main class="box">
<h1>⚡ กดให้ไว!</h1>
<p>รอให้ปุ่มเปลี่ยนเป็นสีเขียว แล้วกดให้เร็วที่สุด</p>
<div id="status" class="card">กดเริ่มเกมเพื่อเริ่ม</div>
<button id="start">เริ่มเกม</button>
<button id="tap" style="display:none;font-size:30px;padding:30px;margin:20px">⚡ กดเลย!</button>
<p id="result"></p>
<a class="btn" href="/member">🏠 หน้าสมาชิก</a>
<script>
const start=document.getElementById("start"),tap=document.getElementById("tap"),status=document.getElementById("status"),result=document.getElementById("result");
let started=false,startTime=0,timer;
start.onclick=()=>{
  if(started)return;
  started=true;
  start.disabled=true;
  tap.style.display="none";
  status.textContent="รอ...";
  const delay=1000+Math.random()*3000;
  timer=setTimeout(()=>{
    startTime=performance.now();
    status.textContent="ตอนนี้!";
    tap.style.display="inline-block";
  },delay);
};
tap.onclick=async()=>{
  if(!started)return;
  const reaction=Math.round(performance.now()-startTime);
  started=false;
  tap.style.display="none";
  start.disabled=false;
  const score=Math.max(1,Math.min(100,Math.round(1000/reaction*100)));
  status.textContent="เวลาตอบสนอง: "+reaction+" ms";
  result.textContent="กำลังบันทึกคะแนน...";
  const res=await fetch("/api/score",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({score})});
  const data=await res.json();
  result.textContent=data.ok?"🎉 ได้ "+score+" คะแนน":"บันทึกคะแนนไม่สำเร็จ";
};
</script>
</main>`)));
app.get("/stats",auth,(q,r)=>{
  let d=read();
  let u=d.users.find(x=>x.id===q.session.userId);
  if(!u)return r.redirect("/login");
  let scores=d.scores.filter(x=>x.userId===u.id);
  let total=u.score||0;
  let plays=scores.length;
  let average=plays?Math.round(scores.reduce((a,x)=>a+(Number(x.score)||0),0)/plays):0;
  let ranking=d.users.slice().sort((a,b)=>(b.score||0)-(a.score||0));
  let rank=ranking.findIndex(x=>x.id===u.id)+1;
  r.send(page("Statistics",`
<main class="box">
<h1>📊 สถิติผู้เล่น</h1>
<div class="card">👤 ${u.username}</div>
<div class="card">🏆 คะแนนรวม: <b>${total}</b></div>
<div class="card">🎮 เล่นทั้งหมด: <b>${plays}</b> ครั้ง</div>
<div class="card">📈 คะแนนเฉลี่ย: <b>${average}</b> คะแนน/ครั้ง</div>
<div class="card">🥇 อันดับปัจจุบัน: <b>#${rank}</b></div>
<a class="btn" href="/game">🎯 เล่นเกม</a>
<a class="btn" href="/game2">⚡ เกมกดให้ไว</a>
<a class="btn" href="/leaderboard">🏆 อันดับ</a><a class="btn" href="/stats">📊 สถิติ</a>
<a class="btn" href="/member">🏠 หน้าสมาชิก</a>
</main>`));
});
app.get("/leaderboard",auth,(q,r)=>{
  let u=read().users.sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,10);
  const medals=["🥇","🥈","🥉"];
  r.send(page("Leaderboard",`
<main class="box">
<h1>🏆 TOP 10</h1>
<p style="text-align:center;opacity:.7">อันดับผู้เล่นคะแนนสูงสุด</p>
${u.map((x,i)=>`<div class="card" style="display:flex;align-items:center;gap:12px;margin:10px 0;padding:15px;border-radius:15px">
<div style="font-size:25px">${medals[i]||"#"+(i+1)}</div>
<div style="flex:1"><b>${x.username}</b><br><small>อันดับ ${i+1}${x.id===q.session.userId?" 👈 คุณ":""}</small></div>
<strong>${x.score||0} 🏆</strong>
</div>`).join("")}
<a class="btn" href="/game">🎮 เล่นเกม</a>
<a class="btn" href="/member">🏠 หน้าสมาชิก</a>
</main>`));
});

app.listen(PORT,"0.0.0.0",()=>console.log("GAME HUB READY on port "+PORT));
