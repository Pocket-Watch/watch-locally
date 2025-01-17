export { Player, Options };

class Player {
    constructor(videoElement, options) {
        if (!videoElement || videoElement.tagName.toLowerCase() !== "video") {
            throw new Error("An invalid video element was passed!");
        }

        if (!(options instanceof Options) || !options.valid()) {
            options = new Options();
        }
        this.internals = new Internals(videoElement, options);
    }

    isPlaying() {
        return this.internals.isVideoPlaying();
    }

    play() {
        this.internals.play();
    }

    pause() {
        this.internals.pause();
    }

    seek(timestamp) {
        this.internals.seek(timestamp);
    }

    setVolume(volume) {
        this.internals.setVolume(volume);
    }

    setTitle(title) {
        this.internals.setTitle(title);
    }

    setPoster(url) {
        this.internals.setPoster(url);
    }

    setSpeed(speed) {
        this.internals.setSpeed(speed);
    }

    setToast(toast) {
        this.internals.setToast(toast);
    }

    isLive() {
        return this.internals.isLive;
    }

    isLooping() {
        // return this.internals.htmlVideo.loop;
        return this.internals.loopEnabled;
    }

    setLooping(enabled) {
        // this.internals.htmlVideo.loop = true;
        this.internals.setLooping(enabled);
    }

    setAutoplay(enabled) {
        this.internals.setAutoplay(enabled);
    }

    getAutoplay() {
        return this.internals.autoplayEnabled;
    }

    getCurrentTime() {
        return this.internals.getCurrentTime();
    }

    getDuration() {
        return this.internals.htmlVideo.duration;
    }

    setSubtitle(subtitleUrl) {
        this.internals.addSubtitle(subtitleUrl, true);
    }

    addSubtitle(subtitleUrl) {
        return this.internals.addSubtitle(subtitleUrl, false);
    }

    // Disables and removes the track at the specified index.
    removeSubtitleTrackAt(index) {
        this.internals.removeSubtitleTrackAt(index);
    }

    clearAllSubtitleTracks() {
        this.internals.clearAllSubtitleTracks();
    }

    // Select and show the track at the specified index.
    enableSubtitleTrackAt(index) {
        let subtitles = this.internals.subtitles;
        if (index < 0 || index >= subtitles.length) {
            return;
        }
        let subtitle = subtitles[index];
        this.internals.enableSubtitleTrack(subtitle);
    }

    // The seconds argument is a double, negative shifts back, positive shifts forward
    shiftCurrentSubtitleTrackBy(seconds) {
        return this.internals.shiftCurrentSubtitleTrackBy(seconds)
    }

    destroyPlayer() {}

    onControlsPlay(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsPlay = func;
    }

    onControlsPause(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsPause = func;
    }

    onControlsNext(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsNext = func;
    }

    onControlsLooping(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsLooping = func;
    }

    onControlsAutoplay(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsAutoplay = func;
    }

    onFullscreenChange(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireFullscreenChange = func;
    }

    onControlsSeeking(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsSeeking = func;
    }

    onControlsSeeked(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsSeeked = func;
    }

    onControlsVolumeSet(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireControlsVolumeSet = func;
    }

    onPlaybackError(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.firePlaybackError = func;
    }

    onPlaybackEnd(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.firePlaybackEnd = func;
    }

    onSubtitleTrackLoad(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireSubtitleTrackLoad = func;
    }

    onSubtitleSearch(func) {
        if (!isFunction(func)) {
            return;
        }
        this.internals.fireSubtitleSearch = func;
    }

    setVideoTrack(url) {
        this.internals.setVideoTrack(url);
    }

    getCurrentUrl() {
        return this.internals.getCurrentUrl();
    }

    discardPlayback() {
        return this.internals.discardPlayback();
    }
}

function hide(element) {
    element.style.display = "none";
}

function show(element) {
    element.style.display = "";
}

function isHidden(element) {
    return element.style.display === "none";
}

class Internals {
    constructor(videoElement, options) {
        let initStart = performance.now();
        this.options = options;

        this.hls = null;
        this.playingHls = false;
        this.isLive = false;

        this.loopEnabled = false;
        this.autoplayEnabled = false;

        this.htmlVideo = videoElement;
        this.htmlVideo.disablePictureInPicture = true;
        this.htmlVideo.controls = false;

        // Prevents selecting the video element along with the rest of the page
        this.htmlVideo.classList.add("unselectable");

        // Div container where either the player or the placeholder resides.
        this.htmlPlayerRoot = newDiv("player_container");

        // We actually need to append the <div> to document.body (or <video>'s parent)
        // otherwise the <video> tag will disappear entirely!
        let videoParent = this.htmlVideo.parentNode;
        videoParent.insertBefore(this.htmlPlayerRoot, this.htmlVideo);
        this.htmlPlayerRoot.appendChild(this.htmlVideo);

        this.htmlTitleContainer = newDiv("player_title_container");
        hide(this.htmlTitleContainer);
        this.htmlPlayerRoot.appendChild(this.htmlTitleContainer);

        this.htmlTitle = newElement("span", "player_title_text");
        this.htmlTitleContainer.appendChild(this.htmlTitle);

        this.htmlToastContainer = newDiv("player_toast_container");
        hide(this.htmlToastContainer);
        this.htmlPlayerRoot.appendChild(this.htmlToastContainer);
        this.htmlToast = newElement("span", "player_toast_text");
        this.htmlToastContainer.appendChild(this.htmlToast);

        this.playerHideToastTimeoutId = null;

        this.icons = {
            play:             "svg/player_icons.svg#play",
            play_popup:       "svg/player_icons.svg#play_popup",
            pause:            "svg/player_icons.svg#pause",
            pause_popup:      "svg/player_icons.svg#pause_popup",
            replay:           "svg/player_icons.svg#replay",
            next:             "svg/player_icons.svg#next",
            loop:             "svg/player_icons.svg#loop",
            volume_full:      "svg/player_icons.svg#volume_full",
            volume_medium:    "svg/player_icons.svg#volume_medium",
            volume_low:       "svg/player_icons.svg#volume_low",
            volume_muted:     "svg/player_icons.svg#volume_muted",
            download:         "svg/player_icons.svg#download",
            speed:            "svg/player_icons.svg#speed",
            autoplay:         "svg/player_icons.svg#autoplay",
            subs:             "svg/player_icons.svg#subs",
            settings:         "svg/player_icons.svg#settings",
            fullscreen_enter: "svg/player_icons.svg#fullscreen_enter",
            fullscreen_exit:  "svg/player_icons.svg#fullscreen_exit",
            arrow_left:       "svg/player_icons.svg#arrow_left",
            arrow_right:      "svg/player_icons.svg#arrow_right",
            buffering:        "svg/player_icons.svg#buffering",
        };

        this.svgs = {
            playback:   Svg.new(this.icons.play),
            next:       Svg.new(this.icons.next),
            loop:       Svg.new(this.icons.loop),
            volume:     Svg.new(this.icons.volume_full),
            download:   Svg.new(this.icons.download),
            speed:      Svg.new(this.icons.speed),
            autoplay:   Svg.new(this.icons.autoplay),
            subs:       Svg.new(this.icons.subs),
            settings:   Svg.new(this.icons.settings),
            fullscreen: Svg.new(this.icons.fullscreen_enter),

            seekForward:   SeekIcon.newForward(options.seekBy + 's', 100, 100),
            seekBackward:  SeekIcon.newBackward(options.seekBy + 's', 100, 100),
            playbackPopup: Svg.new(this.icons.play_popup, 70, 70),

            arrowLeft:  Svg.new(this.icons.arrow_left, 20, 20),
            arrowRight: Svg.new(this.icons.arrow_right, 20, 20),

            buffering: Svg.new(this.icons.buffering, 70, 70),
        };

        this.bufferingSvg = this.svgs.buffering.svg;
        this.bufferingSvg.id = "player_buffering";
        hide(this.bufferingSvg);
        this.htmlPlayerRoot.appendChild(this.bufferingSvg);

        this.bufferingTimeoutId = null;

        this.playbackPopupSvg = this.svgs.playbackPopup.svg;
        this.playbackPopupSvg.id = "player_playback_popup";
        hide(this.playbackPopupSvg);
        this.htmlPlayerRoot.appendChild(this.playbackPopupSvg);

        this.playbackPopupTimeoutId = null;

        this.htmlControls = {
            root: newDiv("player_controls"),
            progress: {
                root:      newDiv("player_progress_root"),
                current:   newDiv("player_progress_current", "player_progress_bar"),
                buffered:  newElement("canvas", "player_progress_buffered", "player_progress_bar"),
                total:     newDiv("player_progress_total", "player_progress_bar"),
                thumb:     newDiv("player_progress_thumb"),
                popupRoot: newDiv("player_progress_popup_root"),
                popupText: newDiv("player_progress_popup_text"),
            },

            buttons: {
                root:             newDiv("player_control_buttons"),
                playbackButton:   newDiv(null, "player_controls_button"),
                nextButton:       newDiv(null, "player_controls_button"),
                loopButton:       newDiv(null, "player_controls_button"),
                volumeButton:     newDiv(null, "player_controls_button"),
                downloadButton:   newDiv(null, "player_controls_button"),
                speedButton:      newDiv(null, "player_controls_button"),
                autoplayButton:   newDiv(null, "player_controls_button"),
                subsButton:       newDiv(null, "player_controls_button"),
                settingsButton:   newDiv(null, "player_controls_button"),
                fullscreenButton: newDiv(null, "player_controls_button"),

                volumeProgress: newDiv("player_volume_progress"),
                volumeInput:    newElement("input", "player_volume_input"),
                liveIndicator:  newDiv("player_live_indicator"),
                timestamp:      newElement("span",  "player_timestamp"),
            },

            subMenu: {
                root: newDiv(null, "player_menu_root"),

                selected: {
                    tab:    null,
                    view:   null,
                    track:  null,
                },

                /// Part of the select view. Switch widget indicating whether subtitles are enabled or not.
                subsSwitcher: new Switcher("Enable subtitles"),

                /// Part of the select view, html track elements are appended here.
                trackList: newDiv("subtitle_track_list"),
            },

            settings: {
                root: newDiv(null, "player_menu_root"),

                selected: {
                    tab:    null,
                    view:   null,
                    track:  null,
                },
            }
        };

        this.subtitleShift = new Slider("Subtitle shift", -20, 20, 0.1, 0, "s", true);

        this.isDraggingProgressBar = false;
        this.isUIVisible = true;
        this.volumeBeforeMute = 0.0;

        this.subtitles = [];
        this.selectedSubtitle = null;
        this.activeCues = [];

        this.htmlSeekForward = newDiv("player_forward_container", "unselectable");
        this.htmlSeekForward.appendChild(this.svgs.seekForward.svg);
        this.htmlPlayerRoot.appendChild(this.htmlSeekForward);

        this.htmlSeekBackward = newDiv("player_backward_container", "unselectable");
        this.htmlSeekBackward.appendChild(this.svgs.seekBackward.svg);
        this.htmlPlayerRoot.appendChild(this.htmlSeekBackward);

        this.subtitleContainer = newDiv("player_subtitle_container");
        this.subtitleText      = newDiv("player_subtitle_text");

        this.htmlPlayerRoot.appendChild(this.subtitleContainer);
        this.subtitleContainer.appendChild(this.subtitleText);

        this.createHtmlControls();
        this.attachPlayerEvents();

        setInterval(() => this.redrawBufferedBars(), this.options.bufferingRedrawInterval);
        let end = performance.now();
        console.debug("Internals constructor finished in", end-initStart, "ms")

        this.setVolume(1.0);

        let isSafari = navigator.userAgent.includes("Safari");
        if (isSafari) {
            this.rebindFullscreenAPIFromWebkit();
        }
    }

