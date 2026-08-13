import json
import sys
import torch
import av
import numpy as np
from pyannote.audio import Pipeline

def load_audio_for_pyannote(audio_path):
    # Use PyAV (already used by faster-whisper) to decode browser uploads. This
    # avoids TorchCodec/FFmpeg shared-DLL issues on Windows while all work stays
    # local. Pyannote accepts an in-memory waveform dictionary.
    container = av.open(audio_path)
    stream = container.streams.audio[0]
    sample_rate = 16000
    resampler = av.AudioResampler(format="fltp", layout="mono", rate=sample_rate)
    frames = []
    for frame in container.decode(stream):
        for resampled in resampler.resample(frame):
            frames.append(resampled.to_ndarray().reshape(-1))
    container.close()
    if not frames:
        raise RuntimeError("Unable to decode audio for local diarization.")
    waveform = np.concatenate(frames).astype("float32")
    return {"waveform": torch.from_numpy(waveform).unsqueeze(0), "sample_rate": sample_rate}

def main():
    options = json.load(sys.stdin)
    if not options.get("token"):
        raise RuntimeError("Local pyannote diarization requires HF_TOKEN after accepting the model terms on Hugging Face.")
    pipeline = Pipeline.from_pretrained(options.get("model"), token=options["token"])
    pipeline.to(torch.device("cpu"))
    inference_options = {}
    # If the clinical encounter's speaker count is known, it materially reduces
    # speaker-count errors. Leave it unset for automatic detection.
    if options.get("numSpeakers"):
        inference_options["num_speakers"] = int(options["numSpeakers"])
    result = pipeline(load_audio_for_pyannote(options["audioPath"]), **inference_options)
    # Community-1's exclusive track intentionally resolves overlap into one
    # contiguous speaker at a time. It is the pyannote-recommended output for
    # reconciling diarization with ASR timestamps such as Whisper's segments.
    annotation = getattr(result, "exclusive_speaker_diarization", None)
    if annotation is None:
        annotation = getattr(result, "speaker_diarization", result)
    rows = []
    for turn, _, speaker in annotation.itertracks(yield_label=True):
        rows.append({"speaker": str(speaker), "startMs": round(turn.start * 1000), "endMs": round(turn.end * 1000)})
    print(json.dumps({"segments": rows}))

if __name__ == "__main__":
    main()
