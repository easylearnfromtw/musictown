'use strict';
(() => {
  const list = JSON.parse(document.getElementById('playlist-data').textContent);
  const player = document.getElementById('player');
  const container = document.getElementById('tracks');
  const title = document.getElementById('title');
  const artist = document.getElementById('artist');
  const tracks = Array.isArray(list.tracks) ? list.tracks : [];
  let active = 0;
  const buttons = [];
  function select(index, play) {
    const track = tracks[index];
    if (!track) return;
    active = index;
    player.src = track.url;
    title.textContent = track.title;
    artist.textContent = track.artist || list.name;
    buttons.forEach((button, i) => button.classList.toggle('active', i === index));
    if (play) player.play().catch(() => {});
  }
  tracks.forEach((track, index) => {
    const button = document.createElement('button');
    const strong = document.createElement('strong');
    const small = document.createElement('small');
    strong.textContent = (index + 1) + '. ' + track.title;
    small.textContent = track.artist || '';
    button.append(strong, small);
    button.addEventListener('click', () => select(index, true));
    buttons.push(button);
    container.append(button);
  });
  player.addEventListener('ended', () => {
    if (active + 1 < tracks.length) select(active + 1, true);
  });
  if (tracks.length) select(0, false);
  else { title.textContent = list.name || 'CITYMUS'; artist.textContent = '目前沒有音樂'; }
})();
