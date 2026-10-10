import { env, pipeline } from "@huggingface/transformers";
env.allowLocalModels = false;
env.backends.onnx.wasm!.numThreads = 1;
let classifier:
  Awaited<ReturnType<typeof pipeline<"audio-classification">>> | undefined;
self.onmessage = async (event: MessageEvent<{ audio: Float32Array }>) => {
  try {
    if (!classifier)
      classifier = await pipeline(
        "audio-classification",
        "Xenova/ast-finetuned-audioset-10-10-0.4593",
        {
          device: "wasm",
          dtype: "q8",
          revision: "c38c0051164d7433ccb1341e5c60d38f30608ac9",
          progress_callback: (p) => {
            if (p.status === "progress")
              self.postMessage({
                type: "progress",
                progress: Math.round(p.progress),
                file: p.file,
              });
          },
        },
      );
    const results = await classifier(event.data.audio, { top_k: 8 });
    self.postMessage({ type: "result", results });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Model unavailable",
    });
  }
};
