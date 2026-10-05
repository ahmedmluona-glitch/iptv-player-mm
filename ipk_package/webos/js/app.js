/**
 * Mluona IPTV - webOS Smart TV Application Engine
 * Handles Remote Control (D-pad), Xtream Codes API, M3U Parsing & HLS Player
 */

(function () {
  'use strict';

  // App State
  const state = {
    currentScreen: 'screen-portal',
    activeTab: 'xtream',
    currentSection: 'live',
    categories: [],
    channels: [],
    filteredChannels: [],
    selectedCategoryIndex: 0,
    currentChannelIndex: 0,
    hls: null,
    osdTimer: null
  };

  // DOM Elements Cache
  const dom = {
    screenPortal: document.getElementById('screen-portal'),
    screenDashboard: document.getElementById('screen-dashboard'),
    screenPlayer: document.getElementById('screen-player'),
    portalStatus: document.getElementById('portal-status'),
    categoriesList: document.getElementById('categories-list'),
    channelsGrid: document.getElementById('channels-grid'),
    channelsCount: document.getElementById('channels-count'),
    currentCategoryTitle: document.getElementById('current-category-title'),
    clockDisplay: document.getElementById('clock-display'),
    videoElement: document.getElementById('video-element'),
    playerOsd: document.getElementById('player-osd'),
    osdChannelNum: document.getElementById('osd-channel-num'),
    osdChannelName: document.getElementById('osd-channel-name'),
    osdCategoryName: document.getElementById('osd-category-name'),
    activeAccountName: document.getElementById('active-account-name')
  };

  // ==========================================
  // Initialization
  // ==========================================
  window.addEventListener('DOMContentLoaded', () => {
    initClock();
    loadSavedSession();
    bindEvents();
    focusFirstElement(dom.screenPortal);
  });

  function initClock() {
    const update = () => {
      const now = new Date();
      dom.clockDisplay.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    update();
    setInterval(update, 1000);
  }

  // ==========================================
  // Navigation & Screen Management
  // ==========================================
  function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      state.currentScreen = screenId;
      setTimeout(() => focusFirstElement(target), 50);
    }
  }

  function focusFirstElement(container) {
    const el = container.querySelector('.focusable');
    if (el) el.focus();
  }

  // ==========================================
  // TV Remote Control Navigation (Key Codes)
  // ==========================================
  const KEYS = {
    ENTER: 13,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    BACK_WEBOS: 461, // LG webOS Magic Remote Back
    BACK_ESC: 27,
    BACKSPACE: 8
  };

  function bindEvents() {
    window.addEventListener('keydown', handleKeyDown);

    // Click handler for mouse / pointer / Magic Remote pointer
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.focusable');
      if (!btn) return;
      handleAction(btn);
    });
  }

  function handleKeyDown(e) {
    const keyCode = e.keyCode;

    // 1. Back Key Handling
    if (keyCode === KEYS.BACK_WEBOS || keyCode === KEYS.BACK_ESC || keyCode === KEYS.BACKSPACE) {
      e.preventDefault();
      handleBackNavigation();
      return;
    }

    // 2. Player Controls when in player screen
    if (state.currentScreen === 'screen-player') {
      if (keyCode === KEYS.UP) {
        e.preventDefault();
        changeChannelByOffset(-1);
      } else if (keyCode === KEYS.DOWN) {
        e.preventDefault();
        changeChannelByOffset(1);
      } else if (keyCode === KEYS.ENTER) {
        showPlayerOsd();
      }
      return;
    }

    // 3. Directional D-Pad Navigation between focusables
    if ([KEYS.UP, KEYS.DOWN, KEYS.LEFT, KEYS.RIGHT].includes(keyCode)) {
      e.preventDefault();
      navigateSpatial(keyCode);
      return;
    }

    // 4. Enter / OK Key
    if (keyCode === KEYS.ENTER) {
      const active = document.activeElement;
      if (active && active.classList.contains('focusable')) {
        e.preventDefault();
        handleAction(active);
      }
    }
  }

  function handleBackNavigation() {
    if (state.currentScreen === 'screen-player') {
      stopPlayback();
      switchScreen('screen-dashboard');
    } else if (state.currentScreen === 'screen-dashboard') {
      if (state.currentSection !== 'live') {
        switchSection('live');
      } else {
        switchScreen('screen-portal');
      }
    }
  }

  function navigateSpatial(keyCode) {
    const focusables = Array.from(document.querySelectorAll('.screen.active .focusable:not([disabled])'));
    const current = document.activeElement;
    if (!focusables.length) return;

    if (!focusables.includes(current)) {
      focusables[0].focus();
      return;
    }

    const currentRect = current.getBoundingClientRect();
    let best = null;
    let minDistance = Infinity;

    focusables.forEach(target => {
      if (target === current) return;
      const targetRect = target.getBoundingClientRect();

      let isCandidate = false;
      if (keyCode === KEYS.RIGHT && targetRect.left > currentRect.left - 5) isCandidate = true;
      if (keyCode === KEYS.LEFT && targetRect.right < currentRect.right + 5) isCandidate = true;
      if (keyCode === KEYS.DOWN && targetRect.top > currentRect.top - 5) isCandidate = true;
      if (keyCode === KEYS.UP && targetRect.bottom < currentRect.bottom + 5) isCandidate = true;

      if (isCandidate) {
        const dx = (targetRect.left + targetRect.width / 2) - (currentRect.left + currentRect.width / 2);
        const dy = (targetRect.top + targetRect.height / 2) - (currentRect.top + currentRect.height / 2);
        const distance = Math.hypot(dx, dy);

        if (distance < minDistance) {
          minDistance = distance;
          best = target;
        }
      }
    });

    if (best) {
      best.focus();
      best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function handleAction(element) {
    const action = element.dataset.action;

    if (action === 'select-tab') {
      const tab = element.dataset.tab;
      document.querySelectorAll('.portal-tabs button').forEach(b => b.classList.remove('active'));
      element.classList.add('active');
      document.querySelectorAll('.tab-form').forEach(f => f.classList.remove('active'));
      document.getElementById(`form-${tab}`).classList.add('active');
      state.activeTab = tab;
    } else if (action === 'login-xtream') {
      loginXtream();
    } else if (action === 'login-m3u') {
      loginM3u();
    } else if (action === 'switch-nav') {
      switchSection(element.dataset.target);
    } else if (action === 'select-category') {
      selectCategory(parseInt(element.dataset.index, 10));
    } else if (action === 'play-channel') {
      playChannel(parseInt(element.dataset.index, 10));
    } else if (action === 'logout') {
      localStorage.clear();
      switchScreen('screen-portal');
    }
  }

  // ==========================================
  // Xtream Codes API
  // ==========================================
  async function loginXtream() {
    let host = document.getElementById('xtream-host').value.trim();
    const user = document.getElementById('xtream-user').value.trim();
    const pass = document.getElementById('xtream-pass').value.trim();

    if (!host || !user || !pass) {
      showStatus('يرجى ملء جميع الحقول المطلوبة', true);
      return;
    }

    if (!host.startsWith('http://') && !host.startsWith('https://')) {
      host = 'http://' + host;
    }
    if (host.endsWith('/')) {
      host = host.slice(0, -1);
    }

    showStatus('جارٍ الاتصال بالسيرفر...');

    try {
      const authUrl = `${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
      const res = await fetch(authUrl);
      const data = await res.json();

      if (!data || !data.user_info || data.user_info.auth === 0) {
        showStatus('فشل تسجيل الدخول: اسم المستخدم أو كلمة المرور غير صحيحة', true);
        return;
      }

      // Save credentials in LocalStorage
      localStorage.setItem('mluona_session', JSON.stringify({ type: 'xtream', host, user, pass }));
      dom.activeAccountName.textContent = user;

      showStatus('تم تسجيل الدخول بنجاح! جارٍ تحميل القنوات...');
      await loadXtreamCategoriesAndChannels(host, user, pass);
    } catch (e) {
      showStatus('تعذر الاتصال بالسيرفر. تحقق من الرابط والاتصال بالإنترنت.', true);
    }
  }

  async function loadXtreamCategoriesAndChannels(host, user, pass) {
    try {
      const catUrl = `${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_categories`;
      const catRes = await fetch(catUrl);
      const categories = await catRes.json();

      const chUrl = `${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_streams`;
      const chRes = await fetch(chUrl);
      const streams = await chRes.json();

      state.categories = Array.isArray(categories) ? categories : [];
      state.channels = (Array.isArray(streams) ? streams : []).map((ch, idx) => ({
        id: ch.stream_id,
        num: ch.num || (idx + 1),
        name: ch.name || 'بدون اسم',
        categoryId: ch.category_id,
        url: `${host}/live/${user}/${pass}/${ch.stream_id}.m3u8`
      }));

      renderCategories();
      selectCategory(0);
      switchScreen('screen-dashboard');
    } catch (e) {
      showStatus('حدث خطأ أثناء قراءة القنوات من السيرفر', true);
    }
  }

  // ==========================================
  // M3U Playlist Parser
  // ==========================================
  async function loginM3u() {
    const url = document.getElementById('m3u-url').value.trim();
    if (!url) {
      showStatus('يرجى إدخال رابط ملف M3U', true);
      return;
    }

    showStatus('جارٍ تحميل ومعالجة قائمة M3U...');
    try {
      const res = await fetch(url);
      const text = await res.text();
      parseM3u(text);
      localStorage.setItem('mluona_session', JSON.stringify({ type: 'm3u', url }));
      dom.activeAccountName.textContent = 'قائمة M3U';
      switchScreen('screen-dashboard');
    } catch (e) {
      showStatus('تعذر تحميل ملف M3U، تأكد من صحة الرابط', true);
    }
  }

  function parseM3u(content) {
    const lines = content.split('\n');
    const channels = [];
    const catSet = new Set();
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXTINF:')) {
        const titleMatch = line.match(/,(.*)$/);
        const groupMatch = line.match(/group-title="([^"]*)"/i);
        const name = titleMatch ? titleMatch[1].trim() : `قناة ${channels.length + 1}`;
        const category = groupMatch ? groupMatch[1].trim() : 'عامة';
        catSet.add(category);
        currentChannel = { name, category };
      } else if (line && !line.startsWith('#') && currentChannel) {
        currentChannel.url = line;
        currentChannel.num = channels.length + 1;
        channels.push(currentChannel);
        currentChannel = null;
      }
    }

    state.categories = Array.from(catSet).map((name, id) => ({ category_id: String(id), category_name: name }));
    state.channels = channels;
    renderCategories();
    selectCategory(0);
  }

  // ==========================================
  // Dashboard UI Rendering
  // ==========================================
  function renderCategories() {
    dom.categoriesList.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = 'cat-item focusable active';
    allBtn.dataset.action = 'select-category';
    allBtn.dataset.index = '-1';
    allBtn.textContent = '🌟 جميع القنوات';
    dom.categoriesList.appendChild(allBtn);

    state.categories.forEach((cat, idx) => {
      const btn = document.createElement('button');
      btn.className = 'cat-item focusable';
      btn.dataset.action = 'select-category';
      btn.dataset.index = idx;
      btn.textContent = cat.category_name;
      dom.categoriesList.appendChild(btn);
    });
  }

  function selectCategory(index) {
    state.selectedCategoryIndex = index;
    document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('active'));
    const target = document.querySelector(`.cat-item[data-index="${index}"]`);
    if (target) target.classList.add('active');

    if (index === -1) {
      state.filteredChannels = state.channels;
      dom.currentCategoryTitle.textContent = 'جميع القنوات';
    } else {
      const cat = state.categories[index];
      if (cat) {
        state.filteredChannels = state.channels.filter(ch => ch.categoryId === cat.category_id || ch.category === cat.category_name);
        dom.currentCategoryTitle.textContent = cat.category_name;
      } else {
        state.filteredChannels = state.channels;
      }
    }

    dom.channelsCount.textContent = `${state.filteredChannels.length} قناة`;
    renderChannels();
  }

  function renderChannels() {
    dom.channelsGrid.innerHTML = '';
    state.filteredChannels.forEach((ch, idx) => {
      const card = document.createElement('button');
      card.className = 'channel-card focusable';
      card.dataset.action = 'play-channel';
      card.dataset.index = idx;

      card.innerHTML = `
        <span class="ch-num">${ch.num}</span>
        <span class="ch-name">${ch.name}</span>
      `;
      dom.channelsGrid.appendChild(card);
    });
  }

  function switchSection(secId) {
    state.currentSection = secId;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.nav-btn[data-target="${secId}"]`);
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById(`section-${secId}`);
    if (sec) sec.classList.add('active');
  }

  // ==========================================
  // Video Player & HLS Streamer
  // ==========================================
  function playChannel(index) {
    const ch = state.filteredChannels[index];
    if (!ch) return;

    state.currentChannelIndex = index;
    switchScreen('screen-player');

    dom.osdChannelNum.textContent = ch.num;
    dom.osdChannelName.textContent = ch.name;
    dom.osdCategoryName.textContent = dom.currentCategoryTitle.textContent;
    showPlayerOsd();

    const video = dom.videoElement;
    if (state.hls) {
      state.hls.destroy();
      state.hls = null;
    }

    if (ch.url.includes('.m3u8') && window.Hls && Hls.isSupported()) {
      state.hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      state.hls.loadSource(ch.url);
      state.hls.attachMedia(video);
      state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    } else {
      video.src = ch.url;
      video.play().catch(() => {});
    }
  }

  function changeChannelByOffset(offset) {
    let nextIdx = state.currentChannelIndex + offset;
    if (nextIdx < 0) nextIdx = state.filteredChannels.length - 1;
    if (nextIdx >= state.filteredChannels.length) nextIdx = 0;
    playChannel(nextIdx);
  }

  function stopPlayback() {
    if (state.hls) {
      state.hls.destroy();
      state.hls = null;
    }
    dom.videoElement.pause();
    dom.videoElement.src = '';
  }

  function showPlayerOsd() {
    dom.playerOsd.classList.remove('hidden');
    clearTimeout(state.osdTimer);
    state.osdTimer = setTimeout(() => {
      dom.playerOsd.classList.add('hidden');
    }, 5000);
  }

  function showStatus(msg, isError = false) {
    dom.portalStatus.textContent = msg;
    dom.portalStatus.style.color = isError ? '#FF5252' : '#FFD54F';
  }

  function loadSavedSession() {
    try {
      const raw = localStorage.getItem('mluona_session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session.type === 'xtream') {
          document.getElementById('xtream-host').value = session.host;
          document.getElementById('xtream-user').value = session.user;
          document.getElementById('xtream-pass').value = session.pass;
          loginXtream();
        } else if (session.type === 'm3u') {
          document.getElementById('m3u-url').value = session.url;
          loginM3u();
        }
      }
    } catch (_) {}
  }

})();
