import {describe,it,expect} from 'vitest';
import {matches,correctionStep,addDays,dayInZone,nextStage,mastery,parseCSV} from '../lib/rules';
describe('严格默写规则',()=>{
 it('仅忽略首尾空格和大小写',()=>{expect(matches('  Apple ','apple')).toBe(true);expect(matches('apples','apple')).toBe(false);expect(matches('ap ple','apple')).toBe(false);expect(matches('apple.','apple')).toBe(false);});
 it('接受明确设置的答案别名',()=>expect(matches('colour','color',['colour'])).toBe(true));
 it('错误不增加次数，五次正确才完成',()=>{let count=0;for(const ok of [true,false,true,false,true,true,true])count=correctionStep(count,ok);expect(count).toBe(5);expect(correctionStep(3,false)).toBe(3);});
});
describe('跨天复习',()=>{
 it('正确处理月底、闰年和年末',()=>{expect(addDays('2024-02-28',1)).toBe('2024-02-29');expect(addDays('2026-12-31',1)).toBe('2027-01-01');});
 it('按用户时区区分日期',()=>{const d=new Date('2026-10-15T17:00:00Z');expect(dayInZone(d,'Asia/Shanghai')).toBe('2026-10-16');expect(dayInZone(d,'America/New_York')).toBe('2026-10-15');});
 it('按累计间隔推进，失败后次日复习',()=>{expect(nextStage(0,true,[1,3,7,14,30])).toEqual({stage:1,days:2});expect(nextStage(2,false,[1,3,7,14,30])).toEqual({stage:0,days:1});});
 it('五遍成功不能直接长期掌握',()=>{expect(mastery(0)).toBe('LEARNING');expect(mastery(2)).toBe('FAMILIAR');expect(mastery(5)).toBe('MASTERED');});
});
describe('CSV输入',()=>{it('支持逗号、换行、双引号、BOM和中文',()=>{expect(parseCSV('\uFEFFenglish,chinese\r\n"a,b","中\n文"\r\n"a""b",词')).toEqual([['english','chinese'],['a,b','中\n文'],['a"b','词']]);});it('拒绝不完整引号',()=>expect(()=>parseCSV('"abc,def')).toThrow());});
