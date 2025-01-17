import { Options, Player } from "./custom_player.js"
import { Playlist } from "./playlist.js"
import { Chat } from "./chat.js"
import * as api from "./api.js";
import { getById, div, img, svg, button } from "./util.js";

const SERVER_ID = 0;
const MAX_TITLE_LENGTH = 200;

class Room {
    constructor() {
        let video0 = getById("video0");

        let options = new Options();
        options.hideSpeedButton = true;

        this.player   = new Player(video0, options);
        this.playlist = new Playlist();
        this.chat     = new Chat();

        this.urlArea = {
            root:          getById("url_area"),
            urlInput:      getById("url_input_box"),
            titleInput:    getById("url_title_input"),
            refererInput:  getById("url_dropdown_referer_input"),
            subtitleInput: getById("url_subtitle_name_input"),
            ytCountInput:  getById("youtube_video_count_input"),

            dropdownButton:       getById("url_dropdown_button"),
            resetButton:          getById("url_reset_button"),
            setButton:            getById("url_set_button"),
            addPlaylistButton:    getById("url_add_playlist_button"),
            selectSubtitleButton: getById("url_select_subtitle_button"),

            youtubeSearchToggle: getById("youtube_search_toggle"),
            asPlaylistToggle:    getById("as_playlist_toggle"),
            addToTopToggle:      getById("add_to_top_toggle"),
            proxyToggle:         getById("proxy_toggle"),

            dropdownContainer: getById("url_dropdown_container"),
        };

        this.usersArea = {
            userList: getById("users_list"),

            onlineCount:  getById("users_online_count"),
            offlineCount: getById("users_offline_count"),
        };

        this.rightPanel = {
            tabs: {
                room:     getById("tab_room"),
                playlist: getById("tab_playlist"),
                chat:     getById("tab_chat"),
                history:  getById("tab_history"),
            },

            content: {
                root:     getById("right_panel_content"),
                room:     getById("content_room"),
                playlist: getById("content_playlist"),
                chat:     getById("content_chat"),
                history:  getById("content_history"),
            },
        };

        this.nowPlaying = getById("room_now_playing_input");
        this.usingProxy = getById("room_using_proxy");

        this.uploadButton   = getById("room_upload_button");
        this.uploadInput    = getById("room_upload_input");
        this.uploadProgress = getById("room_upload_progress");

        let content = this.rightPanel.content.playlist;
        content.classList.add("content_view_selected");

        let tab = this.rightPanel.tabs.playlist;
        tab.classList.add("right_panel_tab_selected");

        this.rightPanel.selected = {
            tab:     tab,
            content: content,
        }

        this.youtubeSearchEnabled = false;
        this.asPlaylistEnabled    = false;
        this.addToTopEnabled      = false;
        this.proxyEnabled         = false;

        /// Current connection id.
        this.connectionId = 0;

        /// Currently connected user. Server User structure.
        this.currentUserId = -1;

        /// User token string.
        this.token = "";

        /// List of all users in current room.
        this.allUsers = [];

        /// List of all html user elements displayed inside of users_list element.
        this.allUserBoxes = [];

        /// Number of user online.
        this.onlineCount = 0;

        /// Subtitle file to be attached to the entry.
        this.subtitleFile = null;

        /// Id of the currently set entry.
        this.currentEntryId = 0;

        this.applyUserPreferences();
    }

    applyUserPreferences() {
        let volume = localStorage.getItem("volume");
        if (volume != null) {
            this.player.setVolume(volume);
        }
    }

