/*
  GymNow Core Logic
  - SPA Navigation
  - State Management
  - Firebase Real-time Integration
  Version 2.8 (Stability & Premium Card UI)
*/

import {
  db, collection, onSnapshot, query, orderBy,
  getDoc, doc, getDocs, where, addDoc,
  serverTimestamp, limit, signInWithPopup
} from './firebase-config.js?v=3.7';

// Global error handling
window.addEventListener('error', (e) => {
  console.error('Runtime Error:', e.message);
  if (window.showToast) {
    showToast(`에러 발생: ${e.message}`, 'error');
  }
});

/**
 * Initialization
 */
function init() {
  console.log('GymNow v3.5 (KakaoTalk Fix) Initializing...');
  initNavigation();
  initDetailEvents();
  initModalEvents();
  if (window.lucide) {
    lucide.createIcons();
  }

  // High-End Splash Screen Flow
  const splash = document.getElementById('view-splash');
  if (splash) {
    setTimeout(() => {
      splash.style.opacity = '0';
      setTimeout(() => {
        splash.classList.remove('active');
        // If first visit, show intro. If not, maybe home (can be expanded later)
        switchView('view-intro');
      }, 1000); // Wait for fade transition
    }, 2000); // Visible for 2 seconds
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

let currentActiveGymId = null;

/**
 * SPA Navigation
 */
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const startBtn = document.getElementById('btn-start');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      switchView(target);
    });
  });

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      switchView('view-region-select');
    });
  }
}

function initDetailEvents() {
  const backBtn = document.getElementById('btn-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      switchView('view-home');
    });
  }
}

function initModalEvents() {
  const modal = document.getElementById('modal-consultation');
  const closeBtn = modal ? modal.querySelector('.modal-close') : null;
  const form = document.getElementById('form-consultation');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
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
        if (!currentActiveGymId) throw new Error('센터 정보가 유실되었습니다.');

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
        showToast(`오류 발생: ${error.message}`, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = '상담 신청 (에스크로 보호)';
        }
      }
    });
  }
}

/**
 * Switch View
 */
