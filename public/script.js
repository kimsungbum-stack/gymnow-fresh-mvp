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
  initTrainerReviewEvents();
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
let currentReviewTrainerId = null;

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

function initTrainerReviewEvents() {
  const form = document.getElementById('form-trainer-review');
  if (!form || form.dataset.bound === 'true') return;
  form.addEventListener('submit', handleTrainerReviewSubmit);
  form.dataset.bound = 'true';
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

  // Keep admin view hidden by default and reveal only on explicit admin navigation
  const adminView = document.getElementById('view-admin');
  if (adminView) {
    adminView.hidden = viewId !== 'view-admin';
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
    const mockTrainers = [
      {
        id: 'mock-trainer-1',
        gymId,
        name: '김트레이너',
        specialty: '퍼스널 트레이닝',
        trustScore: 95,
        isEarlyVerified: true
      },
      {
        id: 'mock-trainer-2',
        gymId,
        name: '이코치',
        specialty: '체형 교정',
        trustScore: 72,
        isEarlyVerified: false
      },
      {
        id: 'mock-trainer-3',
        gymId,
        name: '박헬스',
        specialty: '기초 체력 향상',
        trustScore: null,
        isEarlyVerified: false
      }
    ];
    const sourceTrainers = filtered.length > 0 ? filtered : mockTrainers;
    if (filtered.length === 0) {
      console.log('Using mock trainer data (dev only)');
    }

    const sorted = sourceTrainers
      .map((trainer) => ({ ...trainer, trustMeta: getTrustScoreMeta(trainer.trustScore) }))
      .sort((a, b) => {
        if (a.trustMeta.hasScore !== b.trustMeta.hasScore) return a.trustMeta.hasScore ? -1 : 1;
        if (!a.trustMeta.hasScore) return 0;
        return b.trustMeta.score - a.trustMeta.score;
      });
    console.log(`Fetched ${sorted.length} trainers for gym`);
    console.log('Trainer sort order:', sorted.map(t => `${t.name}:${t.trustMeta.hasScore ? t.trustMeta.score : '준비중'}`).join(', '));

    if (sorted.length === 0) {
      container.innerHTML = '<div class="empty-state">검증 전문가 등록 준비 중...</div>';
      return;
    }

    container.innerHTML = `
      <div class="gym-card-area" style="font-size: 12px; margin-bottom: 8px; padding: 0 4px;">
        정렬: Trust Score 높은 순 (대구 기준)
      </div>
      ${sorted.map(trainer => `
      <div class="trainer-card" onclick="window.showTrainerDetail('${trainer.id}')">
        <div class="trainer-photo" style="background-image: url('${trainer.photoUrl || trainer.photoURL}')"></div>
        <div class="trainer-card-info">
          <h3 class="trainer-name">${trainer.name} 트레이너</h3>
          <div class="trainer-specialty">${trainer.specialty}</div>
          <div class="trust-badge-row">
            ${trainer.isEarlyVerified ? '<span class="trust-tag tag-early"><i data-lucide="gem"></i> Early Verified</span>' : ''}
            <span class="trust-tag tag-verified"><i data-lucide="badge-check"></i> 자격인증</span>
            <span
              class="status-badge ${trainer.trustMeta.hasScore ? trainer.trustMeta.riskClass : ''}"
              style="${trainer.trustMeta.hasScore ? 'font-size:12px; padding:5px 10px;' : 'font-size:12px; padding:5px 10px; background:#e2e8f0; color:#475569;'}"
            >Risk Level: ${trainer.trustMeta.riskLabel}</span>
          </div>
          <div style="margin-top: 6px; font-size: 11px; color: var(--text-muted); line-height: 1.45;">
            ${getTrainerRiskDescriptions(trainer, trainer.trustMeta).join('<br>')}
          </div>
        </div>
        <div class="trust-score-container">
          <span class="trust-score-label">TRUST SCORE</span>
          ${trainer.trustMeta.hasScore
            ? `<span class="trust-score-value">${trainer.trustMeta.score}점</span>`
            : `<span class="trust-score-value" style="font-size: 12px; color: #94a3b8;">Trust Score 준비중</span>`
          }
        </div>
      </div>
    `).join('')}
    `;

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

    const gymTrustMeta = getTrustScoreMeta(gym.trustScore);

    container.innerHTML = `
      <div class="detail-hero" style="background-image: url('${gym.imageUrl}')"></div>
      <div class="detail-info-main">
        <h2 class="detail-name">${gym.name}</h2>
        <div class="trust-score-container" style="position: static; margin-top: 12px; align-items: flex-start; background: var(--bg-soft); color: var(--text-main);">
          <span class="trust-score-label">TRUST SCORE</span>
          ${gymTrustMeta.hasScore
            ? `<span class="trust-score-value" style="font-size: 34px; line-height: 1;">${gymTrustMeta.score}</span>
               <div style="margin-top: 8px;">
                 <span class="status-badge ${gymTrustMeta.riskClass}">Risk Level: ${gymTrustMeta.riskLabel}</span>
               </div>`
            : `<span class="trust-score-value" style="font-size: 20px; color: #94a3b8;">Trust Score 준비중</span>`
          }
          <div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">📍 대구 기준</div>
        </div>
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
  const reviewSummary = document.getElementById('trainer-review-summary');
  const reviewList = document.getElementById('trainer-review-list');
  const reviewTrainerIdInput = document.getElementById('review-trainer-id');

  switchView('view-trainer-detail');
  window.scrollTo(0, 0);

  const backBtn = document.getElementById('btn-back-trainer');
  if (backBtn) {
    backBtn.onclick = () => window.switchView('view-home');
  }

  container.innerHTML = '<div class="loading-spinner">✨ 전문가 프로필을 불러오는 중...</div>';
  if (reviewSummary) reviewSummary.innerText = '리뷰 요약 준비 중...';
  if (reviewList) reviewList.innerHTML = '<div class="loading-spinner">리뷰 데이터를 불러오는 중...</div>';
  setTrainerReviewStatus('');
  currentReviewTrainerId = trainerId;
  if (reviewTrainerIdInput) reviewTrainerIdInput.value = trainerId;

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

    await loadTrainerReviews(trainerId);
    if (window.lucide) lucide.createIcons();
  } catch (error) {
    console.error('Trainer Detail Error:', error);
    showToast('전문가 정보를 불러오지 못했습니다.', 'error');
    setTrainerReviewStatus('리뷰 데이터를 불러오지 못했습니다.', 'error');
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

function setTrainerReviewStatus(message, type = 'info') {
  const statusEl = document.getElementById('trainer-review-status');
  if (!statusEl) return;
  statusEl.innerText = message || '';

  if (!message) {
    statusEl.style.color = '';
    return;
  }

  if (type === 'error') {
    statusEl.style.color = 'var(--error)';
  } else if (type === 'success') {
    statusEl.style.color = 'var(--success)';
  } else {
    statusEl.style.color = 'var(--text-muted)';
  }
}

function getReviewCreatedAtMs(review) {
  const createdAt = review?.createdAt;
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (typeof createdAt.seconds === 'number') return createdAt.seconds * 1000;
  const parsed = Date.parse(createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatReviewDate(review) {
  const ms = getReviewCreatedAtMs(review);
  if (!ms) return '시간 미기록';
  return new Date(ms).toLocaleString('ko-KR');
}

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTrainerReviewSummary(reviews) {
  const summaryEl = document.getElementById('trainer-review-summary');
  if (!summaryEl) return;

  const ratings = reviews
    .map((review) => Number(review.rating))
    .filter((rating) => Number.isFinite(rating));
  const reviewCount = reviews.length;
  const ratingCount = ratings.length;
  const avg = ratingCount > 0
    ? ratings.reduce((sum, value) => sum + value, 0) / ratingCount
    : 0;
  const variance = ratingCount > 0
    ? ratings.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / ratingCount
    : 0;
  const recentBoundary = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentCount = reviews.filter((review) => getReviewCreatedAtMs(review) >= recentBoundary).length;

  if (reviewCount === 0) {
    summaryEl.innerText = '리뷰 0개 · 평균 - · 분산 - · 최근7일 0개';
    return;
  }

  summaryEl.innerText = `리뷰 ${reviewCount}개 · 평균 ${avg.toFixed(1)} · 분산 ${variance.toFixed(2)} · 최근7일 ${recentCount}개`;
}

function renderTrainerReviewList(reviews) {
  const listEl = document.getElementById('trainer-review-list');
  if (!listEl) return;

  if (reviews.length === 0) {
    listEl.innerHTML = '<div class="empty-state">아직 등록된 신뢰 리뷰가 없습니다.</div>';
    return;
  }

  listEl.innerHTML = reviews.map((review) => {
    const checks = review.checks || {};
    return `
      <div class="app-card" style="padding: 16px; border-radius: 16px;">
        <div class="app-info" style="gap: 8px; width: 100%;">
          <div class="app-header-row" style="justify-content: space-between;">
            <div class="app-user">평점 ${Number(review.rating) || '-'} / 5</div>
            <span class="badge-consult">${formatReviewDate(review)}</span>
          </div>
          <div class="app-feedback-preview">${escapeHtml(review.comment)}</div>
          <div class="trust-badge-row">
            ${checks.refund_explained ? '<span class="trust-tag tag-verified">환불 안내 확인</span>' : ''}
            ${checks.contract_clear ? '<span class="trust-tag tag-verified">계약 명확</span>' : ''}
            ${checks.upsell_transparent ? '<span class="trust-tag tag-verified">추가결제 투명</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function loadTrainerReviews(trainerId) {
  const listEl = document.getElementById('trainer-review-list');
  if (!listEl) return;
  if (!trainerId) {
    renderTrainerReviewSummary([]);
    renderTrainerReviewList([]);
    return;
  }

  listEl.innerHTML = '<div class="loading-spinner">리뷰 데이터를 불러오는 중...</div>';
  try {
    const q = query(collection(db, 'trainer_reviews'), where('trainerId', '==', trainerId));
    const snap = await getDocs(q);
    const reviews = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    reviews.sort((a, b) => getReviewCreatedAtMs(b) - getReviewCreatedAtMs(a));

    renderTrainerReviewSummary(reviews);
    renderTrainerReviewList(reviews);
  } catch (error) {
    console.error('Trainer Review Load Error:', error);
    listEl.innerHTML = '<div class="empty-state">데이터 로드 실패: 리뷰를 불러오지 못했습니다.</div>';
    renderTrainerReviewSummary([]);
    setTrainerReviewStatus('리뷰 로드 실패', 'error');
  }
}

async function handleTrainerReviewSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('btn-submit-trainer-review');
  const ratingInput = document.getElementById('review-rating');
  const commentInput = document.getElementById('review-comment');
  const trainerIdInput = document.getElementById('review-trainer-id');
  const reviewTrainerId = trainerIdInput?.value || currentReviewTrainerId;
  const rating = Number(ratingInput?.value);
  const comment = String(commentInput?.value || '').trim();

  if (!reviewTrainerId) {
    setTrainerReviewStatus('등록 실패: 트레이너 정보가 없습니다.', 'error');
    return;
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    setTrainerReviewStatus('등록 실패: 평점은 1~5 사이여야 합니다.', 'error');
    return;
  }
  if (!comment) {
    setTrainerReviewStatus('등록 실패: 코멘트를 입력해주세요.', 'error');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = '등록 중...';
  }
  setTrainerReviewStatus('리뷰 등록 중...', 'info');

  try {
    await addDoc(collection(db, 'trainer_reviews'), {
      trainerId: reviewTrainerId,
      rating,
      comment,
      checks: {
        refund_explained: !!document.getElementById('review-check-refund')?.checked,
        contract_clear: !!document.getElementById('review-check-contract')?.checked,
        upsell_transparent: !!document.getElementById('review-check-upsell')?.checked
      },
      createdAt: serverTimestamp()
    });

    e.target.reset();
    if (trainerIdInput) trainerIdInput.value = reviewTrainerId;
    setTrainerReviewStatus('등록 완료', 'success');
    safeShowToast('등록 완료', 'success');
    await loadTrainerReviews(reviewTrainerId);
  } catch (error) {
    console.error('Trainer Review Submit Error:', error);
    setTrainerReviewStatus('등록 실패', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = '리뷰 등록';
    }
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

function getTrustScoreMeta(scoreInput) {
  const rawScore = Number(scoreInput);
  const hasFiniteScore = Number.isFinite(rawScore);
  if (!hasFiniteScore) {
    return { hasScore: false, score: null, riskLabel: '평가 준비중', riskClass: '' };
  }

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  if (score === 0) {
    return { hasScore: false, score: null, riskLabel: '평가 준비중', riskClass: '' };
  }
  if (score >= 80) {
    return { hasScore: true, score, riskLabel: 'SAFE', riskClass: 'status-safe' };
  }
  if (score >= 50) {
    return { hasScore: true, score, riskLabel: 'CAUTION', riskClass: 'status-caution' };
  }
  return { hasScore: true, score, riskLabel: 'RISK', riskClass: 'status-busy' };
}

function getTrainerRiskDescriptions(trainer, trustMeta) {
  if (!trustMeta.hasScore) {
    return ['Trust Score 준비중'];
  }

  if (trustMeta.riskLabel === 'SAFE') {
    const isReportChecked = trainer?.reportHistoryVerified === true;
    const noReportRecord = trainer?.reportCount === 0 || trainer?.reportStatus === 'none';
    if (isReportChecked && noReportRecord) {
      return ['✓ 기본 인증 확인', '✓ 신고 이력 없음'];
    }
    return ['✓ 기본 인증 확인', '✓ 표준 안내 준수(신고 없음 확인 전)'];
  }

  if (trustMeta.riskLabel === 'CAUTION') {
    return ['⚠️ 추가 검증 필요'];
  }

  return ['🚨 주의 필요'];
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