    attachPlayerEvents() {
        // We have to know if anything is currently playing or whether something is set
        this.player.onControlsPlay(() => {
            console.log("IS LIVE", this.player.isLive())
            if (this.ended) {
                this.ended = false;
                api.playerPlay(0);
                return;
            }
            if (this.player.getCurrentUrl() === document.baseURI) {
                console.warn("Nothing is set");
                return;
            }
            api.playerPlay(this.player.getCurrentTime());
        })

        this.player.onControlsPause(() => {
            api.playerPause(this.player.getCurrentTime());
        })

        this.player.onControlsSeeked((timestamp) => {
            this.ended = false;
            api.playerSeek(timestamp);
        })

        this.player.onControlsSeeking((timestamp) => {
            console.log("User seeking to", timestamp);
        })

        this.player.onControlsNext(() => {
            api.playerNext(this.currentEntryId);
        });

        this.player.onControlsLooping(enabled => {
            api.playerLooping(enabled);
        });

        this.player.onControlsAutoplay(enabled => {
            api.playerAutoplay(enabled);
        });

        this.player.onControlsVolumeSet(volume => {
            // Maybe browsers optimize calls to localStorage and don't write to disk 30 times a second?
            localStorage.setItem("volume", volume)
        })

        this.player.onPlaybackEnd(() => {
            if (this.player.getAutoplay()) {
                api.playerNext(this.currentEntryId);
            } else {
                console.info("Playback ended! Informing the server");
                let endTime = this.player.getDuration();
                if (isNaN(endTime)) {
                    endTime = 0;
                }
                this.ended = true;
                api.playerPause(endTime)
            }
        });

        this.player.onPlaybackError((exception, error) => {
            if (exception.name === "NotAllowedError") {
                this.player.setToast("Auto-play is disabled by your browser!\nClick anywhere on the player to start the playback.");
                return;
            }

            if (exception.name === "AbortError") {
                this.player.setToast("Likely an invalid URL is set, pausing playback!");
                api.playerPause(this.player.getCurrentTime())
                return;
            }

            if (!error) {
                this.player.setToast("UNKNOWN ERROR, press F12 to see what happened!");
                console.error(exception.name + ":", exception.message);
                api.playerPause(this.player.getCurrentTime())
                return;
            }

            if (error.code === MediaError.MEDIA_ERR_DECODE) {
                this.player.setToast("Unable to decode media. " + error.message);
                return;
            }

            if (error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                // Distinguish between unsupported codec and 404.
                let errMsg = error.message;
                if (errMsg.startsWith("Failed to init decoder") || errMsg.startsWith("DEMUXER_ERROR_COULD_NOT_OPEN")) {
                    this.player.setToast("Unsupported codec or format: '" + this.player.getCurrentUrl() + "' " + error.message);
                    return;
                }
                if (errMsg.startsWith("NS_ERROR_DOM_INVALID") || errMsg.includes("Empty src")) {
                    this.player.setToast("Nothing is set!");
                    api.playerPause(this.player.getCurrentTime());
                    return;
                }

                if (errMsg.startsWith("404")) {
                    this.player.setToast("Resource not found [404]!");
                } else {
                    this.player.setToast("Unsupported src: '" + this.player.getCurrentUrl() + "' " + error.message);
                }

                api.playerPause(this.player.getCurrentTime())
                return;
            }

        })
    }

    resetUrlAreaElements() {
        this.urlArea.urlInput.value = "";
        this.urlArea.titleInput.value = "";
        this.urlArea.refererInput.value = "";
        this.urlArea.subtitleInput.value = "";
        this.urlArea.ytCountInput.value = "";

        this.subtitleFile = null;

        this.youtubeSearchEnabled = false;
        this.urlArea.youtubeSearchToggle.classList.remove("toggle_active");

        this.asPlaylistEnabled = false;
        this.urlArea.asPlaylistToggle.classList.remove("toggle_active");

        this.addToTopEnabled = false;
        this.urlArea.addToTopToggle.classList.remove("toggle_active");

        this.proxyEnabled = false;
        this.urlArea.proxyToggle.classList.remove("toggle_active");

    }

    createNewRequestEntry(subtitle) {
        if (!subtitle) {
            subtitle = "";
        }

        let countString = this.urlArea.ytCountInput.value.trim();
        let count = Number(countString)
        if (!count || count <= 0) {
            count = 20
        }

        const requestEntry = {
            url:          this.urlArea.urlInput.value.trim(),
            title:        this.urlArea.titleInput.value.trim(),
            use_proxy:    this.proxyEnabled,
            referer_url:  this.urlArea.refererInput.value.trim(),
            subtitle_url: subtitle,
            search_video: this.youtubeSearchEnabled,
            is_playlist:  this.asPlaylistEnabled,
            add_to_top:   this.addToTopEnabled,
            playlist_skip_count: 0,
            playlist_max_size:   count,
        };

        return requestEntry;
    }

