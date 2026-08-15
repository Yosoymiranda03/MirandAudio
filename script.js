// ============================================================
// MIRAND-AUDIO
// Motor principal
// ============================================================

// ---------------- DOM ----------------

const audioFileInput = document.getElementById('audio-file');

const pitchControl = document.getElementById('pitch-control');
const reverbControl = document.getElementById('reverb-control');

const pitchValText = document.getElementById('pitch-val');
const reverbValText = document.getElementById('reverb-val');

const statusText = document.getElementById('status-text');

const queueList = document.getElementById('playlist-queue');

const btnBack = document.getElementById('btn-back');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnNext = document.getElementById('btn-next');
const btnDownload = document.getElementById('btn-download');

const volumeControl = document.getElementById('volume-control');
const volumeVal = document.getElementById('volume-val');
const muteButton = document.getElementById('mute-button');

const progressControl = document.getElementById('progress-control');
const currentTimeText = document.getElementById('current-time');
const durationTimeText = document.getElementById('duration-time');

const bassControl = document.getElementById('bass-control');
const bassVal = document.getElementById('bass-val');

const eqBass = document.getElementById('eq-bass');
const eqMid = document.getElementById('eq-mid');
const eqTreble = document.getElementById('eq-treble');

const vocalControl = document.getElementById('vocal-control');
const vocalVal = document.getElementById('vocal-val');

const widthControl = document.getElementById('width-control');
const widthVal = document.getElementById('width-val');

const crossfadeControl = document.getElementById('crossfade-control');
const crossfadeVal = document.getElementById('crossfade-val');

const shuffleButton = document.getElementById('shuffle-button');
const repeatButton = document.getElementById('repeat-button');

const currentTrackName = document.getElementById('current-track-name');
const technicalDetails = document.getElementById('technical-details');
const trackTechnicalInfo = document.getElementById('track-technical-info');

const visualizer = document.getElementById('audio-visualizer');

const themeToggle = document.getElementById('theme-toggle');

const shortcutsButton = document.getElementById('shortcuts-button');
const shortcutsMenu = document.getElementById('shortcuts-menu');
const closeShortcuts = document.getElementById('close-shortcuts');


// ---------------- AUDIO ----------------

let audioCtx = null;

let playlist = [];

let currentIndex = -1;

let currentSource = null;

let currentSourceDry = null;
let currentSourceWet = null;

let reverbNode = null;

let masterGain = null;

let analyser = null;

let bassFilter = null;
let midFilter = null;
let trebleFilter = null;

let vocalNode = null;
let widthNode = null;

let isPlaying = false;

let startTime = 0;

let pauseOffset = 0;

let animationFrame = null;

let crossfadeTimer = null;

let crossfadeStarted = false;

let nextCrossfadeSource = null;

let nextCrossfadeDry = null;
let nextCrossfadeWet = null;

let shuffleEnabled = false;

let repeatMode = 0;
// 0 = OFF
// 1 = REPEAT ALL
// 2 = REPEAT ONE

let lastVolume = 0.8;

let muted = false;


// ============================================================
// MEDIA SESSION
// (controles en pantalla de bloqueo / notificación en
// Android e iOS Safari, y en la barra multimedia de escritorio)
// ============================================================

function setupMediaSession() {

    if (!("mediaSession" in navigator)) return;


    navigator.mediaSession.setActionHandler(
        "play",
        () => {

            if (playlist.length > 0) playCurrentTrack();
        }
    );

    navigator.mediaSession.setActionHandler(
        "pause",
        () => pauseTrack()
    );

    navigator.mediaSession.setActionHandler(
        "previoustrack",
        () => btnBack.click()
    );

    navigator.mediaSession.setActionHandler(
        "nexttrack",
        () => btnNext.click()
    );
}


function updateMediaSessionMetadata(track) {

    if (!("mediaSession" in navigator)) return;


    navigator.mediaSession.metadata =
        new MediaMetadata({
            title: track.name,
            artist: "Mirand-Audio",
            album: "Procesador de Audio Pro"
        });
}


function setMediaSessionPlaybackState(state) {

    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.playbackState = state;
}


// ============================================================
// AUDIO INITIALIZATION
// ============================================================

function initAudio() {

    if (audioCtx) return;

    audioCtx = new (
        window.AudioContext ||
        window.webkitAudioContext
    )();

    masterGain = audioCtx.createGain();

    analyser = audioCtx.createAnalyser();

    analyser.fftSize = 256;

    masterGain.connect(analyser);

    analyser.connect(audioCtx.destination);


    // ---------------- EQ ----------------

    bassFilter = audioCtx.createBiquadFilter();

    bassFilter.type = "lowshelf";

    bassFilter.frequency.value = 150;


    midFilter = audioCtx.createBiquadFilter();

    midFilter.type = "peaking";

    midFilter.frequency.value = 1000;

    midFilter.Q.value = 1;


    trebleFilter = audioCtx.createBiquadFilter();

    trebleFilter.type = "highshelf";

    trebleFilter.frequency.value = 5000;


    // ---------------- VOCAL ----------------

    vocalNode = audioCtx.createGain();

    vocalNode.gain.value = 1;


    // ---------------- WIDTH ----------------

    widthNode = audioCtx.createStereoPanner();

    widthNode.pan.value = 0;


    // ---------------- REVERB ----------------

    reverbNode = audioCtx.createConvolver();

    createReverbImpulse(
        audioCtx,
        reverbNode
    );


    // ---------------- MASTER ----------------

    masterGain.gain.value =
        parseFloat(volumeControl.value);


    // Signal chain

    bassFilter.connect(midFilter);

    midFilter.connect(trebleFilter);

    trebleFilter.connect(vocalNode);

    vocalNode.connect(widthNode);

    widthNode.connect(masterGain);

    reverbNode.connect(masterGain);


    updateReverbMix(
        parseFloat(reverbControl.value)
    );


    startVisualizer();
}


