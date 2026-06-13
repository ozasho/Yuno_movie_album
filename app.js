const STORAGE_KEY = "childVideoAlbumStateV1";
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

const defaultTags = ["日常", "旅行", "誕生日", "食事", "遊び", "保育園", "成長記録", "初めて"];
const defaultBirthMonth = "2024-11";
const categoryRules = [
  {
    label: "旅行",
    keywords: ["旅行", "旅", "温泉", "ホテル", "旅館", "空港", "飛行機", "新幹線", "帰省", "遠出", "trip", "travel"],
  },
  {
    label: "食事",
    keywords: ["ごはん", "ご飯", "食事", "離乳食", "ミルク", "授乳", "おやつ", "ランチ", "朝食", "昼食", "夕食", "食べ", "飲み", "飲む"],
  },
  {
    label: "おでかけ",
    keywords: ["公園", "散歩", "お散歩", "おでかけ", "外出", "ドライブ", "買い物", "水族館", "動物園", "遊園地"],
  },
  {
    label: "保育園",
    keywords: ["保育園", "幼稚園", "入園", "園", "発表会", "運動会"],
  },
  {
    label: "誕生日",
    keywords: ["誕生日", "バースデー", "birthday", "ケーキ", "お祝い"],
  },
  {
    label: "成長",
    keywords: ["初めて", "はじめて", "寝返り", "ハイハイ", "はいはい", "つかまり立ち", "歩", "立っ", "しゃべ", "言葉", "成長"],
  },
  {
    label: "睡眠",
    keywords: ["寝", "ねんね", "昼寝", "お昼寝", "睡眠", "起床", "寝起き"],
  },
  {
    label: "遊び",
    keywords: ["遊び", "遊ぶ", "おもちゃ", "絵本", "ぬいぐるみ", "ボール"],
  },
  {
    label: "お風呂",
    keywords: ["お風呂", "風呂", "沐浴", "シャワー", "水遊び"],
  },
];

const appState = {
  videos: [],
  metadata: {},
  settings: {
    clientId: "",
    tagSuggestions: defaultTags,
    childBirthMonth: defaultBirthMonth,
    lastSyncAt: null,
  },
  ui: {
    view: "home",
    search: "",
    category: "all",
  },
};

const elements = {};
let tokenClient = null;

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  loadState();
  bindEvents();
  render();
});

function bindElements() {
  Object.assign(elements, {
    syncButton: document.querySelector("#syncButton"),
    settingsButton: document.querySelector("#settingsButton"),
    addButton: document.querySelector("#addButton"),
    searchInput: document.querySelector("#searchInput"),
    categoryFilters: document.querySelector("#categoryFilters"),
    statusLine: document.querySelector("#statusLine"),
    homeView: document.querySelector("#homeView"),
    timelineView: document.querySelector("#timelineView"),
    favoritesView: document.querySelector("#favoritesView"),
    tabs: document.querySelectorAll(".tab"),
    detailDialog: document.querySelector("#detailDialog"),
    detailTitle: document.querySelector("#detailTitle"),
    detailContent: document.querySelector("#detailContent"),
    settingsDialog: document.querySelector("#settingsDialog"),
    clientIdInput: document.querySelector("#clientIdInput"),
    birthMonthInput: document.querySelector("#birthMonthInput"),
    tagSuggestionsInput: document.querySelector("#tagSuggestionsInput"),
    saveSettingsButton: document.querySelector("#saveSettingsButton"),
    exportButton: document.querySelector("#exportButton"),
    importInput: document.querySelector("#importInput"),
    addDialog: document.querySelector("#addDialog"),
    manualUrlInput: document.querySelector("#manualUrlInput"),
    manualDateInput: document.querySelector("#manualDateInput"),
    manualAddButton: document.querySelector("#manualAddButton"),
  });
}

