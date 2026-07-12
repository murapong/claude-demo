const STATUSES = ['未対応', '対応中', '完了'];

const form = document.getElementById('inquiry-form');
const formErrors = document.getElementById('form-errors');
const table = document.getElementById('inquiry-table');
const listBody = document.getElementById('inquiry-list');
const listEmpty = document.getElementById('list-empty');
const statusFilter = document.getElementById('status-filter');

let allInquiries = [];

function formatDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showErrors(errors) {
  formErrors.innerHTML = '';
  const ul = document.createElement('ul');
  for (const message of errors) {
    const li = document.createElement('li');
    li.textContent = message;
    ul.appendChild(li);
  }
  formErrors.appendChild(ul);
  formErrors.hidden = false;
}

function clearErrors() {
  formErrors.hidden = true;
  formErrors.innerHTML = '';
}

function renderRow(inquiry) {
  const tr = document.createElement('tr');

  const number = document.createElement('td');
  number.className = 'number';
  number.textContent = inquiry.number;

  const name = document.createElement('td');
  name.textContent = inquiry.name;

  const content = document.createElement('td');
  content.className = 'content';
  content.textContent = inquiry.content;

  const created = document.createElement('td');
  created.className = 'created';
  created.textContent = formatDate(inquiry.createdAt);

  const statusCell = document.createElement('td');
  const select = document.createElement('select');
  select.className = 'status';
  for (const status of STATUSES) {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status;
    option.selected = status === inquiry.status;
    select.appendChild(option);
  }
  select.dataset.status = inquiry.status;
  select.addEventListener('change', () => updateStatus(inquiry.id, select));
  statusCell.appendChild(select);

  tr.append(number, name, content, created, statusCell);
  return tr;
}

function renderList() {
  const filter = statusFilter.value;
  const inquiries = filter
    ? allInquiries.filter((i) => i.status === filter)
    : allInquiries;
  listBody.innerHTML = '';
  for (const inquiry of inquiries) {
    listBody.appendChild(renderRow(inquiry));
  }
  table.hidden = inquiries.length === 0;
  listEmpty.hidden = inquiries.length > 0;
  listEmpty.textContent = filter && allInquiries.length > 0
    ? '該当するお問い合わせはありません。'
    : 'お問い合わせはまだありません。';
}

async function loadInquiries() {
  const res = await fetch('/api/inquiries');
  allInquiries = await res.json();
  renderList();
}

async function updateStatus(id, select) {
  const prev = select.dataset.status;
  const res = await fetch(`/api/inquiries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: select.value }),
  });
  if (!res.ok) {
    select.value = prev;
    alert('ステータスの更新に失敗しました');
    return;
  }
  select.dataset.status = select.value;
  const inquiry = allInquiries.find((i) => i.id === id);
  if (inquiry) inquiry.status = select.value;
  if (statusFilter.value && statusFilter.value !== select.value) {
    renderList();
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();
  const res = await fetch('/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: form.name.value,
      content: form.content.value,
    }),
  });
  if (res.status === 422) {
    const body = await res.json();
    showErrors(body.errors || ['入力内容を確認してください']);
    return;
  }
  if (!res.ok) {
    showErrors(['登録に失敗しました。時間をおいて再度お試しください']);
    return;
  }
  form.reset();
  await loadInquiries();
});

statusFilter.addEventListener('change', renderList);

loadInquiries();
