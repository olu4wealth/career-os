"""Career OS server — stdlib only (http.server + sqlite3). No dependencies.

Run:  python server.py [port, default 8130]
Data: career_os.db (SQLite, same folder). Single-user local OS.
API shape (/api/<resource>) is kept stable so a future Next.js/Supabase
migration keeps the same frontend contracts.
"""
import csv
import datetime as dt
import io
import json
import os
import sqlite3
import urllib.parse
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE, "career_os.db")
STATIC = os.path.join(BASE, "docs")

# table -> columns (first col is INTEGER PRIMARY KEY)
SCHEMA = {
    "kpis": ["id", "period", "metric", "category", "actual", "target",
             "prior_period", "prior_year", "driver", "implication",
             "action", "owner", "status"],
    "tasks": ["id", "date", "title", "category", "priority", "status",
              "effort", "output", "xp_reward", "is_boss"],
    "initiatives": ["id", "title", "objective", "owner", "deadline",
                    "status", "risk", "last_update", "next_action",
                    "next_date", "escalation"],
    "opportunities": ["id", "title", "segment", "evidence", "value",
                      "feasibility", "fit", "owner", "status",
                      "next_step", "source"],
    "intel": ["id", "date", "headline", "theme", "changed", "why_matters",
              "implication", "opp_risk", "action", "source", "priority"],
    "competitors": ["id", "name", "move", "implication", "response", "date"],
    "insights": ["id", "date", "topic", "finding", "evidence", "driver",
                 "implication", "recommendation", "action", "outcome",
                 "kpi_ref"],
    "skills": ["id", "domain", "skill", "level", "target", "method",
               "evidence", "hrs", "status", "next_step"],
    "xp": ["id", "date", "achievement", "category", "base", "mult",
           "bonus", "total", "notes"],
    "reviews": ["id", "week_ending", "business", "insight", "risk",
                "opportunity", "gap", "recommendation", "learning",
                "scores"],
    "settings": ["key", "value"],
}

def connect():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con


def q(s):
    return '"' + s + '"'


def xp_total(d):
    try:
        return float(d.get("base", 0) or 0) * float(d.get("mult", 1) or 1) \
            + float(d.get("bonus", 0) or 0)
    except (TypeError, ValueError):
        return 0


def ins(c, table, cols, rows):
    cols = [x.strip() for x in cols.split(",")]
    c.executemany(f'INSERT INTO "{table}" ({",".join(map(q, cols))}) '
                  f'VALUES ({",".join("?" * len(cols))})', rows)


def init_db():
    con = connect()
    c = con.cursor()
    for table, cols in SCHEMA.items():
        if table == "settings":
            c.execute("CREATE TABLE IF NOT EXISTS settings "
                      "(key TEXT PRIMARY KEY, value TEXT)")
            continue
        defs = ["id INTEGER PRIMARY KEY AUTOINCREMENT"]
        for col in cols[1:]:
            defs.append(f'"{col}" TEXT')
        c.execute(f'CREATE TABLE IF NOT EXISTS "{table}" ({", ".join(defs)})')
    con.commit()
    if c.execute('SELECT COUNT(*) FROM kpis').fetchone()[0] == 0:
        seed(c)
        con.commit()
    con.close()


