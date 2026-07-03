/**
 * HireFlow - Premium Hiring Management System Controller
 * Highly functional client-side engine with persistent state
 */

class HireFlowApp {
    constructor() {
        // Initial Local State DB
        this.db = {
            candidates: [],
            recruiters: [],
            jobs: [],
            applications: [],
            notifications: {}
        };
        
        this.currentUser = null;
        this.currentRole = null;
        this.loginAttempts = {};
        this.activeTab = null;
        this.usingAPI = false;

        this.initTheme();
        this.showSplash();
        this.initCustomDropdowns();
        // navigate first so the home view is visible when data arrives
        this.navigate('home');
        // initDatabase() is async — it calls renderStats() + renderCurrentTab()
        // internally once data is ready, so we must NOT call renderStats() here
        // (calling it here with empty arrays caused the blank-flash race condition)
        this.initDatabase();
    }

    initCustomDropdowns() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupCustomDropdowns());
        } else {
            this.setupCustomDropdowns();
        }
    }

    setupCustomDropdowns() {
        const toggles = document.querySelectorAll('.custom-select');
        toggles.forEach(select => {
            const dropdownId = select.dataset.dropdownId;
            const menu = document.querySelector(`.custom-select-menu[data-dropdown-menu="${dropdownId}"]`);
            if (!menu) return;

            select.addEventListener('click', event => {
                event.stopPropagation();
                this.toggleDropdown(select, menu);
            });

            select.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.toggleDropdown(select, menu);
                }
            });

            menu.querySelectorAll('.custom-select-option').forEach(option => {
                option.addEventListener('click', event => {
                    event.stopPropagation();
                    this.selectDropdownOption(dropdownId, option);
                });
                option.addEventListener('keydown', event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        this.selectDropdownOption(dropdownId, option);
                    }
                });
            });
        });

        document.addEventListener('click', () => this.closeAllDropdowns());
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') this.closeAllDropdowns();
        });
    }

    toggleDropdown(select, menu) {
        const isOpen = select.getAttribute('aria-expanded') === 'true';
        this.closeAllDropdowns();
        if (!isOpen) {
            select.setAttribute('aria-expanded', 'true');
            menu.classList.remove('hidden');
            menu.classList.add('visible');
        }
    }

    closeAllDropdowns() {
        document.querySelectorAll('.custom-select').forEach(select => select.setAttribute('aria-expanded', 'false'));
        document.querySelectorAll('.custom-select-menu').forEach(menu => {
            menu.classList.remove('visible');
            menu.classList.add('hidden');
        });
    }

    selectDropdownOption(dropdownId, option) {
        const value = option.dataset.value;
        const displayText = option.textContent.trim();
        const hiddenInput = document.getElementById(dropdownId);
        if (hiddenInput) hiddenInput.value = value;

        const selectWrapper = document.querySelector(`.custom-select[data-dropdown-id="${dropdownId}"]`);
        if (selectWrapper) {
            const display = selectWrapper.querySelector('.custom-select__value');
            if (display) display.textContent = displayText;
            selectWrapper.setAttribute('aria-expanded', 'false');
        }

        const menu = document.querySelector(`.custom-select-menu[data-dropdown-menu="${dropdownId}"]`);
        if (menu) {
            menu.querySelectorAll('.custom-select-option').forEach(item => {
                item.classList.remove('active');
                item.setAttribute('aria-selected', 'false');
            });
            option.classList.add('active');
            option.setAttribute('aria-selected', 'true');
            menu.classList.remove('visible');
            menu.classList.add('hidden');
        }

        if (dropdownId === 'login-role') {
            this.handleLoginRoleChange();
        } else if (dropdownId === 'reg-role') {
            this.toggleRegRoleFields();
        } else if (dropdownId === 'search-filter-type') {
            this.handleSearch();
        }
    }

    setDropdownValue(dropdownId, value) {
        const hiddenInput = document.getElementById(dropdownId);
        if (hiddenInput) hiddenInput.value = value;
        const selectWrapper = document.querySelector(`.custom-select[data-dropdown-id="${dropdownId}"]`);
        const menu = document.querySelector(`.custom-select-menu[data-dropdown-menu="${dropdownId}"]`);
        let displayText = value;
        if (menu) {
            const matchingOption = menu.querySelector(`.custom-select-option[data-value="${value}"]`);
            if (matchingOption) {
                displayText = matchingOption.textContent.trim();
            }
            menu.querySelectorAll('.custom-select-option').forEach(item => {
                item.classList.toggle('active', item.dataset.value === value);
                item.setAttribute('aria-selected', item.dataset.value === value ? 'true' : 'false');
            });
        }
        if (selectWrapper) {
            const display = selectWrapper.querySelector('.custom-select__value');
            if (display) display.textContent = displayText;
            selectWrapper.setAttribute('aria-expanded', 'false');
        }
    }

    // ─── SPLASH SCREEN ─────────────────────────────────────────────────────
    showSplash() {
        const el = document.getElementById('splash-screen');
        if (!el) return;
        // Double rAF ensures the browser has actually painted the splash
        // before we start the hide timer — eliminates the "lag before fade" bug
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    el.style.transition = 'opacity 0.5s ease';
                    el.style.opacity = '0';
                    el.style.pointerEvents = 'none';
                    setTimeout(() => { el.style.display = 'none'; }, 520);
                }, 2200);
            });
        });
    }

    // ─── SECURITY HELPERS ──────────────────────────────────────────────────
    sanitize(s) {
        if (typeof s !== 'string') return '';
        return s.replace(/[<>"'`]/g, '').trim();
    }
    isValidEmail(e) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
    }
    stripTags(s) {
        return typeof s === 'string' ? s.replace(/<[^>]*>/g, '').trim() : '';
    }

    // ─── DATABASE SERVICE ───────────────────────────────────────────────────
    // ─── API CONFIG ──────────────────────────────────────────────────────────
    get API() { return '/api'; }

    async apiCall(method, endpoint, body = null) {
        try {
            const opts = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };
            if (body) opts.body = JSON.stringify(body);
            const res = await fetch(this.API + endpoint, opts);
            return await res.json();
        } catch (e) {
            console.warn('API unavailable, using local data:', e.message);
            return null;
        }
    }

    async initDatabase() {
        // Try loading from API (real CSV data)
        const data = await this.apiCall('GET', '/db');
        if (data && data.jobs && data.jobs.length > 0) {
            this.db = data;
            this.usingAPI = true;
            this.renderStats();
            this.renderCurrentTab();
            // Show LIVE badge
            const badge = document.getElementById('api-status-badge');
            if (badge) { badge.textContent = '● LIVE'; badge.style.background = 'var(--success-soft,#00c85133)'; badge.style.color = 'var(--success,#00c851)'; badge.style.borderColor = 'var(--success,#00c851)'; badge.title = 'Connected to CSV server — real data'; }
            console.log(`✅ Loaded real CSV data: ${data.jobs.length} jobs, ${data.candidates.length} candidates`);
            // Auto-refresh every 30 seconds to pick up C++ backend changes
            setInterval(() => { if (this.usingAPI) this.refreshDB().then(() => this.renderCurrentTab()); }, 30000);
        } else {
            // Fallback to localStorage if server not running
            this.usingAPI = false;
            const stored = localStorage.getItem('hireflow_db');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (parsed.jobs && parsed.jobs.length > 0 && parsed.recruiters && parsed.recruiters.length > 0) {
                        this.db = parsed;
                    } else { this.seedDemoData(); }
                } catch { this.seedDemoData(); }
            } else { this.seedDemoData(); }
            this.renderStats();
            this.renderCurrentTab();
            console.warn('⚠️ Server not running — using local demo data. Run server.js to use real CSV data.');
        }
    }

    renderCurrentTab() {
        if (this.activeTab) this.switchTab(this.activeTab);
    }

    async saveDatabase() {
        if (!this.usingAPI) {
            localStorage.setItem('hireflow_db', JSON.stringify(this.db));
        }
        this.renderStats();
    }

    async refreshDB() {
        if (this.usingAPI) {
            const data = await this.apiCall('GET', '/db');
            if (data) {
                this.db = data;
                this.renderStats();
            }
        }
    }

    async resetDemoData() {
        if (confirm('Reset all data to demo defaults?')) {
            localStorage.removeItem('hireflow_db');
            this.currentUser = null;
            this.currentRole = null;
            this.usingAPI = false;
            this.seedDemoData();
            this.navigate('home');
            this.showToast('Demo data restored.', 'success');
        }
    }

    seedDemoData() {
        this.db = {
            recruiters: [
                { name: "Ali Khan",    age: 40, email: "ali@techcorp.pk",   password: "pass123", company: "TechCorp Pakistan",  banned: false },
                { name: "Sara Malik",  age: 38, email: "sara@nextsol.pk",   password: "pass456", company: "NextSol Pvt Ltd",    banned: false },
                { name: "Bilal Ahmed", age: 42, email: "bilal@softvision.pk",password: "pass789", company: "SoftVision Systems", banned: false }
            ],
            candidates: [
                { name: "Abdul Basit", age: 22, email: "basit@gmail.com", password: "mypass12", skills: "Flutter, C++, Dart",        resumeSummary: "Final year NUTECH student, strong OOP", banned: false },
                { name: "Usman Raza",  age: 24, email: "usman@gmail.com", password: "mypass22", skills: "Python, Django, SQL",        resumeSummary: "Backend dev, 1 year experience",       banned: false },
                { name: "Aisha Noor",  age: 23, email: "aisha@gmail.com", password: "mypass33", skills: "React, JavaScript, CSS",     resumeSummary: "Frontend developer, portfolio ready",   banned: false }
            ],
            jobs: [
                { jobId: 1,  title: "Flutter Developer",      description: "Build cross-platform mobile apps using Flutter & Dart for our product suite.",     location: "Lahore",      skills: "Flutter, Dart, C++",          salary: 85000,  isOpen: true,  applicantCount: 2, recruiterEmail: "ali@techcorp.pk"    },
                { jobId: 2,  title: "C++ Software Engineer",  description: "Design and implement OOP-based backend systems using modern C++ standards.",        location: "Islamabad",   skills: "C++, OOP, STL, Git",          salary: 90000,  isOpen: true,  applicantCount: 1, recruiterEmail: "ali@techcorp.pk"    },
                { jobId: 3,  title: "UI/UX Designer",         description: "Create stunning user interfaces in Figma for web and mobile products.",             location: "Rawalpindi",  skills: "Figma, UI, UX, Adobe XD",     salary: 70000,  isOpen: true,  applicantCount: 0, recruiterEmail: "sara@nextsol.pk"    },
                { jobId: 4,  title: "Python Backend Dev",     description: "Build REST APIs and data pipelines using Django and PostgreSQL.",                    location: "Lahore",      skills: "Python, Django, SQL, REST",   salary: 80000,  isOpen: true,  applicantCount: 3, recruiterEmail: "sara@nextsol.pk"    },
                { jobId: 5,  title: "React Frontend Dev",     description: "Develop responsive SPAs using React, Redux and Tailwind CSS.",                      location: "Remote",      skills: "React, JavaScript, CSS, Git", salary: 75000,  isOpen: true,  applicantCount: 1, recruiterEmail: "bilal@softvision.pk"},
                { jobId: 6,  title: "DevOps Engineer",        description: "Manage CI/CD pipelines, Docker containers, and cloud infrastructure on AWS.",       location: "Islamabad",   skills: "Docker, AWS, CI/CD, Linux",   salary: 110000, isOpen: true,  applicantCount: 0, recruiterEmail: "bilal@softvision.pk"},
                { jobId: 7,  title: "Machine Learning Intern",description: "Work on NLP and classification models using TensorFlow and Python.",                 location: "Lahore",      skills: "Python, TensorFlow, ML, NLP", salary: 45000,  isOpen: true,  applicantCount: 2, recruiterEmail: "ali@techcorp.pk"    },
                { jobId: 8,  title: "Node.js Developer",      description: "Build scalable server-side applications with Node.js, Express, and MongoDB.",       location: "Karachi",     skills: "Node.js, Express, MongoDB",   salary: 78000,  isOpen: true,  applicantCount: 0, recruiterEmail: "sara@nextsol.pk"    },
                { jobId: 9,  title: "QA Test Engineer",       description: "Write automated test suites and perform manual testing on web and mobile apps.",     location: "Rawalpindi",  skills: "Selenium, Manual Testing, QA",salary: 60000,  isOpen: true,  applicantCount: 1, recruiterEmail: "bilal@softvision.pk"},
                { jobId: 10, title: "Business Analyst",       description: "Gather requirements, write user stories and work with dev teams on product delivery.",location: "Islamabad",   skills: "Business Analysis, Agile, SQL",salary: 95000, isOpen: false, applicantCount: 5, recruiterEmail: "bilal@softvision.pk"}
            ],
            applications: [
                { appId: 1, jobId: 2, candidateName: "Abdul Basit", candidateEmail: "basit@gmail.com",
                  coverLetter: "I have extensive C++ and OOP skills from NUTECH. Looking forward to contributing.",
                  status: "Hired", recruiterEmail: "ali@techcorp.pk", appliedAt: "2026-05-20 10:30:00" }
            ],
            notifications: {
                "basit@gmail.com": [
                    "Congratulations! You have been HIRED for Job #2 (C++ Software Engineer). Welcome aboard!"
                ]
            }
        };
        this.saveDatabase();
    }

    // ─── THEME CONTROLLER ────────────────────────────────────────────────────
    initTheme() {
        const theme = localStorage.getItem('hireflow_theme') || 'light';
        const applyTheme = () => {
            const icon = document.getElementById('theme-icon');
            if (theme === 'dark') {
                document.body.classList.add('dark-mode');
                if (icon) icon.className = 'fa-solid fa-sun';
            } else {
                document.body.classList.remove('dark-mode');
                if (icon) icon.className = 'fa-solid fa-moon';
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyTheme);
        } else { applyTheme(); }
    }

    toggleTheme() {
        const body = document.body;
        const icon = document.getElementById('theme-icon');
        body.classList.toggle('dark-mode');
        if (body.classList.contains('dark-mode')) {
            localStorage.setItem('hireflow_theme', 'dark');
            if (icon) icon.className = 'fa-solid fa-sun';
            this.showToast("Dark mode activated", "info");
        } else {
            localStorage.setItem('hireflow_theme', 'light');
            if (icon) icon.className = 'fa-solid fa-moon';
            this.showToast("Light mode activated", "info");
        }
    }

    // ─── ROUTING & TAB NAVIGATION ────────────────────────────────────────────
    navigate(view) {
        // Remove active class from nav-links
        document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
        
        // Hide all major views
        const views = ['view-home', 'view-home-stats', 'view-login', 'view-register', 'main-dashboard', 'tab-content-analytics'];
        views.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // Set Nav active
        const navMap = {
            'home': 'nav-home',
            'browse-jobs': 'nav-jobs',
            'analytics': 'nav-analytics',
            'login': 'nav-login',
            'register': 'nav-register'
        };
        if (navMap[view]) {
            const navLink = document.getElementById(navMap[view]);
            if (navLink) navLink.classList.add('active');
        }

        // Handle specific views
        if (view === 'home') {
            document.getElementById('view-home').classList.remove('hidden');
            document.getElementById('view-home-stats').classList.remove('hidden');
            document.getElementById('global-nav').classList.remove('hidden');
        } else if (view === 'login') {
            document.getElementById('view-login').classList.remove('hidden');
            document.getElementById('global-nav').classList.remove('hidden');
            this.resetLoginForm();
        } else if (view === 'register') {
            document.getElementById('view-register').classList.remove('hidden');
            document.getElementById('global-nav').classList.remove('hidden');
            this.resetRegisterForm();
            this.toggleRegRoleFields();
        } else if (view === 'browse-jobs') {
            if (this.currentUser) {
                // If logged in, show it inside dashboard
                this.navigateDashboard('browse-jobs');
            } else {
                document.getElementById('global-nav').classList.remove('hidden');
                document.getElementById('main-dashboard').classList.remove('hidden');
                // Hide sidebar and adjust main dashboard styles for guest
                document.querySelector('.sidebar').classList.add('hidden');
                this.switchTab('browse-jobs');
            }
        } else if (view === 'analytics') {
            document.getElementById('global-nav').classList.remove('hidden');
            document.getElementById('main-dashboard').classList.remove('hidden');
            document.querySelector('.sidebar').classList.add('hidden');
            this.switchTab('analytics');
            this.renderGuestAnalytics();
        }
    }

    navigateDashboard(tab) {
        document.getElementById('global-nav').classList.add('hidden');
        
        // Hide all major guest views to prevent overlap in SPA
        const guestViews = ['view-home', 'view-home-stats', 'view-login', 'view-register', 'tab-content-analytics'];
        guestViews.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        const dashboard = document.getElementById('main-dashboard');
        dashboard.classList.remove('hidden');
        document.querySelector('.sidebar').classList.remove('hidden');

        // Toggle Sidebar Options based on Role
        document.getElementById('sidebar-candidate-menu').classList.add('hidden');
        document.getElementById('sidebar-recruiter-menu').classList.add('hidden');
        document.getElementById('sidebar-admin-menu').classList.add('hidden');

        if (this.currentRole === 'Candidate') {
            document.getElementById('sidebar-candidate-menu').classList.remove('hidden');
        } else if (this.currentRole === 'Recruiter') {
            document.getElementById('sidebar-recruiter-menu').classList.remove('hidden');
        } else if (this.currentRole === 'Admin') {
            document.getElementById('sidebar-admin-menu').classList.remove('hidden');
        }

        // Set User Profile Badge in Sidebar
        this.updateSidebarUserBadge();

        // Switch to appropriate Tab
        this.switchTab(tab);
    }

    updateSidebarUserBadge() {
        if (!this.currentUser) return;
        const initials = this.currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        document.getElementById('user-avatar-initials').innerText = initials;
        document.getElementById('user-display-name').innerText = this.currentUser.name;
        document.getElementById('user-display-role').innerText = this.currentRole === 'Admin' ? 'Admin Operator' : this.currentRole;
    }

    switchTab(tabId) {
        this.activeTab = tabId;

        // Reset sidebar active states
        document.querySelectorAll('.sidebar-menu-item').forEach(item => item.classList.remove('active'));
        
        // Mark selected sidebar item as active
        const sidebarLinkMap = {
            'candidate-home': 'tab-candidate-home',
            'browse-jobs': 'tab-candidate-browse',
            'candidate-matches': 'tab-candidate-matches',
            'candidate-profile': 'tab-candidate-profile',
            
            'recruiter-home': 'tab-recruiter-home',
            'recruiter-jobs': 'tab-recruiter-jobs',
            'recruiter-applications': 'tab-recruiter-applications',
            'recruiter-profile': 'tab-recruiter-profile',
            
            'admin-home': 'tab-admin-home',
            'admin-users': 'tab-admin-users',
            'admin-jobs': 'tab-admin-jobs'
        };
        if (sidebarLinkMap[tabId]) {
            const activeSidebarItem = document.getElementById(sidebarLinkMap[tabId]);
            if (activeSidebarItem) activeSidebarItem.classList.add('active');
        }

        // Hide all tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));

        // Render contents of tab dynamically
        if (tabId === 'candidate-home') {
            document.getElementById('tab-content-candidate-home').classList.remove('hidden');
            this.renderCandidateDashboard();
        } else if (tabId === 'browse-jobs') {
            document.getElementById('tab-content-browse-jobs').classList.remove('hidden');
            this.renderBrowseJobs();
        } else if (tabId === 'candidate-matches') {
            document.getElementById('tab-content-candidate-matches').classList.remove('hidden');
            this.renderCandidateMatches();
        } else if (tabId === 'candidate-profile') {
            document.getElementById('tab-content-candidate-profile').classList.remove('hidden');
            this.renderCandidateProfile();
        } else if (tabId === 'recruiter-home') {
            document.getElementById('tab-content-recruiter-home').classList.remove('hidden');
            this.renderRecruiterDashboard();
        } else if (tabId === 'recruiter-jobs') {
            document.getElementById('tab-content-recruiter-jobs').classList.remove('hidden');
            this.renderRecruiterJobsList();
        } else if (tabId === 'recruiter-applications') {
            document.getElementById('tab-content-recruiter-applications').classList.remove('hidden');
            this.renderRecruiterApplicationsList();
        } else if (tabId === 'recruiter-profile') {
            document.getElementById('tab-content-recruiter-profile').classList.remove('hidden');
            this.renderRecruiterProfile();
        } else if (tabId === 'admin-home') {
            document.getElementById('tab-content-admin-home').classList.remove('hidden');
            this.renderAdminAnalytics();
        } else if (tabId === 'admin-users') {
            document.getElementById('tab-content-admin-users').classList.remove('hidden');
            this.renderAdminUsers();
        } else if (tabId === 'admin-jobs') {
            document.getElementById('tab-content-admin-jobs').classList.remove('hidden');
            this.renderAdminJobs();
        } else if (tabId === 'analytics') {
            document.getElementById('tab-content-analytics').classList.remove('hidden');
            this.renderGuestAnalytics();
        }
    }

    // ─── AUTHENTICATION FLOW ────────────────────────────────────────────────
    toggleRegRoleFields() {
        const role = document.getElementById('reg-role').value;
        const candidateFields = document.getElementById('candidate-fields');
        const recruiterFields = document.getElementById('recruiter-fields');
        
        if (role === 'Candidate') {
            candidateFields.classList.remove('hidden');
            recruiterFields.classList.add('hidden');
        } else {
            candidateFields.classList.add('hidden');
            recruiterFields.classList.remove('hidden');
        }
    }

    resetRegisterForm() {
        const fields = [
            'reg-name', 'reg-age', 'reg-email', 'reg-password',
            'reg-skills', 'reg-resume', 'reg-company'
        ];
        fields.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        this.setDropdownValue('reg-role', 'Candidate');
        this.toggleRegRoleFields();
    }

    resetLoginForm() {
        const fields = ['login-email', 'login-password', 'login-admin-code'];
        fields.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        this.setDropdownValue('login-role', 'Candidate');
        this.handleLoginRoleChange();
    }

    handleLoginRoleChange() {
        const role = document.getElementById('login-role').value;
        const emailGroup = document.getElementById('login-email-group');
        const passwordGroup = document.getElementById('login-password-group');
        const adminGroup = document.getElementById('login-admin-code-group');
        
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const adminInput = document.getElementById('login-admin-code');

        if (role === 'Admin') {
            emailGroup.classList.add('hidden');
            passwordGroup.classList.add('hidden');
            adminGroup.classList.remove('hidden');
            
            emailInput.removeAttribute('required');
            passwordInput.removeAttribute('required');
            adminInput.setAttribute('required', 'required');
        } else {
            emailGroup.classList.remove('hidden');
            passwordGroup.classList.remove('hidden');
            adminGroup.classList.add('hidden');
            
            emailInput.setAttribute('required', 'required');
            passwordInput.setAttribute('required', 'required');
            adminInput.removeAttribute('required');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const role = document.getElementById('login-role').value;

        // Admin Flow (Only requires Access Code ADMIN2024, no email or password needed)
        if (role === 'Admin') {
            const adminCode = document.getElementById('login-admin-code').value.trim();
            if (adminCode === 'ADMIN2024') {
                this.currentUser = { name: "System Admin", email: "admin@hireflow.pk" };
                this.currentRole = "Admin";
                this.showToast("Admin access approved", "success");
                this.navigateDashboard('admin-home');
            } else {
                this.showToast("Incorrect Administration Code. Access Denied.", "danger");
            }
            return;
        }

        const inputKey = document.getElementById('login-email').value.trim();
        const pw = document.getElementById('login-password').value;
        let result = null;

        if (this.usingAPI) {
            result = await this.apiCall('POST', '/login', { role, email: inputKey, password: pw });
            if (!result || result.error) {
                const attempts = (this.loginAttempts[inputKey] || 0) + 1;
                this.loginAttempts[inputKey] = attempts;
                this.showToast(result?.error || `Invalid credentials. Attempt ${attempts}/5`, "warning");
                return;
            }
            const user = result.user;
            this.currentUser = user;
        } else {
            const list = role === 'Candidate' ? this.db.candidates : this.db.recruiters;
            const user = list.find(u => ((u.email||'').toLowerCase() === inputKey.toLowerCase() || (u.name||'').toLowerCase() === inputKey.toLowerCase()));
            if (!user || user.password !== pw) {
                const attempts = (this.loginAttempts[inputKey] || 0) + 1;
                this.loginAttempts[inputKey] = attempts;
                this.showToast(`Invalid credentials. Attempt ${attempts}/5`, "warning");
                return;
            }
            if (user.banned) {
                this.showToast('Account banned. Contact administrator.', 'danger');
                return;
            }
            const { password, ...safeUser } = user;
            this.currentUser = safeUser;
        }

        this.currentRole = role;
        this.loginAttempts[inputKey] = 0;
        this.showToast(`Logged in successfully as ${this.currentUser.name}`, "success");

        if (role === 'Candidate') {
            this.checkNotifications();
            this.navigateDashboard('candidate-home');
        } else {
            this.navigateDashboard('recruiter-home');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const role     = document.getElementById('reg-role').value;
        const name     = document.getElementById('reg-name').value.trim();
        const age      = parseInt(document.getElementById('reg-age').value);
        const email    = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;

        if (age < 16 || age > 100) { this.showToast("Age must be between 16 and 100.", "warning"); return; }

        if (this.usingAPI) {
            const skills   = role === 'Candidate' ? document.getElementById('reg-skills').value.trim() : '';
            const resume   = role === 'Candidate' ? document.getElementById('reg-resume').value.trim() : '';
            const company  = role === 'Recruiter' ? document.getElementById('reg-company').value.trim() : '';
            const result = await this.apiCall('POST', '/register', { role, name, age, email, password, skills, resumeSummary: resume, company });
            if (!result) { this.showToast("Server error. Try again.", "danger"); return; }
            if (result.error) { this.showToast(result.error, "warning"); return; }
            await this.refreshDB();
        } else {
            const exists = [...this.db.candidates, ...this.db.recruiters].some(u => (u.email||'').toLowerCase() === email.toLowerCase());
            if (exists) { this.showToast("Email address already registered.", "warning"); return; }
            if (role === 'Candidate') {
                const skills = document.getElementById('reg-skills').value.trim();
                const resume = document.getElementById('reg-resume').value.trim();
                this.db.candidates.push({ name, age, email, password, skills, resumeSummary: resume, banned: false });
            } else {
                const company = document.getElementById('reg-company').value.trim();
                this.db.recruiters.push({ name, age, email, password, company, banned: false });
            }
            this.saveDatabase();
        }
        this.resetRegisterForm();
        this.showToast(`${role} Account Created! Please log in.`, "success");
        this.navigate('login');
    }

    handleLogout() {
        this.currentUser = null;
        this.currentRole = null;
        
        // Clean layouts
        document.querySelector('.sidebar').classList.add('hidden');
        document.getElementById('candidate-notifications').classList.add('hidden');
        
        this.showToast("Successfully logged out", "info");
        this.navigate('home');
    }

    // ─── CANDIDATE VIEW RENDERS ──────────────────────────────────────────────
    checkNotifications() {
        const noteContainer = document.getElementById('candidate-notifications');
        const noteMessage = document.getElementById('notification-message');
        const notes = this.db.notifications[this.currentUser.email];
        
        if (notes && notes.length > 0) {
            noteMessage.innerText = notes[notes.length - 1]; // Show latest
            noteContainer.classList.remove('hidden');
        } else {
            noteContainer.classList.add('hidden');
        }
    }

    dismissNotifications() {
        document.getElementById('candidate-notifications').classList.add('hidden');
        // Clear read notifications
        this.db.notifications[this.currentUser.email] = [];
        this.saveDatabase();
    }

    renderCandidateDashboard() {
        document.getElementById('candidate-welcome').innerText = `Welcome Back, ${this.currentUser.name}!`;

        const myApps = this.db.applications.filter(a => a.candidateEmail === this.currentUser.email);
        const total = myApps.length;
        const hiredOrAccepted = myApps.filter(a => a.status === 'Hired' || a.status === 'Accepted').length;
        const pending = myApps.filter(a => a.status === 'Pending').length;

        document.getElementById('candidate-metric-total').innerText = total;
        document.getElementById('candidate-metric-hired').innerText = hiredOrAccepted;
        document.getElementById('candidate-metric-pending').innerText = pending;

        // Render Applications Table
        const tbody = document.getElementById('candidate-applications-tbody');
        tbody.innerHTML = '';

        if (myApps.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No applications submitted yet.</td></tr>`;
            return;
        }

        myApps.forEach(app => {
            const job = this.db.jobs.find(j => j.jobId === app.jobId);
            const title = job ? job.title : `Job #${app.jobId}`;
            const company = this.db.recruiters.find(r => r.email === app.recruiterEmail)?.company || "Unknown Inc.";
            
            const badgeClass = {
                'Pending': 'badge-pending',
                'Accepted': 'badge-accepted',
                'Rejected': 'badge-rejected',
                'Hired': 'badge-hired'
            }[app.status] || 'badge-pending';

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight: 600;">${title}</td>
                    <td>${company}</td>
                    <td><span class="badge ${badgeClass}">${app.status}</span></td>
                    <td style="font-style: italic; color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        "${app.coverLetter}"
                    </td>
                </tr>
            `;
        });
    }

    renderCandidateProfile() {
        const initials = this.currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        document.getElementById('candidate-prof-avatar').innerText = initials;
        document.getElementById('candidate-prof-name').innerText = this.currentUser.name;
        document.getElementById('candidate-prof-email').innerText = this.currentUser.email;
        document.getElementById('candidate-prof-age').innerText = this.currentUser.age;
        document.getElementById('candidate-prof-resume').innerText = this.currentUser.resumeSummary || "No summary provided.";

        // Skills tags
        const tagsContainer = document.getElementById('candidate-prof-skills-tags');
        tagsContainer.innerHTML = '';
        if (this.currentUser.skills) {
            this.currentUser.skills.split(',').forEach(sk => {
                tagsContainer.innerHTML += `<span class="tag tag-match">${sk.trim()}</span>`;
            });
        } else {
            tagsContainer.innerHTML = `<span style="font-style: italic; color: var(--text-muted);">No skills added.</span>`;
        }
    }

    toggleCandidateProfileEdit(show) {
        const viewCard = document.getElementById('candidate-profile-view-card');
        const editCard = document.getElementById('candidate-profile-edit-card');

        if (show) {
            document.getElementById('candidate-edit-name').value = this.currentUser.name;
            document.getElementById('candidate-edit-age').value = this.currentUser.age;
            document.getElementById('candidate-edit-skills').value = this.currentUser.skills || '';
            document.getElementById('candidate-edit-resume').value = this.currentUser.resumeSummary || '';
            
            viewCard.classList.add('hidden');
            editCard.classList.remove('hidden');
        } else {
            viewCard.classList.remove('hidden');
            editCard.classList.add('hidden');
        }
    }

    async handleSaveCandidateProfile(e) {
        e.preventDefault();
        const name          = document.getElementById('candidate-edit-name').value.trim();
        const age           = parseInt(document.getElementById('candidate-edit-age').value);
        const skills        = document.getElementById('candidate-edit-skills').value.trim();
        const resumeSummary = document.getElementById('candidate-edit-resume').value.trim();

        if (age < 16 || age > 100) { this.showToast("Age must be between 16 and 100.", "warning"); return; }

        if (this.usingAPI) {
            const result = await this.apiCall('PUT', '/profile/candidate', { email: this.currentUser.email, name, age, skills, resumeSummary });
            if (!result || result.error) { this.showToast("Server error.", "danger"); return; }
            await this.refreshDB();
            // Re-find updated user from fresh db
            const updated = this.db.candidates.find(c => c.email === this.currentUser.email);
            if (updated) this.currentUser = updated;
        } else {
            const cand = this.db.candidates.find(c => c.email === this.currentUser.email);
            if (cand) { cand.name = name; cand.age = age; cand.skills = skills; cand.resumeSummary = resumeSummary; }
            this.db.applications.forEach(a => { if (a.candidateEmail === this.currentUser.email) a.candidateName = name; });
            this.currentUser.name = name; this.currentUser.age = age;
            this.currentUser.skills = skills; this.currentUser.resumeSummary = resumeSummary;
            this.saveDatabase();
        }

        this.updateSidebarUserBadge();
        this.renderCandidateProfile();
        this.toggleCandidateProfileEdit(false);
        this.showToast("Profile updated successfully!", "success");
    }

    // ─── RECRUITER VIEW RENDERS ──────────────────────────────────────────────
    renderRecruiterDashboard() {
        document.getElementById('recruiter-welcome').innerText = `Welcome Back, ${this.currentUser.name}!`;
        document.getElementById('recruiter-company-name').innerText = this.currentUser.company;

        const myJobs = this.db.jobs.filter(j => j.recruiterEmail === this.currentUser.email);
        const myApps = this.db.applications.filter(a => a.recruiterEmail === this.currentUser.email);

        const activePostings = myJobs.filter(j => j.isOpen).length;
        const totalApps = myApps.filter(a => a.status === 'Pending').length;
        const closedCount = myJobs.filter(j => !j.isOpen).length;

        document.getElementById('recruiter-metric-active').innerText = activePostings;
        document.getElementById('recruiter-metric-apps').innerText = totalApps;
        document.getElementById('recruiter-metric-closed').innerText = closedCount;

        // Render Received Applications (Pending)
        const tbody = document.getElementById('recruiter-applications-tbody');
        tbody.innerHTML = '';

        const pendingApps = myApps.filter(a => a.status === 'Pending');

        if (pendingApps.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No pending applications received yet.</td></tr>`;
        } else {
            pendingApps.forEach(app => {
                const job = myJobs.find(j => j.jobId === app.jobId);
                const jobTitle = job ? job.title : `Job #${app.jobId}`;
                const candidate = this.db.candidates.find(c => c.email === app.candidateEmail);
                const candSkills = candidate ? candidate.skills : "N/A";
                const matchScore = candidate && job ? this.calculateSkillMatch(candidate.skills, job.skills) : 0;

                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight: 600;">${jobTitle}</td>
                        <td>
                            <div style="font-weight: 600;">${app.candidateName}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${app.candidateEmail}</div>
                        </td>
                        <td><div style="max-width: 180px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${candSkills}</div></td>
                        <td><span class="match-percentage">${matchScore}%</span></td>
                        <td>
                            <div class="action-row">
                                <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="app.updateAppStatus(${app.appId}, 'Accepted')">Accept</button>
                                <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="app.updateAppStatus(${app.appId}, 'Rejected')">Reject</button>
                                <button class="btn btn-primary" style="background-color: var(--success); padding: 6px 12px; font-size: 0.8rem;" onclick="app.updateAppStatus(${app.appId}, 'Hired')">Hire</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        // Render Quick Jobs Summary List (Right column)
        const summaryList = document.getElementById('recruiter-jobs-summary-list');
        summaryList.innerHTML = '';

        if (myJobs.length === 0) {
            summaryList.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-style: italic;">No jobs posted yet.</p>`;
        } else {
            myJobs.slice(0, 4).forEach(job => {
                const statusBadge = job.isOpen ? 
                    `<span class="badge badge-accepted">OPEN</span>` : 
                    `<span class="badge badge-closed">CLOSED</span>`;

                summaryList.innerHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; background-color: var(--bg-primary); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border);">
                        <div>
                            <div style="font-weight: 600; font-size: 0.95rem;">${job.title}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${job.location} &middot; PKR ${job.salary.toLocaleString()}</div>
                        </div>
                        <div>${statusBadge}</div>
                    </div>
                `;
            });
        }
    }

    renderRecruiterJobsList() {
        const listContainer = document.getElementById('recruiter-jobs-full-list');
        listContainer.innerHTML = '';

        const myJobs = this.db.jobs.filter(j => j.recruiterEmail === this.currentUser.email);

        if (myJobs.length === 0) {
            listContainer.innerHTML = `<div class="section-card" style="text-align: center; font-style: italic; color: var(--text-muted);">You have not posted any jobs yet.</div>`;
            return;
        }

        myJobs.forEach(job => {
            const statusBadge = job.isOpen ? 
                `<span class="badge badge-accepted">OPEN</span>` : 
                `<span class="badge badge-closed">CLOSED</span>`;

            const actionButton = job.isOpen ?
                `<button class="btn btn-secondary" onclick="app.closeJob(${job.jobId})">Close Post</button>` :
                `<span style="font-size: 0.9rem; color: var(--text-muted); font-style: italic;">Post Completed</span>`;

            listContainer.innerHTML += `
                <div class="job-item">
                    <div class="job-item-header">
                        <div>
                            <h2>${job.title}</h2>
                            <div class="job-meta" style="margin-top: 8px;">
                                <span><i class="fa-solid fa-location-dot"></i> ${job.location}</span>
                                <span><i class="fa-solid fa-coins"></i> PKR ${job.salary.toLocaleString()}</span>
                                <span><i class="fa-solid fa-users"></i> Applicants: ${job.applicantCount}/15</span>
                            </div>
                        </div>
                        <div>${statusBadge}</div>
                    </div>
                    <div>
                        <p>${job.description}</p>
                    </div>
                    <div class="job-skills">
                        <strong>Required Skills:</strong>
                        ${job.skills.split(',').map(sk => `<span class="tag">${sk.trim()}</span>`).join('')}
                    </div>
                    <div class="job-footer">
                        <span style="font-size: 0.85rem; color: var(--text-muted);">Job ID: ${job.jobId}</span>
                        ${actionButton}
                    </div>
                </div>
            `;
        });
    }

    renderRecruiterApplicationsList() {
        const tbody = document.getElementById('recruiter-all-applications-tbody');
        tbody.innerHTML = '';

        const myJobs = this.db.jobs.filter(j => j.recruiterEmail === this.currentUser.email);
        const myApps = this.db.applications.filter(a => a.recruiterEmail === this.currentUser.email);

        if (myApps.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No applications received yet.</td></tr>`;
            return;
        }

        myApps.forEach(app => {
            const job = myJobs.find(j => j.jobId === app.jobId);
            const jobTitle = job ? job.title : `Job #${app.jobId}`;
            const candidate = this.db.candidates.find(c => c.email === app.candidateEmail);
            const matchScore = candidate && job ? this.calculateSkillMatch(candidate.skills, job.skills) : 0;

            const badgeClass = {
                'Pending': 'badge-pending',
                'Accepted': 'badge-accepted',
                'Rejected': 'badge-rejected',
                'Hired': 'badge-hired'
            }[app.status] || 'badge-pending';

            let actionColumn = `<span style="font-size: 0.9rem; color: var(--text-muted); font-style: italic;">No actions left</span>`;
            
            if (app.status === 'Pending') {
                actionColumn = `
                    <div class="action-row">
                        <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="app.updateAppStatus(${app.appId}, 'Accepted')">Accept</button>
                        <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="app.updateAppStatus(${app.appId}, 'Rejected')">Reject</button>
                    </div>
                `;
            } else if (app.status === 'Accepted') {
                actionColumn = `
                    <button class="btn btn-primary" style="background-color: var(--success); padding: 6px 12px; font-size: 0.8rem;" onclick="app.updateAppStatus(${app.appId}, 'Hired')">Hire Candidate</button>
                `;
            }

            tbody.innerHTML += `
                <tr>
                    <td>#${app.appId}</td>
                    <td style="font-weight: 600;">${jobTitle}</td>
                    <td>
                        <div style="font-weight: 600;">${app.candidateName}</div>
                        <div style="font-size: 0.8rem; font-style: italic; color: var(--text-muted);">"${app.coverLetter}"</div>
                    </td>
                    <td>${app.candidateEmail}</td>
                    <td><span class="badge ${badgeClass}">${app.status}</span></td>
                    <td><span class="match-percentage">${matchScore}%</span></td>
                    <td>${actionColumn}</td>
                </tr>
            `;
        });
    }

    renderRecruiterProfile() {
        const initials = this.currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        document.getElementById('recruiter-prof-avatar').innerText = initials;
        document.getElementById('recruiter-prof-name').innerText = this.currentUser.name;
        document.getElementById('recruiter-prof-email').innerText = this.currentUser.email;
        document.getElementById('recruiter-prof-age').innerText = this.currentUser.age;
        document.getElementById('recruiter-prof-company').innerText = this.currentUser.company;

        const myJobsCount = this.db.jobs.filter(j => j.recruiterEmail === this.currentUser.email).length;
        const myAppsCount = this.db.applications.filter(a => a.recruiterEmail === this.currentUser.email).length;

        document.getElementById('recruiter-prof-jobs-count').innerText = myJobsCount;
        document.getElementById('recruiter-prof-apps-count').innerText = myAppsCount;
    }

    toggleRecruiterProfileEdit(show) {
        const viewCard = document.getElementById('recruiter-profile-view-card');
        const editCard = document.getElementById('recruiter-profile-edit-card');

        if (show) {
            document.getElementById('recruiter-edit-name').value = this.currentUser.name;
            document.getElementById('recruiter-edit-age').value = this.currentUser.age;
            document.getElementById('recruiter-edit-company').value = this.currentUser.company;
            
            viewCard.classList.add('hidden');
            editCard.classList.remove('hidden');
        } else {
            viewCard.classList.remove('hidden');
            editCard.classList.add('hidden');
        }
    }

    async handleSaveRecruiterProfile(e) {
        e.preventDefault();
        const name    = document.getElementById('recruiter-edit-name').value.trim();
        const age     = parseInt(document.getElementById('recruiter-edit-age').value);
        const company = document.getElementById('recruiter-edit-company').value.trim();

        if (age < 16 || age > 100) { this.showToast("Age must be between 16 and 100.", "warning"); return; }

        if (this.usingAPI) {
            const result = await this.apiCall('PUT', '/profile/recruiter', { email: this.currentUser.email, name, age, company });
            if (!result || result.error) { this.showToast("Server error.", "danger"); return; }
            await this.refreshDB();
            const updated = this.db.recruiters.find(r => r.email === this.currentUser.email);
            if (updated) this.currentUser = updated;
        } else {
            const rec = this.db.recruiters.find(r => r.email === this.currentUser.email);
            if (rec) { rec.name = name; rec.age = age; rec.company = company; }
            this.currentUser.name = name; this.currentUser.age = age; this.currentUser.company = company;
            this.saveDatabase();
        }

        this.updateSidebarUserBadge();
        this.renderRecruiterProfile();
        this.toggleRecruiterProfileEdit(false);
        this.showToast("Recruiter profile updated successfully!", "success");
    }

    // ─── ADMIN PANEL RENDERS ────────────────────────────────────────────────
    renderAdminAnalytics() {
        const totalCandidates = this.db.candidates.length;
        const totalRecruiters = this.db.recruiters.length;
        const totalJobs = this.db.jobs.length;
        const totalApps = this.db.applications.length;

        document.getElementById('admin-metric-candidates').innerText = totalCandidates;
        document.getElementById('admin-metric-recruiters').innerText = totalRecruiters;
        document.getElementById('admin-metric-jobs').innerText = totalJobs;
        document.getElementById('admin-metric-apps').innerText = totalApps;

        // Application distribution
        const hired = this.db.applications.filter(a => a.status === 'Hired').length;
        const accepted = this.db.applications.filter(a => a.status === 'Accepted').length;
        const rejected = this.db.applications.filter(a => a.status === 'Rejected').length;
        const pending = this.db.applications.filter(a => a.status === 'Pending').length;

        document.getElementById('admin-metric-funnel-hired').innerText = hired;
        document.getElementById('admin-metric-funnel-accepted').innerText = accepted;
        document.getElementById('admin-metric-funnel-rejected').innerText = rejected;
        document.getElementById('admin-metric-funnel-pending').innerText = pending;

        // Platform integrity stats
        const banned = [...this.db.candidates, ...this.db.recruiters].filter(u => u.banned).length;
        const closed = this.db.jobs.filter(j => !j.isOpen).length;

        document.getElementById('admin-metric-banned-count').innerText = banned;
        document.getElementById('admin-metric-closed-jobs').innerText = closed;
    }

    renderAdminUsers() {
        // Recruiters Render
        const rTbody = document.getElementById('admin-recruiters-tbody');
        rTbody.innerHTML = '';
        
        this.db.recruiters.forEach(rec => {
            const statusColor = rec.banned ? 'var(--danger)' : 'var(--success)';
            const statusText = rec.banned ? 'Banned' : 'Active';
            const banButtonText = rec.banned ? 'Unban' : 'Ban';
            const banButtonClass = rec.banned ? 'btn-primary' : 'btn-danger';

            rTbody.innerHTML += `
                <tr>
                    <td style="font-weight: 600;">${rec.name}</td>
                    <td>${rec.age}</td>
                    <td>${rec.email}</td>
                    <td>${rec.company}</td>
                    <td style="font-weight: 600; color: ${statusColor}">${statusText}</td>
                    <td>
                        <div class="action-row">
                            <button class="btn ${banButtonClass}" style="padding: 6px 12px; font-size: 0.8rem;" onclick="app.toggleBanUser('${rec.email}', 'Recruiter')">${banButtonText}</button>
                            <button class="btn btn-secondary" style="color: var(--danger); border-color: var(--danger); padding: 6px 12px; font-size: 0.8rem;" onclick="app.deleteUser('${rec.email}', 'Recruiter')">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        // Candidates Render
        const cTbody = document.getElementById('admin-candidates-tbody');
        cTbody.innerHTML = '';

        this.db.candidates.forEach(cand => {
            const statusColor = cand.banned ? 'var(--danger)' : 'var(--success)';
            const statusText = cand.banned ? 'Banned' : 'Active';
            const banButtonText = cand.banned ? 'Unban' : 'Ban';
            const banButtonClass = cand.banned ? 'btn-primary' : 'btn-danger';

            cTbody.innerHTML += `
                <tr>
                    <td style="font-weight: 600;">${cand.name}</td>
                    <td>${cand.age}</td>
                    <td>${cand.email}</td>
                    <td><div style="max-width: 180px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${cand.skills || 'N/A'}</div></td>
                    <td style="font-weight: 600; color: ${statusColor}">${statusText}</td>
                    <td>
                        <div class="action-row">
                            <button class="btn ${banButtonClass}" style="padding: 6px 12px; font-size: 0.8rem;" onclick="app.toggleBanUser('${cand.email}', 'Candidate')">${banButtonText}</button>
                            <button class="btn btn-secondary" style="color: var(--danger); border-color: var(--danger); padding: 6px 12px; font-size: 0.8rem;" onclick="app.deleteUser('${cand.email}', 'Candidate')">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    renderAdminJobs() {
        const tbody = document.getElementById('admin-jobs-tbody');
        tbody.innerHTML = '';

        this.db.jobs.forEach(job => {
            const company = this.db.recruiters.find(r => r.email === job.recruiterEmail)?.company || "Unknown Co.";
            const statusBadge = job.isOpen ? 
                `<span class="badge badge-accepted">OPEN</span>` : 
                `<span class="badge badge-closed">CLOSED</span>`;

            tbody.innerHTML += `
                <tr>
                    <td>#${job.jobId}</td>
                    <td style="font-weight: 600;">${job.title}</td>
                    <td>${company}</td>
                    <td>${job.location}</td>
                    <td>PKR ${job.salary.toLocaleString()}</td>
                    <td>${job.applicantCount}/15</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8rem;" onclick="app.deleteJob(${job.jobId})">Delete</button>
                    </td>
                </tr>
            `;
        });
    }

    // ─── GUEST FLOWS ─────────────────────────────────────────────────────────
    renderGuestAnalytics() {
        const totalCandidates = this.db.candidates.length;
        const totalRecruiters = this.db.recruiters.length;
        const totalJobs = this.db.jobs.length;
        const totalApps = this.db.applications.length;

        // Cloned elements fill
        const container = document.getElementById('guest-analytics-metrics');
        container.innerHTML = `
            <div class="metric-card">
                <div class="metric-details">
                    <h3>Total Recruiters</h3>
                    <div class="number">${totalRecruiters}</div>
                </div>
                <div class="metric-icon"><i class="fa-solid fa-building"></i></div>
            </div>
            <div class="metric-card">
                <div class="metric-details">
                    <h3>Total Candidates</h3>
                    <div class="number">${totalCandidates}</div>
                </div>
                <div class="metric-icon"><i class="fa-solid fa-users"></i></div>
            </div>
            <div class="metric-card">
                <div class="metric-details">
                    <h3>Total Jobs Offered</h3>
                    <div class="number">${totalJobs}</div>
                </div>
                <div class="metric-icon"><i class="fa-solid fa-briefcase"></i></div>
            </div>
            <div class="metric-card">
                <div class="metric-details">
                    <h3>Total Applications</h3>
                    <div class="number">${totalApps}</div>
                </div>
                <div class="metric-icon"><i class="fa-solid fa-envelope-open-text"></i></div>
            </div>
        `;

        const funnelContainer = document.getElementById('guest-analytics-funnel');
        const hired = this.db.applications.filter(a => a.status === 'Hired').length;
        const accepted = this.db.applications.filter(a => a.status === 'Accepted').length;
        const pending = this.db.applications.filter(a => a.status === 'Pending').length;
        
        funnelContainer.innerHTML = `
            <div class="metric-card" style="border-color: var(--success); flex-direction: column; text-align: center; gap: 10px;">
                <div class="number" style="color: var(--success); font-size: 2.5rem;">${hired}</div>
                <h3>Candidates Hired</h3>
            </div>
            <div class="metric-card" style="border-color: var(--primary); flex-direction: column; text-align: center; gap: 10px;">
                <div class="number" style="color: var(--primary); font-size: 2.5rem;">${accepted}</div>
                <h3>Applications Accepted</h3>
            </div>
            <div class="metric-card" style="border-color: var(--warning); flex-direction: column; text-align: center; gap: 10px;">
                <div class="number" style="color: var(--warning); font-size: 2.5rem;">${pending}</div>
                <h3>Pending Under Review</h3>
            </div>
        `;
    }

    renderStats() {
        // Landing Page Stats — real counts from actual data
        const candEl = document.getElementById('guest-stat-candidates');
        const compEl = document.getElementById('guest-stat-companies');
        const jobsEl = document.getElementById('guest-stat-jobs');

        const realCandidates = this.db.candidates.length;
        const realCompanies  = new Set(this.db.recruiters.map(r => r.company).filter(c => c)).size;
        const realOpenJobs   = this.db.jobs.filter(j => j.isOpen).length;

        if (candEl) candEl.innerText = realCandidates;
        if (compEl) compEl.innerText = realCompanies;
        if (jobsEl) jobsEl.innerText = realOpenJobs;
    }

    // ─── SEARCH & FILTER & SKILL MATCH SERVICE ──────────────────────────────
    calculateSkillMatch(candSkills, jobSkills) {
        if (!jobSkills || jobSkills === "N/A" || !candSkills) return 0;
        const haystack = candSkills.toLowerCase();
        const needle = jobSkills.toLowerCase();
        
        const tokens = needle.split(/[\s,]+/).filter(t => t.trim() !== "");
        if (tokens.length === 0) return 0;
        
        let matched = 0;
        tokens.forEach(token => {
            let cleanToken = token.replace(/[,.]/g, "").trim();
            if (cleanToken && haystack.includes(cleanToken)) {
                matched++;
            }
        });
        
        return Math.round((matched * 100) / tokens.length);
    }

    renderBrowseJobs() {
        const query = document.getElementById('search-query').value.toLowerCase();
        const type = document.getElementById('search-filter-type').value;
        const minSalaryInput = document.getElementById('search-salary-min').value;
        const minSalary = minSalaryInput ? parseFloat(minSalaryInput) : 0;

        const listContainer = document.getElementById('browse-jobs-list');
        listContainer.innerHTML = '';

        // Filter open jobs
        const openJobs = this.db.jobs.filter(j => j.isOpen);
        
        let filtered = openJobs.filter(job => {
            // Salary check
            if (job.salary < minSalary) return false;

            const recruiter = this.db.recruiters.find(r => r.email === job.recruiterEmail);
            if (recruiter && recruiter.banned) return false;
            const companyName = recruiter ? recruiter.company.toLowerCase() : "";

            if (!query) return true;

            if (type === 'skill') {
                return job.skills.toLowerCase().includes(query);
            } else if (type === 'location') {
                return job.location.toLowerCase().includes(query);
            } else if (type === 'company') {
                return companyName.includes(query);
            } else if (type === 'salary') {
                return job.salary >= parseFloat(query);
            } else {
                // All Fields search
                return job.title.toLowerCase().includes(query) ||
                       job.description.toLowerCase().includes(query) ||
                       job.skills.toLowerCase().includes(query) ||
                       job.location.toLowerCase().includes(query) ||
                       companyName.includes(query);
            }
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = `<div class="section-card" style="text-align: center; font-style: italic; color: var(--text-muted);">No open jobs match your criteria.</div>`;
            return;
        }

        filtered.forEach(job => {
            const recruiter = this.db.recruiters.find(r => r.email === job.recruiterEmail);
            const company = recruiter ? recruiter.company : "Unknown Co.";
            
            // Skill match display if Candidate is logged in
            let matchBlock = '';
            let applyButton = `<button class="btn btn-primary" onclick="app.navigate('login')">Login to Apply</button>`;

            if (this.currentUser && this.currentRole === 'Candidate') {
                const score = this.calculateSkillMatch(this.currentUser.skills, job.skills);
                matchBlock = `<span class="match-percentage" style="color: ${score >= 50 ? 'var(--success)' : 'var(--warning)'}"><i class="fa-solid fa-wand-magic-sparkles"></i> Skill Match: ${score}%</span>`;
                
                // Check if already applied
                const alreadyApplied = this.db.applications.some(a => a.jobId === job.jobId && a.candidateEmail === this.currentUser.email);
                
                if (alreadyApplied) {
                    applyButton = `<button class="btn btn-secondary" disabled style="cursor: not-allowed; opacity: 0.6;">Applied</button>`;
                } else if (job.applicantCount >= 15) {
                    applyButton = `<button class="btn btn-secondary" disabled style="cursor: not-allowed; opacity: 0.6;">Full (15/15)</button>`;
                } else {
                    applyButton = `<button class="btn btn-primary" onclick="app.openApplyJobModal(${job.jobId}, '${job.title.replace(/'/g, "\\'")}')">Apply Now</button>`;
                }
            }

            listContainer.innerHTML += `
                <div class="job-item">
                    <div class="job-item-header">
                        <div>
                            <h2>${job.title}</h2>
                            <div class="job-meta" style="margin-top: 8px;">
                                <span><i class="fa-solid fa-building"></i> <strong>${company}</strong></span>
                                <span><i class="fa-solid fa-location-dot"></i> ${job.location}</span>
                                <span><i class="fa-solid fa-coins"></i> PKR ${job.salary.toLocaleString()}</span>
                                <span><i class="fa-solid fa-users"></i> Applicants: ${job.applicantCount}/15</span>
                            </div>
                        </div>
                        <div>
                            <span class="badge badge-accepted">OPEN</span>
                        </div>
                    </div>
                    <div>
                        <p>${job.description}</p>
                    </div>
                    <div class="job-skills">
                        <strong>Required Skills:</strong>
                        ${job.skills.split(',').map(sk => `<span class="tag">${sk.trim()}</span>`).join('')}
                    </div>
                    <div class="job-footer">
                        ${matchBlock}
                        ${applyButton}
                    </div>
                </div>
            `;
        });
    }

    renderCandidateMatches() {
        const listContainer = document.getElementById('candidate-matches-list');
        listContainer.innerHTML = '';

        const openJobs = this.db.jobs.filter(j => j.isOpen && j.applicantCount < 15);
        let found = false;

        openJobs.forEach(job => {
            const recruiter = this.db.recruiters.find(r => r.email === job.recruiterEmail);
            if (recruiter && recruiter.banned) return;
            const company = recruiter ? recruiter.company : "Unknown Co.";
            
            const score = this.calculateSkillMatch(this.currentUser.skills, job.skills);
            
            // Score >= 30 threshold (mimics C++)
            if (score >= 30) {
                found = true;
                const alreadyApplied = this.db.applications.some(a => a.jobId === job.jobId && a.candidateEmail === this.currentUser.email);
                
                const applyButton = alreadyApplied ?
                    `<button class="btn btn-secondary" disabled>Applied</button>` :
                    `<button class="btn btn-primary" onclick="app.openApplyJobModal(${job.jobId}, '${job.title.replace(/'/g, "\\'")}')">Apply Now</button>`;

                listContainer.innerHTML += `
                    <div class="job-item" style="border-left: 4px solid var(--success);">
                        <div class="job-item-header">
                            <div>
                                <h2>${job.title}</h2>
                                <div class="job-meta" style="margin-top: 8px;">
                                    <span><i class="fa-solid fa-building"></i> <strong>${company}</strong></span>
                                    <span><i class="fa-solid fa-location-dot"></i> ${job.location}</span>
                                    <span><i class="fa-solid fa-coins"></i> PKR ${job.salary.toLocaleString()}</span>
                                </div>
                            </div>
                            <div>
                                <span class="badge badge-hired" style="font-size: 0.9rem;">Match score: ${score}%</span>
                            </div>
                        </div>
                        <div>
                            <p>${job.description}</p>
                        </div>
                        <div class="job-skills">
                            <strong>Required:</strong>
                            ${job.skills.split(',').map(sk => `<span class="tag tag-match">${sk.trim()}</span>`).join('')}
                        </div>
                        <div class="job-footer">
                            <span style="font-size: 0.85rem; color: var(--text-muted);">Recommended for Flutter & Dart candidates</span>
                            ${applyButton}
                        </div>
                    </div>
                `;
            }
        });

        if (!found) {
            listContainer.innerHTML = `<div class="section-card" style="text-align: center; font-style: italic; color: var(--text-muted);">No strong matches found (>= 30%) for your current profile skills.</div>`;
        }
    }

    handleSearch() {
        this.renderBrowseJobs();
    }

    // ─── ACTION IMPLEMENTATIONS ──────────────────────────────────────────────
    openPostJobModal() {
        document.getElementById('job-title').value = '';
        document.getElementById('job-desc').value = '';
        document.getElementById('job-loc').value = '';
        document.getElementById('job-skills').value = '';
        document.getElementById('job-salary').value = '';
        this.openModal('post-job');
    }

    async handlePostJob(e) {
        e.preventDefault();
        const title       = document.getElementById('job-title').value.trim();
        const description = document.getElementById('job-desc').value.trim();
        const location    = document.getElementById('job-loc').value.trim();
        const skills      = document.getElementById('job-skills').value.trim();
        const salary      = parseFloat(document.getElementById('job-salary').value);

        if (this.usingAPI) {
            const result = await this.apiCall('POST', '/job', {
                title, description, location, skills, salary,
                recruiterEmail: this.currentUser.email
            });
            if (!result || result.error) { this.showToast(result?.error || "Server error.", "danger"); return; }
            await this.refreshDB();
        } else {
            const newId = this.db.jobs.reduce((max, j) => j.jobId > max ? j.jobId : max, 0) + 1;
            this.db.jobs.push({ jobId: newId, title, description, location, skills, salary, isOpen: true, applicantCount: 0, recruiterEmail: this.currentUser.email });
            this.saveDatabase();
        }

        this.showToast("Job successfully posted!", "success");
        this.closeModal('post-job');
        this.switchTab(this.activeTab);
    }

    openApplyJobModal(jobId, jobTitle) {
        document.getElementById('apply-job-id').value = jobId;
        document.getElementById('apply-job-title').innerText = `Apply for '${jobTitle}'`;
        document.getElementById('apply-cover').value = '';
        this.openModal('apply-job');
    }

    async handleApplyJob(e) {
        e.preventDefault();
        const jobId      = parseInt(document.getElementById('apply-job-id').value);
        const coverLetter = document.getElementById('apply-cover').value.trim();

        const job = this.db.jobs.find(j => j.jobId === jobId);
        if (!job || !job.isOpen) { this.showToast("Job is closed or no longer available.", "danger"); this.closeModal('apply-job'); return; }
        if (job.applicantCount >= 15) { this.showToast("Job has reached maximum applicants (15).", "danger"); this.closeModal('apply-job'); return; }

        const alreadyApplied = this.db.applications.some(a => a.jobId === jobId && a.candidateEmail === this.currentUser.email);
        if (alreadyApplied) { this.showToast("You have already applied for this job.", "warning"); this.closeModal('apply-job'); return; }

        if (this.usingAPI) {
            const result = await this.apiCall('POST', '/apply', {
                jobId, coverLetter,
                candidateName:  this.currentUser.name,
                candidateEmail: this.currentUser.email
            });
            if (!result || result.error) { this.showToast(result?.error || "Server error.", "danger"); return; }
            await this.refreshDB();
        } else {
            const newAppId = this.db.applications.reduce((max, a) => a.appId > max ? a.appId : max, 0) + 1;
            this.db.applications.push({ appId: newAppId, jobId, candidateName: this.currentUser.name, candidateEmail: this.currentUser.email, coverLetter, status: "Pending", recruiterEmail: job.recruiterEmail, appliedAt: new Date().toISOString().substring(0,19).replace('T',' ') });
            job.applicantCount++;
            this.saveDatabase();
        }

        this.showToast("Application submitted successfully!", "success");
        this.closeModal('apply-job');
        if (job.applicantCount >= 15) this.showToast(`Job #${jobId} is now FULL.`, "warning");
        this.switchTab(this.activeTab);
    }

    async updateAppStatus(appId, nextStatus) {
        if (this.usingAPI) {
            const result = await this.apiCall('POST', '/application/status', { appId, status: nextStatus });
            if (!result || result.error) { this.showToast("Server error updating status.", "danger"); return; }
            await this.refreshDB();
        } else {
            const app = this.db.applications.find(a => a.appId === appId);
            if (!app) return;
            app.status = nextStatus;
            if (nextStatus === 'Hired') {
                if (!this.db.notifications[app.candidateEmail]) this.db.notifications[app.candidateEmail] = [];
                const job = this.db.jobs.find(j => j.jobId === app.jobId);
                this.db.notifications[app.candidateEmail].push(`Congratulations! You have been HIRED for Job #${app.jobId}${job ? ' (' + job.title + ')' : ''}. Welcome aboard!`);
                if (job) job.isOpen = false;
            }
            this.saveDatabase();
        }
        this.showToast(`Application #${appId} set to '${nextStatus}'`, "success");
        this.switchTab(this.activeTab);
    }

    async closeJob(jobId) {
        if (this.usingAPI) {
            await this.apiCall('PUT', `/job/${jobId}/toggle`);
            await this.refreshDB();
        } else {
            const job = this.db.jobs.find(j => j.jobId === jobId);
            if (job) job.isOpen = false;
            this.saveDatabase();
        }
        this.showToast(`Job #${jobId} has been CLOSED.`, "success");
        this.switchTab(this.activeTab);
    }

    async toggleBanUser(email, role) {
        const list = role === 'Candidate' ? this.db.candidates : this.db.recruiters;
        const user = list.find(u => u.email === email);
        if (!user) return;
        const newBanned = !user.banned;
        if (this.usingAPI) {
            await this.apiCall('POST', '/admin/ban', { email, banned: newBanned });
            await this.refreshDB();
        } else {
            user.banned = newBanned;
            this.saveDatabase();
        }
        this.showToast(`${user.name} has been ${newBanned ? 'Banned' : 'Unbanned'}!`, "success");
        this.switchTab(this.activeTab);
    }

    async deleteUser(email, role) {
        if (!confirm(`Permanently delete user: ${email}?`)) return;
        if (this.usingAPI) {
            await this.apiCall('DELETE', '/admin/user', { email });
            await this.refreshDB();
        } else {
            if (role === 'Candidate') {
                this.db.candidates = this.db.candidates.filter(c => c.email !== email);
                this.db.applications = this.db.applications.filter(a => a.candidateEmail !== email);
            } else {
                const jobIds = this.db.jobs.filter(j => j.recruiterEmail === email).map(j => j.jobId);
                this.db.recruiters = this.db.recruiters.filter(r => r.email !== email);
                this.db.jobs = this.db.jobs.filter(j => j.recruiterEmail !== email);
                this.db.applications = this.db.applications.filter(a => !jobIds.includes(a.jobId));
            }
            this.saveDatabase();
        }
        this.showToast("User deleted successfully.", "success");
        this.switchTab(this.activeTab);
    }

    async deleteJob(jobId) {
        if (!confirm(`Permanently delete Job #${jobId}?`)) return;
        if (this.usingAPI) {
            await this.apiCall('DELETE', `/job/${jobId}`);
            await this.refreshDB();
        } else {
            this.db.jobs = this.db.jobs.filter(j => j.jobId !== jobId);
            this.db.applications = this.db.applications.filter(a => a.jobId !== jobId);
            this.saveDatabase();
        }
        this.showToast(`Job #${jobId} deleted.`, "success");
        this.switchTab(this.activeTab);
    }

    // ─── MODALS CONTROLLERS ──────────────────────────────────────────────────
    openModal(modalId) {
        const overlay = document.getElementById(`modal-${modalId}`);
        if (overlay) overlay.classList.add('active');
    }

    closeModal(modalId) {
        const overlay = document.getElementById(`modal-${modalId}`);
        if (overlay) overlay.classList.remove('active');
    }

    // ─── TOAST / BANNER NOTIFICATIONS ────────────────────────────────────────
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const iconClass = {
            'success': 'fa-circle-check',
            'danger': 'fa-triangle-exclamation',
            'warning': 'fa-circle-exclamation',
            'info': 'fa-circle-info'
        }[type] || 'fa-circle-check';

        toast.innerHTML = `
            <i class="fa-solid ${iconClass}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Auto remove toast
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, 3500);
    }
}

// Instantiate App
window.app = new HireFlowApp();
// No-op guard for any remaining references
if (!window.app.resetDemoData) window.app.resetDemoData = () => {};
