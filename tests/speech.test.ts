import {afterEach,describe,it,expect,vi} from 'vitest';
import {createBrowserSpeechProvider} from '../lib/speech';
afterEach(()=>vi.unstubAllGlobals());
describe('浏览器发音适配器',()=>{
 it('优先匹配所选口音和速度，每次播放前取消上一次朗读',async()=>{const cancel=vi.fn(),speak=vi.fn();vi.stubGlobal('window',{speechSynthesis:{cancel,speak,getVoices:()=>[{lang:'en-US',name:'US'},{lang:'en-GB',name:'GB'}]}});vi.stubGlobal('SpeechSynthesisUtterance',class{ text:string;constructor(text:string){this.text=text;}});const provider=createBrowserSpeechProvider(vi.fn());await provider.play('hare',{accent:'en-GB',rate:0.75});expect(cancel).toHaveBeenCalledTimes(1);expect(speak.mock.calls[0][0]).toMatchObject({text:'hare',lang:'en-GB',rate:0.75,voice:{name:'GB'}});await provider.play('exist',{accent:'en-US',rate:1.25});expect(cancel).toHaveBeenCalledTimes(2);expect(speak.mock.calls[1][0]).toMatchObject({text:'exist',lang:'en-US',rate:1.25});});
 it('没有指定口音时提示并降级到可用英文语音',async()=>{const notice=vi.fn(),speak=vi.fn();vi.stubGlobal('window',{speechSynthesis:{cancel:vi.fn(),speak,getVoices:()=>[{lang:'en-US'}]}});vi.stubGlobal('SpeechSynthesisUtterance',class{});await createBrowserSpeechProvider(notice).play('hare',{accent:'en-GB',rate:1});expect(notice).toHaveBeenCalled();expect(speak).toHaveBeenCalledTimes(1);});
 it('不支持发音时提示，不抛错阻塞训练；暂停可取消',async()=>{const notice=vi.fn();vi.stubGlobal('window',{});const provider=createBrowserSpeechProvider(notice);await expect(provider.play('hare',{accent:'en-GB',rate:1})).resolves.toBeUndefined();expect(notice).toHaveBeenCalled();expect(()=>provider.cancel()).not.toThrow();});
});