function bindEvents() {
  elements.syncButton.addEventListener("click", syncYouTube);
  elements.settingsButton.addEventListener("click", openSettings);
  elements.addButton.addEventListener("click", openManualAdd);
  elements.saveSettingsButton.addEventListener("click", saveSettings);
  elements.exportButton.addEventListener("click", exportJson);
  elements.importInput.addEventListener("change", importJson);
  elements.manualAddButton.addEventListener("click", addManualVideo);

  elements.searchInput.addEventListener("input", (event) => {
    appState.ui.search = event.target.value.trim();
    render();
  });

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      appState.ui.view = tab.dataset.view;
      render();
    });
  });

  document.body.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    if (action === "sync") syncYouTube();
    if (action === "sample") addSampleVideos();
    if (action === "set-category") {
      appState.ui.category = event.target.closest("[data-category]")?.dataset.category ?? "all";
      render();
    }

    const videoId = event.target.closest("[data-video-id]")?.dataset.videoId;
    if (action === "open-detail" && videoId) openDetail(videoId);
    if (action === "toggle-favorite" && videoId) toggleFavorite(videoId);
    if (action === "open-month") {
      appState.ui.view = "timeline";
      elements.searchInput.value = event.target.closest("[data-month]")?.dataset.month ?? "";
      appState.ui.search = elements.searchInput.value;
      render();
    }
  });
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    appState.videos = Array.isArray(saved.videos) ? saved.videos : [];
    appState.metadata = saved.metadata && typeof saved.metadata === "object" ? saved.metadata : {};
    appState.settings = {
      ...appState.settings,
      ...(saved.settings ?? {}),
      childBirthMonth: saved.settings?.childBirthMonth ?? defaultBirthMonth,
      tagSuggestions: normalizeTags(saved.settings?.tagSuggestions ?? defaultTags),
    };
  } catch {
    setStatus("保存データを読み込めませんでした。JSONバックアップがあればインポートしてください。", true);
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      videos: appState.videos,
      metadata: appState.metadata,
      settings: appState.settings,
    }),
  );
}

function render() {
  elements.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === appState.ui.view));
  elements.homeView.classList.toggle("hidden", appState.ui.view !== "home");
  elements.timelineView.classList.toggle("hidden", appState.ui.view !== "timeline");
  elements.favoritesView.classList.toggle("hidden", appState.ui.view !== "favorites");

  const filtered = getFilteredVideos();
  renderCategoryFilters(appState.videos);
  renderStatus(filtered.length);
  renderHome(filtered);
  renderTimeline(filtered);
  renderFavorites(filtered);
}

function renderStatus(count) {
  const total = appState.videos.length;
  const syncText = appState.settings.lastSyncAt
    ? `最終同期: ${formatDateTime(appState.settings.lastSyncAt)}`
    : "YouTube未同期";
  elements.statusLine.textContent = `${total}件の動画 / 表示中 ${count}件 / ${syncText}`;
}

function renderCategoryFilters(videos) {
  if (!videos.length) {
    elements.categoryFilters.innerHTML = "";
    return;
  }

  const counts = videos.reduce((result, video) => {
    getAutoCategories(video).forEach((category) => {
      result[category] = (result[category] ?? 0) + 1;
    });
    return result;
  }, {});
  const categories = ["all", ...Object.keys(counts).sort((a, b) => counts[b] - counts[a])];

  elements.categoryFilters.innerHTML = categories
    .map((category) => {
      const active = appState.ui.category === category;
      const label = category === "all" ? "すべて" : category;
      const count = category === "all" ? videos.length : counts[category];
      return `<button class="category-button ${active ? "active" : ""}" type="button" data-action="set-category" data-category="${escapeAttribute(category)}">${escapeHtml(label)} ${count}</button>`;
    })
    .join("");
}

function renderHome(videos) {
  if (!appState.videos.length) {
    elements.homeView.innerHTML = getEmptyHtml();
    return;
  }

  const recent = [...videos].slice(0, 8);
  const currentMonth = formatMonthKey(new Date());
  const thisMonth = videos.filter((video) => formatMonthKey(getEffectiveDate(video)) === currentMonth).slice(0, 8);

  elements.homeView.innerHTML = `
    ${renderSection("最新動画", "新しく追加・同期された動画", recent)}
    ${renderSection("今月の動画", `${formatMonthLabel(currentMonth)} の記録`, thisMonth)}
    ${renderMonthSummary(videos)}
  `;
}

