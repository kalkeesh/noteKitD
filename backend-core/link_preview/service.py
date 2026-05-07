from __future__ import annotations

from functools import lru_cache
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


REQUEST_TIMEOUT_SECONDS = 5
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


def is_valid_url(url: str) -> bool:
    try:
        parsed = urlparse((url or "").strip())
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
    except Exception:
        return False


def normalize_image_url(base_url: str, image_url: str | None) -> str | None:
    if not image_url:
        return None
    try:
        return urljoin(base_url, image_url)
    except Exception:
        return image_url


def clean_text(value: str | None) -> str:
    return " ".join((value or "").split()).strip()


def pick_first_valid_image(soup: BeautifulSoup, base_url: str) -> str | None:
    for img in soup.find_all("img"):
        src = clean_text(img.get("src"))
        if not src:
            continue
        lowered = src.lower()
        if lowered.startswith("data:"):
            continue
        return normalize_image_url(base_url, src)
    return None


def extract_metadata(url: str, html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    def og(name: str) -> str:
        tag = soup.find("meta", property=name) or soup.find("meta", attrs={"name": name})
        return clean_text(tag.get("content")) if tag else ""

    title = og("og:title") or clean_text(soup.title.string if soup.title else "")
    description = og("og:description")
    if not description:
        description_tag = soup.find("meta", attrs={"name": "description"})
        description = clean_text(description_tag.get("content")) if description_tag else ""

    image = normalize_image_url(url, og("og:image")) or pick_first_valid_image(soup, url)
    parsed = urlparse(url)
    domain = parsed.netloc

    return {
        "title": title,
        "description": description,
        "image": image,
        "url": url,
        "domain": domain,
    }


@lru_cache(maxsize=256)
def fetch_link_preview(url: str) -> dict:
    if not is_valid_url(url):
        return {
            "title": "",
            "description": "",
            "image": None,
            "url": url,
            "domain": "",
        }

    try:
        response = requests.get(
            url,
            timeout=REQUEST_TIMEOUT_SECONDS,
            headers={"User-Agent": USER_AGENT},
            allow_redirects=True,
        )
        response.raise_for_status()
        final_url = response.url or url
        return extract_metadata(final_url, response.text or "")
    except Exception:
        parsed = urlparse(url)
        return {
            "title": "",
            "description": "",
            "image": None,
            "url": url,
            "domain": parsed.netloc,
        }
