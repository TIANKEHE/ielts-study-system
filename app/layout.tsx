import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'kyes · IELTS Personal Study Space',applicationName:'kyes',description:'kyes — IELTS Personal Study Space。个人雅思学习闭环：计划、学习、五遍纠错、间隔复习与复盘。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}
