(()=>{
 const $=id=>document.getElementById(id);
 const endpoint=String(window.SALON_RANKING_API||"").replace(/\/$/,"");
 let session=null,questions=[],answers=[],index=0,starting=0,ticker=null,inFlight=false;
 let sound=true,audio=null;
 function chime(hit){
   if(!sound)return;
   try{
     const Ctx=window.AudioContext||window.webkitAudioContext;
     if(!Ctx)return;
     audio=audio||new Ctx();
     if(audio.state==="suspended")audio.resume();
     const play=(freq,delay,duration)=>{
       const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime+delay;
       osc.type="sine";osc.frequency.value=freq;
       gain.gain.setValueAtTime(0.0001,t);
       gain.gain.exponentialRampToValueAtTime(0.09,t+0.015);
       gain.gain.exponentialRampToValueAtTime(0.0001,t+duration);
       osc.connect(gain).connect(audio.destination);
       osc.start(t);osc.stop(t+duration+0.02);
     };
     if(hit){play(660,0,0.14);play(880,0.15,0.2);}
     else play(330,0,0.22);
   }catch(_){}
 }
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
   session=data.sessionId;questions=data.questions;answers=[];index=0;$("feedback").hidden=true;$("reviews").replaceChildren();
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
   inFlight=true;
   $("answers").querySelectorAll("button").forEach(b=>{b.disabled=true;});
   try{
     const judged=await api("/answer",{sessionId:session,index,choice:value});
     answers.push(value);
     chime(judged.correct);
     $("feedback").textContent=judged.correct?"〇 正解！":"△ おしい！";
     $("feedback").className=judged.correct?"feedback-correct":"feedback-wrong";
     $("feedback").hidden=false;
     $("answers").children[value].classList.add(judged.correct?"picked-correct":"picked-wrong");
     index++;
     if(index===questions.length){
       clearInterval(ticker);
       $("timer").textContent=fmt(performance.now()-starting);
       const data=await api("/finish",{sessionId:session,answers});
       $("play").hidden=true;$("finish").hidden=false;
       $("result").textContent=data.correct+" / "+data.count+"問正解！ 所要時間 "+fmt(data.durationMs);
       $("placing").textContent=data.rank?"🎉 あなたは現在 第"+data.rank+"位！ TOP3入りです！":"チャレンジありがとう！また上位3位を目指してみてください。";
       drawReview(data.reviews||[]);
     }else{
       await new Promise(resolve=>setTimeout(resolve,450));
       $("feedback").hidden=true;
       draw();
     }
   }catch(e){
     notice(e.message+"　通信を確認してください。");
     if(answers.length<=index && index<questions.length) $("answers").querySelectorAll("button").forEach(b=>{b.disabled=false;});
   }finally{inFlight=false;}
 }
 function drawReview(reviews){
   const container=$("reviews");container.replaceChildren();
   reviews.forEach((review,i)=>{
     const card=document.createElement("section");
     card.className="review-item";
     const title=document.createElement("h3");
     const q=questions[i];
     const correct=review.selected===review.correctChoice;
     title.textContent="第"+(i+1)+"問 "+(correct?"〇 正解":"△ 不正解");
     const text=document.createElement("p");text.textContent=review.question;
     const own=document.createElement("p");
     own.textContent="あなたの回答："+(q?.choices[review.selected]||"未回答");
     const right=document.createElement("p");
     right.textContent="正解："+(q?.choices[review.correctChoice]||"");
     const explanation=document.createElement("p");
     explanation.textContent=review.explanation||"皆さんの思い出も聞いてみましょう。";
     card.append(title,text,own,right,explanation);
     container.append(card);
   });
 }
 $("start").addEventListener("click",begin);
 $("sound-toggle").addEventListener("change",e=>{sound=e.target.checked;});
 $("view-ranking").addEventListener("click",ranking);
 $("finish-ranking").addEventListener("click",ranking);
 $("again").addEventListener("click",()=>{$("finish").hidden=true;$("config").hidden=false;notice("");});
 if(!endpoint)notice("ランキングサーバーの接続設定はまだ完了していません。");
})();