    fireControlsPlay() {}
    fireControlsPause() {}
    fireControlsNext() {}
    fireControlsLooping(_enabled) {}
    fireControlsAutoplay(_enabled) {}
    fireFullscreenChange(_enabled) {}
    fireControlsSeeking(_timestamp) {}
    fireControlsSeeked(_timestamp) {}
    fireControlsVolumeSet(_volume) {}
    firePlaybackError(_exception, _mediaError) {}
    firePlaybackEnd() {}
    fireSubtitleTrackLoad(_subtitle) {}
    fireSubtitleSearch(_search) {}

    isVideoPlaying() {
        return !this.htmlVideo.paused && !this.htmlVideo.ended;
    }

    play() {
        if (this.isVideoPlaying()) {
            return;
        }

        this.svgs.playback.setHref(this.icons.pause);

        this.htmlVideo.play().catch(exception => {
            clearTimeout(this.bufferingTimeoutId);
            hide(this.bufferingSvg);

            this.firePlaybackError(exception, this.htmlVideo.error);
        });
    }

    pause() {
        if (!this.isVideoPlaying()) {
            return;
        }

        this.svgs.playback.setHref(this.icons.play);
        this.htmlVideo.pause();
    }

    seek(timestamp) {
        if (isNaN(timestamp)) {
            return;
        }

        if (this.isVideoPlaying()) {
            this.svgs.playback.setHref(this.icons.pause);
        } else {
            this.svgs.playback.setHref(this.icons.play);
        }

        this.htmlVideo.currentTime = timestamp;
    }

    updateProgressBar(progress) {
        this.htmlControls.progress.current.style.width = progress * 100 + "%"

        const width = this.htmlControls.progress.root.clientWidth;
        let thumb_left = width * progress;
        thumb_left -= this.htmlControls.progress.thumb.offsetWidth / 2.0;
        this.htmlControls.progress.thumb.style.left = thumb_left + "px";
    }

    updateTimestamps(timestamp) {
        let duration = 0.0;
        let position = 0.0;

        if (!isNaN(this.htmlVideo.duration) && this.htmlVideo.duration !== 0.0) {
            duration = this.htmlVideo.duration;
            position = timestamp / duration;
        }

        if (!this.isDraggingProgressBar) {
            this.updateProgressBar(position);
        }

        let current_string = createTimestampString(this.htmlVideo.currentTime);
        let duration_string = createTimestampString(duration);

        this.htmlControls.buttons.timestamp.textContent = current_string + " / " + duration_string;
    }

    // Proof of concept:
    // - sanitize cues on load (below 100ms)
    // - how to handle unsorted subtitles
    // - heuristic performance offset?
    updateSubtitles(time) {
        if (!this.selectedSubtitle) {
            return;
        }

        time += this.selectedSubtitle.offset;

        // TODO: check if TextTrack.cues are a live list
        let cues = this.selectedSubtitle.cues;
        let whereabouts = binarySearchForCue(time, cues);
        let freshCues = [];
        for (let r = whereabouts; r < cues.length; r++) {
            let cue = cues[r];
            if (cue.startTime <= time && time <= cue.endTime) {
                freshCues.push(cue)
                continue;
            }
            break;
        }

        for (let l = whereabouts - 1; l > - 1; l--) {
            // If cue time is not less than endTime then there is no time to display it anyway
            let cue = cues[l];
            if (time < cue.startTime || cue.endTime <= time) {
                break;
            }

            freshCues.push(cue);
        }

        if (freshCues.length === 0) {
            if (this.activeCues.length > 0) {
                this.activeCues.length = 0;
                hide(this.subtitleContainer);
            }
            return;
        }

        if (areArraysEqual(freshCues, this.activeCues)) {
            return;
        }

        let captionText = "";
        if (this.options.allowCueOverlap) {
            for (let i = 0; i < freshCues.length; i++) {
                captionText += freshCues[i].text + '\n';
            }
        } else {
            captionText = freshCues[freshCues.length - 1];
        }

        this.activeCues = freshCues;
        this.subtitleText.innerHTML = captionText;

        if (this.htmlControls.subMenu.subsSwitcher.enabled) {
            show(this.subtitleContainer);
        }
    }

    updateProgressPopup(progress) {
        let timestamp = this.htmlVideo.duration * progress;
        this.htmlControls.progress.popupText.textContent = createTimestampString(timestamp);

        const popup = this.htmlControls.progress.popupRoot;
        const popupWidth = popup.clientWidth;
        const rootWidth = this.htmlControls.progress.root.clientWidth;

        let position = rootWidth * progress - popupWidth / 2.0;

        if (position < 0) {
            position = 0;
        } else if (position + popupWidth > rootWidth) {
            position = rootWidth - popupWidth;
        }

        this.htmlControls.progress.popupRoot.style.left = position + "px";
    }

    updateHtmlVolume(volume) {
        if (volume > 1.0) {
            volume = 1.0;
        }

        if (volume < 0.0) {
            volume = 0.0;
        }

        if (volume == 0.0) {
            this.svgs.volume.setHref(this.icons.volume_muted);
        } else if (volume < 0.3) {
            this.svgs.volume.setHref(this.icons.volume_low);
        } else if (volume < 0.6) {
            this.svgs.volume.setHref(this.icons.volume_medium);
        } else {
            this.svgs.volume.setHref(this.icons.volume_full);
        }

        let input = this.htmlControls.buttons.volumeInput;
        input.value = volume;

        let progress = this.htmlControls.buttons.volumeProgress;
        progress.style.width = volume * 100.0 + "%";
    }

    getNewTime(timeOffset) {
        let timestamp = this.htmlVideo.currentTime + timeOffset;
        if (timestamp < 0) {
            timestamp = 0;
        }
        return timestamp;
    }

