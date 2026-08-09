/**
 * localStorage 封装 — 拼豆小店数据层
 * Keys: pindou_reservations / pindou_photos / pindou_user
 */

const KEYS = {
  reservations: 'pindou_reservations',
  photos: 'pindou_photos',
  user: 'pindou_user',
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── 预约 ──────────────────────────────────────────

function getReservations() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.reservations)) || [];
  } catch {
    return [];
  }
}

function saveReservations(list) {
  localStorage.setItem(KEYS.reservations, JSON.stringify(list));
}

function addReservation({ date, timeSlot, peopleCount, name, phone }) {
  const list = getReservations();
  const item = {
    id: generateId(),
    date,
    timeSlot,
    peopleCount,
    name,
    phone,
    createdAt: new Date().toISOString(),
  };
  list.push(item);
  saveReservations(list);
  return item;
}

function deleteReservation(id) {
  const list = getReservations().filter((r) => r.id !== id);
  saveReservations(list);
}

/** 返回指定日期+时段已预约的总人数 */
function getBookedCount(date, timeSlot) {
  return getReservations()
    .filter((r) => r.date === date && r.timeSlot === timeSlot)
    .reduce((sum, r) => sum + r.peopleCount, 0);
}

/** 检查是否可预约：true = 可以预约 */
function canBook(date, timeSlot, peopleCount) {
  return getBookedCount(date, timeSlot) + peopleCount <= 35;
}

/** 获取某日所有时段的预约情况 */
function getDaySlotsStatus(date) {
  return ['morning', 'afternoon', 'evening'].map((slot) => ({
    slot,
    booked: getBookedCount(date, slot),
    available: 35 - getBookedCount(date, slot),
    isFull: getBookedCount(date, slot) >= 35,
  }));
}

// ── 照片 ──────────────────────────────────────────

function getPhotos() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.photos)) || [];
  } catch {
    return [];
  }
}

function savePhotos(list) {
  localStorage.setItem(KEYS.photos, JSON.stringify(list));
}

function addPhoto(dataUrl, title) {
  const list = getPhotos();
  const item = {
    id: generateId(),
    dataUrl,
    title: title || '未命名作品',
    createdAt: new Date().toISOString(),
  };
  list.unshift(item);
  savePhotos(list);
  return item;
}

function deletePhoto(id) {
  const list = getPhotos().filter((p) => p.id !== id);
  savePhotos(list);
}

// ── 用户信息 ──────────────────────────────────────

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.user)) || { nickname: '拼豆达人', avatar: '' };
  } catch {
    return { nickname: '拼豆达人', avatar: '' };
  }
}

function updateUser(data) {
  const user = { ...getUser(), ...data };
  localStorage.setItem(KEYS.user, JSON.stringify(user));
  return user;
}

// ── 统计 ──────────────────────────────────────────

function getUserStats() {
  const reservations = getReservations();
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    totalReservations: reservations.length,
    monthlyReservations: reservations.filter((r) => r.date.startsWith(thisMonth)).length,
    totalPhotos: getPhotos().length,
  };
}
