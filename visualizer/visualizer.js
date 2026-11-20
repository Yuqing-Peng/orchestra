const BAR_COUNT = 150;

function main() {
    const canvas = document.getElementById('myCanvas');
    const ctx = canvas.getContext('2d');
    const startButton = document.getElementById('startButton');
    const controls = document.querySelector('.controls');
    const hint = document.getElementById('hint');

    let audioContext = null;
    let analyser = null;
    let dataArray = null;
    let stream = null;
    let source = null;
    let frameId = null;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const bars = Array.from({ length: BAR_COUNT }, (_, i) => ({
        color: `hsl(${(i * 360) / BAR_COUNT}, 100%, 50%)`,
        height: 5,
    }));

    function stop() {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = null;
        if (source) source.disconnect();
        source = null;
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        controls.classList.remove('running');
        startButton.textContent = 'Share Tab & Start Visualizer';
    }

    function draw() {
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) * 0.22;
        const scale = Math.min(canvas.width, canvas.height) * 0.35;
        ctx.lineWidth = 2;

        bars.forEach((bar, i) => {
            const value = Math.max(dataArray[i] / 255, 0.05);
            const target = value * scale;
            bar.height = target > bar.height ? target : Math.max(bar.height * 0.9, 5);

            const angle = (i * Math.PI * 2) / BAR_COUNT;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            ctx.strokeStyle = bar.color;
            ctx.beginPath();
            ctx.moveTo(centerX + cos * radius, centerY + sin * radius);
            ctx.lineTo(centerX + cos * (radius + bar.height), centerY + sin * (radius + bar.height));
            ctx.stroke();
        });

        frameId = requestAnimationFrame(draw);
    }

    startButton.addEventListener('click', async () => {
        if (stream) {
            stop();
            return;
        }
        if (!navigator.mediaDevices?.getDisplayMedia) {
            alert('Your browser does not support tab capture. Try Chrome or Edge.');
            return;
        }
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } catch (error) {
            if (error.name !== 'NotAllowedError') {
                alert('Error starting tab capture: ' + error.message);
            }
            return;
        }

        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
            alert('No audio found. Pick a browser tab and tick "Share tab audio".');
            return;
        }

        if (!audioContext) {
            audioContext = new AudioContext();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 512;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
        }
        await audioContext.resume();

        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        audioTrack.addEventListener('ended', stop);

        controls.classList.add('running');
        startButton.textContent = 'Stop';
        if (hint) hint.hidden = true;
        draw();
    });
}

document.addEventListener('DOMContentLoaded', main);