def seed(c):
    today = dt.date.today().isoformat()
    kpis = [
        ("2026-09", "Gross Written Premium (NGN bn)", "Premium", 5.2, 5.8, 5.0, 4.6,
         "Motor renewals -9% vs target; 2 corporate accounts lapsed", "Recover lapsed accounts; push retail Motor",
         "Escalate top-2 lapsed accounts to ED Commercial", "A. Bello", "off-track"),
        ("2026-09", "Target Achievement %", "Premium", 89.7, 100, 94.0, 91.0,
         "Shortfall concentrated in Motor + Marine", "Weekly Motor war-room until >95%",
         "Set Friday review with branch heads", "Self", "attention"),
        ("2026-09", "YoY Premium Growth %", "Growth", 13.0, 15.0, 11.2, 0.0,
         "Retail (+18%) offsetting corporate softness", "Scale retail engine; defend corporate",
         "Share retail playbook with regions", "Self", "attention"),
        ("2026-09", "Claims Ratio %", "Claims", 48.0, 45.0, 46.5, 44.0,
         "Motor claims frequency +6% (flood-related Q3)", "Review Motor pricing + excess levels",
         "Request claims frequency split by branch", "Claims", "attention"),
        ("2026-09", "Renewal Retention %", "Retention", 82.0, 87.0, 84.0, 80.0,
         "Price-driven churn in SME segment", "Save-team call list for at-risk renewals",
         "Produce at-risk renewal list this week", "Retention", "off-track"),
        ("2026-09", "New Business (NGN m)", "Growth", 410, 380, 350, 290,
         "Bancassurance + Oil & Gas pipeline converting", "Double down on bancassurance leads",
         "Document what is converting + why", "Growth", "on-track"),
        ("2026-09", "Loss Ratio %", "Profitability", 52.0, 50.0, 51.0, 49.0,
         "Within tolerance; watch Motor severity", "Monitor monthly",
         "Add severity tracker to cockpit", "Finance", "attention"),
        ("2026-09", "Receivables >90d (NGN m)", "Finance", 620, 400, 580, 510,
         "2 brokers slow-paying since July", "Escalate to Credit Control + ED",
         "Send escalation memo by Friday", "Credit", "off-track"),
    ]
    ins(c, "kpis", "period,metric,category,actual,target,prior_period,prior_year,driver,implication,action,owner,status", kpis)
    tasks = [
        (today, "Determine why September Motor premium is below target; 3 recommendations", "Analysis", "P1", "Not Started", "2h", "", 25, 1),
        (today, "Morning intelligence scan: NAICOM circular + 2 competitor moves", "Intel", "P1", "Not Started", "15m", "", 5, 0),
        (today, "Update KPI cockpit with August actuals", "Reporting", "P2", "Not Started", "1h", "", 10, 0),
        (today, "Follow up lapsed corporate accounts with A. Bello", "Coordination", "P2", "Not Started", "30m", "", 10, 0),
        (today, "Draft Motor save-list for at-risk renewals", "Strategy", "P2", "Not Started", "1h", "", 15, 0),
    ]
    ins(c, "tasks", "date,title,category,priority,status,effort,output,xp_reward,is_boss", tasks)
    inits = [
        ("Retail Motor turnaround", "Return Motor to 95% target by Oct", "Self", "2026-10-31",
         "At Risk", "Amber", "War-room started; save-list pending", "Publish save-list",
         "2026-09-12", "No"),
        ("Bancassurance scale-up", "2x bancassurance premium by Q4", "Growth", "2026-12-31",
         "On Track", "Green", "Pipeline +18% WoW", "Sign 1 new partner MOU",
         "2026-09-20", "No"),
        ("Receivables clean-up", "Bring >90d below N450m", "Credit", "2026-09-30",
         "Delayed", "Red", "2 brokers unresponsive", "Escalation memo to ED",
         "2026-09-11", "Yes"),
        ("Power BI KPI dashboard", "Replace manual monthly deck", "Self", "2026-10-15",
         "On Track", "Green", "Prototype covers 6 KPIs", "Connect claims feed",
         "2026-09-18", "No"),
    ]
    ins(c, "initiatives", "title,objective,owner,deadline,status,risk,last_update,next_action,next_date,escalation", inits)
    opps = [
        ("SME Motor fleet bundles", "SME / Lagos", "3 brokers asked for fleet pricing; no bundle exists",
         "High", "High", "High", "Self", "Validate", "Price 2 pilot bundles", "Broker feedback"),
        ("Bancassurance travel cover", "Retail / Bank channel", "Partner bank: 40k travellers/mo, zero attach",
         "High", "Medium", "High", "Growth", "Research", "Get bank customer data sample", "Partner meeting"),
        ("Oil & Gas contractors", "Corporate / PH", "Local-content renewals shifting to compliant insurers",
         "High", "Medium", "Medium", "Self", "Idea", "Map contractor list", "Market intel"),
        ("Microinsurance (USSD)", "Retail / Mass", "Telco partner interest; needs NAICOM sandbox note",
         "Medium", "Low", "Medium", "Self", "Idea", "Read sandbox guidelines", "InsurTech news"),
    ]
    ins(c, "opportunities", "title,segment,evidence,value,feasibility,fit,owner,status,next_step,source", opps)
    intel = [
        (today, "NAICOM releases revised motor rates guideline (exposure draft)", "Regulation",
         "Draft caps + revised third-party limits", "Directly affects Motor pricing power",
         "Reprice Motor book; model margin impact", "Risk: margin squeeze / Opp: compliant edge",
         "Summarise 2-page brief for management", "NAICOM circular", "High"),
        (today, "Leadway pushes USSD instant motor cover", "Competition",
         "Buy + renew via USSD, no app needed", "Raises bar for retail convenience",
         "Benchmark onboarding time vs ours", "Risk: retail churn", "Mystery-shop the flow", "Press + app check", "High"),
        (today, "AI & Partners launches claims photo-estimate pilot", "AI/InsurTech",
         "Photo-based motor estimates, 48h settlement claim", "Expectation reset on claims TAT",
         "Propose photo-estimate pilot for Lagos claims", "Opp: claims NPS", "Cost/benefit one-pager", "Tech blog", "Medium"),
        (today, "FX stable 6 weeks; imported parts inflation cooling", "Economy",
         "Parts inflation 22% -> 14% YoY", "Motor severity may ease in Q4",
         "Feed into severity tracker", "Opp: loss ratio relief", "None yet — monitor", "CBN data", "Medium"),
        (today, "AXA Mansard bancassurance with mid-tier bank", "Competition",
         "New 3-yr exclusive deal announced", "Contested shelf space in our pipeline bank",
         "Accelerate our MOU before exclusivity spreads", "Risk: channel lockout", "Call partner this week", "Press release", "High"),
    ]
    ins(c, "intel", "date,headline,theme,changed,why_matters,implication,opp_risk,action,source,priority", intel)
    comps = [
        ("Leadway", "USSD instant motor cover launch", "Retail convenience gap widens",
         "Mystery-shop + propose USSD response", today),
        ("AXA Mansard", "Exclusive bancassurance deal (mid-tier bank)", "Our pipeline bank may seek exclusivity elsewhere",
         "Accelerate MOU; offer pilot data", today),
        ("AI & Partners", "Photo-estimate claims pilot, 48h settlement", "Claims TAT expectation reset",
         "One-pager: pilot cost vs NPS gain", today),
    ]
    ins(c, "competitors", "name,move,implication,response,date", comps)
    insights = [
        (today, "September Motor shortfall", "Motor -9% vs target (N5.2bn vs N5.8bn); renewals -9%, 2 corporate lapses",
         "N5.2bn actual vs N5.8bn target; retention 82% vs 87%",
         "Price-driven SME churn + 2 lapsed corporate accounts", "N600m gap = ~40% of monthly shortfall; retention now red",
         "War-room + save-list; escalate top-2 lapses", "Save-list due Fri; owner: Self", "Pending",
         "Gross Written Premium (NGN bn)"),
    ]
    ins(c, "insights", "date,topic,finding,evidence,driver,implication,recommendation,action,outcome,kpi_ref", insights)
    skills = [
        ("Business Performance", "KPI / variance analysis", 1, 4, "Live company data",
         "Diagnose a performance change", 3, "Active", "Build KPI cockpit"),
        ("Excel", "XLOOKUP / SUMIFS / Pivots", 2, 5, "Real datasets",
         "Analyse raw data fast", 2, "Active", "Rebuild one report"),
        ("Excel", "Power Query", 1, 4, "Automate one workflow", "Refreshable pipeline", 2,
         "Planned", "Automate monthly input"),
        ("BI", "Power BI", 1, 4, "Management dashboard", "Interactive KPI dashboard", 2,
         "Planned", "Create prototype"),
        ("Data", "SQL", 1, 4, "Query business data", "Answer ad-hoc questions", 2,
         "Planned", "Learn joins + aggregations"),
        ("Analytics", "Trend / driver analysis", 2, 5, "Live work", "Explain causes", 2,
         "Active", "Write 3 driver trees"),
        ("Strategy", "Market / competitor analysis", 2, 4, "Track competitors",
         "Decision-ready insight", 1, "Active", "Build competitor tracker"),
        ("Growth", "Opportunity assessment", 1, 4, "Score opportunities", "Ranked pipeline", 1,
         "Planned", "Create scorecard"),
        ("Communication", "Executive PowerPoint", 2, 5, "Rewrite slides", "One message/slide", 1,
         "Active", "Redesign weekly slide"),
        ("AI", "AI for research / analysis", 2, 5, "Repeatable workflows", "Faster, accurate", 2,
         "Active", "Create research workflow"),
        ("Insurance", "Underwriting / claims economics", 2, 4, "Internal reports",
         "Explain portfolio drivers", 2, "Active", "Map premium-to-profit"),
    ]
    ins(c, "skills", "domain,skill,level,target,method,evidence,hrs,status,next_step", skills)
    xp_seed = [
        (today, "Updated KPI cockpit", "Reporting", 10, 1, 0, 10, "August actuals in"),
        (today, "Protected deep-work block", "Focus", 10, 1, 0, 10, "90 min, no distractions"),
    ]
    ins(c, "xp", "date,achievement,category,base,mult,bonus,total,notes", xp_seed)
    c.execute("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)",
              ("boss_fight", "Determine why September Motor premium is below target; 3 recommendations"))
    c.execute("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)",
              ("priorities", json.dumps([
                  "Close Motor save-list (at-risk renewals)",
                  "Escalate 2 lapsed corporate accounts",
                  "Summarise NAICOM draft rates for management"])))
    c.execute("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)",
              ("xp_guide", json.dumps([
                  ["Completed routine report", 10], ["Protected deep-work block", 10],
                  ["Completed difficult analysis", 20], ["Found material insight", 25],
                  ["Viable growth opportunity", 30], ["Management-ready recommendation", 30],
                  ["Automated workflow", 40], ["Recommendation adopted", 50]])))


