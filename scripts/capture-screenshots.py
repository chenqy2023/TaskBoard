#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Capture Projects + Board screenshots into docs/screenshots/ for README."""

import json
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "screenshots"
BASE = "http://localhost:5173"
API = "http://localhost:3000/api"
PASS_FILE = ROOT / ".tmp-demo-pass.txt"


def api(method, path, token=None, body=None):
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{API}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    password = PASS_FILE.read_text(encoding="utf-8").strip()
    OUT.mkdir(parents=True, exist_ok=True)

    login = api("POST", "/auth/login", body={"username": "admin", "password": password})
    token = login["accessToken"]
    projects = api("GET", "/projects", token=token)
    project = next((p for p in projects if "Mobile Sprint" in p.get("name", "")), None) or projects[0]
    pid = project["id"]
    print(f"Using project: {project['name']} ({pid})")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1.5,
            locale="en-US",
        )
        page = context.new_page()
        page.add_init_script("localStorage.setItem('taskboard-locale', 'en');")

        page.goto(f"{BASE}/#/login", wait_until="networkidle")
        page.get_by_placeholder("Username").fill("admin")
        page.get_by_placeholder("Password").fill(password)
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_url("**/projects**", timeout=20000)
        page.wait_for_timeout(1200)
        page.screenshot(path=str(OUT / "02-projects.png"), full_page=False)

        page.goto(f"{BASE}/#/projects/{pid}/board", wait_until="networkidle")
        page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT / "03-board.png"), full_page=False)

        browser.close()

    PASS_FILE.unlink(missing_ok=True)
    print(f"Wrote screenshots to {OUT}")
    for f in sorted(OUT.glob("*.png")):
        print(f"  {f.name} ({f.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