    setVolume(volume) {
        if (volume > 1.0) {
            volume = 1.0;
        }

        if (volume < 0.0) {
            volume = 0.0;
        }

        this.htmlVideo.volume = volume;
        this.updateHtmlVolume(volume);
    }

    setVolumeRelative(volume) {
        this.setVolume(this.htmlVideo.volume + volume);
    }

    setTitle(title) {
        if (!title) {
            hide(this.htmlTitleContainer);
        } else {
            show(this.htmlTitleContainer);
            this.htmlTitle.textContent = title;
        }
    }

    setSpeed(speed) {
        if (isNaN(speed)) {
            speed = 1;
        }
        this.htmlVideo.playbackRate = speed;
    }

    setPoster(url) {
        if (url) {
            this.htmlVideo.poster = url;
        } else {
            this.htmlVideo.poster = "";
        }
    }

    showPlaybackPopup() {
        show(this.playbackPopupSvg);
        this.playbackPopupSvg.classList.remove("hide");

        clearTimeout(this.playbackPopupTimeoutId);
        this.playbackPopupTimeoutId = setTimeout(_ => {
            this.playbackPopupSvg.classList.add("hide");
        }, 200);
    }

    setToast(toast) {
        this.htmlToast.textContent = toast;
        this.htmlToastContainer.classList.remove("hide");
        show(this.htmlToastContainer);

        clearTimeout(this.playerHideToastTimeoutId);
        this.playerHideToastTimeoutId = setTimeout(_ => {
            this.htmlToastContainer.classList.add("hide");
        }, 3000);
    }

    setLooping(enabled) {
        this.loopEnabled = enabled;
        let loop = this.htmlControls.buttons.loopButton;
        if (enabled) {
            loop.classList.add("player_controls_button_selected");
        } else {
            loop.classList.remove("player_controls_button_selected");
        }
    }

    setAutoplay(enabled) {
        this.autoplayEnabled = enabled;
        let autoplay = this.htmlControls.buttons.autoplayButton;
        if (enabled) {
            autoplay.classList.add("player_controls_button_selected");
        } else {
            autoplay.classList.remove("player_controls_button_selected");
        }
    }

    getCurrentTime() {
        return this.htmlVideo.currentTime;
    }

