'use client';
import {useEffect,useRef,useState} from 'react';
type Row=Record<string,any>;
// A single server-owned clock is shared by all tabs; this component owns no duration counter.
export default function AutoStudyTimer({context,onUpdate}:{context:Row|null,onUpdate:(data:Row)=>void}){
 const client=useRef(''),activity=useRef(Date.now()),snapshot=useRef<Row|null>(null),desired=useRef(context),update=useRef(onUpdate),chain=useRef(Promise.resolve()),idle=useRef(false);
 const [message,setMessage]=useState('');desired.current=context;update.current=onUpdate;
 useEffect(()=>{
 client.current=crypto.randomUUID();let alive=true;
 async function send(command:string,extra:Row={}){const r=await fetch('/api/timer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,clientId:client.current,activityAt:activity.current,...extra})});if(!r.ok)throw Error('计时暂未同步');return r.json();}
 const run=()=>{chain.current=chain.current.catch(()=>{}).then(async()=>{if(!alive)return;try{
 let d:Row=snapshot.current??await (await fetch('/api/timer')).json();const c=desired.current,visible=document.visibilityState==='visible'&&document.hasFocus();
 const owns=d.clock.ownerId===client.current;
 if(!visible||!c){if(owns&&d.clock.state==='RUNNING')d=await send('suspend');else d=await (await fetch('/api/timer')).json();}
 else if(Date.now()-activity.current>=300000){if(owns&&d.clock.state==='RUNNING')d=await send('suspend');idle.current=true;setMessage('长时间无操作，计时已暂停。');}
 else if(!idle.current){
 if(d.clock.state!=='RUNNING')d=await send('start',c);
 else if(owns){if(d.clock.skill!==c.skill||d.clock.module!==c.module)d=await send('switch',c);else d=await send('heartbeat');}
 else d=await (await fetch('/api/timer')).json();
 }
 if(!alive)return;snapshot.current=d;update.current(d);if(!idle.current)setMessage(d.clock.state==='RUNNING'&&!owns&&d.clock.ownerId!==client.current?'另一标签页正在计时':'');
 }catch{if(alive)setMessage('计时连接中断，仅保留已确认时长。');}});};
 const active=()=>{activity.current=Date.now();if(idle.current){idle.current=false;run();}};
 const visible=()=>{if(document.visibilityState==='hidden'){const d=snapshot.current;if(d?.clock.ownerId===client.current)navigator.sendBeacon('/api/timer',new Blob([JSON.stringify({command:'suspend',clientId:client.current})],{type:'application/json'}));}else{activity.current=Date.now();idle.current=false;}run();};
 const focus=()=>{activity.current=Date.now();idle.current=false;run();};const blur=()=>{if(snapshot.current?.clock.ownerId===client.current)navigator.sendBeacon('/api/timer',new Blob([JSON.stringify({command:'suspend',clientId:client.current})],{type:'application/json'}));run();};
 const leaving=()=>{if(snapshot.current?.clock.ownerId===client.current)navigator.sendBeacon('/api/timer',new Blob([JSON.stringify({command:'suspend',clientId:client.current})],{type:'application/json'}));};
 const change=()=>run();window.addEventListener('focus',focus);window.addEventListener('blur',blur);window.addEventListener('kyes-context',change);document.addEventListener('visibilitychange',visible);window.addEventListener('pagehide',leaving);
 for(const e of ['pointerdown','keydown','wheel','touchstart'])window.addEventListener(e,active,{passive:true});
 run();const poll=setInterval(run,5000),tick=setInterval(()=>{const d=snapshot.current;if(!d||!alive)return;const c=d.clock,extra=c.state==='RUNNING'&&c.ownerId===client.current&&document.visibilityState==='visible'&&document.hasFocus()&&desired.current&&!idle.current?Math.max(0,Math.min(5,(Date.now()-Date.parse(d.serverNow))/1000)):0;
 const nowDay=new Intl.DateTimeFormat('sv-SE',{timeZone:d.timezone||'Asia/Shanghai'}).format(new Date());if(nowDay!==d.day){run();return;}
 update.current({...d,today:{...d.today,total:d.today.total+extra,modules:{...d.today.modules,[c.module]:(d.today.modules?.[c.module]||0)+extra},skills:{...d.today.skills,[c.skill]:(d.today.skills[c.skill]||0)+extra}}});},1000);
 return()=>{alive=false;leaving();clearInterval(poll);clearInterval(tick);window.removeEventListener('focus',focus);window.removeEventListener('blur',blur);window.removeEventListener('kyes-context',change);document.removeEventListener('visibilitychange',visible);window.removeEventListener('pagehide',leaving);for(const e of ['pointerdown','keydown','wheel','touchstart'])window.removeEventListener(e,active);};
 },[]);
 useEffect(()=>{window.dispatchEvent(new Event('kyes-context'));},[context?.skill,context?.module,context?.budgeted]);
 return message?<p className="muted auto-clock-status" role="status">{message}</p>:null;
}
