'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type Video = { id: string; title: string; creator: string; views: number | string; duration: string; thumb: string; src: string; created: number };
type AdminUser = { id: string; username: string; avatar: string | null; email: string | null; videoCount: number; videoIds: string[]; banned: boolean; timeoutUntil: number | null; reason: string | null };
const timeoutOptions = [{ value: '10', label: '10分' }, { value: '60', label: '1時間' }, { value: '1440', label: '24時間' }, { value: '10080', label: '7日間' }];

export default function Admin() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [durations, setDurations] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyUser, setBusyUser] = useState('');
  async function fetchUsers(candidate: string) {
    const response = await fetch('/api/admin/users', { headers: { 'x-admin-password': candidate }, cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '管理者認証に失敗しました。');
    setUsers(Array.isArray(result.users) ? result.users : []);
  }
  useEffect(() => {
    let active = true;
    fetch('/api/videos').then(response => response.ok ? response.json() : []).then(items => { if (active && Array.isArray(items)) setVideos(items); }).catch(() => {}).finally(() => { if (active) setReady(true); });
    const saved = sessionStorage.getItem('marovid-admin-password');
    if (saved) {
      setPassword(saved);
      fetchUsers(saved).then(() => { if (active) setAuthorized(true); }).catch(() => { sessionStorage.removeItem('marovid-admin-password'); if (active) { setAuthorized(false); setError('管理者パスワードを確認してください。'); } });
    }
    return () => { active = false; };
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await fetchUsers(password); sessionStorage.setItem('marovid-admin-password', password); setAuthorized(true); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'ログインできませんでした。'); }
  }
  function logout() {
    sessionStorage.removeItem('marovid-admin-password');
    setAuthorized(false); setPassword(''); setUsers([]);
  }
  async function remove(id: string) {
    if (!window.confirm('この動画を完全に削除しますか？')) return;
    const response = await fetch('/api/videos', { method: 'DELETE', headers: { 'content-type': 'application/json', 'x-admin-password': password }, body: JSON.stringify({ id }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || '削除できませんでした。'); if (response.status === 401) logout(); return; }
    setVideos(current => current.filter(video => video.id !== id));
    try { await fetchUsers(password); } catch (reason) { setError(reason instanceof Error ? reason.message : '投稿者一覧を更新できませんでした。'); }
  }
  async function moderate(user: AdminUser, action: 'ban' | 'unban' | 'timeout') {
    setBusyUser(user.id); setError('');
    try {
      const response = await fetch('/api/admin/users/' + encodeURIComponent(user.id), {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ action, durationMinutes: Number(durations[user.id] || '60'), reason: reasons[user.id] || '' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { if (response.status === 401) logout(); throw new Error(result.error || '制限を更新できませんでした。'); }
      await fetchUsers(password);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '制限を更新できませんでした。'); }
    finally { setBusyUser(''); }
  }
  const filtered = useMemo(() => videos.filter(video => video.title.toLowerCase().includes(query.toLowerCase()) || video.creator.toLowerCase().includes(query.toLowerCase())), [videos, query]);
  const emailForVideo = (id: string) => users.find(user => user.videoIds.includes(id))?.email || '未取得';
  if (!authorized) return <main className="admin-login"><form onSubmit={login}><a className="brand" href="/"><span className="brand-mark">m</span>maro<span>Vid</span></a><h1>管理者ログイン</h1><p>Vercel の ADMIN_PASSWORD を入力してください。</p><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="管理者パスワード" required/><button>ログイン</button><a href="/">← サイトへ戻る</a>{error && <small>{error}</small>}</form></main>;
  const bannedCount = users.filter(user => user.banned).length;
  return <main className="admin-page">
    <aside className="admin-side"><a className="brand" href="/"><span className="brand-mark">m</span>maro<span>Vid</span></a><div className="side-label">WORKSPACE</div><a className="side-item" href="/">⌂　サイトを見る</a><a className="side-item selected" href="#videos">▤　動画管理 <b>{videos.length}</b></a><a className="side-item" href="#users">♙　投稿者・制限</a><div className="side-bottom"><button className="auth-logout" onClick={logout}>ログアウト</button><div className="admin-profile"><span className="admin-avatar">m</span><div><b>管理者</b><small>maroVid studio</small></div></div></div></aside>
    <section className="admin-main"><header className="admin-header"><div><div className="breadcrumb">ワークスペース　/　<span>管理者</span></div><h1>管理者メニュー</h1></div><a href="/" className="back-site">↗　サイトを表示</a></header>
      {error && <p className="admin-error">{error}</p>}
      <div className="admin-stats"><div><span>登録動画</span><b>{videos.length.toString().padStart(2, '0')}</b><small>全投稿</small></div><div><span>投稿者アカウント</span><b>{users.length.toString().padStart(2, '0')}</b><small>Discord認証済み</small></div><div><span>BAN中</span><b>{bannedCount.toString().padStart(2, '0')}</b><small>恒久制限</small></div></div>
      <section id="users" className="admin-users"><div className="admin-table-head"><div><h2>投稿者・アカウント管理</h2><span>{users.length} アカウント</span></div><p>Emailは管理者メニュー内だけに表示されます。</p></div>
        <div className="table-wrap"><table className="moderation-table"><thead><tr><th>投稿者</th><th>Email</th><th>動画</th><th>状態</th><th>制限操作</th></tr></thead><tbody>{users.map(user => {
          const timedOut = !user.banned && Boolean(user.timeoutUntil && user.timeoutUntil > Date.now());
          return <tr key={user.id}><td><div className="admin-user-name">{user.avatar ? <img src={user.avatar} alt=""/> : <span>{user.username.slice(0, 1)}</span>}<div><b>{user.username}</b><small>Discord ID: {user.id}</small></div></div></td><td className="admin-email">{user.email || '未取得'}</td><td>{user.videoCount}</td><td><span className={user.banned ? 'moderation-status banned' : timedOut ? 'moderation-status timeout' : 'moderation-status'}>{user.banned ? 'BAN中' : timedOut ? 'タイムアウト中' : '通常'}</span>{user.timeoutUntil && timedOut && <small className="moderation-reason">{new Date(user.timeoutUntil).toLocaleString('ja-JP')}まで</small>}{user.reason && <small className="moderation-reason">{user.reason}</small>}</td><td><div className="moderation-actions"><div className="moderation-row"><input aria-label={user.username + 'への理由'} placeholder="理由（任意）" value={reasons[user.id] || ''} onChange={event => setReasons(current => ({ ...current, [user.id]: event.target.value }))}/>{user.banned ? <button className="moderation-clear" disabled={busyUser === user.id} onClick={() => moderate(user, 'unban')}>制限解除</button> : <button className="moderation-ban" disabled={busyUser === user.id} onClick={() => moderate(user, 'ban')}>BAN</button>}</div><div className="moderation-row"><select aria-label="タイムアウト期間" value={durations[user.id] || '60'} onChange={event => setDurations(current => ({ ...current, [user.id]: event.target.value }))}>{timeoutOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button className="moderation-timeout" disabled={busyUser === user.id} onClick={() => moderate(user, 'timeout')}>タイムアウト</button></div></div></td></tr>;
        })}</tbody></table>{users.length === 0 && <div className="admin-empty"><b>投稿者データがありません</b><p>Discordでログインして動画を投稿したアカウントが表示されます。</p></div>}</div>
      </section>
      <section id="videos" className="admin-videos"><div className="admin-table-head"><div><h2>投稿動画</h2><span>{ready ? '全 ' + videos.length + ' 件' : ''}</span></div><label className="admin-search">⌕ <input placeholder="タイトル・投稿者を検索" value={query} onChange={event => setQuery(event.target.value)}/></label></div>
        <div className="table-wrap"><table><thead><tr><th>動画</th><th>投稿者</th><th>投稿者Email</th><th>視聴</th><th>状態</th><th></th></tr></thead><tbody>{filtered.map(video => <tr key={video.id}><td><div className="admin-video"><img src={video.thumb} alt=""/><div><b>{video.title}</b><small>{video.duration}</small></div></div></td><td>{video.creator}</td><td className="admin-email">{emailForVideo(video.id)}</td><td>{Number(video.views).toLocaleString()}</td><td><span className="status"><i/> 公開中</span></td><td><button className="delete-btn" onClick={() => remove(video.id)}>削除</button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="admin-empty"><b>{videos.length ? '該当する動画がありません' : '投稿動画はまだありません'}</b><p>タイトル・投稿者を確認してください。</p></div>}</div>
      </section><p className="admin-foot">maroVid admin <span>·</span> 管理コンソール</p>
    </section>
  </main>;
}