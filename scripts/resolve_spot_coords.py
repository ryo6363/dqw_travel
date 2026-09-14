"""One-off data enrichment script.

Reads spots.json, follows each spot's mapsUrl redirect chain, extracts the
"@lat,lng," coordinates from the final Google Maps URL, and overwrites the
spot's lat/lng with the more precise value. Spots whose coordinates could
not be extracted are left with their existing (prefecture-level) lat/lng
and reported at the end.

Usage:
    python scripts/resolve_spot_coords.py
"""

import json
import os
import random
import re
import time
import urllib.error
import urllib.request

SPOTS_PATH = os.path.join(os.path.dirname(__file__), "..", "spots.json")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
COORD_PATTERN = re.compile(r"@(-?\d+\.\d+),(-?\d+\.\d+),")
MIN_DELAY_SEC = 0.5
MAX_DELAY_SEC = 1.0


def resolve_final_url(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=15) as response:
        return response.geturl()


def main():
    with open(SPOTS_PATH, encoding="utf-8") as f:
        spots = json.load(f)

    updated_count = 0
    failed = []

    for index, spot in enumerate(spots, start=1):
        label = f"{spot.get('pref', '')} {spot.get('landmark', '')} ({spot.get('id')})"
        maps_url = spot.get("mapsUrl")

        if not maps_url:
            failed.append((spot.get("id"), spot.get("landmark"), "mapsUrlが存在しません"))
            print(f"[{index}/{len(spots)}] SKIP  {label}: mapsUrlなし")
            continue

        try:
            final_url = resolve_final_url(maps_url)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as err:
            failed.append((spot.get("id"), spot.get("landmark"), f"リクエスト失敗: {err}"))
            print(f"[{index}/{len(spots)}] FAIL  {label}: リクエスト失敗 ({err})")
            time.sleep(random.uniform(MIN_DELAY_SEC, MAX_DELAY_SEC))
            continue

        match = COORD_PATTERN.search(final_url)
        if match:
            lat, lng = float(match.group(1)), float(match.group(2))
            spot["lat"] = lat
            spot["lng"] = lng
            updated_count += 1
            print(f"[{index}/{len(spots)}] OK    {label}: ({lat}, {lng})")
        else:
            failed.append((spot.get("id"), spot.get("landmark"), "URLから座標パターンを抽出できません"))
            print(f"[{index}/{len(spots)}] MISS  {label}: 座標抽出失敗")

        time.sleep(random.uniform(MIN_DELAY_SEC, MAX_DELAY_SEC))

    with open(SPOTS_PATH, "w", encoding="utf-8") as f:
        json.dump(spots, f, ensure_ascii=False, indent=2)

    print()
    print("=" * 60)
    print(f"正確な座標に更新できた件数: {updated_count} / {len(spots)}")
    print(f"都道府県レベルの座標のままになった件数: {len(failed)}")
    if failed:
        print("取得できなかったスポット一覧:")
        for spot_id, landmark, reason in failed:
            print(f"  - {spot_id}: {landmark} ({reason})")


if __name__ == "__main__":
    main()
