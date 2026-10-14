/** Decode a local clip in-browser; only bounded JPEG frames leave the browser. */
export async function sampleExecutionVideo(file: File): Promise<Array<{ seconds: number; image: string }>> {
  if (!file.type.startsWith("video/")) throw new Error("Choose a video file.");
  if (file.size > 150 * 1024 * 1024) throw new Error("Choose a clip smaller than 150 MB.");
  const video = document.createElement("video");
  video.preload = "auto"; video.muted = true; video.playsInline = true;
  const url = URL.createObjectURL(file); video.src = url;
  const waitFor = (event: string, start?: () => void) => new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error("Could not decode this clip. Try an MP4 or provide setup notes.")), 15_000);
    const success = () => finish(); const failure = () => finish(new Error("Could not decode this video format."));
    function finish(error?: Error) { window.clearTimeout(timer); video.removeEventListener(event, success); video.removeEventListener("error", failure); if (error) reject(error); else resolve(); }
    video.addEventListener(event, success, { once: true }); video.addEventListener("error", failure, { once: true }); start?.();
  });
  try {
    await waitFor("loadedmetadata", () => video.load());
    if (!Number.isFinite(video.duration) || video.duration < 2 || video.duration > 120) throw new Error("Use a representative clip between 2 and 120 seconds.");
    const canvas = document.createElement("canvas"); const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Video sampling is unavailable in this browser.");
    const frames = [];
    for (let i = 0; i < 12; i++) {
      const seconds = video.duration * (i + 0.5) / 12;
      await waitFor("seeked", () => { video.currentTime = seconds; });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.75);
      if (image.length > 350000) throw new Error("Video frames are too large. Try a lower-resolution clip.");
      frames.push({ seconds, image });
    }
    return frames;
  } finally { video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url); }
}
