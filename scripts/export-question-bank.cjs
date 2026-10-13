const fs=require("node:fs"),vm=require("node:vm");
const names=["life","music","tv","history-sports","school-snacks","kasugai-rail","showa-leisure","nagoya-yomi"];
const context=vm.createContext({});
for(const name of names)vm.runInContext(fs.readFileSync("data/"+name+".js","utf8"),context);
vm.runInContext(fs.readFileSync("quiz-data.js","utf8"),context);
const bank=vm.runInContext("allQuizData",context);
function hash(text){let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(36);}
const output=bank.map(q=>({id:q.id||"q-"+hash(q.genre+"|"+q.question),genre:q.genre,question:q.question,choices:q.choices,correct:q.correct,region:q.region||null,talk:q.talk||''}));
const ids=new Set(output.map(q=>q.id));
if(ids.size!==output.length||output.some(q=>q.choices?.length!==3||!Number.isInteger(q.correct)||q.correct<0||q.correct>2))throw Error("Question validation failed");
fs.mkdirSync("worker",{recursive:true});
fs.writeFileSync("worker/questions.json",JSON.stringify(output));
console.log("Exported",output.length,"verified questions");