function renderTimeline(videos) {
  if (!appState.videos.length) {
    elements.timelineView.innerHTML = getEmptyHtml();
    return;
  }

  const groups = groupByDay(videos);
  const html = Object.entries(groups)
    .map(([day, dayVideos]) => `
      <section class="day-group">
        <div class="section-head">
          <div>
            <h2>${formatDayLabel(day)}</h2>
            <p>${dayVideos.length}件の動画</p>
          </div>
        </div>
        ${renderVideoGrid(dayVideos)}
      </section>
    `)
    .join("");

  elements.timelineView.innerHTML = `<div class="timeline-list">${html || renderNoMatches()}</div>`;
}

function renderFavorites(videos) {
  const favorites = videos.filter((video) => getMeta(video.id).favorite);
  elements.favoritesView.innerHTML = renderSection("お気に入り", "あとで何度も見返したい動画", favorites);
}

function renderSection(title, subtitle, videos) {
  return `
    <section class="section-band">
      <div class="section-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle)}</p>
        </div>
      </div>
      ${videos.length ? renderVideoGrid(videos) : renderNoMatches()}
    </section>
  `;
}

function renderMonthSummary(videos) {
  const months = groupByMonth(videos);
  const items = Object.entries(months)
    .map(([month, monthVideos]) => `
      <button class="month-button" type="button" data-action="open-month" data-month="${month}">
        <strong>${formatMonthLabel(month)}</strong>
        <span>${monthVideos.length}件</span>
      </button>
    `)
    .join("");

  return `
    <section class="section-band">
      <div class="section-head">
        <div>
          <h2>年月一覧</h2>
          <p>月ごとに思い出をたどれます</p>
        </div>
      </div>
      <div class="month-summary">${items}</div>
    </section>
  `;
}

function renderVideoGrid(videos) {
  return `
    <div class="video-grid">
      ${videos.map(renderVideoCard).join("")}
    </div>
  `;
}

function renderVideoCard(video) {
  const meta = getMeta(video.id);
  const title = getEffectiveTitle(video);
  const date = getEffectiveDate(video);
  const tags = meta.tags ?? [];
  const categories = getAutoCategories(video);
  const age = getAgeLabel(date);

  return `
    <article class="video-card">
      <button class="thumbnail-button" type="button" data-action="open-detail" data-video-id="${video.id}">
        <div class="thumb">
          <img src="${escapeAttribute(getThumbnail(video))}" alt="${escapeAttribute(title)}" loading="lazy" />
          ${video.duration ? `<span class="duration">${formatDuration(video.duration)}</span>` : ""}
          ${meta.favorite ? `<span class="favorite-mark" aria-label="お気に入り">★</span>` : ""}
        </div>
      </button>
      <div class="video-body">
        <div class="video-title">${escapeHtml(title)}</div>
        <div class="meta-row">
          <span>${formatDate(date)}</span>
          <span class="privacy">${privacyLabel(video.privacyStatus)}</span>
        </div>
        <div class="chip-row">
          ${categories.slice(0, 3).map((category) => `<span class="chip category-chip">${escapeHtml(category)}</span>`).join("")}
          ${age ? `<span class="chip age-chip">${escapeHtml(age)}</span>` : ""}
          ${tags.slice(0, 2).map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>
    </article>
  `;
}

function renderNoMatches() {
  return `
    <div class="empty-state">
      <h2>該当する動画がありません</h2>
      <p>検索語やタグを変えると見つかるかもしれません。</p>
    </div>
  `;
}

function getEmptyHtml() {
  return document.querySelector("#emptyTemplate").innerHTML;
}

