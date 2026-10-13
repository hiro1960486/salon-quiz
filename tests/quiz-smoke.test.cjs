const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const scripts=["data/life.js","data/music.js","data/tv.js","data/history-sports.js","data/school-snacks.js","data/kasugai-rail.js","data/showa-leisure.js","quiz-data.js","quiz-engine.js"];
function setup(memory=new Map()) {
  class Element {
    constructor(id="") {
      this.id=id;this.textContent="";this.children=[];this.handlers={};this.disabled=false;
      this.style={};this.dataset={};this.value="";this.className="";
      this.classList={toggle(){}};
    }
    addEventListener(t,cb){this.handlers[t]=cb;}
    append(...nodes){this.children.push(...nodes);}
    appendChild(node){this.children.push(node);return node;}
    replaceChildren(...nodes){this.children=[...nodes];}
    querySelectorAll(){return this.children.filter(e=>e instanceof Element);}
    click(){if(!this.disabled&&this.handlers.click)this.handlers.click();}
    change(value){this.value=value;if(this.handlers.change)this.handlers.change({target:this});}
  }
  const ids=["mode-select","round-length","restart-btn","score-counter","library-stats","mode-description","q-counter","category","question","choices","result-box","round-summary","next-btn","result-title","explanation"];
  const elems=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
  elems["round-length"].value="10";elems["mode-select"].value="standard";
  const nav=["all","暮らし","音楽","テレビ・芸能","出来事・スポーツ","学校・おやつ"].map(g=>{const e=new Element();e.dataset.genre=g;return e;});
  const doc={readyState:"complete",getElementById:id=>elems[id],querySelectorAll:sel=>sel===".genre-btn"?nav:[],createElement:()=>new Element(),createTextNode:value=>({textContent:value})};
  const store={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  const context=vm.createContext({document:doc,localStorage:store,console,Math,Date,Set,Map});
  for(const filename of scripts) vm.runInContext(fs.readFileSync(path.join(root,filename),"utf8"),context,{filename});
  return {elems,nav,memory};
}
function playRound(t,expected) {
  const seen=[];
  for(let i=0;i<expected;i++) {
    const question=t.elems.question.textContent;
    assert(question,"Question text missing");
    assert(!seen.includes(question),"Repeated question within round: "+question);
    seen.push(question);
    assert.equal(t.elems.choices.children.length,3,"Three choices required");
    const first=t.elems.choices.children[0];
    first.click();first.click();
    const score=t.elems["score-counter"].textContent;
    assert(score.includes("解答 "+(i+1)+" / "+expected+"問"),score);
    assert(score.includes("残り "+(expected-i-1)+"問"),score);
    t.elems["next-btn"].click();
  }
  assert(t.elems.question.textContent.includes("終了"),"Results screen not displayed");
  assert(t.elems["round-summary"].textContent==="","Summary node should use child elements");
  assert(t.elems["round-summary"].children.some(e=>e.textContent.includes("正答率")),"Results missing percentage");
}
for(const total of [10,20,30]) {
  const t=setup();
  t.elems["round-length"].change(String(total));
  playRound(t,total);
  console.log("PASS standard "+total);
}
for(const mode of ["relaxed","local","super","group","review","daily"]) {
  const t=setup();
  if(mode==="review"){
    t.elems.choices.children[0].click(); // might be correct, force wrong by checking answer text
    const answer=t.elems.explanation.children[0].textContent.replace(/^【正解：|】$/g,"");
    if(t.elems.choices.children[0].textContent.endsWith(answer)){
      // no guaranteed wrong, populate an explicit review record below if needed
      const progress=JSON.parse(t.memory.get("salonQuizProgressV3"));
      const id=Object.keys(progress.stats)[0];
      progress.stats[id].wrong=1;t.memory.set("salonQuizProgressV3",JSON.stringify(progress));
      const restored=setup(t.memory);restored.elems["mode-select"].change("review");
      assert(restored.elems.question.textContent && restored.elems.choices.children.length>0);
    } else {
      t.elems["mode-select"].change("review");
      assert(t.elems.question.textContent && t.elems.choices.children.length>0);
    }
    console.log("PASS review");continue;
  }
  t.elems["mode-select"].change(mode);
  if(mode==="daily") {
    t.elems["round-length"].value="30";
    t.elems["mode-select"].change("daily");
    playRound(t,10);
  } else {
    playRound(t,10);
  }
  console.log("PASS "+mode);
}
console.log("All smoke tests passed");
