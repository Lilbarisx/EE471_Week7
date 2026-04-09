document.addEventListener("DOMContentLoaded", () => {
    // --- TABS LOGIC ---
    const tabTts = document.getElementById("tab-tts");
    const tabStt = document.getElementById("tab-stt");
    const sectionTts = document.getElementById("section-tts");
    const sectionStt = document.getElementById("section-stt");

    tabTts.addEventListener("click", () => {
        tabTts.classList.add("active");
        tabStt.classList.remove("active");
        sectionTts.classList.remove("hidden");
        sectionStt.classList.add("hidden");
    });

    tabStt.addEventListener("click", () => {
        tabStt.classList.add("active");
        tabTts.classList.remove("active");
        sectionStt.classList.remove("hidden");
        sectionTts.classList.add("hidden");
    });

    // --- TTS LOGIC ---
    const textInput = document.getElementById("text-input");
    const synthesizeBtn = document.getElementById("synthesize-btn");
    const clearTtsBtn = document.getElementById("clear-tts-btn");
    const statusMessageTts = document.getElementById("status-message-tts");
    const audioPanel = document.getElementById("audio-output");
    const audioPlayer = document.getElementById("audio-player");
    const downloadBtn = document.getElementById("download-btn");

    function showStatusTts(message, isError = false) {
        statusMessageTts.textContent = message;
        statusMessageTts.classList.remove("hidden");
        statusMessageTts.style.backgroundColor = isError ? "#ffebee" : "var(--success-bg)";
        statusMessageTts.style.color = isError ? "#c62828" : "var(--success-text)";
    }

    clearTtsBtn.addEventListener("click", () => {
        textInput.value = "";
        statusMessageTts.classList.add("hidden");
        audioPanel.classList.add("hidden");
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    });

    synthesizeBtn.addEventListener("click", async () => {
        const text = textInput.value.trim();
        if (!text) {
            showStatusTts("⚠ Please enter text to synthesize.", true);
            return;
        }

        synthesizeBtn.disabled = true;
        synthesizeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Synthesizing...';
        statusMessageTts.classList.add("hidden");
        audioPanel.classList.add("hidden");

        try {
            const response = await fetch('/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                showStatusTts("✓ Speech synthesized successfully!");
                audioPlayer.src = data.audio_url;
                downloadBtn.href = data.audio_url;
                audioPanel.classList.remove("hidden");
            } else {
                showStatusTts(data.error || "An error occurred.", true);
            }
        } catch (error) {
            showStatusTts("Network error occurred.", true);
        } finally {
            synthesizeBtn.disabled = false;
            synthesizeBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Synthesize Speech';
        }
    });

    // --- STT LOGIC ---
    const startRecordBtn = document.getElementById("start-record-btn");
    const stopRecordBtn = document.getElementById("stop-record-btn");
    const audioFileInput = document.getElementById("audio-file");
    const transcribeBtn = document.getElementById("transcribe-btn");
    const clearSttBtn = document.getElementById("clear-stt-btn");
    const statusMessageStt = document.getElementById("status-message-stt");
    const transcriptionOutput = document.getElementById("transcription-output");
    const copyBtn = document.getElementById("copy-btn");

    let audioContext;
    let mediaStreamSource;
    let processor;
    let leftchannel = [];
    let recordingLength = 0;
    let audioBlob = null;

    function showStatusStt(message, isError = false, isLoading = false) {
        statusMessageStt.textContent = message;
        statusMessageStt.classList.remove("hidden");
        statusMessageStt.style.backgroundColor = isError ? "#ffebee" : (isLoading ? "#fff3e0" : "var(--success-bg)");
        statusMessageStt.style.color = isError ? "#c62828" : (isLoading ? "#e65100" : "var(--success-text)");
    }

    clearSttBtn.addEventListener("click", () => {
        transcriptionOutput.value = "";
        statusMessageStt.classList.add("hidden");
        audioFileInput.value = "";
        audioBlob = null;
    });

    copyBtn.addEventListener("click", () => {
        if (transcriptionOutput.value) {
            navigator.clipboard.writeText(transcriptionOutput.value);
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => { copyBtn.innerHTML = originalText; }, 2000);
        }
    });

    audioFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            audioBlob = e.target.files[0];
            showStatusStt("✓ Audio file selected. Ready to transcribe.");
        }
    });

    startRecordBtn.addEventListener("click", async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            mediaStreamSource = audioContext.createMediaStreamSource(stream);
            processor = audioContext.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = function(e) {
                const floats = e.inputBuffer.getChannelData(0);
                const clone = new Float32Array(floats.length);
                clone.set(floats);
                leftchannel.push(clone);
                recordingLength += floats.length;
            };

            mediaStreamSource.connect(processor);
            processor.connect(audioContext.destination);

            startRecordBtn.disabled = true;
            stopRecordBtn.disabled = false;
            audioFileInput.disabled = true;
            showStatusStt("🔴 Recording...", false, true);
        } catch (err) {
            showStatusStt("⚠ Microphone access denied or not available.", true);
        }
    });

    stopRecordBtn.addEventListener("click", () => {
        if (!processor) return;
        processor.disconnect();
        mediaStreamSource.disconnect();
        if (mediaStreamSource.mediaStream) {
            mediaStreamSource.mediaStream.getTracks().forEach(track => track.stop());
        }

        const sampleRate = audioContext.sampleRate;
        const interleaved = new Float32Array(recordingLength);
        let offset = 0;
        for (let i = 0; i < leftchannel.length; i++) {
            interleaved.set(leftchannel[i], offset);
            offset += leftchannel[i].length;
        }

        const buffer = new ArrayBuffer(44 + interleaved.length * 2);
        const view = new DataView(buffer);
        const writeString = function(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + interleaved.length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, interleaved.length * 2, true);

        let p = 44;
        for (let i = 0; i < interleaved.length; i++) {
            let s = Math.max(-1, Math.min(1, interleaved[i]));
            view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            p += 2;
        }

        audioBlob = new Blob([view], { type: 'audio/wav' });
        leftchannel = [];
        recordingLength = 0;

        startRecordBtn.disabled = false;
        stopRecordBtn.disabled = true;
        audioFileInput.disabled = false;
        showStatusStt("✓ Recording finished. Ready to transcribe.");
    });

    transcribeBtn.addEventListener("click", async () => {
        if (!audioBlob) {
            showStatusStt("⚠ Please record audio or upload a file first.", true);
            return;
        }

        transcribeBtn.disabled = true;
        transcribeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Transcribing...';
        showStatusStt("Transcribing audio...", false, true);

        const formData = new FormData();
        formData.append("audio", audioBlob, "audio.wav");

        try {
            const response = await fetch('/stt', { method: 'POST', body: formData });
            const data = await response.json();
            if (response.ok && data.success) {
                showStatusStt("✓ Audio transcribed successfully!");
                transcriptionOutput.value = data.text;
            } else {
                showStatusStt(data.error || "An error occurred.", true);
            }
        } catch (error) {
            showStatusStt("Network error occurred.", true);
        } finally {
            transcribeBtn.disabled = false;
            transcribeBtn.innerHTML = '<i class="fa-solid fa-file-audio"></i> Transcribe Audio';
        }
    });
});