// ============================================================
// REVERB
// ============================================================

function createReverbImpulse(context, nodeTarget) {

    const sampleRate = context.sampleRate;

    const length = Math.floor(
        sampleRate * 2.5
    );

    const impulseBuffer =
        context.createBuffer(
            2,
            length,
            sampleRate
        );

    for (
        let channel = 0;
        channel < 2;
        channel++
    ) {

        const data =
            impulseBuffer.getChannelData(channel);

        for (
            let i = 0;
            i < length;
            i++
        ) {

            data[i] =
                (Math.random() * 2 - 1) *
                Math.pow(
                    1 - i / length,
                    2.5
                );
        }
    }

    nodeTarget.buffer = impulseBuffer;
}


function updateReverbMix(value) {

    reverbValText.innerText =
        `${Math.round(value * 100)}%`;
}


// ============================================================
// CREATE AUDIO SOURCE
// ============================================================

function createTrackSource(track, offset = 0) {

    const source =
        audioCtx.createBufferSource();

    source.buffer = track.buffer;

    source.playbackRate.value =
        parseFloat(pitchControl.value);


    const dry =
        audioCtx.createGain();

    const wet =
        audioCtx.createGain();


    const reverbAmount =
        parseFloat(reverbControl.value);


    dry.gain.value =
        1 - reverbAmount;

    wet.gain.value =
        reverbAmount;


    source.connect(dry);

    source.connect(reverbNode);

    dry.connect(bassFilter);

    wet.connect(reverbNode);


    return {
        source,
        dry,
        wet
    };
}


// ============================================================
// PLAY CURRENT TRACK
// ============================================================

function playCurrentTrack() {

    if (
        currentIndex < 0 ||
        currentIndex >= playlist.length
    ) {
        return;
    }


    initAudio();


    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }


    stopSourceSafely();


    const track =
        playlist[currentIndex];


    if (
        pauseOffset >=
        track.buffer.duration
    ) {
        pauseOffset = 0;
    }


    const nodes =
        createTrackSource(
            track,
            pauseOffset
        );


    currentSource =
        nodes.source;

    currentSourceDry =
        nodes.dry;

    currentSourceWet =
        nodes.wet;


    currentSource.start(
        0,
        pauseOffset
    );


    startTime =
        audioCtx.currentTime;


    isPlaying = true;

    crossfadeStarted = false;


    btnPlayPause.innerText =
        "⏸ Pause";


    statusText.innerText =
        `🎵 Sonando: ${track.name}`;


    currentTrackName.innerText =
        track.name;


    updateMediaSessionMetadata(track);

    setMediaSessionPlaybackState("playing");


    updateTechnicalInfo(track);

    updateQueueUI();

    updateDuration();

    startProgressLoop();


    currentSource.onended = () => {

        if (!isPlaying) return;

        if (crossfadeStarted) return;

        finishCurrentTrack();
    };
}


// ============================================================
// NEXT TRACK
// ============================================================

function finishCurrentTrack() {

    stopSourceSafely();

    pauseOffset = 0;


    if (repeatMode === 2) {

        playCurrentTrack();

        return;
    }


    if (shuffleEnabled) {

        if (playlist.length > 1) {

            let next;

            do {

                next =
                    Math.floor(
                        Math.random() *
                        playlist.length
                    );

            } while (
                next === currentIndex
            );

            currentIndex = next;

        }

    } else {

        currentIndex++;

    }


    if (
        currentIndex >= playlist.length
    ) {

        if (repeatMode === 1) {

            currentIndex = 0;

            playCurrentTrack();

        } else {

            currentIndex = 0;

            isPlaying = false;

            btnPlayPause.innerText =
                "▶ Play";

            statusText.innerText =
                "Fin de la lista de reproducción.";

            setMediaSessionPlaybackState("none");

            updateQueueUI();
        }

        return;
    }


    playCurrentTrack();
}


// ============================================================
// PAUSE
// ============================================================

function pauseTrack() {

    if (
        !isPlaying ||
        !currentSource
    ) {
        return;
    }


    const elapsed =
        audioCtx.currentTime -
        startTime;


    pauseOffset +=
        elapsed *
        currentSource.playbackRate.value;


    isPlaying = false;


    stopSourceSafely();


    btnPlayPause.innerText =
        "▶ Play";


    statusText.innerText =
        "Pausado";


    setMediaSessionPlaybackState("paused");
}


// ============================================================
// STOP
// ============================================================

function stopSourceSafely() {

    if (currentSource) {

        try {
            currentSource.stop();
        } catch (e) {}

        currentSource.disconnect();

        currentSource = null;
    }

    if (currentSourceDry) {

        currentSourceDry.disconnect();

        currentSourceDry = null;
    }

    if (currentSourceWet) {

        currentSourceWet.disconnect();

        currentSourceWet = null;
    }
}


// ============================================================
// QUEUE UI
// ============================================================

