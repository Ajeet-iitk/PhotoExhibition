import { Gallery3D } from './gallery3d.js';
import { soundManager } from './audio/soundManager.js';
import { wings, featuredArtworks, allPhotosCatalog, translations } from './data/galleryData.js';
import confetti from 'canvas-confetti';

// State Management
let currentLanguage = 'en';
let isNightMode = false;
let currentWing = wings[0];
let activeArtwork = null;
let favorites = JSON.parse(localStorage.getItem('family_photo_favs') || '[]');
let guestbookWishes = JSON.parse(localStorage.getItem('family_guestbook') || '[]');

// Default sample guestbook wishes if empty
if (guestbookWishes.length === 0) {
  guestbookWishes = [
    { name: 'Papa & Mammi', message: 'God bless our family with endless joy, unity, and love always! ❤️', date: '12 Nov 2026', rot: -2 },
    { name: 'Ajeet Kushwaha', message: 'Cherishing all our memories together across every adventure and milestone!', date: '13 Nov 2026', rot: 3 },
    { name: 'Family & Friends', message: 'What a magnificent virtual exhibition! Truly timeless pictures.', date: '13 Nov 2026', rot: -1 }
  ];
  localStorage.setItem('family_guestbook', JSON.stringify(guestbookWishes));
}

// Slideshow state
let slideshowTimer = null;
let slideshowIndex = 0;
let isSlideshowPlaying = true;

// DOM Elements
const canvasContainer = document.getElementById('canvas-container');
const crosshair = document.getElementById('crosshair');
const aimTooltip = document.getElementById('aim-tooltip');
const currentWingBadge = document.getElementById('current-wing-name');
const wingsBar = document.getElementById('wings-bar');

// Modals
const welcomeModal = document.getElementById('welcome-modal');
const artworkModal = document.getElementById('artwork-modal');
const exploreModal = document.getElementById('explore-modal');

// Initialize 3D Gallery
const gallery = new Gallery3D(canvasContainer, {
  language: currentLanguage,
  onSelectArtwork: (art) => {
    openArtworkInspector(art);
  },
  onWingChange: (wing) => {
    currentWing = wing;
    updateWingBadge();
  },
  onHoverArtwork: (art) => {
    if (art) {
      crosshair.classList.add('hovered');
      aimTooltip.classList.add('visible');
      const titleStr = art.title[currentLanguage] || art.title.en;
      aimTooltip.textContent = `[ ${art.spot} ] ${titleStr} - Click [E]`;
    } else {
      crosshair.classList.remove('hovered');
      aimTooltip.classList.remove('visible');
    }
  }
});

// Render Quick Teleport Wings Bar
function renderWingsBar() {
  wingsBar.innerHTML = '';
  wings.forEach(w => {
    const btn = document.createElement('button');
    btn.className = 'wing-teleport-btn';
    btn.innerHTML = `
      <span class="wing-dot" style="background-color: ${w.color};"></span>
      <span>${w.name[currentLanguage] || w.name.en}</span>
    `;
    btn.addEventListener('click', () => {
      gallery.teleportToWing(w.id);
      currentWing = w;
      updateWingBadge();
    });
    wingsBar.appendChild(btn);
  });
}

function updateWingBadge() {
  if (currentWing) {
    currentWingBadge.textContent = currentWing.name[currentLanguage] || currentWing.name.en;
  }
}

// Language Switcher Handler
function setLanguage(lang) {
  currentLanguage = lang;
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  const t = translations[lang] || translations.en;

  // Header & Buttons
  document.getElementById('ui-app-title').textContent = t.appTitle;
  document.getElementById('ui-app-subtitle').textContent = t.appSubtitle;
  document.getElementById('ui-tour-btn').textContent = gallery.isTourActive ? t.stopTourBtn : t.startTourBtn;
  document.getElementById('ui-explore-btn').textContent = t.exploreBtn;
  document.getElementById('ui-explore-title').textContent = t.exploreTitle;
  document.getElementById('ui-explore-subtitle').textContent = t.exploreSubtitle;
  document.getElementById('explore-search').placeholder = t.searchPlaceholder;
  document.getElementById('ui-btn-enter').textContent = t.enterBtn;

  // Tabs
  document.getElementById('tab-all-photos').textContent = `${t.allCategories} (${allPhotosCatalog.length})`;
  document.getElementById('tab-favorites').textContent = `${t.favoritesOnly} (${favorites.length})`;

  // Inspector labels
  document.getElementById('ui-btn-fav').textContent = t.inspectFavorite;
  document.getElementById('ui-btn-download').textContent = t.inspectDownload;
  document.getElementById('ui-btn-teleport').textContent = t.teleportHere;

  // Update 3D plaques & UI wings
  gallery.updatePlaqueLanguages(lang);
  renderWingsBar();
  updateWingBadge();

  if (activeArtwork) {
    updateArtworkInspectorContent(activeArtwork);
  }
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setLanguage(btn.dataset.lang);
  });
});

