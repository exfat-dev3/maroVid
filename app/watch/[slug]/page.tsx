'use client';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

type Video = { id: string; title: string; creator: string; views: number; likes: number; duration: string; thumb: string; src: string; created: number };
const fmt = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

export default function WatchPage() {
  const route = useParams<{ slug: string }>();
  const id = (route.slug || '').startsWith('id=') ? route.slug.slice(3) : route.slug;
  const [video, setVideo] = useState<Video | null>(null);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/videos/${encodeURIComponent(id)}`)
      .then(async response => {
        if (!response.ok) throw new Error('動画が見つかりません。');
        return response.json() as Promise<Video>;
      })
      .then(item => {
        if (cancelled) return;
        setVideo(item);
        const likes = JSON.parse(localStorage.getItem('marovid-likes') || '[]') as string[];
        setLiked(likes.includes(item.id));
        const viewKey = `marovid-viewed:${item.id}`;
        const lastViewed = Number(localStorage.getItem(viewKey) || 0);
        if (Date.now() - lastViewed > 30 * 60 * 1000) {
          localStorage.setItem(viewKey, String(Date.now()));
          fetch(`/api/videos/${encodeURIComponent(item.id)}/engagement`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'view' }),
          }).then(response => response.ok ? response.json() : null).then(counts => {
            if (counts && !cancelled) setVideo(current => current ? { ...current, ...counts } : current);
          }).catch(() => {});
        }
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : '動画を読み込めませんでした。'); });
    return () => { cancelled = true; };
  }, [id]);

  const togglePlay = useCallback(() => {
    const player = videoRef.current;
    if (!player) return;
    if (player.paused) void player.play(); else player.pause();
  }, []);

  async function toggleGood() {
    if (!video || busy) return;
    setBusy(true);
    const next = !liked;
    setLiked(next);
    const likes = JSON.parse(localStorage.getItem('marovid-likes') || '[]') as string[];
    localStorage.setItem('marovid-likes', JSON.stringify(next ? [...new Set([...likes, video.id])] : likes.filter(value => value !== video.id)));
    try {
      const response = await fetch(`/api/videos/${encodeURIComponent(video.id)}/engagement`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: next ? 'like' : 'unlike' }),
      });
      if (!response.ok) throw new Error('Good を保存できませんでした。');
      const counts = await response.json();
      setVideo(current => current ? { ...current, ...counts } : current);
    } catch (err) {
      setLiked(!next);
      setError(err instanceof Error ? err.message : 'Good を保存できませんでした。');
    } finally { setBusy(false); }
  }

  function seek(value: string) {
    const time = Number(value);
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
  }
  function changeVolume(value: string) {
    const level = Number(value);
    setVolume(level);
    setMuted(level === 0);
    if (videoRef.current) videoRef.current.volume = level;
  }
  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
  }
  function toggleFullscreen() {
    const stage = stageRef.current;
    if (!stage) return;
    if (document.fullscreenElement) void document.exitFullscreen(); else void stage.requestFullscreen();
  }

  return <main className="watch-page">
    <header className="topbar watch-topbar"><a className="brand" href="/"><span className="brand-mark">m</span>maro<span>Vid</span></a><a className="back-home" href="/">動画一覧へ</a></header>
    <div className="watch-content">
      {error && !video ? <div className="watch-message">{error}<a href="/">動画一覧へ戻る</a></div> : !video ? <div className="watch-message">動画を読み込み中…</div> : <>
        <div className="watch-stage" ref={stageRef} onDoubleClick={toggleFullscreen}>
          <video ref={videoRef} src={video.src} poster={video.thumb} playsInline preload="metadata" onClick={togglePlay} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={event => setDuration(event.currentTarget.duration || 0)} />
          {!playing && <button className="big-play" aria-label="再生" onClick={togglePlay}>▶</button>}
          <div className="player-controls" onClick={event => event.stopPropagation()}>
            <input aria-label="再生位置" className="seek-bar" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={event => seek(event.target.value)} style={{'--played': `${duration ? currentTime / duration * 100 : 0}%`} as CSSProperties} />
            <div className="control-row">
              <button onClick={togglePlay} aria-label={playing ? '一時停止' : '再生'}>{playing ? 'Ⅱ' : '▶'}</button>
              <span className="player-time">{fmt(currentTime)} / {fmt(duration)}</span>
              <button onClick={toggleMute} aria-label={muted ? '音声をオン' : 'ミュート'}>{muted || volume === 0 ? '🔇' : '🔊'}</button>
              <input aria-label="音量" className="volume-bar" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={event => changeVolume(event.target.value)} />
              <button className="fullscreen-button" onClick={toggleFullscreen} aria-label="全画面表示">⛶</button>
            </div>
          </div>
        </div>
        <section className="watch-details">
          <h1>{video.title}</h1>
          <div className="watch-meta"><div className="watch-creator"><span className="creator-avatar">{video.creator.slice(0,1)}</span><b>{video.creator}</b></div><div className="engagement"><span>▶　{Number(video.views).toLocaleString()} 回視聴</span><button className={liked ? 'good-button active' : 'good-button'} onClick={toggleGood} disabled={busy}>{liked ? '♥' : '♡'}　Good <b>{Number(video.likes).toLocaleString()}</b></button></div></div>
          {error && <p className="watch-inline-error">{error}</p>}
        </section>
      </>}
    </div>
  </main>;
}