    attachRightPanelEvents() {
        let select = (tab, content) => {
            this.rightPanel.selected.tab.classList.remove("right_panel_tab_selected");
            this.rightPanel.selected.content.classList.remove("content_view_selected");

            tab.classList.add("right_panel_tab_selected");
            content.classList.add("content_view_selected");

            this.rightPanel.selected.tab = tab;
            this.rightPanel.selected.content = content;
        }

        let tabs = this.rightPanel.tabs;
        let content = this.rightPanel.content;

        tabs.room.onclick     = _ => select(tabs.room, content.room);
        tabs.playlist.onclick = _ => select(tabs.playlist, content.playlist);
        tabs.chat.onclick     = _ => select(tabs.chat, content.chat);
        tabs.history.onclick  = _ => select(tabs.history, content.history);

        this.uploadButton.onclick = _ => {
            this.uploadInput.click();
        };

        this.uploadInput.onchange = event => {
            let files = event.target.files;

            if (files.length === 0) {
                return;
            }

            api.uploadMediaWithProgress(files[0], progress => {
                this.uploadProgress.value = progress;
            });
        };
    }

    attachUrlAreaEvents() {
        this.urlArea.dropdownButton.onclick = () => {
            this.urlArea.root.classList.toggle("url_area_expand");
        }

        this.urlArea.resetButton.onclick = () => {
            this.resetUrlAreaElements();
        }

        this.urlArea.setButton.onclick = async _ => {
            let subtitlePath = "";
            if (this.subtitleFile) {
                let filename = this.urlArea.subtitleInput.value;
                subtitlePath = await api.uploadSubs(this.subtitleFile, filename);
            }

            let entry = this.createNewRequestEntry(subtitlePath);
            api.playerSet(entry).then(jsonResponse => {
                if (jsonResponse.checkAndLogError()) {
                    return;
                }

                // Only reset if request was successful
                this.resetUrlAreaElements();
            });
        }

        this.urlArea.addPlaylistButton.onclick = async _ => {
            let subtitlePath = "";
            if (this.subtitleFile) {
                let filename = this.urlArea.subtitleInput.value;
                subtitlePath = await api.uploadSubs(this.subtitleFile, filename);
            }

            let entry = this.createNewRequestEntry(subtitlePath);
            if (entry.url) {
                api.playlistAdd(entry);
                this.resetUrlAreaElements();
            }
        }


        this.urlArea.selectSubtitleButton.onclick = _ => {
            let input = document.createElement('input');
            input.type = "file";
            input.accept = ".srt,.vtt";
            input.onchange = event => {
                let files = event.target.files;

                if (files.length === 0) {
                    return;
                }

                console.log("File selected: ", files[0]);
                this.subtitleFile = files[0];
                this.urlArea.subtitleInput.value = this.subtitleFile.name;
            }
            input.click();
        }

        this.urlArea.youtubeSearchToggle.onclick = _ => {
            this.urlArea.youtubeSearchToggle.classList.toggle("toggle_active");
            this.youtubeSearchEnabled = !this.youtubeSearchEnabled;
        }

        this.urlArea.asPlaylistToggle.onclick = _ => {
            this.urlArea.asPlaylistToggle.classList.toggle("toggle_active");
            this.asPlaylistEnabled = !this.asPlaylistEnabled;
        }

        this.urlArea.addToTopToggle.onclick = _ => {
            this.urlArea.addToTopToggle.classList.toggle("toggle_active");
            this.addToTopEnabled = !this.addToTopEnabled;
        }

        this.urlArea.proxyToggle.onclick = _ => {
            this.urlArea.proxyToggle.classList.toggle("toggle_active");
            this.proxyEnabled = !this.proxyEnabled;
        }
    }

    attachHtmlEvents() {
        this.playlist.attachPlaylistEvents();
        this.attachUrlAreaEvents();
        this.attachRightPanelEvents();
    }

    getUsernameByUserId(userId) {
        if (userId === SERVER_ID) {
            return "Server";
        }
        let index = this.allUsers.findIndex(user => user.id === userId);
        return index === -1 ? userId : this.allUsers[index].username;
    }

    async createNewAccount() {
        this.token = await api.userCreate();
        api.setToken(this.token);
        localStorage.setItem("token", this.token);
    }

    async authenticateAccount(firstTry) {
        this.token = localStorage.getItem("token");
        api.setToken(this.token);

        let verification = await api.userVerify();
        if (firstTry && !verification.ok) {
            return false;
        }

        if (verification.checkAndLogError()) {
            return false;
        }

        this.currentUserId = verification.json;
        return true;
    }