    getCurrentUrl() {
        if (this.playingHls) {
            return this.hls.url;
        }
        return this.htmlVideo.src;
    }

    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
            this.svgs.fullscreen.setHref(this.icons.fullscreen_enter);
            this.fireFullscreenChange(false)
        } else {
            this.htmlPlayerRoot.requestFullscreen();
            this.svgs.fullscreen.setHref(this.icons.fullscreen_exit);
            this.fireFullscreenChange(true)
        }
    }

    togglePlayback() {
        if (this.htmlVideo.paused) {
            this.fireControlsPlay();
            this.play();
        } else {
            this.fireControlsPause();
            this.pause();
        }
    }

    setVideoTrack(url) {
        if(URL.canParse && !URL.canParse(url, document.baseURI)){
            console.debug("Failed to set a new URL. It's not parsable.");
            // We should probably inform the user about the error either via debug log or return false
            return;
        }
        // This covers both relative and fully qualified URLs because we always specify the base
        // and when the base is not provided, the second argument is used to construct a valid URL
        let pathname = new URL(url, document.baseURI).pathname;

        this.seek(0);

        hide(this.htmlControls.buttons.liveIndicator);
        this.isLive = false;

        if (pathname.endsWith(".m3u8") || pathname.endsWith(".ts")) {
            import("../external/hls.js").then(module => {
                if (module.Hls.isSupported()) {
                    if (this.hls == null) {
                        this.hls = new module.Hls({
                            // If these controllers are used, they'll clear tracks or cues when HLS is attached/detached.
                            // HLS does not provide a way to make it optional, therefore we don't want HLS to mess with
                            // our subtitle tracks, handling it would require hacky solutions or modifying HLS source code
                            timelineController: null,
                            subtitleTrackController: null,
                            subtitleStreamController: null,
                        });

                        this.hls.on(module.Hls.Events.MANIFEST_PARSED, (_, data) => {
                            if (!data.levels || data.levels.length === 0) {
                                return;
                            }

                            let details = data.levels[0].details;
                            if (details) {
                                this.isLive = details.live;
                            }

                            if (this.isLive) {
                                show(this.htmlControls.buttons.liveIndicator);
                            }
                        });
                    }

                    this.hls.loadSource(url);
                    this.hls.attachMedia(this.htmlVideo);
                    this.playingHls = true;
                }
            });
        } else {
            if (this.playingHls) {
                this.hls.detachMedia();
                this.playingHls = false;
                this.isLive = false;
            }
            this.htmlVideo.src = url;
            this.htmlVideo.load();
        }
    }

    discardPlayback() {
        this.pause();
        if (this.playingHls) {
            this.hls.detachMedia();
            this.playingHls = false;
            this.isLive = false;
        }
        // There's no reliable way to discard src value once it's set
        this.htmlVideo.src = "";
        this.htmlVideo.currentTime = 0;
    }

    addSubtitle(url, show, info) {
        if (!info) {
            info = FileInfo.fromUrl(url)
        }

        let ext = info.extension;
        if (ext !== "vtt" && ext !== "srt") {
            console.debug("Unsupported subtitle extension:", ext)
            return
        }

        fetch(url).then(async response => {
            let text = await response.text();

            let parseStart = performance.now();
            let cues;
            if (ext === "vtt") {
                cues = parseVtt(text);
            } else {
                cues = parseSrt(text);
            }

            console.debug("Parsed", ext, "track, cue count:", cues.length, "in", performance.now() - parseStart, "ms")

            if (cues.length === 0) {
                return
            }

            if (this.options.sanitizeSubtitles) {
                let sanitizeStart = performance.now();
                for (let i = 0; i < cues.length; i++) {
                    cues[i].text = sanitizeHTMLForDisplay(cues[i].text);
                }

                console.debug("Sanitized in", performance.now() - sanitizeStart, "ms")
            }

            let subtitle = new Subtitle(cues, info.filename, info.extension);
            subtitle.htmlTrack.onclick = _ => this.switchSubtitleTrack(subtitle);

            if (show) {
                this.enableSubtitleTrack(subtitle);
            }

            URL.revokeObjectURL(url)

            let trackList = this.htmlControls.subMenu.trackList;
            trackList.appendChild(subtitle.htmlTrack);
            this.subtitles.push(subtitle);

            this.fireSubtitleTrackLoad(subtitle);
        });
    }

    enableSubtitleTrack(subtitle) {
        if (!subtitle) {
            return;
        }

        this.selectedSubtitle = subtitle;
        this.htmlControls.subMenu.subsSwitcher.setState(true);
        this.markSubtitleSelected(subtitle);
        this.subtitleShift.setValue(this.selectedSubtitle.offset);
        this.updateSubtitles(this.getCurrentTime());
    }

    switchSubtitleTrack(subtitle) {
        if (!subtitle) {
            return;
        }

        this.selectedSubtitle = subtitle;
        this.markSubtitleSelected(subtitle);
        this.subtitleShift.setValue(this.selectedSubtitle.offset);
        this.updateSubtitles(this.getCurrentTime());
    }

    shiftCurrentSubtitleTrackBy(seconds) {
        if (this.selectedSubtitle) {
            this.selectedSubtitle.offset += seconds;
            this.subtitleShift.setValue(this.selectedSubtitle.offset);
            this.updateSubtitles(this.getCurrentTime());
        }
    }

    // TOOD(kihau): Also public API?
    setCurrentSubtitleShift(offset) {
        if (this.selectedSubtitle) {
            this.selectedSubtitle.offset = offset;
            this.subtitleShift.setValue(this.selectedSubtitle.offset);
            this.updateSubtitles(this.getCurrentTime());
        }
    }

    removeSubtitleTrackAt(index) {
        let subtitles = this.subtitles;
        if (index < 0 || index >= this.subtitles.length) {
            return;
        }
        let list = this.htmlControls.subMenu.trackList;
        let track = list.children[index];
        if (this.selectedSubtitle != null && track === this.selectedSubtitle.htmlTrack) {
            this.selectedSubtitle = null;
            this.activeCues.length = 0;
        }
        list.removeChild(track);
        subtitles.splice(index, 1);
    }
    
    clearAllSubtitleTracks() {
        this.subtitles = [];
        this.selectedSubtitle = null;
        this.activeCues = [];

        let list = this.htmlControls.subMenu.trackList;
        while (list.lastChild) {
            list.removeChild(list.lastChild);
        }

        hide(this.subtitleContainer);
    }

    setSubtitleFontSize(fontSize) {
        this.subtitleText.style.fontSize = fontSize + "px";
    }

    setSubtitleForeground(color) {
        this.subtitleText.style.color = color;
    }

    setSubtitleBackground(color) {
        this.subtitleText.style.backgroundColor = color;
    }

    setSubtitleVerticalPosition(percentage) {
        let playerHeight = this.htmlPlayerRoot.offsetHeight;
        let subsHeight = this.subtitleContainer.offsetHeight;

        if (subsHeight > playerHeight) {
            this.subtitleContainer.style.bottom = 0;
        } else {
            let real_percentage = percentage * (playerHeight - subsHeight) / playerHeight;
            this.subtitleContainer.style.bottom = real_percentage + "%";
        }
    }

    showPlayerUI() {
        this.htmlPlayerRoot.style.cursor = "auto";
        this.htmlControls.root.classList.remove("hide");
        this.htmlTitleContainer.classList.remove("hide");
    }

    hidePlayerUI() {
        if (!this.options.autohideControls) {
            return;
        }

        if (!this.isVideoPlaying() && this.options.showControlsOnPause) {
            return;
        }

        if (this.isDraggingProgressBar) {
            return;
        }

        this.htmlPlayerRoot.style.cursor = "none";
        this.htmlControls.root.classList.add("hide");
        this.htmlTitleContainer.classList.add("hide");
    }

    resetPlayerUIHideTimeout() {
        clearTimeout(this.playerUIHideTimeoutID);
        this.playerUIHideTimeoutID = setTimeout(() => {
            this.hidePlayerUI();
        }, this.options.inactivityTime);
    }

    redrawBufferedBars() {
        const context = this.htmlControls.progress.buffered.getContext("2d");
        context.fillStyle = "rgb(204, 204, 204, 0.5)";

        const buffered_width = this.htmlControls.progress.buffered.width;
        const buffered_height = this.htmlControls.progress.buffered.height;
        context.clearRect(0, 0, buffered_width, buffered_height);

        const duration = this.htmlVideo.duration;
        for (let i = 0; i < this.htmlVideo.buffered.length; i++) {
            let start = this.htmlVideo.buffered.start(i) / duration;
            let end = this.htmlVideo.buffered.end(i) / duration;

            let x = Math.floor(buffered_width * start);
            let width = Math.ceil(buffered_width * end - buffered_width * start);
            context.fillRect(x, 0, width, buffered_height);
        }
    };

    attachPlayerRootEvents() {
        this.htmlPlayerRoot.addEventListener("touchmove", _ => {
            this.showPlayerUI();
            this.resetPlayerUIHideTimeout();
        });

        this.htmlPlayerRoot.addEventListener("mousemove", _ => {
            this.showPlayerUI();
            this.resetPlayerUIHideTimeout();
        });

        this.htmlPlayerRoot.addEventListener("mousedown", _ => {
            this.showPlayerUI();
            this.resetPlayerUIHideTimeout();
        });

        this.htmlPlayerRoot.addEventListener("mouseup", _ => {
            this.showPlayerUI();
            this.resetPlayerUIHideTimeout();
        });

        this.htmlPlayerRoot.addEventListener("mouseenter", _ => {
            this.showPlayerUI();
            this.resetPlayerUIHideTimeout();
        });

        this.htmlPlayerRoot.addEventListener("mouseleave", _ => {
            this.hidePlayerUI();
        });

        this.htmlPlayerRoot.addEventListener("keydown", event => {
            if (event.key === " " || event.code === "Space") {
                this.togglePlayback();
                consumeEvent(event);

            } else if (event.key === "ArrowLeft") {
                this.htmlSeekBackward.classList.add("animate");
                let timestamp = this.getNewTime(-this.options.seekBy);
                this.fireControlsSeeked(timestamp);
                this.seek(timestamp);
                consumeEvent(event);

            } else if (event.key === "ArrowRight") {
                this.htmlSeekForward.classList.add("animate");
                let timestamp = this.getNewTime(this.options.seekBy);
                this.fireControlsSeeked(timestamp);
                this.seek(timestamp);
                consumeEvent(event);

            } else if (event.key === "ArrowUp") {
                this.setVolumeRelative(0.1);
                consumeEvent(event);

            } else if (event.key === "ArrowDown") {
                this.setVolumeRelative(-0.1);
                consumeEvent(event);

            } else if (event.key === this.options.fullscreenKeyLetter) {
                this.toggleFullscreen();
                consumeEvent(event);
            }
        });

        this.htmlPlayerRoot.addEventListener("click", event => {
            if (event.pointerType === "touch" || event.pointerType === "pen") {
                if (!this.isUIVisible) {
                    return;
                }
            }

            this.togglePlayback();
        });
    }

    attachHtmlVideoEvents() {
        this.htmlVideo.addEventListener("waiting", _ => {
            clearTimeout(this.bufferingTimeoutId);
            this.bufferingTimeoutId = setTimeout(_ => show(this.bufferingSvg), 200);
        });

        this.htmlVideo.addEventListener("canplay", _ => {
            clearTimeout(this.bufferingTimeoutId);
            hide(this.bufferingSvg);
        });

        this.htmlVideo.addEventListener("canplaythrough", _ => {
            clearTimeout(this.bufferingTimeoutId);
            hide(this.bufferingSvg);
        });

        this.htmlVideo.addEventListener("durationchange", _ => {
            if (!this.isVideoPlaying()) {
                let timestamp = this.getCurrentTime();
                this.updateTimestamps(timestamp);
            }
        });

        this.htmlVideo.addEventListener("playing", _ => {
            clearTimeout(this.bufferingTimeoutId);
            hide(this.bufferingSvg);
        });

        this.htmlVideo.addEventListener("timeupdate", _ => {
            let timestamp = this.getCurrentTime();
            if (this.htmlControls.subMenu.subsSwitcher.enabled && this.selectedSubtitle) {
                this.updateSubtitles(timestamp);
            }

            this.updateTimestamps(timestamp);
        });

        this.htmlVideo.addEventListener("ended", _ => {
            this.svgs.playback.setHref(this.icons.replay)
            this.firePlaybackEnd();
        });

        this.htmlVideo.addEventListener("play", _ => {
            this.svgs.playbackPopup.setHref(this.icons.play_popup);
            this.showPlaybackPopup();
        });

        this.htmlVideo.addEventListener("pause", _ => {
            this.svgs.playbackPopup.setHref(this.icons.pause_popup);
            this.showPlaybackPopup();
        });
    }

    attachPlayerControlsEvents() {
        this.htmlControls.buttons.playbackButton.addEventListener("click", _ => {
            this.togglePlayback();
        });

        this.htmlControls.buttons.nextButton.addEventListener("click", _ => {
            this.fireControlsNext();
        });

        // This should rely on the 'loop' property of <video> element in the future
        this.htmlControls.buttons.loopButton.addEventListener("click", _ => {
            this.loopEnabled = !this.loopEnabled;
            this.fireControlsLooping(this.loopEnabled);
            this.htmlControls.buttons.loopButton.classList.toggle("player_controls_button_selected");
        });

        this.htmlControls.buttons.autoplayButton.addEventListener("click", _ => {
            this.autoplayEnabled = !this.autoplayEnabled;
            this.fireControlsAutoplay(this.autoplayEnabled);
            this.htmlControls.buttons.autoplayButton.classList.toggle("player_controls_button_selected");
        });

        this.htmlControls.buttons.volumeButton.addEventListener("click", _ => {
            let slider = this.htmlControls.buttons.volumeInput;
            if (slider.value == 0) {
                this.fireControlsVolumeSet(this.volumeBeforeMute);
                this.setVolume(this.volumeBeforeMute);
            } else {
                this.volumeBeforeMute = slider.value;
                this.fireControlsVolumeSet(0);
                this.setVolume(0);
            }
        });

        // This roughly simulates a click on an invisible anchor as there's no practical way to trigger "Save As" dialog
        this.htmlControls.buttons.downloadButton.addEventListener("click", _ => {
            const anchor = document.createElement('a');
            anchor.href = this.getCurrentUrl();
            let fileInfo = FileInfo.fromUrl(anchor.href);
            anchor.download = fileInfo.filename;

            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
        });

        this.htmlControls.buttons.speedButton.addEventListener("click", _ => {
            // https://developer.mozilla.org/en-US/docs/Web/Media/Audio_and_video_delivery/WebAudio_playbackRate_explained
            // The recommended range is [0.5 - 4.0]
            let newSpeed = this.htmlVideo.playbackRate + 0.25;
            if (newSpeed > 2.5) {
                newSpeed = 1;
            }
            this.setSpeed(newSpeed);
            this.setToast("Speed: " + this.htmlVideo.playbackRate)
        });

        this.htmlControls.buttons.subsButton.addEventListener("click", _ => {
            hide(this.htmlControls.settings.root);

            let root = this.htmlControls.subMenu.root;
            if (isHidden(root)) {
                show(root);
            } else {
                hide(root);
            }
        });

        this.htmlControls.buttons.settingsButton.addEventListener("click", _ => {
            hide(this.htmlControls.subMenu.root);

            let root = this.htmlControls.settings.root;
            if (isHidden(root)) {
                show(root);
            } else {
                hide(root);
            }
        });

        this.htmlControls.buttons.fullscreenButton.addEventListener("click", () => {
            this.toggleFullscreen();
        });

        this.htmlControls.buttons.volumeInput.addEventListener("input", _event => {
            let volume = this.htmlControls.buttons.volumeInput.value;
            this.fireControlsVolumeSet(volume);
            this.setVolume(volume);
        });

        let calculateProgress = (event, element) => {
            let rect = element.getBoundingClientRect();
            let offsetX;

            if (event.touches) {
                let touches = event.touches.length !== 0 ? event.touches : event.changedTouches;
                offsetX = touches[0].clientX - rect.left;
            } else {
                offsetX = event.clientX - rect.left;
            }

            // Ensure the touch doesn't exceed slider bounds
            if (offsetX < 0) offsetX = 0;
            if (offsetX > rect.width) offsetX = rect.width;

            let progress = offsetX / rect.width;
            if (isNaN(progress)) {
                progress = 0;
            }

            return progress;
        }

        this.htmlControls.progress.root.addEventListener("touchstart", _ => {
            const onProgressBarTouchMove = event => {
                const progressRoot = this.htmlControls.progress.root;
                const progress = calculateProgress(event, progressRoot);
                this.updateProgressBar(progress);
                this.updateProgressPopup(progress);
            }

            const onProgressBarTouchStop = event => {
                this.isDraggingProgressBar = false;
                this.resetPlayerUIHideTimeout();

                document.removeEventListener('touchmove', onProgressBarTouchMove);
                document.removeEventListener('touchend', onProgressBarTouchStop);

                const progressRoot = this.htmlControls.progress.root;
                const progress = calculateProgress(event, progressRoot);
                const timestamp = this.htmlVideo.duration * progress;

                this.fireControlsSeeked(timestamp);
                this.seek(timestamp);
            }

            this.isDraggingProgressBar = true;
            document.addEventListener('touchmove', onProgressBarTouchMove);
            document.addEventListener('touchend', onProgressBarTouchStop);
        });

        this.htmlControls.progress.root.addEventListener("mousedown", _event => {
            const onProgressBarMouseMove = event => {
                const progressRoot = this.htmlControls.progress.root;
                const progress = calculateProgress(event, progressRoot);
                this.updateProgressBar(progress);
                this.updateProgressPopup(progress);
            }

            const onProgressBarMouseUp = event => {
                this.isDraggingProgressBar = false;
                this.resetPlayerUIHideTimeout();

                document.removeEventListener('mousemove', onProgressBarMouseMove);
                document.removeEventListener('mouseup', onProgressBarMouseUp);

                const progressRoot = this.htmlControls.progress.root;
                const progress = calculateProgress(event, progressRoot);
                const timestamp = this.htmlVideo.duration * progress;

                this.fireControlsSeeked(timestamp);
                this.seek(timestamp);
            }

            this.isDraggingProgressBar = true;
            document.addEventListener('mousemove', onProgressBarMouseMove);
            document.addEventListener('mouseup', onProgressBarMouseUp);
        });

        this.htmlControls.progress.root.addEventListener("mouseenter", _ => {
            this.updateTimestamps(this.htmlVideo.currentTime);
        });

        this.htmlControls.progress.root.addEventListener("mousemove", event => {
            const progress = calculateProgress(event, this.htmlControls.progress.root);
            this.updateProgressPopup(progress);
        });

        this.htmlControls.root.addEventListener("transitionend", event => {
            // NOTE(kihau):
            //     This is a really weird and confusing way of setting the isUIVisible flag.
            //     Probably should be changed and done the proper way at some point.
            if (event.propertyName === "opacity") {
                this.isUIVisible = !event.target.classList.contains("hide");
            }
        });
    }

    attachOtherEvents() {
        document.addEventListener("fullscreenchange", _ => {
            // This is after the fact when a user exited without using the icon
            let href = document.fullscreenElement ? this.icons.fullscreen_exit : this.icons.fullscreen_enter;
            this.svgs.fullscreen.setHref(href);
            this.fireFullscreenChange(document.fullscreenElement != null)
        });

        this.htmlSeekBackward.addEventListener("dblclick", event => {
            if (!this.options.enableDoubleTapSeek) {
                return;
            }

            this.htmlSeekBackward.classList.add("animate");
            let timestamp = this.getNewTime(-this.options.seekBy);
            this.fireControlsSeeked(timestamp);
            this.seek(timestamp);
            consumeClick(event);
        });

        this.htmlSeekForward.addEventListener("dblclick", event => {
            if (!this.options.enableDoubleTapSeek) {
                return;
            }

            this.htmlSeekForward.classList.add("animate");
            let timestamp = this.getNewTime(this.options.seekBy);
            this.fireControlsSeeked(timestamp);
            this.seek(timestamp);
            consumeClick(event);
        });

        this.htmlSeekBackward.addEventListener("transitionend", _ => {
            this.htmlSeekBackward.classList.remove("animate");
        });

        this.htmlSeekForward.addEventListener("transitionend", _ => {
            this.htmlSeekForward.classList.remove("animate");
        });
    }

    attachPlayerEvents() {
        this.attachPlayerRootEvents();
        this.attachHtmlVideoEvents();
        this.attachPlayerControlsEvents();
        this.attachOtherEvents();
    }

    rebindFullscreenAPIFromWebkit() {
        console.log("Rebinding webkit fullscreen API")
        if (!HTMLElement.prototype.requestFullscreen) {
            HTMLElement.prototype.requestFullscreen = function() {
                return HTMLElement.prototype.webkitRequestFullscreen.call(this);
            }
        }

        Object.defineProperty(Document.prototype, 'fullscreenElement', {
            get: () => document.webkitFullscreenElement
        });

        document.exitFullscreen = document.webkitExitFullscreen;
    }

    assembleProgressBar() {
        let progress =  this.htmlControls.progress;
        this.htmlControls.root.appendChild(progress.root);

        progress.root.appendChild(progress.total);
        progress.root.appendChild(progress.buffered);
        progress.root.appendChild(progress.current);
        progress.root.appendChild(progress.thumb);
        progress.root.appendChild(progress.popupRoot);

        progress.popupText.textContent = "00:00";
        progress.popupText.classList.add("unselectable");
        progress.popupRoot.appendChild(progress.popupText);
    }

    assembleControlButtons() {
        let svgs             = this.svgs;
        let buttonsRoot      = this.htmlControls.buttons.root;
        let playbackButton   = this.htmlControls.buttons.playbackButton;
        let nextButton       = this.htmlControls.buttons.nextButton;
        let loopButton       = this.htmlControls.buttons.loopButton;
        let volumeButton     = this.htmlControls.buttons.volumeButton;
        let volumeRoot       = newDiv("player_volume_root");
        let volumeSlider     = this.htmlControls.buttons.volumeInput;
        let volumeBar        = newDiv("player_volume_bar");
        let volumeProgress   = this.htmlControls.buttons.volumeProgress;
        let liveIndicator    = this.htmlControls.buttons.liveIndicator;
        let liveDot          = newDiv("player_live_dot");
        let liveText         = newDiv("player_live_text");
        let timestamp        = this.htmlControls.buttons.timestamp;
        let spacer           = newDiv("player_spacer");
        let downloadButton   = this.htmlControls.buttons.downloadButton;
        let speedButton      = this.htmlControls.buttons.speedButton;
        let autoplayButton   = this.htmlControls.buttons.autoplayButton;
        let subsButton       = this.htmlControls.buttons.subsButton;
        let settingsButton   = this.htmlControls.buttons.settingsButton;
        let fullscreenButton = this.htmlControls.buttons.fullscreenButton;

        playbackButton.title = "Play/Pause";
        nextButton.title     = "Next";
        loopButton.title     = "Loop";
        volumeButton.title   = "Mute/Unmute";

        volumeSlider.type  = "range";
        volumeSlider.min   = "0";
        volumeSlider.max   = "1";
        volumeSlider.value = "1";
        volumeSlider.step  = "any";

        liveText.textContent = "LIVE";
        timestamp.textContent = "00:00 / 00:00";

        downloadButton.title   = "Download";
        speedButton.title      = "Playback speed";
        autoplayButton.title   = "Autoplay";
        subsButton.title       = "Subtitles";
        settingsButton.title   = "Settings";
        fullscreenButton.title = "Fullscreen";

        if (this.options.hidePlaybackButton)   hide(playbackButton);
        if (this.options.hideNextButton)       hide(nextButton);
        if (this.options.hideLoopingButton)    hide(loopButton);
        if (this.options.hideVolumeButton)     hide(volumeButton);
        if (this.options.hideVolumeSlider)     hide(volumeRoot)
        if (this.options.hideTimestamps)       hide(timestamp);
        if (this.options.hideDownloadButton)   hide(downloadButton);
        if (this.options.hideSpeedButton)      hide(speedButton);
        if (this.options.hideAutoplayButton)   hide(autoplayButton);
        if (this.options.hideSubtitlesButton)  hide(subsButton);
        if (this.options.hideSettingsButton)   hide(settingsButton);
        if (this.options.hideFullscreenButton) hide(fullscreenButton);

        hide(liveIndicator);

        this.htmlControls.root.append(buttonsRoot); {
            buttonsRoot.append(playbackButton); {
                playbackButton.append(svgs.playback.svg);
            }

            buttonsRoot.append(nextButton); {
                nextButton.append(svgs.next.svg);
            }

            buttonsRoot.append(loopButton); {
                loopButton.append(svgs.loop.svg);
            }

            buttonsRoot.append(volumeButton); {
                volumeButton.appendChild(svgs.volume.svg);
            }

            buttonsRoot.append(volumeRoot); {
                volumeRoot.append(volumeBar);
                volumeRoot.append(volumeProgress);
                volumeRoot.append(volumeSlider);
            }

            buttonsRoot.append(liveIndicator); {
                liveIndicator.append(liveDot);
                liveIndicator.append(liveText);
            }

            buttonsRoot.append(timestamp);

            buttonsRoot.append(spacer)

            buttonsRoot.append(downloadButton); {
                downloadButton.appendChild(svgs.download.svg);
            }

            buttonsRoot.append(speedButton); {
                speedButton.appendChild(svgs.speed.svg);
            }

            buttonsRoot.append(autoplayButton); {
                autoplayButton.appendChild(svgs.autoplay.svg);
            }

            buttonsRoot.append(subsButton); {
                subsButton.appendChild(svgs.subs.svg);
            }

            buttonsRoot.append(settingsButton); {
                settingsButton.appendChild(svgs.settings.svg);
            }

            buttonsRoot.append(fullscreenButton); {
                fullscreenButton.appendChild(svgs.fullscreen.svg);
            }
        }
    }

    createHtmlControls() {
        let playerControls = this.htmlControls.root;
        playerControls.addEventListener("click", consumeClick);
        playerControls.addEventListener("focusout", _ => {
            // )therwise document.body will receive focus
            this.htmlPlayerRoot.focus();
        });

        this.htmlPlayerRoot.appendChild(playerControls);

        this.assembleProgressBar();
        this.assembleControlButtons();
        this.createSubtitleMenu();
        this.createSettingsMenu();
    }

    markSubtitleSelected(subtitle) {
        let menu = this.htmlControls.subMenu;
        let track = subtitle.htmlTrack;

        if (menu.selected.track) {
            menu.selected.track.classList.remove("subtitle_track_selected");
        }

        track.classList.add("subtitle_track_selected");
        menu.selected.track = track;
    }

    createSubtitleMenu() {
        let playerRoot     = this.htmlPlayerRoot;
        let menu           = this.htmlControls.subMenu;
        let menuRoot       = menu.root;
        let menuTabs       = newDiv(null, "player_menu_tabs");
        let menuSeparator  = newDiv(null, "player_menu_separator");
        let menuViews      = newDiv(null, "player_menu_views");
        let selectTab      = newDiv(null, "player_menu_tab");
        let searchTab      = newDiv(null, "player_menu_tab");
        let optionsTab     = newDiv(null, "player_menu_tab");
        let selectView     = newDiv("player_submenu_select_view");
        let subsSwitch     = menu.subsSwitcher;
        let searchView     = newDiv("player_submenu_search_view");
        let subtitleImport = newElement("input", "player_submenu_import");
        let optionsView    = newDiv("player_submenu_bottom_options");
        let subsShift      = this.subtitleShift;
        let subsSize       = new Slider("Subtitle size",  10, 100, 1.0, 30, "px");
        let subsVerticalPosition = new Slider("Vertical position",  0, 100, 1, 16, "%");
        let subsForegroundPicker = newElement("input");

        hide(menuRoot);
        hide(selectView);
        hide(searchView);
        hide(optionsView);

        this.setSubtitleVerticalPosition(16);

        selectTab.textContent  = "Select";
        searchTab.textContent  = "Search";
        optionsTab.textContent = "Options";

        subtitleImport.textContent = "Import subtitle";
        subtitleImport.type = "file";
        subtitleImport.accept = ".vtt,.srt";

        subsForegroundPicker.type = "color";
        subsForegroundPicker.value = "white";

        menu.selected.tab  = selectTab;
        menu.selected.view = selectView;

        menu.selected.tab.classList.add("player_menu_tab_selected");
        show(menu.selected.view);

        menuRoot.onclick = consumeClick;

        let select = (tab, view) => {
            let selected = menu.selected;
            selected.tab.classList.remove("player_menu_tab_selected");
            hide(selected.view);

            selected.tab = tab;
            selected.view = view;

            selected.tab.classList.add("player_menu_tab_selected");
            show(selected.view);
        }

        selectTab.onclick  = _ => select(selectTab,  selectView);
        searchTab.onclick  = _ => select(searchTab,  searchView);
        optionsTab.onclick = _ => select(optionsTab, optionsView);

        subsSwitch.onAction = enabled => {
            this.updateSubtitles(this.getCurrentTime());
            if (enabled && this.activeCues.length > 0) {
                show(this.subtitleContainer);
            } else {
                hide(this.subtitleContainer);
            }
        };

        subtitleImport.onchange = event => {
            if (event.target.files.length === 0) {
                return;
            }
            // Allow selection of multiple at some point
            const file = event.target.files[0];
            // This object is a blob and will be released with URL.revokeObjectURL on load
            const objectUrl = URL.createObjectURL(file);
            let trackInfo = FileInfo.fromUrl(file.name);
            console.debug("Adding", trackInfo.extension, "subtitle from disk");
            this.addSubtitle(objectUrl, true, trackInfo);
        };

        subsShift.onInput = value => this.setCurrentSubtitleShift(value);
        subsSize.onInput  = size => {
            this.setSubtitleFontSize(size);
            let position = subsVerticalPosition.getValue();
            this.setSubtitleVerticalPosition(position);
        };
        subsVerticalPosition.onInput  = position => this.setSubtitleVerticalPosition(position);
        subsForegroundPicker.onchange = _        => this.setSubtitleForeground(subsForegroundPicker.value);

        playerRoot.append(menuRoot); {
            menuRoot.append(menuTabs); {
                menuTabs.append(selectTab);
                menuTabs.append(searchTab);
                menuTabs.append(optionsTab);
            }
            menuRoot.append(menuSeparator);
            menuRoot.append(menuViews); {
                menuViews.append(selectView); {
                    selectView.append(subsSwitch.toggleRoot);
                    selectView.append(menu.trackList);
                }
                menuViews.append(searchView); {
                    searchView.append(subtitleImport)
                }
                menuViews.append(optionsView); {
                    optionsView.append(subsShift.root);
                    optionsView.append(subsSize.root);
                    optionsView.append(subsVerticalPosition.root);
                    optionsView.append(subsForegroundPicker);
                }
            }
        }
    }

    createSettingsMenu() {
        let playerRoot     = this.htmlPlayerRoot;
        let menu           = this.htmlControls.settings;
        let menuRoot       = menu.root;
        let menuSeparator  = newDiv(null, "player_menu_separator");
        let menuTabs       = newDiv(null, "player_menu_tabs");
        let menuViews      = newDiv(null, "player_menu_views");
        let generalTab     = newDiv(null, "player_menu_tab");
        let appearanceTab  = newDiv(null, "player_menu_tab");
        let generalView    = newDiv("player_submenu_select_view");
        let appearanceView = newDiv("player_submenu_select_view");
        let autohide       = new Switcher("Auto-hide controls");
        let showOnPause    = new Switcher("Show controls on pause");
        let playbackSpeed  = new Slider("Playback speed", 0.25, 5.0, 0.25, 1.0, "x");
        let brightness  = new Slider("Brightness", 0.2, 1.5, 0.05, 1.0);

        hide(menuRoot);
        autohide.setState(this.options.autohideControls);
        showOnPause.setState(this.options.showControlsOnPause);

        generalTab.textContent    = "General";
        appearanceTab.textContent = "Appearance";

        menu.selected.tab  = generalTab;
        menu.selected.view = generalView;

        menu.selected.tab.classList.add("player_menu_tab_selected");
        show(menu.selected.view);

        menuRoot.onclick = consumeClick;

        let select = (tab, view) => {
            let selected = menu.selected;
            selected.tab.classList.remove("player_menu_tab_selected");
            hide(selected.view);

            selected.tab = tab;
            selected.view = view;

            selected.tab.classList.add("player_menu_tab_selected");
            show(selected.view);
        }

        generalTab.onclick     = () => select(generalTab, generalView);
        appearanceTab.onclick  = () => select(appearanceTab, appearanceView);

        menuRoot.onclick = consumeClick;

        autohide.onAction = state => {
            this.options.autohideControls = state;
        };

        showOnPause.onAction = state => {
            this.options.showControlsOnPause = state;
        };

        brightness.onInput = value => {
            this.htmlVideo.style.filter = "brightness(" + value + ")";
        };

        playerRoot.append(menuRoot); {
            menuRoot.append(menuTabs); {
                menuTabs.append(generalTab);
                menuTabs.append(appearanceTab);
            }
            menuRoot.append(menuSeparator);
            menuRoot.append(menuViews); {
                menuViews.append(generalView); {
                    generalView.append(autohide.toggleRoot);
                    generalView.append(showOnPause.toggleRoot);
                    generalView.append(playbackSpeed.root);
                    generalView.append(brightness.root);
                }
                menuViews.append(appearanceView);
            }
        }
    }
}

