(()=>{
 const $=x=>document.getElementById(x),api=String(window.SALON_RANKING_API||"").replace(/\/$/,""),params=new URLSearchParams(location.search);
 $("genre").value=params.get("genre")||"all";$("count").value=params.get("count")||"10";
 const fmt=ms=>{const sec=Math.floor(ms/1000);return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0")+"."+Math.floor(ms%1000/100);};
 async function refresh(){
  $("error").textContent="";$("rows").replaceChildren();
  try{
   if(!api)throw Error("ランキングサーバーの接続設定はまだ完了していません。");
   const qs=new URLSearchParams({genre:$("genre").value,count:$("count").value});
   const response=await fetch(api+"/ranking?"+qs);
   const data=await response.json();if(!response.ok)throw Error(data.error||"取得に失敗しました");
   if(!data.top.length){$("error").textContent="まだ記録がありません。最初の挑戦者になりましょう！";return;}
   data.top.forEach((score,i)=>{
    const tr=document.createElement("tr");
    [String(i+1)+"位",score.correct+" / "+data.count+"問",fmt(score.durationMs)].forEach(value=>{const td=document.createElement("td");td.textContent=value;tr.append(td);});
    $("rows").append(tr);
   });
  }catch(e){$("error").textContent=e.message;}
 }
 $("refresh").addEventListener("click",refresh);$("genre").addEventListener("change",refresh);$("count").addEventListener("change",refresh);refresh();
})();