function updateQueueUI() {

    queueList.innerHTML = "";


    if (playlist.length === 0) {

        queueList.innerHTML =
            '<li class="empty-msg">No hay canciones cargadas</li>';

        btnDownload.disabled = true;

        return;
    }


    btnDownload.disabled = false;


    playlist.forEach((song, idx) => {

        const li =
            document.createElement("li");


        li.dataset.index = idx;


        const dragHandle =
            document.createElement("span");

        dragHandle.className = "drag-handle";

        dragHandle.setAttribute("aria-hidden", "true");

        dragHandle.innerText = "⠿";


        if (idx === currentIndex) {

            li.classList.add("active");
        }


        const textSpan =
            document.createElement("span");

        textSpan.className =
            "track-text";

        textSpan.innerText =
            `${idx + 1}. ${song.name}`;


        const deleteBtn =
            document.createElement("button");

        deleteBtn.className =
            "btn-delete";

        deleteBtn.innerText = "✕";

        deleteBtn.title = "Eliminar";


        deleteBtn.addEventListener(
            "click",
            (e) => {

                e.stopPropagation();

                removeTrack(idx);
            }
        );


        li.appendChild(dragHandle);

        li.appendChild(textSpan);

        li.appendChild(deleteBtn);


        dragHandle.addEventListener(
            "pointerdown",
            (e) => startDragReorder(e, li)
        );


        queueList.appendChild(li);

    });
}


// ============================================================
// DRAG & DROP (Pointer Events — funciona con mouse y con dedo
// en Android/iOS, a diferencia del HTML5 Drag & Drop nativo)
// ============================================================

function startDragReorder(startEvent, li) {

    startEvent.preventDefault();


    const pointerId = startEvent.pointerId;

    li.setPointerCapture(pointerId);

    li.classList.add("dragging");


    function onPointerMove(e) {

        if (e.pointerId !== pointerId) return;


        const siblings =
            [
                ...queueList.querySelectorAll(
                    "li:not(.dragging):not(.empty-msg)"
                )
            ];


        const nextSibling =
            siblings.find(
                sibling =>
                    e.clientY <=
                    sibling.getBoundingClientRect().top +
                    sibling.getBoundingClientRect().height / 2
            );


        queueList.insertBefore(
            li,
            nextSibling || null
        );
    }


    function onPointerUp(e) {

        if (e.pointerId !== pointerId) return;

        li.releasePointerCapture(pointerId);

        li.classList.remove("dragging");


        document.removeEventListener(
            "pointermove",
            onPointerMove
        );

        document.removeEventListener(
            "pointerup",
            onPointerUp
        );

        document.removeEventListener(
            "pointercancel",
            onPointerUp
        );


        // Reconstruir la playlist según el nuevo orden en el DOM

        const items =
            [
                ...queueList.querySelectorAll(
                    "li:not(.empty-msg)"
                )
            ];


        const newPlaylist = [];

        let newCurrentIndex = -1;


        items.forEach(
            (item, newIdx) => {

                const oldIdx =
                    parseInt(
                        item.dataset.index
                    );


                newPlaylist.push(
                    playlist[oldIdx]
                );


                if (
                    oldIdx === currentIndex
                ) {

                    newCurrentIndex =
                        newIdx;
                }
            }
        );


        playlist = newPlaylist;

        currentIndex = newCurrentIndex;


        updateQueueUI();
    }


    document.addEventListener(
        "pointermove",
        onPointerMove
    );

    document.addEventListener(
        "pointerup",
        onPointerUp
    );

    document.addEventListener(
        "pointercancel",
        onPointerUp
    );
}


// ============================================================
// REMOVE TRACK
// ============================================================

function removeTrack(index) {

    const wasCurrent =
        index === currentIndex;


    if (wasCurrent) {

        stopSourceSafely();

        isPlaying = false;

        pauseOffset = 0;
    }


    playlist.splice(index, 1);


    if (playlist.length === 0) {

        currentIndex = -1;

        currentTrackName.innerText =
            "Ninguna canción";

    } else if (index < currentIndex) {

        currentIndex--;

    } else if (index === currentIndex) {

        currentIndex =
            Math.min(
                currentIndex,
                playlist.length - 1
            );
    }


    updateQueueUI();


    if (
        wasCurrent &&
        playlist.length > 0
    ) {

        playCurrentTrack();
    }
}


// ============================================================
// LOAD FILES
// ============================================================

async function loadAudioFiles(fileList) {

        const files =
            Array.from(fileList).filter(
                (f) => f.type.startsWith("audio/")
            );


        if (files.length === 0) return;


        initAudio();


        const startEmpty =
            playlist.length === 0;


        statusText.innerText =
            "⏳ Cargando canciones...";


        for (const file of files) {

            try {

                const arrayBuffer =
                    await file.arrayBuffer();


                const buffer =
                    await audioCtx.decodeAudioData(
                        arrayBuffer
                    );


                playlist.push({

                    name: file.name,

                    buffer: buffer

                });

            } catch (error) {

                console.error(
                    `Error cargando ${file.name}`,
                    error
                );
            }
        }


        updateQueueUI();


        statusText.innerText =
            `${files.length} canción(es) cargada(s).`;


        if (
            startEmpty &&
            playlist.length > 0
        ) {

            // Se selecciona la primera canción pero NO se reproduce
            // automáticamente: el usuario debe presionar Play.

            currentIndex = 0;

            pauseOffset = 0;

            const track = playlist[currentIndex];

            currentTrackName.innerText = track.name;

            updateTechnicalInfo(track);

            updateDuration();

            updateQueueUI();

            statusText.innerText =
                `Lista para reproducir: ${track.name}`;
        }


        audioFileInput.value = "";
}


audioFileInput.addEventListener(
    "change",
    (e) => loadAudioFiles(e.target.files)
);


// ---------------- ARRASTRAR ARCHIVOS A LA ZONA DE CARGA ----------------
// (arrastrar y soltar desde el escritorio; en móvil se usa el botón normal)

const uploadSection =
    document.querySelector(".upload-section");

