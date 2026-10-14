(function (global) {
  const MIME_CANDIDATES = [
    "audio/mp4",
    "audio/aac",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];

  function pickMimeType() {
    if (typeof MediaRecorder === "undefined") return "";
    for (const type of MIME_CANDIDATES) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "";
  }

  function createId() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "rec-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  class BaizeRecorder {
    constructor() {
      this.mediaRecorder = null;
      this.stream = null;
      this.chunks = [];
      this.startedAt = 0;
      this.mimeType = pickMimeType();
    }

    get supported() {
      return Boolean(
        global.MediaRecorder &&
          navigator.mediaDevices &&
          navigator.mediaDevices.getUserMedia
      );
    }

    get recording() {
      return Boolean(this.mediaRecorder && this.mediaRecorder.state === "recording");
    }

    async start() {
      if (!this.supported) {
        throw new Error("当前浏览器不支持录音。请使用较新的 Chrome、Edge 或 Safari，并通过 HTTPS 打开。");
      }

      this.chunks = [];
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const options = {};
      if (this.mimeType) options.mimeType = this.mimeType;
      try {
        this.mediaRecorder = new MediaRecorder(this.stream, options);
      } catch (err) {
        this.mediaRecorder = new MediaRecorder(this.stream);
      }

      this.mimeType = this.mediaRecorder.mimeType || this.mimeType || "audio/webm";

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) this.chunks.push(event.data);
      };

      this.startedAt = Date.now();
      this.mediaRecorder.start(250);
    }

    stop() {
      return new Promise((resolve, reject) => {
        if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
          this.cleanupStream();
          reject(new Error("没有正在进行的录音。"));
          return;
        }

        this.mediaRecorder.onerror = (event) => {
          this.cleanupStream();
          reject(event.error || new Error("录音失败。"));
        };

        this.mediaRecorder.onstop = () => {
          const durationMs = Math.max(200, Date.now() - this.startedAt);
          const blob = new Blob(this.chunks, { type: this.mimeType || "audio/webm" });
          this.cleanupStream();
          resolve({
            id: createId(),
            blob,
            mimeType: blob.type || this.mimeType,
            durationMs,
            createdAt: Date.now(),
          });
        };

        this.mediaRecorder.stop();
      });
    }

    cleanupStream() {
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      this.mediaRecorder = null;
      this.chunks = [];
    }
  }

  function mapGetUserMediaError(err) {
    const name = err && err.name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "未获得麦克风权限。请在浏览器设置中允许本站使用麦克风后再试。";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "没有找到麦克风设备。";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "麦克风正被其他应用占用，请关闭后重试。";
    }
    if (name === "SecurityError") {
      return "当前环境不允许录音。请通过 HTTPS 或本地服务器打开本页。";
    }
    return (err && err.message) || "录音无法开始。";
  }

  global.BaizeRecorder = BaizeRecorder;
  global.BaizeRecorder.mapGetUserMediaError = mapGetUserMediaError;
})(window);
