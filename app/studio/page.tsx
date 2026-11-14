'use client';
import { useEffect, useState } from 'react';
import { uploadPresigned } from '@vercel/blob/client';

type User = { id: string; username: string; avatar: string | null };
type Video = { id: string; title: string; creator: string; views: number; likes: number; duration: string; thumb: string; src: string; created: number };
function createVideoId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join('');
}
async function captureThumbnail(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    let settled = false;
    const cleanup = () => { URL.revokeObjectURL(objectUrl); video.removeAttribute('src'); video.load(); };
    const fail = (message: string) => { if (settled) return; settled = true; cleanup(); reject(new Error(message)); };
    video.muted = true; video.playsInline = true; video.preload = 'metadata';
    video.onerror = () => fail('動画からサムネイルを作れませんでした。');
    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return fail('動画の長さを読み取れませんでした。');
      video.currentTime = Math.min(Math.max(0.05, video.duration * (0.1 + Math.random() * 0.8)), Math.max(0.05, video.duration - 0.05));
    };
    video.onseeked = () => {
      if (settled) return;
      const scale = video.videoWidth ? Math.min(1, 640 / video.videoWidth) : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return fail('サムネイルを作成できませんでした。');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => { if (settled) return; settled = true; cleanup(); blob ? resolve(blob) : reject(new Error('サムネイル画像を作成できませんでした。')); }, 'image/jpeg', 0.82);
    };
    video.src = objectUrl; video.load();
  });
}

export default function StudioPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session').then(response => response.ok ? response.json() : { user: null }).then(data => {
      if (cancelled) return;
      setUser(data.user || null); setReady(true);
      if (data.user) fetch('/api/studio/videos').then(response => response.ok ? response.json() : []).then(items => { if (!cancelled && Array.isArray(items)) setVideos(items); }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
      else setLoading(false);
    }).catch(() => { if (!cancelled) { setUser(null); setReady(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) { window.location.assign('/api/auth/discord?next=%2Fstudio'); return; }
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get('video');
    if (!(file instanceof File) || !file.size) { setError('動画ファイルを選択してください。'); return; }
    if (file.size > 250 * 1024 * 1024) { setError('動画は250 MB以下にしてください。'); return; }
    setError(''); setNotice(''); setUploading(true);
    try {
      const thumbnailFrame = await captureThumbnail(file);
      const source = await uploadPresigned(`marovid/${crypto.randomUUID()}-${file.name.replace(/[^A-Za-z0-9_.ぁ-んァ-ン一-龯-]/g, '_')}`, file, { access: 'public', handleUploadUrl: '/api/upload', multipart: true });
      const id = createVideoId();
      const thumbnail = await uploadPresigned(`marovid/thumbnails/${id}.jpg`, thumbnailFrame, { access: 'public', contentType: 'image/jpeg', handleUploadUrl: '/api/upload' });
      const record: Video = { id, title: String(data.get('title') || '').trim(), creator: user.username, views: 0, likes: 0, duration: '--:--', thumb: thumbnail.url, src: source.url, created: Date.now() };
      const response = await fetch('/api/videos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(record) });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || '投稿情報を保存できませんでした。'); }
      setVideos(current => [record, ...current]); form.reset(); setNotice('動画を投稿しました。');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '動画を投稿できませんでした。'); }
    finally { setUploading(false); }
  }
  async function remove(video: Video) {
    if (!window.confirm(`「${video.title}」を削除しますか？この操作は取り消せません。`)) return;
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/studio/videos/${encodeURIComponent(video.id)}`, { method: 'DELETE' });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || '動画を削除できませんでした。'); }
      setVideos(current => current.filter(item => item.id !== video.id)); setNotice('動画を削除しました。');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '動画を削除できませんでした。'); }
  }
  return <main className="studio-page">
    <header className="topbar appbar"><a className="brand" href="/"><span className="brand-mark">m</span>maro<span>Vid</span></a><span className="app-title">maroStudio</span><a className="toolbar-link" href="/">ホーム</a>{user && <><span className="auth-name">{user.username}</span><button className="auth-logout" onClick={async () => { await fetch('/api/auth/session', { method: 'DELETE' }); setUser(null); setVideos([]); }}>ログアウト</button></>}</header>
    <div className="studio-layout"><aside className="studio-sidebar"><div className="sidebar-title">ライブラリ</div><a className="selected" href="#upload">動画を投稿</a><a href="#my-videos">自分の動画</a></aside>
      <section className="studio-main"><div className="studio-heading"><div><span className="eyebrow">CREATOR STUDIO</span><h1>maroStudio</h1><p>動画の投稿と管理</p></div>{user && <span className="studio-user">ログイン中：{user.username}</span>}</div>
        {error && <div className="studio-alert error">{error}</div>}{notice && <div className="studio-alert success">{notice}</div>}
        {!ready ? <div className="studio-panel">読み込み中…</div> : !user ? <div className="studio-login studio-panel"><h2>Discordでログイン</h2><p>動画の投稿と管理にはアカウント認証が必要です。</p><a className="win-primary" href="/api/auth/discord?next=%2Fstudio">Discordでログイン</a></div> : <div className="studio-columns">
          <form id="upload" className="studio-panel upload-panel" onSubmit={submit}><div className="panel-heading"><span className="panel-icon">＋</span><div><h2>動画を投稿</h2><p>MP4 / WebM / MOV、最大250 MB</p></div></div><label>タイトル<input name="title" required maxLength={90} placeholder="動画タイトル" /></label><label>動画ファイル<input name="video" type="file" accept="video/mp4,video/webm,video/quicktime" required /></label><small>サムネイルは動画内のランダムな位置から自動生成されます。</small><button className="win-primary" type="submit" disabled={uploading}>{uploading ? 'アップロード中…' : '動画を公開'}</button></form>
          <section id="my-videos" className="studio-panel my-videos"><div className="panel-heading"><span className="panel-icon">▤</span><div><h2>自分の動画</h2><p>{videos.length} 件</p></div></div>{loading ? <p>読み込み中…</p> : videos.length === 0 ? <div className="studio-empty">投稿した動画はここに表示されます。</div> : <div className="studio-video-list">{videos.map(video => <article className="studio-video" key={video.id}><a href={`/watch/id=${video.id}`} className="studio-thumb" style={{ backgroundImage: `url('${video.thumb}')` }} aria-label={video.title} /><div className="studio-video-copy"><b>{video.title}</b><small>{Number(video.views).toLocaleString()} 回視聴　·　Good {Number(video.likes).toLocaleString()}</small><a href={`/watch/id=${video.id}`}>視聴ページを開く</a></div><button className="win-danger" onClick={() => remove(video)}>削除</button></article>)}</div>}</section>
        </div>}
      </section>
    </div>
  </main>;
}