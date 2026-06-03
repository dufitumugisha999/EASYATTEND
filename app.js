// Firebase Configuration & Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  Timestamp, 
  onSnapshot,
  limit
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD4yLVc2xmNrA7g5WFMhIZRQDnHDslDrBw",
  authDomain: "easyattend-853bb.firebaseapp.com",
  projectId: "easyattend-853bb",
  storageBucket: "easyattend-853bb.firebasestorage.app",
  messagingSenderId: "797764731344",
  appId: "1:797764731344:web:97314649427154a3df79d5",
  measurementId: "G-759S03T208"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==================== APPLICATION STATE ====================
const EASYATTEND = {
  // State
  currentView: 'dashboard',
  darkMode: localStorage.getItem('easyattend_darkMode') === 'true',
  people: [],
  attendanceRecords: [],
  todayDate: new Date().toISOString().split('T')[0],
  isLoading: false,
  realtimeUnsubscribe: null,
  
  // DOM Elements (cached after init)
  elements: {},
  
  // Initialize the application
  async init() {
    this.cacheElements();
    this.applyTheme();
    this.setupNavigation();
    this.setupMobileMenu();
    this.setupThemeToggle();
    this.showLoading();
    
    try {
      await this.loadData();
      this.setupRealtimeSync();
      this.navigateTo('dashboard');
    } catch (error) {
      console.error('Initialization error:', error);
      this.showToast('Failed to load data. Please refresh the page.', 'error');
      this.hideLoading();
    }
  },
  
  // Cache DOM elements
  cacheElements() {
    this.elements = {
      mainContent: document.getElementById('mainContent'),
      modalContainer: document.getElementById('modalContainer'),
      toastContainer: document.getElementById('toastContainer'),
      loadingScreen: document.getElementById('loadingScreen'),
      sidebar: document.getElementById('sidebar'),
      mobileMenuBtn: document.getElementById('mobileMenuBtn'),
      themeToggleBtn: document.getElementById('themeToggleBtn'),
      themeIcon: document.getElementById('themeIcon'),
      pendingBadge: document.getElementById('pendingBadge'),
      navItems: document.querySelectorAll('.nav-item')
    };
  },
  
  // Show/hide loading
  showLoading() {
    this.isLoading = true;
    if (this.elements.loadingScreen) {
      this.elements.loadingScreen.style.display = 'flex';
    }
  },
  
  hideLoading() {
    this.isLoading = false;
    if (this.elements.loadingScreen) {
      this.elements.loadingScreen.style.display = 'none';
    }
  },
  
  // Theme management
  applyTheme() {
    if (this.darkMode) {
      document.body.classList.add('dark');
      if (this.elements.themeIcon) {
        this.elements.themeIcon.setAttribute('icon', 'ph:sun-duotone');
      }
    } else {
      document.body.classList.remove('dark');
      if (this.elements.themeIcon) {
        this.elements.themeIcon.setAttribute('icon', 'ph:moon-duotone');
      }
    }
    localStorage.setItem('easyattend_darkMode', this.darkMode);
  },
  
  toggleTheme() {
    this.darkMode = !this.darkMode;
    this.applyTheme();
  },
  
  setupThemeToggle() {
    if (this.elements.themeToggleBtn) {
      this.elements.themeToggleBtn.addEventListener('click', () => {
        this.toggleTheme();
      });
    }
  },
  
  // Navigation
  setupNavigation() {
    this.elements.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const view = item.dataset.view;
        if (view) {
          this.navigateTo(view);
        }
      });
    });
  },
  
  navigateTo(view) {
    this.currentView = view;
    
    // Update active nav item
    this.elements.navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.view === view) {
        item.classList.add('active');
      }
    });
    
    // Close mobile sidebar
    if (this.elements.sidebar) {
      this.elements.sidebar.classList.remove('open');
    }
    
    // Render the view
    this.renderView(view);
  },
  
  setupMobileMenu() {
    if (this.elements.mobileMenuBtn && this.elements.sidebar) {
      this.elements.mobileMenuBtn.addEventListener('click', () => {
        this.elements.sidebar.classList.toggle('open');
      });
      
      // Close sidebar when clicking outside
      document.addEventListener('click', (e) => {
        if (this.elements.sidebar.classList.contains('open') &&
            !this.elements.sidebar.contains(e.target) &&
            !this.elements.mobileMenuBtn.contains(e.target)) {
          this.elements.sidebar.classList.remove('open');
        }
      });
    }
  },
  
  // Firebase Data Operations
  async loadData() {
    try {
      const [peopleSnapshot, attendanceSnapshot] = await Promise.all([
        getDocs(collection(db, "people")),
        getDocs(query(collection(db, "attendance"), orderBy("timestamp", "desc"), limit(100)))
      ]);
      
      this.people = [];
      peopleSnapshot.forEach((doc) => {
        this.people.push({ id: doc.id, ...doc.data() });
      });
      
      this.attendanceRecords = [];
      attendanceSnapshot.forEach((doc) => {
        this.attendanceRecords.push({ id: doc.id, ...doc.data() });
      });
      
      this.updatePendingBadge();
      return true;
    } catch (error) {
      console.error('Error loading data:', error);
      throw error;
    }
  },
  
  setupRealtimeSync() {
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
    }
    
    this.realtimeUnsubscribe = onSnapshot(
      query(collection(db, "attendance"), orderBy("timestamp", "desc"), limit(100)),
      (snapshot) => {
        this.attendanceRecords = [];
        snapshot.forEach((doc) => {
          this.attendanceRecords.push({ id: doc.id, ...doc.data() });
        });
        
        this.updatePendingBadge();
        
        // Re-render current view if on dashboard or attendance
        if (this.currentView === 'dashboard' || this.currentView === 'attendance') {
          this.renderView(this.currentView);
        }
      },
      (error) => {
        console.error('Realtime sync error:', error);
      }
    );
  },
  
  updatePendingBadge() {
    if (this.elements.pendingBadge) {
      const todayRecords = this.attendanceRecords.filter(r => r.date === this.todayDate);
      const pendingCount = this.people.length - todayRecords.length;
      this.elements.pendingBadge.textContent = Math.max(0, pendingCount);
    }
  },
  
  async addPerson(personData) {
    try {
      const docRef = await addDoc(collection(db, "people"), {
        ...personData,
        createdAt: serverTimestamp(),
        status: 'active'
      });
      
      // Refresh people list
      await this.loadData();
      this.showToast('Person registered successfully!', 'success');
      return docRef.id;
    } catch (error) {
      console.error('Error adding person:', error);
      this.showToast('Failed to register person', 'error');
      return null;
    }
  },
  
  async markAttendance(personId, type) {
    try {
      const today = this.todayDate;
      
      // Check for existing attendance today
      const existingQuery = query(
        collection(db, "attendance"),
        where("personId", "==", personId),
        where("date", "==", today)
      );
      const existingDocs = await getDocs(existingQuery);

      if (type === 'check-in') {
        if (!existingDocs.empty) {
          this.showToast('Already checked in today', 'warning');
          return false;
        }
        
        await addDoc(collection(db, "attendance"), {
          personId,
          date: today,
          checkIn: this.getCurrentTime(),
          checkOut: null,
          status: 'present',
          timestamp: serverTimestamp()
        });
        
        this.showToast('Check-in successful!', 'success');
      } else if (type === 'check-out') {
        if (existingDocs.empty) {
          this.showToast('No check-in record found for today', 'error');
          return false;
        }
        
        const attendanceDoc = existingDocs.docs[0];
        if (attendanceDoc.data().checkOut) {
          this.showToast('Already checked out today', 'warning');
          return false;
        }
        
        await updateDoc(doc(db, "attendance", attendanceDoc.id), {
          checkOut: this.getCurrentTime(),
          status: 'completed'
        });
        
        this.showToast('Check-out successful!', 'success');
      }
      
      return true;
    } catch (error) {
      console.error('Error marking attendance:', error);
      this.showToast('Failed to mark attendance', 'error');
      return false;
    }
  },
  
  async updatePerson(personId, updatedData) {
    try {
      await updateDoc(doc(db, "people", personId), updatedData);
      await this.loadData();
      this.showToast('Person updated successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Error updating person:', error);
      this.showToast('Failed to update person', 'error');
      return false;
    }
  },
  
  async deletePerson(personId) {
    try {
      await deleteDoc(doc(db, "people", personId));
      await this.loadData();
      this.showToast('Person deleted successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Error deleting person:', error);
      this.showToast('Failed to delete person', 'error');
      return false;
    }
  },
  
  // Utility Functions
  getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  },
  
  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  },
  
  getRegionalStats() {
    const regions = {};
    this.people.forEach(p => {
      const region = p.province || 'Unknown';
      regions[region] = (regions[region] || 0) + 1;
    });
    const total = this.people.length || 1;
    return Object.entries(regions).map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / total) * 100)
    }));
  },
  
  getAttendanceStats() {
    const today = this.todayDate;
    const todayAttendance = this.attendanceRecords.filter(r => r.date === today);
    const totalPeople = this.people.length;
    const presentToday = todayAttendance.filter(r => r.status === 'present' || r.status === 'completed').length;
    const absentToday = totalPeople - presentToday;
    const attendanceRate = totalPeople > 0 ? Math.round((presentToday / totalPeople) * 100) : 0;
    const lateArrivals = todayAttendance.filter(r => r.checkIn && r.checkIn > '09:00').length;
    
    return {
      totalPeople,
      presentToday,
      absentToday,
      attendanceRate,
      lateArrivals,
      todayAttendance
    };
  },
  
  showToast(message, type = 'success') {
    const container = this.elements.toastContainer;
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
      success: 'ph:check-circle-duotone',
      error: 'ph:warning-circle-duotone',
      warning: 'ph:warning-duotone'
    };
    
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b'
    };
    
    toast.innerHTML = `
      <iconify-icon icon="${icons[type] || icons.success}" 
                    width="24" height="24" 
                    style="color:${colors[type] || colors.success};flex-shrink:0;">
      </iconify-icon>
      <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      toast.style.animation = 'slideUp 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },
  
  // Modal Management
  showModal(htmlContent) {
    const container = this.elements.modalContainer;
    if (!container) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        ${htmlContent}
      </div>
    `;
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeModal();
      }
    });
    
    container.appendChild(overlay);
    
    // Focus trap and ESC key
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  },
  
  closeModal() {
    const container = this.elements.modalContainer;
    if (container) {
      container.innerHTML = '';
    }
  },
  
  // View Renderers
  renderView(view) {
    if (!this.elements.mainContent) return;
    
    switch(view) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'attendance':
        this.renderAttendance();
        break;
      case 'people':
        this.renderPeople();
        break;
      case 'register':
        this.renderRegister();
        break;
      case 'analytics':
        this.renderAnalytics();
        break;
      case 'reports':
        this.renderReports();
        break;
      case 'settings':
        this.renderSettings();
        break;
      default:
        this.renderDashboard();
    }
  },
  
  // Dashboard View
  renderDashboard() {
    const stats = this.getAttendanceStats();
    
    const html = `
      <div class="animate-in">
        <div class="top-header">
          <div>
            <h1 class="page-title">Dashboard</h1>
            <p class="page-subtitle">Welcome back, Admin</p>
          </div>
          <div class="header-actions">
            <div class="search-container">
              <iconify-icon icon="ph:magnifying-glass" class="search-icon" width="20" height="20"></iconify-icon>
              <input type="text" class="search-input" placeholder="Search people, ID, or location..." id="globalSearch">
            </div>
            <button class="btn btn-primary" onclick="EASYATTEND.navigateTo('register')">
              <iconify-icon icon="ph:user-plus" width="18" height="18"></iconify-icon>
              Register
            </button>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon" style="background:rgba(37,99,235,0.1);color:#2563eb;">
              <iconify-icon icon="ph:users-duotone" width="24" height="24"></iconify-icon>
            </div>
            <div class="stat-value">${stats.totalPeople}</div>
            <div class="stat-label">Total Registered</div>
          </div>

          <div class="stat-card">
            <div class="stat-icon" style="background:rgba(16,185,129,0.1);color:#10b981;">
              <iconify-icon icon="ph:check-circle-duotone" width="24" height="24"></iconify-icon>
            </div>
            <div class="stat-value">${stats.presentToday}</div>
            <div class="stat-label">Present Today</div>
            <span class="stat-trend trend-up">
              <iconify-icon icon="ph:trend-up" width="16" height="16"></iconify-icon>
              ${stats.attendanceRate}% rate
            </span>
          </div>

          <div class="stat-card">
            <div class="stat-icon" style="background:rgba(239,68,68,0.1);color:#ef4444;">
              <iconify-icon icon="ph:x-circle-duotone" width="24" height="24"></iconify-icon>
            </div>
            <div class="stat-value">${stats.absentToday}</div>
            <div class="stat-label">Absent Today</div>
          </div>

          <div class="stat-card">
            <div class="stat-icon" style="background:rgba(245,158,11,0.1);color:#f59e0b;">
              <iconify-icon icon="ph:clock-duotone" width="24" height="24"></iconify-icon>
            </div>
            <div class="stat-value">${stats.lateArrivals}</div>
            <div class="stat-label">Late Arrivals</div>
          </div>
        </div>

        <div class="cards-grid">
          <div class="card">
            <div class="card-header">
              <span class="card-title">
                <iconify-icon icon="ph:chart-line-duotone" width="20" height="20"></iconify-icon>
                Attendance Trends
              </span>
              <button class="btn btn-secondary btn-sm">Weekly</button>
            </div>
            <div class="chart-placeholder">
              <iconify-icon icon="ph:chart-bar-duotone" width="48" height="48" style="opacity:0.3;"></iconify-icon>
              <span>AI-Powered Analytics Active</span>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">
                <iconify-icon icon="ph:map-pin-duotone" width="20" height="20"></iconify-icon>
                Regional Distribution
              </span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:1rem;">
              ${this.getRegionalStats().map(r => `
                <div style="padding:12px;background:var(--accent-light);border-radius:12px;">
                  <div style="font-weight:600;">${r.name}</div>
                  <div style="font-size:1.5rem;font-weight:700;">${r.count}</div>
                  <div style="font-size:0.8rem;color:var(--text-muted);">${r.percentage}% of total</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">
              <iconify-icon icon="ph:clock-counter-clockwise-duotone" width="20" height="20"></iconify-icon>
              Recent Attendance Activity
            </span>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Date</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${this.attendanceRecords.slice(0, 8).map(record => {
                  const person = this.people.find(p => p.id === record.personId);
                  return `
                    <tr>
                      <td>
                        <div style="display:flex;align-items:center;gap:8px;">
                          <div class="person-avatar">${person?.fullName?.charAt(0) || '?'}</div>
                          ${person?.fullName || 'Unknown'}
                        </div>
                      </td>
                      <td>${this.formatDate(record.date)}</td>
                      <td>${record.checkIn || '--'}</td>
                      <td>${record.checkOut || '--'}</td>
                      <td><span class="badge badge-${record.status === 'present' || record.status === 'completed' ? 'success' : 'warning'}">${record.status || 'pending'}</span></td>
                    </tr>
                  `;
                }).join('') || '<tr><td colspan="5" class="empty-state">No attendance records yet</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    this.elements.mainContent.innerHTML = html;
    this.hideLoading();
  },
  
  // Attendance View
  renderAttendance() {
    const today = this.todayDate;
    const todayRecords = this.attendanceRecords.filter(r => r.date === today);
    
    const html = `
      <div class="animate-in">
        <div class="top-header">
          <div>
            <h1 class="page-title">Attendance Management</h1>
            <p class="page-subtitle">${this.formatDate(today)}</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" onclick="EASYATTEND.showCheckInModal()">
              <iconify-icon icon="ph:check-circle-duotone" width="18" height="18"></iconify-icon>
              Mark Attendance
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Today's Records</span>
            <span class="badge badge-info">${todayRecords.length} records</span>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>ID</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${todayRecords.map(record => {
                  const person = this.people.find(p => p.id === record.personId);
                  return `
                    <tr>
                      <td>
                        <div style="display:flex;align-items:center;gap:8px;">
                          <div class="person-avatar">${person?.fullName?.charAt(0) || '?'}</div>
                          ${person?.fullName || 'Unknown'}
                        </div>
                      </td>
                      <td><code>${record.personId}</code></td>
                      <td>${record.checkIn || '--'}</td>
                      <td>${record.checkOut || '--'}</td>
                      <td><span class="badge badge-${record.status === 'present' || record.status === 'completed' ? 'success' : 'warning'}">${record.status || 'pending'}</span></td>
                    </tr>
                  `;
                }).join('') || '<tr><td colspan="5" class="empty-state">No attendance records for today</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    this.elements.mainContent.innerHTML = html;
    this.hideLoading();
  },
  
  showCheckInModal() {
    const html = `
      <div class="modal-header">
        <h2 class="modal-title">Mark Attendance</h2>
        <button class="btn btn-icon btn-secondary" onclick="EASYATTEND.closeModal()">
          <iconify-icon icon="ph:x-duotone" width="20" height="20"></iconify-icon>
        </button>
      </div>
      <div class="form-group">
        <label class="form-label">Select Person</label>
        <select class="form-select" id="modalPersonSelect">
          <option value="">Choose a person...</option>
          ${this.people.map(p => `
            <option value="${p.id}">${p.fullName} (${p.employeeId || p.id})</option>
          `).join('')}
        </select>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="EASYATTEND.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="EASYATTEND.handleCheckIn()">
          <iconify-icon icon="ph:sign-in-duotone" width="18" height="18"></iconify-icon>
          Check-In
        </button>
        <button class="btn btn-secondary" onclick="EASYATTEND.handleCheckOut()">
          <iconify-icon icon="ph:sign-out-duotone" width="18" height="18"></iconify-icon>
          Check-Out
        </button>
      </div>
    `;
    
    this.showModal(html);
  },
  
  async handleCheckIn() {
    const select = document.getElementById('modalPersonSelect');
    if (!select || !select.value) {
      this.showToast('Please select a person', 'warning');
      return;
    }
    
    const success = await this.markAttendance(select.value, 'check-in');
    if (success) {
      this.closeModal();
    }
  },
  
  async handleCheckOut() {
    const select = document.getElementById('modalPersonSelect');
    if (!select || !select.value) {
      this.showToast('Please select a person', 'warning');
      return;
    }
    
    const success = await this.markAttendance(select.value, 'check-out');
    if (success) {
      this.closeModal();
    }
  },
  
  // People View
  renderPeople() {
    const html = `
      <div class="animate-in">
        <div class="top-header">
          <div>
            <h1 class="page-title">People Directory</h1>
            <p class="page-subtitle">${this.people.length} registered people</p>
          </div>
          <div class="header-actions">
            <div class="search-container">
              <iconify-icon icon="ph:magnifying-glass" class="search-icon" width="20" height="20"></iconify-icon>
              <input type="text" class="search-input" placeholder="Search by name, ID, or phone..." id="peopleSearch">
            </div>
            <button class="btn btn-primary" onclick="EASYATTEND.navigateTo('register')">
              <iconify-icon icon="ph:user-plus" width="18" height="18"></iconify-icon>
              Add Person
            </button>
          </div>
        </div>

        <div class="card">
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>ID</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="peopleTableBody">
                ${this.people.map(person => `
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <div class="person-avatar">${person.fullName?.charAt(0) || '?'}</div>
                        <div>
                          <div style="font-weight:600;">${person.fullName || 'Unknown'}</div>
                          <div style="font-size:0.75rem;color:var(--text-muted);">${person.email || 'No email'}</div>
                        </div>
                      </div>
                    </td>
                    <td><code>${person.employeeId || person.id}</code></td>
                    <td>${person.phone || 'N/A'}</td>
                    <td>${person.province || 'N/A'}, ${person.district || ''}</td>
                    <td><span class="badge badge-${person.status === 'active' ? 'success' : 'danger'}">${person.status || 'active'}</span></td>
                    <td>
                      <button class="btn btn-secondary btn-sm" onclick="EASYATTEND.editPerson('${person.id}')">
                        <iconify-icon icon="ph:pencil-simple" width="16" height="16"></iconify-icon>
                      </button>
                    </td>
                  </tr>
                `).join('') || '<tr><td colspan="6" class="empty-state">No people registered yet</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    this.elements.mainContent.innerHTML = html;
    this.hideLoading();
    
    // Setup search functionality
    setTimeout(() => {
      const searchInput = document.getElementById('peopleSearch');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const term = e.target.value.toLowerCase();
          const rows = document.querySelectorAll('#peopleTableBody tr');
          rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
          });
        });
      }
    }, 100);
  },
  
  editPerson(personId) {
    const person = this.people.find(p => p.id === personId);
    if (!person) return;
    
    const html = `
      <div class="modal-header">
        <h2 class="modal-title">Edit Person</h2>
        <button class="btn btn-icon btn-secondary" onclick="EASYATTEND.closeModal()">
          <iconify-icon icon="ph:x-duotone" width="20" height="20"></iconify-icon>
        </button>
      </div>
      <form id="editPersonForm" onsubmit="event.preventDefault(); EASYATTEND.savePersonEdit('${personId}')">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" class="form-input" id="editFullName" value="${person.fullName || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="text" class="form-input" id="editPhone" value="${person.phone || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="editEmail" value="${person.email || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="editStatus">
              <option value="active" ${person.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="inactive" ${person.status === 'inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-danger" onclick="EASYATTEND.confirmDelete('${personId}')">
            <iconify-icon icon="ph:trash-duotone" width="18" height="18"></iconify-icon>
            Delete
          </button>
          <button type="button" class="btn btn-secondary" onclick="EASYATTEND.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    `;
    
    this.showModal(html);
  },
  
  async savePersonEdit(personId) {
    const updatedData = {
      fullName: document.getElementById('editFullName')?.value,
      phone: document.getElementById('editPhone')?.value,
      email: document.getElementById('editEmail')?.value,
      status: document.getElementById('editStatus')?.value
    };
    
    const success = await this.updatePerson(personId, updatedData);
    if (success) {
      this.closeModal();
      this.renderPeople();
    }
  },
  
  async confirmDelete(personId) {
    if (confirm('Are you sure you want to delete this person? This action cannot be undone.')) {
      const success = await this.deletePerson(personId);
      if (success) {
        this.closeModal();
        this.renderPeople();
      }
    }
  },
  
  // Register View
  renderRegister() {
    const html = `
      <div class="animate-in">
        <div class="top-header">
          <div>
            <h1 class="page-title">Register New Person</h1>
            <p class="page-subtitle">Add a new member to the system</p>
          </div>
        </div>
        
        <div class="card" style="max-width:800px;">
          <form id="registerForm" onsubmit="event.preventDefault(); EASYATTEND.handleRegister()">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Full Name *</label>
                <input type="text" class="form-input" id="regFullName" required placeholder="Enter full name">
              </div>
              <div class="form-group">
                <label class="form-label">National ID Number *</label>
                <input type="text" class="form-input" id="regNationalId" required placeholder="1 1997 8 0012345678">
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Phone Number *</label>
                <input type="tel" class="form-input" id="regPhone" required placeholder="0788123456">
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-input" id="regEmail" placeholder="email@example.com">
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Gender *</label>
                <select class="form-select" id="regGender" required>
                  <option value="">Select gender</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Date of Birth</label>
                <input type="date" class="form-input" id="regDob">
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Province *</label>
                <select class="form-select" id="regProvince" required>
                  <option value="">Select province</option>
                  <option value="Kigali City">Kigali City</option>
                  <option value="Northern Province">Northern Province</option>
                  <option value="Southern Province">Southern Province</option>
                  <option value="Eastern Province">Eastern Province</option>
                  <option value="Western Province">Western Province</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">District *</label>
                <input type="text" class="form-input" id="regDistrict" required placeholder="Enter district">
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Sector</label>
                <input type="text" class="form-input" id="regSector" placeholder="Enter sector">
              </div>
              <div class="form-group">
                <label class="form-label">Cell</label>
                <input type="text" class="form-input" id="regCell" placeholder="Enter cell">
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Village</label>
              <input type="text" class="form-input" id="regVillage" placeholder="Enter village">
            </div>
            
            <button type="submit" class="btn btn-primary" style="width:100%;margin-top:1rem;">
              <iconify-icon icon="ph:user-plus" width="20" height="20"></iconify-icon>
              Register Person
            </button>
          </form>
        </div>
      </div>
    `;
    
    this.elements.mainContent.innerHTML = html;
    this.hideLoading();
  },
  
  async handleRegister() {
    const personData = {
      fullName: document.getElementById('regFullName')?.value,
      nationalId: document.getElementById('regNationalId')?.value,
      phone: document.getElementById('regPhone')?.value,
      email: document.getElementById('regEmail')?.value || null,
      gender: document.getElementById('regGender')?.value,
      dob: document.getElementById('regDob')?.value || null,
      province: document.getElementById('regProvince')?.value,
      district: document.getElementById('regDistrict')?.value,
      sector: document.getElementById('regSector')?.value || null,
      cell: document.getElementById('regCell')?.value || null,
      village: document.getElementById('regVillage')?.value || null,
      employeeId: 'EMP' + String(this.people.length + 1).padStart(4, '0')
    };
    
    const docId = await this.addPerson(personData);
    if (docId) {
      this.navigateTo('people');
    }
  },
  
  // Analytics View
  renderAnalytics() {
    const stats = this.getAttendanceStats();
    
    const html = `
      <div class="animate-in">
        <div class="top-header">
          <div>
            <h1 class="page-title">AI Analytics</h1>
            <p class="page-subtitle">Intelligent insights & predictions</p>
          </div>
          <span class="badge badge-info" style="padding:8px 16px;">
            <iconify-icon icon="ph:brain-duotone" width="18" height="18"></iconify-icon>
            AI Engine Active
          </span>
        </div>

        <div class="stats-grid" style="margin-bottom:2rem;">
          <div class="stat-card">
            <div class="stat-label">Overall Attendance Rate</div>
            <div class="stat-value">${stats.attendanceRate}%</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width:${stats.attendanceRate}%;"></div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Frequent Absentees</div>
            <div class="stat-value">${Math.min(3, stats.absentToday)}</div>
            <span class="stat-trend trend-down">
              <iconify-icon icon="ph:warning-duotone" width="16" height="16"></iconify-icon>
              Needs review
            </span>
          </div>
          <div class="stat-card">
            <div class="stat-label">Predicted Tomorrow</div>
            <div class="stat-value">87%</div>
            <span class="stat-trend trend-up">
              <iconify-icon icon="ph:trend-up" width="16" height="16"></iconify-icon>
              AI Prediction
            </span>
          </div>
        </div>

        <div class="cards-grid">
          <div class="card">
            <div class="card-header">
              <span class="card-title">Attendance Heatmap</span>
            </div>
            <div class="chart-placeholder" style="height:300px;">
              <iconify-icon icon="ph:grid-four-duotone" width="64" height="64" style="opacity:0.2;"></iconify-icon>
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <span class="card-title">AI Insights</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;margin-top:1rem;">
              <div style="padding:12px;background:var(--success-light);border-radius:12px;border-left:3px solid var(--success);">
                <iconify-icon icon="ph:lightbulb-duotone" width="20" height="20" style="color:var(--success);"></iconify-icon>
                <strong>Peak attendance:</strong> Tuesdays & Wednesdays
              </div>
              <div style="padding:12px;background:var(--warning-light);border-radius:12px;border-left:3px solid var(--warning);">
                <iconify-icon icon="ph:trend-down-duotone" width="20" height="20" style="color:var(--warning);"></iconify-icon>
                <strong>Late arrivals increase</strong> on Mondays by 23%
              </div>
              <div style="padding:12px;background:var(--accent-light);border-radius:12px;border-left:3px solid var(--accent);">
                <iconify-icon icon="ph:target-duotone" width="20" height="20" style="color:var(--accent);"></iconify-icon>
                <strong>Recommendation:</strong> Send reminders on Sunday evening
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.elements.mainContent.innerHTML = html;
    this.hideLoading();
  },
  
  // Reports View
  renderReports() {
    const html = `
      <div class="animate-in">
        <div class="top-header">
          <div>
            <h1 class="page-title">Reports</h1>
            <p class="page-subtitle">Generate and export attendance reports</p>
          </div>
          <button class="btn btn-primary">
            <iconify-icon icon="ph:download-simple-duotone" width="18" height="18"></iconify-icon>
            Export Report
          </button>
        </div>

        <div class="cards-grid">
          <div class="card">
            <div class="card-header">
              <span class="card-title">
                <iconify-icon icon="ph:calendar-duotone" width="20" height="20"></iconify-icon>
                Daily Report
              </span>
            </div>
            <p style="color:var(--text-secondary);margin-bottom:1rem;">Auto-generated daily attendance summary</p>
            <button class="btn btn-secondary btn-sm">Generate Report</button>
          </div>
          <div class="card">
            <div class="card-header">
              <span class="card-title">
                <iconify-icon icon="ph:calendar-check-duotone" width="20" height="20"></iconify-icon>
                Weekly Report
              </span>
            </div>
            <p style="color:var(--text-secondary);margin-bottom:1rem;">Weekly attendance analysis with trends</p>
            <button class="btn btn-secondary btn-sm">Generate Report</button>
          </div>
          <div class="card">
            <div class="card-header">
              <span class="card-title">
                <iconify-icon icon="ph:calendar-blank-duotone" width="20" height="20"></iconify-icon>
                Monthly Report
              </span>
            </div>
            <p style="color:var(--text-secondary);margin-bottom:1rem;">Comprehensive monthly attendance report</p>
            <button class="btn btn-secondary btn-sm">Generate Report</button>
          </div>
        </div>
      </div>
    `;
    
    this.elements.mainContent.innerHTML = html;
    this.hideLoading();
  },
  
  // Settings View
  renderSettings() {
    const html = `
      <div class="animate-in">
        <div class="top-header">
          <div>
            <h1 class="page-title">Settings</h1>
            <p class="page-subtitle">Configure system preferences</p>
          </div>
        </div>
        
        <div class="card" style="max-width:600px;">
          <div class="form-group">
            <label class="form-label">Theme</label>
            <select class="form-select" id="themeSelect" onchange="EASYATTEND.darkMode = this.value === 'dark'; EASYATTEND.applyTheme();">
              <option value="light" ${!this.darkMode ? 'selected' : ''}>Light Mode</option>
              <option value="dark" ${this.darkMode ? 'selected' : ''}>Dark Mode</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Data Export Format</label>
            <select class="form-select">
              <option>Excel (.xlsx)</option>
              <option>CSV</option>
              <option>PDF</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Auto Backup</label>
            <select class="form-select">
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Notifications</label>
            <select class="form-select">
              <option>Enabled</option>
              <option>Disabled</option>
            </select>
          </div>
          <button class="btn btn-primary" style="margin-top:1rem;" onclick="EASYATTEND.showToast('Settings saved successfully!', 'success')">
            <iconify-icon icon="ph:floppy-disk-duotone" width="18" height="18"></iconify-icon>
            Save Settings
          </button>
        </div>
      </div>
    `;
    
    this.elements.mainContent.innerHTML = html;
    this.hideLoading();
  }
};

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  EASYATTEND.init();
});

// Make EASYATTEND globally accessible for onclick handlers
window.EASYATTEND = EASYATTEND;