// Light / Dark Theme Toggle
const themeBtn = document.getElementById('btn-theme-toggle');
const themeIcon = document.getElementById('theme-icon');

themeBtn.addEventListener('click', () => {
  isNightMode = !isNightMode;
  document.documentElement.setAttribute('data-theme', isNightMode ? 'dark' : 'light');
  themeIcon.textContent = isNightMode ? '☀️' : '🌙';
  gallery.setNightMode(isNightMode);
});

// Guided Tour Button
const tourBtn = document.getElementById('btn-guided-tour');
tourBtn.addEventListener('click', () => {
  const isActive = gallery.toggleGuidedTour();
  const t = translations[currentLanguage];
  tourBtn.querySelector('span:last-child').textContent = isActive ? t.stopTourBtn : t.startTourBtn;
  tourBtn.classList.toggle('btn-primary', isActive);

  if (isActive && !soundManager.isPlaying) {
    soundManager.playMusic();
    updateAudioUI();
  }
});

// Explore Hub Modal
const exploreBtn = document.getElementById('btn-explore-hub');
const exploreCloseBtn = document.getElementById('explore-close-btn');

exploreBtn.addEventListener('click', () => {
  openExploreHub();
});

exploreCloseBtn.addEventListener('click', () => {
  exploreModal.classList.remove('active');
});

function openExploreHub() {
  exploreModal.classList.add('active');
  renderExplorePhotos();
  renderGuestbookWishes();
}

// Artwork Inspector Modal
const inspectCloseBtn = document.getElementById('inspect-close-btn');
const inspectImg = document.getElementById('inspect-img');
const inspectSpot = document.getElementById('inspect-spot');
const inspectWing = document.getElementById('inspect-wing');
const inspectTitle = document.getElementById('inspect-title');
const inspectDesc = document.getElementById('inspect-desc');
const inspectCategory = document.getElementById('inspect-category');
const inspectFavBtn = document.getElementById('inspect-fav-btn');
const inspectFavIcon = document.getElementById('inspect-fav-icon');
const inspectDownloadBtn = document.getElementById('inspect-download-btn');
const inspectTeleportBtn = document.getElementById('inspect-teleport-btn');

function openArtworkInspector(art) {
  activeArtwork = art;
  updateArtworkInspectorContent(art);
  artworkModal.classList.add('active');
}

function updateArtworkInspectorContent(art) {
  inspectImg.src = art.localUrl || art.remoteThumbUrl;
  inspectSpot.textContent = art.spot || 'SHOWCASE';

  const wingObj = wings.find(w => w.id === art.wing);
  inspectWing.textContent = wingObj ? (wingObj.name[currentLanguage] || wingObj.name.en) : 'Exhibition';

  inspectTitle.textContent = art.title[currentLanguage] || art.title.en;
  inspectDesc.textContent = art.description[currentLanguage] || art.description.en;
  inspectCategory.textContent = art.category;

  inspectDownloadBtn.href = art.fullUrl;
  inspectDownloadBtn.setAttribute('download', `${art.spot || 'photo'}_${art.id}.jpg`);

  const isFav = favorites.includes(art.id);
  inspectFavIcon.textContent = isFav ? '❤️' : '🤍';
  inspectFavBtn.classList.toggle('favorited', isFav);
}

inspectCloseBtn.addEventListener('click', () => {
  artworkModal.classList.remove('active');
});

