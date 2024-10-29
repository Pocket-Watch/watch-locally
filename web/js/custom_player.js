export { Player };

class Player {
    constructor(videoElement, options) {
        if (!videoElement || videoElement.tagName.toLowerCase() !== "video") {
            throw new Error("An invalid video element was passed!");
        }
        this.internals = new Internals(videoElement, options)
    }

    // isVideoPlaying() {
    //     return !this.htmlVideo.paused && !this.htmlPlayer.ended;
    // }

    play() {
       this.internals.play()
    }

    pause() {
        this.internals.pause()
    }

    seek(timestamp) {
        this.internals.seek(timestamp)
    }

    setVolume(volume) {
        this.internals.setVolume(volume)
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
    onControlsSeek(func) {
        if (!isFunction(func)) {
            return;
        }
        // an anonymous function is needed to receive arguments from the underlying function
        this.internals.fireControlsSeek = function(timestamp) {
            func(timestamp);
        }
    }
    onControlsVolumeSet(func) {
        if (!isFunction(func)) {
            return;
        }
        // an anonymous function is needed to receive arguments from the underlying function
        this.internals.fireControlsVolumeSet = function(volume) {
            func(volume);
        }
    }

    setVideoTrack(url) {
        this.internals.setVideoTrack(url)
    }
}

class Internals {
    constructor(videoElement, options) {
        // Corresponds to the actual html player element called either </video> or </audio>.
        this.htmlVideo = videoElement;

        // Div container where either the player or the placeholder resides.
        this.htmlPlayerRoot = document.createElement("div");
        this.htmlPlayerRoot.id = "player_container";

        // We actually need to append the <div> to document.body (or <video>'s parent)
        // otherwise the <video> tag will disappear entirely!
        let videoParent = this.htmlVideo.parentNode;
        videoParent.appendChild(this.htmlPlayerRoot);
        this.htmlPlayerRoot.appendChild(this.htmlVideo);

        this.htmlControls = {
            timestampSlider: null,
            playToggleButton: null,
            nextButton: null,
            volume: null,
            volumeSlider: null,
            timestamp: null,
        };

        // instance of which can be passed on player initialization for more customizability
        // We could then pass these options during the creation of controls or svg resource loaders
        if (options instanceof Options && options.valid()) {
            this.options = options
        } else {
            this.options = new Options()
        }


        // We could store references to images/svg/videos here for easy access
        // TODO? IDK if we need to store references to 'use' ones
        this.resources = {
            pauseSvg: null,
            pauseUse: null,
            playSvg: null,
            playUse: null,
            nextSvg: null,
            nextUse: null,
            volumeSvg: null,
            volumeUse: null,
            fullscreenSvg: null,
            fullscreenUse: null,
        };

        this.initializeSvgResources();
        this.createHtmlControls();
        this.attachHtmlEvents();
    }

    fireControlsPlay() {}
    fireControlsPause() {}
    fireControlsNext() {}
    fireControlsSeek(_timestamp) {}
    fireControlsVolumeSet(_volume) {}

    play() {
        this.htmlControls.playToggleButton.getElementsByTagName("svg")[0].replaceWith(this.resources.pauseSvg);
        this.htmlVideo.play();
    }
    pause() {
        this.htmlControls.playToggleButton.getElementsByTagName("svg")[0].replaceWith(this.resources.playSvg);
        this.htmlVideo.pause();
    }
    seek(timestamp) {
        this.htmlVideo.currentTime = timestamp;
        this.updateTimestamps(timestamp);
    }

    updateTimestamps(timestamp) {
        let position = timestamp / this.htmlVideo.duration;
        this.htmlControls.timestampSlider.value = position;

        let current = createTimestampString(this.htmlVideo.currentTime);
        // NOTE(kihau): This duration string does not need to be updated every time since the duration does not change?
        let duration = createTimestampString(this.htmlVideo.duration);

        this.htmlControls.timestamp.textContent = current + " / " + duration;
    }

    updateVolumeSlider(volume) {
        if (volume > 1.0) {
            volume = 1.0;
        }

        if (volume < 0.0) {
            volume = 0.0;
        }

        this.htmlControls.volumeSlider.value = volume;
    }

