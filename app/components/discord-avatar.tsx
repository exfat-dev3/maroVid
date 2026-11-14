function getDefaultAvatarIndex(userId: string) {
  if (!userId || Array.from(userId).some(digit => digit < '0' || digit > '9')) return 0;
  const divisor = 4194304;
  let remainder = 0;
  for (const digit of userId) remainder = (remainder * 10 + Number(digit)) % (6 * divisor);
  return Math.floor(remainder / divisor);
}
type Props = { userId: string; avatar: string | null; username: string; variant?: 'account' | 'creator' };
export function DiscordAvatar({ userId, avatar, username, variant = 'account' }: Props) {
  const index = getDefaultAvatarIndex(userId);
  const src = avatar || 'https://cdn.discordapp.com/embed/avatars/' + index + '.png';
  return <img className={'discord-avatar discord-avatar-' + variant} src={src} alt={username + ' のDiscordアイコン'} loading="lazy" />;
}