    async loadPlayerData() {
        let state = await api.playerGet();
        this.player.setAutoplay(state.player.autoplay);
        this.player.setLooping(state.player.looping);

        let entry = state.entry;
        this.setEntryEvent(entry);
    }

    async loadUsersData() {
        this.allUsers = await api.userGetAll();
        console.log(this.allUsers);

        let onlineBoxes = [];
        let offlineBoxes = [];
        let selfBox = null;

        for (var i = 0; i < this.allUsers.length; i++) {
            let user = this.allUsers[i];
            let userBox = this.createUserBox(user);

            if (user.id == this.currentUserId) {
                user.online = true;
                this.onlineCount += 1;
                userBox.classList.add("user_box_online");
                selfBox = userBox;
            } else if (user.online) {
                this.onlineCount += 1;
                userBox.classList.add("user_box_online");
                onlineBoxes.push(userBox);
            } else {
                userBox.classList.add("user_box_offline");
                offlineBoxes.push(userBox);
            }

            this.allUserBoxes.push(userBox);
        }

        let userList = this.usersArea.userList;
        userList.append(selfBox);

        for (let i = 0; i < onlineBoxes.length; i++) {
            let box = onlineBoxes[i];
            userList.append(box);
        }

        for (let i = 0; i < offlineBoxes.length; i++) {
            let box = offlineBoxes[i];
            userList.append(box);
        }

        this.usersArea.onlineCount.textContent = this.onlineCount;
        this.usersArea.offlineCount.textContent = this.allUsers.length - this.onlineCount;
    }

    createUserBox(user) {
        let userBox       = div("user_box");
        let userBoxTop    = div("user_box_top");
        let userAvatar    = img(user.avatar);
        let userBoxBottom = div("user_box_bottom");
        let usernameInput = document.createElement("input");

        //
        // Configuring parameters for html elements.
        //
        usernameInput.readOnly = true;
        usernameInput.value = user.username;

        //
        // Constructing html element structure.
        //
        userBox.append(userBoxTop); {
            userBoxTop.append(userAvatar);
        }
        userBox.append(userBoxBottom); {
            userBoxBottom.append(usernameInput);
        }

        if (user.id == this.currentUserId) {
            // NOTE(kihau): Temporary. The user box CSS styling and code logic will be slightly refactored.
            // userBox.style.borderColor    = "#ebdbb2";
            // userBoxTop.style.borderColor = "#ebdbb2";

            // userBox.style.borderColor    = "#b8bb26";
            // userBoxTop.style.borderColor = "#b8bb26";

            userBox.style.borderColor    = "#d5c4a1";
            userBoxTop.style.borderColor = "#d5c4a1";
            userBox.style.boxShadow      = "0px 0px 4px #fbf1cf inset"


            let changeAvatarButton = button("user_box_change_avatar", "Update your avatar");
            let editNameButton = button("user_box_edit_name_button", "Change your username");
            let editSvg = svg("svg/main_icons.svg#edit2");

            //
            // Configuring parameters for html elements.
            //
            changeAvatarButton.textContent = "E";

            //
            // Attaching events to html elements
            //
            changeAvatarButton.onclick = () => {
                var input = document.createElement('input');
                input.type = "file";

                input.onchange = event => {
                    var file = event.target.files[0];
                    console.log("Picked file:", file);
                    api.userUpdateAvatar(file).then(newAvatar => {
                        if (newAvatar) {
                            userAvatar.src = newAvatar;
                        }
                    });
                }

                input.click();
            };

            usernameInput.addEventListener("focusout", () => {
                usernameInput.readOnly = true;
                api.userUpdateName(usernameInput.value);
            });

            usernameInput.addEventListener("keypress", event => {
                if (event.key === "Enter") {
                    usernameInput.readOnly = true;
                    api.userUpdateName(usernameInput.value);
                }
            });

            editNameButton.onclick = () => {
                usernameInput.readOnly = false;
                usernameInput.focus();
            };

            //
            // Constructing html element structure
            //
            userBoxTop.append(changeAvatarButton);
            userBoxBottom.append(editNameButton); {
                editNameButton.append(editSvg);
            }
        }

        return userBox;
    }


    async loadPlaylistData() {
        let entries = await api.playlistGet();
        if (!entries) {
            return;
        }

        console.log(entries);

        // TOOD(kihau): Performance problem when number of entries is large. Needs to be fixed at some point.
        this.playlist.loadEntries(entries, this.allUsers);
    }