function openDetail(videoId) {
  const video = appState.videos.find((item) => item.id === videoId);
  if (!video) return;

  const meta = getMeta(video.id);
  const title = getEffectiveTitle(video);
  const date = getEffectiveDate(video);
  const categories = getAutoCategories(video);
  const age = getAgeLabel(date);
  elements.detailTitle.textContent = title;
  elements.detailContent.innerHTML = `
    <div class="detail-layout">
      <div>
        <div class="player">
          <iframe
            src="https://www.youtube.com/embed/${encodeURIComponent(video.id)}"
            title="${escapeAttribute(title)}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen>
          </iframe>
        </div>
        <div class="detail-facts">
          <div class="fact"><span>撮影日</span><strong>${formatDate(date)}</strong></div>
          <div class="fact"><span>年齢</span><strong>${escapeHtml(age || "未設定")}</strong></div>
          <div class="fact"><span>自動カテゴリ</span><strong>${escapeHtml(categories.join(" / "))}</strong></div>
          <div class="fact"><span>投稿日</span><strong>${formatDate(video.publishedAt)}</strong></div>
          <div class="fact"><span>公開状態</span><strong>${privacyLabel(video.privacyStatus)}</strong></div>
          <div class="fact"><span>再生時間</span><strong>${video.duration ? formatDuration(video.duration) : "不明"}</strong></div>
        </div>
      </div>
      <div class="form-grid">
        <label>
          表示タイトル
          <input id="detailTitleInput" type="text" value="${escapeAttribute(meta.titleOverride ?? "")}" placeholder="${escapeAttribute(video.youtubeTitle ?? "YouTube動画")}" />
        </label>
        <label>
          撮影日
          <input id="detailDateInput" type="date" value="${toDateInputValue(meta.dateOverride ?? video.recordedAt ?? video.publishedAt)}" />
        </label>
        <label>
          メモ
          <textarea id="detailNoteInput" rows="4" placeholder="この日のことを少しメモ">${escapeHtml(meta.note ?? "")}</textarea>
        </label>
        <div>
          <label>タグ</label>
          <div class="tag-picker" id="detailTagPicker">
            ${renderTagPicker(meta.tags ?? [])}
          </div>
        </div>
        <label>
          タグを追加
          <input id="detailTagInput" type="text" placeholder="例: 公園" />
        </label>
        <div class="button-row">
          <button class="primary-button" type="button" id="saveDetailButton">保存</button>
          <button class="secondary-button" type="button" id="favoriteDetailButton">${meta.favorite ? "お気に入り解除" : "お気に入り"}</button>
          <a class="secondary-button" href="https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}" target="_blank" rel="noreferrer">YouTubeで開く</a>
        </div>
      </div>
    </div>
  `;

  elements.detailContent.querySelector("#saveDetailButton").addEventListener("click", () => saveDetail(video.id));
  elements.detailContent.querySelector("#favoriteDetailButton").addEventListener("click", () => {
    toggleFavorite(video.id);
    elements.detailDialog.close();
    openDetail(video.id);
  });
  if (!elements.detailDialog.open) elements.detailDialog.showModal();
}

function renderTagPicker(activeTags) {
  const tags = [...new Set([...appState.settings.tagSuggestions, ...activeTags])];
  return tags
    .map((tag) => {
      const active = activeTags.includes(tag);
      return `<button class="tag-toggle ${active ? "active" : ""}" type="button" data-tag="${escapeAttribute(tag)}">${escapeHtml(tag)}</button>`;
    })
    .join("");
}

function saveDetail(videoId) {
  const meta = getMeta(videoId);
  const titleInput = elements.detailContent.querySelector("#detailTitleInput");
  const dateInput = elements.detailContent.querySelector("#detailDateInput");
  const noteInput = elements.detailContent.querySelector("#detailNoteInput");
  const extraTagInput = elements.detailContent.querySelector("#detailTagInput");
  const selectedTags = [...elements.detailContent.querySelectorAll(".tag-toggle.active")].map((button) => button.dataset.tag);
  const extraTags = normalizeTags(extraTagInput.value.split(","));

  appState.metadata[videoId] = {
    ...meta,
    titleOverride: titleInput.value.trim(),
    dateOverride: dateInput.value || null,
    note: noteInput.value.trim(),
    tags: [...new Set([...selectedTags, ...extraTags])],
    updatedAt: new Date().toISOString(),
  };

  saveState();
  setStatus("動画メタデータを保存しました。");
  render();
  elements.detailDialog.close();
  openDetail(videoId);
}

