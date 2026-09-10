"""Verify the LIVE GitHub Pages site renders (catches sub-path and deploy bugs).

Run from repo root:  python tests/test_live.py
Needs: pip install playwright, plus Chrome installed.
"""
import sys
import tempfile
from playwright.sync_api import sync_playwright

URL = "https://olu4wealth.github.io/career-os/"
fails = []
with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="networkidle")
    try:
        pg.wait_for_selector("#nav button", timeout=20000)
        print("PASS live: nav renders,", pg.locator("#nav button").count(), "items")
    except Exception:
        print("FAIL live: nav never rendered")
        fails.append("nav")
    body = pg.content()
    print(("PASS" if "Motor premium is below target" in body else "FAIL") + " live: boss fight")
    if "Motor premium is below target" not in body:
        fails.append("boss")
    print(("PASS" if pg.locator(".alert").count() >= 5 else "FAIL") + " live: alerts",
          pg.locator(".alert").count())
    if pg.locator(".alert").count() < 5:
        fails.append("alerts")
    pg.click("text=KPI Cockpit")
    try:
        pg.wait_for_selector("#rows tr", timeout=10000)
        print("PASS live: kpi rows", pg.locator("#rows tr").count())
    except Exception:
        print("FAIL live: kpi rows")
        fails.append("kpis")
    print("PASS live: no JS errors" if not errs else f"FAIL live: JS errors {errs}")
    if errs:
        fails.append("jserrors")
    pg.click("#themebtn")
    dark = pg.get_attribute("html", "data-theme") == "dark"
    print(("PASS" if dark else "FAIL") + " live: dark mode")
    if not dark:
        fails.append("dark")
    pg.reload(wait_until="networkidle")
    pg.wait_for_selector("#nav button", timeout=20000)
    dark2 = pg.get_attribute("html", "data-theme") == "dark"
    print(("PASS" if dark2 else "FAIL") + " live: dark persists")
    if not dark2:
        fails.append("darkpersist")
    b.close()
print("LIVE SITE OK" if not fails else f"LIVE FAILURES: {fails}")
sys.exit(1 if fails else 0)