    async loadChatData() {
        let messages = await api.chatGet();
        if (!messages) {
            return;
        }

        console.log(messages);
        this.chat.loadMessages(messages, this.allUsers);
    }

    setEntryEvent(entry) {
        this.nowPlaying.value = entry.url;
        this.usingProxy.checked = entry.user_proxy;

        this.currentEntryId = entry.id;

        let url = entry.url
        if (!url) {
            this.setNothing();
            return;
        }

        if (entry.source_url) {
            url = entry.source_url;
        }

        this.player.setVideoTrack(url);

        if (entry.title) {
            if (entry.title.length > MAX_TITLE_LENGTH) {
                entry.title = entry.title.substring(0, MAX_TITLE_LENGTH);
            }
            this.player.setTitle(entry.title);
        }

        this.player.clearAllSubtitleTracks();
        if (entry.subtitle_url) {
            this.player.addSubtitle(entry.subtitle_url);
        }

        this.player.setPoster(null)
        if (entry.thumbnail) {
            this.player.setPoster(entry.thumbnail);
        }

        if (this.player.getAutoplay()) {
            this.player.play();
        }
    }

    setNothing() {
        this.player.discardPlayback();
        this.player.setTitle(null);
        this.player.setPoster("")
        this.player.setToast("Nothing is playing at the moment!");
        this.player.clearAllSubtitleTracks();
    }

    resyncPlayer(timestamp, userId) {
        const MAX_DESYNC = 1.5;
        let desync = timestamp - this.player.getCurrentTime();

        if (userId == 0) {
            console.info("INFO: Received resync event from SERVER at", timestamp, "with desync:", desync);
        } else {
            console.info("INFO: Received resync event from USER id", userId, "at", timestamp, "with desync:", desync);
        }

        if (Math.abs(desync) > MAX_DESYNC) {
            let diff = Math.abs(desync) - MAX_DESYNC
            console.warn("You are desynced! MAX_DESYNC(" + MAX_DESYNC + ") exceeded by:", diff, "Trying to resync now!");
            this.player.seek(timestamp);
        }
    }

    listenToServerEvents() {
        let events = new EventSource("/watch/api/events?token=" + this.token);
        this.subscribeToServerEvents(events);
    }