document.addEventListener("click", (event) => {
  const tagButton = event.target.closest(".tag-toggle");
  if (!tagButton) return;
  tagButton.classList.toggle("active");
});

function toggleFavorite(videoId) {
  const meta = getMeta(videoId);
  appState.metadata[videoId] = {
    ...meta,
    favorite: !meta.favorite,
    updatedAt: new Date().toISOString(),
  };
  saveState();
  render();
}

function openSettings() {
  elements.clientIdInput.value = appState.settings.clientId ?? "";
  elements.birthMonthInput.value = appState.settings.childBirthMonth ?? defaultBirthMonth;
  elements.tagSuggestionsInput.value = appState.settings.tagSuggestions.join(", ");
  elements.settingsDialog.showModal();
}

function saveSettings() {
  appState.settings.clientId = elements.clientIdInput.value.trim();
  appState.settings.childBirthMonth = elements.birthMonthInput.value || defaultBirthMonth;
  appState.settings.tagSuggestions = normalizeTags(elements.tagSuggestionsInput.value.split(","));
  saveState();
  setStatus("設定を保存しました。");
  elements.settingsDialog.close();
  render();
}

function openManualAdd() {
  elements.manualUrlInput.value = "";
  elements.manualDateInput.value = toDateInputValue(new Date().toISOString());
  elements.addDialog.showModal();
}

function addManualVideo() {
  const id = parseYouTubeId(elements.manualUrlInput.value.trim());
  const date = elements.manualDateInput.value || new Date().toISOString();
  if (!id) {
    setStatus("YouTube URLまたは動画IDを確認してください。", true);
    return;
  }

  upsertVideos([
    {
      id,
      youtubeTitle: "YouTube動画",
      description: "",
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      publishedAt: date,
      recordedAt: date,
      duration: "",
      privacyStatus: "unlisted",
      embeddable: true,
      channelTitle: "",
      fetchedAt: new Date().toISOString(),
    },
  ]);

  saveState();
  setStatus("動画を手動追加しました。");
  elements.addDialog.close();
  render();
}

function addSampleVideos() {
  const samples = [
    {
      id: "dQw4w9WgXcQ",
      youtubeTitle: "サンプル動画: はじめてのお散歩",
      description: "",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      publishedAt: "2026-06-12T09:00:00Z",
      recordedAt: "2026-06-12",
      duration: "PT3M33S",
      privacyStatus: "unlisted",
      embeddable: true,
      channelTitle: "Sample",
      fetchedAt: new Date().toISOString(),
    },
    {
      id: "jNQXAC9IVRw",
      youtubeTitle: "サンプル動画: 誕生日の記録",
      description: "",
      thumbnailUrl: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg",
      publishedAt: "2026-05-25T09:00:00Z",
      recordedAt: "2026-05-25",
      duration: "PT18S",
      privacyStatus: "unlisted",
      embeddable: true,
      channelTitle: "Sample",
      fetchedAt: new Date().toISOString(),
    },
  ];
  upsertVideos(samples);
  samples.forEach((video, index) => {
    appState.metadata[video.id] = {
      ...getMeta(video.id),
      tags: index === 0 ? ["日常", "初めて"] : ["誕生日", "成長記録"],
    };
  });
  saveState();
  setStatus("サンプル動画を追加しました。");
  render();
}

async function syncYouTube() {
  if (!appState.settings.clientId) {
    openSettings();
    setStatus("YouTube同期にはGoogle OAuthクライアントIDが必要です。", true);
    return;
  }

  try {
    setStatus("Google認証を開始します。");
    const token = await requestAccessToken();
    setStatus("YouTubeチャンネル情報を取得しています。");
    const uploadsPlaylistId = await fetchUploadsPlaylistId(token);
    setStatus("アップロード動画一覧を取得しています。");
    const videoIds = await fetchUploadVideoIds(token, uploadsPlaylistId);
    if (!videoIds.length) {
      setStatus("取得できる動画がありませんでした。", true);
      return;
    }

    setStatus(`${videoIds.length}件の動画情報を取得しています。`);
    const videos = await fetchVideoDetails(token, videoIds);
    upsertVideos(videos);
    appState.settings.lastSyncAt = new Date().toISOString();
    saveState();
    setStatus(`${videos.length}件の動画を同期しました。`);
    render();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "YouTube同期に失敗しました。", true);
  }
}

