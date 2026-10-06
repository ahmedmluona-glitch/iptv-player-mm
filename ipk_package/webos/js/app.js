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
    PLAY_PAUSE: 402,
    FAST_FWD: 417,
    REWIND: 412
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
    filteredSeries: [],
    currentSeriesDetail: null,
    selectedSeasonNumber: 1,
    favorites: new Set(),
    history: [],
    
    selectedCategoryIndex: -1,
    selectedVodCategoryIndex: -1,
    vodViewType: 'movies', // 'movies' | 'series'
    currentChannel: null,
    currentChannelIndex: -1,
    
    // Media Playback State
    mediaType: 'live', // 'live' | 'vod' | 'episode'
    currentMedia: null, // { id, name, url, poster, category, plot, epgId, num }
    
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
    osdTimer: null,
    progressTimer: null,
    wakeLock: null,

    // Numerical Channel Jump (CH: 12 - )
    chNumBuffer: '',
    chNumTimer: null,

    // Modal & Navigation Focus Memory
    activeModal: null,
    previousFocusBeforeModal: null,
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
    bindInputBlurListeners();
    bindVideoPlayerEvents();
    requestWakeLock();

    // Splash Screen: 1.5s then route
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
    dom.screenSeriesDetail = document.getElementById('screen-series-detail');
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
    dom.vodContentSearch = document.getElementById('vod-content-search');

    // Series Detail Elements
    dom.seriesDetailTitle = document.getElementById('series-detail-title');
    dom.seriesDetailBadge = document.getElementById('series-detail-badge');
    dom.seriesDetailPoster = document.getElementById('series-detail-poster');
    dom.seriesDetailPlot = document.getElementById('series-detail-plot');
    dom.seriesSeasonsRow = document.getElementById('series-seasons-row');
    dom.seriesEpisodesGrid = document.getElementById('series-episodes-grid');

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
    dom.osdTypePill = document.getElementById('osd-type-pill');
    dom.osdEngineLbl = document.getElementById('osd-engine-lbl');
    dom.osdLiveClock = document.getElementById('osd-live-clock');
    dom.osdVodControls = document.getElementById('osd-vod-controls');
    dom.osdTimeCur = document.getElementById('osd-time-cur');
    dom.osdTimeDur = document.getElementById('osd-time-dur');
    dom.osdSeekbarFill = document.getElementById('osd-seekbar-fill');

    // Numerical Jump Box
    dom.numberJumpOsd = document.getElementById('number-jump-osd');
    dom.jumpDigits = document.getElementById('jump-digits');

    // Modals
    dom.modalXtreamLogin = document.getElementById('modal-xtream-login');
    dom.modalM3uLoad = document.getElementById('modal-m3u-load');
    dom.modalHelp = document.getElementById('modal-help');
    dom.modalAccounts = document.getElementById('modal-accounts');
    dom.accountsListContainer = document.getElementById('accounts-list-container');
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

    // Parallel fetch: Live, VOD, and Series
    const [liveCat, liveStreams, vodCat, vodStreams, serCat, serStreams] = await Promise.all([
      fetchJson(`${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_categories`).catch(() => []),
      fetchJson(`${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_streams`).catch(() => []),
      fetchJson(`${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_vod_categories`).catch(() => []),
      fetchJson(`${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_vod_streams`).catch(() => []),
      fetchJson(`${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_series_categories`).catch(() => []),
      fetchJson(`${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_series`).catch(() => [])
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

    state.seriesCategories = Array.isArray(serCat) ? serCat : [];
    state.series = (Array.isArray(serStreams) ? serStreams : []).map(s => ({
      id: String(s.series_id),
      name: s.name || 'مسلسل',
      categoryId: String(s.category_id),
      rating: s.rating || '',
      poster: s.cover || '',
      plot: s.plot || ''
    }));

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
    dom.liveCategoriesList.querySelectorAll('.cat-item-btn').forEach(b => {
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
    const slice = list.slice(0, 150);

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
  // VOD Movies & Series (Exact Replica of Android MoviesScreen & SeriesScreen)
  // =========================================================================
  function openMoviesView() {
    state.vodViewType = 'movies';
    dom.vodSidebarTitle.textContent = 'تصنيفات الأفلام';
    dom.vodCurrentCategoryName.textContent = 'جميع الأفلام';
    dom.vodCountBadge.textContent = `${state.movies.length} فيلم`;
    dom.vodCategoriesList.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'cat-item-btn focusable active';
    allBtn.dataset.action = 'select-vod-category';
    allBtn.dataset.index = '-1';
    allBtn.innerHTML = `<span>جميع الأفلام</span><span class="cat-count">${state.movies.length}</span>`;
    dom.vodCategoriesList.appendChild(allBtn);

    state.moviesCategories.forEach((cat, idx) => {
      const count = state.movies.filter(m => m.categoryId === String(cat.category_id)).length;
      const btn = document.createElement('button');
      btn.className = 'cat-item-btn focusable';
      btn.dataset.action = 'select-vod-category';
      btn.dataset.index = String(idx);
      btn.innerHTML = `<span>${cat.category_name}</span><span class="cat-count">${count}</span>`;
      dom.vodCategoriesList.appendChild(btn);
    });

    selectVodCategory(-1);
    switchScreen('screen-vod');
  }

  function openSeriesView() {
    state.vodViewType = 'series';
    dom.vodSidebarTitle.textContent = 'تصنيفات المسلسلات';
    dom.vodCurrentCategoryName.textContent = 'جميع المسلسلات';
    dom.vodCountBadge.textContent = `${state.series.length} مسلسل`;
    dom.vodCategoriesList.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'cat-item-btn focusable active';
    allBtn.dataset.action = 'select-vod-category';
    allBtn.dataset.index = '-1';
    allBtn.innerHTML = `<span>جميع المسلسلات</span><span class="cat-count">${state.series.length}</span>`;
    dom.vodCategoriesList.appendChild(allBtn);

    state.seriesCategories.forEach((cat, idx) => {
      const count = state.series.filter(s => s.categoryId === String(cat.category_id)).length;
      const btn = document.createElement('button');
      btn.className = 'cat-item-btn focusable';
      btn.dataset.action = 'select-vod-category';
      btn.dataset.index = String(idx);
      btn.innerHTML = `<span>${cat.category_name}</span><span class="cat-count">${count}</span>`;
      dom.vodCategoriesList.appendChild(btn);
    });

    selectVodCategory(-1);
    switchScreen('screen-vod');
  }

  function selectVodCategory(index) {
    state.selectedVodCategoryIndex = index;
    dom.vodCategoriesList.querySelectorAll('.cat-item-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.index, 10) === index);
    });

    if (state.vodViewType === 'movies') {
      if (index === -1) {
        state.filteredMovies = state.movies;
        dom.vodCurrentCategoryName.textContent = 'جميع الأفلام';
      } else {
        const cat = state.moviesCategories[index];
        if (cat) {
          state.filteredMovies = state.movies.filter(m => m.categoryId === String(cat.category_id));
          dom.vodCurrentCategoryName.textContent = cat.category_name;
        }
      }
      dom.vodCountBadge.textContent = `${state.filteredMovies.length} فيلم`;
      renderVodPostersGrid(state.filteredMovies);
    } else {
      if (index === -1) {
        state.filteredSeries = state.series;
        dom.vodCurrentCategoryName.textContent = 'جميع المسلسلات';
      } else {
        const cat = state.seriesCategories[index];
        if (cat) {
          state.filteredSeries = state.series.filter(s => s.categoryId === String(cat.category_id));
          dom.vodCurrentCategoryName.textContent = cat.category_name;
        }
      }
      dom.vodCountBadge.textContent = `${state.filteredSeries.length} مسلسل`;
      renderVodPostersGrid(state.filteredSeries);
    }
  }

  function renderVodPostersGrid(items) {
    dom.vodItemsGrid.innerHTML = '';
    const slice = items.slice(0, 100);

    slice.forEach(item => {
      const card = document.createElement('button');
      card.className = 'vod-item-card focusable';
      card.dataset.id = item.id;
      if (state.vodViewType === 'movies') {
        card.dataset.action = 'play-vod';
      } else {
        card.dataset.action = 'open-series-detail';
      }

      card.innerHTML = `
        <img src="${item.poster || 'icon.png'}" class="vod-thumb" alt="${item.name}" loading="lazy">
        <div class="vod-meta"><div class="vod-name">${item.name}</div></div>
      `;
      dom.vodItemsGrid.appendChild(card);
    });
  }

  // =========================================================================
  // Series Detail (Seasons & Episodes Viewer)
  // =========================================================================
  async function openSeriesDetail(seriesId) {
    const sItem = state.series.find(s => s.id === seriesId);
    if (!sItem) return;

    dom.seriesDetailTitle.textContent = sItem.name;
    dom.seriesDetailPoster.src = sItem.poster || 'icon.png';
    dom.seriesDetailPlot.textContent = sItem.plot || 'جارٍ تحميل حلقات ومواسم المسلسل...';
    dom.seriesDetailBadge.textContent = 'جارٍ التحميل...';
    dom.seriesSeasonsRow.innerHTML = '';
    dom.seriesEpisodesGrid.innerHTML = '';

    switchScreen('screen-series-detail');

    if (!state.activeAccount || state.activeAccount.type !== 'xtream') {
      dom.seriesDetailPlot.textContent = 'المسلسلات متوفرة لاشتراكات Xtream Codes فقط.';
      return;
    }

    try {
      const { host, user, pass } = state.activeAccount;
      const url = `${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_series_info&series_id=${encodeURIComponent(seriesId)}`;
      const data = await fetchJson(url);

      state.currentSeriesDetail = data;
      const seasons = (data && data.seasons) || [];
      const episodesObj = (data && data.episodes) || {};

      dom.seriesDetailPlot.textContent = (data.info && data.info.plot) || sItem.plot || 'لا يوجد وصف متاح.';
      const seasonCount = seasons.length || Object.keys(episodesObj).length;
      dom.seriesDetailBadge.textContent = `${seasonCount} مواسم`;

      // Render Seasons Pills
      dom.seriesSeasonsRow.innerHTML = '';
      const seasonNums = Object.keys(episodesObj).sort((a, b) => Number(a) - Number(b));

      seasonNums.forEach((sNum, idx) => {
        const btn = document.createElement('button');
        btn.className = `opt-pill focusable ${idx === 0 ? 'active' : ''}`;
        btn.dataset.action = 'select-series-season';
        btn.dataset.season = sNum;
        btn.textContent = `الموسم ${sNum}`;
        dom.seriesSeasonsRow.appendChild(btn);
      });

      const firstSeason = seasonNums[0] || '1';
      state.selectedSeasonNumber = firstSeason;
      renderSeriesEpisodes(firstSeason);
    } catch (err) {
      dom.seriesDetailPlot.textContent = 'تعذر تحميل بيانات المسلسل: ' + err.message;
    }
  }

  function renderSeriesEpisodes(seasonNum) {
    dom.seriesEpisodesGrid.innerHTML = '';
    if (!state.currentSeriesDetail || !state.currentSeriesDetail.episodes) return;
    const epList = state.currentSeriesDetail.episodes[seasonNum] || [];

    epList.forEach(ep => {
      const card = document.createElement('button');
      card.className = 'vod-item-card focusable';
      card.dataset.action = 'play-series-episode';
      card.dataset.id = ep.id;
      card.dataset.num = ep.episode_num;
      card.dataset.ext = ep.container_extension || 'mp4';
      card.dataset.title = ep.title || `حلقة ${ep.episode_num}`;

      card.innerHTML = `
        <div style="height: 80px; background: rgba(0,230,118,0.12); display: flex; align-items: center; justify-content: center;">
          <svg class="svg-icon-small" viewBox="0 0 24 24" fill="#00E676"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </div>
        <div class="vod-meta">
          <div class="vod-name">${ep.title || `الحلقة ${ep.episode_num}`}</div>
        </div>
      `;
      dom.seriesEpisodesGrid.appendChild(card);
    });
  }

  // =========================================================================
  // Favorites View
  // =========================================================================
  function openFavoritesView() {
    const grid = document.getElementById('fav-channels-grid');
    const empty = document.getElementById('fav-empty-msg');
    const pill = document.getElementById('fav-count-pill');
    const favChannels = state.channels.filter(c => state.favorites.has(c.id));

    pill.textContent = `${favChannels.length} قناة`;
    empty.classList.toggle('hidden', favChannels.length > 0);
    grid.innerHTML = '';

    favChannels.forEach((ch) => {
      const row = document.createElement('button');
      row.className = 'ch-row-card focusable';
      row.dataset.action = 'play-favorite-channel';
      row.dataset.id = ch.id;
      row.innerHTML = `
        <span class="ch-num-badge">${String(ch.num).padStart(2, '0')}</span>
        <span class="ch-name-txt">${ch.name}</span>
        <span class="ch-fav-mark"><svg class="svg-icon-small" viewBox="0 0 24 24" fill="#FFD54F"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span>
      `;
      grid.appendChild(row);
    });

    switchScreen('screen-favorites');
  }

  // =========================================================================
  // Accounts Switcher Modal
  // =========================================================================
  function openAccountsModal() {
    dom.accountsListContainer.innerHTML = '';
    if (!state.accounts.length) {
      dom.accountsListContainer.innerHTML = '<p style="text-align:center; color: var(--color-text-muted); padding: 20px;">لا توجد حسابات محفوظة</p>';
    } else {
      state.accounts.forEach(acc => {
        const isActive = state.activeAccount && state.activeAccount.id === acc.id;
        const card = document.createElement('button');
        card.className = `account-item-card focusable ${isActive ? 'active' : ''}`;
        card.dataset.action = 'switch-account';
        card.dataset.id = acc.id;
        card.innerHTML = `
          <div class="acc-info-box">
            <span class="acc-title">${acc.name}</span>
            <span class="acc-subtitle">${acc.type === 'xtream' ? acc.host : 'M3U Playlist'}</span>
          </div>
          <span class="acc-badge">${isActive ? 'نشط' : 'اختيار'}</span>
        `;
        dom.accountsListContainer.appendChild(card);
      });
    }
    openModal(dom.modalAccounts);
  }

  // =========================================================================
  // Playback Engine (Live TV, VOD Movie, Series Episode)
  // =========================================================================
  function playChannel(channel) {
    if (!channel) return;
    state.mediaType = 'live';
    state.currentChannel = channel;
    state.currentChannelIndex = state.filteredChannels.findIndex(c => c.id === channel.id);
    state.currentMedia = {
      id: channel.id,
      name: channel.name,
      url: channel.url,
      category: dom.liveCurrentCategoryName.textContent || 'باقة القنوات',
      epgId: channel.epgId || 'البث الحي المباشر',
      num: channel.num
    };

    switchScreen('screen-player');

    // Receiver Banner
    dom.recChannelNum.textContent = String(channel.num).padStart(2, '0');
    dom.recChannelName.textContent = channel.name;
    dom.recProgramName.textContent = channel.epgId || 'البث الحي المباشر';

    // Full OSD
    dom.osdMediaTitle.textContent = channel.name;
    dom.osdCategorySub.textContent = state.currentMedia.category;
    dom.osdTypePill.textContent = 'LIVE';
    dom.osdTypePill.classList.add('neon');
    dom.osdVodControls.classList.add('hidden');

    showReceiverBanner();
    state.retryCount = 0;
    launchStream(channel.url);
  }

  function playVodMovie(movie) {
    if (!movie) return;
    state.mediaType = 'vod';
    state.currentChannel = null;
    state.currentMedia = {
      id: movie.id,
      name: movie.name,
      url: movie.url,
      category: 'الأفلام'
    };

    switchScreen('screen-player');

    // Update Full OSD
    dom.osdMediaTitle.textContent = movie.name;
    dom.osdCategorySub.textContent = 'أفلام VOD';
    dom.osdTypePill.textContent = 'MOVIE';
    dom.osdTypePill.classList.remove('neon');
    dom.osdVodControls.classList.remove('hidden');

    dom.playerReceiverBanner.classList.add('hidden');
    showFullOsd();
    state.retryCount = 0;
    launchStream(movie.url);
  }

  function playSeriesEpisode(ep, seriesTitle, streamUrl) {
    state.mediaType = 'episode';
    state.currentChannel = null;
    state.currentMedia = {
      id: ep.id,
      name: `${seriesTitle} - ${ep.title}`,
      url: streamUrl,
      category: 'المسلسلات'
    };

    switchScreen('screen-player');

    dom.osdMediaTitle.textContent = state.currentMedia.name;
    dom.osdCategorySub.textContent = 'مسلسلات Series';
    dom.osdTypePill.textContent = 'SERIES';
    dom.osdTypePill.classList.remove('neon');
    dom.osdVodControls.classList.remove('hidden');

    dom.playerReceiverBanner.classList.add('hidden');
    showFullOsd();
    state.retryCount = 0;
    launchStream(streamUrl);
  }

  function showReceiverBanner() {
    if (state.mediaType !== 'live') return;
    dom.playerReceiverBanner.classList.remove('hidden');
    clearTimeout(state.receiverBarTimer);
    state.receiverBarTimer = setTimeout(() => {
      dom.playerReceiverBanner.classList.add('hidden');
    }, 3500);
  }

  function showFullOsd() {
    dom.playerFullOsd.classList.remove('hidden');
    clearTimeout(state.osdTimer);
    state.osdTimer = setTimeout(() => {
      dom.playerFullOsd.classList.add('hidden');
    }, 4500);

    // If VOD/Episode, focus play/pause button
    if (state.mediaType !== 'live') {
      const playBtn = document.getElementById('btn-play-pause');
      if (playBtn) playBtn.focus();
    }
  }

  function toggleFullOsd() {
    const isHidden = dom.playerFullOsd.classList.contains('hidden');
    if (isHidden) {
      showFullOsd();
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
      state.hlsPlayer = new Hls({ enableWorker: true, lowLatencyMode: state.mediaType === 'live' });
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
      state.mpegtsPlayer = mpegts.createPlayer({ type: 'mse', isLive: state.mediaType === 'live', url });
      state.mpegtsPlayer.attachMediaElement(video);
      state.mpegtsPlayer.load();
      state.mpegtsPlayer.play().then(() => dom.playerLoadingSpinner.classList.add('hidden')).catch(onPlaybackFailure);
      return;
    }

    // Fallback direct
    dom.osdEngineLbl.textContent = 'DIRECT';
    video.src = url;
    video.play().then(() => dom.playerLoadingSpinner.classList.add('hidden')).catch(onPlaybackFailure);
  }

  function bindVideoPlayerEvents() {
    const video = dom.videoElement;
    if (!video) return;

    video.addEventListener('timeupdate', () => {
      if (state.mediaType === 'live') return;
      const cur = video.currentTime || 0;
      const dur = video.duration || 0;
      if (dom.osdTimeCur) dom.osdTimeCur.textContent = formatDuration(cur);
      if (dom.osdTimeDur) dom.osdTimeDur.textContent = formatDuration(dur);
      if (dom.osdSeekbarFill && dur > 0) {
        dom.osdSeekbarFill.style.width = `${(cur / dur) * 100}%`;
      }
    });

    video.addEventListener('playing', () => {
      dom.playerLoadingSpinner.classList.add('hidden');
    });

    video.addEventListener('waiting', () => {
      dom.playerLoadingSpinner.classList.remove('hidden');
    });
  }

  function formatDuration(sec) {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
        if (state.currentMedia && state.currentScreen === 'screen-player') {
          launchStream(state.currentMedia.url);
        }
      }, delayMs);
    } else {
      dom.retryMainMsg.textContent = 'تعذر تشغيل البث بعد 3 محاولات.';
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

    // --- CASE A: Actively editing inside an input (Virtual Keyboard open) ---
    if (isEditingInput()) {
      // BACKSPACE (8): Let browser delete character naturally!
      if (code === KEYS.BACKSPACE) {
        return;
      }

      // BACK (webOS 461, Esc 27): Dismiss virtual keyboard and return focus to wrapper button
      if (code === KEYS.BACK_WEBOS || code === KEYS.BACK_ESC) {
        e.preventDefault();
        deactivateAllSearchInputs();
        return;
      }

      // ENTER (13): Commit text and advance focus
      if (code === KEYS.ENTER) {
        e.preventDefault();
        const curInput = document.activeElement;
        const wrapper = curInput ? curInput.closest('.tv-search-wrapper, .modal-inp-wrapper') : null;
        deactivateAllSearchInputs();

        if (wrapper && wrapper.classList.contains('modal-inp-wrapper')) {
          const nextTargetSelector = wrapper.getAttribute('data-nav-down');
          if (nextTargetSelector) {
            const nextTarget = document.querySelector(nextTargetSelector);
            if (nextTarget) {
              nextTarget.focus();
              return;
            }
          }
        }
        if (wrapper) wrapper.focus();
        return;
      }

      // UP or DOWN arrow: dismiss editing and navigate
      if (code === KEYS.UP || code === KEYS.DOWN) {
        e.preventDefault();
        const wrapper = document.activeElement.closest('.tv-search-wrapper, .modal-inp-wrapper');
        deactivateAllSearchInputs();
        if (wrapper) {
          wrapper.focus();
          navigateSpatial(code);
        }
        return;
      }

      return;
    }

    // --- CASE B: Normal Remote Navigation (Not editing input) ---

    // 1. Direct Channel Number Jump (0-9) - only in Live TV or Player
    if ((code >= 48 && code <= 57) || (code >= 96 && code <= 105)) {
      if ((state.currentScreen === 'screen-livetv' || state.currentScreen === 'screen-player') && state.mediaType === 'live') {
        const digit = code >= 96 ? String(code - 96) : String(code - 48);
        onDigitPressed(digit);
        return;
      }
    }

    // 2. Color Keys
    if (code === KEYS.RED) {
      e.preventDefault();
      handleBackNavigation();
      return;
    } else if (code === KEYS.YELLOW) {
      e.preventDefault();
      toggleFavoriteCurrent();
      return;
    }

    // 3. Channel +/- Keys (CH_UP / CH_DOWN)
    if (code === KEYS.CH_UP) {
      e.preventDefault();
      if (state.mediaType === 'live') stepChannel(-1);
      return;
    } else if (code === KEYS.CH_DOWN) {
      e.preventDefault();
      if (state.mediaType === 'live') stepChannel(1);
      return;
    }

    // 4. Back Key Handling (webOS 461, Esc, Backspace when not editing)
    if (code === KEYS.BACK_WEBOS || code === KEYS.BACK_ESC || code === KEYS.BACKSPACE) {
      e.preventDefault();
      if (state.activeModal) {
        closeAllModals();
        return;
      }
      handleBackNavigation();
      return;
    }

    // 5. Dedicated Player Controls
    if (state.currentScreen === 'screen-player') {
      const isOsdVisible = !dom.playerFullOsd.classList.contains('hidden');

      if (code === KEYS.ENTER) {
        // If an OSD button is already focused, let normal action trigger
        const active = document.activeElement;
        if (isOsdVisible && active && active.closest('#player-full-osd')) {
          e.preventDefault();
          handleAction(active);
          return;
        }
        e.preventDefault();
        if (state.mediaType === 'live') {
          showReceiverBanner();
          toggleFullOsd();
        } else {
          toggleFullOsd();
        }
        return;
      }

      if (code === KEYS.PLAY || code === KEYS.PAUSE || code === KEYS.PLAY_PAUSE) {
        e.preventDefault();
        togglePlayPause();
        return;
      }

      if (code === KEYS.FAST_FWD) {
        e.preventDefault();
        seekDelta(10);
        return;
      } else if (code === KEYS.REWIND) {
        e.preventDefault();
        seekDelta(-10);
        return;
      }

      // If Live TV and OSD is NOT visible: UP/DOWN steps channel
      if (state.mediaType === 'live' && !isOsdVisible) {
        if (code === KEYS.UP) {
          e.preventDefault();
          stepChannel(-1);
          return;
        } else if (code === KEYS.DOWN) {
          e.preventDefault();
          stepChannel(1);
          return;
        }
      }
    }

    // 6. Spatial D-Pad Navigation
    if ([KEYS.UP, KEYS.DOWN, KEYS.LEFT, KEYS.RIGHT].includes(code)) {
      e.preventDefault();
      navigateSpatial(code);
      return;
    }

    // 7. Enter / OK Key
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
      if (state.mediaType === 'live') {
        switchScreen('screen-livetv');
      } else if (state.mediaType === 'episode') {
        switchScreen('screen-series-detail');
      } else {
        switchScreen('screen-vod');
      }
    } else if (state.currentScreen === 'screen-series-detail') {
      switchScreen('screen-vod');
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

  function togglePlayPause() {
    const video = dom.videoElement;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
    showFullOsd();
  }

  function seekDelta(seconds) {
    const video = dom.videoElement;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, video.duration || Infinity));
    showFullOsd();
  }

  // =========================================================================
  // Spatial Navigation Engine
  // =========================================================================
  function navigateSpatial(keyCode) {
    const current = document.activeElement;

    // --- 1. Focus Trap inside Active Modal ---
    if (state.activeModal) {
      const modalFocusables = Array.from(state.activeModal.querySelectorAll('.focusable:not([disabled])'))
        .filter(el => el.offsetParent !== null);
      if (!modalFocusables.length) return;

      if (!modalFocusables.includes(current)) {
        modalFocusables[0].focus();
        return;
      }

      const navAttr = {
        [KEYS.UP]: 'data-nav-up',
        [KEYS.DOWN]: 'data-nav-down',
        [KEYS.LEFT]: 'data-nav-left',
        [KEYS.RIGHT]: 'data-nav-right'
      }[keyCode];

      if (current && current.hasAttribute(navAttr)) {
        const target = state.activeModal.querySelector(current.getAttribute(navAttr));
        if (target && target.offsetParent !== null) {
          target.focus();
          return;
        }
      }

      // Linear fallback inside modal
      const idx = modalFocusables.indexOf(current);
      if (keyCode === KEYS.DOWN) {
        const next = Math.min(idx + 1, modalFocusables.length - 1);
        modalFocusables[next].focus();
      } else if (keyCode === KEYS.UP) {
        const prev = Math.max(idx - 1, 0);
        modalFocusables[prev].focus();
      }
      return;
    }

    // --- 2. Normal Screen Navigation ---
    const activeScreen = document.querySelector('.screen.active');
    if (!activeScreen) return;

    // Inside Player with OSD visible: navigate only within visible OSD elements
    if (state.currentScreen === 'screen-player') {
      const isOsdVisible = !dom.playerFullOsd.classList.contains('hidden');
      if (isOsdVisible) {
        const osdFocusables = Array.from(dom.playerFullOsd.querySelectorAll('.focusable:not([disabled])'))
          .filter(el => el.offsetParent !== null);
        if (osdFocusables.length) {
          if (!osdFocusables.includes(current)) {
            osdFocusables[0].focus();
            return;
          }
          const navAttr = {
            [KEYS.UP]: 'data-nav-up',
            [KEYS.DOWN]: 'data-nav-down',
            [KEYS.LEFT]: 'data-nav-left',
            [KEYS.RIGHT]: 'data-nav-right'
          }[keyCode];
          if (current.hasAttribute(navAttr)) {
            const target = dom.playerFullOsd.querySelector(current.getAttribute(navAttr));
            if (target && target.offsetParent !== null) {
              target.focus();
              return;
            }
          }
        }
      }
    }

    const focusables = Array.from(activeScreen.querySelectorAll('.focusable:not([disabled])'))
      .filter(el => el.offsetParent !== null);

    if (!focusables.length) return;

    if (!focusables.includes(current)) {
      focusables[0].focus();
      return;
    }

    // Top priority: explicit data-nav attribute
    const navAttr = {
      [KEYS.UP]: 'data-nav-up',
      [KEYS.DOWN]: 'data-nav-down',
      [KEYS.LEFT]: 'data-nav-left',
      [KEYS.RIGHT]: 'data-nav-right'
    }[keyCode];

    if (current && current.hasAttribute(navAttr)) {
      const sel = current.getAttribute(navAttr);
      const target = activeScreen.querySelector(sel) || document.querySelector(sel);
      if (target && target.offsetParent !== null) {
        target.focus();
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return;
      }
    }

    // Structured Layout Rule for Live TV
    if (state.currentScreen === 'screen-livetv') {
      const inCatCol = current.closest('.live-categories-col');
      const inChCol = current.closest('.live-channels-col');

      if (inCatCol) {
        if (keyCode === KEYS.LEFT) {
          const activeCh = activeScreen.querySelector('.channels-linear-list .ch-row-card.active') ||
                           activeScreen.querySelector('.channels-linear-list .ch-row-card') ||
                           document.getElementById('wrap-search-ch');
          if (activeCh) {
            activeCh.focus();
            activeCh.scrollIntoView({ block: 'nearest' });
            return;
          }
        } else if (keyCode === KEYS.UP || keyCode === KEYS.DOWN) {
          const catFocusables = Array.from(inCatCol.querySelectorAll('.focusable:not([disabled])'))
            .filter(el => el.offsetParent !== null);
          const idx = catFocusables.indexOf(current);
          if (keyCode === KEYS.DOWN && idx + 1 < catFocusables.length) {
            catFocusables[idx + 1].focus();
            catFocusables[idx + 1].scrollIntoView({ block: 'nearest' });
            return;
          } else if (keyCode === KEYS.UP && idx > 0) {
            catFocusables[idx - 1].focus();
            catFocusables[idx - 1].scrollIntoView({ block: 'nearest' });
            return;
          }
          return;
        }
      } else if (inChCol) {
        if (keyCode === KEYS.RIGHT) {
          const activeCat = activeScreen.querySelector('.scroll-v-list .cat-item-btn.active') ||
                            activeScreen.querySelector('.scroll-v-list .cat-item-btn') ||
                            document.getElementById('wrap-search-cat');
          if (activeCat) {
            activeCat.focus();
            activeCat.scrollIntoView({ block: 'nearest' });
            return;
          }
        } else if (keyCode === KEYS.UP || keyCode === KEYS.DOWN) {
          const chFocusables = Array.from(inChCol.querySelectorAll('.focusable:not([disabled])'))
            .filter(el => el.offsetParent !== null);
          const idx = chFocusables.indexOf(current);
          if (keyCode === KEYS.DOWN && idx + 1 < chFocusables.length) {
            chFocusables[idx + 1].focus();
            chFocusables[idx + 1].scrollIntoView({ block: 'nearest' });
            return;
          } else if (keyCode === KEYS.UP && idx > 0) {
            chFocusables[idx - 1].focus();
            chFocusables[idx - 1].scrollIntoView({ block: 'nearest' });
            return;
          }
          return;
        }
      }
    }

    // Structured Layout Rule for VOD
    if (state.currentScreen === 'screen-vod') {
      const inCatCol = current.closest('.live-categories-col');
      const inGrid = current.closest('.vod-posters-grid');

      if (inCatCol) {
        if (keyCode === KEYS.LEFT) {
          const firstCard = activeScreen.querySelector('.vod-item-card');
          if (firstCard) {
            firstCard.focus();
            firstCard.scrollIntoView({ block: 'nearest' });
            return;
          }
        }
      } else if (inGrid) {
        const cards = Array.from(inGrid.querySelectorAll('.vod-item-card'));
        const idx = cards.indexOf(current);
        if (idx !== -1) {
          const COLS = 5;
          if (keyCode === KEYS.RIGHT) {
            if (idx % COLS === 0) {
              const cat = activeScreen.querySelector('.scroll-v-list .cat-item-btn.active') ||
                          activeScreen.querySelector('.scroll-v-list .cat-item-btn') ||
                          document.getElementById('wrap-search-vod');
              if (cat) { cat.focus(); return; }
            } else if (idx > 0) {
              cards[idx - 1].focus();
              cards[idx - 1].scrollIntoView({ block: 'nearest' });
              return;
            }
          } else if (keyCode === KEYS.LEFT) {
            if ((idx + 1) % COLS !== 0 && idx + 1 < cards.length) {
              cards[idx + 1].focus();
              cards[idx + 1].scrollIntoView({ block: 'nearest' });
              return;
            }
          } else if (keyCode === KEYS.DOWN) {
            if (idx + COLS < cards.length) {
              cards[idx + COLS].focus();
              cards[idx + COLS].scrollIntoView({ block: 'nearest' });
              return;
            }
          } else if (keyCode === KEYS.UP) {
            if (idx - COLS >= 0) {
              cards[idx - COLS].focus();
              cards[idx - COLS].scrollIntoView({ block: 'nearest' });
              return;
            }
          }
        }
      }
    }

    // Strict Orthogonal Geometric Navigation Fallback
    const cRect = current.getBoundingClientRect();
    const cX = cRect.left + cRect.width / 2;
    const cY = cRect.top + cRect.height / 2;

    let best = null;
    let minScore = Infinity;

    focusables.forEach(t => {
      if (t === current) return;
      const tRect = t.getBoundingClientRect();
      const tX = tRect.left + tRect.width / 2;
      const tY = tRect.top + tRect.height / 2;

      const dx = tX - cX;
      const dy = tY - cY;

      let isValidDirection = false;
      let primaryDist = 0;
      let secondaryDist = 0;

      if (keyCode === KEYS.RIGHT) {
        if (dx > 5) {
          isValidDirection = true;
          primaryDist = dx;
          secondaryDist = Math.abs(dy);
        }
      } else if (keyCode === KEYS.LEFT) {
        if (dx < -5) {
          isValidDirection = true;
          primaryDist = -dx;
          secondaryDist = Math.abs(dy);
        }
      } else if (keyCode === KEYS.DOWN) {
        if (dy > 5) {
          isValidDirection = true;
          primaryDist = dy;
          secondaryDist = Math.abs(dx);
        }
      } else if (keyCode === KEYS.UP) {
        if (dy < -5) {
          isValidDirection = true;
          primaryDist = -dy;
          secondaryDist = Math.abs(dx);
        }
      }

      if (isValidDirection) {
        const score = primaryDist + 3.0 * secondaryDist;
        if (score < minScore) {
          minScore = score;
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
    } else if (act === 'open-accounts-modal') {
      openAccountsModal();
    } else if (act === 'close-modals') {
      closeAllModals();
    } else if (act === 'switch-account') {
      const id = el.dataset.id;
      const acc = state.accounts.find(a => a.id === id);
      if (acc) {
        closeAllModals();
        connectAccount(acc);
      }
    } else if (act === 'activate-search-cat') {
      activateSearchInput(el, 'live-category-search');
    } else if (act === 'activate-search-ch') {
      activateSearchInput(el, 'live-channel-search');
    } else if (act === 'activate-search-vod') {
      activateSearchInput(el, 'vod-content-search');
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
    } else if (act === 'series-detail-back') {
      switchScreen('screen-vod');
    } else if (act === 'select-live-category') {
      selectLiveCategory(parseInt(el.dataset.index, 10));
    } else if (act === 'select-vod-category') {
      selectVodCategory(parseInt(el.dataset.index, 10));
    } else if (act === 'play-live-channel') {
      const id = el.dataset.id;
      const ch = (id && state.channels.find(c => c.id === id)) ||
                 (id && state.filteredChannels.find(c => c.id === id)) ||
                 state.filteredChannels[parseInt(el.dataset.index, 10)];
      if (ch) playChannel(ch);
    } else if (act === 'play-favorite-channel') {
      const id = el.dataset.id;
      const ch = state.channels.find(c => c.id === id);
      if (ch) playChannel(ch);
    } else if (act === 'play-vod') {
      const id = el.dataset.id;
      const m = state.movies.find(item => item.id === id) || state.filteredMovies.find(item => item.id === id);
      if (m) playVodMovie(m);
    } else if (act === 'open-series-detail') {
      const id = el.dataset.id;
      openSeriesDetail(id);
    } else if (act === 'select-series-season') {
      const sNum = el.dataset.season;
      state.selectedSeasonNumber = sNum;
      dom.seriesSeasonsRow.querySelectorAll('.opt-pill').forEach(b => b.classList.toggle('active', b.dataset.season === sNum));
      renderSeriesEpisodes(sNum);
    } else if (act === 'play-series-episode') {
      if (!state.activeAccount) return;
      const { host, user, pass } = state.activeAccount;
      const epId = el.dataset.id;
      const ext = el.dataset.ext || 'mp4';
      const title = el.dataset.title || 'حلقة';
      const streamUrl = `${host}/series/${user}/${pass}/${epId}.${ext}`;
      playSeriesEpisode({ id: epId, title }, dom.seriesDetailTitle.textContent, streamUrl);
    } else if (act === 'player-exit') {
      handleBackNavigation();
    } else if (act === 'player-toggle-play') {
      togglePlayPause();
    } else if (act === 'player-rw10') {
      seekDelta(-10);
    } else if (act === 'player-ff10') {
      seekDelta(10);
    } else if (act === 'cfg-engine') {
      state.streamEngine = el.dataset.val;
      localStorage.setItem(STORAGE.ENGINE, state.streamEngine);
      document.querySelectorAll('[data-action="cfg-engine"]').forEach(b => b.classList.toggle('active', b.dataset.val === state.streamEngine));
    } else if (act === 'cfg-buffer') {
      state.bufferProfile = el.dataset.val;
      localStorage.setItem(STORAGE.BUFFER, state.bufferProfile);
      document.querySelectorAll('[data-action="cfg-buffer"]').forEach(b => b.classList.toggle('active', b.dataset.val === state.bufferProfile));
    } else if (act === 'cfg-lang') {
      state.language = el.dataset.val;
      localStorage.setItem(STORAGE.LANG, state.language);
      document.querySelectorAll('[data-action="cfg-lang"]').forEach(b => b.classList.toggle('active', b.dataset.val === state.language));
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

  // =========================================================================
  // Input Handling
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

        let basePool = state.channels;
        if (state.selectedCategoryIndex >= 0 && state.categories[state.selectedCategoryIndex]) {
          const cat = state.categories[state.selectedCategoryIndex];
          basePool = state.channels.filter(c => c.categoryId === String(cat.category_id));
        }

        let matches = basePool.filter(c => 
          c.name.toLowerCase().includes(query) || String(c.num) === query
        );

        if (!matches.length && state.selectedCategoryIndex >= 0) {
          matches = state.channels.filter(c => 
            c.name.toLowerCase().includes(query) || String(c.num) === query
          );
        }

        state.filteredChannels = matches;
        dom.liveChannelCountBadge.textContent = `${matches.length} قناة`;
        renderChannelsList(matches);
      });
    }

    if (dom.vodContentSearch) {
      dom.vodContentSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (state.vodViewType === 'movies') {
          if (!query) {
            selectVodCategory(state.selectedVodCategoryIndex);
            return;
          }
          let pool = state.movies;
          if (state.selectedVodCategoryIndex >= 0 && state.moviesCategories[state.selectedVodCategoryIndex]) {
            const cat = state.moviesCategories[state.selectedVodCategoryIndex];
            pool = state.movies.filter(m => m.categoryId === String(cat.category_id));
          }
          const matches = pool.filter(m => m.name.toLowerCase().includes(query));
          state.filteredMovies = matches;
          dom.vodCountBadge.textContent = `${matches.length} فيلم`;
          renderVodPostersGrid(matches);
        } else {
          if (!query) {
            selectVodCategory(state.selectedVodCategoryIndex);
            return;
          }
          let pool = state.series;
          if (state.selectedVodCategoryIndex >= 0 && state.seriesCategories[state.selectedVodCategoryIndex]) {
            const cat = state.seriesCategories[state.selectedVodCategoryIndex];
            pool = state.series.filter(s => s.categoryId === String(cat.category_id));
          }
          const matches = pool.filter(s => s.name.toLowerCase().includes(query));
          state.filteredSeries = matches;
          dom.vodCountBadge.textContent = `${matches.length} مسلسل`;
          renderVodPostersGrid(matches);
        }
      });
    }
  }

  function isEditingInput() {
    const active = document.activeElement;
    return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && !active.hasAttribute('readonly');
  }

  function activateSearchInput(wrapper, inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    wrapper.classList.add('typing');
    const modal = wrapper.closest('.modal-backdrop');
    if (modal) modal.classList.add('keyboard-active');

    input.removeAttribute('readonly');
    input.focus();
    const len = input.value.length;
    try { input.setSelectionRange(len, len); } catch (_) {}
  }

  function deactivateAllSearchInputs() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('keyboard-active'));
    document.querySelectorAll('.tv-search-wrapper, .modal-inp-wrapper').forEach(w => w.classList.remove('typing'));
    document.querySelectorAll('.tv-clean-input, .modal-input').forEach(i => {
      i.setAttribute('readonly', 'true');
    });
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      const parentWrapper = active.closest('.tv-search-wrapper, .modal-inp-wrapper');
      if (parentWrapper) {
        parentWrapper.focus();
      } else {
        active.blur();
      }
    }
  }

  function bindInputBlurListeners() {
    document.querySelectorAll('.tv-clean-input, .modal-input').forEach(inp => {
      inp.addEventListener('blur', () => {
        setTimeout(() => {
          if (document.activeElement !== inp) {
            inp.setAttribute('readonly', 'true');
            const wrapper = inp.closest('.tv-search-wrapper, .modal-inp-wrapper');
            if (wrapper) wrapper.classList.remove('typing');
            const modal = inp.closest('.modal-backdrop');
            if (modal) modal.classList.remove('keyboard-active');
          }
        }, 120);
      });
    });
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

  function openModal(modal) {
    if (!modal) return;
    deactivateAllSearchInputs();
    state.previousFocusBeforeModal = document.activeElement;
    state.activeModal = modal;
    
    document.querySelectorAll('.modal-backdrop').forEach(m => {
      if (m !== modal) m.classList.add('hidden');
    });
    modal.classList.remove('hidden');

    setTimeout(() => {
      const target = modal.querySelector('.modal-inp-wrapper.focusable') || modal.querySelector('.account-item-card.focusable') || modal.querySelector('.focusable');
      if (target) {
        target.focus();
      }
    }, 50);
  }

  function closeAllModals() {
    deactivateAllSearchInputs();
    const prev = state.previousFocusBeforeModal;
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
    state.activeModal = null;
    state.previousFocusBeforeModal = null;

    if (prev && document.body.contains(prev)) {
      setTimeout(() => {
        prev.focus();
      }, 50);
    }
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