function switchView(viewId) {
  const views = document.querySelectorAll('.view');
  const targetView = document.getElementById(viewId);
  if (!targetView) return;
  views.forEach(v => v.classList.remove('active'));
  targetView.classList.add('active');
  window.scrollTo(0, 0);
  setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 100);

  if (viewId === 'view-home') {
    renderEarlyVerifiedTrainers().catch((error) => {
      handleHomeRenderCrash('early-verified-scroll', '최우수 전문가', error);
    });
    renderGymList().catch((error) => {
      handleHomeRenderCrash('gym-list', '참여 센터', error);
    });
  }
  if (viewId === 'view-admin') renderAdminDashboard();

  // Single source of truth for nav active state
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach((btn) => btn.classList.remove('active'));
  const navTargetByView = {
    'view-intro': 'view-intro',
    'view-home': 'view-home',
    'view-gym-detail': 'view-home',
    'view-trainer-detail': 'view-home',
    'view-profile': 'view-profile',
    'view-admin': 'view-profile'
  };
  const navTarget = navTargetByView[viewId];
  if (navTarget) {
    const activeBtn = document.querySelector(`.nav-btn[data-target="${navTarget}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  // Bottom Navigation Visibility Control
  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) {
    const viewsWithNav = ['view-home', 'view-profile', 'view-admin', 'view-gym-detail', 'view-trainer-detail'];
    if (viewsWithNav.includes(viewId)) {
      bottomNav.classList.add('nav-visible');
    } else {
      bottomNav.classList.remove('nav-visible');
    }
  }
}

/**
 * Gym List (Live Data)
 */
async function renderGymList() {
  const container = document.getElementById('gym-list');
  if (!container) return;
  renderHomeLoadingState(container, '🏙️ 대구 참여 센터 로딩 중...');
  const timeoutId = startHomeLoadTimeout(container, '참여 센터');

  try {
    console.log('Fetching gyms from Firestore...');
    const q = query(collection(db, 'gyms'), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    const gyms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Fetched ${gyms.length} gyms`);

    if (gyms.length === 0) {
      renderHomeEmptyState(container, '대구 지역 참여 센터 정보 준비 중...');
      return;
    }

    const banner = document.getElementById('recruitment-banner');
    if (banner) {
      banner.innerText = `대구 파일럿 참여 센터 (${gyms.filter(g => g.isPilot).length}/5)`;
    }

    container.innerHTML = gyms.map(gym => `
      <div class="gym-card" onclick="window.showGymDetail('${gym.id}')">
        <div class="gym-card-image" style="background-image: url('${gym.imageUrl}')">
          ${gym.isPilot ? '<div class="pilot-badge">💎 GymNow Pilot</div>' : ''}
        </div>
        <div class="gym-card-content">
          <div class="gym-card-header">
            <h3 class="gym-card-name">${gym.name}</h3>
            <span class="status-badge status-safe">상담가능</span>
          </div>
          <div class="gym-card-area">${gym.region}</div>
          <div class="gym-card-footer">
            <div class="footer-item"><i data-lucide="users"></i> 전문가 ${gym.trainerCount || 0}명</div>
            <div class="footer-item"><i data-lucide="shield-check"></i> 안심정산</div>
          </div>
        </div>
      </div>
    `).join('');
    markHomeLoadResolved(container);

    if (window.lucide) lucide.createIcons();
  } catch (error) {
    console.error('Gym List Error:', error);
    const alreadyTimedOut = container.dataset.loadState === 'error' && container.dataset.loadSource === 'timeout';
    renderHomeErrorState(container, getHomeLoadErrorMessage(error), 'fetch');
    if (!alreadyTimedOut) {
      safeShowToast('데이터 로드 실패: 참여 센터를 불러오지 못했습니다.', 'error');
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Trainers in Gym
 */
async function renderTrainersInGym(gymId) {
  const container = document.getElementById('gym-trainer-list');
  if (!container) return;

  try {
    console.log(`Fetching trainers for gym: ${gymId}`);
    const q = query(collection(db, 'trainers'), where('gymId', '==', gymId));
    const snapshot = await getDocs(q);
    const filtered = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Fetched ${filtered.length} trainers for gym`);

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">검증 전문가 등록 준비 중...</div>';
      return;
    }

    container.innerHTML = filtered.map(trainer => `
      <div class="trainer-card" onclick="window.showTrainerDetail('${trainer.id}')">
        <div class="trainer-photo" style="background-image: url('${trainer.photoUrl || trainer.photoURL}')"></div>
        <div class="trainer-card-info">
          <h3 class="trainer-name">${trainer.name} 트레이너</h3>
          <div class="trainer-specialty">${trainer.specialty}</div>
          <div class="trust-badge-row">
            ${trainer.isEarlyVerified ? '<span class="trust-tag tag-early"><i data-lucide="gem"></i> Early Verified</span>' : ''}
            <span class="trust-tag tag-verified"><i data-lucide="badge-check"></i> 자격인증</span>
          </div>
        </div>
        <div class="trust-score-container">
          <span class="trust-score-label">TRUST</span>
          <span class="trust-score-value">${trainer.trustScore}</span>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  } catch (error) {
    console.error('Trainers Fetch Error:', error);
    container.innerHTML = '<div class="empty-state">전문가 정보 준비 중...</div>';
  }
}

/**
 * Show Gym Detail
 */
async function showGymDetail(gymId) {
  if (!gymId || gymId === 'undefined') {
    console.error('Invalid gymId provided to showGymDetail');
    showToast('유효하지 않은 센터 정보입니다.', 'error');
    return;
  }

  const container = document.getElementById('gym-detail-content');
  if (!container) return;
  currentActiveGymId = gymId;

  switchView('view-gym-detail');
  window.scrollTo(0, 0);

  container.innerHTML = '<div class="loading-spinner">✨ 센터 정보를 불러오는 중...</div>';

  try {
    console.log(`Fetching gym detail from Firestore for ID: ${gymId}`);
    const gymRef = doc(db, 'gyms', gymId);
    const gymDoc = await getDoc(gymRef);

    if (!gymDoc.exists()) {
      console.error(`Gym with ID ${gymId} not found in Firestore`);
      throw new Error('센터 정보를 찾을 수 없습니다.');
    }

    const gym = gymDoc.data();
    console.log('Successfully fetched gym detail:', gym.name);

    container.innerHTML = `
      <div class="detail-hero" style="background-image: url('${gym.imageUrl}')"></div>
      <div class="detail-info-main">
        <h2 class="detail-name">${gym.name}</h2>
        <div class="gym-card-area" style="font-size: 16px; margin-top: 4px;">📍 ${gym.region}</div>
        <p class="detail-desc" style="margin-top: 20px;">${gym.description || gym.desc || '센터 소개 준비 중입니다.'}</p>
      </div>
    `;

    renderTrainersInGym(gymId);
  } catch (error) {
    console.error('Gym Detail Critical Error:', error);
    container.innerHTML = `<div class="empty-state">상세 정보 준비 중입니다.</div>`;
    showToast('정보 준비 중...', 'info');
  }
}

/**
 * Show Trainer Detail
 */
async function showTrainerDetail(trainerId) {
  if (!trainerId || trainerId === 'undefined') {
    showToast('유효하지 않은 전문가 정보입니다.', 'error');
    return;
  }

  const container = document.getElementById('trainer-detail-content');
  if (!container) return;

  switchView('view-trainer-detail');
  window.scrollTo(0, 0);

  const backBtn = document.getElementById('btn-back-trainer');
  if (backBtn) {
    backBtn.onclick = () => window.switchView('view-home');
  }

  container.innerHTML = '<div class="loading-spinner">✨ 전문가 프로필을 불러오는 중...</div>';

  try {
    console.log(`Fetching trainer detail from Firestore for ID: ${trainerId}`);
    const trainerDoc = await getDoc(doc(db, 'trainers', trainerId));
    if (!trainerDoc.exists()) throw new Error('전문가 정보를 찾을 수 없습니다.');
    const trainer = trainerDoc.data();

    container.innerHTML = `
      <div class="detail-hero" style="background-image: url('${trainer.photoUrl || trainer.photoURL || 'https://i.pravatar.cc/150?u=' + trainer.name}')"></div>
      <div class="detail-info-main">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <h2 class="detail-name">${trainer.name} 트레이너</h2>
            <div class="trainer-specialty" style="font-size: 16px; margin-top: 4px;">${trainer.specialty || '퍼스널 트레이닝'}</div>
          </div>
          <div class="trust-score-container" style="position: static; padding: 10px 20px;">
            <span class="trust-score-label">TRUST SCORE</span>
            <span class="trust-score-value" style="font-size: 20px;">${trainer.trustScore || '9.0'}</span>
          </div>
        </div>
        
        <div class="trust-badge-row" style="margin-top: 16px; gap: 10px;">
          <span class="trust-tag tag-verified" style="font-size: 12px; padding: 6px 12px;"><i data-lucide="badge-check"></i> 국가공인 자격 인증</span>
          <span class="trust-tag tag-escrow" style="font-size: 12px; padding: 6px 12px;"><i data-lucide="shield-check"></i> 안심 정산 파트너</span>
        </div>
      </div>

      <div class="detail-section">
        <h3 class="detail-section-title">전문가 소개</h3>
        <p class="detail-desc">${trainer.description || '반갑습니다. 회원님의 건강한 성장을 돕는 트레이너입니다.'}</p>
      </div>

      <div class="detail-section">
        <h3 class="detail-section-title">안심 결제 프로세스</h3>
        <div class="escrow-flow" style="margin-top: 16px;">
          <div class="flow-step active"><i data-lucide="circle-check"></i> 1. 결제 완료 (에스크로 보관)</div>
          <div class="flow-step"><i data-lucide="circle"></i> 2. PT 수업 진행 (체크인)</div>
          <div class="flow-step"><i data-lucide="circle"></i> 3. 1회차 완료 (상호 확인)</div>
          <div class="flow-step"><i data-lucide="circle"></i> 4. 대금 지급 (트레이너 정산)</div>
        </div>
      </div>

      <div class="detail-actions" style="margin-top: 40px;">
        <button class="btn-primary" onclick="window.openConsultationModal('${trainer.gymId || ''}')">안심 상담 신청하기</button>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  } catch (error) {
    console.error('Trainer Detail Error:', error);
    showToast('전문가 정보를 불러오지 못했습니다.', 'error');
  }
}

/**
 * Early Verified Slider
 */
async function renderEarlyVerifiedTrainers() {
  const container = document.getElementById('early-verified-scroll');
  if (!container) return;
  renderHomeLoadingState(container, '최우수 전문가 로드 중...');
  const timeoutId = startHomeLoadTimeout(container, '최우수 전문가');

  try {
    const q = query(
      collection(db, 'trainers'),
      where('isEarlyVerified', '==', true),
      limit(10)
    );
    const snapshot = await getDocs(q);
    let trainers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    trainers.sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0));

    if (trainers.length === 0) {
      renderHomeEmptyState(container, '최우수 전문가 매칭 준비 중...');
      return;
    }

    container.innerHTML = trainers.map(trainer => `
      <div class="partner-slide" onclick="window.showTrainerDetail('${trainer.id}')">
        <div class="partner-avatar" style="background-image: url('${trainer.photoUrl || trainer.photoURL || 'https://i.pravatar.cc/150?u=' + trainer.name}')"></div>
        <div class="partner-info">
          <h4>${trainer.name}</h4>
          <p>${trainer.specialty}</p>
        </div>
      </div>
    `).join('');
    markHomeLoadResolved(container);
  } catch (error) {
    console.error('Early Trainers Error:', error);
    const alreadyTimedOut = container.dataset.loadState === 'error' && container.dataset.loadSource === 'timeout';
    renderHomeErrorState(container, getHomeLoadErrorMessage(error), 'fetch');
    if (!alreadyTimedOut) {
      safeShowToast('데이터 로드 실패: 최우수 전문가를 불러오지 못했습니다.', 'error');
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Admin Dashboard
 */
async function renderAdminDashboard() {
  const container = document.getElementById('application-list');
  const statTotal = document.getElementById('stat-total');
  if (!container) return;

  try {
    const qUser = query(collection(db, 'applications'), orderBy('createdAt', 'desc'), limit(20));
    const qPartner = query(collection(db, 'partner_applications'), orderBy('createdAt', 'desc'), limit(20));

    const [userSnap, partnerSnap] = await Promise.all([getDocs(qUser), getDocs(qPartner)]);
    const allApps = [
      ...userSnap.docs.map(doc => ({ id: doc.id, category: 'consult', ...doc.data() })),
      ...partnerSnap.docs.map(doc => ({ id: doc.id, category: 'partner', ...doc.data() }))
    ].sort((a, b) => {
      const dbA = a.createdAt?.seconds || 0;
      const dbB = b.createdAt?.seconds || 0;
      return dbB - dbA;
    });

    if (statTotal) statTotal.innerText = allApps.length;

    container.innerHTML = allApps.map(app => {
      const date = app.createdAt ? new Date(app.createdAt.seconds * 1000).toLocaleString('ko-KR') : '방금 전';
      const isPartner = app.category === 'partner';
      return `
        <div class="app-card ${isPartner ? 'card-partner' : ''}">
          <div class="app-info">
             <div class="app-header-row">
               <div class="app-user">${app.name || app.userName || '익명'}</div>
               <span class="badge-${isPartner ? (app.type || 'gym') : 'consult'}">${isPartner ? '가맹신청' : '상담신청'}</span>
             </div>
             <div class="app-gym">📍 ${isPartner ? app.area : app.gymId}</div>
             <div class="app-time">${date}</div>
          </div>
          <a href="tel:${app.phone || app.userPhone}" class="app-phone-btn">📞</a>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Admin Error:', error);
    container.innerHTML = `<div class="empty-state">데이터 로드 실패: ${error.message}</div>`;
  }
}

/**
 * Helpers
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function safeShowToast(message, type = 'info') {
  if (typeof showToast === 'function') {
    showToast(message, type);
  }
}

function renderHomeLoadingState(container, message) {
  if (!container) return;
  container.dataset.loadState = 'loading';
  container.dataset.loadSource = 'initial';
  container.innerHTML = `<div class="loading-spinner">${message}</div>`;
}

function renderHomeEmptyState(container, message) {
  if (!container) return;
  container.dataset.loadState = 'empty';
  container.dataset.loadSource = 'fetch';
  container.innerHTML = `<div class="empty-state">${message}</div>`;
}

function renderHomeErrorState(container, reason, source = 'fetch') {
  if (!container) return;
  container.dataset.loadState = 'error';
  container.dataset.loadSource = source;
  container.innerHTML = `
    <div class="empty-state">
      <div style="font-weight: 700;">데이터 로드 실패</div>
      <div style="margin-top: 8px;">${reason}</div>
      <button class="btn-primary" style="margin-top: 14px;" onclick="window.switchView('view-home')">새로고침</button>
    </div>
  `;
}

function markHomeLoadResolved(container) {
  if (!container) return;
  container.dataset.loadState = 'ready';
  container.dataset.loadSource = 'fetch';
}

function getHomeLoadErrorMessage(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  if (code.includes('permission-denied') || message.includes('permission')) {
    return '접근 권한이 없어 데이터를 가져오지 못했습니다.';
  }
  if (code.includes('unavailable') || code.includes('network') || message.includes('offline') || message.includes('network')) {
    return '네트워크 연결을 확인한 뒤 다시 시도해주세요.';
  }
  return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

function startHomeLoadTimeout(container, sectionName) {
  return window.setTimeout(() => {
    if (!container || container.dataset.loadState !== 'loading') return;
    renderHomeErrorState(
      container,
      `${sectionName} 데이터 응답이 지연되고 있습니다. 새로고침으로 다시 시도해주세요.`,
      'timeout'
    );
    safeShowToast(`${sectionName} 데이터 로드가 지연되고 있습니다.`, 'error');
  }, 5000);
}

function handleHomeRenderCrash(containerId, sectionName, error) {
  console.error(`${sectionName} Render Crash:`, error);
  const container = document.getElementById(containerId);
  renderHomeErrorState(container, getHomeLoadErrorMessage(error), 'render');
  safeShowToast(`데이터 로드 실패: ${sectionName} 화면을 구성하지 못했습니다.`, 'error');
}

function openConsultationModal(gymId) {
  if (gymId) currentActiveGymId = gymId;
  const modal = document.getElementById('modal-consultation');
  if (modal) modal.classList.add('active');
}

function openBenefitsModal() {
  const modal = document.getElementById('modal-benefits');
  if (modal) modal.classList.add('active');
}

function openRefundModal() {
  const modal = document.getElementById('modal-refund');
  if (modal) modal.classList.add('active');
}

function calculateRefund() {
  const totalPrice = Number(document.getElementById('refund-total-price')?.value || 0);
  const totalSessions = Number(document.getElementById('refund-total-sessions')?.value || 0);
  const remainingSessions = Number(document.getElementById('refund-remaining-sessions')?.value || 0);

  if (!totalPrice || !totalSessions || remainingSessions < 0) {
    showToast('환불 계산 값을 정확히 입력해주세요.', 'error');
    return;
  }

  if (remainingSessions > totalSessions) {
    showToast('남은 회차는 총 회차보다 클 수 없습니다.', 'error');
    return;
  }

  const perSession = totalPrice / totalSessions;
  const refundableAmount = Math.max(0, perSession * remainingSessions);
  const penalty = Math.floor(refundableAmount * 0.1);
  const finalRefund = Math.floor(Math.max(0, refundableAmount - penalty));

  const result = document.getElementById('refund-result');
  const penaltyEl = document.getElementById('res-penalty');
  const finalEl = document.getElementById('res-final');
  if (!result || !penaltyEl || !finalEl) return;

  penaltyEl.innerText = `${penalty.toLocaleString('ko-KR')}원`;
  finalEl.innerText = `${finalRefund.toLocaleString('ko-KR')}원`;
  result.style.display = 'block';
}

function openPartnerModal(type) {
  const modal = document.getElementById('modal-partner');
  const typeInput = document.getElementById('partner-type');
  const title = document.getElementById('partner-modal-title');
  if (modal && typeInput && title) {
    typeInput.value = type;
    title.innerText = type === 'gym' ? '참여 센터 가맹 신청' : '검증 트레이너 등록 신청';
    modal.classList.add('active');
  }
}

async function handlePartnerSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('btn-submit-partner');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = '제출 중...'; }

  try {
    await addDoc(collection(db, 'partner_applications'), {
      type: document.getElementById('partner-type').value,
      name: document.getElementById('partner-name').value,
      phone: document.getElementById('partner-phone').value,
      area: document.getElementById('partner-area').value,
      message: document.getElementById('partner-msg').value,
      feedback: document.getElementById('partner-feedback').value,
      createdAt: serverTimestamp()
    });
    showToast('🎉 가맹 신청이 완료되었습니다!', 'success');
    document.getElementById('modal-partner').classList.remove('active');
    e.target.reset();
  } catch (error) {
    showToast(`제출 실패: ${error.message}`, 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = '가맹 신청서 제출'; }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const partnerForm = document.getElementById('form-partner');
  if (partnerForm) partnerForm.addEventListener('submit', handlePartnerSubmit);
});

function selectRegion(regionId) {
  if (regionId === 'daegu') {
    showToast('📍 대구 파일럿 지역으로 입장합니다.', 'success');
    switchView('view-home');
    const headline = document.querySelector('.main-headline');
    if (headline) headline.innerText = '대구 검증 전문가 찾기';
  }
}

window.showTrainerDetail = showTrainerDetail;
window.showGymDetail = showGymDetail;
window.openConsultationModal = openConsultationModal;
window.openBenefitsModal = openBenefitsModal;
window.openRefundModal = openRefundModal;
window.calculateRefund = calculateRefund;
window.selectRegion = selectRegion;
window.switchView = switchView;
window.openPartnerModal = openPartnerModal;
window.showToast = showToast;

console.log('GymNow v3.6 (PWA) Online 🚀');

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('SW: Registered', reg))
      .catch(err => console.log('SW: Failed', err));
  });
}