inspectFavBtn.addEventListener('click', () => {
  if (!activeArtwork) return;
  const id = activeArtwork.id;
  const idx = favorites.indexOf(id);
  if (idx === -1) {
    favorites.push(id);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 } });
  } else {
    favorites.splice(idx, 1);
  }
  localStorage.setItem('family_photo_favs', JSON.stringify(favorites));
  updateArtworkInspectorContent(activeArtwork);
  document.getElementById('tab-favorites').textContent = `${translations[currentLanguage].favoritesOnly} (${favorites.length})`;
});

inspectTeleportBtn.addEventListener('click', () => {
  if (!activeArtwork || !activeArtwork.spot) return;
  artworkModal.classList.remove('active');
  gallery.teleportToSpot(activeArtwork.spot);
});

// Welcome Screen & Autoplay Unlock
const enterExhibitionBtn = document.getElementById('btn-enter-exhibition');
enterExhibitionBtn.addEventListener('click', () => {
  welcomeModal.classList.remove('active');
  soundManager.playMusic();
  updateAudioUI();
});

// Audio Player Controller
const vinylIcon = document.getElementById('vinyl-icon');
const audioTrackTitle = document.getElementById('audio-track-title');
const audioPlayBtn = document.getElementById('audio-play-btn');
const audioPrevBtn = document.getElementById('audio-prev-btn');
const audioNextBtn = document.getElementById('audio-next-btn');
const audioMuteBtn = document.getElementById('audio-mute-btn');
const audioVolume = document.getElementById('audio-volume');
const visualizerCanvas = document.getElementById('audio-visualizer');
const vizCtx = visualizerCanvas.getContext('2d');

function updateAudioUI() {
  const isPlaying = soundManager.isPlaying;
  audioPlayBtn.textContent = isPlaying ? '⏸️' : '▶️';
  vinylIcon.classList.toggle('playing', isPlaying);
  audioTrackTitle.textContent = soundManager.getCurrentTrack().name;
}

audioPlayBtn.addEventListener('click', () => {
  soundManager.toggleMusic();
  updateAudioUI();
});

audioNextBtn.addEventListener('click', () => {
  soundManager.nextTrack();
  updateAudioUI();
});

audioPrevBtn.addEventListener('click', () => {
  soundManager.prevTrack();
  updateAudioUI();
});

audioMuteBtn.addEventListener('click', () => {
  const isMuted = soundManager.toggleMute();
  audioMuteBtn.textContent = isMuted ? '🔇' : '🔊';
});

audioVolume.addEventListener('input', (e) => {
  soundManager.setMusicVolume(parseFloat(e.target.value));
});

// Audio Visualizer Waveform Animation Loop
function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);
  vizCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

  const data = soundManager.getWaveformData();
  if (!data) {
    // Subtle flat wave when idle
    vizCtx.fillStyle = 'rgba(217, 119, 6, 0.3)';
    for (let i = 0; i < 8; i++) {
      vizCtx.fillRect(i * 9, 10, 5, 4);
    }
    return;
  }

  const barCount = 8;
  const barWidth = 6;
  const gap = 3;

  for (let i = 0; i < barCount; i++) {
    const val = data[i * 2] / 255;
    const h = Math.max(3, val * 22);
    const y = (visualizerCanvas.height - h) / 2;

    vizCtx.fillStyle = isNightMode ? '#38bdf8' : '#d97706';
    vizCtx.fillRect(i * (barWidth + gap), y, barWidth, h);
  }
}
drawVisualizer();

// Mini-Map / Radar Renderer
const minimapCanvas = document.getElementById('minimap-canvas');
const mctx = minimapCanvas.getContext('2d');
const minimapCoords = document.getElementById('minimap-coords');

