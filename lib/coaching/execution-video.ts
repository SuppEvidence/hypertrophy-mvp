const VIDEO_EXTENSION = /\.(mp4|m4v|mov|webm|mkv|avi|3gp|3g2|ogv)$/i;

/** Browser/OS MIME labels may be empty or generic; decoding is the final check. */
export async function executionVideoSource(file: File): Promise<Blob> {
  if (!file.size) throw new Error("This video file is empty. Select the saved original clip.");
  if (file.size > 150 * 1024 * 1024) throw new Error("Choose a clip smaller than 150 MB.");
  const type = file.type.split(";")[0].trim().toLowerCase();
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const iso = ascii(4, 8) === "ftyp";
  const webm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  const avi = ascii(0, 4) === "RIFF" && ascii(8, 12) === "AVI ";
  const ogg = ascii(0, 4) === "OggS";
  if (!type.startsWith("video/") && !VIDEO_EXTENSION.test(file.name) && !iso && !webm && !avi && !ogg) {
    throw new Error("Choose a video file, such as an MP4, MOV or WebM clip.");
  }
  const inferred = iso ? (ascii(8, 12).startsWith("qt") ? "video/quicktime" : "video/mp4") : webm ? "video/webm" : avi ? "video/x-msvideo" : ogg ? "video/ogg"
    : /\.mov$/i.test(file.name) ? "video/quicktime" : /\.(mp4|m4v)$/i.test(file.name) ? "video/mp4" : "";
  // Re-labeling a local Blob does not transcode it or add codec support.
  const resolvedType = inferred || type;
  return resolvedType === file.type ? file : new Blob([file], { type: resolvedType });
}

export function executionVideoDecodeMessage(code: number | undefined): string {
  if (code === 1) return "Video reading was interrupted. Select the clip again and retry.";
  if (code === 2) return "The browser could not read this local video. Download it fully to your device and select the saved file again.";
  if (code === 3) return "The browser could not decode this clip. Its codec, video profile or file data may be incompatible. Export a new MP4 using H.264/AVC and try again; renaming the file does not convert it.";
  return "This browser could not open the video stream. MP4 is a container, and the codec inside may be unsupported (for example HEVC/H.265 on some devices). Export MP4 using H.264/AVC and try again; renaming the file does not convert it.";
}

/** Decode locally into timestamped JPEGs; no original video is uploaded or retained. */
export async function sampleExecutionVideo(file: File): Promise<Array<{ seconds: number; image: string }>> {
  const source = await executionVideoSource(file);
  const video = document.createElement("video");
  video.preload = "auto"; video.muted = true; video.playsInline = true;
  video.setAttribute("playsinline", ""); video.setAttribute("aria-hidden", "true"); video.tabIndex = -1;
  // Some mobile engines load/decode more reliably when the media element is attached.
  video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;bottom:0";
  const url = URL.createObjectURL(source);
  document.body.appendChild(video);
  const waitFor = (events: string[], ready: () => boolean, timeoutMs: number, start?: () => void) => new Promise<void>((resolve, reject) => {
    let finished = false;
    const timer = window.setTimeout(() => finish(new Error("Video decoding timed out in this browser. Try a shorter H.264/AVC MP4 export or another browser; a timeout does not establish that the file type is unsupported.")), timeoutMs);
    function finish(error?: Error) {
      if (finished) return; finished = true; window.clearTimeout(timer);
      for (const event of events) video.removeEventListener(event, check);
      video.removeEventListener("error", failed);
      if (error) reject(error); else resolve();
    }
    function failed() { finish(new Error(executionVideoDecodeMessage(video.error?.code))); }
    function check() { if (video.error) failed(); else if (ready()) finish(); }
    for (const event of events) video.addEventListener(event, check);
    video.addEventListener("error", failed);
    try { start?.(); check(); } catch { finish(new Error(executionVideoDecodeMessage(video.error?.code))); }
  });
  try {
    await waitFor(["loadedmetadata", "durationchange"], () => video.readyState >= 1, 30_000, () => { video.src = url; video.load(); });
    if (!Number.isFinite(video.duration)) throw new Error("The clip's duration could not be read. Export a completed H.264/AVC MP4 file and retry.");
    if (video.duration < 2 || video.duration > 120) throw new Error("Use a representative clip between 2 and 120 seconds.");
    if (!video.videoWidth || !video.videoHeight) throw new Error("No readable video picture was found in this file. Export MP4 with H.264/AVC video and retry.");
    const canvas = document.createElement("canvas"); const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Video sampling is unavailable in this browser.");
    const frames = [];
    for (let i = 0; i < 12; i++) {
      const seconds = video.duration * (i + 0.5) / 12;
      // Seek completion alone does not guarantee decoded image data is available yet.
      await waitFor(["seeked", "loadeddata", "canplay", "timeupdate"], () => !video.seeking && video.readyState >= 2 && Math.abs(video.currentTime - seconds) < 0.15,
        20_000, () => { video.currentTime = seconds; });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      let image = canvas.toDataURL("image/jpeg", 0.75);
      if (image.length > 350000) image = canvas.toDataURL("image/jpeg", 0.55);
      if (image.length > 350000) throw new Error("Video frames are too large. Try a lower-resolution clip.");
      if (!image.startsWith("data:image/jpeg;base64,")) throw new Error("The browser could not prepare JPEG frames from this clip. Try another browser or export H.264/AVC MP4.");
      frames.push({ seconds, image });
    }
    return frames;
  } finally {
    video.pause(); video.removeAttribute("src"); video.load(); video.remove(); URL.revokeObjectURL(url);
  }
}