export class FileInfo {
    constructor(filename, extension) {
        this.filename = filename;
        this.extension = extension;
    }
    static fromUrl(url) {
        let filename = url.substring(url.lastIndexOf("/") + 1);
        let extension = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();
        return new FileInfo(filename, extension);
    }
}

class Slider {
    constructor(textContent, min, max, step, initialValue, valueSuffix = "", includeSign = false) {
        let root        = newDiv(null, "player_shifter_root");
        let top         = newDiv(null, "player_shifter_top");
        let text        = newElement("span", null, "player_shifter_text");
        let valueText   = newElement("span", null, "player_shifter_value");
        let bottom      = newDiv(null, "player_shifter_bottom");
        let leftButton  = newElement("button", null, "player_shifter_button");
        let arrowLeft   = Svg.new("svg/player_icons.svg#arrow_left", 20, 20);
        let slider      = newElement("input",  null, "player_shifter_slider");
        let rightButton = newElement("button", null, "player_shifter_button");
        let arrowRight  = Svg.new("svg/player_icons.svg#arrow_right", 20, 20);

        text.textContent = textContent;

        slider.type = "range";
        slider.min = min;
        slider.max = max;
        slider.step = step;

        rightButton.onclick = () => this.shift(step);
        slider.oninput      = () => this.shift(0.0);
        leftButton.onclick  = () => this.shift(-step);

        root.append(top); {
            top.append(text);
            top.append(valueText);
        }
        root.append(bottom); {
            bottom.append(leftButton); {
                leftButton.append(arrowLeft.svg);
            }
            bottom.append(slider);
            bottom.append(rightButton); {
                rightButton.append(arrowRight.svg);
            }
        }

        this.valueSuffix = valueSuffix;

        this.root        = root;
        this.slider      = slider;
        this.valueText   = valueText;
        this.includeSign = includeSign;
        this.setValue(initialValue);
    }

