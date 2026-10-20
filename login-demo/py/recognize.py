"""Shazam 识别辅助脚本（支持单个/多个文件，输出 JSON 数组）。

用法：
  python recognize.py <audio-file>
  python recognize.py <file1> <file2> <file3> ...          # 多文件，并发识别

输出（stdout 单行 JSON 数组，顺序与输入一致）：
  [{"file": "...", "ok": true, "match": {"title":..., "artist":..., ...}},
   {"file": "...", "ok": true, "match": null},
   {"file": "...", "ok": false, "error": "..."}]
"""
import asyncio
import json
import sys

# Windows 下默认 stdout 是 cp936，中文标题会被写成 GBK 字节 → Node 按 UTF-8 读就变乱码
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass


def _sections(track):
    """把 Shazam 返回的 sections 里可读信息挑出来（专辑、年份、厂牌、歌词片段）。"""
    out = {}
    for sec in track.get("sections", []) or []:
        stype = sec.get("type", "")
        if stype == "SONG":
            for item in sec.get("metadata", []) or []:
                k = item.get("title")
                if k:
                    out[k] = item.get("text")
        elif stype == "LYRICS" and "text" in sec:
            out["lyrics"] = " / ".join(sec["text"][:6])
    return out


def _to_match(result):
    track = (result or {}).get("track")
    if not track:
        return None
    meta = _sections(track)
    return {
        "title": track.get("title"),
        "artist": track.get("subtitle"),
        "url": track.get("url"),
        "cover": ((track.get("images") or {}).get("coverart")),
        "genre": (track.get("genres") or {}).get("primary"),
        "album": meta.get("Album"),
        "released": meta.get("Released"),
        "label": meta.get("Label"),
        "lyrics_snippet": meta.get("lyrics"),
    }


async def _one(shazam, path, sem, timeout=12):
    async with sem:
        try:
            # shazamio 偶尔会挂死在网络请求上，单个文件必须限时（超时多半是被限流）
            result = await asyncio.wait_for(shazam.recognize(path), timeout=timeout)
            return {"file": path, "ok": True, "match": _to_match(result)}
        except asyncio.TimeoutError:
            return {"file": path, "ok": False, "error": f"timeout after {timeout}s"}
        except Exception as exc:  # noqa: BLE001
            return {"file": path, "ok": False, "error": f"{type(exc).__name__}: {exc}"}


async def main(paths):
    from shazamio import Shazam

    shazam = Shazam()
    sem = asyncio.Semaphore(4)  # 并发 4，避免打爆 shazam 接口
    results = await asyncio.gather(*[_one(shazam, p, sem) for p in paths])
    return results


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps([{"ok": False, "error": "usage: recognize.py <file> [file...]"}], ensure_ascii=False))
        sys.exit(2)
    out = asyncio.run(main(sys.argv[1:]))
    print(json.dumps(out, ensure_ascii=False))
