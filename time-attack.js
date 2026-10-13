(()=>{
 const $=id=>document.getElementById(id);
 const endpoint=String(window.SALON_RANKING_API||"").replace(/\/$/,"");
 let session=null,questions=[],answers=[],index=0,starting=0,ticker=null,inFlight=false;
 const fmt=ms=>{const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")+"."+Math.floor(ms%1000/100);};
 function notice(msg){$("notice").textContent=msg;}
 async function api(path,body){
   if(!endpoint)throw Error("ランキングサーバーは準備中です。公開設定が完了するまでお待ちください。");
   const response=await fetch(endpoint+path,{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||"通信に失敗しました");
   return result;
 }
 function ranking(){
   const params=new URLSearchParams({genre:$("genre").value,count:$("count").value});
   const url=new URL("ranking.html",location.href);url.search=params.toString();
   window.open(url.href,"_blank","noopener");
 }
 async function begin(){
  if(inFlight)return;
  inFlight=true;$("start").disabled=true;notice("");
  try {
   const data=await api("/start",{genre:$("genre").value,count:Number($("count").value)});
   session=data.sessionId;questions=data.questions;answers=[];index=0;
   $("config").hidden=true;$("finish").hidden=true;$("play").hidden=false;
   starting=performance.now();ticker=setInterval(()=>$("timer").textContent=fmt(performance.now()-starting),100);
   draw();
  }catch(e){notice(e.message);}finally{inFlight=false;$("start").disabled=false;}
 }
 function draw(){
   const q=questions[index];$("progress").textContent="第"+(index+1)+"問 / 全"+questions.length+"問 ・ "+q.genre;
   $("question").textContent=q.question;
   $("answers").replaceChildren();
   q.choices.forEach((choice,i)=>{const b=document.createElement("button");b.type="button";b.textContent=(i+1)+". "+choice;b.addEventListener("click",()=>answer(i));$("answers").append(b);});
 }
 async function answer(value){
   if(inFlight)return;
   answers.push(value);index++;
   if(index<questions.length){draw();return;}
   inFlight=true;clearInterval(ticker);$("play").hidden=true;$("finish").hidden=false;
   $("result").textContent="集計中…";$("placing").textContent="";
   try{
     const data=await api("/finish",{sessionId:session,answers});
     $("result").textContent=data.correct+" / "+data.count+"問正解！ 所要時間 "+fmt(data.durationMs);
     $("placing").textContent=data.rank?"🎉 あなたは現在 第"+data.rank+"位！ TOP3入りです！":"チャレンジありがとう！また上位3位を目指してみてください。";
   }catch(e){$("result").textContent="記録の保存に失敗しました";notice(e.message);}
   finally{inFlight=false;}
 }
 $("start").addEventListener("click",begin);
 $("view-ranking").addEventListener("click",ranking);
 $("finish-ranking").addEventListener("click",ranking);
 $("again").addEventListener("click",()=>{$("finish").hidden=true;$("config").hidden=false;notice("");});
 if(!endpoint)notice("ランキングサーバーの接続設定はまだ完了していません。");
})();