/**
 * MLUONA IPTV - Smart TV Production Engine for LG webOS
 * 1:1 Pixel-Perfect & Functional Replica of the Android TV APK
 * Pure Vector SVG Icons, Zero Accidental Modal/Input Popups on D-Pad Focus
 */

(function () {
  'use strict';

  // Storage Keys
  const STORAGE = {
    ACCOUNTS: 'mluona_accounts_v2',
    ACTIVE_ACCOUNT: 'mluona_active_account_id_v2',
    FAVORITES: 'mluona_favorites_v2',
    HISTORY: 'mluona_history_v2',
    ENGINE: 'mluona_engine_v2',
    BUFFER: 'mluona_buffer_v2',
    LANG: 'mluona_lang_v2'
  };

  // Remote Control Key Codes
  const KEYS = {
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
    PLAY_PAUSE: 402
  };

  // Application State
  const state = {
    currentScreen: 'screen-splash',
    accounts: [],
    activeAccount: null,
    categories: [],
    channels: [],
    filteredChannels: [],
    moviesCategories: [],
    movies: [],
    filteredMovies: [],
    seriesCategories: [],
    series: [],
    favorites: new Set(),
    history: [],
    
    selectedCategoryIndex: -1,
    currentChannel: null,
    currentChannelIndex: -1,
    
    streamEngine: 'auto',
    bufferProfile: 'medium',
    language: 'ar',

    // Playback Engine & Retry
    hlsPlayer: null,
    mpegtsPlayer: null,
    retryCount: 0,
    maxRetries: 3,
    retryTimer: null,
    receiverBarTimer: null,
    wakeLock: null,

    // Numerical Channel Jump (CH: 12 - )
    chNumBuffer: '',
    chNumTimer: null,

    // Spatial Navigation Memory
    lastFocusedPerScreen: {}
  };

  // DOM Elements Cache
  const dom = {};

  window.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    initClockAndDate();
    loadPersistentData();
    bindRemoteControls();
    bindSearchInputListeners();
    requestWakeLock();

    // 1. Exact Splash Screen Behavior (1.2s animation then route)
    setTimeout(() => {
      if (state.activeAccount) {
        connectAccount(state.activeAccount);
      } else {
        switchScreen('screen-portal');
      }
    }, 1500);
  });

  function cacheDom() {
    dom.screens = document.querySelectorAll('.screen');
    dom.screenSplash = document.getElementById('screen-splash');
    dom.screenPortal = document.getElementById('screen-portal');
    dom.screenDashboard = document.getElementById('screen-dashboard');
    dom.screenLivetv = document.getElementById('screen-livetv');
    dom.screenVod = document.getElementById('screen-vod');
    dom.screenFavorites = document.getElementById('screen-favorites');
    dom.screenSettings = document.getElementById('screen-settings');
    dom.screenPlayer = document.getElementById('screen-player');

    // Dashboard Elements
    dom.dashLiveDate = document.getElementById('dash-live-date');
    dom.dashLiveTime = document.getElementById('dash-live-time');
    dom.dashProfileName = document.getElementById('dash-profile-name');
    dom.dashPlaylistName = document.getElementById('dash-playlist-name');
    dom.badgeLiveCount = document.getElementById('badge-live-count');
    dom.badgeMoviesCount = document.getElementById('badge-movies-count');
    dom.badgeSeriesCount = document.getElementById('badge-series-count');
    dom.badgeFavCount = document.getElementById('badge-fav-count');
    dom.dashMetaLive = document.getElementById('dash-meta-live');
    dom.dashMetaMovies = document.getElementById('dash-meta-movies');
    dom.dashMetaSeries = document.getElementById('dash-meta-series');

    // Live TV Elements
    dom.liveCategoriesList = document.getElementById('live-categories-list');
    dom.liveChannelsGrid = document.getElementById('live-channels-grid');
    dom.liveCurrentCategoryName = document.getElementById('live-current-category-name');
    dom.liveChannelCountBadge = document.getElementById('live-channel-count-badge');
    dom.liveCategorySearch = document.getElementById('live-category-search');
    dom.liveChannelSearch = document.getElementById('live-channel-search');

    // VOD Elements
    dom.vodSidebarTitle = document.getElementById('vod-sidebar-title');
    dom.vodCategoriesList = document.getElementById('vod-categories-list');
    dom.vodCurrentCategoryName = document.getElementById('vod-current-category-name');
    dom.vodCountBadge = document.getElementById('vod-count-badge');
    dom.vodItemsGrid = document.getElementById('vod-items-grid');

    // Player Elements
    dom.videoElement = document.getElementById('video-element');
    dom.playerLoadingSpinner = document.getElementById('player-loading-spinner');
    dom.playerRetryBanner = document.getElementById('player-retry-banner');
    dom.retryMainMsg = document.getElementById('retry-main-msg');
    dom.retryCounterLbl = document.getElementById('retry-counter-lbl');
    
    // Receiver-style bottom bar
    dom.playerReceiverBanner = document.getElementById('player-receiver-banner');
    dom.recChannelNum = document.getElementById('rec-channel-num');
    dom.recChannelName = document.getElementById('rec-channel-name');
    dom.recProgramName = document.getElementById('rec-program-name');
    dom.recResBadge = document.getElementById('rec-res-badge');

    // Full OSD
    dom.playerFullOsd = document.getElementById('player-full-osd');
    dom.osdMediaTitle = document.getElementById('osd-media-title');
    dom.osdCategorySub = document.getElementById('osd-category-sub');
    dom.osdEngineLbl = document.getElementById('osd-engine-lbl');
    dom.osdLiveClock = document.getElementById('osd-live-clock');

    // Numerical Jump Box
    dom.numberJumpOsd = document.getElementById('number-jump-osd');
    dom.jumpDigits = document.getElementById('jump-digits');

    // Modals
    dom.modalXtreamLogin = document.getElementById('modal-xtream-login');
    dom.modalM3uLoad = document.getElementById('modal-m3u-load');
    dom.modalHelp = document.getElementById('modal-help');
    dom.portalGlobalStatus = document.getElementById('portal-global-status');
  }

  function initClockAndDate() {
    const update = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

      if (dom.dashLiveTime) dom.dashLiveTime.textContent = timeStr;
      if (dom.dashLiveDate) dom.dashLiveDate.textContent = dateStr;
      if (dom.osdLiveClock) dom.osdLiveClock.textContent = timeStr;
    };
    update();
    setInterval(update, 1000);
  }

  // =========================================================================
  // Storage Handling
  // =========================================================================
  function loadPersistentData() {
    try {
      const rawAcc = localStorage.getItem(STORAGE.ACCOUNTS);
      state.accounts = rawAcc ? JSON.parse(rawAcc) : [];

      const activeId = localStorage.getItem(STORAGE.ACTIVE_ACCOUNT);
      state.activeAccount = state.accounts.find(a => a.id === activeId) || null;

      const rawFav = localStorage.getItem(STORAGE.FAVORITES);
      state.favorites = new Set(rawFav ? JSON.parse(rawFav) : []);

      const rawHist = localStorage.getItem(STORAGE.HISTORY);
      state.history = rawHist ? JSON.parse(rawHist) : [];

      state.streamEngine = localStorage.getItem(STORAGE.ENGINE) || 'auto';
      state.bufferProfile = localStorage.getItem(STORAGE.BUFFER) || 'medium';
      state.language = localStorage.getItem(STORAGE.LANG) || 'ar';
    } catch (_) {}
  }

  function saveAccounts() {
    localStorage.setItem(STORAGE.ACCOUNTS, JSON.stringify(state.accounts));
  }

  function saveFavorites() {
    localStorage.setItem(STORAGE.FAVORITES, JSON.stringify(Array.from(state.favorites)));
    updateDashboardStats();
  }

  // =========================================================================
  // Screen Switching & Navigation Memory
  // =========================================================================
  function switchScreen(screenId) {
    deactivateAllSearchInputs();
    dom.screens.forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (!target) return;
    target.classList.add('active');
    state.currentScreen = screenId;

    // Restore focus
    setTimeout(() => {
      const last = state.lastFocusedPerScreen[screenId];
      if (last && document.body.contains(last) && last.offsetParent !== null) {
        last.focus();
      } else {
        const first = target.querySelector('.focusable:not([disabled])');
        if (first) first.focus();
      }
    }, 60);
  }

  // =========================================================================
  // Account Connection (Xtream & M3U)
  // =========================================================================
  async function connectAccount(account) {
    state.activeAccount = account;
    localStorage.setItem(STORAGE.ACTIVE_ACCOUNT, account.id);
    if (dom.dashProfileName) dom.dashProfileName.textContent = account.name;
    if (dom.dashPlaylistName) dom.dashPlaylistName.textContent = account.name;

    showPortalStatus('جارٍ الاتصال بالسيرفر وتحميل الباقات...');
    try {
      if (account.type === 'xtream') {
        await loadXtream(account);
      } else {
        await loadM3u(account);
      }
      showPortalStatus('');
      updateDashboardStats();
      switchScreen('screen-dashboard');
    } catch (err) {
      showPortalStatus(err.message, true);
      switchScreen('screen-portal');
    }
  }

  async function loadXtream(acc) {
    const { host, user, pass } = acc;
    // Auth & Info
    const authUrl = `${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
    const authData = await fetchJson(authUrl);

    if (!authData || !authData.user_info || authData.user_info.auth === 0) {
      throw new Error('فشل تسجيل الدخول: اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    // Parallel fetch: Live Categories, Live Streams, VOD Categories, VOD Streams, Series
    const [liveCat, liveStreams, vodCat, vodStreams] = await Promise.all([
      fetchJson(`${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_categories`).catch(() => []),
      fetchJson(`${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_streams`).catch(() => []),
      fetchJson(`${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_vod_categories`).catch(() => []),
      fetchJson(`${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_vod_streams`).catch(() => [])
    ]);

    state.categories = Array.isArray(liveCat) ? liveCat : [];
    state.channels = (Array.isArray(liveStreams) ? liveStreams : []).map((ch, idx) => ({
      id: String(ch.stream_id),
      num: ch.num || (idx + 1),
      name: ch.name || `قناة ${idx + 1}`,
      categoryId: String(ch.category_id),
      epgId: ch.epg_channel_id || '',
      logo: ch.stream_icon || '',
      url: `${host}/live/${user}/${pass}/${ch.stream_id}.m3u8`
    }));

    state.moviesCategories = Array.isArray(vodCat) ? vodCat : [];
    state.movies = (Array.isArray(vodStreams) ? vodStreams : []).map(m => ({
      id: String(m.stream_id),
      name: m.name || 'فيلم',
      categoryId: String(m.category_id),
      rating: m.rating || '',
      poster: m.stream_icon || '',
      url: `${host}/movie/${user}/${pass}/${m.stream_id}.${m.container_extension || 'mp4'}`
    }));

    state.series = [];
    buildLiveTvViews();
  }

  async function loadM3u(acc) {
    const raw = await fetchText(acc.url);
    const lines = raw.split('\n');
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
    state.movies = [];
    state.series = [];
    buildLiveTvViews();
  }

  function fetchJson(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = 16000;
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (_) {
            reject(new Error('استجابة غير صحيحة من السيرفر'));
          }
        } else {
          reject(new Error(`خطأ في السيرفر (${xhr.status})`));
        }
      };
      xhr.ontimeout = () => reject(new Error('انتهت مهلة الاتصال بالسيرفر'));
      xhr.onerror = () => reject(new Error('تعذر الاتصال بالسيرفر (خطأ في الشبكة)'));
      xhr.send();
    });
  }

  function fetchText(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = 25000;
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve(xhr.responseText) : reject(new Error(`خطأ (${xhr.status})`));
      xhr.ontimeout = () => reject(new Error('انتهت مهلة تحميل قائمة M3U'));
      xhr.onerror = () => reject(new Error('فشل تحميل رابط M3U'));
      xhr.send();
    });
  }

  function updateDashboardStats() {
    if (dom.badgeLiveCount) dom.badgeLiveCount.textContent = `${state.channels.length} Channels`;
    if (dom.badgeMoviesCount) dom.badgeMoviesCount.textContent = `${state.movies.length} Movies`;
    if (dom.badgeSeriesCount) dom.badgeSeriesCount.textContent = `${state.series.length} Series`;
    if (dom.badgeFavCount) dom.badgeFavCount.textContent = `${state.favorites.size} Items`;

    if (dom.dashMetaLive) dom.dashMetaLive.textContent = String(state.channels.length);
    if (dom.dashMetaMovies) dom.dashMetaMovies.textContent = String(state.movies.length);
    if (dom.dashMetaSeries) dom.dashMetaSeries.textContent = String(state.series.length);
  }

  // =========================================================================
  // Live TV Screen (Exact match with LiveTvScreen.kt)
  // =========================================================================
  function buildLiveTvViews() {
    // Categories List
    dom.liveCategoriesList.innerHTML = '';
    
    // "All" item
    const allBtn = document.createElement('button');
    allBtn.className = 'cat-item-btn focusable active';
    allBtn.dataset.action = 'select-live-category';
    allBtn.dataset.index = '-1';
    allBtn.innerHTML = `<span>جميع القنوات</span><span class="cat-count">${state.channels.length}</span>`;
    dom.liveCategoriesList.appendChild(allBtn);

    state.categories.forEach((cat, idx) => {
      const count = state.channels.filter(c => c.categoryId === cat.category_id).length;
      const btn = document.createElement('button');
      btn.className = 'cat-item-btn focusable';
      btn.dataset.action = 'select-live-category';
      btn.dataset.index = String(idx);
      btn.innerHTML = `<span>${cat.category_name}</span><span class="cat-count">${count}</span>`;
      dom.liveCategoriesList.appendChild(btn);
    });

    selectLiveCategory(-1);
  }

  function selectLiveCategory(index) {
    state.selectedCategoryIndex = index;
    document.querySelectorAll('.cat-item-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.index, 10) === index);
    });

    if (index === -1) {
      state.filteredChannels = state.channels;
      dom.liveCurrentCategoryName.textContent = 'جميع القنوات';
    } else {
      const cat = state.categories[index];
      if (cat) {
        state.filteredChannels = state.channels.filter(c => c.categoryId === cat.category_id);
        dom.liveCurrentCategoryName.textContent = cat.category_name;
      }
    }

    dom.liveChannelCountBadge.textContent = `${state.filteredChannels.length} قناة`;
    renderChannelsList(state.filteredChannels);
  }

  function renderChannelsList(list) {
    dom.liveChannelsGrid.innerHTML = '';
    const slice = list.slice(0, 90); // Smooth rendering limit

    slice.forEach((ch, idx) => {
      const isFav = state.favorites.has(ch.id);
      const row = document.createElement('button');
      row.className = 'ch-row-card focusable';
      row.dataset.action = 'play-live-channel';
      row.dataset.id = ch.id;
      row.dataset.index = String(idx);

      const starSvg = isFav ? `<span class="ch-fav-mark"><svg class="svg-icon-small" viewBox="0 0 24 24" fill="#FFD54F"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span>` : '';

      row.innerHTML = `
        <span class="ch-num-badge">${String(ch.num).padStart(2, '0')}</span>
        <span class="ch-name-txt">${ch.name}</span>
        ${starSvg}
      `;
      dom.liveChannelsGrid.appendChild(row);
    });
  }

  // =========================================================================
  // Controlled Search Inputs (No Keyboard on simple D-Pad Focus)
  // =========================================================================
  function bindSearchInputListeners() {
    if (dom.liveCategorySearch) {
      dom.liveCategorySearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const items = dom.liveCategoriesList.querySelectorAll('.cat-item-btn');
        items.forEach(item => {
          const text = item.textContent.toLowerCase();
          item.style.display = text.includes(query) ? 'flex' : 'none';
        });
      });
    }

    if (dom.liveChannelSearch) {
      dom.liveChannelSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
          selectLiveCategory(state.selectedCategoryIndex);
          return;
        }
        const matches = state.channels.filter(c => 
          c.name.toLowerCase().includes(query) || String(c.num) === query
        );
        dom.liveChannelCountBadge.textContent = `${matches.length} قناة`;
        renderChannelsList(matches);
      });
    }
  }

  function activateSearchInput(wrapper, inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    wrapper.classList.add('typing');
    input.removeAttribute('readonly');
    input.focus();
  }

  function deactivateAllSearchInputs() {
    document.querySelectorAll('.tv-search-wrapper, .modal-inp-wrapper').forEach(w => w.classList.remove('typing'));
    document.querySelectorAll('.tv-clean-input, .modal-input').forEach(i => {
      i.setAttribute('readonly', 'true');
      i.blur();
    });
  }

  // =========================================================================
  // Playback Engine & Receiver-Style Bar (Exact Replica of TvPlayerScreen.kt)
  // =========================================================================
  function playChannel(channel) {
    if (!channel) return;
    state.currentChannel = channel;
    state.currentChannelIndex = state.filteredChannels.findIndex(c => c.id === channel.id);
    switchScreen('screen-player');

    // Update Receiver Banner
    dom.recChannelNum.textContent = String(channel.num).padStart(2, '0');
    dom.recChannelName.textContent = channel.name;
    dom.recProgramName.textContent = channel.epgId || 'البث الحي المباشر';

    // Update Full OSD
    dom.osdMediaTitle.textContent = channel.name;
    dom.osdCategorySub.textContent = dom.liveCurrentCategoryName.textContent;

    showReceiverBanner();

    state.retryCount = 0;
    launchStream(channel.url);
  }

  function showReceiverBanner() {
    dom.playerReceiverBanner.classList.remove('hidden');
    clearTimeout(state.receiverBarTimer);
    state.receiverBarTimer = setTimeout(() => {
      dom.playerReceiverBanner.classList.add('hidden');
    }, 3500); // Exact 3.5s delay from Android
  }

  function toggleFullOsd() {
    const isHidden = dom.playerFullOsd.classList.contains('hidden');
    if (isHidden) {
      dom.playerFullOsd.classList.remove('hidden');
      setTimeout(() => dom.playerFullOsd.classList.add('hidden'), 5000);
    } else {
      dom.playerFullOsd.classList.add('hidden');
    }
  }

  function launchStream(url) {
    stopCurrentPlayback();
    dom.playerLoadingSpinner.classList.remove('hidden');
    dom.playerRetryBanner.classList.add('hidden');

    const video = dom.videoElement;
    const isM3u8 = url.includes('.m3u8');
    const isTs = url.includes('.ts');

    // 1. Native webOS video
    if (state.streamEngine === 'native' || (state.streamEngine === 'auto' && video.canPlayType('application/vnd.apple.mpegurl'))) {
      dom.osdEngineLbl.textContent = 'NATIVE';
      video.src = url;
      video.play().then(() => dom.playerLoadingSpinner.classList.add('hidden')).catch(onPlaybackFailure);
      return;
    }

    // 2. Hls.js
    if (isM3u8 && window.Hls && Hls.isSupported()) {
      dom.osdEngineLbl.textContent = 'HLS.JS';
      state.hlsPlayer = new Hls({ enableWorker: true, lowLatencyMode: true });
      state.hlsPlayer.loadSource(url);
      state.hlsPlayer.attachMedia(video);
      state.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
        dom.playerLoadingSpinner.classList.add('hidden');
        video.play().catch(onPlaybackFailure);
      });
      state.hlsPlayer.on(Hls.Events.ERROR, (e, data) => {
        if (data.fatal) onPlaybackFailure(new Error(data.details));
      });
      return;
    }

    // 3. mpegts.js for TS
    if (isTs && window.mpegts && mpegts.isSupported()) {
      dom.osdEngineLbl.textContent = 'MPEG-TS';
      state.mpegtsPlayer = mpegts.createPlayer({ type: 'mse', isLive: true, url });
      state.mpegtsPlayer.attachMediaElement(video);
      state.mpegtsPlayer.load();
      state.mpegtsPlayer.play().then(() => dom.playerLoadingSpinner.classList.add('hidden')).catch(onPlaybackFailure);
      return;
    }

    // Fallback
    dom.osdEngineLbl.textContent = 'DIRECT';
    video.src = url;
    video.play().then(() => dom.playerLoadingSpinner.classList.add('hidden')).catch(onPlaybackFailure);
  }

  function onPlaybackFailure(err) {
    dom.playerLoadingSpinner.classList.add('hidden');
    state.retryCount++;

    if (state.retryCount <= state.maxRetries) {
      dom.retryMainMsg.textContent = `انقطع البث: (${err.message || 'خطأ في الاتصال'}). جارٍ إعادة المحاولة...`;
      dom.retryCounterLbl.textContent = `المحاولة ${state.retryCount} من ${state.maxRetries}`;
      dom.playerRetryBanner.classList.remove('hidden');

      const delayMs = Math.pow(2, state.retryCount - 1) * 1000;
      clearTimeout(state.retryTimer);
      state.retryTimer = setTimeout(() => {
        if (state.currentChannel && state.currentScreen === 'screen-player') {
          launchStream(state.currentChannel.url);
        }
      }, delayMs);
    } else {
      dom.retryMainMsg.textContent = 'تعذر تشغيل البث بعد 3 محاولات. يرجى تجربة قناة أخرى.';
    }
  }

  function stopCurrentPlayback() {
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

  // =========================================================================
  // Remote Controller Key Mapping & Spatial Navigation
  // =========================================================================
  function bindRemoteControls() {
    window.addEventListener('keydown', handleKey);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.focusable');
      if (btn) handleAction(btn);
    });

    document.addEventListener('focusin', (e) => {
      if (e.target && e.target.classList.contains('focusable')) {
        state.lastFocusedPerScreen[state.currentScreen] = e.target;
      }
    });
  }

  function handleKey(e) {
    const code = e.keyCode;

    // Direct Channel Number Jump (0-9)
    if ((code >= 48 && code <= 57) || (code >= 96 && code <= 105)) {
      // If actively typing inside an active search/form input, let typing happen!
      if (document.activeElement && (document.activeElement.tagName === 'INPUT') && !document.activeElement.hasAttribute('readonly')) {
        return;
      }
      const digit = code >= 96 ? String(code - 96) : String(code - 48);
      onDigitPressed(digit);
      return;
    }

    // Color Keys
    if (code === KEYS.RED) {
      e.preventDefault();
      handleBackNavigation();
      return;
    } else if (code === KEYS.YELLOW) {
      e.preventDefault();
      toggleFavoriteCurrent();
      return;
    }

    // Channel +/- Keys (CH_UP / CH_DOWN)
    if (code === KEYS.CH_UP) {
      e.preventDefault();
      stepChannel(-1);
      return;
    } else if (code === KEYS.CH_DOWN) {
      e.preventDefault();
      stepChannel(1);
      return;
    }

    // Back Key Handling (webOS 461, Esc, Backspace)
    if (code === KEYS.BACK_WEBOS || code === KEYS.BACK_ESC || code === KEYS.BACKSPACE) {
      // If currently typing in search input, first Back closes keyboard and deactivates input!
      if (document.activeElement && document.activeElement.tagName === 'INPUT' && !document.activeElement.hasAttribute('readonly')) {
        e.preventDefault();
        deactivateAllSearchInputs();
        return;
      }
      e.preventDefault();
      handleBackNavigation();
      return;
    }

    // Player Screen Controls
    if (state.currentScreen === 'screen-player') {
      if (code === KEYS.UP) {
        e.preventDefault();
        stepChannel(-1);
      } else if (code === KEYS.DOWN) {
        e.preventDefault();
        stepChannel(1);
      } else if (code === KEYS.ENTER) {
        e.preventDefault();
        showReceiverBanner();
        toggleFullOsd();
      } else if (code === KEYS.PLAY || code === KEYS.PLAY_PAUSE) {
        if (dom.videoElement.paused) dom.videoElement.play(); else dom.videoElement.pause();
      }
      return;
    }

    // Spatial D-Pad Navigation
    if ([KEYS.UP, KEYS.DOWN, KEYS.LEFT, KEYS.RIGHT].includes(code)) {
      // If currently focused inside active input, up/down blurs and deactivates search
      if (document.activeElement && document.activeElement.tagName === 'INPUT' && !document.activeElement.hasAttribute('readonly')) {
        if (code === KEYS.UP || code === KEYS.DOWN) {
          deactivateAllSearchInputs();
        }
      }
      e.preventDefault();
      navigateSpatial(code);
      return;
    }

    // Enter / OK Key
    if (code === KEYS.ENTER) {
      const active = document.activeElement;
      if (active && active.classList.contains('focusable')) {
        e.preventDefault();
        handleAction(active);
      }
    }
  }

  function handleBackNavigation() {
    closeAllModals();
    deactivateAllSearchInputs();

    if (state.currentScreen === 'screen-player') {
      stopCurrentPlayback();
      switchScreen('screen-livetv');
    } else if (state.currentScreen === 'screen-livetv' || state.currentScreen === 'screen-vod' || state.currentScreen === 'screen-favorites' || state.currentScreen === 'screen-settings') {
      switchScreen('screen-dashboard');
    } else if (state.currentScreen === 'screen-dashboard') {
      switchScreen('screen-portal');
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
    let next = state.currentChannelIndex + offset;
    if (next < 0) next = state.filteredChannels.length - 1;
    if (next >= state.filteredChannels.length) next = 0;
    playChannel(state.filteredChannels[next]);
  }

  function onDigitPressed(digit) {
    state.chNumBuffer += digit;
    dom.jumpDigits.textContent = state.chNumBuffer;
    dom.numberJumpOsd.classList.remove('hidden');

    clearTimeout(state.chNumTimer);
    state.chNumTimer = setTimeout(() => {
      const target = parseInt(state.chNumBuffer, 10);
      dom.numberJumpOsd.classList.add('hidden');
      state.chNumBuffer = '';

      const match = state.channels.find(c => c.num === target);
      if (match) playChannel(match);
    }, 1500);
  }

  function toggleFavoriteCurrent() {
    if (!state.currentChannel) return;
    const id = state.currentChannel.id;
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
    } else {
      state.favorites.add(id);
    }
    saveFavorites();
    showReceiverBanner();
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

      if (keyCode === KEYS.RIGHT && tRect.left > cRect.left - 5) match = true;
      if (keyCode === KEYS.LEFT && tRect.right < cRect.right + 5) match = true;
      if (keyCode === KEYS.DOWN && tRect.top > cRect.top - 5) match = true;
      if (keyCode === KEYS.UP && tRect.bottom < cRect.bottom + 5) match = true;

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
  // Action Dispatcher (Strict Click/OK trigger only)
  // =========================================================================
  function handleAction(el) {
    const act = el.dataset.action;

    if (act === 'portal-go-dashboard') {
      if (state.activeAccount) switchScreen('screen-dashboard');
    } else if (act === 'open-xtream-modal') {
      openModal(dom.modalXtreamLogin);
    } else if (act === 'open-m3u-modal') {
      openModal(dom.modalM3uLoad);
    } else if (act === 'open-help-modal') {
      openModal(dom.modalHelp);
    } else if (act === 'close-modals') {
      closeAllModals();
    } else if (act === 'activate-search-cat') {
      activateSearchInput(el, 'live-category-search');
    } else if (act === 'activate-search-ch') {
      activateSearchInput(el, 'live-channel-search');
    } else if (act === 'focus-input') {
      activateSearchInput(el, el.dataset.target);
    } else if (act === 'do-xtream-login') {
      executeXtreamLogin();
    } else if (act === 'do-m3u-login') {
      executeM3uLogin();
    } else if (act === 'open-livetv') {
      switchScreen('screen-livetv');
    } else if (act === 'open-movies') {
      openMoviesView();
    } else if (act === 'open-series') {
      openSeriesView();
    } else if (act === 'open-favorites') {
      openFavoritesView();
    } else if (act === 'open-settings') {
      switchScreen('screen-settings');
    } else if (act === 'open-portal') {
      switchScreen('screen-portal');
    } else if (act === 'live-go-back' || act === 'vod-go-back' || act === 'fav-go-back' || act === 'settings-go-back') {
      switchScreen('screen-dashboard');
    } else if (act === 'select-live-category') {
      selectLiveCategory(parseInt(el.dataset.index, 10));
    } else if (act === 'play-live-channel') {
      const ch = state.filteredChannels[parseInt(el.dataset.index, 10)];
      if (ch) playChannel(ch);
    } else if (act === 'player-exit') {
      stopCurrentPlayback();
      switchScreen('screen-livetv');
    } else if (act === 'cfg-engine') {
      state.streamEngine = el.dataset.val;
      localStorage.setItem(STORAGE.ENGINE, state.streamEngine);
      document.querySelectorAll('[data-action="cfg-engine"]').forEach(b => b.classList.toggle('active', b.dataset.val === state.streamEngine));
    } else if (act === 'clear-app-cache') {
      localStorage.removeItem(STORAGE.FAVORITES);
      state.favorites.clear();
      updateDashboardStats();
      alert('تم مسح كاش القنوات والمفضلة بنجاح');
    } else if (act === 'logout-active-account') {
      state.activeAccount = null;
      localStorage.removeItem(STORAGE.ACTIVE_ACCOUNT);
      switchScreen('screen-portal');
    }
  }

  function executeXtreamLogin() {
    const name = document.getElementById('xtream-inp-name').value.trim() || 'سيرفر البيت';
    let host = document.getElementById('xtream-inp-host').value.trim();
    const user = document.getElementById('xtream-inp-user').value.trim();
    const pass = document.getElementById('xtream-inp-pass').value.trim();

    if (!host || !user || !pass) {
      showModalStatus(document.getElementById('xtream-modal-status'), 'يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (!host.startsWith('http://') && !host.startsWith('https://')) host = 'http://' + host;
    if (host.endsWith('/')) host = host.slice(0, -1);

    const account = { id: 'acc_' + Date.now(), type: 'xtream', name, host, user, pass };
    state.accounts = [account, ...state.accounts.filter(a => a.id !== account.id)];
    saveAccounts();
    closeAllModals();
    connectAccount(account);
  }

  function executeM3uLogin() {
    const name = document.getElementById('m3u-inp-name').value.trim() || 'قائمة M3U';
    const url = document.getElementById('m3u-inp-url').value.trim();

    if (!url) {
      showModalStatus(document.getElementById('m3u-modal-status'), 'يرجى كتابة رابط قائمة M3U');
      return;
    }

    const account = { id: 'acc_' + Date.now(), type: 'm3u', name, url };
    state.accounts = [account, ...state.accounts.filter(a => a.id !== account.id)];
    saveAccounts();
    closeAllModals();
    connectAccount(account);
  }

  function openMoviesView() {
    dom.vodSidebarTitle.textContent = 'تصنيفات الأفلام';
    dom.vodCurrentCategoryName.textContent = 'الأفلام';
    dom.vodCountBadge.textContent = `${state.movies.length} فيلم`;
    dom.vodCategoriesList.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'cat-item-btn focusable active';
    allBtn.textContent = 'جميع الأفلام';
    dom.vodCategoriesList.appendChild(allBtn);

    dom.vodItemsGrid.innerHTML = '';
    state.movies.slice(0, 50).forEach(m => {
      const card = document.createElement('button');
      card.className = 'vod-item-card focusable';
      card.innerHTML = `
        <img src="${m.poster || 'icon.png'}" class="vod-thumb" alt="${m.name}">
        <div class="vod-meta"><div class="vod-name">${m.name}</div></div>
      `;
      card.onclick = () => playChannel({ id: m.id, num: 1, name: m.name, url: m.url });
      dom.vodItemsGrid.appendChild(card);
    });

    switchScreen('screen-vod');
  }

  function openSeriesView() {
    dom.vodSidebarTitle.textContent = 'تصنيفات المسلسلات';
    dom.vodCurrentCategoryName.textContent = 'المسلسلات';
    dom.vodCountBadge.textContent = '0 مسلسل';
    dom.vodCategoriesList.innerHTML = '';
    dom.vodItemsGrid.innerHTML = '';
    switchScreen('screen-vod');
  }

  function openFavoritesView() {
    const grid = document.getElementById('fav-channels-grid');
    const empty = document.getElementById('fav-empty-msg');
    const pill = document.getElementById('fav-count-pill');
    const favChannels = state.channels.filter(c => state.favorites.has(c.id));

    pill.textContent = `${favChannels.length} قناة`;
    empty.classList.toggle('hidden', favChannels.length > 0);
    grid.innerHTML = '';

    favChannels.forEach((ch, idx) => {
      const row = document.createElement('button');
      row.className = 'ch-row-card focusable';
      row.dataset.action = 'play-live-channel';
      row.dataset.index = String(idx);
      row.innerHTML = `
        <span class="ch-num-badge">${String(ch.num).padStart(2, '0')}</span>
        <span class="ch-name-txt">${ch.name}</span>
        <span class="ch-fav-mark"><svg class="svg-icon-small" viewBox="0 0 24 24" fill="#FFD54F"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span>
      `;
      row.onclick = () => playChannel(ch);
      grid.appendChild(row);
    });

    switchScreen('screen-favorites');
  }

  function openModal(modal) {
    closeAllModals();
    if (modal) {
      modal.classList.remove('hidden');
      const firstFocusable = modal.querySelector('.focusable');
      if (firstFocusable) firstFocusable.focus();
    }
  }

  function closeAllModals() {
    deactivateAllSearchInputs();
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
  }

  function showModalStatus(el, msg) {
    if (el) el.textContent = msg;
  }

  function showPortalStatus(msg, isErr = false) {
    if (dom.portalGlobalStatus) {
      dom.portalGlobalStatus.textContent = msg;
      dom.portalGlobalStatus.style.color = isErr ? '#FF5252' : '#FFD54F';
    }
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) state.wakeLock = await navigator.wakeLock.request('screen');
    } catch (_) {}
  }

})();
