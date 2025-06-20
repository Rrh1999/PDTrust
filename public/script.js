let data = {
  tasks: [],
  projects: [],
  recurringTasks: [],
  recurringHistory: [],
  weeklyTasks: [],
  weeklyLogs: {}
};
let currentWeekOffset = 0;

async function loadData() {
  try {
    const res = await fetch('/data');
    if (res.ok) data = await res.json();
  } catch (e) { console.error('Failed loading data', e); }
  updateProjectDropdowns();
  renderTasks();
  renderRecurringTasks();
  renderWeeklyGrid();
}

async function saveData() {
  try {
    await fetch('/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  } catch (e) { console.error('Failed saving data', e); }
}

function getPriorityColor(level) {
  return {
    'High': 'red', 'High/Medium': 'orange', 'Medium': 'gold', 'Medium/Low': 'yellowgreen', 'Low': 'yellow'
  }[level] || 'black';
}

function addProject() {
  const name = document.getElementById('newProjectName').value.trim();
  const color = document.getElementById('newProjectColor').value;
  if (!name) return alert('Project name required.');
  data.projects.push({ name, color });
  document.getElementById('newProjectName').value = '';
  updateProjectDropdowns();
  saveData();
}

function updateProjectDropdowns() {
  ['projectSelect', 'recProjectSelect', 'weeklyProject'].forEach(id => {
    const dropdown = document.getElementById(id);
    dropdown.innerHTML = '<option value="">Select project</option>';
    data.projects.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = p.name;
      dropdown.appendChild(opt);
    });
  });
}

function validateAndAddTask() {
  const name = document.getElementById('taskName').value;
  const dueDate = document.getElementById('dueDate').value;
  const urgency = document.getElementById('urgency').value;
  const importance = document.getElementById('importance').value;
  const p = document.getElementById('projectSelect').value;
  if (!name || p === '') return alert('Please complete task name and select a project.');
  data.tasks.push({ name, dueDate: dueDate || '', urgency, importance, completed: false, projectIndex: parseInt(p) });
  document.getElementById('taskName').value = '';
  document.getElementById('dueDate').value = '';
  document.getElementById('urgency').value = '';
  document.getElementById('importance').value = '';
  document.getElementById('projectSelect').value = '';
  saveData();
  renderTasks();
}