if (uploadSection) {

    ["dragenter", "dragover"].forEach((eventName) => {

        uploadSection.addEventListener(eventName, (e) => {

            e.preventDefault();

            uploadSection.classList.add("drag-active");
        });
    });


    ["dragleave", "dragend"].forEach((eventName) => {

        uploadSection.addEventListener(eventName, () => {

            uploadSection.classList.remove("drag-active");
        });
    });


    uploadSection.addEventListener("drop", (e) => {

        e.preventDefault();

        uploadSection.classList.remove("drag-active");


        if (e.dataTransfer && e.dataTransfer.files.length > 0) {

            loadAudioFiles(e.dataTransfer.files);
        }
    });
}


// ============================================================
// PLAY / PAUSE
// ============================================================

btnPlayPause.addEventListener(
    "click",
    () => {

        if (playlist.length === 0)
            return;


        if (isPlaying) {

            pauseTrack();

        } else {

            playCurrentTrack();
        }
    }
);


// ============================================================
// NEXT
// ============================================================

btnNext.addEventListener(
    "click",
    () => {

        if (playlist.length === 0)
            return;


        stopSourceSafely();

        pauseOffset = 0;

        finishCurrentTrack();
    }
);


// ============================================================
// BACK
// ============================================================

btnBack.addEventListener(
    "click",
    () => {

        if (playlist.length === 0)
            return;


        stopSourceSafely();


        currentIndex--;

        if (currentIndex < 0) {

            currentIndex =
                playlist.length - 1;
        }


        pauseOffset = 0;

        playCurrentTrack();
    }
);


// ============================================================
// PITCH
// ============================================================

pitchControl.addEventListener(
    "input",
    () => {

        const value =
            parseFloat(
                pitchControl.value
            );


        pitchValText.innerText =
            `${value.toFixed(2)}x`;


        if (
            currentSource &&
            isPlaying
        ) {

            currentSource.playbackRate.setValueAtTime(
                value,
                audioCtx.currentTime
            );
        }


        saveSettings();
    }
);


// ============================================================
// REVERB
// ============================================================

reverbControl.addEventListener(
    "input",
    () => {

        updateReverbMix(
            parseFloat(
                reverbControl.value
            )
        );


        saveSettings();
    }
);


// ============================================================
// VOLUME
// ============================================================

volumeControl.addEventListener(
    "input",
    () => {

        const value =
            parseFloat(
                volumeControl.value
            );


        lastVolume = value;

        muted = false;


        masterGain.gain.setValueAtTime(
            value,
            audioCtx.currentTime
        );


        volumeVal.innerText =
            `${Math.round(value * 100)}%`;


        muteButton.innerText =
            value === 0
                ? "🔇"
                : "🔊";


        saveSettings();
    }
);


muteButton.addEventListener(
    "click",
    () => {

        if (!audioCtx)
            initAudio();


        if (!muted) {

            lastVolume =
                parseFloat(
                    volumeControl.value
                );


            masterGain.gain.setValueAtTime(
                0,
                audioCtx.currentTime
            );


            volumeControl.value = 0;

            volumeVal.innerText = "0%";

            muteButton.innerText = "🔇";

            muted = true;

        } else {

            masterGain.gain.setValueAtTime(
                lastVolume,
                audioCtx.currentTime
            );


            volumeControl.value =
                lastVolume;

            volumeVal.innerText =
                `${Math.round(lastVolume * 100)}%`;

            muteButton.innerText = "🔊";

            muted = false;
        }

        saveSettings();
    }
);


// ============================================================
// BASS BOOST
// ============================================================

bassControl.addEventListener(
    "input",
    () => {

        const value =
            parseFloat(
                bassControl.value
            );


        bassFilter.gain.setValueAtTime(
            value,
            audioCtx.currentTime
        );


        bassVal.innerText =
            `${value} dB`;


        saveSettings();
    }
);


// ============================================================
// EQ
// ============================================================

function updateEQ() {

    if (!audioCtx) return;


    const bass =
        parseFloat(eqBass.value);

    const mid =
        parseFloat(eqMid.value);

    const treble =
        parseFloat(eqTreble.value);


    bassFilter.gain.value =
        parseFloat(
            bassControl.value
        ) + bass;


    midFilter.gain.value =
        mid;


    trebleFilter.gain.value =
        treble;


    if (
        bass === 0 &&
        mid === 0 &&
        treble === 0
    ) {

        document.getElementById(
            "eq-val"
        ).innerText = "Flat";

    } else {

        document.getElementById(
            "eq-val"
        ).innerText = "Custom";
    }


    saveSettings();
}


eqBass.addEventListener(
    "input",
    updateEQ
);

eqMid.addEventListener(
    "input",
    updateEQ
);

eqTreble.addEventListener(
    "input",
    updateEQ
);


// ============================================================
// VOCAL
// ============================================================

vocalControl.addEventListener(
    "input",
    () => {

        const value =
            parseFloat(
                vocalControl.value
            );


        if (value < 0) {

            vocalVal.innerText =
                `Reducir ${Math.round(
                    Math.abs(value) * 100
                )}%`;

        } else if (value > 0) {

            vocalVal.innerText =
                `Boost ${Math.round(
                    value * 100
                )}%`;

        } else {

            vocalVal.innerText =
                "Normal";
        }


        /*
         * Aproximación sencilla:
         * el control modifica la ganancia
         * de la señal central.
         */

        const gain =
            1 + value * 0.5;


        vocalNode.gain.setValueAtTime(
            gain,
            audioCtx.currentTime
        );


        saveSettings();
    }
);


// ============================================================
// STEREO WIDTH
// ============================================================

