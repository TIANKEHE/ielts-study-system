/** Adapter boundary for future recorded audio / remote TTS providers. */
export type PronunciationOptions={accent:'en-GB'|'en-US';rate:number};
export interface PronunciationProvider {play(text:string,options:PronunciationOptions):Promise<void>;cancel():void;}
export function createBrowserSpeechProvider(onNotice:(message:string)=>void,onState?:(state:string)=>void):PronunciationProvider{
 let generation=0,timer:ReturnType<typeof setTimeout>|undefined;
 const clear=()=>{if(timer)clearTimeout(timer);timer=undefined;};
 return {cancel(){generation++;clear();if(typeof window!=='undefined'&&'speechSynthesis' in window)window.speechSynthesis.cancel();onState?.('已停止');},async play(text,options){
 generation++;const current=generation;clear();
 if(typeof window==='undefined'||!('speechSynthesis' in window)){onNotice('当前浏览器不支持英文朗读，可关闭自动发音继续默写。');onState?.('不可用');return;}
 const synth=window.speechSynthesis;synth.cancel();
 const voices=synth.getVoices();const exact=voices.find(v=>v.lang.toLowerCase()===options.accent.toLowerCase());const english=exact??voices.find(v=>v.lang.toLowerCase().startsWith('en'));
 if(!exact&&voices.length)onNotice(`未安装${options.accent==='en-GB'?'英式':'美式'}语音，已尝试其他英文语音；可关闭自动发音。`);
 const utterance=new SpeechSynthesisUtterance(text);utterance.lang=options.accent;utterance.rate=options.rate;if(english)utterance.voice=english;
 utterance.onstart=()=>{if(current!==generation)return;clear();onState?.('正在朗读');};
 utterance.onend=()=>{if(current!==generation)return;clear();onState?.('播放完成');};
 utterance.onerror=e=>{if(current!==generation)return;clear();if(!['canceled','interrupted'].includes(e.error)){onNotice('发音未能播放，请点击重播或关闭自动发音；默写不受影响。');onState?.('播放失败');}};
 onState?.('正在请求发音');
 timer=setTimeout(()=>{if(current!==generation)return;onState?.('尚未开始');onNotice('浏览器尚未开始朗读。请尝试重播，或关闭自动发音继续默写。');},3000);
 if(typeof timer==='object'&&'unref' in timer)timer.unref();
 synth.speak(utterance);
 }};
}
