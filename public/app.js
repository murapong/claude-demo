const STATUSES = ['未対応', '対応中', '完了', '却下'];

const form = document.getElementById('inquiry-form');
const nameInput = document.getElementById('name');
const contentInput = document.getElementById('content');
const formErrors = document.getElementById('form-errors');
const listEl = document.getElementById('inquiry-list');
const emptyMessage = document.getElementById('empty-message');
const filterButtons = document.querySelectorAll('.filter-btn');
const toast = document.getElementById('toast');

let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3000);
}

let inquiries = [];
let currentFilter = 'すべて';

function formatDate(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showErrors(errors) {
  formErrors.hidden = false;
  const ul = document.createElement('ul');
  for (const message of errors) {
    const li = document.createElement('li');
    li.textContent = message;
    ul.appendChild(li);
  }
  formErrors.replaceChildren(ul);
}

function clearErrors() {
  formErrors.hidden = true;
  formErrors.replaceChildren();
}

function renderList() {
  const visible = currentFilter === 'すべて'
    ? inquiries
    : inquiries.filter((i) => i.status === currentFilter);

  emptyMessage.hidden = visible.length > 0;
  listEl.replaceChildren(...visible.map(createCard));
}

function createCard(inquiry) {
  const li = document.createElement('li');
  li.className = 'inquiry-card';

  const meta = document.createElement('div');
  meta.className = 'inquiry-meta';

  const receipt = document.createElement('span');
  receipt.className = 'receipt-number';
  receipt.textContent = inquiry.receiptNumber;

  const name = document.createElement('span');
  name.className = 'inquiry-name';
  name.textContent = inquiry.name;

  const badge = document.createElement('span');
  badge.className = `status-badge status-${inquiry.status}`;
  badge.textContent = inquiry.status;

  const date = document.createElement('span');
  date.className = 'inquiry-date';
  date.textContent = formatDate(inquiry.createdAt);

  meta.append(receipt, name, badge, date);

  const content = document.createElement('p');
  content.className = 'inquiry-content';
  content.textContent = inquiry.content;

  const control = document.createElement('label');
  control.className = 'status-control';
  control.append('ステータス変更:');

  const select = document.createElement('select');
  for (const status of STATUSES) {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status;
    option.selected = status === inquiry.status;
    select.appendChild(option);
  }
  select.addEventListener('change', () => updateStatus(inquiry.id, select.value, select));
  control.appendChild(select);

  li.append(meta, content, control);
  return li;
}

async function fetchInquiries() {
  const res = await fetch('/api/inquiries');
  if (!res.ok) throw new Error('一覧の取得に失敗しました');
  const data = await res.json();
  inquiries = data.inquiries;
  renderList();
}

async function updateStatus(id, status, select) {
  select.disabled = true;
  try {
    const res = await fetch(`/api/inquiries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const index = inquiries.findIndex((i) => i.id === id);
    if (index !== -1) inquiries[index] = data.inquiry;
    renderList();
  } catch {
    alert('ステータスの更新に失敗しました。時間をおいて再度お試しください。');
    renderList();
  } finally {
    select.disabled = false;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput.value, content: contentInput.value }),
    });
    const data = await res.json();
    if (res.status === 422) {
      showErrors(data.errors);
      return;
    }
    if (!res.ok) throw new Error();
    form.reset();
    await fetchInquiries();
    showToast(`お問い合わせを登録しました(受付番号: ${data.inquiry.receiptNumber})`);
  } catch {
    showErrors(['登録に失敗しました。時間をおいて再度お試しください。']);
  } finally {
    submitButton.disabled = false;
  }
});

for (const button of filterButtons) {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    for (const b of filterButtons) b.classList.toggle('is-active', b === button);
    renderList();
  });
}

fetchInquiries().catch(() => {
  emptyMessage.hidden = false;
  emptyMessage.textContent = '一覧の取得に失敗しました。ページを再読み込みしてください。';
});