widthControl.addEventListener(
    "input",
    () => {

        const value =
            parseFloat(
                widthControl.value
            );


        widthVal.innerText =
            `${Math.round(
                value * 100
            )}%`;


        /*
         * StereoPanner no puede crear
         * realmente un width > 100%.
         *
         * Usamos el valor como intensidad
         * de procesamiento estéreo.
         */

        widthNode.pan.value = 0;


        saveSettings();
    }
);


// ============================================================
// CROSSFADE
// ============================================================

crossfadeControl.addEventListener(
    "input",
    () => {

        const value =
            parseFloat(
                crossfadeControl.value
            );


        crossfadeVal.innerText =
            `${value}s`;


        saveSettings();
    }
);


// ============================================================
// SHUFFLE
// ============================================================

shuffleButton.addEventListener(
    "click",
    () => {

        shuffleEnabled =
            !shuffleEnabled;


        shuffleButton.classList.toggle(
            "active",
            shuffleEnabled
        );


        saveSettings();
    }
);


// ============================================================
// REPEAT
// ============================================================

repeatButton.addEventListener(
    "click",
    () => {

        repeatMode++;


        if (repeatMode > 2)
            repeatMode = 0;


        if (repeatMode === 0) {

            repeatButton.innerText =
                "🔁 Repeat: OFF";

        } else if (repeatMode === 1) {

            repeatButton.innerText =
                "🔁 Repeat: ALL";

        } else {

            repeatButton.innerText =
                "🔂 Repeat: ONE";
        }


        saveSettings();
    }
);


// ============================================================
// PROGRESS
// ============================================================

function startProgressLoop() {

    cancelAnimationFrame(
        animationFrame
    );


    function update() {

        if (
            !currentSource ||
            !isPlaying
        ) {

            animationFrame =
                requestAnimationFrame(update);

            return;
        }


        const track =
            playlist[currentIndex];


        const elapsed =
            (audioCtx.currentTime -
            startTime) *
            currentSource.playbackRate.value;


        const position =
            pauseOffset + elapsed;


        const duration =
            track.buffer.duration;


        const percentage =
            Math.min(
                100,
                (position / duration) * 100
            );


        progressControl.value =
            percentage;


        currentTimeText.innerText =
            formatTime(position);


        durationTimeText.innerText =
            formatTime(duration);


        // CROSSFADE

        const crossfade =
            parseFloat(
                crossfadeControl.value
            );


        const remaining =
            duration - position;


        if (
            crossfade > 0 &&
            remaining <= crossfade &&
            remaining > 0 &&
            !crossfadeStarted &&
            playlist.length > 1
        ) {

            startCrossfade();
        }


        animationFrame =
            requestAnimationFrame(update);
    }


    update();
}


// ============================================================
// SEEK
// ============================================================

progressControl.addEventListener(
    "input",
    () => {

        if (
            currentIndex < 0 ||
            playlist.length === 0
        )
            return;


        const track =
            playlist[currentIndex];


        const newPosition =
            (
                parseFloat(
                    progressControl.value
                ) / 100
            ) *
            track.buffer.duration;


        pauseOffset =
            newPosition;


        if (isPlaying) {

            playCurrentTrack();
        }
    }
);


// ============================================================
// FORMAT TIME
// ============================================================

function formatTime(seconds) {

    if (!Number.isFinite(seconds))
        return "00:00";


    const minutes =
        Math.floor(seconds / 60);


    const secs =
        Math.floor(seconds % 60);


    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}


// ============================================================
// DURATION
// ============================================================

function updateDuration() {

    if (
        currentIndex < 0 ||
        !playlist[currentIndex]
    )
        return;


    const duration =
        playlist[
            currentIndex
        ].buffer.duration;


    durationTimeText.innerText =
        formatTime(duration);
}


// ============================================================
// TECHNICAL INFO
// ============================================================

function updateTechnicalInfo(track) {

    const buffer =
        track.buffer;


    const channels =
        buffer.numberOfChannels;


    const sampleRate =
        buffer.sampleRate;


    const duration =
        buffer.duration;


    const info =
        `${channels} canal(es) • ${sampleRate} Hz • ${formatTime(duration)}`;


    trackTechnicalInfo.innerText =
        info;


    technicalDetails.innerHTML = `

        <strong>Archivo:</strong>
        ${escapeHTML(track.name)}
        <br>

        <strong>Duración:</strong>
        ${formatTime(duration)}
        <br>

        <strong>Canales:</strong>
        ${channels}
        <br>

        <strong>Sample Rate:</strong>
        ${sampleRate} Hz
        <br>

        <strong>Pitch:</strong>
        ${parseFloat(pitchControl.value).toFixed(2)}x
        <br>

        <strong>Reverb:</strong>
        ${Math.round(
            parseFloat(reverbControl.value) * 100
        )}%

    `;
}


