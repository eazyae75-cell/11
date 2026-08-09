/**
 * app.js — 拼豆小店应用核心
 * Tab 切换 · Toast · 全局状态 · 初始化
 */

const App = (function () {
  'use strict';

  // ── 全局状态 ──────────────────────────────────
  const state = {
    activeTab: 'home',
    selectedDate: null,       // 'YYYY-MM-DD'
    selectedSlot: null,       // 'morning' | 'afternoon' | 'evening'
    selectedPeople: 1,        // 1-6
    isMultiPeople: false,
  };

  const CAPACITY = 35;

  // ── Tab 切换 ──────────────────────────────────
  function switchTab(tab) {
    state.activeTab = tab;
    document.body.setAttribute('data-tab', tab);

    // 更新 tab bar 高亮
    document.querySelectorAll('.tab-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });

    // 切换页面
    document.querySelectorAll('.page').forEach((el) => {
      el.classList.toggle('active', el.id === 'tab-' + tab);
    });

    // 进入预约页时初始化日期
    if (tab === 'booking') {
      initDatePicker();
      updateCapacityBar();
      renderBookingList();
    }

    // 进入首页/个人中心时刷新数据
    if (tab === 'home') refreshHome();
    if (tab === 'profile') refreshProfile();
  }

  // ── Toast 提示 ────────────────────────────────
  function showToast(message, type) {
    type = type || 'info';
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2200);
  }

  // ── 预约相关（状态管理）──────────────────────
  function selectDate(dateStr) {
    state.selectedDate = dateStr;
    state.selectedSlot = null;
    document.querySelectorAll('.date-chip').forEach((el) => {
      el.classList.toggle('selected', el.dataset.date === dateStr);
    });
    // 清除时段选择
    document.querySelectorAll('.time-slot-btn').forEach((el) => el.classList.remove('selected'));
    updateCapacityBar();
  }

  function selectTimeSlot(slot) {
    if (!state.selectedDate) {
      showToast('请先选择日期', 'error');
      return;
    }
    state.selectedSlot = slot;
    document.querySelectorAll('.time-slot-btn').forEach((el) => {
      el.classList.toggle('selected', el.dataset.slot === slot);
    });
    updateCapacityBar();
  }

  function selectPeople(count) {
    if (count === 'multi') {
      state.isMultiPeople = true;
      state.selectedPeople = parseInt(document.getElementById('multi-num').textContent) || 3;
      document.getElementById('multi-adjust').classList.add('show');
    } else {
      state.isMultiPeople = false;
      state.selectedPeople = count;
      document.getElementById('multi-adjust').classList.remove('show');
    }
    document.querySelectorAll('.people-btn').forEach((el) => {
      const isSelected = (count === 'multi') ? el.dataset.count === 'multi'
        : parseInt(el.dataset.count) === count;
      el.classList.toggle('selected', isSelected);
    });
    updateCapacityBar();
  }

  function adjustMultiPeople(delta) {
    const el = document.getElementById('multi-num');
    let val = parseInt(el.textContent) + delta;
    val = Math.max(3, Math.min(6, val));
    el.textContent = val;
    state.selectedPeople = val;
    updateCapacityBar();
  }

  // ── 容量条更新 ────────────────────────────────
  function updateCapacityBar() {
    const date = state.selectedDate;
    const slot = state.selectedSlot;
    const label = document.getElementById('capacity-bar-label');
    const numEl = document.getElementById('capacity-bar-num');
    const fill = document.getElementById('capacity-bar-fill');

    if (!date || !slot) {
      label.textContent = '请选择日期和时段';
      numEl.textContent = '0/35';
      numEl.classList.remove('full');
      fill.style.width = '0%';
      fill.classList.remove('full');
      return;
    }

    const booked = getBookedCount(date, slot);
    const remain = CAPACITY - booked;
    const pct = Math.round((booked / CAPACITY) * 100);

    label.textContent = '已预约 ' + booked + ' 人 · 还可预约 ' + remain + ' 人';
    numEl.textContent = booked + '/' + CAPACITY;
    fill.style.width = pct + '%';

    if (booked >= CAPACITY) {
      numEl.classList.add('full');
      fill.classList.add('full');
      label.textContent = '⚠️ 该时段已约满';
    } else if (booked + state.selectedPeople > CAPACITY) {
      label.textContent = '⚠️ 余位不足！仅剩 ' + remain + ' 个位置';
      fill.classList.add('full');
      numEl.classList.add('full');
    } else {
      numEl.classList.remove('full');
      fill.classList.remove('full');
    }
  }

  // ── 提交预约 ──────────────────────────────────
  function submitBooking() {
    const date = state.selectedDate;
    const slot = state.selectedSlot;
    const people = state.selectedPeople;
    const name = document.getElementById('input-name').value.trim();
    const phone = document.getElementById('input-phone').value.trim();

    // 验证
    if (!date) return showToast('请先选择日期', 'error');
    if (!slot) return showToast('请选择时段', 'error');
    if (!people || people < 1) return showToast('请选择人数', 'error');
    if (!canBook(date, slot, people)) return showToast('该时段余位不足，请选择其他时段', 'error');
    if (!name || name.length < 2) return showToast('请输入姓名（至少2个字）', 'error');
    if (!/^1[3-9]\d{9}$/.test(phone)) return showToast('请输入正确的手机号', 'error');

    // 提交
    addReservation({ date, timeSlot: slot, peopleCount: people, name, phone });
    showToast('🎉 预约成功！', 'success');

    // 重置
    document.getElementById('input-name').value = '';
    document.getElementById('input-phone').value = '';
    state.selectedSlot = null;
    document.querySelectorAll('.time-slot-btn').forEach((el) => el.classList.remove('selected'));
    updateCapacityBar();
    renderBookingList();
  }

  // ── 预约列表 ──────────────────────────────────
  function renderBookingList() {
    const container = document.getElementById('booking-list');
    const today = getTodayStr();
    const list = getReservations().filter((r) => r.date === today);

    document.getElementById('booking-list-count').textContent = list.length + ' 条';

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>今天还没有预约记录</p></div>';
      return;
    }

    const slotLabels = { morning: '🌅 上午', afternoon: '☀️ 下午', evening: '🌙 晚间' };

    container.innerHTML = list
      .map(
        (r) => `
        <div class="reservation-card">
          <div class="reservation-info">
            <div class="reservation-date">${r.name} · ${r.peopleCount}人</div>
            <div class="reservation-detail">
              <span class="tag">${slotLabels[r.timeSlot] || r.timeSlot}</span>
              ${r.phone}
            </div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="App.cancelBooking('${r.id}')">取消</button>
        </div>`
      )
      .join('');
  }

  function cancelBooking(id) {
    if (!confirm('确定要取消这个预约吗？')) return;
    deleteReservation(id);
    showToast('预约已取消', 'info');
    renderBookingList();
    updateCapacityBar();
    if (state.activeTab === 'home') refreshHome();
    if (state.activeTab === 'profile') refreshProfile();
  }

  // ── 首页刷新 ──────────────────────────────────
  function refreshHome() {
    const today = getTodayStr();
    const allToday = getReservations().filter((r) => r.date === today);
    const totalBooked = allToday.reduce((s, r) => s + r.peopleCount, 0);

    document.getElementById('home-today-booked').textContent = totalBooked + '人';
    document.getElementById('home-today-available').textContent = Math.max(0, CAPACITY * 3 - totalBooked) + '位';

    // 圆环
    const slots = getDaySlotsStatus(today);
    const ringContainer = document.getElementById('home-ring-container');
    ringContainer.innerHTML = slots
      .map((s) => {
        const pct = Math.round((s.booked / CAPACITY) * 100);
        const circumference = 2 * Math.PI * 32;
        const offset = circumference - (pct / 100) * circumference;
        const slotNames = { morning: '上午', afternoon: '下午', evening: '晚间' };
        return `
          <div class="progress-ring">
            <svg width="76" height="76" viewBox="0 0 76 76">
              <circle class="bg-circle" cx="38" cy="38" r="32"></circle>
              <circle class="fg-circle ${s.isFull ? 'full' : ''}" cx="38" cy="38" r="32"
                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
            </svg>
            <div class="ring-text">
              <span class="num">${s.available}</span>
              <span class="lbl">余位</span>
            </div>
          </div>
          <div class="ring-info">
            <div class="slot-status">
              <span class="slot-dot ${s.isFull ? 'full' : ''}"></span>
              <span>${slotNames[s.slot]}</span>
            </div>
            <small style="color:var(--text-secondary)">${s.booked}/${CAPACITY}</small>
          </div>`;
      })
      .join('');

    // 首页作品
    const photos = getPhotos();
    document.getElementById('home-photo-count').textContent = photos.length + ' 张作品';
    const grid = document.getElementById('home-photo-grid');
    if (photos.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">📸</div><p>还没有作品<br>去「我的」页面上传吧～</p></div>';
    } else {
      const display = photos.slice(0, 6);
      grid.innerHTML = display
        .map(
          (p) => `
          <div class="photo-item" onclick="App.previewPhoto('${p.id}')">
            <img src="${p.dataUrl}" alt="${p.title}" loading="lazy">
          </div>`
        )
        .join('');
    }
  }

  // ── 个人中心刷新 ──────────────────────────────
  function refreshProfile() {
    const stats = getUserStats();
    document.getElementById('stat-total-bookings').textContent = stats.totalReservations;
    document.getElementById('stat-monthly-bookings').textContent = stats.monthlyReservations;
    document.getElementById('stat-photos').textContent = stats.totalPhotos;

    // 用户信息
    const user = getUser();
    document.getElementById('input-nickname').value = user.nickname;
    const avatarWrap = document.getElementById('avatar-wrap');
    const avatarEmoji = document.getElementById('avatar-emoji');
    if (user.avatar) {
      avatarEmoji.style.display = 'none';
      let img = avatarWrap.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        avatarWrap.appendChild(img);
      }
      img.src = user.avatar;
    } else {
      avatarEmoji.style.display = '';
      const img = avatarWrap.querySelector('img');
      if (img) img.remove();
    }

    // 预约历史
    renderHistory();
    // 作品墙
    renderProfilePhotos();
  }

  function renderHistory() {
    const container = document.getElementById('history-list');
    const list = getReservations().sort((a, b) => b.date.localeCompare(a.date));
    const slotLabels = { morning: '🌅 上午', afternoon: '☀️ 下午', evening: '🌙 晚间' };

    if (list.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><div class="icon">📭</div><p>还没有预约记录<br>快去首页预约吧～</p></div>';
      return;
    }

    container.innerHTML = list
      .map(
        (r) => {
          const isPast = r.date < getTodayStr();
          return `
          <div class="history-item" style="${isPast ? 'opacity:0.55' : ''}">
            <div class="history-dot" style="background:${isPast ? '#ccc' : 'var(--blue-400)'}"></div>
            <div class="history-info">
              <div class="date">${r.date} ${slotLabels[r.timeSlot] || r.timeSlot}</div>
              <div class="meta">${r.peopleCount}人 · ${r.name} · ${r.phone}</div>
            </div>
          </div>`;
        }
      )
      .join('');
  }

  // ── 照片管理 ──────────────────────────────────
  function triggerPhotoUpload() {
    document.getElementById('photo-file-input').click();
  }

  function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      // Canvas 压缩
      const img = new Image();
      img.onload = function () {
        const maxW = 800;
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        const title = prompt('为你的作品起个名字吧～', '未命名作品') || '未命名作品';

        try {
          addPhoto(dataUrl, title);
          showToast('📸 作品上传成功！', 'success');
          refreshProfile();
          if (state.activeTab === 'home') refreshHome();
        } catch (err) {
          if (err.name === 'QuotaExceededError') {
            showToast('存储空间不足，请删除旧照片', 'error');
          } else {
            showToast('上传失败，请重试', 'error');
          }
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  function deletePhoto(id) {
    if (!confirm('确定要删除这张作品吗？')) return;
    deletePhoto(id);
    showToast('作品已删除', 'info');
    refreshProfile();
    if (state.activeTab === 'home') refreshHome();
  }

  function previewPhoto(id) {
    const photo = getPhotos().find((p) => p.id === id);
    if (!photo) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'preview-backdrop';
    backdrop.innerHTML = `
      <button class="preview-close">✕</button>
      <img src="${photo.dataUrl}" alt="${photo.title}">
      <div style="position:absolute;bottom:30px;left:0;right:0;text-align:center;color:#fff;font-size:16px;font-weight:600;">
        ${photo.title}
      </div>`;
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop || e.target.classList.contains('preview-close')) {
        backdrop.remove();
      }
    });
    document.body.appendChild(backdrop);
  }

  function triggerAvatarUpload() {
    document.getElementById('avatar-file-input').click();
  }

  function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        // 裁剪为中心正方形
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        updateUser({ avatar: dataUrl });
        showToast('头像更新成功！', 'success');
        refreshProfile();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  function renderProfilePhotos() {
    const photos = getPhotos();
    const grid = document.getElementById('profile-photo-grid');
    document.getElementById('profile-photo-count').textContent = photos.length + ' 张';

    const uploadBtn =
      '<button class="upload-card" onclick="App.triggerPhotoUpload()"><span class="plus">+</span><span>添加作品</span></button>';

    if (photos.length === 0) {
      document.getElementById('photo-empty').style.display = '';
      grid.innerHTML =
        uploadBtn +
        '<div class="empty-state" id="photo-empty" style="grid-column:1/-1;"><div class="icon">🎨</div><p>上传你的拼豆作品吧～</p></div>';
    } else {
      grid.innerHTML =
        uploadBtn +
        photos
          .map(
            (p) => `
          <div class="photo-item" onclick="App.previewPhoto('${p.id}')">
            <img src="${p.dataUrl}" alt="${p.title}" loading="lazy">
            <div class="photo-overlay">
              <button class="photo-delete-btn" onclick="event.stopPropagation();App.deletePhoto('${p.id}')">🗑</button>
            </div>
          </div>`
          )
          .join('');
      document.getElementById('photo-empty').style.display = 'none';
    }
  }

  function updateNickname(nickname) {
    if (nickname.trim()) {
      updateUser({ nickname: nickname.trim() });
      showToast('昵称已更新', 'success');
    }
  }

  // ── 清除数据 ──────────────────────────────────
  function clearAllData() {
    if (!confirm('⚠️ 确定要清除所有数据吗？\n这包括所有预约记录和作品照片。此操作不可恢复！')) return;
    if (!confirm('再次确认：清除所有数据？')) return;
    localStorage.clear();
    showToast('所有数据已清除', 'info');
    state.selectedDate = null;
    state.selectedSlot = null;
    state.selectedPeople = 1;
    state.isMultiPeople = false;
    switchTab('home');
  }

  // ── 工具函数 ──────────────────────────────────
  function getTodayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ── 日期选择器初始化 ──────────────────────────
  function initDatePicker() {
    const container = document.getElementById('date-scroll');
    const today = new Date();
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    let html = '';

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr =
        d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const isToday = i === 0;
      const dayName = isToday ? '今天' : '周' + dayNames[d.getDay()];
      const isPast = i < 0;

      html += `
        <button class="date-chip ${isPast ? 'past' : ''} ${state.selectedDate === dateStr ? 'selected' : ''}"
                data-date="${dateStr}" onclick="App.selectDate('${dateStr}')">
          <span class="day-name">${dayName}</span>
          <span class="day-num">${d.getDate()}</span>
        </button>`;
    }

    container.innerHTML = html;

    // 默认选中今天
    if (!state.selectedDate) {
      selectDate(getTodayStr());
    }
  }

  // ── Service Worker 注册 ────────────────────────
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // 静默失败，离线缓存非必需
      });
    }
  }

  // ── 初始化 ─────────────────────────────────────
  function init() {
    // 如果今天还没到，清除 selectedDate
    state.selectedDate = null;
    registerSW();
    refreshHome();
    initDatePicker();

    // 监听 localStorage 变化（跨标签页同步）
    window.addEventListener('storage', () => {
      if (state.activeTab === 'home') refreshHome();
      if (state.activeTab === 'booking') {
        updateCapacityBar();
        renderBookingList();
      }
      if (state.activeTab === 'profile') refreshProfile();
    });
  }

  // ── 公开 API ──────────────────────────────────
  return {
    init,
    switchTab,
    showToast,
    selectDate,
    selectTimeSlot,
    selectPeople,
    adjustMultiPeople,
    submitBooking,
    cancelBooking,
    triggerPhotoUpload,
    handlePhotoUpload,
    handleAvatarUpload,
    triggerAvatarUpload,
    deletePhoto,
    previewPhoto,
    updateNickname,
    clearAllData,
    refreshHome,
    refreshProfile,
    updateCapacityBar,
    renderBookingList,
    initDatePicker,
  };
})();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