function renderMinimap() {
  requestAnimationFrame(renderMinimap);

  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  mctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const scale = 1.6; // meters to canvas pixels

  // Museum Cross Layout Background
  mctx.fillStyle = isNightMode ? '#1e293b' : '#f1ede4';

  // Center Rotunda Circle
  mctx.beginPath();
  mctx.arc(cx, cy, 14 * scale, 0, Math.PI * 2);
  mctx.fill();

  // 4 Wings
  mctx.fillRect(cx - 6 * scale, cy - 35 * scale, 12 * scale, 35 * scale); // North
  mctx.fillRect(cx - 6 * scale, cy, 12 * scale, 35 * scale);              // South
  mctx.fillRect(cx - 35 * scale, cy - 6 * scale, 35 * scale, 12 * scale); // West
  mctx.fillRect(cx, cy - 6 * scale, 35 * scale, 12 * scale);              // East

  // Wing Nodes with Tooltips/Dots
  wings.forEach(wing => {
    const wx = cx + (wing.teleport.x || 0) * scale;
    const wy = cy + (wing.teleport.z || 0) * scale;
    mctx.fillStyle = wing.color;
    mctx.beginPath();
    mctx.arc(wx, wy, 4, 0, Math.PI * 2);
    mctx.fill();
  });

  // Current Player Position & View Cone
  const px = cx + gallery.camera.position.x * scale;
  const py = cy + gallery.camera.position.z * scale;
  const yaw = gallery.euler.y;

  // View Cone
  mctx.fillStyle = isNightMode ? 'rgba(56, 189, 248, 0.35)' : 'rgba(217, 119, 6, 0.35)';
  mctx.beginPath();
  mctx.moveTo(px, py);
  mctx.arc(px, py, 14, yaw - Math.PI / 2 - 0.4, yaw - Math.PI / 2 + 0.4);
  mctx.closePath();
  mctx.fill();

  // Player Dot
  mctx.fillStyle = '#ffffff';
  mctx.strokeStyle = '#0f172a';
  mctx.lineWidth = 2;
  mctx.beginPath();
  mctx.arc(px, py, 4, 0, Math.PI * 2);
  mctx.fill();
  mctx.stroke();

  // Coordinates indicator
  minimapCoords.textContent = `${gallery.camera.position.x.toFixed(0)}, ${gallery.camera.position.z.toFixed(0)}`;
}
renderMinimap();

// Click on minimap to teleport to wing
minimapCanvas.addEventListener('click', (e) => {
  const rect = minimapCanvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left - minimapCanvas.width / 2;
  const clickY = e.clientY - rect.top - minimapCanvas.height / 2;
  const scale = 1.6;

  const worldX = clickX / scale;
  const worldZ = clickY / scale;

  // Find closest wing
  let closestWing = wings[0];
  let minDist = Infinity;
  wings.forEach(w => {
    const d = Math.hypot(w.teleport.x - worldX, w.teleport.z - worldZ);
    if (d < minDist) {
      minDist = d;
      closestWing = w;
    }
  });

  gallery.teleportToWing(closestWing.id);
});

// Mobile Virtual Movement Joystick Implementation
const joystickZone = document.getElementById('joystick-zone');
const joystickKnob = document.getElementById('joystick-knob');
const touchLookZone = document.getElementById('touch-look-zone');

let joystickTouchId = null;
let joystickCenter = { x: 0, y: 0 };
const maxRadius = 45;

joystickZone.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  joystickTouchId = touch.identifier;
  const rect = joystickZone.getBoundingClientRect();
  joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  gallery.touchJoystick.active = true;
  updateJoystick(touch.clientX, touch.clientY);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.identifier === joystickTouchId) {
      updateJoystick(touch.clientX, touch.clientY);
    }
  }
}, { passive: false });

window.addEventListener('touchend', (e) => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === joystickTouchId) {
      joystickTouchId = null;
      gallery.touchJoystick.active = false;
      gallery.touchJoystick.deltaX = 0;
      gallery.touchJoystick.deltaY = 0;
      joystickKnob.style.transform = `translate(0px, 0px)`;
    }
  }
});

function updateJoystick(touchX, touchY) {
  let dx = touchX - joystickCenter.x;
  let dy = touchY - joystickCenter.y;
  const dist = Math.hypot(dx, dy);

  if (dist > maxRadius) {
    dx = (dx / dist) * maxRadius;
    dy = (dy / dist) * maxRadius;
  }

  joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  gallery.touchJoystick.deltaX = dx / maxRadius;
  gallery.touchJoystick.deltaY = dy / maxRadius;
}

