const LANG_TYPE_MAPPINGS = {
  "en-US_A": "Neural2",
  "en-GB_A": "Neural2",
  "en-GB_C": "Neural2",
  "en-AU_A": "Neural2",
  "en-AU_C": "Neural2",
};
window.ttsPlaySuccessCount = 0;
window.ttsPlayErrorCount = 0;
class TTSItem {
  constructor(text, langCode, speed, pitch, volume, context, voiceId) {
    if (voiceId === "en_random_singing") {
      let singingVoices = [
        "en_female_f08_salut_damour",
        "en_male_m03_lobby",
        "en_female_f08_warmy_breeze",
        "en_male_m03_sunshine_soon",
      ];
      voiceId = singingVoices[Math.floor(Math.random() * singingVoices.length)];
    }
    if (!voiceId || voiceId === "default" || voiceId?.startsWith("google_")) {
      this.apiBaseUrl = "https://www.google.com/speech-api/v2/synthesize";
      this.ttsParams = {
        key: "AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw",
        enc: "mpeg",
        lang: langCode || "es-ES",
        text,
        speed: (speed / 100).toFixed(2),
        pitch: (pitch / 100).toFixed(2),
        rate: 48000,
      };
      if (voiceId?.includes("_male")) this.ttsParams.gender = "male";
      if (voiceId?.includes("_female")) this.ttsParams.gender = "female";
      if (langCode?.startsWith("de") && voiceId === "default") {
        this.ttsParams.name = "nfh";
      }
    } else {
      this.apiBaseUrl =
        "https://tikfinity-tts-api.zerody.one/api/voice/generate";
      this.ttsParams = {
        voice: voiceId,
        text: text,
        isWidget: location.href.indexOf("/widget/") > -1,
      };
    }
    this.context = context;
    this.voiceId = voiceId;
    this.volume = volume || 1;
    this.audio = null;
    this.duration = null;
    if (!text) {
      throw new Error('Missing value for "text"');
    }
  }
  play(onPlayStart) {
    return new Promise(async (resolve, reject) => {
      const audioUrl = `${this.apiBaseUrl}?${new URLSearchParams(
        this.ttsParams
      )}`;
      if (
        typeof setup !== "undefined" &&
        typeof setup.logDebugModeEvent === "function"
      ) {
        setup.logDebugModeEvent("TTSOnPlay", {
          audioUrl,
          context: this.context,
        });
      }
      if (this.audio && this.audio.duration > 0) {
        this.audio.pause();
        this.audio.currentTime = 0;
      } else {
        this.audio = new Audio(audioUrl);
      }
      this.audio.volume = this.volume;
      let timeoutId = setTimeout(() => cleanReject("Timeout Loading"), 10000);
      let timeoutGlobalId = setTimeout(
        () => cleanReject("Timeout Playing"),
        60000
      );
      let logged = false;
      let timestampStart = Date.now();
      function cleanResolve(info) {
        clearTimeout(timeoutId);
        clearTimeout(timeoutGlobalId);
        resolve(info);
      }
      function cleanReject(err) {
        clearTimeout(timeoutId);
        clearTimeout(timeoutGlobalId);
        reject(err);
        if (
          !logged &&
          typeof api !== "undefined" &&
          typeof api.logError === "function"
        ) {
          logged = true;
          window.ttsPlayErrorCount += 1;
          try {
            api.logError({
              type: "TTSError",
              message:
                (err && typeof err === "object" ? err.message : err) ||
                (window.lastTTSError && window.lastTTSError.message
                  ? window.lastTTSError.message
                  : "unknown"),
              totalFailed: window.ttsPlayErrorCount,
              totalSuccess: window.ttsPlaySuccessCount,
              audioUrl,
            });
          } catch (err) {
            api.logError({
              type: "TTSError",
              message: "failed to log",
              audioUrl,
            });
          }
        }
      }
      this.audio.addEventListener("error", cleanReject);
      this.audio.addEventListener("abort", cleanReject);
      this.audio.addEventListener("pause", cleanResolve);
      this.audio.addEventListener("ended", cleanResolve);
      this.audio.addEventListener("playing", () => {
        if (
          typeof setup !== "undefined" &&
          typeof setup.logDebugModeEvent === "function"
        ) {
          setup.logDebugModeEvent("TTSOnPlaying", {
            audioUrl,
            loadtimeMs: Date.now() - timestampStart,
          });
        }
        window.ttsPlaySuccessCount += 1;
        clearTimeout(timeoutId);
        this.duration = this.audio.duration;
        if (typeof onPlayStart === "function") {
          try {
            onPlayStart({ duration: this.duration, audio: this.audio });
          } catch (err) {}
        }
      });
      try {
        let promise = this.audio.play();
        if (promise) {
          promise.catch((err) => {
            window.lastTTSError = err;
            cleanReject(err);
          });
        }
      } catch (err) {
        cleanReject(err.message);
      }
    });
  }
  stop() {
    if (this.audio && this.audio.duration > 0) {
      this.audio.pause();
    }
  }
}
class TTSQueue {
  constructor(marginMs, onItemStart, onItemError) {
    this.marginMs = marginMs || 0;
    this.onItemStart = onItemStart;
    this.onItemError = onItemError;
    this.queue = [];
    this.currentItem = null;
    this.running = true;
    const tick = () => {
      if (this.running && !this.currentItem && this.queue.length > 0) {
        next();
      }
    };
    const next = () => {
      this.currentItem = this.queue.shift();
      playAndWait().then(() => {
        setTimeout(() => {
          this.currentItem = null;
        }, this.marginMs);
      });
    };
    const playAndWait = () => {
      return new Promise((resolve) => {
        this.currentItem
          .play(() => {
            if (typeof this.onItemStart === "function") {
              this.onItemStart(this.currentItem);
            }
          })
          .then(resolve)
          .catch((err) => {
            resolve();
            console.error(
              `Failed to play TTS Item with params ${JSON.stringify(
                this.currentItem
              )}; error:`,
              err
            );
            onItemError(this.currentItem, err);
          });
      });
    };
    setIntervalFix(() => tick(), 100);
  }
  append(ttsItem) {
    if (!ttsItem || !(ttsItem instanceof TTSItem)) {
      throw new Error("Invalid TTSItem");
    }
    this.queue.push(ttsItem);
  }
  start() {
    this.running = true;
  }
  pause() {
    this.running = false;
  }
  getCurrentItem() {
    return this.currentItem;
  }
  skipCurrent() {
    if (this.currentItem) {
      this.currentItem.stop();
    }
  }
  clear() {
    this.queue = [];
  }
  getLength() {
    return this.queue.length;
  }
}
