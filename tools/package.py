"""Create a clean, installable extension ZIP in dist/. Run: python tools/package.py"""

import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent.parent
FILES = (
    "manifest.json",
    "README.md",
    "วิธีติดตั้ง.txt",
    "src/background.js",
    "src/bridge.js",
    "src/page.js",
    "icons/icon16.png",
    "icons/icon48.png",
    "icons/icon128.png",
    "icons/icon512.png",
    "screenshots/library-demo.png",
    "tools/make_icons.py",
    "tools/package.py",
    "tools/panel-test.html",
)


def main():
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    version = manifest["version"]
    output = ROOT / "dist" / f"CustomStickers-{version}.zip"
    output.parent.mkdir(exist_ok=True)
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for relative in FILES:
            path = ROOT / relative
            if not path.is_file():
                raise FileNotFoundError(path)
            archive.write(path, relative)
    print(output)


if __name__ == "__main__":
    main()