    createValueString(value) {
        let max = Number(this.slider.max);
        if (value > max) {
            value = max;
        }

        let min = Number(this.slider.min);
        if (value < min) {
            value = min;
        }

        // Set precision to a single digit of the fractional part.
        value = Math.round(value * 10.0) / 10.0;

        let valueString = "";
        if (this.includeSign && value > 0) {
            valueString = "+";
        }

        valueString += value;

        // Append ".0" when the value has no fractional part.
        if ((value * 10) % 10 === 0.0) {
            valueString += ".0";
        }

        valueString += this.valueSuffix;
        return valueString;
    }

    onInput(_value) {}

    shift(step) {
        let value = Number(this.slider.value) + step;
        this.setValue(value);
        this.onInput(value);
    }

    setValue(value) {
        this.slider.value = value;
        this.valueText.textContent = this.createValueString(value);
    }

    getValue() {
        return Number(this.slider.value);
    }
}

class Switcher {
    constructor(text, initialState) {
        let toggleRoot   = newDiv(null, "player_toggle_root");
        let toggleText   = newDiv(null, "player_toggle_text");
        let toggleSwitch = newDiv(null, "player_toggle_switch");
        let toggleCircle = newDiv(null, "player_toggle_circle");

        toggleText.textContent = text;

        toggleSwitch.addEventListener("click", _ => {
            this.setState(!this.enabled);
            this.onAction(this.enabled);
        });

        toggleRoot.appendChild(toggleText);
        toggleRoot.appendChild(toggleSwitch); {
            toggleSwitch.appendChild(toggleCircle);
        }

        this.toggleRoot   = toggleRoot;
        this.toggleSwitch = toggleSwitch;
        this.setState(initialState);
    }

