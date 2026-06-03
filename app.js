// Firebase Configuration
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
  onSnapshot,
  limit,
  Timestamp
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

// ==================== Application ====================
const App = {
  state: {
    currentView: 'dashboard',
    darkMode: localStorage.getItem('easyattend_theme') === 'dark',
    people: [],
    attendance: [],
    today: new Date().toISOString().split('T')[0],
    loading: true,
    listener: null
  },

  elements: {},

  // ----- Initialization -----
  async start() {
    this.cacheDOM();
    this.setTheme();
    this.bindNavigation();
    this.bindMobileMenu();
    this.bindThemeToggle();
    
    try {
      await this.fetchData();
      this.listenToChanges();
      this.showView('dashboard');
    } catch (err) {
      console.error('Startup error:', err);
      this.toast('Could not load data. Please refresh.', 'error');
    }
    
    this.state.loading = false;
    this.hideLoader();
  },

  cacheDOM() {
    this.elements = {
      main: document.getElementById('mainContent'),
      modal: document.getElementById('modalRoot'),
      toast: document.getElementById('toastRoot'),
      loader: document.getElementById('loadingState'),
      sidebar: document.getElementById('sidebar'),
      menuBtn: document.getElementById('menuToggle'),
      themeBtn: document.getElementById('themeToggle'),
      themeIcon: document.getElementById('themeIcon'),
      navLinks: document.querySelectorAll('.nav-link')
    };
  },

  // ----- Theme -----
  setTheme() {
    if (this.state.darkMode) {
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
  },

  toggleTheme() {
    this.state.darkMode = !this.state.darkMode;
    localStorage.setItem('easyattend_theme', this.state.darkMode ? 'dark' : 'light');
    this.setTheme();
  },

  bindThemeToggle() {
    if (this.elements.themeBtn) {
      this.elements.themeBtn.addEventListener('click', () => this.toggleTheme());
    }
  },

  // ----- Navigation -----
  bindNavigation() {
    this.elements.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const view = link.dataset.view;
        if (view) this.showView(view);
      });
    });
  },

  showView(view) {
    this.state.currentView = view;
    
    this.elements.navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.dataset.view === view) link.classList.add('active');
    });
    
    // Close mobile sidebar
    if (this.elements.sidebar) {
      this.elements.sidebar.classList.remove('open');
    }
    
    this.render(view);
  },

  bindMobileMenu() {
    if (this.elements.menuBtn && this.elements.sidebar) {
      this.elements.menuBtn.addEventListener('click', () => {
        this.elements.sidebar.classList.toggle('open');
      });
      
      document.addEventListener('click', (e) => {
        if (this.elements.sidebar.classList.contains('open') &&
            !this.elements.sidebar.contains(e.target) &&
            !this.elements.menuBtn.contains(e.target)) {
          this.elements.sidebar.classList.remove('open');
        }
      });
    }
  },

  // ----- Data -----
  async fetchData() {
    const [peopleSnap, attendanceSnap] = await Promise.all([
      getDocs(collection(db, "people")),
      getDocs(query(collection(db, "attendance"), orderBy("createdAt", "desc"), limit(200)))
    ]);
    
    this.state.people = [];
    peopleSnap.forEach(doc => {
      this.state.people.push({ id: doc.id, ...doc.data() });
    });
    
    this.state.attendance = [];
    attendanceSnap.forEach(doc => {
      this.state.attendance.push({ id: doc.id, ...doc.data() });
    });
  },

  listenToChanges() {
    if (this.state.listener) this.state.listener();
    
    this.state.listener = onSnapshot(
      query(collection(db, "attendance"), orderBy("createdAt", "desc"), limit(200)),
      (snap) => {
        this.state.attendance = [];
        snap.forEach(doc => {
          this.state.attendance.push({ id: doc.id, ...doc.data() });
        });
        
        if (this.state.currentView === 'dashboard' || this.state.currentView === 'attendance') {
          this.render(this.state.currentView);
        }
      }
    );
  },

  // ----- CRUD Operations -----
  async addPerson(data) {
    try {
      const docRef = await addDoc(collection(db, "people"), {
        ...data,
        createdAt: Timestamp.now(),
        status: 'active'
      });
      await this.fetchData();
      this.toast('Person registered successfully', 'success');
      return docRef.id;
    } catch (err) {
      console.error('Add person error:', err);
      this.toast('Registration failed', 'error');
      return null;
    }
  },

  async markAttendance(personId, type) {
    try {
      const today = this.state.today;
      const existingQuery = query(
        collection(db, "attendance"),
        where("personId", "==", personId),
        where("date", "==", today)
      );
      const existing = await getDocs(existingQuery);
      
      if (type === 'in') {
        if (!existing.empty) {
          this.toast('Already checked in today', 'warning');
          return false;
        }
        await addDoc(collection(db, "attendance"), {
          personId,
          date: today,
          checkIn: this.getTime(),
          checkOut: null,
          status: 'present',
          createdAt: Timestamp.now()
        });
        this.toast('Check-in recorded', 'success');
      } else {
        if (existing.empty) {
          this.toast('No check-in found for today', 'error');
          return false;
        }
        const record = existing.docs[0];
        if (record.data().checkOut) {
          this.toast('Already checked out', 'warning');
          return false;
        }
        await updateDoc(doc(db, "attendance", record.id), {
          checkOut: this.getTime(),
          status: 'completed'
        });
        this.toast('Check-out recorded', 'success');
      }
      return true;
    } catch (err) {
      console.error('Attendance error:', err);
      this.toast('Operation failed', 'error');
      return false;
    }
  },

  async updatePerson(personId, data) {
    try {
      await updateDoc(doc(db, "people", personId), data);
      await this.fetchData();
      this.toast('Updated successfully', 'success');
      return true;
    } catch (err) {
      this.toast('Update failed', 'error');
      return false;
    }
  },

  async deletePerson(personId) {
    try {
      await deleteDoc(doc(db, "people", personId));
      await this.fetchData();
      this.toast('Person removed', 'success');
      return true;
    } catch (err) {
      this.toast('Delete failed', 'error');
      return false;
    }
  },

  // ----- Helpers -----
  getTime() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },

  getStats() {
    const today = this.state.today;
    const todayRecords = this.state.attendance.filter(r => r.date === today);
    const total = this.state.people.length;
    const present = todayRecords.length;
    const absent = total - present;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    
    return { total, present, absent, rate, todayRecords };
  },

  getRegionStats() {
    const regions = {};
    this.state.people.forEach(p => {
      const region = p.province || 'Other';
      regions[region] = (regions[region] || 0) + 1;
    });
    return Object.entries(regions).map(([name, count]) => ({ name, count }));
  },

  toast(message, type = 'success') {
    const container = this.elements.toast;
    if (!container) return;
    
    const el = document.createElement('div');
    el.className = `toast-message ${type}`;
    const icons = { success: 'ph:check-circle', error: 'ph:warning-circle', warning: 'ph:warning' };
    el.innerHTML = `
      <iconify-icon icon="${icons[type]}" width="18" height="18"></iconify-icon>
      ${message}
    `;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.2s';
      setTimeout(() => el.remove(), 200);
    }, 3500);
  },

  hideLoader() {
    if (this.elements.loader) {
      this.elements.loader.style.display = 'none';
    }
  },

  // ----- Modal -----
  showModal(html) {
    const container = this.elements.modal;
    if (!container) return;
    
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal-dialog">${html}</div>`;
    
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.closeModal();
    });
    
    container.appendChild(backdrop);
    
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  },

  closeModal() {
    if (this.elements.modal) {
      this.elements.modal.innerHTML = '';
    }
  },

  // ----- View Renderers -----
  render(view) {
    switch(view) {
      case 'dashboard': this.renderDashboard(); break;
      case 'attendance': this.renderAttendance(); break;
      case 'people': this.renderPeople(); break;
      case 'register': this.renderRegister(); break;
      case 'analytics': this.renderAnalytics(); break;
      case 'reports': this.renderReports(); break;
      default: this.renderDashboard();
    }
  },

  // Dashboard
  renderDashboard() {
    const stats = this.getStats();
    const regions = this.getRegionStats();
    
    const html = `
      <div class="page-header">
        <div class="page-title-section">
          <h1>Good ${this.getGreeting()}, Admin</h1>
          <p>Here's what's happening today</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" onclick="App.showView('register')">
            <iconify-icon icon="ph:user-circle-plus" width="18" height="18"></iconify-icon>
            Register
          </button>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-label">Total People</div>
          <div class="stat-number">${stats.total}</div>
          <div class="stat-detail">Registered members</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Present Today</div>
          <div class="stat-number">${stats.present}</div>
          <div class="stat-detail">${stats.rate}% attendance rate</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Absent Today</div>
          <div class="stat-number">${stats.absent}</div>
          <div class="stat-detail">Needs follow-up</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Regions</div>
          <div class="stat-number">${regions.length}</div>
          <div class="stat-detail">Active locations</div>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Recent Activity</span>
            <button class="btn btn-ghost btn-sm" onclick="App.showView('attendance')">View all</button>
          </div>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr><th>Person</th><th>Time</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${stats.todayRecords.slice(0, 5).map(r => {
                  const person = this.state.people.find(p => p.id === r.personId);
                  return `
                    <tr>
                      <td>
                        <div class="person-display">
                          <div class="person-avatar-sm">${person?.fullName?.charAt(0) || '?'}</div>
                          ${person?.fullName || 'Unknown'}
                        </div>
                      </td>
                      <td>${r.checkIn || '—'}</td>
                      <td><span class="badge badge-green">${r.status || 'present'}</span></td>
                    </tr>
                  `;
                }).join('') || '<tr><td colspan="3" style="text-align:center;padding:2rem;color:var(--color-text-muted);">No activity today</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Regional Overview</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:0.75rem;">
            ${regions.map(r => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid var(--color-border-light);">
                <span>${r.name}</span>
                <span style="font-weight:600;">${r.count} people</span>
              </div>
            `).join('') || '<p style="color:var(--color-text-muted);">No data available</p>'}
          </div>
        </div>
      </div>
    `;
    
    this.elements.main.innerHTML = html;
  },

  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  },

  // Attendance
  renderAttendance() {
    const today = this.state.today;
    const todayRecords = this.state.attendance.filter(r => r.date === today);
    
    const html = `
      <div class="page-header">
        <div class="page-title-section">
          <h1>Attendance</h1>
          <p>${this.formatDate(today)}</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" onclick="App.showAttendanceModal()">
            <iconify-icon icon="ph:check-circle" width="18" height="18"></iconify-icon>
            Record Attendance
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Today's Records</span>
          <span class="badge badge-green">${todayRecords.length} entries</span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr><th>Person</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${todayRecords.map(r => {
                const person = this.state.people.find(p => p.id === r.personId);
                return `
                  <tr>
                    <td>
                      <div class="person-display">
                        <div class="person-avatar-sm">${person?.fullName?.charAt(0) || '?'}</div>
                        ${person?.fullName || 'Unknown'}
                      </div>
                    </td>
                    <td>${r.checkIn || '—'}</td>
                    <td>${r.checkOut || '—'}</td>
                    <td><span class="badge ${r.status === 'completed' ? 'badge-green' : 'badge-orange'}">${r.status || 'present'}</span></td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="4" style="text-align:center;padding:2rem;">No records for today</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    this.elements.main.innerHTML = html;
  },

  showAttendanceModal() {
    const html = `
      <div class="modal-header">
        <span class="modal-title">Record Attendance</span>
        <button class="btn btn-ghost btn-sm" onclick="App.closeModal()">
          <iconify-icon icon="ph:x" width="18" height="18"></iconify-icon>
        </button>
      </div>
      <div class="form-group">
        <label class="form-label">Select person</label>
        <select class="form-select" id="modalPerson">
          <option value="">Choose...</option>
          ${this.state.people.map(p => `<option value="${p.id}">${p.fullName}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:0.75rem;margin-top:1.25rem;">
        <button class="btn btn-primary" onclick="App.handleCheckIn()">Check In</button>
        <button class="btn btn-outline" onclick="App.handleCheckOut()">Check Out</button>
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancel</button>
      </div>
    `;
    this.showModal(html);
  },

  async handleCheckIn() {
    const select = document.getElementById('modalPerson');
    if (!select?.value) { this.toast('Please select a person', 'warning'); return; }
    const ok = await this.markAttendance(select.value, 'in');
    if (ok) this.closeModal();
  },

  async handleCheckOut() {
    const select = document.getElementById('modalPerson');
    if (!select?.value) { this.toast('Please select a person', 'warning'); return; }
    const ok = await this.markAttendance(select.value, 'out');
    if (ok) this.closeModal();
  },

  // People Directory
  renderPeople() {
    const html = `
      <div class="page-header">
        <div class="page-title-section">
          <h1>Directory</h1>
          <p>${this.state.people.length} people registered</p>
        </div>
        <div class="header-actions">
          <div class="search-box">
            <iconify-icon icon="ph:magnifying-glass" class="search-icon" width="16" height="16"></iconify-icon>
            <input type="text" placeholder="Search..." id="peopleSearch">
          </div>
          <button class="btn btn-primary" onclick="App.showView('register')">
            <iconify-icon icon="ph:user-circle-plus" width="18" height="18"></iconify-icon>
            Add
          </button>
        </div>
      </div>

      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr><th>Name</th><th>ID</th><th>Phone</th><th>Location</th><th></th></tr>
            </thead>
            <tbody id="peopleTable">
              ${this.state.people.map(p => `
                <tr>
                  <td>
                    <div class="person-display">
                      <div class="person-avatar-sm">${p.fullName?.charAt(0) || '?'}</div>
                      <div>
                        <div style="font-weight:500;">${p.fullName || '—'}</div>
                        <div style="font-size:0.75rem;color:var(--color-text-muted);">${p.email || 'No email'}</div>
                      </div>
                    </div>
                  </td>
                  <td><code style="font-size:0.8rem;">${p.employeeId || p.id?.slice(0,8)}</code></td>
                  <td>${p.phone || '—'}</td>
                  <td>${p.province || '—'}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" onclick="App.editPersonModal('${p.id}')">
                      <iconify-icon icon="ph:pencil-simple" width="16" height="16"></iconify-icon>
                    </button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="5" style="text-align:center;padding:2rem;">No people yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    this.elements.main.innerHTML = html;
    
    setTimeout(() => {
      const search = document.getElementById('peopleSearch');
      if (search) {
        search.addEventListener('input', (e) => {
          const term = e.target.value.toLowerCase();
          document.querySelectorAll('#peopleTable tr').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
          });
        });
      }
    }, 100);
  },

  editPersonModal(personId) {
    const person = this.state.people.find(p => p.id === personId);
    if (!person) return;
    
    const html = `
      <div class="modal-header">
        <span class="modal-title">Edit ${person.fullName}</span>
        <button class="btn btn-ghost btn-sm" onclick="App.closeModal()">
          <iconify-icon icon="ph:x" width="18" height="18"></iconify-icon>
        </button>
      </div>
      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input class="form-input" id="editName" value="${person.fullName || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input class="form-input" id="editPhone" value="${person.phone || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="editStatus">
          <option value="active" ${person.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${person.status === 'inactive' ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
      <div style="display:flex;gap:0.75rem;margin-top:1.25rem;">
        <button class="btn btn-primary" onclick="App.saveEdit('${personId}')">Save</button>
        <button class="btn btn-outline" style="color:var(--color-danger);border-color:var(--color-danger);" onclick="App.confirmDelete('${personId}')">Delete</button>
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancel</button>
      </div>
    `;
    this.showModal(html);
  },

  async saveEdit(personId) {
    const data = {
      fullName: document.getElementById('editName')?.value,
      phone: document.getElementById('editPhone')?.value,
      status: document.getElementById('editStatus')?.value
    };
    const ok = await this.updatePerson(personId, data);
    if (ok) { this.closeModal(); this.renderPeople(); }
  },

  async confirmDelete(personId) {
    if (confirm('Remove this person? This cannot be undone.')) {
      const ok = await this.deletePerson(personId);
      if (ok) { this.closeModal(); this.renderPeople(); }
    }
  },

  // Register
  renderRegister() {
    const html = `
      <div class="page-header">
        <div class="page-title-section">
          <h1>Register Person</h1>
          <p>Add a new member to the system</p>
        </div>
      </div>

      <div class="card" style="max-width:650px;">
        <form id="registerForm" onsubmit="event.preventDefault(); App.handleRegister()">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input class="form-input" id="regName" required placeholder="e.g. Mutesi Keza">
            </div>
            <div class="form-group">
              <label class="form-label">National ID *</label>
              <input class="form-input" id="regNID" required placeholder="1 1997 8 0012345678">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Phone *</label>
              <input class="form-input" id="regPhone" required placeholder="0788123456">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="form-input" id="regEmail" placeholder="email@example.com">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Gender</label>
              <select class="form-select" id="regGender">
                <option value="">Select</option>
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
                <option value="">Select</option>
                <option>Kigali City</option>
                <option>Northern Province</option>
                <option>Southern Province</option>
                <option>Eastern Province</option>
                <option>Western Province</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">District *</label>
              <input class="form-input" id="regDistrict" required placeholder="e.g. Gasabo">
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:1rem;">
            <iconify-icon icon="ph:user-circle-plus" width="18" height="18"></iconify-icon>
            Register Person
          </button>
        </form>
      </div>
    `;
    
    this.elements.main.innerHTML = html;
  },

  async handleRegister() {
    const data = {
      fullName: document.getElementById('regName')?.value,
      nationalId: document.getElementById('regNID')?.value,
      phone: document.getElementById('regPhone')?.value,
      email: document.getElementById('regEmail')?.value || null,
      gender: document.getElementById('regGender')?.value || null,
      dob: document.getElementById('regDob')?.value || null,
      province: document.getElementById('regProvince')?.value,
      district: document.getElementById('regDistrict')?.value,
      employeeId: 'EMP' + String(this.state.people.length + 1).padStart(4, '0')
    };
    
    const id = await this.addPerson(data);
    if (id) this.showView('people');
  },

  // Analytics
  renderAnalytics() {
    const stats = this.getStats();
    
    const html = `
      <div class="page-header">
        <div class="page-title-section">
          <h1>Analytics</h1>
          <p>Attendance insights & trends</p>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-label">Attendance Rate</div>
          <div class="stat-number">${stats.rate}%</div>
          <div style="margin-top:0.5rem;height:6px;background:var(--color-border-light);border-radius:3px;">
            <div style="width:${stats.rate}%;height:100%;background:var(--color-accent);border-radius:3px;"></div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Today's Turnout</div>
          <div class="stat-number">${stats.present}/${stats.total}</div>
          <div class="stat-detail">People present</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Frequent Absences</div>
          <div class="stat-number">${Math.min(stats.absent, 5)}</div>
          <div class="stat-detail">Needs attention</div>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><span class="card-title">Weekly Trend</span></div>
          <div class="chart-placeholder">Attendance chart visualization</div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Recommendations</span></div>
          <div style="display:flex;flex-direction:column;gap:0.75rem;">
            <div style="padding:0.75rem;background:var(--color-accent-soft);border-radius:8px;font-size:0.85rem;">
              <strong>Tip:</strong> Send reminders on Sunday evenings to improve Monday attendance.
            </div>
            <div style="padding:0.75rem;background:var(--color-warning-soft);border-radius:8px;font-size:0.85rem;">
              <strong>Note:</strong> Late arrivals are most common on Mondays.
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.elements.main.innerHTML = html;
  },

  // Reports
  renderReports() {
    const html = `
      <div class="page-header">
        <div class="page-title-section">
          <h1>Reports</h1>
          <p>Generate attendance reports</p>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header"><span class="card-title">Daily Summary</span></div>
          <p style="color:var(--color-text-soft);margin-bottom:1rem;font-size:0.85rem;">Today's attendance overview</p>
          <button class="btn btn-outline btn-sm">Download</button>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Weekly Report</span></div>
          <p style="color:var(--color-text-soft);margin-bottom:1rem;font-size:0.85rem;">7-day attendance analysis</p>
          <button class="btn btn-outline btn-sm">Download</button>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Monthly Report</span></div>
          <p style="color:var(--color-text-soft);margin-bottom:1rem;font-size:0.85rem;">Full month summary</p>
          <button class="btn btn-outline btn-sm">Download</button>
        </div>
      </div>
    `;
    
    this.elements.main.innerHTML = html;
  }
};

// Make App globally available
window.App = App;

// Start the application
document.addEventListener('DOMContentLoaded', () => {
  App.start();
});
