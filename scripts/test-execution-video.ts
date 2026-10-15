import assert from "node:assert/strict";
import { executionVideoSource, executionVideoDecodeMessage } from "../lib/coaching/execution-video";
async function main() {
  const bytes = new Uint8Array([0,0,0,24,...Buffer.from("ftypisom"),0,0,0,0]);
  for (const type of ["", "application/octet-stream", "application/mp4", "video/mp4", "video/webm", "video/mp4; codecs=unknown"]) {
    const source = await executionVideoSource(new File([bytes], "set.MP4", { type }));
    assert.equal(source.type, "video/mp4"); assert.deepEqual(new Uint8Array(await source.arrayBuffer()), bytes);
  }
  const unnamed = await executionVideoSource(new File([bytes], "download", { type: "application/octet-stream" }));
  assert.equal(unnamed.type, "video/mp4", "MP4 signature handles missing extension/MIME");
  await assert.rejects(executionVideoSource(new File(["text"], "notes.txt", { type: "text/plain" })), /Choose a video/);
  await assert.rejects(executionVideoSource(new File([], "empty.mp4")), /empty/);
  for (const code of [1,2,3,4]) assert.ok(executionVideoDecodeMessage(code).length > 30);
  assert.match(executionVideoDecodeMessage(2), /read this local video/);
  assert.match(executionVideoDecodeMessage(3), /H.264/);
  assert.match(executionVideoDecodeMessage(4), /codec/);
  assert.ok(!executionVideoDecodeMessage(4).includes("This file is HEVC"), "No unsupported codec diagnosis without inspecting the file");
  console.log("MP4 MIME/signature fallback, unchanged bytes, invalid/empty input and differentiated decoder errors passed.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
