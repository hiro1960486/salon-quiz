import bank from "../questions.json";
const allowedGenres = new Set(["all","暮らし","音楽","テレビ・芸能","出来事・スポーツ","学校・おやつ","東海"]);
const allowedCounts = new Set([10,20,30]);
const enc = new TextEncoder();
const allowedOrigin = "https://hiro1960486.github.io";
const cors = {"Access-Control-Allow-Origin":allowedOrigin,"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const randomToken =()=>crypto.randomUUID();
function shuffled(items){
 const a=[...items]; const random=new Uint32Array(a.length);
 crypto.getRandomValues(random);
 for(let i=a.length-1;i>0;i--){const j=random[i]%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;
}
function valid(genre,count){return allowedGenres.has(genre)&&allowedCounts.has(count);}
async function body(request){
 const limit=Number(request.headers.get("content-length")||0);
 if(limit>10000)throw new Error("送信サイズが大きすぎます");
 const text=await request.text();
 if(text.length>10000)throw new Error("送信サイズが大きすぎます");
 return JSON.parse(text);
}
async function start(request,env){
 const data=await body(request);
 const genre=String(data.genre||"all"), count=Number(data.count);
 if(!valid(genre,count))return json({error:"ジャンルまたは問題数が不正です"},400);
 const pool=bank.filter(q=>genre==="all"||(genre==="東海"?q.region==="東海":q.genre===genre));
 if(pool.length<count)return json({error:"問題が不足しています"},409);
 const selected=shuffled(pool).slice(0,count);
 const positionCounts=shuffled(Array.from({length:count},(_,i)=>i%3));
 const answerKeys=[];
 const payload=selected.map((q,i)=>{
   const correct=q.choices[q.correct], other=shuffled(q.choices.filter((_,j)=>j!==q.correct));
   const choices=[...other];choices.splice(positionCounts[i],0,correct);answerKeys.push(positionCounts[i]);
   return {id:q.id,genre:q.genre,question:q.question,choices};
 });
 const id=randomToken(),now=Date.now();
 await env.DB.prepare("INSERT INTO sessions(id,genre,question_count,question_ids,answer_keys,started_at,expires_at) VALUES(?,?,?,?,?,?,?)")
 .bind(id,genre,count,JSON.stringify(selected.map(q=>q.id)),JSON.stringify(answerKeys),now,now+30*60*1000).run();
 return json({sessionId:id,genre,count,questions:payload});
}
async function finish(request,env){
 const data=await body(request),id=String(data.sessionId||"");
 if(!/^[a-f0-9-]{36}$/.test(id)||!Array.isArray(data.answers))return json({error:"結果が不正です"},400);
 const session=await env.DB.prepare("SELECT * FROM sessions WHERE id=?").bind(id).first();
 if(!session||session.used||session.expires_at<Date.now())return json({error:"セッションが終了しています"},409);
 const expected=JSON.parse(session.answer_keys);
 if(data.answers.length!==session.question_count||data.answers.some(x=>!Number.isInteger(x)||x<0||x>2))
 return json({error:"回答数が一致しません"},400);
 const duration=Date.now()-session.started_at;
 if(duration<1500||duration>30*60*1000)return json({error:"計測時間が正しくありません"},400);
 const correct=data.answers.filter((answer,i)=>answer===expected[i]).length;
 const scoreId=randomToken();
 // Database batch transaction. Conditional update ensures one score per session.
 const outcome=await env.DB.batch([
  env.DB.prepare("UPDATE sessions SET used=1 WHERE id=? AND used=0").bind(id),
  env.DB.prepare("INSERT INTO scores(id,genre,question_count,correct,duration_ms,created_at) VALUES(?,?,?,?,?,?)")
    .bind(scoreId,session.genre,session.question_count,correct,duration,Date.now())
 ]);
 if(outcome[0].meta.changes!==1)return json({error:"送信済みの結果です"},409);
 const top=await leaderboard(env,session.genre,session.question_count);
 const placed=top.findIndex(row=>row.id===scoreId);
 return json({correct,count:session.question_count,durationMs:duration,rank:placed>=0?placed+1:null,top:top.map(p=>({correct:p.correct,durationMs:p.duration_ms}))});
}
async function leaderboard(env,genre,count){
 const result=await env.DB.prepare("SELECT id,correct,duration_ms FROM scores WHERE genre=? AND question_count=? ORDER BY correct DESC,duration_ms ASC,created_at ASC LIMIT 3").bind(genre,count).all();
 return result.results||[];
}
export default {
 async fetch(request,env){
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  try{
   if(!env.DB)return json({error:"データベースの設定がありません"},503);
   const url=new URL(request.url);
   if(request.method==="GET"&&url.pathname==="/health")return json({ok:true,questions:bank.length});
   if(request.method==="GET"&&url.pathname==="/ranking"){
    const genre=url.searchParams.get("genre")||"all",count=Number(url.searchParams.get("count")||10);
    if(!valid(genre,count))return json({error:"ジャンルまたは問題数が不正です"},400);
    const top=await leaderboard(env,genre,count);
    return json({genre,count,top:top.map(p=>({correct:p.correct,durationMs:p.duration_ms}))});
   }
   if(request.method==="POST"&&url.pathname==="/start")return await start(request,env);
   if(request.method==="POST"&&url.pathname==="/finish")return await finish(request,env);
   return json({error:"見つかりません"},404);
  }catch(err){console.error(err);return json({error:"通信またはサーバー処理でエラーが発生しました"},500);}
 }
};