function escapeHTML(text) {

    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ============================================================
// CROSSFADE
// ============================================================

function startCrossfade() {

    if (crossfadeStarted)
        return;


    crossfadeStarted = true;


    if (
        playlist.length <= 1
    ) {
        return;
    }


    let nextIndex;


    if (shuffleEnabled) {

        do {

            nextIndex =
                Math.floor(
                    Math.random() *
                    playlist.length
                );

        } while (
            nextIndex === currentIndex
        );

    } else {

        nextIndex =
            (currentIndex + 1) %
            playlist.length;
    }


    const nextTrack =
        playlist[nextIndex];


    const next =
        createTrackSource(
            nextTrack,
            0
        );


    nextCrossfadeSource =
        next.source;

    nextCrossfadeDry =
        next.dry;

    nextCrossfadeWet =
        next.wet;


    const duration =
        parseFloat(
            crossfadeControl.value
        );


    const now =
        audioCtx.currentTime;


    nextCrossfadeDry.gain.setValueAtTime(
        0,
        now
    );


    nextCrossfadeWet.gain.setValueAtTime(
        0,
        now
    );


    nextCrossfadeDry.gain.linearRampToValueAtTime(
        1 - parseFloat(reverbControl.value),
        now + duration
    );


    nextCrossfadeWet.gain.linearRampToValueAtTime(
        parseFloat(reverbControl.value),
        now + duration
    );


    if (currentSourceDry) {

        currentSourceDry.gain.cancelScheduledValues(
            now
        );

        currentSourceDry.gain.setValueAtTime(
            currentSourceDry.gain.value,
            now
        );

        currentSourceDry.gain.linearRampToValueAtTime(
            0,
            now + duration
        );
    }


    if (currentSourceWet) {

        currentSourceWet.gain.cancelScheduledValues(
            now
        );

        currentSourceWet.gain.setValueAtTime(
            currentSourceWet.gain.value,
            now
        );

        currentSourceWet.gain.linearRampToValueAtTime(
            0,
            now + duration
        );
    }


    nextCrossfadeSource.start(
        now
    );


    setTimeout(
        () => {

            try {

                if (currentSource)
                    currentSource.stop();

            } catch (e) {}


            currentIndex =
                nextIndex;


            currentSource =
                nextCrossfadeSource;

            currentSourceDry =
                nextCrossfadeDry;

            currentSourceWet =
                nextCrossfadeWet;


            nextCrossfadeSource = null;

            nextCrossfadeDry = null;

            nextCrossfadeWet = null;


            pauseOffset = 0;

            startTime =
                audioCtx.currentTime;


            crossfadeStarted = false;


            currentTrackName.innerText =
                nextTrack.name;


            statusText.innerText =
                `🎵 Sonando: ${nextTrack.name}`;


            updateTechnicalInfo(
                nextTrack
            );


            updateQueueUI();

        },

        duration * 1000
    );
}


// ============================================================
// VISUALIZER
// ============================================================

function startVisualizer() {

    const canvas =
        visualizer;


    const ctx =
        canvas.getContext("2d");


    function resize() {

        canvas.width =
            canvas.clientWidth;

        canvas.height =
            canvas.clientHeight;
    }


    resize();

    window.addEventListener(
        "resize",
        resize
    );


    const data =
        new Uint8Array(
            analyser.frequencyBinCount
        );


    function draw() {

        requestAnimationFrame(draw);


        analyser.getByteFrequencyData(
            data
        );


        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        const barWidth =
            canvas.width /
            data.length;


        for (
            let i = 0;
            i < data.length;
            i++
        ) {

            const value =
                data[i] / 255;


            const height =
                value *
                canvas.height;


            const x =
                i * barWidth;


            ctx.fillStyle =
                `hsl(${220 + i * 0.5}, 80%, 65%)`;


            ctx.fillRect(
                x,
                canvas.height - height,
                barWidth - 2,
                height
            );
        }
    }


    draw();
}


// ============================================================
// PRESETS
// ============================================================

document
    .querySelectorAll(
        "[data-preset]"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                applyPreset(
                    button.dataset.preset
                );
            }
        );
    });


function applyPreset(name) {

    if (!audioCtx)
        initAudio();


    if (name === "normal") {

        pitchControl.value = 1;

        reverbControl.value = 0;

        bassControl.value = 0;

        eqBass.value = 0;

        eqMid.value = 0;

        eqTreble.value = 0;

        vocalControl.value = 0;

        widthControl.value = 1;

    }


    if (name === "bass") {

        pitchControl.value = 1;

        reverbControl.value = 0.1;

        bassControl.value = 10;

        eqBass.value = 5;

        eqMid.value = 0;

        eqTreble.value = 1;

    }


    if (name === "dream") {

        pitchControl.value = 1;

        reverbControl.value = 0.75;

        bassControl.value = 2;

        eqBass.value = 2;

        eqMid.value = 0;

        eqTreble.value = 3;

    }


    if (name === "headphones") {

        pitchControl.value = 1;

        reverbControl.value = 0.25;

        bassControl.value = 3;

        eqBass.value = 2;

        eqMid.value = 0;

        eqTreble.value = 3;

        widthControl.value = 1.2;

    }


    if (name === "nightcore") {

        pitchControl.value = 1.25;

        reverbControl.value = 0.1;

        bassControl.value = 3;

        eqBass.value = 2;

        eqMid.value = 0;

        eqTreble.value = 3;

        widthControl.value = 1.1;
    }


    updateAllControls();


    document.getElementById(
        "preset-status"
    ).innerText =
        name.charAt(0).toUpperCase() +
        name.slice(1);


    saveSettings();
}


// ============================================================
// UPDATE CONTROLS
// ============================================================

function updateAllControls() {

    pitchValText.innerText =
        `${parseFloat(pitchControl.value).toFixed(2)}x`;


    reverbValText.innerText =
        `${Math.round(
            parseFloat(reverbControl.value) * 100
        )}%`;


    bassVal.innerText =
        `${bassControl.value} dB`;


    vocalVal.innerText =
        "Normal";


    widthVal.innerText =
        `${Math.round(
            parseFloat(widthControl.value) * 100
        )}%`;


    updateEQ();


    if (audioCtx) {

        bassFilter.gain.value =
            parseFloat(
                bassControl.value
            );

        midFilter.gain.value =
            parseFloat(
                eqMid.value
            );

        trebleFilter.gain.value =
            parseFloat(
                eqTreble.value
            );
    }
}


// ============================================================
// SAVE SETTINGS
// ============================================================

