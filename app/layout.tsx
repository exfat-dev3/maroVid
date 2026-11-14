import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'maroVid — いい動画、ここに集まる。', description: '好きな動画を見つけて、あなたの映像をシェアしよう。' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ja"><body>{children}</body></html>; }
