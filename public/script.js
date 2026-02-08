/*
  GymNow Core Logic
  - SPA Navigation
  - State Management
  - Firebase Real-time Integration
*/

import { db, collection, onSnapshot, query, orderBy, signInWithPopup } from './firebase-config.js';
import { getDoc, doc, getDocs, where, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// Global error handling to catch module load issues
window.addEventListener('error', (e) => {
  console.error('Runtime Error:', e.message);
  if (typeof showToast === 'function') {
    showToast(`에러 발생: ${e.message}`, 'error');
  }
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled Promise Rejection:', e.reason);
});

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initDetailEvents();
  initModalEvents();
});

/**
 * Global Gym ID state for consultation
 */
let currentActiveGymId = null;

/**
 * SPA Navigation System
 */
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view');
  const startBtn = document.getElementById('btn-start');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      switchView(target);
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      switchView('view-home');
      const homeNav = document.querySelector('[data-target="view-home"]');
      if (homeNav) {
        navButtons.forEach(b => b.classList.remove('active'));
        homeNav.classList.add('active');
      }
    });
  }
}

/**
 * Handle events for the Detail View
 */
function initDetailEvents() {
  const backBtn = document.getElementById('btn-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      switchView('view-home');
      const homeNav = document.querySelector('.nav-btn[data-target="view-home"]');
      if (homeNav) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        homeNav.classList.add('active');
      }
    });
  }
}

/**
 * Handle events for Modal
 */
function initModalEvents() {
  const modal = document.getElementById('modal-consultation');
  const closeBtn = document.querySelector('.modal-close');
  const form = document.getElementById('form-consultation');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-consult');
      const name = document.getElementById('user-name').value;
      const phone = document.getElementById('user-phone').value;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = '✉️ 전송 중...';
      }

      try {
        if (!currentActiveGymId) {
          throw new Error('센터 정보가 유실되었습니다. 다시 시도해 주세요.');
        }

        await addDoc(collection(db, 'applications'), {
          gymId: currentActiveGymId,
          userName: name,
          userPhone: phone,
          createdAt: serverTimestamp(),
          status: 'pending'
        });

        showToast('🚀 상담 신청이 완료되었습니다!', 'success');
        modal.classList.remove('active');
        form.reset();
      } catch (error) {
        console.error('Submission error:', error);
        showToast(`오류가 발생했습니다: ${error.message}`, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = '지금 신청하기';
        }
      }
    });
  }
}

/**
 * Switch between views
 */
function switchView(viewId) {
  const views = document.querySelectorAll('.view');
  const targetView = document.getElementById(viewId);
  if (!targetView) return;
  views.forEach(v => v.classList.remove('active'));
  targetView.classList.add('active');
  window.scrollTo(0, 0);
  if (viewId === 'view-home') renderGymList();
}

/**
 * Render Gym List
 */
function renderGymList() {
  const container = document.getElementById('gym-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner">✨ 정보를 가져오는 중...</div>';
  const q = query(collection(db, 'gyms'), orderBy('name', 'asc'));
  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      container.innerHTML = '<div class="empty-state">등록된 헬스장이 없습니다.</div>';
      return;
    }
    container.innerHTML = snapshot.docs.map(doc => {
      const gym = doc.data();
      const id = doc.id;
      return `
        <div class="gym-card" data-id="${id}">
          <div class="gym-card-image" style="background-image: url('${gym.photoURL || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400'}')"></div>
          <div class="gym-card-content">
            <div class="gym-card-header">
              <h3 class="gym-card-name">${gym.name}</h3>
              <span class="status-badge status-${gym.status || 'safe'}">${gym.occupancy || '여유'}</span>
            </div>
            <div class="gym-card-area">${gym.area || ''}</div>
            <div class="gym-card-footer">
              <div class="footer-item">⭐ ${gym.rating || '0.0'}</div>
              <div class="footer-item">💪 센터 정보</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
    container.querySelectorAll('.gym-card').forEach(card => {
      card.addEventListener('click', () => showGymDetail(card.getAttribute('data-id')));
    });
  });
}

/**
 * Show gym detail
 */
async function showGymDetail(gymId) {
  currentActiveGymId = gymId;
  const container = document.getElementById('detail-content');
  if (!container) return;
  switchView('view-detail');
  container.innerHTML = '<div class="loading-spinner">✨ 상세 정보를 불러오는 중...</div>';
  try {
    const gymDoc = await getDoc(doc(db, 'gyms', gymId));
    if (!gymDoc.exists()) {
      showToast('정보를 찾을 수 없습니다.', 'error');
      switchView('view-home');
      return;
    }
    const gym = gymDoc.data();
    const trainersQuery = query(collection(db, 'trainers'), where('gymId', '==', gymId));
    const trainersSnap = await getDocs(trainersQuery);
    const trainers = trainersSnap.docs.map(d => d.data());
    container.innerHTML = `
      <div class="detail-hero" style="background-image: url('${gym.photoURL || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=600'}')"></div>
      <div class="detail-info-main">
        <h2 class="detail-name">${gym.name}</h2>
        <div class="detail-meta">
          <span class="status-badge status-${gym.status || 'safe'}">${gym.occupancy || '여유'}</span>
          <span class="score">⭐ ${gym.rating || '0.0'}</span>
        </div>
        <p class="detail-desc">${gym.description || '준비 중입니다.'}</p>
      </div>
      <div class="detail-section">
        <h3 class="detail-section-title">보유 기구</h3>
        <div class="equipment-tags">
          ${(gym.equipment || ['런닝머신', '파워랙']).map(item => `<span class="tag">${item}</span>`).join('')}
        </div>
      </div>
      <div class="detail-section">
        <h3 class="detail-section-title">소속 트레이너</h3>
        <div class="trainer-list">
          ${trainers.length > 0 ? trainers.map(t => `
            <div class="trainer-card">
              <div class="trainer-avatar" style="background-image: url('${t.photoURL || 'https://i.pravatar.cc/150?u=' + t.name}')"></div>
              <div class="trainer-info"><h4>${t.name} 트레이너</h4><p>${t.specialty || 'PT'}</p></div>
            </div>
          `).join('') : '<p class="empty-text">등록된 트레이너가 없습니다.</p>'}
        </div>
      </div>
      <div class="detail-actions" style="margin-top: 40px;">
        <button class="btn-primary" onclick="window.openConsultationModal()">상담 신청하기</button>
      </div>
    `;
  } catch (error) {
    showToast('에러가 발생했습니다.', 'error');
  }
}

/**
 * Open Modal
 */
function openConsultationModal() {
  const modal = document.getElementById('modal-consultation');
  if (modal) modal.classList.add('active');
}

/**
 * Toast
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

window.showToast = showToast;
window.showGymDetail = showGymDetail;
window.openConsultationModal = openConsultationModal;
console.log('GymNow MVP Script v1.5 Loaded');