    // Changes both the real state and the UI state, for programmatic use to stay in sync with UI
    setState(state) {
        if (state) {
            this.enabled = true;
            this.toggleRoot.classList.add("player_toggle_on");
        } else {
            this.enabled = false;
            this.toggleRoot.classList.remove("player_toggle_on");
        }
    }

    onAction(_state) {}
}

class Cue {
    constructor(start, end, text) {
        this.startTime = start;
        this.endTime = end;
        this.text = text;
        this.sanitized = false;
    }
    // if (!cue.sanitized) { cue.text = sanitizeHTMLForDisplay(cue.text); cue.sanitized = true; }
}

// Internal representation for a subtitle, a replacement for the TextTrack and <track>
class Subtitle {
    constructor(cues, name, format) {
        this.cues = cues;
        this.name = name;
        this.format = format;
        this.offset = 0.0;
        this.htmlTrack = this.createSubtitleTrackElement(name);
    }

    createSubtitleTrackElement(title) {
        let track        = newDiv(null, "subtitle_track");
        let trackTitle   = newElement("input", null, "subtitle_track_text");
        // let trackButtons = newDiv(null, "subtitle_track_buttons");
        // let trackEdit    = newElement("button", null, "subtitle_track_edit_button")
        // let trackRemove  = newElement("button", null, "subtitle_track_remove_button")

        trackTitle.type = "text";
        trackTitle.value = title;
        trackTitle.readOnly = true;

        // trackEdit.textContent = "⚙️";
        // trackRemove.textContent = "🗑";

        track.appendChild(trackTitle);
        // track.appendChild(trackButtons); {
        //     trackButtons.appendChild(trackEdit);
        //     trackButtons.appendChild(trackRemove);
        // }

        return track;
    }
}

function areArraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;

    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
}

// Use binary search to find the index of the cue that should be shown based on startTime only
function binarySearchForCue(time, cues) {
    let left = 0, right = cues.length - 1;
    while (left <= right) {
        let mid = ((left + right) / 2) | 0;
        if (cues[mid].startTime < time) {
            left = mid + 1;
        } else if(cues[mid].startTime > time) {
            right = mid - 1;
        } else {
            return mid;
        }
    }
    return ((left + right) / 2) | 0
}

// Use linear search to find the index of the cue that should be shown based on startTime only
function linearCueSearch(time, cues) {
    let len = cues.length;
    for (let i = 0; i < len; i++) {
        if (cues[i].startTime < time) {
            continue;
        }
        return i-1;
    }
}

// It's possible to attach inlined events to styling tags
function removeInlinedEvents(tag) {
    let attributes = tag.attributes;
    for (let i = 0; i < attributes.length; i++) {
        let attrib = attributes[i];
        if (attrib.name.indexOf("on") === 0) {
            tag.removeAttribute(attrib.name);
            console.warn("Removed", attrib.name, "during events sanitization.")
        }
    }
}

const ALLOWED_STYLE_TAGS = ["i", "b", "u", "ruby", "rt", "c", "v", "lang", "font"]
const PARSER = new DOMParser();
export function sanitizeHTMLForDisplay(html) {
    // Using a temporary element or document fragment preloads <img> tags causing onload to fire
    let sandbox = PARSER.parseFromString(html, "text/html").body;
    sanitizeChildren(sandbox);
    return sandbox.innerHTML;
}

// CSS injections through style attribute: <b style="background: url(https://example.com)">Bold url</b>
function sanitizeChildren(tag) {
    for (let i = 0; i < tag.children.length; i++) {
        let child = tag.children[i];
        let name = child.tagName.toLowerCase();
        if (ALLOWED_STYLE_TAGS.includes(name)) {
            removeInlinedEvents(child);
            child.removeAttribute("style");
            sanitizeChildren(child);
            continue;
        }
        console.warn("Removed", name, "during sanitization.")
        tag.removeChild(child);
        i--;
    }
}

