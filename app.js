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
  serverTimestamp,
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
    if (this.elements.mobileMenuBtn && this.elements
