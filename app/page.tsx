'use client';
import { useEffect, useMemo, useState } from 'react';
import { DiscordAvatar } from './components/discord-avatar';
type User = { id: string; username: string; avatar: string | null };
type Video = { id: string; title: string; creator: string; views: number | string; likes?: number; creatorAvatar?: string | null; duration: string; thumb: string; src: string; created: number };
export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [search, setSearch] = useState('');
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    fetch('/api/videos').then(response => response.ok ? response.json() : []).then(items => { if (Array.isArray(items)) setVideos(items); }).catch(() => {});
    fetch('/api/auth/session').then(response => response.ok ? response.json() : { user: null }).then(data => setUser(data.user || null)).catch(() => setUser(null));
  }, []);
  const shown = useMemo(() => videos.filter(video => `${video.title} ${video.creator}`.toLowerCase().includes(search.toLowerCase())), [videos, search]);
  async function logout() { await fetch('/api/auth/session', { method: 'DELETE' }); setUser(null); }
  return <>
    <header className="topbar appbar"><a className="brand" href="/"><span className="brand-mark">m</span>maro<span>Vid</span></a>
      <div className="search"><span>⌕</span><input aria-label="動画を検索" placeholder="動画を検索" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <nav><a href="#videos">動画一覧</a><a className="studio-link" href="/studio">maroStudio</a>{user ? <><span className="discord-profile"><DiscordAvatar userId={user.id} avatar={user.avatar} username={user.username} variant="account" /><span className="auth-name">{user.username}</span></span><button className="auth-logout" onClick={logout}>ログアウト</button></> : <a className="auth-link" href="/api/auth/discord">Discordでログイン</a>}</nav>
    </header>
    <main className="home-main"><section className="content" id="videos"><div className="section-head"><div><span className="eyebrow">maroVid</span><h2>動画一覧</h2></div><a href="/studio" className="view-all">maroStudioを開く <span>↗</span></a></div>
      <div className="video-grid">{shown.map((video, index) => <article className="video-card" key={video.id}><a className="thumb" href={`/watch/id=${video.id}`} style={{ backgroundImage: `url('${video.thumb}')` }} aria-label={`${video.title}を再生`}><span className="duration">{video.duration}</span><span className="play">▶</span><span className="card-index">{String(index + 1).padStart(2, '0')}</span></a><div className="card-info">{video.creatorAvatar ? <DiscordAvatar userId={video.ownerId || video.id} avatar={video.creatorAvatar} username={video.creator} variant="creator" /> : <span className="creator-avatar">{video.creator.slice(0, 1)}</span>}<div className="card-copy"><a className="video-title" href={`/watch/id=${video.id}`}>{video.title}</a><div className="creator">{video.creator} <span>·</span> {Number(video.views).toLocaleString()} 回視聴</div></div><span className="good-count">♡ {Number(video.likes || 0).toLocaleString()}</span></div></article>)}</div>
      {shown.length === 0 && <div className="empty"><p>{videos.length === 0 ? '投稿された動画はありません。' : '動画が見つかりませんでした。'}</p>{videos.length === 0 && <a className="hero-cta" href="/studio">maroStudioを開く</a>}</div>}
    </section><footer><a className="brand small" href="/"><span className="brand-mark">m</span>maro<span>Vid</span></a><div><a href="/admin">管理者</a><a href="/studio">maroStudio</a></div></footer></main>
  </>;
}