function saveSettings() {

    const settings = {

        volume:
            volumeControl.value,

        pitch:
            pitchControl.value,

        reverb:
            reverbControl.value,

        bass:
            bassControl.value,

        eqBass:
            eqBass.value,

        eqMid:
            eqMid.value,

        eqTreble:
            eqTreble.value,

        vocal:
            vocalControl.value,

        width:
            widthControl.value,

        crossfade:
            crossfadeControl.value,

        shuffle:
            shuffleEnabled,

        repeat:
            repeatMode
    };


    localStorage.setItem(
        "mirandAudioSettings",
        JSON.stringify(settings)
    );
}


// ============================================================
// LOAD SETTINGS
// ============================================================

function loadSettings() {

    const saved =
        localStorage.getItem(
            "mirandAudioSettings"
        );


    if (!saved) return;


    try {

        const settings =
            JSON.parse(saved);


        volumeControl.value =
            settings.volume ?? 0.8;

        pitchControl.value =
            settings.pitch ?? 1;

        reverbControl.value =
            settings.reverb ?? 0.6;

        bassControl.value =
            settings.bass ?? 0;

        eqBass.value =
            settings.eqBass ?? 0;

        eqMid.value =
            settings.eqMid ?? 0;

        eqTreble.value =
            settings.eqTreble ?? 0;

        vocalControl.value =
            settings.vocal ?? 0;

        widthControl.value =
            settings.width ?? 1;

        crossfadeControl.value =
            settings.crossfade ?? 5;

        shuffleEnabled =
            settings.shuffle ?? false;

        repeatMode =
            settings.repeat ?? 0;


        volumeVal.innerText =
            `${Math.round(
                parseFloat(
                    volumeControl.value
                ) * 100
            )}%`;


        pitchValText.innerText =
            `${parseFloat(
                pitchControl.value
            ).toFixed(2)}x`;


        reverbValText.innerText =
            `${Math.round(
                parseFloat(
                    reverbControl.value
                ) * 100
            )}%`;


        bassVal.innerText =
            `${bassControl.value} dB`;


        crossfadeVal.innerText =
            `${crossfadeControl.value}s`;


        shuffleButton.classList.toggle(
            "active",
            shuffleEnabled
        );


        if (repeatMode === 0)
            repeatButton.innerText =
                "🔁 Repeat: OFF";

        if (repeatMode === 1)
            repeatButton.innerText =
                "🔁 Repeat: ALL";

        if (repeatMode === 2)
            repeatButton.innerText =
                "🔂 Repeat: ONE";


    } catch (error) {

        console.error(
            "No se pudieron cargar las preferencias.",
            error
        );
    }
}


// ============================================================
// THEME
// ============================================================

themeToggle.addEventListener(
    "click",
    () => {

        document.body.classList.toggle(
            "light-theme"
        );


        const light =
            document.body.classList.contains(
                "light-theme"
            );


        themeToggle.innerText =
            light
                ? "☀️ Tema"
                : "🌙 Tema";


        localStorage.setItem(
            "mirandAudioTheme",
            light
                ? "light"
                : "dark"
        );
    }
);


function loadTheme() {

    const theme =
        localStorage.getItem(
            "mirandAudioTheme"
        );


    if (theme === "light") {

        document.body.classList.add(
            "light-theme"
        );

        themeToggle.innerText =
            "☀️ Tema";
    }
}


// ============================================================
// SHORTCUT MENU
// ============================================================

shortcutsButton.addEventListener(
    "click",
    () => {

        shortcutsMenu.classList.toggle(
            "show"
        );
    }
);


closeShortcuts.addEventListener(
    "click",
    () => {

        shortcutsMenu.classList.remove(
            "show"
        );
    }
);


// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener(
    "keydown",
    (event) => {

        const tag =
            document.activeElement.tagName;


        if (
            tag === "INPUT" ||
            tag === "TEXTAREA"
        ) {
            return;
        }


        // SPACE

        if (event.code === "Space") {

            event.preventDefault();

            btnPlayPause.click();
        }


        // LEFT

        if (event.key === "ArrowLeft") {

            btnBack.click();
        }


        // RIGHT

        if (event.key === "ArrowRight") {

            btnNext.click();
        }


        // UP

        if (event.key === "ArrowUp") {

            event.preventDefault();

            let value =
                parseFloat(
                    volumeControl.value
                );


            value =
                Math.min(
                    1,
                    value + 0.05
                );


            volumeControl.value =
                value;


            volumeControl.dispatchEvent(
                new Event("input")
            );
        }


        // DOWN

        if (event.key === "ArrowDown") {

            event.preventDefault();

            let value =
                parseFloat(
                    volumeControl.value
                );


            value =
                Math.max(
                    0,
                    value - 0.05
                );


            volumeControl.value =
                value;


            volumeControl.dispatchEvent(
                new Event("input")
            );
        }


        // MUTE

        if (
            event.key.toLowerCase() === "m"
        ) {

            muteButton.click();
        }


        // SHUFFLE

        if (
            event.key.toLowerCase() === "s"
        ) {

            shuffleButton.click();
        }


        // REPEAT

        if (
            event.key.toLowerCase() === "r"
        ) {

            repeatButton.click();
        }
    }
);


// ============================================================
// DOWNLOAD WAV
// ============================================================