    subscribeToServerEvents(events) {
        events.addEventListener("userwelcome", event => {
            let connectionId = JSON.parse(event.data);
            console.info("INFO: Received a welcome request with connection id: ", connectionId);
            this.connectionId = connectionId;

            api.setConnectionId(this.connectionId);
        });

        events.addEventListener("usercreate", event => {
            let user = JSON.parse(event.data)
            this.allUsers.push(user)
            console.info("INFO: New user has been created: ", user)

            let userBox = this.createUserBox(user);
            userBox.classList.add("user_box_offline");
            this.allUserBoxes.push(userBox);
            this.usersArea.userList.appendChild(userBox);

            this.usersArea.onlineCount.textContent = this.onlineCount;
            this.usersArea.offlineCount.textContent = this.allUsers.length - this.onlineCount;
        });

        // All user-related update events can be multiplexed into one "user-update" event to simplify logic
        // The server will always serve the up-to-date snapshot of User which should never exceed 1 kB in practice
        events.addEventListener("userconnected", event => {
            let userId = JSON.parse(event.data);
            console.info("INFO: User connected, ID: ", userId)

            let i = this.allUsers.findIndex(user => user.id === userId);
            this.allUsers[i].online = true;
            this.allUserBoxes[i].classList.remove("user_box_offline");
            this.allUserBoxes[i].classList.add("user_box_online");

            this.onlineCount += 1;

            this.usersArea.onlineCount.textContent = this.onlineCount;
            this.usersArea.offlineCount.textContent = this.allUsers.length - this.onlineCount;
        });

        events.addEventListener("userdisconnected", event => {
            let userId = JSON.parse(event.data);
            console.info("INFO: User disconnected, ID: ", userId)

            let i = this.allUsers.findIndex(user => user.id === userId);

            this.allUsers[i].online = false;
            this.allUserBoxes[i].classList.remove("user_box_online");
            this.allUserBoxes[i].classList.add("user_box_offline");

            this.onlineCount -= 1;

            this.usersArea.onlineCount.textContent = this.onlineCount;
            this.usersArea.offlineCount.textContent = this.allUsers.length - this.onlineCount;
        });

        events.addEventListener("userupdate", event => {
            let user = JSON.parse(event.data);
            console.info("INFO: Update user name event for: ", user)

            let i = this.allUsers.findIndex(x => x.id == user.id);
            this.allUsers[i] = user; // emplace the user

            let input = this.allUserBoxes[i].querySelectorAll('input')[0];
            input.value = user.username;

            let img = document.createElement("img");
            img.src = user.avatar;
            this.allUserBoxes[i].querySelectorAll('img')[0].replaceWith(img);

            this.playlist.handleUserUpdate(user);
        });

        events.addEventListener("playerset", event => {
            let response = JSON.parse(event.data);
            console.info("INFO: Received player set event: ", response);

            let newEntry = response.new_entry;
            this.setEntryEvent(newEntry);

            let prevEntry = response.prev_entry;
            if (this.player.isLooping() && prevEntry.url !== "") {
                this.playlist.addEntry(prevEntry, this.allUsers);
            }
        });

        events.addEventListener("playernext", event => {
            let response = JSON.parse(event.data);
            let prevEntry = response.prev_entry;

            let newEntry = response.new_entry;
            this.setEntryEvent(newEntry);

            if (this.player.isLooping() && prevEntry.url !== "") {
                this.playlist.addEntry(prevEntry, this.allUsers);
            }

            this.playlist.removeAt(0);
        });

        events.addEventListener("playerlooping", event => {
            let looping = JSON.parse(event.data);
            this.player.setLooping(looping)
        });

        events.addEventListener("playerautoplay", event => {
            let autoplay = JSON.parse(event.data);
            this.player.setAutoplay(autoplay)
        });

        events.addEventListener("sync", event => {
            let data = JSON.parse(event.data);
            if (!data) {
                console.error("ERROR: Failed to parse event data")
                return;
            }

            let timestamp = data.timestamp;
            let userId = data.user_id;
            let username = this.getUsernameByUserId(userId);

            switch (data.action) {
                case "play": {
                    if (userId != SERVER_ID) {
                        this.player.setToast(username + " clicked play.");
                    }
                    this.resyncPlayer(timestamp, userId);
                    this.player.play();
                } break;

                case "pause": {
                    if (userId != SERVER_ID) {
                        this.player.setToast(username + " clicked pause.");
                    }
                    this.resyncPlayer(timestamp, userId);
                    this.player.pause();
                } break;

                case "seek": {
                    if (userId != SERVER_ID) {
                        let shortStamp = timestamp.toFixed(2);
                        this.player.setToast(username + " seeked to " + shortStamp);
                    }
                    this.player.seek(timestamp);
                } break;

                default: {
                    console.error("ERROR: Unknown sync action found", data.action)
                } break;
            }
        });

        events.addEventListener("playlist", event => {
            let response = JSON.parse(event.data);
            console.info("INFO: Received playlist event for:", response.action, "with:", response.data);
            this.playlist.handleServerEvent(response.action, response.data, this.allUsers);
        });

        events.addEventListener("messagecreate", event => {
            let data = JSON.parse(event.data);
            console.info("INFO: New message received from server");
            this.chat.addMessage(data, this.allUsers);
        });

        events.onopen = () => {
            console.info("Connection to events opened!");
        }

        events.onerror = event => {
            console.error("EVENTS ERROR: ", event);
            console.info("Closing current EventSource, current readyState =", events.readyState)
            events.close();
            let retryAfter = 5000;
            console.info("Attempting reconnect in", retryAfter, "ms.")
            setTimeout(() => {
                this.listenToServerEvents()
            }, retryAfter)
        }
    }

    async connectToServer() {
        // Temporary workaround for lack of persistent server-side account storage
        if (!await this.authenticateAccount(true)) {
            await this.createNewAccount();
            await this.authenticateAccount();
        }
        await this.loadPlayerData();
        await this.loadUsersData();
        await this.loadPlaylistData();
        await this.loadChatData();
        this.listenToServerEvents();
    }
}

async function main() {
    let room = new Room()
    room.attachPlayerEvents();
    room.attachHtmlEvents();
    await room.connectToServer();

    // Expose room to browser console for debugging.
    window.room = room;
}

main();
