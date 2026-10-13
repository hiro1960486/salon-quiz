/* 柏原サロン quiz engine v3: data and game logic are independent. */
(() => {
  "use strict";
  const STORE = "salonQuizProgressV3";
  const DIFFICULTIES = ["normal", "hard", "super"];
  const LABELS = {normal:"通常",hard:"難問",super:"超難問"};
  const MODES = {
    standard:"おまかせ", relaxed:"のんびり", local:"ご当地名人",
    super:"超難問チャレンジ", group:"みんなで相談", daily:"本日の10問",
    review:"まちがい復習"
  };
  const $ = id => document.getElementById(id);
  const rand = Math.random;
  const shuffle = (values, random = rand) => {
    const list = [...values];
    for (let i=list.length-1;i>0;i--) {
      const j=Math.floor(random()*(i+1));
      [list[i],list[j]]=[list[j],list[i]];
    }
    return list;
  };
  function hash(text) {
    let h=2166136261;
    for (let i=0;i<text.length;i++) {
      h ^= text.charCodeAt(i);
      h=Math.imul(h,16777619);
    }
    return (h>>>0).toString(36);
  }
  function seeded(seed) {
    let a=parseInt(hash(seed),36)>>>0;
    return () => {
      a+=0x6D2B79F5;
      let t=a;
      t=Math.imul(t^(t>>>15),t|1);
      t^=t+Math.imul(t^(t>>>7),t|61);
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }
  const read = key => {
    try { return JSON.parse(localStorage.getItem(key)); } catch (_) {return null;}
  };
  const save = (key, value) => {
    try {localStorage.setItem(key,JSON.stringify(value));} catch (_) { /* private session */ }
  };
  const rawQuestions=typeof allQuizData === "undefined" ? [] : allQuizData;
  const questions=[];
  const byId=new Map();
  const duplicates=[];
  rawQuestions.forEach((raw,index) => {
    if (!raw || !raw.genre || !raw.question || !Array.isArray(raw.choices) ||
        raw.choices.length!==3 || !Number.isInteger(raw.correct) ||
        raw.correct<0 || raw.correct>2 || new Set(raw.choices).size!==3) return;
    const id=raw.id || "q-"+hash(raw.genre+"|"+raw.question);
    if (byId.has(id)) {duplicates.push(id);return;}
    const q={...raw,id,difficulty:DIFFICULTIES.includes(raw.difficulty)?raw.difficulty:"normal"};
    byId.set(id,q);questions.push(q);
  });
  let progress=read(STORE);
  if (!progress || progress.version!==3 || typeof progress.stats!=="object" || !progress.stats) {
    progress={version:3,stats:{},recent:[],rounds:0};
    // Legacy queue stored numeric indexes. Preserve approximate played-state at migration only.
    for (const genre of new Set(rawQuestions.map(q=>q.genre))) {
      for (const difficulty of DIFFICULTIES) {
        const v=read("salonQuizCycleV2:"+genre+":"+difficulty);
        if (!v || !Array.isArray(v.known) || !Array.isArray(v.pending)) continue;
        const waiting=new Set(v.pending);
        v.known.filter(i=>!waiting.has(i)).forEach(i=>{
          const raw=rawQuestions[i];if(!raw)return;
          const id=raw.id || "q-"+hash(raw.genre+"|"+raw.question);
          if (byId.has(id) && !progress.stats[id]) progress.stats[id]={seen:1,correct:0,wrong:0};
        });
      }
    }
    save(STORE,progress);
  }
  let mode="standard", genre="all", round=[], index=0, correct=0, answered=false, finished=false;
  const dayKey=()=>{
    const d=new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  };
  function rarity(q) {
    const h=progress.stats[q.id]||{};
    const rec=progress.recent.indexOf(q.id);
    return (h.seen||0)*100 + (rec>=0 ? 1000-rec : 0);
  }
  function choose(pool, already, random=rand, daily=false) {
    const available=pool.filter(q=>!already.has(q.id));
    if (!available.length) return null;
    const ranked=available.map(q=>({q,weight:daily?random():rarity(q)+random()*0.1}));
    ranked.sort((a,b)=>a.weight-b.weight);
    return ranked[0].q;
  }
  function selectRound(total) {
    const daily=mode==="daily", random=daily?seeded("salon-"+dayKey()):rand;
    const candidates=questions.filter(q=>{
      if (mode==="local") return q.region==="東海";
      if (mode==="review") return (progress.stats[q.id]?.wrong||0)>0;
      if (mode==="super") return q.difficulty!=="normal";
      return genre==="all"||q.genre===genre;
    });
    if (mode==="daily") total=10;
    if (mode==="review" && candidates.length===0) return [];
    total=Math.min(total,candidates.length);
    const quotas= mode==="local" ? {normal:Math.round(total*.7),hard:0,super:total-Math.round(total*.7)}
       : mode==="super" ? {normal:0,hard:Math.round(total*.5),super:total-Math.round(total*.5)}
       : {normal:Math.round(total*.6),hard:Math.round(total*.3),super:total-Math.round(total*.6)-Math.round(total*.3)};
    const targetGenres=mode==="standard"||mode==="relaxed"||mode==="group"||mode==="daily"
      ? (genre==="all"? [...new Set(candidates.map(q=>q.genre))] : [genre])
      : [...new Set(candidates.map(q=>q.genre))];
    const genreCount=Object.fromEntries(targetGenres.map(g=>[g,0]));
    const selected=[],already=new Set();
    // Balance each difficulty and each genre, falling back to any available question.
    const slots=shuffle(Object.entries(quotas).flatMap(([d,n])=>Array(Math.max(0,n)).fill(d)),random);
    for (const difficulty of slots) {
      let pool=candidates.filter(q=>q.difficulty===difficulty && !already.has(q.id));
      if (!pool.length) pool=candidates.filter(q=>!already.has(q.id));
      if (!pool.length) break;
      const minCount=Math.min(...pool.map(q=>genreCount[q.genre]||0));
      const balanced=pool.filter(q=>(genreCount[q.genre]||0)===minCount);
      const q=choose(balanced,already,random,daily);
      if (!q) continue;
      selected.push(q);already.add(q.id);
      genreCount[q.genre]=(genreCount[q.genre]||0)+1;
    }
    // Spread super questions rather than allowing consecutive super questions.
    const supers=shuffle(selected.filter(q=>q.difficulty==="super"),random);
    const others=shuffle(selected.filter(q=>q.difficulty!=="super"),random);
    const arranged=Array(selected.length);
    supers.forEach((q,i)=>{
      const left=Math.floor(i*arranged.length/supers.length);
      const right=Math.max(left+1,Math.floor((i+1)*arranged.length/supers.length));
      let slot=left+Math.floor(random()*(right-left));
      while(arranged[slot])slot=(slot+1)%arranged.length;
      arranged[slot]=q;
    });
    let p=0;
    for(let i=0;i<arranged.length;i++)if(!arranged[i])arranged[i]=others[p++];
    const answerPositions=shuffle(arranged.map((_,i)=>i%3),random);
    return arranged.map((q,i)=>{
      const answer=q.choices[q.correct];
      const distractors=shuffle(q.choices.filter((_,j)=>j!==q.correct),random);
      const choices=[...distractors];
      choices.splice(answerPositions[i],0,answer);
      return {...q,choices,correct:answerPositions[i]};
    });
  }
  function updateStats() {
    const played=Object.values(progress.stats).filter(x=>x.seen>0).length;
    const mistakes=Object.values(progress.stats).filter(x=>x.wrong>0).length;
    $("library-stats").textContent="収録 "+questions.length+"問 ／ 挑戦済み "+played+"問 ／ 復習候補 "+mistakes+"問";
  }
  function updateScore() {
    const count=finished?round.length:Math.min(index+(answered?1:0),round.length);
    $("score-counter").textContent="解答 "+count+" / "+round.length+"問 ・ 正解 "+correct+"問 ・ 残り "+(round.length-count)+"問";
  }
  function showError(message) {
    $("question").textContent=message;
    $("q-counter").textContent="";
    $("choices").replaceChildren();
    $("result-box").style.display="none";
    $("round-summary").style.display="none";
    $("next-btn").style.display="none";
    $("score-counter").textContent="解答 0 / 0問";
  }
  function load() {
    answered=false;finished=false;
    const q=round[index];
    if (!q)return showError("出題できる問題がありません。ジャンルやモードを変更してください。");
    $("q-counter").textContent="第 "+(index+1)+"問 ／ 全"+round.length+"問";
    $("category").textContent=q.genre+" ・ "+LABELS[q.difficulty]+(q.region?" ・ ご当地":"");
    $("question").textContent=q.question;
    $("result-box").style.display="none";
    $("round-summary").style.display="none";
    $("next-btn").style.display="none";
    const el=$("choices");el.replaceChildren();
    q.choices.forEach((choice,i)=>{
      const b=document.createElement("button");
      b.className="choice-btn";
      b.type="button";
      b.textContent=(i+1)+". "+choice;
      b.addEventListener("click",()=>answer(i));
      el.appendChild(b);
    });
    updateScore();
  }
  function answer(selected) {
    if(answered||finished)return;
    answered=true;
    const q=round[index],hit=selected===q.correct;
    if(hit)correct++;
    const stat=progress.stats[q.id]||{seen:0,correct:0,wrong:0};
    stat.seen++; if(hit)stat.correct++;else stat.wrong++;
    stat.lastDate=dayKey();
    progress.stats[q.id]=stat;
    progress.recent=[q.id,...progress.recent.filter(id=>id!==q.id)].slice(0,30);
    save(STORE,progress);
    $("choices").querySelectorAll("button").forEach(btn=>{btn.disabled=true;});
    $("result-title").textContent=hit?"大正解！🎉":"おしい！🌸";
    $("result-title").style.color=hit?"#be614e":"#51677c";
    const explain=$("explanation");explain.replaceChildren();
    const strong=document.createElement("strong");strong.textContent="【正解："+q.choices[q.correct]+"】";
    explain.append(strong,document.createElement("br"),document.createElement("br"),document.createTextNode(q.talk||"懐かしい思い出を語り合ってみましょう。"));
    $("result-box").style.display="block";
    $("next-btn").textContent=index+1===round.length?"結果を見る 🌸":"次の問題へ進む 🌸";
    $("next-btn").style.display="block";
    updateScore();updateStats();
  }
  function showResults() {
    finished=true;progress.rounds=(progress.rounds||0)+1;save(STORE,progress);
    const total=round.length, pct=Math.round(correct*100/total);
    $("q-counter").textContent="全"+total+"問完了";
    $("question").textContent="チャレンジ終了！おつかれさまでした 🌸";
    $("choices").replaceChildren();$("result-box").style.display="none";
    const summary=$("round-summary");summary.replaceChildren();
    const heading=document.createElement("div");heading.className="result-title";heading.textContent="結果発表 🎉";
    const details=document.createElement("div");details.className="explanation";
    details.textContent="挑戦 "+total+"問 ／ 正解 "+correct+"問 ／ 不正解 "+(total-correct)+"問 ／ 正答率 "+pct+"%";
    const aside=document.createElement("p");aside.textContent="今日の思い出はありましたか？ ぜひ皆さんで話してみてください。";
    summary.append(heading,details,aside);summary.style.display="block";
    $("next-btn").textContent="もう一度チャレンジ 🔄";
    $("next-btn").style.display="block";
    updateScore();updateStats();
  }
  function nextQuestion() {
    if(finished){start();return;}
    if(!answered)return;
    index++;
    if(index>=round.length)showResults();else load();
  }
  function start() {
    const total=mode==="daily"?10:Number($("round-length").value);
    round=selectRound(total);index=0;correct=0;answered=false;finished=false;
    if(!round.length)return showError(mode==="review"?"復習する問題はまだありません。まず通常のクイズに挑戦してください。":"問題が見つかりません。");
    load();
  }
  function updateControls() {
    document.querySelectorAll(".genre-btn").forEach(b=>b.classList.toggle("active",b.dataset.genre===genre));
    $("mode-select").value=mode;
    $("round-length").disabled=mode==="daily";
    $("round-length").title=mode==="daily"?"本日の10問は10問固定です":"";
    $("mode-description").textContent={
      standard:"通常60％・難問30％・超難問10％。問題と正解位置をバランスよくシャッフルします。",
      relaxed:"時間制限なし。正解解説をゆっくり楽しみましょう。",
      local:"愛知・岐阜・三重、名古屋・春日井の問題を優先します。",
      super:"難問と超難問で腕試し。超難問を多めに出題します。",
      group:"みんなで相談してから一つの答えを選べます。",
      daily:"今日の日付で問題が決まる10問。翌日に内容が変わります。",
      review:"これまで間違えた問題から、未復習を優先して出題します。"
    }[mode];
    updateStats();
  }
  function setup() {
    $("mode-select").addEventListener("change",e=>{mode=e.target.value;updateControls();start();});
    $("round-length").addEventListener("change",start);
    document.querySelectorAll(".genre-btn").forEach(btn=>btn.addEventListener("click",()=>{
      genre=btn.dataset.genre;updateControls();start();
    }));
    $("next-btn").addEventListener("click",nextQuestion);
    $("restart-btn").addEventListener("click",start);
    if(duplicates.length) console.warn("重複する問題ID:",duplicates);
    updateControls();start();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);
  else setup();
})();
