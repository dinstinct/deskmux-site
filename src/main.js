import './style.css';
const screens = [...document.querySelectorAll('[data-mac]')];
for (const screen of screens) {
  screen.addEventListener('click', () => {
    for (const other of screens) {
      const active = other === screen;
      other.classList.toggle('active', active);
      other.setAttribute('aria-pressed', String(active));
      other.querySelector('.input-state').textContent = active ? 'Keyboard + mouse here' : 'Ready when you are';
    }
    document.querySelector('#demo-status').textContent = `Input is on ${screen.dataset.mac === 'studio' ? 'Mac Studio' : 'MacBook'}`;
  });
}

// Enable the illustrative controls only after their handlers are installed.
for (const screen of screens) screen.disabled = false;
document.querySelector('#demo-help').textContent = 'Select either screen to try the flow ↗';