// Mobile Touch Look Swipe Implementation
let lookTouchId = null;
let lastLookX = 0;
let lastLookY = 0;

touchLookZone.addEventListener('touchstart', (e) => {
  const touch = e.changedTouches[0];
  lookTouchId = touch.identifier;
  lastLookX = touch.clientX;
  lastLookY = touch.clientY;
});

touchLookZone.addEventListener('touchmove', (e) => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.identifier === lookTouchId) {
      const deltaX = touch.clientX - lastLookX;
      const deltaY = touch.clientY - lastLookY;
      lastLookX = touch.clientX;
      lastLookY = touch.clientY;

      gallery.euler.y -= deltaX * 0.0035;
      gallery.euler.x -= deltaY * 0.0035;
      gallery.euler.x = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, gallery.euler.x));
      gallery.camera.quaternion.setFromEuler(gallery.euler);
    }
  }
});

// Explore Section Photo Grid & Tabs
const tabBtns = document.querySelectorAll('.explore-tab-btn');
const tabPhotos = document.getElementById('tab-content-photos');
const tabSlideshow = document.getElementById('tab-content-slideshow');
const tabGuestbook = document.getElementById('tab-content-guestbook');
const tabHighlights = document.getElementById('tab-content-highlights');
const searchInput = document.getElementById('explore-search');

let activeTab = 'all';

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;

    tabPhotos.style.display = (activeTab === 'all' || activeTab === 'favorites') ? 'grid' : 'none';
    tabSlideshow.style.display = activeTab === 'slideshow' ? 'flex' : 'none';
    tabGuestbook.style.display = activeTab === 'guestbook' ? 'grid' : 'none';
    tabHighlights.style.display = activeTab === 'highlights' ? 'grid' : 'none';

    if (activeTab === 'slideshow') {
      startSlideshow();
    } else {
      stopSlideshow();
    }

    if (activeTab === 'all' || activeTab === 'favorites') {
      renderExplorePhotos();
    }
  });
});

searchInput.addEventListener('input', () => {
  renderExplorePhotos();
});