    getNewTime(timeOffset) {
        let timestamp = this.htmlVideo.currentTime + timeOffset;
        if (timestamp < 0) {
            timestamp = 0;
        }
        return timestamp
    }

    setVolume(volume) {
        if (volume > 1.0) {
            volume = 1.0;
        }

        if (volume < 0.0) {
            volume = 0.0;
        }

        this.htmlVideo.volume = volume;
        this.updateVolumeSlider(volume);
    }

    // TODO(kihau): Non linear scaling?
    setVolumeRelative(volume) {
        this.setVolume(this.htmlVideo.volume + volume)
    }

    togglePlay() {
        if (this.htmlVideo.paused) {
            this.fireControlsPlay();
            this.play();
        } else {
            this.fireControlsPause();
            this.pause();
        }
    }

    setVideoTrack(url) {
        let source = this.htmlVideo.querySelector("source");
        if (!source) {
            console.debug("Creating a source tag");
            source = document.createElement("source");
            this.htmlVideo.appendChild(source);
        }
        source.setAttribute("src", url);
        source.setAttribute("type", "video/mp4");
        // source.src = url;
        // source.type = "video/mp4";
        this.htmlVideo.load();
    }

    attachHtmlEvents() {
        this.htmlControls.playToggleButton.onclick = () => {
            this.togglePlay();
        };

        this.htmlControls.nextButton.onclick = () => {
            this.fireControlsNext();
        };

        this.htmlVideo.onkeydown = (event) => {
            if (event.key == " " || event.code == "Space" || event.keyCode == 32) {
                this.togglePlay();
                consumeEvent(event)
            }

            if (event.key == "ArrowLeft" || event.keyCode == 37) {
                let timestamp = this.getNewTime(-this.options.seekBy);
                this.fireControlsSeek(timestamp);
                this.seek(timestamp)
                consumeEvent(event)
            }

            if (event.key == "ArrowRight" || event.keyCode == 39) {
                // We should use options here
                let timestamp = this.getNewTime(this.options.seekBy);
                this.fireControlsSeek(timestamp);
                this.seek(timestamp)
                consumeEvent(event)
            }

            if (event.key == "ArrowUp" || event.keyCode == 38) {
                this.setVolumeRelative(0.1);
                consumeEvent(event)
            }

            if (event.key == "ArrowDown" || event.keyCode == 40) {
                this.setVolumeRelative(-0.1);
                consumeEvent(event)
            }

        };

        this.htmlVideo.onclick = (_event) => {
            this.togglePlay();
        };

        this.htmlControls.volumeSlider.oninput = (_event) => {
            let volume = this.htmlControls.volumeSlider.value;
            this.fireControlsVolumeSet(volume);
            this.setVolume(volume);
        };

        this.htmlControls.timestampSlider.oninput = (_event) => {
            let position = this.htmlControls.timestampSlider.value;
            let timestamp = this.htmlVideo.duration * position;
            this.fireControlsSeek(timestamp);
            this.seek(timestamp);
            this.htmlControls.timestampSlider.blur()
        };

        this.htmlVideo.ontimeupdate = (_event) => {
            let timestamp = this.htmlVideo.currentTime;
            this.updateTimestamps(timestamp);
        };
    }

    initializeSvgResources() {
        // https://developer.mozilla.org/en-US/docs/Web/API/Document/createElementNS#important_namespace_uris
        let SVG_URI = "http://www.w3.org/2000/svg";
        // Lift and shifted
        let res = this.resources;
        res.playSvg = document.createElementNS(SVG_URI, "svg");
        res.playUse = document.createElementNS(SVG_URI, "use");
        res.playUse.setAttribute("href", "svg/player_icons.svg#play");
        res.playSvg.appendChild(res.playUse);

        res.pauseSvg = document.createElementNS(SVG_URI, "svg");
        res.pauseUse = document.createElementNS(SVG_URI, "use");
        res.pauseSvg.appendChild(res.pauseUse);
        res.pauseUse.setAttribute("href", "svg/player_icons.svg#pause");

        res.nextSvg = document.createElementNS(SVG_URI, "svg");
        res.nextUse = document.createElementNS(SVG_URI, "use");
        res.nextUse.setAttribute("href", "svg/player_icons.svg#next");
        res.nextSvg.appendChild(res.nextUse);

        res.volumeSvg = document.createElementNS(SVG_URI, "svg");
        res.volumeUse = document.createElementNS(SVG_URI, "use");
        res.volumeUse.setAttribute("href", "svg/player_icons.svg#volume");
        res.volumeSvg.appendChild(res.volumeUse);

        res.fullscreenSvg = document.createElementNS(SVG_URI, "svg");
        res.fullscreenUse = document.createElementNS(SVG_URI, "use");
        res.fullscreenUse.setAttribute("href", "svg/player_icons.svg#fullscreen");
        res.fullscreenSvg.appendChild(res.fullscreenUse);
    }

