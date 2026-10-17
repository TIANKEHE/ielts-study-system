import {describe,it,expect} from 'vitest';
import {acceptsEnter} from '../lib/keyboard';
const enter={key:'Enter',repeat:false,isComposing:false,keyCode:13};
describe('Enter输入保护',()=>{it('正常Enter仅在按键抬起后的新一轮允许提交',()=>{expect(acceptsEnter(enter,false,false)).toBe(true);expect(acceptsEnter(enter,false,true)).toBe(false);});it('拒绝按住Enter的重复事件',()=>expect(acceptsEnter({...enter,repeat:true},false,false)).toBe(false));it('中文输入法组合输入和229事件都不提交',()=>{expect(acceptsEnter({...enter,isComposing:true},false,false)).toBe(false);expect(acceptsEnter({...enter,keyCode:229},false,false)).toBe(false);expect(acceptsEnter(enter,true,false)).toBe(false);});});
