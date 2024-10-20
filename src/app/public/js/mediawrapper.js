class ActionItem {
  constructor(item) {
    this.id = item.id;
    this.name = item.name;
    this.imageUrl = item.imageUrl;
    this.videoUrl = item.videoUrl;
    this.audioUrl = item.audioUrl;
    this.animationUrl = item.animationUrl;
    this.text = item.text;
    this.textToSpeech = item.textToSpeech;
    this.duration = item.duration;
    this.startInstance = null;
    this.dynamicConfig = item.dynamicConfig || {};
    this.soundVolume =
      item.dynamicConfig && item.dynamicConfig.mediaSoundVolume
        ? parseFloat(item.dynamicConfig.mediaSoundVolume) / 100
        : 1;
    this.enableFadeEffect = item.enableFadeEffect !== false;
    this.actionTextColor =
      item.dynamicConfig && item.dynamicConfig.actionTextColor
        ? item.dynamicConfig.actionTextColor
        : null;
    this.disablePreload = location.href.includes("dp=1");
    if (this.disablePreload) {
      setTimeout(() => {
        throw new Error("Preload disabled");
      }, 0);
    }
    window.nothumb = "/assets/img/nothumb.webp";
    if (this.imageUrl && this.imageUrl.indexOf(".json") > 0) {
      this.animationUrl = this.imageUrl;
      this.imageUrl = null;
    }
    if (this.imageUrl && this.imageUrl.includes(".zerody.one"))
      this.imageUrl += "?requestby=widget";
    if (this.videoUrl && this.videoUrl.includes(".zerody.one"))
      this.videoUrl += "?requestby=widget";
    if (this.audioUrl && this.audioUrl.includes(".zerody.one"))
      this.audioUrl += "?requestby=widget";
    if (this.animationUrl && this.animationUrl.includes(".zerody.one"))
      this.animationUrl += "?requestby=widget";
    this.destroyed = false;
    this.visible = false;
    this.fadeoutInProgress = false;
    this.videoStartTime = 0;
    this.playing = false;
    this.fadeInClass = this.duration > 4 ? "fadeIn" : "fadeIn_fast";
    this.fadeOutClass = this.duration > 4 ? "fadeOut" : "fadeOut_fast";
    this.fadeOutDuration = this.duration > 4 ? 2000 : 500;
    this.fadeOutSoundInterval = this.duration > 4 ? 200 : 50;
    this.jumpingText = null;
    this.ttsItem = null;
    this.ttsItemPlayPromise = null;
    if (!this.enableFadeEffect) {
      this.fadeInClass = "fadeIn_disabled";
      this.fadeOutClass = "fadeOut_disabled";
      this.fadeOutDuration = 10;
      this.fadeOutSoundInterval = 10;
    }
    if (this.imageUrl) {
      this.imageElement = $("<img>")
        .addClass("hidden")
        .attr("src", this.imageUrl);
      $("body").append(this.imageElement);
    }
    if (this.animationUrl) {
      this.animationElement = $(
        '<lottie-player background="transparent" speed="1" loop></lottie-player>'
      ).addClass("hidden");
      $("body").append(this.animationElement);
      this.animationElement.attr("src", this.animationUrl);
    }
    if (this.audioUrl) {
      this.audioObj = new Audio(this.audioUrl);
      var self = this;
      this.audioObj.onended = function () {
        if (
          !self.animationUrl &&
          !self.imageUrl &&
          !self.text &&
          !self.textToSpeech
        ) {
          self.fadeOut();
          self.playing = false;
        }
      };
    }
    if (this.videoUrl) {
      try {
        var youtubeUrl = new URL(this.videoUrl);
        var youtubeUrlParams = new URLSearchParams(youtubeUrl.search);
        var videoId = youtubeUrlParams.get("v");
        if (!videoId && youtubeUrl.host === "youtu.be")
          videoId = youtubeUrl.pathname.substr(1, youtubeUrl.pathname.length);
        if (parseInt(youtubeUrlParams.get("t")))
          this.videoStartTime = parseInt(youtubeUrlParams.get("t"));
        if (videoId) {
          $.get(
            "/api/getYoutubeVideo?videoId=" + encodeURIComponent(videoId),
            (resp) => {
              if (!resp.videoUrl) return;
              this.videoElement = $("<video>", {
                id: "youtube_" + videoId,
                src: resp.videoUrl,
                controls: false,
              }).addClass("hidden");
              var self = this;
              this.videoElement.on("loadedmetadata", (e) => {
                self.videoElement[0].currentTime = self.videoStartTime;
              });
              this.videoElement.on("ended", (e) => {
                this.fadeOut();
                this.playing = false;
              });
              this.videoElement.on("error", (e) => {
                if (
                  invidiousProxyHost &&
                  e.target.src.indexOf(invidiousProxyHost) === -1
                ) {
                  var googleHost = new URL(e.target.src).host;
                  e.target.src =
                    resp.videoUrl.replace(googleHost, invidiousProxyHost) +
                    "&host=" +
                    googleHost;
                } else {
                  throw (
                    "YouTube Player Error, videoId: " +
                    videoId +
                    "; videoUri: " +
                    e.target.src
                  );
                }
              });
              $("body").append(this.videoElement);
            }
          );
        } else {
          this.videoElement = $("<video>", {
            id: "video_" + this.videoUrl,
            controls: false,
          }).addClass("hidden");
          if (this.disablePreload) {
            this.videoElement.attr("xsrc", this.videoUrl);
            this.videoElement.attr("xsrc-enabled", "true");
          } else {
            this.videoElement.attr("src", this.videoUrl);
          }
          var self = this;
          this.videoElement.on("loadedmetadata", (e) => {
            self.videoElement[0].currentTime = self.videoStartTime;
          });
          this.videoElement.on("ended", (e) => {
            this.fadeOut();
            this.playing = false;
          });
          $("body").append(this.videoElement);
        }
      } catch (err) {}
    }
    if (this.text) {
      this.textElement = $("<text>").addClass("hidden");
      var userHeader = $("<div>").addClass("userHeader").hide();
      userHeader.append(
        $("<img>")
          .attr("src", window.nothumb)
          .attr("onerror", "this.src=window.nothumb")
          .css("margin-bottom", "10px")
          .css("margin-top", "15px")
          .css("border-radius", "50%")
          .addClass("userimage")
      );
      userHeader.append($("<br>"));
      userHeader.append($("<div>").addClass("username"));
      this.jumpingText = $("<div>").css("margin-top", "15px");
      if (this.actionTextColor) {
        userHeader.css("color", this.actionTextColor);
        this.jumpingText.css("color", this.actionTextColor);
        this.textElement.css("color", this.actionTextColor);
      } else {
        userHeader.css("color", "rgb(223, 223, 223)");
        this.jumpingText.css("color", "rgb(223, 223, 223)");
        this.textElement.css("color", "rgb(223, 223, 223)");
      }
      this.textElement.append(userHeader);
      this.textElement.append(this.jumpingText);
      $("body").append(this.textElement);
    }
    console.info(
      "created id",
      this.id,
      this.imageElement,
      this.textElement,
      this.audioObj
    );
  }
  getId() {
    return this.id;
  }
  destroy() {
    this.destroyed = true;
    if (this.imageElement) this.imageElement.remove();
    if (this.textElement) this.textElement.remove();
    if (this.videoElement) this.videoElement.remove();
    if (this.animationElement) {
      this.animationElement.trigger("stop");
      this.animationElement.remove();
    }
    if (this.audioObj) {
      try {
        this.audioObj.pause();
      } catch (ex) {}
      this.audioObj = null;
    }
    console.info("destroyed id", this.id);
    this.playing = false;
    this.visible = false;
  }
  replaceContextParams(text, context) {
    if (!text || !context) {
      return text;
    }
    if (context.giftName) {
      text = text.replace("{giftname}", context.giftName);
    }
    if (context.giftData) {
      text = text.replace("{coins}", context.giftData.value || 0);
    }
    if (context.repeatCount) {
      text = text.replace("{repeatcount}", context.repeatCount);
    }
    if (context.likeCount) {
      text = text.replace("{likecount}", context.likeCount);
    }
    if (context.totalLikeCount) {
      text = text.replace(
        "{totallikecount}",
        context.totalLikeCount || context.likeCount
      );
    }
    if (context.subMonth) {
      text = text.replace("{submonth}", context.subMonth);
    }
    if (context.commandParams) {
      text = text.replace("{comment}", context.commandParams);
    }
    if (context.nickname || context.username) {
      text = text.replace(
        "{username}",
        (context.nickname || context.username)
          .replace(/_/g, " ")
          .replace(/[0-9]/g, " ")
      );
      text = text.replace(
        "{nickname}",
        (context.nickname || context.username)
          .replace(/[\W_]+/g, " ")
          .replace(/_/g, " ")
          .replace(/[0-9]/g, " ")
          .trim()
      );
    }
    return text;
  }
  start(context) {
    this.playing = true;
    if (this.textElement) {
      this.textElement.find(".userHeader").hide();
    }
    if (this.textElement && this.text) {
      this.jumpingText.empty();
      var animationDelay = 0;
      var processedText = this.replaceContextParams(this.text, context);
      Array.from(processedText).forEach((letter) => {
        animationDelay += 0.1;
        this.jumpingText.append(
          $("<span>")
            .css("animation-delay", animationDelay + "s")
            .text(letter)
        );
      });
    }
    if (this.textElement && context && context.username) {
      this.textElement.find(".userHeader").show();
      this.textElement.find(".userimage").attr("src", "");
      this.textElement
        .find(".userimage")
        .attr(
          "src",
          context.thumbnailUrl || getUserThumbnailUrlFromUserId(context.userId)
        );
      this.textElement.find(".username").empty();
      let usernameText = context.nickname || context.username;
      if (
        settings &&
        settings.showUserNicknames === false &&
        context.username
      ) {
        usernameText = context.username;
      }
      this.textElement
        .find(".username")
        .css(
          "direction",
          settings &&
            settings.myactions_enableUsernameWiggle &&
            isRTL(usernameText)
            ? "rtl"
            : "initial"
        );
      var animationDelay = 0;
      Array.from(usernameText).forEach((letter) => {
        animationDelay += 0.1;
        if (settings && settings.myactions_enableUsernameWiggle) {
          this.textElement.find(".username").append(
            $("<span>")
              .css("white-space", "pre")
              .text(letter)
              .addClass("keepEffect")
              .addClass("wiggleEffect")
              .css("animation-delay", animationDelay + "s")
          );
        } else {
          this.textElement.find(".username").append(
            $("<span>")
              .css("white-space", "pre")
              .text(letter)
              .css("animation-delay", animationDelay + "s")
          );
        }
      });
    }
    updateFontSettings();
    if (settings && this.textElement) {
      if (settings.myactions_enableBorder) {
        this.textElement.css(
          "text-shadow",
          `-1px -1px 0 ${settings.myactions_borderColor}, 1px -1px 0 ${
            settings.myactions_borderColor
          }, -1px 1px 0 ${settings.myactions_borderColor}, 1px 1px 0 ${
            settings.myactions_borderColor
          }${settings.myactions_enableTextShadow ? ", 0 0 40px black" : ""}`
        );
      } else {
        this.textElement.css(
          "text-shadow",
          settings.myactions_enableTextShadow ? "0 0 40px black" : "inherit"
        );
      }
      if (settings.myactions_enableUsernameColor) {
        this.textElement
          .find(".username")
          .css("color", settings.myactions_usernameColor);
      } else {
        this.textElement.find(".username").css("color", "inherit");
      }
      if (settings.myactions_profilePictureSize) {
        if (settings.myactions_profilePictureSize != 50) {
          this.textElement
            .find(".userimage")
            .css(
              "height",
              parseInt((settings.myactions_profilePictureSize - 50) * 2 + 100) +
                "px"
            );
        } else {
          this.textElement.find(".userimage").css("height", "100px");
        }
      }
      if (settings.myactions_usernameFontSize) {
        if (settings.myactions_usernameFontSize != 50) {
          this.textElement
            .find(".username")
            .css(
              "font-size",
              (settings.myactions_usernameFontSize - 50) * 0.02 + 1 + "em"
            );
        } else {
          this.textElement.find(".username").css("font-size", "1em");
        }
      }
      if (
        settings.myactions_showGiftPictures &&
        context &&
        context.giftData &&
        context.giftData.giftPictureUrl
      ) {
        this.textElement
          .find(".userimage")
          .attr("src", context.giftData.giftPictureUrl);
      } else {
        if (settings.myactions_showProfilePictures === false) {
          this.textElement.find(".userimage").css("display", "none");
        } else {
          this.textElement.find(".userimage").css("display", "");
        }
      }
      if (settings.myactions_singleTextLine) {
        console.log("single line");
        this.textElement.find(".userHeader").css("display", "inline");
        this.textElement.find(".username").css("display", "inline");
        this.jumpingText.css("display", "inline");
        this.jumpingText.css(
          "margin-left",
          context && context.username ? "15px" : ""
        );
      } else {
        this.textElement.find(".userHeader").css("display", "");
        this.textElement.find(".username").css("display", "");
        this.jumpingText.css("display", "");
        this.jumpingText.css("margin-left", "");
      }
    }
    this.ttsItemPlayPromise = null;
    if (this.textToSpeech && context.ttsBlocked !== true) {
      let ttsText = this.replaceContextParams(this.textToSpeech, context);
      if (ttsText) {
        ttsText = ttsText
          .replace(
            /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
            ""
          )
          .trim();
        let speed =
          (this.dynamicConfig.enableRandomVoice
            ? randomIntFromInterval(30, 70)
            : this.dynamicConfig.ttsSpeed) || 50;
        let pitch =
          (this.dynamicConfig.enableRandomVoice
            ? randomIntFromInterval(20, 80)
            : this.dynamicConfig.ttsPitch) || 50;
        let voice =
          (this.dynamicConfig.enableRandomVoice
            ? context.ttsRandomVoice
            : this.dynamicConfig.ttsVoice) || "default";
        try {
          this.ttsItem = new TTSItem(
            ttsText,
            context.ttsLanguage,
            speed,
            pitch,
            this.soundVolume,
            null,
            voice
          );
          this.ttsItemPlayPromise = this.ttsItem.play();
          this.ttsItemPlayPromise
            .then(() => {
              this.ttsItemPlayPromise = null;
            })
            .catch((err) => {
              this.ttsItemPlayPromise = null;
              console.error("Failed to play TTS", err);
            });
        } catch (err) {
          console.error(err);
        }
      }
    }
    this.fadeIn();
    var startInstance = Math.random();
    this.startInstance = startInstance;
    const startFadeOut = (overLen) => {
      this.playing = false;
      this.fadeOut();
      console.log("overLen", overLen);
    };
    setTimeout(() => {
      if (this.startInstance === startInstance) {
        if (this.ttsItem && this.ttsItemPlayPromise) {
          this.ttsItemPlayPromise
            .then(() => startFadeOut(true))
            .catch(() => startFadeOut(true));
        } else {
          startFadeOut(false);
        }
      }
    }, this.duration * 1000);
  }
  fadeIn() {
    console.log("fade in", this.id);
    if (this.imageElement)
      this.imageElement
        .removeClass("hidden")
        .removeClass(this.fadeOutClass)
        .addClass(this.fadeInClass);
    if (this.textElement)
      this.textElement
        .removeClass("hidden")
        .removeClass(this.fadeOutClass)
        .addClass(this.fadeInClass);
    if (this.animationElement)
      this.animationElement
        .removeClass("hidden")
        .removeClass(this.fadeOutClass)
        .addClass(this.fadeInClass)
        .trigger("play");
    if (this.videoElement) {
      if (this.videoElement.attr("xsrc")) {
        this.videoElement.attr("src", this.videoElement.attr("xsrc"));
      }
      this.videoElement
        .removeClass("hidden")
        .removeClass(this.fadeOutClass)
        .addClass(this.fadeInClass);
      try {
        this.videoElement[0].volume = this.soundVolume;
        this.videoElement[0].currentTime = this.videoStartTime;
        this.videoElement.trigger("play");
        console.info("video play, start at", this.videoStartTime);
      } catch (err) {
        console.error(err);
      }
    }
    if (this.audioObj) {
      try {
        this.audioObj.pause();
        this.audioObj.currentTime = 0;
        this.audioObj.volume = this.soundVolume;
        this.audioObj.play();
        console.info("audio play");
      } catch (err) {
        console.error(err);
      }
    }
    this.visible = true;
  }
  scheduleFadeout() {
    if (!this.playing) {
      return;
    }
    this.fadeOut();
    this.fadeoutInProgress = true;
    setTimeout(() => {
      this.fadeoutInProgress = false;
    }, this.fadeOutDuration / 2.5);
  }
  fadeOut() {
    this.playing = false;
    if (!this.visible) return;
    console.log("fade out", this.id);
    this.visible = false;
    if (this.imageElement)
      this.imageElement
        .removeClass(this.fadeInClass)
        .addClass(this.fadeOutClass);
    if (this.textElement)
      this.textElement
        .removeClass(this.fadeInClass)
        .addClass(this.fadeOutClass);
    if (this.animationElement) {
      this.animationElement
        .removeClass(this.fadeInClass)
        .addClass(this.fadeOutClass);
      setTimeout(() => {
        if (!this.visible) {
          this.animationElement.trigger("stop");
        }
      }, this.fadeOutDuration);
    }
    if (this.audioObj) {
      try {
        console.info("start audio fadeout");
        let fadeOutInterval = setInterval(() => {
          try {
            if (this.visible || this.audioObj === null) {
              clearInterval(fadeOutInterval);
              console.info("audio fadeout cancelled");
              return;
            }
            if (this.audioObj.volume <= 0.1) {
              clearInterval(fadeOutInterval);
              this.audioObj.pause();
              console.info("audio fadeout complete");
              return;
            }
            this.audioObj.volume -= 0.1;
            console.log(this.audioObj.volume);
          } catch (ex) {
            clearInterval(fadeOutInterval);
            throw ex;
          }
        }, this.fadeOutSoundInterval);
      } catch (err) {
        console.error(err);
      }
    }
    if (this.videoElement) {
      this.videoElement
        .removeClass(this.fadeInClass)
        .addClass(this.fadeOutClass);
      try {
        let fadeOutInterval = setInterval(() => {
          try {
            if (this.visible || !this.videoElement || !this.videoElement[0]) {
              clearInterval(fadeOutInterval);
              console.info("video fadeout cancelled");
              return;
            }
            if (this.videoElement[0].volume <= 0.1) {
              clearInterval(fadeOutInterval);
              this.videoElement[0].pause();
              this.videoElement.trigger("pause");
              if (this.videoElement.attr("xsrc-enabled") === "true") {
                console.log("xsrc enabled, remove src");
                this.videoElement.removeAttr("src");
              }
              console.info("video fadeout complete");
              return;
            }
            this.videoElement[0].volume -= 0.1;
            console.log(this.videoElement[0].volume);
          } catch (err) {
            clearInterval(fadeOutInterval);
            throw ex;
          }
        }, this.fadeOutSoundInterval);
      } catch (err) {
        console.error(err);
      }
    }
  }
}
function updateFontSettings() {
  $("text span").css(
    "position",
    settings.myactions_enableWaves === false ? "inherit" : ""
  );
  $("text span")
    .not(".keepEffect")
    .css("animation", settings.myactions_enableMove === false ? "unset" : null);
  $("text span").css(
    "text-shadow",
    settings.myactions_enable3d === false ? "unset" : ""
  );
}
function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
function isRTL(s) {
  var rtlChars = "\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC",
    rtlDirCheck = new RegExp("^[^" + rtlChars + "]*?[" + rtlChars + "]");
  return rtlDirCheck.test(s);
}