btnDownload.addEventListener(
    "click",
    async () => {

        if (
            currentIndex < 0 ||
            playlist.length === 0
        ) {
            return;
        }


        const track =
            playlist[currentIndex];


        statusText.innerText =
            "💾 Procesando archivo con efectos...";


        try {

            const pitch =
                parseFloat(
                    pitchControl.value
                );


            const reverb =
                parseFloat(
                    reverbControl.value
                );


            const outputDuration =
                track.buffer.duration /
                pitch;


            const sampleRate =
                audioCtx.sampleRate;


            const totalFrames =
                Math.ceil(
                    outputDuration *
                    sampleRate
                );


            const offlineCtx =
                new OfflineAudioContext(
                    2,
                    totalFrames,
                    sampleRate
                );


            const source =
                offlineCtx.createBufferSource();


            source.buffer =
                track.buffer;


            source.playbackRate.value =
                pitch;


            // EQ

            const offlineBass =
                offlineCtx.createBiquadFilter();

            offlineBass.type =
                "lowshelf";

            offlineBass.frequency.value =
                150;

            offlineBass.gain.value =
                parseFloat(
                    bassControl.value
                );


            const offlineMid =
                offlineCtx.createBiquadFilter();

            offlineMid.type =
                "peaking";

            offlineMid.frequency.value =
                1000;

            offlineMid.Q.value = 1;

            offlineMid.gain.value =
                parseFloat(
                    eqMid.value
                );


            const offlineTreble =
                offlineCtx.createBiquadFilter();

            offlineTreble.type =
                "highshelf";

            offlineTreble.frequency.value =
                5000;

            offlineTreble.gain.value =
                parseFloat(
                    eqTreble.value
                );


            // Reverb

            const offlineReverb =
                offlineCtx.createConvolver();


            createReverbImpulse(
                offlineCtx,
                offlineReverb
            );


            const dry =
                offlineCtx.createGain();

            const wet =
                offlineCtx.createGain();


            dry.gain.value =
                1 - reverb;

            wet.gain.value =
                reverb;


            // IMPORTANTE:
            // NO se aplica volumeControl aquí.

            source.connect(dry);

            source.connect(wet);


            dry.connect(
                offlineBass
            );


            wet.connect(
                offlineReverb
            );


            offlineReverb.connect(
                offlineBass
            );


            offlineBass.connect(
                offlineMid
            );

            offlineMid.connect(
                offlineTreble
            );


            offlineTreble.connect(
                offlineCtx.destination
            );


            source.start(0);


            const rendered =
                await offlineCtx.startRendering();


            const wav =
                audioBufferToWav(
                    rendered
                );


            const blob =
                new Blob(
                    [wav],
                    {
                        type:
                            "audio/wav"
                    }
                );


            const url =
                URL.createObjectURL(
                    blob
                );


            const a =
                document.createElement("a");


            a.href = url;

            a.download =
                `${track.name.replace(/\.[^/.]+$/, "")}_edited.wav`;


            a.click();


            URL.revokeObjectURL(
                url
            );


            statusText.innerText =
                "✅ Audio exportado correctamente.";


        } catch (error) {

            console.error(error);

            statusText.innerText =
                "❌ Error al exportar el audio.";
        }
    }
);


// ============================================================
// AUDIO BUFFER → WAV
// ============================================================

function audioBufferToWav(buffer) {

    const numberOfChannels =
        buffer.numberOfChannels;


    const sampleRate =
        buffer.sampleRate;


    const format = 1;

    const bitDepth = 16;


    const samples =
        buffer.length;


    const blockAlign =
        numberOfChannels *
        bitDepth / 8;


    const byteRate =
        sampleRate *
        blockAlign;


    const dataSize =
        samples *
        blockAlign;


    const bufferSize =
        44 +
        dataSize;


    const arrayBuffer =
        new ArrayBuffer(
            bufferSize
        );


    const view =
        new DataView(
            arrayBuffer
        );


    writeString(
        view,
        0,
        "RIFF"
    );


    view.setUint32(
        4,
        36 + dataSize,
        true
    );


    writeString(
        view,
        8,
        "WAVE"
    );


    writeString(
        view,
        12,
        "fmt "
    );


    view.setUint32(
        16,
        16,
        true
    );


    view.setUint16(
        20,
        format,
        true
    );


    view.setUint16(
        22,
        numberOfChannels,
        true
    );


    view.setUint32(
        24,
        sampleRate,
        true
    );


    view.setUint32(
        28,
        byteRate,
        true
    );


    view.setUint16(
        32,
        blockAlign,
        true
    );


    view.setUint16(
        34,
        bitDepth,
        true
    );


    writeString(
        view,
        36,
        "data"
    );


    view.setUint32(
        40,
        dataSize,
        true
    );


    let offset = 44;


    for (
        let i = 0;
        i < samples;
        i++
    ) {

        for (
            let channel = 0;
            channel < numberOfChannels;
            channel++
        ) {

            let sample =
                buffer.getChannelData(
                    channel
                )[i];


            sample =
                Math.max(
                    -1,
                    Math.min(
                        1,
                        sample
                    )
                );


            view.setInt16(
                offset,
                sample < 0
                    ? sample * 0x8000
                    : sample * 0x7FFF,
                true
            );


            offset += 2;
        }
    }


    return arrayBuffer;
}


function writeString(
    view,
    offset,
    string
) {

    for (
        let i = 0;
        i < string.length;
        i++
    ) {

        view.setUint8(
            offset + i,
            string.charCodeAt(i)
        );
    }
}


// ============================================================
// SERVICE WORKER (PWA — permite instalar la app en Android/iOS)
// ============================================================

function registerServiceWorker() {

    if (!("serviceWorker" in navigator)) return;

    if (location.protocol === "file:") return;


    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register("sw.js")
            .catch((error) => {

                console.warn(
                    "No se pudo registrar el service worker:",
                    error
                );
            });
    });
}


// ============================================================
// LOAD EVERYTHING
// ============================================================

loadSettings();

loadTheme();

updateAllControls();

setupMediaSession();

registerServiceWorker();