function renderExplorePhotos() {
  const query = searchInput.value.toLowerCase().trim();
  let photos = (activeTab === 'favorites')
    ? allPhotosCatalog.filter(p => favorites.includes(p.id))
    : allPhotosCatalog;

  if (query) {
    photos = photos.filter(p => {
      const title = (p.title[currentLanguage] || p.title.en || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return title.includes(query) || cat.includes(query);
    });
  }

  tabPhotos.innerHTML = '';
  if (photos.length === 0) {
    tabPhotos.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No photographs found.</p>`;
    return;
  }

  // Render initial batch (lazy loading via scroll for smooth 60fps)
  const displayPhotos = photos.slice(0, 60);

  displayPhotos.forEach(p => {
    const card = document.createElement('div');
    card.className = 'photo-card';

    const isFav = favorites.includes(p.id);
    const titleStr = p.title[currentLanguage] || p.title.en;

    card.innerHTML = `
      <div class="photo-card-img-wrap">
        <img class="photo-card-img" src="${p.thumbUrl}" loading="lazy" alt="${titleStr}">
        ${p.isFeatured ? `<span class="photo-card-featured-tag">★ 3D SPOT</span>` : ''}
        <button class="photo-card-fav-btn ${isFav ? 'favorited' : ''}">
          ${isFav ? '❤️' : '🤍'}
        </button>
      </div>
      <div class="photo-card-info">
        <h4 class="photo-card-title">${titleStr}</h4>
        <p class="photo-card-cat">${p.category}</p>
      </div>
    `;

    // Click card to open in Inspector
    card.addEventListener('click', (e) => {
      if (e.target.closest('.photo-card-fav-btn')) {
        const idx = favorites.indexOf(p.id);
        if (idx === -1) {
          favorites.push(p.id);
          confetti({ particleCount: 20, spread: 50, origin: { y: 0.6 } });
        } else {
          favorites.splice(idx, 1);
        }
        localStorage.setItem('family_photo_favs', JSON.stringify(favorites));
        renderExplorePhotos();
        document.getElementById('tab-favorites').textContent = `${translations[currentLanguage].favoritesOnly} (${favorites.length})`;
        return;
      }

      // Open inspection modal
      const featArt = featuredArtworks.find(f => f.id === p.id);
      openArtworkInspector(featArt || {
        id: p.id,
        spot: p.spot || 'EXPLORE',
        wing: p.wing || 'central',
        title: p.title,
        description: {
          en: `High-resolution photograph from the ${p.category} collection.`,
          hi: `${p.category} संग्रह की एक मनमोहक पारिवारिक तस्वीर।`,
          eh: `${p.category} collection ki ek pyari aur memorable photo.`
        },
        category: p.category,
        localUrl: p.localUrl,
        remoteThumbUrl: p.thumbUrl,
        fullUrl: p.fullUrl
      });
    });

    tabPhotos.appendChild(card);
  });
}

// Slideshow Implementation
const slideshowImg = document.getElementById('slideshow-img');
const slideshowCaption = document.getElementById('slideshow-caption');
const slideshowPlayBtn = document.getElementById('slideshow-play-btn');
const slideshowPrevBtn = document.getElementById('slideshow-prev-btn');
const slideshowNextBtn = document.getElementById('slideshow-next-btn');

function updateSlideshowView() {
  const currentPhoto = allPhotosCatalog[slideshowIndex];
  if (!currentPhoto) return;
  slideshowImg.src = currentPhoto.thumbUrl;
  const titleStr = currentPhoto.title[currentLanguage] || currentPhoto.title.en;
  slideshowCaption.textContent = `[${slideshowIndex + 1}/${allPhotosCatalog.length}] ${titleStr} - ${currentPhoto.category}`;
}

function startSlideshow() {
  isSlideshowPlaying = true;
  slideshowPlayBtn.textContent = '⏸️ Pause';
  updateSlideshowView();
  if (slideshowTimer) clearInterval(slideshowTimer);
  slideshowTimer = setInterval(() => {
    slideshowIndex = (slideshowIndex + 1) % allPhotosCatalog.length;
    updateSlideshowView();
  }, 3800);
}

function stopSlideshow() {
  isSlideshowPlaying = false;
  slideshowPlayBtn.textContent = '▶️ Play';
  if (slideshowTimer) clearInterval(slideshowTimer);
}

slideshowPlayBtn.addEventListener('click', () => {
  if (isSlideshowPlaying) {
    stopSlideshow();
  } else {
    startSlideshow();
  }
});

slideshowPrevBtn.addEventListener('click', () => {
  slideshowIndex = (slideshowIndex - 1 + allPhotosCatalog.length) % allPhotosCatalog.length;
  updateSlideshowView();
});

slideshowNextBtn.addEventListener('click', () => {
  slideshowIndex = (slideshowIndex + 1) % allPhotosCatalog.length;
  updateSlideshowView();
});

// Guestbook / Memory Wall Posting
const guestbookName = document.getElementById('guestbook-name');
const guestbookMsg = document.getElementById('guestbook-msg');
const postWishBtn = document.getElementById('btn-post-wish');
const wishesGrid = document.getElementById('wishes-grid');

function renderGuestbookWishes() {
  wishesGrid.innerHTML = '';
  guestbookWishes.forEach(w => {
    const card = document.createElement('div');
    card.className = 'wish-polaroid';
    card.style.setProperty('--rot', w.rot || 0);
    card.innerHTML = `
      <div class="wish-header">
        <span class="wish-author">${w.name}</span>
        <span class="wish-date">${w.date}</span>
      </div>
      <p class="wish-text">“${w.message}”</p>
    `;
    wishesGrid.appendChild(card);
  });
}

postWishBtn.addEventListener('click', () => {
  const name = guestbookName.value.trim() || 'Well-wisher';
  const msg = guestbookMsg.value.trim();
  if (!msg) return;

  const newWish = {
    name,
    message: msg,
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    rot: (Math.random() * 6 - 3).toFixed(1)
  };

  guestbookWishes.unshift(newWish);
  localStorage.setItem('family_guestbook', JSON.stringify(guestbookWishes));
  guestbookName.value = '';
  guestbookMsg.value = '';

  renderGuestbookWishes();
  confetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });
});

// Initial Setup
renderWingsBar();
updateWingBadge();
setLanguage('en');