function requestAccessToken() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google認証ライブラリを読み込めませんでした。ネットワーク接続を確認してください。"));
      return;
    }

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: appState.settings.clientId,
      scope: YOUTUBE_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        resolve(response.access_token);
      },
    });

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

async function fetchUploadsPlaylistId(token) {
  const data = await youtubeFetch(token, "channels", {
    part: "contentDetails",
    mine: "true",
  });
  const channel = data.items?.[0];
  const playlistId = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) throw new Error("アップロード動画のプレイリストIDを取得できませんでした。");
  return playlistId;
}

async function fetchUploadVideoIds(token, playlistId) {
  const ids = [];
  let pageToken = "";

  do {
    const data = await youtubeFetch(token, "playlistItems", {
      part: "snippet,contentDetails,status",
      playlistId,
      maxResults: "50",
      pageToken,
    });
    data.items?.forEach((item) => {
      const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
      if (videoId) ids.push(videoId);
    });
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  return ids;
}

async function fetchVideoDetails(token, videoIds) {
  const chunks = chunk(videoIds, 50);
  const all = [];

  for (const ids of chunks) {
    const data = await youtubeFetch(token, "videos", {
      part: "snippet,contentDetails,status,recordingDetails",
      id: ids.join(","),
      maxResults: "50",
    });
    all.push(...(data.items ?? []).map(mapYouTubeVideo));
  }

  return all;
}

async function youtubeFetch(token, endpoint, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.error?.message ?? `YouTube APIエラー: ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

function mapYouTubeVideo(item) {
  const snippet = item.snippet ?? {};
  const details = item.contentDetails ?? {};
  const status = item.status ?? {};
  const thumbnails = snippet.thumbnails ?? {};

  return {
    id: item.id,
    youtubeTitle: snippet.title ?? "YouTube動画",
    description: snippet.description ?? "",
    thumbnailUrl: thumbnails.maxres?.url ?? thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? "",
    publishedAt: snippet.publishedAt ?? "",
    recordedAt: item.recordingDetails?.recordingDate ?? "",
    duration: details.duration ?? "",
    privacyStatus: status.privacyStatus ?? "unknown",
    embeddable: status.embeddable ?? true,
    channelTitle: snippet.channelTitle ?? "",
    fetchedAt: new Date().toISOString(),
  };
}

function upsertVideos(videos) {
  const byId = new Map(appState.videos.map((video) => [video.id, video]));
  videos.forEach((video) => {
    byId.set(video.id, {
      ...(byId.get(video.id) ?? {}),
      ...video,
      fetchedAt: new Date().toISOString(),
    });
    appState.metadata[video.id] = {
      ...getMeta(video.id),
      addedAt: getMeta(video.id).addedAt ?? new Date().toISOString(),
    };
  });

  appState.videos = [...byId.values()].sort((a, b) => getEffectiveDate(b) - getEffectiveDate(a));
}

function getFilteredVideos() {
  const query = appState.ui.search.toLowerCase();
  const videos = [...appState.videos].sort((a, b) => getEffectiveDate(b) - getEffectiveDate(a));
  return videos.filter((video) => {
    const categories = getAutoCategories(video);
    if (appState.ui.category !== "all" && !categories.includes(appState.ui.category)) return false;
    if (!query) return true;

    const meta = getMeta(video.id);
    const fields = [
      getEffectiveTitle(video),
      video.youtubeTitle,
      video.description,
      meta.note,
      ...categories,
      getAgeLabel(getEffectiveDate(video)),
      ...(meta.tags ?? []),
      formatDate(getEffectiveDate(video)),
      formatMonthKey(getEffectiveDate(video)),
    ];
    return fields.join(" ").toLowerCase().includes(query);
  });
}

function getMeta(videoId) {
  return appState.metadata[videoId] ?? {};
}

function getEffectiveTitle(video) {
  return getMeta(video.id).titleOverride || video.youtubeTitle || "YouTube動画";
}

function getEffectiveDate(video) {
  const meta = getMeta(video.id);
  return new Date(meta.dateOverride || video.recordedAt || video.publishedAt || video.fetchedAt || Date.now());
}

function getThumbnail(video) {
  return video.thumbnailUrl || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
}

function getAutoCategories(video) {
  const text = [
    getEffectiveTitle(video),
    video.youtubeTitle,
    video.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const matched = categoryRules
    .filter((rule) => rule.keywords.some((keyword) => text.includes(keyword.toLowerCase())))
    .map((rule) => rule.label);
  return matched.length ? [...new Set(matched)] : ["日常"];
}

function getAgeLabel(value) {
  const birthMonth = appState.settings.childBirthMonth || defaultBirthMonth;
  const match = birthMonth.match(/^(\d{4})-(\d{2})$/);
  if (!match) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const birthYear = Number(match[1]);
  const birthMonthIndex = Number(match[2]) - 1;
  const monthDiff = (date.getFullYear() - birthYear) * 12 + date.getMonth() - birthMonthIndex;
  if (monthDiff < 0) return "生まれる前";
  if (monthDiff < 12) return `生後${monthDiff}か月`;

  const years = Math.floor(monthDiff / 12);
  const months = monthDiff % 12;
  return `${years}歳${months}か月`;
}

function groupByDay(videos) {
  return videos.reduce((groups, video) => {
    const key = toDateInputValue(getEffectiveDate(video));
    groups[key] ??= [];
    groups[key].push(video);
    return groups;
  }, {});
}

function groupByMonth(videos) {
  return videos.reduce((groups, video) => {
    const key = formatMonthKey(getEffectiveDate(video));
    groups[key] ??= [];
    groups[key].push(video);
    return groups;
  }, {});
}

function openDownload(filename, content) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  openDownload(
    `child-video-album-${toDateInputValue(new Date())}.json`,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        videos: appState.videos,
        metadata: appState.metadata,
        settings: appState.settings,
      },
      null,
      2,
    ),
  );
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    appState.videos = Array.isArray(imported.videos) ? imported.videos : appState.videos;
    appState.metadata = imported.metadata && typeof imported.metadata === "object" ? imported.metadata : appState.metadata;
    appState.settings = {
      ...appState.settings,
      ...(imported.settings ?? {}),
      childBirthMonth: imported.settings?.childBirthMonth ?? appState.settings.childBirthMonth ?? defaultBirthMonth,
      tagSuggestions: normalizeTags(imported.settings?.tagSuggestions ?? appState.settings.tagSuggestions),
    };
    saveState();
    setStatus("JSONをインポートしました。");
    elements.settingsDialog.close();
    render();
  } catch {
    setStatus("JSONをインポートできませんでした。ファイル内容を確認してください。", true);
  } finally {
    event.target.value = "";
  }
}

function setStatus(message, isError = false) {
  elements.statusLine.textContent = message;
  elements.statusLine.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function normalizeTags(tags) {
  return [...new Set((Array.isArray(tags) ? tags : [])
    .flatMap((tag) => String(tag).split(/[,、\n]/))
    .map((tag) => tag.trim())
    .filter(Boolean))];
}

function parseYouTubeId(value) {
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) return url.pathname.replace("/", "").slice(0, 11);
    if (url.searchParams.get("v")) return url.searchParams.get("v").slice(0, 11);
    const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
  } catch {
    return "";
  }

  return "";
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function formatDate(value) {
  if (!value) return "日付なし";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "日付なし";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "不明";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMonthKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "日付なし";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  return `${year}年${Number(month)}月`;
}

function formatDayLabel(dayKey) {
  const date = new Date(dayKey);
  const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "short" }).format(date);
  return `${formatDate(date)} ${weekday}`;
}

function toDateInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDuration(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const parts = hours ? [hours, minutes, seconds] : [minutes, seconds];
  return parts.map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, "0"))).join(":");
}

function privacyLabel(value) {
  const labels = {
    public: "公開",
    unlisted: "限定公開",
    private: "非公開",
    unknown: "不明",
  };
  return labels[value] ?? value ?? "不明";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
