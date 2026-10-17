// Browser playback policy kept separate from the shared room state.
export function canCorrectPlayback({ readyState, seeking, scrubbing, now, lastSeekAt }) {
  return readyState >= 2 && !seeking && !scrubbing && now - lastSeekAt >= 1000;
}

export function playPosition({ currentTime, duration, ended, playing }) {
  const atEnd = ended || (Number.isFinite(duration) && currentTime >= duration - 0.15);
  return !playing && atEnd ? 0 : Math.max(0, Number.isFinite(currentTime) ? currentTime : 0);
}