def level_for(total):
    return int((total // 200) + 1)


def streak(con):
    days = [r[0] for r in con.execute(
        "SELECT DISTINCT date FROM xp ORDER BY date DESC").fetchall()]
    if not days:
        return 0
    try:
        ds = [dt.date.fromisoformat(d) for d in days]
    except ValueError:
        return len(days)
    s = 0
    cur = dt.date.today()
    if ds[0] != cur:
        cur = ds[0]
    for d in ds:
        if d == cur:
            s += 1
            cur -= dt.timedelta(days=1)
        elif d < cur:
            break
    return s


class Handler(SimpleHTTPRequestHandler):
    server_version = "CareerOS/1.0"

    def log_message(self, *a):
        pass

    def _json(self, obj, status=HTTPStatus.OK):
        body = json.dumps(obj, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
        except (TypeError, ValueError):
            n = 0
        raw = self.rfile.read(n) if n else b""
        try:
            return json.loads(raw.decode() or "{}")
        except (ValueError, UnicodeDecodeError):
            return {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        parts = [p for p in parsed.path.split("/") if p]
        qs = urllib.parse.parse_qs(parsed.query)
        if not parts or parts[0] != "api":
            return self._serve_static(parsed.path)
        con = connect()
        try:
            if parts[1] == "dashboard":
                return self._json(dashboard(con))
            if parts[1] == "export":
                return self._export(con, qs.get("table", ["kpis"])[0])
            table = parts[1]
            if table not in SCHEMA or table == "settings":
                if table == "settings":
                    rows = {r["key"]: r["value"]
                            for r in con.execute("SELECT * FROM settings")}
                    return self._json(rows)
                return self._json({"error": "unknown table"}, HTTPStatus.NOT_FOUND)
            q = qs.get("q", [""])[0].lower()
            rows = [dict(r) for r in con.execute(
                f'SELECT * FROM "{table}" ORDER BY id DESC LIMIT 500')]
            if q:
                rows = [r for r in rows if q in json.dumps(r).lower()]
            return self._json(rows)
        finally:
            con.close()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        parts = [p for p in parsed.path.split("/") if p]
        data = self._body()
        con = connect()
        try:
            if parts[1:2] == ["award"]:
                return self._award(con, data)
            if parts[1:2] == ["import"]:
                return self._import(con, data)
            table = parts[1]
            if table not in SCHEMA:
                return self._json({"error": "unknown table"}, HTTPStatus.NOT_FOUND)
            if table == "settings":
                for k, v in data.items():
                    con.execute("INSERT OR REPLACE INTO settings (key,value) "
                                "VALUES (?,?)", (k, v if isinstance(v, str) else json.dumps(v)))
                con.commit()
                return self._json({"ok": True})
            cols = [c for c in SCHEMA[table][1:] if c in data]
            if table == "xp" and "total" not in data:
                data["total"] = xp_total(data)
                cols = [c for c in SCHEMA[table][1:] if c in data]
            if not cols:
                return self._json({"error": "no valid fields"}, HTTPStatus.BAD_REQUEST)
            if "date" in SCHEMA[table] and "date" not in data:
                data["date"] = dt.date.today().isoformat()
                cols.append("date")
            cur = con.execute(
                f'INSERT INTO "{table}" ({",".join(map(q, cols))}) '
                f'VALUES ({",".join("?" for _ in cols)})',
                [data[c] for c in cols])
            con.commit()
            row = con.execute(f'SELECT * FROM "{table}" WHERE id=?',
                              (cur.lastrowid,)).fetchone()
            return self._json(dict(row), HTTPStatus.CREATED)
        finally:
            con.close()

    def do_PUT(self):
        parts = [p for p in self.path.split("/") if p]
        if len(parts) != 3:
            return self._json({"error": "use /api/<table>/<id>"}, HTTPStatus.BAD_REQUEST)
        _, table, rid = parts
        if table not in SCHEMA or table == "settings":
            return self._json({"error": "unknown table"}, HTTPStatus.NOT_FOUND)
        data = self._body()
        cols = [c for c in SCHEMA[table][1:] if c in data and c != "id"]
        if table == "xp" and any(k in data for k in ("base", "mult", "bonus")):
            data["total"] = xp_total(data)
            cols = [c for c in SCHEMA[table][1:] if c in data and c != "id"]
        if not cols:
            return self._json({"error": "no valid fields"}, HTTPStatus.BAD_REQUEST)
        con = connect()
        try:
            con.execute(f'UPDATE "{table}" SET {",".join(q(c)+"=?" for c in cols)} '
                        f"WHERE id=?", [data[c] for c in cols] + [rid])
            con.commit()
            row = con.execute(f'SELECT * FROM "{table}" WHERE id=?', (rid,)).fetchone()
            return self._json(dict(row) if row else {"ok": True})
        finally:
            con.close()

    def do_DELETE(self):
        parts = [p for p in self.path.split("?")[0].split("/") if p]
        if len(parts) != 3:
            return self._json({"error": "use /api/<table>/<id>"}, HTTPStatus.BAD_REQUEST)
        _, table, rid = parts
        if table not in SCHEMA or table == "settings":
            return self._json({"error": "unknown table"}, HTTPStatus.NOT_FOUND)
        con = connect()
        try:
            con.execute(f'DELETE FROM "{table}" WHERE id=?', (rid,))
            con.commit()
            return self._json({"ok": True})
        finally:
            con.close()

    # -- helpers ------------------------------------------------------
    def _award(self, con, data):
        total = xp_total(data)
        con.execute("INSERT INTO xp (date,achievement,category,base,mult,bonus,total,notes)"
                    " VALUES (?,?,?,?,?,?,?,?)",
                    (dt.date.today().isoformat(), data.get("achievement", "Work output"),
                     data.get("category", "General"), data.get("base", 0),
                     data.get("mult", 1), data.get("bonus", 0), total,
                     data.get("notes", "")))
        con.commit()
        return self._json(xp_summary(con))

    def _import(self, con, data):
        table, rows = data.get("table"), data.get("rows", [])
        if table not in SCHEMA or table == "settings" or not isinstance(rows, list):
            return self._json({"error": "need {table, rows[]}"}, HTTPStatus.BAD_REQUEST)
        cols = SCHEMA[table][1:]
        n = 0
        for r in rows[:500]:
            vals = [str(r.get(c, "")) for c in cols]
            if not any(v.strip() for v in vals):
                continue
            con.execute(f'INSERT INTO "{table}" ({",".join(map(q, cols))}) '
                        f'VALUES ({",".join("?" for _ in cols)})', vals)
            n += 1
        con.commit()
        return self._json({"imported": n})

    def _export(self, con, table):
        if table not in SCHEMA or table == "settings":
            return self._json({"error": "unknown table"}, HTTPStatus.NOT_FOUND)
        rows = con.execute(f'SELECT * FROM "{table}"').fetchall()
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(SCHEMA[table])
        w.writerows(rows)
        body = buf.getvalue().encode()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/csv")
        self.send_header("Content-Disposition",
                         f"attachment; filename={table}.csv")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_static(self, path):
        if path in ("/", ""):
            path = "/index.html"
        target = os.path.normpath(os.path.join(STATIC, path.lstrip("/")))
        if not target.startswith(STATIC) or not os.path.isfile(target):
            target = os.path.join(STATIC, "index.html")
            if not os.path.isfile(target):
                return self._json({"app": "career-os", "api": "/api/<table>"})
        ctype = "text/html"
        if target.endswith(".js"):
            ctype = "text/javascript"
        elif target.endswith(".css"):
            ctype = "text/css"
        with open(target, "rb") as f:
            body = f.read()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", ctype + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def dashboard(con):
    kpis = [dict(r) for r in con.execute("SELECT * FROM kpis ORDER BY id")]
    for k in kpis:
        a, t, pp, py = _f(k.get("actual")), _f(k.get("target")), \
            _f(k.get("prior_period")), _f(k.get("prior_year"))
        k["variance"] = round(a - t, 2)
        k["variance_pct"] = round((a - t) / t * 100, 1) if t else 0
        k["yoy"] = round((a - py) / py * 100, 1) if py else 0
        k["mom"] = round((a - pp) / pp * 100, 1) if pp else 0
        if not k.get("status"):
            v = abs(k["variance_pct"])
            k["status"] = "on-track" if v <= 3 else ("attention" if v <= 8 else "off-track")
    today = dt.date.today().isoformat()
    alerts = []
    for k in kpis:
        if k["status"] in ("off-track", "Delayed", "Red"):
            alerts.append({"kind": "KPI red", "text": k["metric"] + ": " + str(k["variance_pct"]) + "% vs target"})
        elif k["status"] in ("attention", "At Risk", "Amber"):
            alerts.append({"kind": "KPI amber", "text": k["metric"] + ": " + str(k["variance_pct"]) + "% vs target"})
    overdue = [dict(r) for r in con.execute(
        "SELECT * FROM initiatives WHERE status NOT IN ('Completed') AND deadline < ?",
        (today,))]
    for o in overdue:
        alerts.append({"kind": "Overdue", "text": f'Initiative overdue: {o["title"]} ({o["deadline"]})'})
    stale = [dict(r) for r in con.execute(
        "SELECT * FROM initiatives WHERE status IN ('At Risk','Delayed')")]
    for s in stale:
        alerts.append({"kind": "At risk", "text": f'{s["title"]} is {s["status"]}'})
    tasks_due = [dict(r) for r in con.execute(
        "SELECT * FROM tasks WHERE date <= ? AND status != 'Done'", (today,))]
    if tasks_due:
        alerts.append({"kind": "Tasks", "text": f'{len(tasks_due)} open tasks due'})
    xp = xp_summary(con)
    done_week = con.execute(
        "SELECT COUNT(*) FROM tasks WHERE status='Done' AND date >= date('now','-7 days')").fetchone()[0]
    return {"kpis": kpis, "alerts": alerts[:12], "overdue": overdue,
            "open_tasks": len(tasks_due), "xp": xp, "done_week": done_week,
            "date": today}


def xp_summary(con):
    total = con.execute("SELECT COALESCE(SUM(total),0) FROM xp").fetchone()[0] or 0
    week = con.execute("SELECT COALESCE(SUM(total),0) FROM xp "
                       "WHERE date >= date('now','-7 days')").fetchone()[0] or 0
    return {"total": total, "week": week, "level": level_for(total),
            "next_at": (level_for(total)) * 200, "streak": streak(con)}


if __name__ == "__main__":
    import sys
    init_db()
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8130
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Career OS running at http://127.0.0.1:{port}  (db: {DB})")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