    createHtmlControls() {
        let playerControls = document.createElement("div");
        playerControls.id = "player_controls";

        let timestampSlider = document.createElement("input");
        timestampSlider.id = "player_timestamp_slider";
        timestampSlider.type = "range";
        timestampSlider.min = "0";
        timestampSlider.max = "1";
        timestampSlider.value = "0";
        timestampSlider.step = "any";
        // NOTE(kihau): This will be part of the player_controls <div/>.
        this.htmlPlayerRoot.appendChild(timestampSlider);
        this.htmlControls.timestampSlider = timestampSlider;

        let playToggle = document.createElement("div");
        playToggle.id = "player_play_toggle";
        playToggle.appendChild(this.resources.playSvg);
        playerControls.appendChild(playToggle);
        this.htmlControls.playToggleButton = playToggle;

        let next = document.createElement("div");
        next.id = "player_next";
        next.appendChild(this.resources.nextSvg);
        playerControls.appendChild(next);
        this.htmlControls.nextButton = next;

        let volume = document.createElement("div");
        volume.id = "player_volume";
        volume.appendChild(this.resources.volumeSvg);
        playerControls.appendChild(volume);
        this.htmlControls.volume = volume;

        let volumeSlider = document.createElement("input");
        volumeSlider.id = "volume_slider";
        volumeSlider.type = "range";
        volumeSlider.min = "0";
        volumeSlider.max = "1";
        volumeSlider.value = "1";
        volumeSlider.step = "any";
        playerControls.appendChild(volumeSlider);
        this.htmlControls.volumeSlider = volumeSlider;

        let timestamp = document.createElement("span");
        timestamp.id = "timestamp";
        timestamp.textContent = "00:00 / 00:00";
        playerControls.appendChild(timestamp);
        this.htmlControls.timestamp = timestamp;

        let fullscreen = document.createElement("div");
        fullscreen.id = "player_fullscreen";

        fullscreen.appendChild(this.resources.fullscreenSvg);
        playerControls.appendChild(fullscreen);
        this.htmlPlayerRoot.appendChild(playerControls);
    }
}

function createTimestampString(timestamp) {
    let seconds = Math.floor(timestamp % 60.0);
    let minutes = Math.floor(timestamp / 60.0);

    let timestamp_string = ""
    if (minutes < 10) {
        timestamp_string += "0";
    }

    timestamp_string += minutes;
    timestamp_string += ":";

    if (seconds < 10) {
        timestamp_string += "0";
    }

    timestamp_string += seconds;
    return timestamp_string
}

function consumeEvent(event) {
    event.stopPropagation();
    event.preventDefault();
}

function isFunction(func) {
    return func != null && typeof func === "function";
}

// This is a separate class for more clarity
class Options {
    constructor() {
        this.showPlayToggleButton = true
        this.showNextButton = true
        this.showVolumeSlider = true
        this.showFullscreenButton = true
        this.showSubtitlesButton = true
        this.showAutoPlay = true
        // video.width = video.videoWidth, video.height = video.videoHeight
        this.resizeToMedia =  true
        this.seekBy = 5 // arrow seeking offset
        this.hideControlsDelay = 2.5 // time in seconds before controls disappear
    }
    // Ensure values are the intended type and within some reasonable range
    valid() {
        return true
    }
}