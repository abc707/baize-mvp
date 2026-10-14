(function () {
  const CHECKIN_KEY = "baize-checkins";
  const INSTALL_DISMISS_KEY = "baize-install-dismissed";

  const els = {
    viewHome: document.getElementById("view-home"),
    viewLocation: document.getElementById("view-location"),
    locationList: document.getElementById("location-list"),
    homeStatus: document.getElementById("home-status"),
    backBtn: document.getElementById("back-btn"),
    locName: document.getElementById("loc-name"),
    locTeaser: document.getElementById("loc-teaser"),
    locNarration: document.getElementById("loc-narration"),
    playBtn: document.getElementById("play-narration"),
    narrationAudio: document.getElementById("narration-audio"),
    playLabel: document.getElementById("play-label"),
    locStatus: document.getElementById("loc-status"),
    recordBtn: document.getElementById("record-btn"),
    recordLabel: document.getElementById("record-label"),
    recordTimer: document.getElementById("record-timer"),
    recordings: document.getElementById("recordings"),
    installBanner: document.getElementById("install-banner"),
    installTitle: document.getElementById("install-title"),
    installText: document.getElementById("install-text"),
    installBtn: document.getElementById("install-btn"),
    installDismiss: document.getElementById("install-dismiss"),
  };

  const recorder = new BaizeRecorder();
  let locations = [];
  let currentLocation = null;
  let timerId = null;
  let replayUrl = null;
  let deferredPrompt = null;
  let activeReplay = null;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function formatTime(ms) {
    const total = Math.round(ms / 1000);
    const m = Math.floor(total / 60);
    const s = String(total % 60).padStart(2, "0");
    return m + ":" + s;
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      "-" +
      p(d.getMonth() + 1) +
      "-" +
      p(d.getDate()) +
      " " +
      p(d.getHours()) +
      ":" +
      p(d.getMinutes())
    );
  }

  function readCheckins() {
    try {
      return JSON.parse(localStorage.getItem(CHECKIN_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function markCheckin(locationId) {
    const map = readCheckins();
    map[locationId] = Date.now();
    localStorage.setItem(CHECKIN_KEY, JSON.stringify(map));
  }

  function setStatus(el, message, kind) {
    el.textContent = message || "";
    el.dataset.kind = kind || "";
    el.hidden = !message;
  }

  function showHome() {
    stopNarration();
    stopReplay();
    if (recorder.recording) {
      recorder.cleanupStream();
      stopTimer();
      syncRecordButton();
    }
    currentLocation = null;
    els.viewHome.hidden = false;
    els.viewLocation.hidden = true;
    renderLocationCards();
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

  function locationFromHash() {
    const id = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    return locations.find((item) => item.id === id) || null;
  }

  async function openLocation(item, { updateHash } = { updateHash: true }) {
    currentLocation = item;
    markCheckin(item.id);
    els.viewHome.hidden = true;
    els.viewLocation.hidden = false;
    els.locName.textContent = item.name;
    els.locTeaser.textContent = item.teaser;
    els.locNarration.textContent = item.narration;
    els.narrationAudio.src = item.audio;
    stopNarration();
    setStatus(els.locStatus, "", "");
    syncRecordButton();
    if (updateHash) location.hash = item.id;
    renderLocationCards();
    await refreshRecordings();
  }

  function renderLocationCards() {
    const checkins = readCheckins();
    els.locationList.innerHTML = "";
    locations.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "place-card";
      card.style.setProperty("--i", String(index));
      const checked = Boolean(checkins[item.id]);
      card.innerHTML =
        '<div class="place-card__meta">' +
        '<span class="place-card__index">0' +
        (index + 1) +
        "</span>" +
        (checked ? '<span class="badge">已签到</span>' : "") +
        "</div>" +
        "<h2>" +
        item.name +
        "</h2>" +
        "<p>" +
        item.teaser +
        "</p>" +
        '<button type="button" class="ghost-btn">签到此地</button>';
      $("button", card).addEventListener("click", () => openLocation(item));
      card.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        openLocation(item);
      });
      els.locationList.appendChild(card);
    });
  }

  function stopNarration() {
    const audio = els.narrationAudio;
    audio.pause();
    audio.currentTime = 0;
    els.playBtn.setAttribute("aria-pressed", "false");
    els.playLabel.textContent = "聆听白泽";
    els.playBtn.classList.remove("is-playing");
  }

  function toggleNarration() {
    const audio = els.narrationAudio;
    if (!currentLocation) return;
    if (!audio.paused) {
      audio.pause();
      els.playBtn.setAttribute("aria-pressed", "false");
      els.playLabel.textContent = "继续聆听";
      els.playBtn.classList.remove("is-playing");
      return;
    }
    stopReplay();
    audio.play().then(
      () => {
        els.playBtn.setAttribute("aria-pressed", "true");
        els.playLabel.textContent = "暂停旁白";
        els.playBtn.classList.add("is-playing");
        setStatus(els.locStatus, "", "");
      },
      () => {
        setStatus(els.locStatus, "旁白音频暂时无法播放，你仍可阅读上方文案，或稍后再试。", "error");
      }
    );
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    els.recordTimer.textContent = "0:00";
  }

  function startTimer() {
    const origin = Date.now();
    stopTimer();
    timerId = setInterval(() => {
      els.recordTimer.textContent = formatTime(Date.now() - origin);
    }, 200);
  }

  function syncRecordButton() {
    const on = recorder.recording;
    els.recordBtn.classList.toggle("is-recording", on);
    els.recordBtn.setAttribute("aria-pressed", on ? "true" : "false");
    els.recordLabel.textContent = on ? "结束录音" : "开始录音";
    if (!on) els.recordTimer.textContent = "0:00";
  }

  async function toggleRecord() {
    if (!currentLocation) return;
    if (recorder.recording) {
      try {
        const result = await recorder.stop();
        stopTimer();
        syncRecordButton();
        await BaizeDB.addRecording({
          id: result.id,
          locationId: currentLocation.id,
          createdAt: result.createdAt,
          durationMs: result.durationMs,
          mimeType: result.mimeType,
          blob: result.blob,
        });
        setStatus(els.locStatus, "录音已保存在本机。", "ok");
        await refreshRecordings();
      } catch (err) {
        stopTimer();
        syncRecordButton();
        setStatus(els.locStatus, err.message || "保存录音失败。", "error");
      }
      return;
    }

    if (!recorder.supported) {
      setStatus(els.locStatus, "当前浏览器不支持录音。", "error");
      return;
    }

    stopNarration();
    stopReplay();
    try {
      await recorder.start();
      startTimer();
      syncRecordButton();
      setStatus(els.locStatus, "正在录音。再次点击即可结束并保存。", "ok");
    } catch (err) {
      recorder.cleanupStream();
      stopTimer();
      syncRecordButton();
      setStatus(els.locStatus, BaizeRecorder.mapGetUserMediaError(err), "error");
    }
  }

  function stopReplay() {
    if (activeReplay) {
      activeReplay.pause();
      activeReplay.removeAttribute("src");
      activeReplay.load();
      activeReplay = null;
    }
    if (replayUrl) {
      URL.revokeObjectURL(replayUrl);
      replayUrl = null;
    }
    els.recordings.querySelectorAll(".rec-item.is-playing").forEach((node) => {
      node.classList.remove("is-playing");
      const btn = $(".rec-play", node);
      if (btn) btn.textContent = "播放";
    });
  }

  async function playRecording(id, itemEl) {
    const already = itemEl.classList.contains("is-playing");
    stopReplay();
    if (already) return;
    const rec = await BaizeDB.getRecording(id);
    if (!rec || !rec.blob) {
      setStatus(els.locStatus, "找不到这条录音。", "error");
      return;
    }
    replayUrl = URL.createObjectURL(rec.blob);
    const audio = new Audio(replayUrl);
    activeReplay = audio;
    itemEl.classList.add("is-playing");
    $(".rec-play", itemEl).textContent = "停止";
    audio.onended = () => stopReplay();
    audio.onerror = () => {
      stopReplay();
      setStatus(els.locStatus, "这条录音无法播放。", "error");
    };
    try {
      await audio.play();
    } catch {
      stopReplay();
      setStatus(els.locStatus, "播放被浏览器拦截，请再点一次。", "error");
    }
  }

  async function removeRecording(id) {
    const ok = window.confirm("删除这条录音？删除后无法恢复。");
    if (!ok) return;
    stopReplay();
    await BaizeDB.deleteRecording(id);
    await refreshRecordings();
  }

  async function refreshRecordings() {
    if (!currentLocation) return;
    const rows = await BaizeDB.listByLocation(currentLocation.id);
    els.recordings.innerHTML = "";
    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "此地还没有你的录音。";
      els.recordings.appendChild(empty);
      return;
    }
    rows.forEach((row) => {
      const li = document.createElement("article");
      li.className = "rec-item";
      li.dataset.id = row.id;
      li.innerHTML =
        '<div class="rec-item__text">' +
        "<strong>" +
        formatDate(row.createdAt) +
        "</strong>" +
        "<span>" +
        formatTime(row.durationMs) +
        "</span>" +
        "</div>" +
        '<div class="rec-item__actions">' +
        '<button type="button" class="text-btn rec-play">播放</button>' +
        '<button type="button" class="text-btn rec-del">删除</button>' +
        "</div>";
      $(".rec-play", li).addEventListener("click", () => playRecording(row.id, li));
      $(".rec-del", li).addEventListener("click", () => removeRecording(row.id));
      els.recordings.appendChild(li);
    });
  }

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function showInstallBanner({ title, text, showButton }) {
    if (sessionStorage.getItem(INSTALL_DISMISS_KEY) === "1") return;
    if (isStandalone()) return;
    els.installTitle.textContent = title;
    els.installText.textContent = text;
    els.installBtn.hidden = !showButton;
    els.installBanner.hidden = false;
  }

  function hideInstallBanner() {
    els.installBanner.hidden = true;
    sessionStorage.setItem(INSTALL_DISMISS_KEY, "1");
  }

  function setupInstall() {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredPrompt = event;
      showInstallBanner({
        title: "添加到主屏幕",
        text: "把白泽留在主屏幕，下次可直接打开。",
        showButton: true,
      });
    });

    els.installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      hideInstallBanner();
    });

    els.installDismiss.addEventListener("click", hideInstallBanner);

    if (isIos() && !isStandalone()) {
      showInstallBanner({
        title: "添加到主屏幕",
        text: "在 Safari 点底部分享按钮，再选择「添加到主屏幕」。",
        showButton: false,
      });
    }
  }

  function registerSw() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        setStatus(els.homeStatus, "离线缓存未能启用，在线使用不受影响。", "error");
      });
    });
  }

  function onHashChange() {
    const item = locationFromHash();
    if (item) {
      if (!currentLocation || currentLocation.id !== item.id) {
        openLocation(item, { updateHash: false });
      }
      return;
    }
    if (!els.viewHome.hidden) return;
    showHome();
  }

  async function init() {
    setupInstall();
    registerSw();
    els.backBtn.addEventListener("click", showHome);
    els.playBtn.addEventListener("click", toggleNarration);
    els.recordBtn.addEventListener("click", toggleRecord);
    els.narrationAudio.addEventListener("ended", stopNarration);
    window.addEventListener("hashchange", onHashChange);

    try {
      locations = await BaizeLocations.loadLocations();
      renderLocationCards();
      const hashed = locationFromHash();
      if (hashed) await openLocation(hashed, { updateHash: false });
    } catch (err) {
      setStatus(els.homeStatus, err.message || "无法加载地点。", "error");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
