"""Automated browser checks for Career OS.

Needs: pip install playwright, plus Chrome installed.
Run from repo root:  python tests/test_browser.py

Tests an isolated copy in a temp dir, so your real career_os.db is never touched.
Covers API mode (Python backend) and static demo mode (GitHub Pages build).
"""
import os
import shutil
import subprocess
import sys
import tempfile
import time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST = tempfile.mkdtemp(prefix="career-os-test-")
SHOTS = os.path.join(TEST, "shots")
fails = []


def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name, extra)
    if not cond:
        fails.append(name)


shutil.copytree(ROOT, TEST,
                ignore=shutil.ignore_patterns("career_os.db", ".git", "screenshots",
                                              "tests", "__pycache__"),
                dirs_exist_ok=True)
os.makedirs(SHOTS, exist_ok=True)

srv = subprocess.Popen([sys.executable, os.path.join(TEST, "server.py"), "8139"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
stc = subprocess.Popen([sys.executable, "-m", "http.server", "8140", "--directory",
                        os.path.join(TEST, "docs")],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(3)
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(channel="chrome", headless=True)
        # ---- API mode ----
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        pg.on("pageerror", lambda e: print("API PAGEERROR:", str(e)[:200]))
        pg.goto("http://127.0.0.1:8139/", wait_until="networkidle")
        pg.wait_for_selector("#nav button", timeout=15000)
        check("api: 13 nav items", pg.locator("#nav button").count() == 13)
        check("api: boss fight shown",
              "Motor premium is below target" in pg.content())
        check("api: alerts rendered", pg.locator(".alert").count() >= 5,
              f"({pg.locator('.alert').count()} alerts)")
        check("api: level box", "LEVEL" in pg.content())
        pg.screenshot(path=os.path.join(SHOTS, "api-command.png"))
        # KPI cockpit
        pg.click("text=KPI Cockpit")
        pg.wait_for_selector("#rows tr")
        check("api: 8 kpi rows", pg.locator("#rows tr").count() == 8)
        check("api: charts drawn", pg.locator("canvas.chart").count() == 2)
        check("api: chart fits rows", pg.evaluate(
            "document.querySelector('#chK').getBoundingClientRect().height") == 8 * 30 + 12)
        check("api: short labels", pg.evaluate(
            "short({metric:'Gross Written Premium (NGN bn)'})") == "Motor"
            and pg.evaluate("short({metric:'Receivables >90d (NGN m)'})") == "Receivables"
            and pg.evaluate("short({metric:'Anything',short:'Custom Name'})") == "Custom Name"
            and len(pg.evaluate("short({metric:'Some Extremely Long Custom Metric Name (%)'})")) <= 14)
        pg.screenshot(path=os.path.join(SHOTS, "api-kpis.png"))
        # Insight builder -> creates insight + awards 25 XP
        pg.click("text=+ Insight builder")
        pg.fill("#sheet [name=topic]", "Browser test insight")
        pg.fill("#sheet [name=changed]", "Test variance -9%")
        pg.fill("#sheet [name=do]", "Do the test thing")
        pg.fill("#sheet [name=who]", "Tester")
        pg.fill("#sheet [name=when]", "Friday")
        pg.click("text=Generate management insight")
        pg.wait_for_selector("#toast div", timeout=8000)
        check("api: insight XP toast", "+25 XP" in pg.content())
        check("api: insight row added", "Browser test insight" in pg.content())
        pg.screenshot(path=os.path.join(SHOTS, "api-insights.png"))
        # Daily OS: complete a task -> XP toast
        pg.click("text=Daily OS")
        pg.wait_for_selector("text=Today's outcomes")
        pg.click("tbody tr:first-child button:has-text('Done')")
        pg.wait_for_selector("#toast div", timeout=8000)
        check("api: task done + XP", "Done" in pg.content() and "XP" in pg.content())
        # Opportunities matrix + search
        pg.click("text=Opportunity Radar")
        check("api: matrix renders", "value ×" in pg.content())
        pg.screenshot(path=os.path.join(SHOTS, "api-opps.png"))
        pg.keyboard.press("Control+k")
        pg.fill("#sin", "motor")
        check("api: search hits", "KPI" in pg.locator("#sres").inner_text())
        pg.keyboard.press("Escape")
        # Remaining views render
        for nav in ["Skill Tree", "Weekly Review", "XP & Progress", "Templates", "Settings"]:
            pg.click(f"text={nav}")
            pg.wait_for_timeout(300)
        check("api: all views render", "Reset demo data" in pg.content())
        pg.screenshot(path=os.path.join(SHOTS, "api-settings.png"))
        pg.on("dialog", lambda d: d.accept())
        pg.click("button:has-text('Reset demo data')")
        pg.wait_for_selector("#toast div:has-text('Fresh demo data')", timeout=15000)
        check("api: reset reseeds", "Fresh demo data" in pg.content())
        pg.close()
        # ---- static demo mode (no backend) ----
        pg2 = b.new_page(viewport={"width": 1440, "height": 900})
        pg2.goto("http://127.0.0.1:8140/", wait_until="networkidle")
        pg2.wait_for_selector("#nav button", timeout=15000)
        check("static: demo toast", "Demo mode" in pg2.content())
        check("static: boss fight from seed", "Motor premium is below target" in pg2.content())
        check("static: alerts computed locally", pg2.locator(".alert").count() >= 5,
              f"({pg2.locator('.alert').count()} alerts)")
        pg2.click("text=KPI Cockpit")
        pg2.wait_for_selector("#rows tr")
        check("static: 8 kpi rows from seed.json", pg2.locator("#rows tr").count() == 8)
        pg2.screenshot(path=os.path.join(SHOTS, "static-command.png"))
        # add KPI -> persists across reload via localStorage
        pg2.click("button:has-text('+ Add KPI')")
        pg2.fill("#sheet [name=metric]", "Persist check metric")
        pg2.fill("#sheet [name=actual]", "100")
        pg2.fill("#sheet [name=target]", "120")
        pg2.click("#sheet button:has-text('Save')")
        pg2.wait_for_selector("#toast div")
        check("static: add KPI saved", "Persist check metric" in pg2.content())
        pg2.reload(wait_until="networkidle")
        pg2.wait_for_selector("#nav button", timeout=15000)
        pg2.click("text=KPI Cockpit")
        pg2.wait_for_selector("#rows tr")
        check("static: KPI survives reload", "Persist check metric" in pg2.content())
        # claim XP from guide
        pg2.click("text=XP & Progress")
        pg2.locator("button:has-text('Claim')").first.click()
        pg2.wait_for_selector("#toast div")
        check("static: XP claim works", "XP" in pg2.content())
        pg2.screenshot(path=os.path.join(SHOTS, "static-xp.png"))
        # dark mode toggle + persistence
        pg2.click("#themebtn")
        check("static: dark mode on", pg2.get_attribute("html", "data-theme") == "dark")
        pg2.screenshot(path=os.path.join(SHOTS, "static-dark.png"))
        pg2.reload(wait_until="networkidle")
        pg2.wait_for_selector("#nav button", timeout=15000)
        check("static: dark persists", pg2.get_attribute("html", "data-theme") == "dark")
        pg2.click("#themebtn")
        check("static: back to light", pg2.get_attribute("html", "data-theme") == "light")
        pg2.click("text=Settings")
        with pg2.expect_download() as dli:
            pg2.click("button:has-text('Download full backup')")
        check("static: full backup downloads",
              dli.value.suggested_filename.startswith("career-os-backup"))
        pg2.on("dialog", lambda d: d.accept())
        pg2.click("button:has-text('Reset demo data')")
        pg2.wait_for_selector("#nav button", timeout=15000)
        check("static: reset reseeds", "Motor premium is below target" in pg2.content())
        b.close()
finally:
    srv.terminate()
    stc.terminate()

print(f"\n{len(fails)} failures: {fails}" if fails else "\nALL BROWSER TESTS PASSED")
sys.exit(1 if fails else 0)