function renderTasks() {
  const container = document.getElementById('taskList');
  container.innerHTML = '';
  data.tasks.forEach((task, i) => {
    if (!task.completed) {
      const p = data.projects[task.projectIndex];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${task.name}</td>
        <td><span class='project-label' style='background:${p.color};'>${p.name}</span></td>
        <td>${task.dueDate}</td>
        <td style='color:${getPriorityColor(task.urgency)};'>${task.urgency}</td>
        <td style='color:${getPriorityColor(task.importance)};'>${task.importance}</td>
        <td><button onclick='completeTask(${i})'>Complete</button><button onclick='deleteTask(${i})'>Delete</button></td>`;
      container.appendChild(tr);
    }
  });
}

function completeTask(i) {
  data.tasks[i].completed = true;
  saveData();
  renderTasks();
}

function deleteTask(i) {
  data.tasks.splice(i, 1);
  saveData();
  renderTasks();
}

function getWeekKey(offset = 0) {
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + (offset * 7));
  return monday.toISOString().split('T')[0];
}

function renderWeeklyGrid() {
  const key = getWeekKey(currentWeekOffset);
  const dateSpan = document.getElementById('weekDateDisplay');
  if (dateSpan) dateSpan.textContent = key;
  const tbody = document.getElementById('weeklyGrid');
  tbody.innerHTML = '';
  data.weeklyTasks.forEach((task, i) => {
    const project = data.projects[task.projectIndex];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${task.name}</td>
      <td><span class='project-label' style='background:${project.color};'>${project.name}</span></td>
      <td style='color:${getPriorityColor(task.urgency)};'>${task.urgency}</td>
      <td style='color:${getPriorityColor(task.importance)};'>${task.importance}</td>`;
    for (let d = 0; d < 7; d++) {
      const id = `${i}_${d}`;
      const done = data.weeklyLogs[key] && data.weeklyLogs[key][id];
      const due = task.days.includes(d);
      const colorClass = done ? 'done' : due ? 'due' : 'not-due';
      const td = document.createElement('td');
      td.innerHTML = `<span class='circle ${colorClass}' onclick='toggleWeeklyTask(${i},${d})'></span>`;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
}

function toggleWeeklyTask(taskIndex, dayIndex) {
  const key = getWeekKey(currentWeekOffset);
  data.weeklyLogs[key] ||= {};
  const id = `${taskIndex}_${dayIndex}`;
  if (data.weeklyLogs[key][id]) delete data.weeklyLogs[key][id];
  else data.weeklyLogs[key][id] = true;
  saveData();
  renderWeeklyGrid();
}

function addWeeklyTask() {
  const name = document.getElementById('weeklyTaskName').value;
  const projectIndex = document.getElementById('weeklyProject').value;
  const urgency = document.getElementById('weeklyUrgency').value;
  const importance = document.getElementById('weeklyImportance').value;
  const selectedOptions = Array.from(document.getElementById('weeklyDays').selectedOptions);
  const days = selectedOptions.map(opt => parseInt(opt.value));
  if (!name || projectIndex === '' || days.length === 0) return alert('Complete all fields');
  data.weeklyTasks.push({ name, projectIndex: parseInt(projectIndex), urgency, importance, days });
  saveData();
  renderWeeklyGrid();
}

function changeWeek(offset) {
  currentWeekOffset += offset;
  renderWeeklyGrid();
}

function addRecurringTask() {
  const name = document.getElementById('recTaskName').value;
  const dueDate = document.getElementById('recStartDate').value;
  const intervalValue = parseInt(document.getElementById('recIntervalValue').value);
  const intervalUnit = document.getElementById('recIntervalUnit').value;
  const urgency = document.getElementById('recUrgency').value;
  const importance = document.getElementById('recImportance').value;
  const p = document.getElementById('recProjectSelect').value;
  if (!name || !dueDate || !intervalValue || p === '') return alert('Fill all fields.');
  data.recurringTasks.push({ name, dueDate, intervalValue, intervalUnit, urgency, importance, projectIndex: parseInt(p) });
  saveData();
  renderRecurringTasks();
}

function getNextDueDate(fromDate, interval, unit) {
  let d = new Date(fromDate);
  if (unit === 'days') d.setDate(d.getDate() + interval);
  else if (unit === 'weeks') d.setDate(d.getDate() + 7 * interval);
  else if (unit === 'months') d.setMonth(d.getMonth() + interval);
  else if (unit === 'years') d.setFullYear(d.getFullYear() + interval);
  return d.toISOString().split('T')[0];
}

function completeRecurring(i) {
  const t = data.recurringTasks[i];
  const today = new Date().toISOString().split('T')[0];
  const delta = Math.ceil((new Date(today) - new Date(t.dueDate)) / (1000 * 60 * 60 * 24));
  data.recurringHistory.push({ ...t, action: 'completed', date: today, delta });
  t.dueDate = getNextDueDate(today, t.intervalValue, t.intervalUnit);
  saveData();
  renderRecurringTasks();
}

function skipRecurring(i) {
  const t = data.recurringTasks[i];
  const today = new Date().toISOString().split('T')[0];
  const delta = Math.ceil((new Date(today) - new Date(t.dueDate)) / (1000 * 60 * 60 * 24));
  data.recurringHistory.push({ ...t, action: 'skipped', date: today, delta });
  t.dueDate = getNextDueDate(today, t.intervalValue, t.intervalUnit);
  saveData();
  renderRecurringTasks();
}

function renderRecurringTasks() {
  const container = document.getElementById('recurringList');
  container.innerHTML = '';
  data.recurringTasks.forEach((task, i) => {
    const p = data.projects[task.projectIndex];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${task.name}</td>
      <td><span class='project-label' style='background:${p.color};'>${p.name}</span></td>
      <td>${task.dueDate}</td>
      <td style='color:${getPriorityColor(task.urgency)};'>${task.urgency}</td>
      <td style='color:${getPriorityColor(task.importance)};'>${task.importance}</td>
      <td><button onclick='completeRecurring(${i})'>Complete</button><button onclick='skipRecurring(${i})'>Skip</button></td>`;
    container.appendChild(tr);
  });
}

function showRecurringHistory() {
  const list = document.getElementById('recurHistoryList');
  list.innerHTML = '';
  data.recurringHistory.forEach(e => {
    const p = data.projects[e.projectIndex];
    list.innerHTML += `<li>${e.name} (${p.name}) was ${e.action} on ${e.date} (${e.delta >= 0 ? '+' : ''}${e.delta} days)</li>`;
  });
  document.getElementById('recurHistoryModal').style.display = 'block';
  document.getElementById('overlay').style.display = 'block';
}

function showCompletedTasks() {
  const list = document.getElementById('completedList');
  list.innerHTML = '';
  data.tasks.forEach(task => {
    if (task.completed) {
      const p = data.projects[task.projectIndex];
      list.innerHTML += `<li>${task.name} (${p.name}) - Due: ${task.dueDate}</li>`;
    }
  });
  document.getElementById('completedModal').style.display = 'block';
  document.getElementById('overlay').style.display = 'block';
}

function closeModals() {
  document.getElementById('recurHistoryModal').style.display = 'none';
  document.getElementById('completedModal').style.display = 'none';
  document.getElementById('overlay').style.display = 'none';
}

window.onload = loadData;
