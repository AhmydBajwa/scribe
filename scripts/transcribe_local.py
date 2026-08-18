import json
import sys
from faster_whisper import WhisperModel

def main():
    options = json.load(sys.stdin)
    model = WhisperModel(options.get("model", "base"), device="cpu", compute_type=options.get("computeType", "int8"))
    segments, info = model.transcribe(options["audioPath"], language=options.get("language") or None, vad_filter=True)
    rows = []
    for segment in segments:
        rows.append({"startMs": round(segment.start * 1000), "endMs": round(segment.end * 1000), "text": segment.text.strip()})
    print(json.dumps({"text": " ".join(row["text"] for row in rows).strip(), "segments": rows, "language": getattr(info, "language", options.get("language"))}))

if __name__ == "__main__":
    main()
