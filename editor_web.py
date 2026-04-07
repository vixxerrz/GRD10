import json
import os
import re
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse


def read_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: str, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def slugify(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "teacher"


def ensure_paths(root: str):
    teachers_path = os.path.join(root, "mendel", "data", "teacher_leaderboard.json")
    absence_path = os.path.join(root, "mendel", "data", "absence_leaderboard.json")
    return teachers_path, absence_path

def sync_absence_file(teachers_data, absence_data):
    rows = {row.get("teacherId"): row for row in absence_data.get("teachers", []) if row.get("teacherId")}
    out = []
    for t in teachers_data.get("teachers", []):
        tid = t.get("id")
        if not tid:
            continue
        absent = int(t.get("lessonsMissed") or 0)
        row = rows.get(tid)
        if row is None:
            out.append({"teacherId": tid, "lessonsMissed": absent})
        else:
            out.append({"teacherId": tid, "lessonsMissed": int(row.get("lessonsMissed") or absent)})
    absence_data["teachers"] = out
    return absence_data


class EditorHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.root_dir = os.path.dirname(os.path.abspath(__file__))
        self.teachers_path, self.absence_path = ensure_paths(self.root_dir)
        super().__init__(*args, directory=self.root_dir, **kwargs)

    def do_GET(self):
        if self.path == "/":
            self.serve_main_page()
        elif self.path == "/api/data":
            self.serve_api_data()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/save":
            self.handle_save()
        elif self.path == "/api/add":
            self.handle_add()
        elif self.path.startswith("/api/remove/"):
            self.handle_remove()
        else:
            self.send_error(404)

    def serve_main_page(self):
        html_page = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mendel Editor</title>
<style>
:root {
  --bg: #0b1020;
  --panel: rgba(255,255,255,0.06);
  --text: rgba(255,255,255,0.92);
  --muted: rgba(255,255,255,0.70);
  --border: rgba(255,255,255,0.14);
  --accent: #22c55e;
  --danger: #fb7185;
  --radius: 12px;
}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  color: var(--text);
  background: var(--bg);
  display:flex;
  flex-direction:column;
}
header{
  padding:12px 20px;
  border-bottom:1px solid var(--border);
  background: rgba(0,0,0,0.3);
}
main{
  flex:1;
  display:flex;
  gap:16px;
  padding:16px;
  overflow:hidden;
}
.col{
  border:1px solid var(--border);
  background: var(--panel);
  border-radius: var(--radius);
  padding:12px;
  display:flex;
  flex-direction:column;
}
.col-left{flex:1}
.col-right{flex:1; overflow-y: auto; max-height: 80vh;}
h2{margin:0 0 12px; font-size:16px; font-weight:700}
ul{
  list-style:none; padding:0; margin:0;
  max-height:70vh;
  overflow-y:auto;
}
li{
  padding:8px 10px;
  border-radius:8px;
  cursor:pointer;
  margin-bottom:4px;
  border:1px solid transparent;
}
li:hover{background:var(--panel)}
li.selected{background:var(--accent); color:#fff}
form{display:flex; flex-direction:column; gap:12px}
label{font-size:13px; color:var(--muted)}
input,select,textarea{padding:8px; border-radius:8px; border:1px solid var(--border); background:var(--panel); color:var(--text)}
button{
  padding:10px;
  border-radius:8px;
  border:1px solid var(--border);
  background:var(--accent);
  color:#fff;
  cursor:pointer;
  font-weight:600;
}
button.danger{background:var(--danger)}
button:hover{opacity:0.8}
.buttons{display:flex; gap:8px; margin-top:8px}
.points-table{width:100%; border-collapse:collapse; font-size:13px}
.points-table th,.points-table td{padding:6px; text-align:left; border-bottom:1px solid var(--border)}
.points-table th{color:var(--muted)}
</style>
</head>
<body>
<header><h1>Mendel Editor</h1></header>
<main>
<div class="col col-left">
<h2>Teachers</h2>
<ul id="teacherList"></ul>
<div class="buttons">
<button onclick="addTeacher()">Add Teacher</button>
<button onclick="removeSelected()" class="danger">Remove Selected</button>
<button onclick="reload()">Reload</button>
<button onclick="saveAll()">Save All</button>
</div>
</div>
<div class="col col-right">
<h2>Details</h2>
<form id="detailsForm">
<label>Name <input id="name" required></label>
<label>ID <input id="id" readonly></label>
<label>Range <input id="range"></label>
<label>Lessons Missed <input id="lessonsMissed" type="number" min="0"></label>
<label>Description <textarea id="description" rows="3"></textarea>
<div id="categories"></div>
</form>
<h2>Points per Tier</h2>
<table class="points-table" id="pointsTable">
<thead><tr><th>Tier</th><th>Points</th></tr></thead>
<tbody></tbody>
</table>
<h2>Tomorrow's Timetable</h2>
<form id="timetableForm">
<label>Date <input id="timetableDate" placeholder="25.02."></label>
<label>Note <textarea id="timetableNote" rows="2" placeholder="Add a note for tomorrow's timetable..."></textarea>
<div id="timetableSubjects"></div>
<button type="button" onclick="addTimetableSubject()">Add Subject</button>
<button type="button" onclick="saveTimetable()">Save Timetable</button>
</form>
</div>
</main>
<script>
let data = {teachers:[], categories:[], pointsByTier:{}, timetable:{}};
let selectedId = null;

async function load(){
  const r = await fetch('/api/data');
  data = await r.json();
  renderTeacherList();
  renderCategories();
  renderPointsTable();
  renderTimetable();
}
function renderTeacherList(){
  const ul = document.getElementById('teacherList');
  ul.innerHTML = '';
  data.teachers.forEach(t=>{
    const li = document.createElement('li');
    li.textContent = `${t.name} (${t.id})`;
    li.dataset.id = t.id;
    li.onclick = () => select(t.id);
    if(t.id===selectedId) li.classList.add('selected');
    ul.appendChild(li);
  });
}
function renderCategories(){
  const div = document.getElementById('categories');
  div.innerHTML = '';
  data.categories.forEach(cat=>{
    const label = document.createElement('label');
    label.textContent = cat+' ';
    const sel = document.createElement('select');
    sel.id = 'cat_'+cat;
    ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'].forEach(v=>{
      const opt = document.createElement('option');
      opt.value=v; opt.textContent=v;
      sel.appendChild(opt);
    });
    label.appendChild(sel);
    div.appendChild(label);
  });
}
function renderPointsTable(){
  const tbody = document.querySelector('#pointsTable tbody');
  tbody.innerHTML = '';
  Object.entries(data.pointsByTier).forEach(([tier,pts])=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${tier}</td><td contenteditable="true">${pts}</td>`;
    tbody.appendChild(tr);
  });
}
function select(id){
  selectedId = id;
  const t = data.teachers.find(x=>x.id===id);
  if(!t) return;
  document.getElementById('name').value = t.name;
  document.getElementById('id').value = t.id;
  document.getElementById('range').value = t.range||'';
  document.getElementById('lessonsMissed').value = t.lessonsMissed||0;
  document.getElementById('description').value = t.description||'';
  data.categories.forEach(cat=>{
    document.getElementById('cat_'+cat).value = (t.categories||{})[cat]||'LT5';
  });
  renderTeacherList();
}
function addTeacher(){
  const name = prompt('Name for new teacher');
  if(!name) return;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  data.teachers.push({
    id,
    name,
    range:'',
    lessonsMissed:0,
    description:'',
    categories: Object.fromEntries(data.categories.map(c=>[c,'LT5']))
  });
  renderTeacherList();
}
function removeSelected(){
  if(!selectedId) return;
  if(!confirm('Remove '+selectedId+'?')) return;
  data.teachers = data.teachers.filter(t=>t.id!==selectedId);
  selectedId=null;
  document.getElementById('detailsForm').reset();
  renderTeacherList();
}
async function reload(){ 
  await load(); 
  document.getElementById('description').value = '';
}
function renderTimetable(){
  const tomorrow = data.timetable.tomorrow || {};
  document.getElementById('timetableDate').value = tomorrow.date || '';
  document.getElementById('timetableNote').value = tomorrow.note || '';
  const subjectsDiv = document.getElementById('timetableSubjects');
  subjectsDiv.innerHTML = '';
  (tomorrow.subjects || []).forEach((subject, index) => {
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;';
    div.innerHTML = `
      <input placeholder="Hour" value="${subject.hour || ''}" data-field="hour" data-index="${index}" style="width: 60px;">
      <input placeholder="Subject" value="${subject.subject || ''}" data-field="subject" data-index="${index}" style="width: 80px;">
      <button type="button" onclick="removeTimetableSubject(${index})" style="background: var(--danger);">Remove</button>
    `;
    subjectsDiv.appendChild(div);
  });
}
function addTimetableSubject(){
  if (!data.timetable.tomorrow) {
    data.timetable.tomorrow = {date: '', subjects: []};
  }
  data.timetable.tomorrow.subjects.push({hour: '', subject: ''});
  renderTimetable();
}
function removeTimetableSubject(index){
  if (data.timetable.tomorrow && data.timetable.tomorrow.subjects) {
    data.timetable.tomorrow.subjects.splice(index, 1);
    renderTimetable();
  }
}
async function saveAll(){
  const t = data.teachers.find(x=>x.id===selectedId);
  if(t){
    t.name = document.getElementById('name').value;
    t.range = document.getElementById('range').value;
    t.lessonsMissed = Number(document.getElementById('lessonsMissed').value);
    t.description = document.getElementById('description').value;
    t.categories = {};
    data.categories.forEach(cat=>{
      t.categories[cat] = document.getElementById('cat_'+cat).value;
    });
  }
  const rows = document.querySelectorAll('#pointsTable tbody tr');
  rows.forEach(tr=>{
    const tier = tr.cells[0].textContent;
    const pts = Number(tr.cells[1].textContent);
    data.pointsByTier[tier] = pts;
  });
  
  // Save timetable data
  if (!data.timetable.tomorrow) {
    data.timetable.tomorrow = {date: '', subjects: []};
  }
  data.timetable.tomorrow.date = document.getElementById('timetableDate').value;
  data.timetable.tomorrow.note = document.getElementById('timetableNote').value;
  
  const subjectInputs = document.querySelectorAll('#timetableSubjects input[data-field]');
  const subjectsMap = {};
  subjectInputs.forEach(input => {
    const index = input.dataset.index;
    const field = input.dataset.field;
    if (!subjectsMap[index]) subjectsMap[index] = {};
    subjectsMap[index][field] = input.value;
  });
  data.timetable.tomorrow.subjects = Object.values(subjectsMap);
  
  await fetch('/api/save', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
}
async function saveTimetable(){
  // Save timetable data only
  if (!data.timetable.tomorrow) {
    data.timetable.tomorrow = {date: '', subjects: []};
  }
  data.timetable.tomorrow.date = document.getElementById('timetableDate').value;
  data.timetable.tomorrow.note = document.getElementById('timetableNote').value;
  
  const subjectInputs = document.querySelectorAll('#timetableSubjects input[data-field]');
  const subjectsMap = {};
  subjectInputs.forEach(input => {
    const index = input.dataset.index;
    const field = input.dataset.field;
    if (!subjectsMap[index]) subjectsMap[index] = {};
    subjectsMap[index][field] = input.value;
  });
  data.timetable.tomorrow.subjects = Object.values(subjectsMap);
  
  await fetch('/api/save', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
  alert('Timetable saved!');
}
load();
</script>
</body>
</html>"""
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(html_page.encode())

    def serve_api_data(self):
        teachers_data = read_json(self.teachers_path)
        payload = {
            "teachers": teachers_data.get("teachers", []),
            "categories": teachers_data.get("categories", []),
            "pointsByTier": teachers_data.get("pointsByTier", {}),
            "timetable": teachers_data.get("timetable", {}),
        }
        self.send_json(payload)

    def handle_save(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode())
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        teachers_data = {
            "pointsByTier": payload.get("pointsByTier", {}),
            "categories": payload.get("categories", []),
            "teachers": payload.get("teachers", []),
            "timetable": payload.get("timetable", {}),
        }
        
        write_json(self.teachers_path, teachers_data)
        self.send_response(200)
        self.end_headers()

    def handle_remove(self):
        tid = self.path.split("/")[-1]
        teachers_data = read_json(self.teachers_path)
        teachers_data["teachers"] = [t for t in teachers_data.get("teachers", []) if t.get("id") != tid]
        write_json(self.teachers_path, teachers_data)
        self.send_json({"status": "ok"})

    def send_json(self, obj):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(obj).encode())


def main():
    port = 8067
    httpd = HTTPServer(("localhost", port), EditorHandler)
    print(f"GRD10 Editor running at http://localhost:{port}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()