function createTimestampString(timestamp) {
    if (!timestamp) {
        timestamp = 0.0;
    }

    let seconds = Math.floor(timestamp % 60.0);
    timestamp = timestamp / 60.0;
    let minutes = Math.floor(timestamp % 60.0);
    timestamp = timestamp / 60.0;
    let hours = Math.floor(timestamp % 60.0);

    let timestamp_string = "";
    if (hours > 0.0) {
        timestamp_string += hours;
        timestamp_string += ":";
    }

    if (minutes < 10) {
        timestamp_string += "0";
    }

    timestamp_string += minutes;
    timestamp_string += ":";

    if (seconds < 10) {
        timestamp_string += "0";
    }

    timestamp_string += seconds;
    return timestamp_string;
}

// Receives [subtitle file text, decimal separator ('.' = VTT ',' = SRT), skipCounter is true for SRT
function parseSubtitles(subtitleText, decimalMark, skipCounter, skipHeader) {
    let lines = subtitleText.split('\n');
    let cues = []
    let i = 0;
    if (skipHeader) i = 2;
    for (; i < lines.length-2; i++) {
        if (skipCounter) ++i;

        let timestamps = lines[i];
        let [start, end, ok] = parseTimestamps(timestamps, decimalMark)
        if (!ok || ++i >= lines.length) {
            return cues;
        }
        let content = lines[i].trim();
        while (++i < lines.length) {
            let text = lines[i].trim();
            if (text.length === 0) {
                break;
            }
            content += '\n';
            content += text;
        }
        if (content !== "") {
            let newCue = new Cue(start, end, content);
            cues.push(newCue);
        }
    }
    return cues;
}

function parseSrt(srtText) {
    return parseSubtitles(srtText, ',', true, false);
}

function parseVtt(vttText) {
    return parseSubtitles(vttText, '.', false, true);
}

// Returns [seconds start, seconds end, success]
function parseTimestamps(timestamps, decimalMark) {
    if (timestamps.length < 23) {
        return [null, null, false];
    }
    let splitter = timestamps.indexOf(" --> ", 8);
    if (splitter === -1) {
        return [null, null, false];
    }
    let startStamp = parseStamp(timestamps.substring(0, splitter), decimalMark);
    let endStamp = parseStamp(timestamps.substring(splitter+5), decimalMark);
    return [startStamp, endStamp, startStamp != null && endStamp != null];
}

// Returns a timestamp expressed in seconds or null on failure
function parseStamp(stamp, decimalMark) {
    let twoSplit = stamp.split(decimalMark);
    if (twoSplit.length !== 2) {
        return null;
    }
    let hms = twoSplit[0].split(':');
    switch (hms.length) {
        case 3:
            return hms[0] * 3600 + hms[1] * 60 + Number(hms[2]) + twoSplit[1] / 1000;
        case 2:
            return hms[0] * 60 + Number(hms[1]) + twoSplit[1] / 1000;
        default:
            return null;
    }
}

function nonNullOrEmpty(arg) {
    return arg != null && arg.length > 0;
}

export class Search {
    // Expecting strings for now
    constructor(title, lang, year, season, episode) {
        this.isMovie = nonNullOrEmpty(season) && nonNullOrEmpty(episode);
        this.title = title;
        this.lang = lang;
        this.year = year;
        this.season = season;
        this.episode = episode;
    }
}

function newDiv(id, className) {
    let div = document.createElement("div")
    // tabIndex makes divs focusable so that they can receive and bubble key events
    div.tabIndex = -1
    if (id) {
        div.id = id;
    }

    if (className) {
        div.className = className;
    }

    return div;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

class SeekIcon {
    constructor(textContent, width=100, height=100) {
        this.svg = document.createElementNS(SVG_NAMESPACE, "svg");
        let svg = this.svg;
        svg.setAttribute("viewBox", "0 0 48 48");
        svg.setAttribute("width", width);
        svg.setAttribute("height", height);
        svg.innerHTML = `
             <path d="M24 4C12.97 4 4 12.97 4 24C4 35.03 12.97 44 24 44C35.03 44 44 35.03 44 24C44 23.83 43.998 23.66 43.994 23.49A1.5 1.5 0 0 0 40.994 23.56C40.998 23.71 41 23.85 41 24C41 33.41 33.41 41 24 41C14.59 41 7 33.41 7 24C7 14.59 14.59 7 24 7C29.38 7 34.16 9.5 37.27 13.38L35.96 13.15A1.5 1.5 0 0 0 35.44 16.11L40.37 16.98A1.5 1.5 0 0 0 42.11 15.76L42.97 10.84A1.5 1.5 0 0 0 41.44 9.06A1.5 1.5 0 0 0 40.02 10.32L39.77 11.72C36.11 7.03 30.4 4 24 4z"/>
             <text x="24" y="24" text-anchor="middle" font-weight="bold" font-size="17" dy=".35em">10s</text>
        `;
        let children = svg.children;
        this.path = children[0];
        this.text = children[1];
        this.setText(textContent)
    }
    static newForward(textContent = "", width, height) {
        return new SeekIcon(textContent, width, height);
    }
    static newBackward(textContent = "", width, height) {
        let seekBackward = new SeekIcon(textContent, width, height);
        seekBackward.path.setAttribute("transform", "scale(-1, 1) translate(-48, 0)");
        return seekBackward;
    }
    setText(text) {
        this.text.textContent = text;
    }
}

class Svg {
    constructor(svg, use) {
        this.svg = svg;
        this.use = use;
    }

    setHref(href) {
        this.use.setAttribute("href", href)
    }

    static new(initialHref, width=20, height=20) {
        let svg = document.createElementNS(SVG_NAMESPACE, "svg");
        let use = document.createElementNS(SVG_NAMESPACE, "use");
        use.setAttribute("href", initialHref);

        svg.setAttribute("width", width);
        svg.setAttribute("height", height);
        svg.appendChild(use);
        return new Svg(svg, use);
    }
}

function newElement(tag, id, className) {
    let element = document.createElement(tag);

    if (id) {
        element.id = id;
    }

    if (className) {
        element.className = className;
    }

    return element;
}

function consumeEvent(event) {
    event.stopPropagation();
    event.preventDefault();
}

function consumeClick(event) {
    event.stopPropagation();
}

function isFunction(func) {
    return func != null && typeof func === "function";
}

// For example: Linux cannot be included as a desktop agent because it also appears along Android
// Similarly: Macintosh cannot be included as a desktop agent because it also appears along iPad
// What about TVs?
const MOBILE_AGENTS = ["Mobile", "Tablet", "Android", "iPhone", "iPod", "iPad"];
function isMobileAgent() {
    let userAgent = navigator.userAgent.trim();
    if (!userAgent || userAgent === "") {
        return false;
    }

    let bracketOpen = userAgent.indexOf("(");
    if (bracketOpen === -1) {
        return false;
    }

    let bracketClose = userAgent.indexOf(")", bracketOpen + 1);
    if (bracketClose === -1) {
        return false;
    }

    let systemInfo = userAgent.substring(bracketOpen + 1, bracketClose).trim();
    for (let i = 0; i < systemInfo.length; i++) {
        if (systemInfo.includes(MOBILE_AGENTS[i])) {
            return true;
        }
    }

    return false;
}

// This is a separate class for more clarity
class Options {
    constructor() {
        this.hidePlaybackButton   = false;
        this.hideNextButton       = false;
        this.hideLoopingButton    = false;
        this.hideVolumeButton     = false;
        this.hideVolumeSlider     = false;
        this.hideTimestamps       = false;
        this.hideDownloadButton   = false;
        this.hideSpeedButton      = false;
        this.hideAutoplayButton   = false;
        this.hideSubtitlesButton  = false;
        this.hideSettingsButton   = false;
        this.hideFullscreenButton = false;

        this.doubleTapThresholdMs = 300;
        this.enableDoubleTapSeek = isMobileAgent();
        this.sanitizeSubtitles = true;
        this.allowCueOverlap = true;
        this.fullscreenKeyLetter = 'f';

        // [Arrow keys/Double tap] seeking offset provided in seconds. (Preferably [1-99])
        this.seekBy = 5;

        // Delay in milliseconds before controls disappear.
        this.inactivityTime = 2500;

        // Disable the auto hide for player controls.
        this.autohideControls = true;
        this.showControlsOnPause = true;

        this.bufferingRedrawInterval = 1000;
    }

    // Ensure values are the intended type and within some reasonable range
    valid() {
        if (typeof this.seekBy !== "number" || this.seekBy < 0) {
            return false;
        }

        if (typeof this.inactivityTime !== "number" || this.inactivityTime < 0) {
            return false;
        }

        if (typeof this.bufferingRedrawInterval !== "number") {
            return false;
        }

        return true;
    }
}
