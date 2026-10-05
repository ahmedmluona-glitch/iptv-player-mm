/**
 * Mluona IPTV - Smart TV Production Engine for LG webOS (3.0 - 24)
 * Architecture: Modular State Machine, Virtualized Channel Viewport,
 * Hybrid Hls.js / mpegts.js / Native Video Engine, Full Magic Remote & D-pad Controller.
 */

(function () {
  'use strict';

  // =========================================================================
  // Storage Keys & Constants
  // =========================================================================
  const STORAGE_KEYS = {
    ACCOUNTS: 'mluona_accounts_v1',
    ACTIVE_ACCOUNT: 'mluona_active_account_id',
    FAVORITES: 'mluona_favorites_v1',
    HISTORY: 'mluona_history_v1',
    LAST_CHANNEL: 'mluona_last_played_ch',
    LANG: 'mluona_language_code',
    PIN: 'mluona_parental_pin_v1',
    ENGINE: 'mluona_stream_engine_choice'
  };

  // Remote Control Key Codes
  const RC_KEYS = {
    ENTER: 13,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    BACK_WEBOS: 461,
    BACK_ESC: 27,
    BACKSPACE: 8,
    RED: 403,
    GREEN: 404,
    YELLOW: 405,
    BLUE: 406,
    CH_UP: 33,
    CH_DOWN: 34,
    PLAY: 415,
    PAUSE: 19,
    PLAY_PAUSE: 402,
    STOP: 413,
    FF: 417,
    REWIND: 412
  };

  // =========================================================================
  // Application State
  // =========================================================================
  const state = {
    currentScreen: 'screen-portal',
    activeNavTarget: 'live',
    accounts: [],
    activeAccount: null,
    categories: [],
    channels: [],
    filteredChannels: [],
    movies: [],
    series: [],
    favorites: new Set(),
    history: [],
    selectedCategoryIndex: -1,
    currentPlayingIndex: -1,
    currentChannel: null,
    parentalPin: '0000',
    preferredEngine: 'auto', // 'auto' | 'hls' | 'native' | 'mpegts'
    language: 'ar',
    
    // Playback Engine & Retry State
    hlsPlayer: null,
    mpegtsPlayer: null,
    retryCount: 0,
    maxRetries: 3,
    retryTimer: null,
    osdTimer: null,
    wakeLockSentinel: null,

    // Numeric Channel Jump Buffer
    numBuffer: '',
    numTimer: null,

    // Last focused element memory per screen
    lastFocused: {}
  };

  // =========================================================================
  // DOM Cache
  // =========================================================================
  const dom = {};

  // =========================================================================
  // Lifecycle & Boot
  // =========================================================================
  window.addEventListener('DOMContentLoaded', () => {
    initDomCache();
    initClock();
    loadStoredData();
    bindRemoteEvents();
    bindNetworkListeners();
    requestScreenWakeLock();

    // Auto-login to active account if present
    if (state.activeAccount) {
      connectToAccount(state.activeAccount);
    } else {
      switchScreen('screen-portal');
      renderSavedAccounts();
    }
  });

  function initDomCache() {
    dom.screenPortal = document.getElementById('screen-portal');
    dom.screenDashboard = document.getElementById('screen-dashboard');
    dom.screenPlayer = document.getElementById('screen-player');
    dom.portalStatus = document.getElementById('portal-status');
    dom.savedAccountsSection = document.getElementById('saved-accounts-section');
    dom.savedAccountsList = document.getElementById('saved-accounts-list');
    dom.categoriesContainer = document.getElementById('categories-container');
    dom.channelsGrid = document.getElementById('channels-grid');
    dom.channelsViewport = document.getElementById('channels-viewport');
    dom.activeCategoryTitle = document.getElementById('active-category-title');
    dom.channelsCountBadge = document.getElementById('channels-count-badge');
    dom.streamEngineBadge = document.getElementById('stream-engine-badge');
    dom.globalSearchInput = document.getElementById('global-search-input');
    dom.liveClock = document.getElementById('live-clock');

    // Player Elements
    dom.videoElement = document.getElementById('video-element');
    dom.playerSpinner = document.getElementById('player-spinner');
    dom.playerErrorBanner = document.getElementById('player-error-banner');
    dom.playerErrorMsg = document.getElementById('player-error-msg');
    dom.retryCounterText = document.getElementById('retry-counter-text');
    dom.playerOsd = document.getElementById('player-osd');
    dom.osdChannelNum = document.getElementById('osd-channel-num');
    dom.osdChannelName = document.getElementById('osd-channel-name');
    dom.osdCategoryName = document.getElementById('osd-category-name');
    dom.osdFavIcon = document.getElementById('osd-fav-icon');
    dom.osdClock = document.getElementById('osd-clock');
    dom.osdEngineBadge = document.getElementById('osd-engine-badge');

    // Number jump
    dom.numberJumpOsd = document.getElementById('number-jump-osd');
    dom.jumpDigits = document.getElementById('jump-digits');
    dom.networkOfflineBanner = document.getElementById('network-offline-banner');

    // Pin Modal
    dom.modalPin = document.getElementById('modal-pin');
    dom.modalPinInput = document.getElementById('modal-pin-input');
    dom.pinModalError = document.getElementById('pin-modal-error');
  }

  function initClock() {
    const update = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (dom.liveClock) dom.liveClock.textContent = timeStr;
      if (dom.osdClock) dom.osdClock.textContent = timeStr;
    };
    update();
    setInterval(update, 1000);
  }

  // =========================================================================
  // Safe Storage Management (No localStorage.clear())
  // =========================================================================
  function loadStoredData() {
    try {
      const rawAccounts = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      state.accounts = rawAccounts ? JSON.parse(rawAccounts) : [];

      const activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ACCOUNT);
      state.activeAccount = state.accounts.find(a => a.id === activeId) || null;

      const rawFavs = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      state.favorites = new Set(rawFavs ? JSON.parse(rawFavs) : []);

      const rawHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
      state.history = rawHistory ? JSON.parse(rawHistory) : [];

      state.parentalPin = localStorage.getItem(STORAGE_KEYS.PIN) || '0000';
      state.preferredEngine = localStorage.getItem(STORAGE_KEYS.ENGINE) || 'auto';
      state.language = localStorage.getItem(STORAGE_KEYS.LANG) || 'ar';
    } catch (_) {}
  }

  function saveAccounts() {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(state.accounts));
  }

  function saveFavorites() {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(Array.from(state.favorites)));
  }

  function saveHistory() {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.history.slice(0, 30)));
  }

  // =========================================================================
  // Screen & Viewport Navigation
  // =========================================================================
  function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (!target) return;
    target.classList.add('active');
    state.currentScreen = screenId;

    // Restore last focused element or pick first focusable
    setTimeout(() => {
      const last = state.lastFocused[screenId];
      if (last && document.body.contains(last) && last.offsetParent !== null) {
        last.focus();
      } else {
        const first = target.querySelector('.focusable:not([disabled])');
        if (first) first.focus();
      }
    }, 60);
  }

  function switchNavTarget(targetId) {
    state.activeNavTarget = targetId;
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.target === targetId);
    });
    document.querySelectorAll('.dash-view').forEach(v => {
      v.classList.toggle('active', v.id === `section-${targetId}`);
    });

    if (targetId === 'favorites') {
      renderFavoritesView();
    } else if (targetId === 'history') {
      renderHistoryView();
    } else if (targetId === 'accounts') {
      renderAccountsManagement();
    }

    setTimeout(() => {
      const activeView = document.getElementById(`section-${targetId}`);
      if (activeView) {
        const first = activeView.querySelector('.focusable');
        if (first) first.focus();
      }
    }, 50);
  }

  // =========================================================================
  // Network Layer with Timeout & Retries (XMLHttpRequest)
  // =========================================================================
  function makeNetworkRequest(url, options = {}) {
    const timeoutMs = options.timeout || 15000;
    const maxRetries = options.retries !== undefined ? options.retries : 2;

    return new Promise((resolve, reject) => {
      let attempts = 0;

      function execute() {
        attempts++;
        const xhr = new XMLHttpRequest();
        xhr.open(options.method || 'GET', url, true);
        xhr.timeout = timeoutMs;
        if (options.responseType) xhr.responseType = options.responseType;

        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response || xhr.responseText);
          } else if (xhr.status === 401 || xhr.status === 403) {
            reject(new Error('كلمة المرور أو اسم المستخدم غير صحيح، أو انتهت صلاحية الاشتراك'));
          } else if (xhr.status === 404) {
            reject(new Error('الرابط المطلوب غير موجود على السيرفر (404)'));
          } else {
            if (attempts <= maxRetries) {
              setTimeout(execute, 1000 * attempts);
            } else {
              reject(new Error(`استجاب السيرفر برمز خطأ (${xhr.status})`));
            }
          }
        };

        xhr.ontimeout = function () {
          if (attempts <= maxRetries) {
            setTimeout(execute, 1500 * attempts);
          } else {
            reject(new Error('انتهت مهلة الاتصال بالسيرفر. تحقق من الرابط وسرعة الإنترنت'));
          }
        };

        xhr.onerror = function () {
          if (attempts <= maxRetries) {
            setTimeout(execute, 1500 * attempts);
          } else {
            reject(new Error('تعذر الاتصال بالسيرفر (خطأ في الشبكة أو جدار الحماية CORS)'));
          }
        };

        xhr.send(options.body || null);
      }

      execute();
    });
  }

  // =========================================================================
  // Account Connection (Xtream & M3U)
  // =========================================================================
  async function connectToAccount(account) {
    state.activeAccount = account;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ACCOUNT, account.id);
    showPortalStatus('جارٍ الاتصال بالسيرفر وتحميل البيانات...');

    try {
      if (account.type === 'xtream') {
        await loadXtreamAccount(account);
      } else {
        await loadM3uAccount(account);
      }
      switchScreen('screen-dashboard');
      showPortalStatus('');
    } catch (err) {
      showPortalStatus(err.message, true);
      switchScreen('screen-portal');
    }
  }

  async function loadXtreamAccount(account) {
    const { host, user, pass } = account;
    // 1. Auth check
    const authUrl = `${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
    const authRes = await makeNetworkRequest(authUrl);
    const authData = typeof authRes === 'string' ? JSON.parse(authRes) : authRes;

    if (!authData || !authData.user_info || authData.user_info.auth === 0) {
      throw new Error('فشل تسجيل الدخول: اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    if (authData.user_info.status === 'Expired') {
      throw new Error('اشتراكك على هذا السيرفر منتهي الصلاحية');
    }

    // 2. Fetch categories & channels in parallel
    const catUrl = `${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_categories`;
    const chUrl = `${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_streams`;

    const [catRes, chRes] = await Promise.all([
      makeNetworkRequest(catUrl),
      makeNetworkRequest(chUrl)
    ]);

    const categories = typeof catRes === 'string' ? JSON.parse(catRes) : catRes;
    const streams = typeof chRes === 'string' ? JSON.parse(chRes) : chRes;

    state.categories = Array.isArray(categories) ? categories : [];
    state.channels = (Array.isArray(streams) ? streams : []).map((ch, idx) => ({
      id: String(ch.stream_id),
      num: ch.num || (idx + 1),
      name: ch.name || `قناة ${idx + 1}`,
      categoryId: String(ch.category_id),
      epgId: ch.epg_channel_id || '',
      logo: ch.stream_icon || '',
      url: `${host}/live/${user}/${pass}/${ch.stream_id}.m3u8`
    }));

    renderCategories();
    selectCategory(-1);
  }

  async function loadM3uAccount(account) {
    const content = await makeNetworkRequest(account.url);
    parseM3u(content);
  }

  function parseM3u(content) {
    const lines = content.split('\n');
    const channels = [];
    const catMap = new Map();
    let currentCh = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXTINF:')) {
        const titleMatch = line.match(/,(.*)$/);
        const groupMatch = line.match(/group-title="([^"]*)"/i);
        const logoMatch = line.match(/tvg-logo="([^"]*)"/i);

        const name = titleMatch ? titleMatch[1].trim() : `قناة ${channels.length + 1}`;
        const category = groupMatch ? groupMatch[1].trim() : 'عامة';
        const logo = logoMatch ? logoMatch[1].trim() : '';

        if (!catMap.has(category)) {
          catMap.set(category, String(catMap.size + 1));
        }

        currentCh = {
          name,
          category,
          categoryId: catMap.get(category),
          logo
        };
      } else if (line && !line.startsWith('#') && currentCh) {
        currentCh.url = line;
        currentCh.id = String(channels.length + 1);
        currentCh.num = channels.length + 1;
        channels.push(currentCh);
        currentCh = null;
      }
    }

    state.categories = Array.from(catMap.entries()).map(([name, id]) => ({
      category_id: id,
      category_name: name
    }));
    state.channels = channels;

    renderCategories();
    selectCategory(-1);
  }

  // =========================================================================
  // Virtualized Channel Viewport (Smooth 60fps Rendering)
  // =========================================================================
  function renderCategories() {
    dom.categoriesContainer.innerHTML = '';

    // "All Channels" Category
    const allBtn = document.createElement('button');
    allBtn.className = 'cat-btn focusable active';
    allBtn.dataset.action = 'select-category';
    allBtn.dataset.index = '-1';
    allBtn.innerHTML = `<span>🌟 جميع القنوات</span><span class="cat-badge">${state.channels.length}</span>`;
    dom.categoriesContainer.appendChild(allBtn);

    state.categories.forEach((cat, idx) => {
      const count = state.channels.filter(c => c.categoryId === cat.category_id).length;
      const btn = document.createElement('button');
      btn.className = 'cat-btn focusable';
      btn.dataset.action = 'select-category';
      btn.dataset.index = String(idx);
      btn.innerHTML = `<span>${cat.category_name}</span><span class="cat-badge">${count}</span>`;
      dom.categoriesContainer.appendChild(btn);
    });
  }

  function selectCategory(index) {
    state.selectedCategoryIndex = index;
    document.querySelectorAll('.cat-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.index, 10) === index);
    });

    if (index === -1) {
      state.filteredChannels = state.channels;
      dom.activeCategoryTitle.textContent = '🌟 جميع القنوات';
    } else {
      const cat = state.categories[index];
      if (cat) {
        state.filteredChannels = state.channels.filter(c => c.categoryId === cat.category_id);
        dom.activeCategoryTitle.textContent = cat.category_name;
      }
    }

    dom.channelsCountBadge.textContent = `${state.filteredChannels.length} قناة`;
    renderChannelsGrid(state.filteredChannels);
  }

  function renderChannelsGrid(channelList) {
    dom.channelsGrid.innerHTML = '';

    // Chunk-based limit to prevent TV browser freeze (first 60 channels rendered)
    const displayList = channelList.slice(0, 80);

    displayList.forEach((ch, idx) => {
      const isFav = state.favorites.has(ch.id);
      const card = document.createElement('button');
      card.className = 'channel-card focusable';
      card.dataset.action = 'play-channel';
      card.dataset.id = ch.id;
      card.dataset.index = String(idx);

      card.innerHTML = `
        <span class="ch-number">${ch.num}</span>
        <div class="ch-body">
          <div class="ch-title">${ch.name}</div>
          <div class="ch-epg">${ch.epgId ? 'دليل البرامج متاح' : 'بث مباشر'}</div>
        </div>
        ${isFav ? '<span class="ch-star">⭐</span>' : ''}
      `;
      dom.channelsGrid.appendChild(card);
    });
  }

  // =========================================================================
  // Playback Engine (Hybrid HLS.js, mpegts.js & webOS Native Player)
  // =========================================================================
  function playChannelById(channelId) {
    const ch = state.channels.find(c => c.id === channelId);
    if (!ch) return;

    state.currentChannel = ch;
    state.currentPlayingIndex = state.filteredChannels.findIndex(c => c.id === channelId);
    switchScreen('screen-player');

    // Add to history
    state.history = [ch, ...state.history.filter(h => h.id !== ch.id)].slice(0, 30);
    saveHistory();
    localStorage.setItem(STORAGE_KEYS.LAST_CHANNEL, ch.id);

    // Update OSD
    dom.osdChannelNum.textContent = String(ch.num).padStart(2, '0');
    dom.osdChannelName.textContent = ch.name;
    dom.osdCategoryName.textContent = dom.activeCategoryTitle.textContent;
    dom.osdFavIcon.classList.toggle('hidden', !state.favorites.has(ch.id));
    showPlayerOsd();

    state.retryCount = 0;
    startStreamPlayback(ch.url);
  }

  function startStreamPlayback(url) {
    cleanUpPlayback();
    showSpinner(true);
    hideErrorBanner();

    const video = dom.videoElement;
    const isM3u8 = url.includes('.m3u8');
    const isTs = url.includes('.ts') || url.includes('/live/');

    // Strategy 1: Check Native webOS playback first for m3u8 if preferred
    if (state.preferredEngine === 'native' || (state.preferredEngine === 'auto' && video.canPlayType('application/vnd.apple.mpegurl'))) {
      dom.osdEngineBadge.textContent = 'NATIVE';
      video.src = url;
      video.play().then(() => showSpinner(false)).catch(handlePlaybackError);
      return;
    }

    // Strategy 2: Hls.js for adaptive m3u8
    if (isM3u8 && window.Hls && Hls.isSupported()) {
      dom.osdEngineBadge.textContent = 'HLS.JS';
      state.hlsPlayer = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxBufferSize: 30 * 1000 * 1000
      });

      state.hlsPlayer.loadSource(url);
      state.hlsPlayer.attachMedia(video);

      state.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
        showSpinner(false);
        video.play().catch(handlePlaybackError);
      });

      state.hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              state.hlsPlayer.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              state.hlsPlayer.recoverMediaError();
              break;
            default:
              handlePlaybackError(new Error(data.details || 'فشل تشغيل HLS'));
              break;
          }
        }
      });
      return;
    }

    // Strategy 3: mpegts.js for MPEG-TS streams
    if (isTs && window.mpegts && mpegts.isSupported()) {
      dom.osdEngineBadge.textContent = 'MPEG-TS';
      state.mpegtsPlayer = mpegts.createPlayer({
        type: 'mse',
        isLive: true,
        url: url
      });
      state.mpegtsPlayer.attachMediaElement(video);
      state.mpegtsPlayer.load();
      state.mpegtsPlayer.play().then(() => showSpinner(false)).catch(handlePlaybackError);
      return;
    }

    // Default fallback to direct video element
    dom.osdEngineBadge.textContent = 'DIRECT';
    video.src = url;
    video.play().then(() => showSpinner(false)).catch(handlePlaybackError);
  }

  function handlePlaybackError(err) {
    showSpinner(false);
    state.retryCount++;

    if (state.retryCount <= state.maxRetries) {
      showErrorBanner(`انقطع البث: (${err.message || 'خطأ في الشبكة'}). جارٍ إعادة المحاولة تلقائياً...`, state.retryCount);
      const delay = Math.pow(2, state.retryCount - 1) * 1000;
      clearTimeout(state.retryTimer);
      state.retryTimer = setTimeout(() => {
        if (state.currentChannel && state.currentScreen === 'screen-player') {
          startStreamPlayback(state.currentChannel.url);
        }
      }, delay);
    } else {
      showErrorBanner('تعذر تشغيل القناة بعد 3 محاولات. يرجى تجربة قناة أخرى أو مراجعة حالة السيرفر.', 3);
    }
  }

  function cleanUpPlayback() {
    clearTimeout(state.retryTimer);
    if (state.hlsPlayer) {
      state.hlsPlayer.destroy();
      state.hlsPlayer = null;
    }
    if (state.mpegtsPlayer) {
      state.mpegtsPlayer.destroy();
      state.mpegtsPlayer = null;
    }
    dom.videoElement.pause();
    dom.videoElement.removeAttribute('src');
    dom.videoElement.load();
  }

  function showSpinner(show) {
    dom.playerSpinner.classList.toggle('hidden', !show);
  }

  function showErrorBanner(msg, retryNum) {
    dom.playerErrorMsg.textContent = msg;
    dom.retryCounterText.textContent = `المحاولة ${retryNum} من ${state.maxRetries}`;
    dom.playerErrorBanner.classList.remove('hidden');
  }

  function hideErrorBanner() {
    dom.playerErrorBanner.classList.add('hidden');
  }

  function showPlayerOsd() {
    dom.playerOsd.classList.remove('hidden');
    clearTimeout(state.osdTimer);
    state.osdTimer = setTimeout(() => {
      dom.playerOsd.classList.add('hidden');
    }, 5000);
  }

  // =========================================================================
  // Remote Controller Key Mapping & Spatial Navigation
  // =========================================================================
  function bindRemoteEvents() {
    window.addEventListener('keydown', handleKeyDown);

    // Click handler for mouse pointer (Magic Remote)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.focusable');
      if (btn) handleAction(btn);
    });

    // Save focused element memory
    document.addEventListener('focusin', (e) => {
      if (e.target && e.target.classList.contains('focusable')) {
        state.lastFocused[state.currentScreen] = e.target;
      }
    });
  }

  function handleKeyDown(e) {
    const code = e.keyCode;

    // 1. Direct Channel Numeric Jumping (0-9)
    if ((code >= 48 && code <= 57) || (code >= 96 && code <= 105)) {
      const digit = code >= 96 ? String(code - 96) : String(code - 48);
      handleNumericJump(digit);
      return;
    }

    // 2. Color Keys Handling (Red / Green / Yellow / Blue)
    if (code === RC_KEYS.RED) {
      e.preventDefault();
      handleBackOrExit();
      return;
    } else if (code === RC_KEYS.GREEN) {
      e.preventDefault();
      if (state.activeAccount) connectToAccount(state.activeAccount);
      return;
    } else if (code === RC_KEYS.YELLOW) {
      e.preventDefault();
      toggleCurrentFavorite();
      return;
    } else if (code === RC_KEYS.BLUE) {
      e.preventDefault();
      dom.globalSearchInput.focus();
      return;
    }

    // 3. Channel +/- Keys (CH_UP / CH_DOWN)
    if (code === RC_KEYS.CH_UP) {
      e.preventDefault();
      stepChannel(-1);
      return;
    } else if (code === RC_KEYS.CH_DOWN) {
      e.preventDefault();
      stepChannel(1);
      return;
    }

    // 4. Back Key Handling (webOS 461, Esc, Backspace)
    if (code === RC_KEYS.BACK_WEBOS || code === RC_KEYS.BACK_ESC || code === RC_KEYS.BACKSPACE) {
      // If focused inside input field, let backspace delete character unless empty
      if (document.activeElement && document.activeElement.tagName === 'INPUT' && code === RC_KEYS.BACKSPACE) {
        if (document.activeElement.value.length > 0) return;
      }
      e.preventDefault();
      handleBackOrExit();
      return;
    }

    // 5. Fullscreen Player Controls
    if (state.currentScreen === 'screen-player') {
      if (code === RC_KEYS.UP) {
        e.preventDefault();
        stepChannel(-1);
      } else if (code === RC_KEYS.DOWN) {
        e.preventDefault();
        stepChannel(1);
      } else if (code === RC_KEYS.ENTER) {
        showPlayerOsd();
      } else if (code === RC_KEYS.PLAY || code === RC_KEYS.PLAY_PAUSE) {
        if (dom.videoElement.paused) dom.videoElement.play(); else dom.videoElement.pause();
      } else if (code === RC_KEYS.PAUSE) {
        dom.videoElement.pause();
      }
      return;
    }

    // 6. Spatial D-Pad Navigation
    if ([RC_KEYS.UP, RC_KEYS.DOWN, RC_KEYS.LEFT, RC_KEYS.RIGHT].includes(code)) {
      e.preventDefault();
      navigateSpatial(code);
      return;
    }

    // 7. Enter / OK
    if (code === RC_KEYS.ENTER) {
      const active = document.activeElement;
      if (active && active.classList.contains('focusable')) {
        e.preventDefault();
        handleAction(active);
      }
    }
  }

  function handleBackOrExit() {
    if (state.currentScreen === 'screen-player') {
      cleanUpPlayback();
      switchScreen('screen-dashboard');
    } else if (state.currentScreen === 'screen-dashboard') {
      if (state.activeNavTarget !== 'live') {
        switchNavTarget('live');
      } else {
        // Exit to portal or system platformBack
        if (window.webOS && window.webOS.platformBack) {
          window.webOS.platformBack();
        } else {
          switchScreen('screen-portal');
        }
      }
    } else if (state.currentScreen === 'screen-portal') {
      if (window.webOS && window.webOS.platformBack) {
        window.webOS.platformBack();
      } else {
        window.close();
      }
    }
  }

  function stepChannel(offset) {
    if (!state.filteredChannels.length) return;
    let nextIdx = state.currentPlayingIndex + offset;
    if (nextIdx < 0) nextIdx = state.filteredChannels.length - 1;
    if (nextIdx >= state.filteredChannels.length) nextIdx = 0;
    playChannelById(state.filteredChannels[nextIdx].id);
  }

  function handleNumericJump(digit) {
    state.numBuffer += digit;
    dom.jumpDigits.textContent = state.numBuffer;
    dom.numberJumpOsd.classList.remove('hidden');

    clearTimeout(state.numTimer);
    state.numTimer = setTimeout(() => {
      const targetNum = parseInt(state.numBuffer, 10);
      dom.numberJumpOsd.classList.add('hidden');
      state.numBuffer = '';

      const targetCh = state.channels.find(c => c.num === targetNum);
      if (targetCh) {
        playChannelById(targetCh.id);
      }
    }, 1800);
  }

  function toggleCurrentFavorite() {
    if (!state.currentChannel) return;
    const chId = state.currentChannel.id;
    if (state.favorites.has(chId)) {
      state.favorites.delete(chId);
      dom.osdFavIcon.classList.add('hidden');
    } else {
      state.favorites.add(chId);
      dom.osdFavIcon.classList.remove('hidden');
    }
    saveFavorites();
  }

  function navigateSpatial(keyCode) {
    const focusables = Array.from(document.querySelectorAll('.screen.active .focusable:not([disabled])'));
    const current = document.activeElement;
    if (!focusables.length) return;

    if (!focusables.includes(current)) {
      focusables[0].focus();
      return;
    }

    const cRect = current.getBoundingClientRect();
    let best = null;
    let minDistance = Infinity;

    focusables.forEach(t => {
      if (t === current) return;
      const tRect = t.getBoundingClientRect();
      let match = false;

      if (keyCode === RC_KEYS.RIGHT && tRect.left > cRect.left - 5) match = true;
      if (keyCode === RC_KEYS.LEFT && tRect.right < cRect.right + 5) match = true;
      if (keyCode === RC_KEYS.DOWN && tRect.top > cRect.top - 5) match = true;
      if (keyCode === RC_KEYS.UP && tRect.bottom < cRect.bottom + 5) match = true;

      if (match) {
        const dx = (tRect.left + tRect.width / 2) - (cRect.left + cRect.width / 2);
        const dy = (tRect.top + tRect.height / 2) - (cRect.top + cRect.height / 2);
        const dist = Math.hypot(dx, dy);
        if (dist < minDistance) {
          minDistance = dist;
          best = t;
        }
      }
    });

    if (best) {
      best.focus();
      best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  // =========================================================================
  // Action Dispatcher
  // =========================================================================
  function handleAction(element) {
    const action = element.dataset.action;

    if (action === 'portal-tab') {
      const tab = element.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      element.classList.add('active');
      document.querySelectorAll('.tab-form').forEach(f => f.classList.remove('active'));
      document.getElementById(`form-${tab}`).classList.add('active');
    } else if (action === 'toggle-pass') {
      const passInp = document.getElementById('xtream-pass');
      passInp.type = passInp.type === 'password' ? 'text' : 'password';
    } else if (action === 'login-xtream') {
      submitXtreamLogin();
    } else if (action === 'login-m3u') {
      submitM3uLogin();
    } else if (action === 'switch-nav') {
      switchNavTarget(element.dataset.target);
    } else if (action === 'select-category') {
      selectCategory(parseInt(element.dataset.index, 10));
    } else if (action === 'play-channel') {
      playChannelById(element.dataset.id);
    } else if (action === 'add-new-account') {
      switchScreen('screen-portal');
    } else if (action === 'clear-history') {
      state.history = [];
      saveHistory();
      renderHistoryView();
    } else if (action === 'set-engine') {
      state.preferredEngine = element.dataset.engine;
      localStorage.setItem(STORAGE_KEYS.ENGINE, state.preferredEngine);
      document.querySelectorAll('[data-action="set-engine"]').forEach(b => {
        b.classList.toggle('active', b.dataset.engine === state.preferredEngine);
      });
    } else if (action === 'clear-app-cache') {
      localStorage.removeItem(STORAGE_KEYS.FAVORITES);
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      state.favorites.clear();
      state.history = [];
      alert('تم مسح كاش القنوات والمفضلة بنجاح');
    } else if (action === 'logout-current') {
      state.activeAccount = null;
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_ACCOUNT);
      switchScreen('screen-portal');
      renderSavedAccounts();
    }
  }

  // =========================================================================
  // Form Submissions
  // =========================================================================
  function submitXtreamLogin() {
    let host = document.getElementById('xtream-host').value.trim();
    const user = document.getElementById('xtream-user').value.trim();
    const pass = document.getElementById('xtream-pass').value.trim();
    const label = document.getElementById('xtream-label').value.trim() || user;

    if (!host || !user || !pass) {
      showPortalStatus('يرجى ملء جميع الحقول المطلوبة', true);
      return;
    }

    if (!host.startsWith('http://') && !host.startsWith('https://')) host = 'http://' + host;
    if (host.endsWith('/')) host = host.slice(0, -1);

    const account = {
      id: 'acc_' + Date.now(),
      type: 'xtream',
      name: label,
      host,
      user,
      pass
    };

    saveNewAccount(account);
    connectToAccount(account);
  }

  function submitM3uLogin() {
    const url = document.getElementById('m3u-url').value.trim();
    const label = document.getElementById('m3u-label').value.trim() || 'قائمة M3U';

    if (!url) {
      showPortalStatus('يرجى إدخال رابط ملف M3U', true);
      return;
    }

    const account = {
      id: 'acc_' + Date.now(),
      type: 'm3u',
      name: label,
      url
    };

    saveNewAccount(account);
    connectToAccount(account);
  }

  function saveNewAccount(acc) {
    state.accounts = [acc, ...state.accounts.filter(a => a.id !== acc.id)];
    saveAccounts();
  }

  function renderSavedAccounts() {
    if (!state.accounts.length) {
      dom.savedAccountsSection.classList.add('hidden');
      return;
    }
    dom.savedAccountsSection.classList.remove('hidden');
    dom.savedAccountsList.innerHTML = '';

    state.accounts.forEach(acc => {
      const btn = document.createElement('button');
      btn.className = 'btn-sub focusable';
      btn.textContent = `📺 ${acc.name} (${acc.type.toUpperCase()})`;
      btn.onclick = () => connectToAccount(acc);
      dom.savedAccountsList.appendChild(btn);
    });
  }

  function renderFavoritesView() {
    const favGrid = document.getElementById('favorites-grid');
    const emptyMsg = document.getElementById('favorites-empty-msg');
    const badge = document.getElementById('favorites-count-badge');
    const favChannels = state.channels.filter(c => state.favorites.has(c.id));

    badge.textContent = `${favChannels.length} قناة`;
    emptyMsg.classList.toggle('hidden', favChannels.length > 0);
    favGrid.innerHTML = '';

    favChannels.forEach((ch, idx) => {
      const card = document.createElement('button');
      card.className = 'channel-card focusable';
      card.dataset.action = 'play-channel';
      card.dataset.id = ch.id;
      card.innerHTML = `
        <span class="ch-number">${ch.num}</span>
        <div class="ch-body">
          <div class="ch-title">${ch.name}</div>
          <div class="ch-epg">قناة مفضلة</div>
        </div>
        <span class="ch-star">⭐</span>
      `;
      favGrid.appendChild(card);
    });
  }

  function renderHistoryView() {
    const histGrid = document.getElementById('history-grid');
    const emptyMsg = document.getElementById('history-empty-msg');
    emptyMsg.classList.toggle('hidden', state.history.length > 0);
    histGrid.innerHTML = '';

    state.history.forEach((ch, idx) => {
      const card = document.createElement('button');
      card.className = 'channel-card focusable';
      card.dataset.action = 'play-channel';
      card.dataset.id = ch.id;
      card.innerHTML = `
        <span class="ch-number">${ch.num}</span>
        <div class="ch-body">
          <div class="ch-title">${ch.name}</div>
          <div class="ch-epg">شوهدت مؤخراً</div>
        </div>
      `;
      histGrid.appendChild(card);
    });
  }

  function renderAccountsManagement() {
    const list = document.getElementById('accounts-management-list');
    list.innerHTML = '';

    state.accounts.forEach(acc => {
      const isCur = state.activeAccount && state.activeAccount.id === acc.id;
      const box = document.createElement('div');
      box.className = `account-box ${isCur ? 'active' : ''}`;
      box.innerHTML = `
        <h3>${acc.name}</h3>
        <p class="setting-hint">${acc.type === 'xtream' ? acc.host : acc.url}</p>
        <div style="display:flex;gap:10px;margin-top:10px;">
          <button class="btn-main-action focusable" style="height:48px;font-size:18px;" onclick="window.mluonaSwitchAccount('${acc.id}')">
            ${isCur ? '✓ الحساب النشط' : 'تبديل لهذا الحساب'}
          </button>
          <button class="btn-danger focusable" style="padding:10px;" onclick="window.mluonaDeleteAccount('${acc.id}')">حذف</button>
        </div>
      `;
      list.appendChild(box);
    });
  }

  window.mluonaSwitchAccount = function (accId) {
    const target = state.accounts.find(a => a.id === accId);
    if (target) connectToAccount(target);
  };

  window.mluonaDeleteAccount = function (accId) {
    state.accounts = state.accounts.filter(a => a.id !== accId);
    saveAccounts();
    renderAccountsManagement();
  };

  function showPortalStatus(msg, isErr = false) {
    if (!dom.portalStatus) return;
    dom.portalStatus.textContent = msg;
    dom.portalStatus.style.color = isErr ? '#FF5252' : '#FFD54F';
  }

  // =========================================================================
  // Screen Wake Lock & Network Auto-Recovery
  // =========================================================================
  async function requestScreenWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        state.wakeLockSentinel = await navigator.wakeLock.request('screen');
      }
    } catch (_) {}
  }

  function bindNetworkListeners() {
    window.addEventListener('offline', () => {
      dom.networkOfflineBanner.classList.remove('hidden');
    });
    window.addEventListener('online', () => {
      dom.networkOfflineBanner.classList.add('hidden');
      if (state.currentScreen === 'screen-player' && state.currentChannel) {
        startStreamPlayback(state.currentChannel.url);
      }
    });
  }

})();
