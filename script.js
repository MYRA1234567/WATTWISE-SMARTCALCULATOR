// System & User Session State
let tariffRate = 15.0615; // Updated to October 2026 Meralco rate (or set to 15.0200)
let authMode = 'login';

// Active session user
let currentUser = JSON.parse(localStorage.getItem('wattwise_active_session')) || null;

// Persistent Users Accounts Database Storage
let usersDatabase = JSON.parse(localStorage.getItem('wattwise_users_db')) || {};

// Active Appliances Array (Isolated per User Session)
let appliances = [];

let pieChart, timeframeChart;

// Helper: Convert total decimal hours to formatted string "Xh Ym"
function formatHoursAndMinutes(totalHours) {
  let hrs = Math.floor(totalHours);
  let mins = Math.round((totalHours - hrs) * 60);
  if (mins >= 60) { hrs += 1; mins -= 60; }
  return `${hrs}h ${mins}m`;
}

// Initialization
window.onload = () => {
  lucide.createIcons();
  
  if (currentUser) {
    loadUserAppData();
    hideSplash();
  } else {
    appliances = [];
    showSplash();
  }

  updateUserUI();
  updateCalculations();
  initCharts();

  if (localStorage.getItem('wattwise_darkmode') === 'enabled') {
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle) toggle.checked = true;
    document.body.classList.add('dark-theme');
  }
};

// Load appliances for current active session
function loadUserAppData() {
  if (currentUser && currentUser.email) {
    appliances = usersDatabase[currentUser.email]?.appliances || [];
  } else {
    appliances = JSON.parse(localStorage.getItem('wattwise_guest_appliances')) || [];
  }
}

// Save active session appliances to Database
function saveUserAppData() {
  if (currentUser && currentUser.email) {
    if (!usersDatabase[currentUser.email]) {
      usersDatabase[currentUser.email] = { profile: currentUser, password: '', appliances: [] };
    }
    usersDatabase[currentUser.email].appliances = appliances;
    localStorage.setItem('wattwise_users_db', JSON.stringify(usersDatabase));
  } else {
    localStorage.setItem('wattwise_guest_appliances', JSON.stringify(appliances));
  }
}

// Splash Screen Handlers
function showSplash() {
  document.getElementById('page-splash').classList.remove('hidden');
}

function hideSplash() {
  document.getElementById('page-splash').classList.add('hidden');
}

function handleSplashAction(action) {
  hideSplash();
  if (action === 'register') {
    openAuthModal('register');
  } else if (action === 'login') {
    openAuthModal('login');
  } else {
    // Guest Session Initialization
    currentUser = null;
    localStorage.removeItem('wattwise_active_session');
    loadUserAppData();
    updateUserUI();
    updateCalculations();
    showPage('dashboard');
  }
}

// Authentication Handlers (With Input Reset)
function openAuthModal(mode = 'login') {
  authMode = mode;
  document.getElementById('auth-modal').classList.remove('hidden');
  
  // RESET ALL INPUT FIELDS EVERY TIME THE MODAL OPENS
  document.getElementById('auth-form').reset();
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-name').value = '';

  const title = document.getElementById('auth-modal-title');
  const submitBtn = document.getElementById('auth-submit-btn');
  const nameField = document.getElementById('auth-name-field');
  const toggleBtn = document.getElementById('auth-toggle-btn');
  const toggleText = document.getElementById('auth-toggle-text');

  if (mode === 'register') {
    title.innerText = 'Create Wattwise Account';
    submitBtn.innerText = 'Register Account';
    nameField.classList.remove('hidden');
    toggleText.innerText = 'Already have an account?';
    toggleBtn.innerText = 'Sign In';
  } else {
    title.innerText = 'Sign In to Wattwise';
    submitBtn.innerText = 'Sign In';
    nameField.classList.add('hidden');
    toggleText.innerText = "Don't have an account?";
    toggleBtn.innerText = 'Register';
  }
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function switchAuthMode() {
  openAuthModal(authMode === 'login' ? 'register' : 'login');
}

function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.toLowerCase().trim();
  const password = document.getElementById('auth-password').value;
  const nameInput = document.getElementById('auth-name').value.trim();

  if (authMode === 'register') {
    if (usersDatabase[email]) {
      alert("Account already exists with this email. Please sign in.");
      openAuthModal('login');
      return;
    }
    
    // Register New Account with custom Name, Email, and Password
    const newUserProfile = { 
      name: nameInput || email.split('@')[0], 
      email: email, 
      status: 'Registered User' 
    };

    usersDatabase[email] = { 
      profile: newUserProfile, 
      password: password, 
      appliances: [] 
    };

    currentUser = newUserProfile;
    alert("Account successfully created!");
  } else {
    // Login Verification
    if (!usersDatabase[email]) {
      alert("No account found with this email. Please register first.");
      openAuthModal('register');
      return;
    }

    if (usersDatabase[email].password && usersDatabase[email].password !== password) {
      alert("Incorrect password. Please try again.");
      return;
    }

    currentUser = usersDatabase[email].profile;
  }

  // Save session and persistent database
  localStorage.setItem('wattwise_users_db', JSON.stringify(usersDatabase));
  localStorage.setItem('wattwise_active_session', JSON.stringify(currentUser));
  
  closeAuthModal();
  hideSplash();
  loadUserAppData();
  updateUserUI();
  updateCalculations();
}

function logoutUser() {
  saveUserAppData();
  currentUser = null;
  appliances = []; // Clear current UI appliances on logout
  localStorage.removeItem('wattwise_active_session');
  
  updateUserUI();
  updateCalculations();
  showSplash();
}

function clearCurrentSession() {
  if (confirm("Are you sure you want to clear all appliances in the current view?")) {
    appliances = [];
    saveUserAppData();
    updateCalculations();
  }
}

function updateUserUI() {
  const headerWidget = document.getElementById('user-header-widget');
  const dashName = document.getElementById('dash-username');
  const dashStatus = document.getElementById('dash-account-status');

  const profileAvatar = document.getElementById('profile-avatar');
  const profileName = document.getElementById('profile-name');
  const profileEmail = document.getElementById('profile-email');
  const profileStatus = document.getElementById('profile-status');
  const profileAppCount = document.getElementById('profile-appliance-count');
  const logoutBtn = document.getElementById('profile-logout-btn');

  if (currentUser) {
    headerWidget.innerHTML = `
      <button onclick="showPage('settings')" class="bg-orange-700 hover:bg-orange-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5">
        <i data-lucide="user" class="w-3.5 h-3.5"></i> <span class="hidden sm:inline">${currentUser.name}</span>
      </button>
    `;
    dashName.innerText = currentUser.name;
    dashStatus.innerText = currentUser.status;

    profileAvatar.innerText = currentUser.name.charAt(0).toUpperCase();
    profileName.innerText = currentUser.name;
    profileEmail.innerText = currentUser.email;
    profileStatus.innerText = currentUser.status;
    logoutBtn.classList.remove('hidden');
  } else {
    headerWidget.innerHTML = `
      <button onclick="openAuthModal('login')" class="bg-white text-orange-600 hover:bg-orange-50 text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5">
        <i data-lucide="log-in" class="w-3.5 h-3.5"></i> <span class="hidden sm:inline">Sign In</span>
      </button>
    `;
    dashName.innerText = 'Guest';
    dashStatus.innerText = 'Guest Session';

    profileAvatar.innerText = 'G';
    profileName.innerText = 'Guest User';
    profileEmail.innerText = 'Sign in to save your personalized appliance list.';
    profileStatus.innerText = 'Guest';
    logoutBtn.classList.add('hidden');
  }

  profileAppCount.innerText = `${appliances.length} Active Device(s)`;
  lucide.createIcons();
}

// Dark Mode Toggle
function toggleDarkMode() {
  const isDark = document.getElementById('dark-mode-toggle').checked;
  if (isDark) {
    document.body.classList.add('dark-theme');
    localStorage.setItem('wattwise_darkmode', 'enabled');
  } else {
    document.body.classList.remove('dark-theme');
    localStorage.setItem('wattwise_darkmode', 'disabled');
  }
}

// Navigation Switcher
function showPage(pageName) {
  hideSplash();
  ['dashboard', 'appliances', 'analytics', 'settings'].forEach(p => {
    document.getElementById(`page-${p}`).classList.add('hidden');
    document.getElementById(`nav-${p}`)?.classList.remove('underline', 'decoration-2', 'underline-offset-8');
    
    const mNav = document.getElementById(`m-nav-${p}`);
    if (mNav) {
      mNav.classList.remove('text-orange-600');
      mNav.classList.add('text-slate-500');
    }
  });

  document.getElementById(`page-${pageName}`).classList.remove('hidden');
  document.getElementById(`nav-${pageName}`)?.classList.add('underline', 'decoration-2', 'underline-offset-8');

  const activeMNav = document.getElementById(`m-nav-${pageName}`);
  if (activeMNav) {
    activeMNav.classList.remove('text-slate-500');
    activeMNav.classList.add('text-orange-600');
  }

  if (pageName === 'analytics') updateAnalyticsPage();
}

// Precise Floating-Point Calculation Engine
function calculateTotals() {
  let dailyKwh = appliances.reduce((sum, app) => {
    return sum + ((app.wattage * app.dailyHours) / 1000);
  }, 0);

  let dailyCost = dailyKwh * tariffRate;
  let weeklyKwh = dailyKwh * 7;
  let weeklyCost = dailyCost * 7;
  let monthlyKwh = dailyKwh * 30;
  let monthlyCost = dailyCost * 30;
  let yearlyKwh = dailyKwh * 365;
  let yearlyCost = dailyCost * 365;

  return { dailyKwh, dailyCost, weeklyKwh, weeklyCost, monthlyKwh, monthlyCost, yearlyKwh, yearlyCost };
}

// System State Recalculation
function updateCalculations() {
  const totals = calculateTotals();

  document.getElementById('card-active-devices').innerText = appliances.length;
  document.getElementById('card-total-kwh').innerText = totals.monthlyKwh.toFixed(2);
  document.getElementById('card-projected-cost').innerText = totals.monthlyCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('card-tariff').innerText = tariffRate.toFixed(4);
  document.getElementById('header-rate').innerText = tariffRate.toFixed(4);

  saveUserAppData();
  renderAlerts(totals.monthlyCost);
  renderQuickLogger();
  renderAppliancesTable();
  updateUserUI();

  if (!document.getElementById('page-analytics').classList.contains('hidden')) {
    updateAnalyticsPage();
  }
}

// Multi-Timeframe Bill Comparison Page Rendering
function updateAnalyticsPage() {
  const totals = calculateTotals();

  document.getElementById('cmp-daily-cost').innerText = totals.dailyCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('cmp-daily-kwh').innerText = totals.dailyKwh.toFixed(2);

  document.getElementById('cmp-weekly-cost').innerText = totals.weeklyCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('cmp-weekly-kwh').innerText = totals.weeklyKwh.toFixed(2);

  document.getElementById('cmp-monthly-cost').innerText = totals.monthlyCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('cmp-monthly-kwh').innerText = totals.monthlyKwh.toFixed(2);

  document.getElementById('cmp-yearly-cost').innerText = totals.yearlyCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('cmp-yearly-kwh').innerText = totals.yearlyKwh.toFixed(2);

  updateCharts(totals);
  renderApplianceBreakdownTable();
}

function renderApplianceBreakdownTable() {
  const tbody = document.getElementById('analytics-appliance-breakdown');
  tbody.innerHTML = '';

  if (appliances.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">No active appliances in current session.</td></tr>`;
    return;
  }

  appliances.forEach(app => {
    let appDailyKwh = (app.wattage * app.dailyHours) / 1000;
    let dCost = appDailyKwh * tariffRate;
    let wCost = dCost * 7;
    let mCost = dCost * 30;
    let yCost = dCost * 365;

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-2.5 sm:p-3 font-semibold text-slate-800 dark-text">${app.name} (${app.wattage}W)</td>
        <td class="p-2.5 sm:p-3 text-slate-600 dark-text">${formatHoursAndMinutes(app.dailyHours)}/day</td>
        <td class="p-2.5 sm:p-3 font-medium text-slate-700 dark-text">₱${dCost.toFixed(2)}</td>
        <td class="p-2.5 sm:p-3 font-medium text-slate-700 dark-text">₱${wCost.toFixed(2)}</td>
        <td class="p-2.5 sm:p-3 font-semibold text-orange-600">₱${mCost.toFixed(2)}</td>
        <td class="p-2.5 sm:p-3 text-right font-bold text-slate-800 dark-text">₱${yCost.toFixed(2)}</td>
      </tr>
    `;
  });
}

function renderAlerts(totalMonthlyCost) {
  const container = document.getElementById('alerts-container');
  container.innerHTML = '';

  if (appliances.length === 0 || totalMonthlyCost === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400">No high consumption warnings right now.</p>`;
    return;
  }

  appliances.forEach(app => {
    let appMonthlyCost = ((app.wattage * app.dailyHours) / 1000) * tariffRate * 30;
    let percentage = totalMonthlyCost > 0 ? ((appMonthlyCost / totalMonthlyCost) * 100).toFixed(0) : 0;

    if (percentage >= 15) {
      container.innerHTML += `
        <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start space-x-2">
          <i data-lucide="alert-circle" class="w-4 h-4 text-red-500 shrink-0 mt-0.5"></i>
          <div>
            <span class="font-bold">${app.name}</span> accounts for <span class="font-bold">${percentage}%</span> of your monthly electricity bill.
          </div>
        </div>
      `;
    }
  });
  lucide.createIcons();
}

function renderQuickLogger() {
  const list = document.getElementById('quick-logger-list');
  list.innerHTML = '';
  
  if (appliances.length === 0) {
    list.innerHTML = `<p class="text-xs text-slate-400 py-3">No appliances added yet. Click "Add Appliance" to get started.</p>`;
    return;
  }

  appliances.slice(0, 8).forEach(app => {
    list.innerHTML += `
      <div class="py-2.5 sm:py-3 flex justify-between items-center text-xs sm:text-sm">
        <div class="min-w-0 flex-1 pr-2">
          <div class="font-semibold text-slate-800 dark-text truncate">${app.name}</div>
          <div class="text-[11px] text-slate-400">${app.wattage} W</div>
        </div>
        <div class="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <span class="font-bold text-slate-700 dark-text w-16 text-right">${formatHoursAndMinutes(app.dailyHours)}</span>
          <div class="flex space-x-1">
            <button onclick="adjustMinutes(${app.id}, -1)" class="w-7 h-7 bg-slate-100 dark-bg hover:bg-slate-200 rounded font-bold text-slate-600 dark-text flex items-center justify-center">-1m</button>
            <button onclick="adjustMinutes(${app.id}, 1)" class="w-7 h-7 bg-orange-100 hover:bg-orange-200 rounded font-bold text-orange-600 flex items-center justify-center">+1m</button>
          </div>
        </div>
      </div>
    `;
  });
}

// Adjust time per minute (+1m or -1m = +/- 1/60 hours)
function adjustMinutes(id, minutesDelta) {
  let app = appliances.find(a => a.id === id);
  if (app) {
    let hoursDelta = minutesDelta / 60;
    app.dailyHours = Math.max(0, Math.min(24, app.dailyHours + hoursDelta));
    updateCalculations();
  }
}

function renderAppliancesTable() {
  const body = document.getElementById('appliance-table-body');
  const search = document.getElementById('search-input').value.toLowerCase();
  const category = document.getElementById('category-filter').value;

  body.innerHTML = '';

  let filtered = appliances
    .filter(app => app.name.toLowerCase().includes(search))
    .filter(app => category === 'All' || app.category === category);

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 text-xs">No matching appliances found.</td></tr>`;
    return;
  }

  filtered.forEach(app => {
    let dailyCost = ((app.wattage * app.dailyHours) / 1000) * tariffRate;
    body.innerHTML += `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-2.5 sm:p-3 font-semibold text-slate-800 dark-text whitespace-nowrap">${app.name}</td>
        <td class="p-2.5 sm:p-3 whitespace-nowrap"><span class="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">${app.category}</span></td>
        <td class="p-2.5 sm:p-3 dark-text whitespace-nowrap">${app.wattage} W</td>
        <td class="p-2.5 sm:p-3 dark-text whitespace-nowrap">${formatHoursAndMinutes(app.dailyHours)}/day</td>
        <td class="p-2.5 sm:p-3 font-semibold text-slate-700 dark-text whitespace-nowrap">₱${dailyCost.toFixed(2)}</td>
        <td class="p-2.5 sm:p-3 text-right space-x-2 whitespace-nowrap">
          <button onclick="editAppliance(${app.id})" class="text-slate-400 hover:text-slate-600"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
          <button onclick="deleteAppliance(${app.id})" class="text-red-400 hover:text-red-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </td>
      </tr>
    `;
  });
  lucide.createIcons();
}

function updateTariffPreset() {
  const val = document.getElementById('tariff-preset').value;
  if (val !== 'custom') {
    tariffRate = parseFloat(val);
    document.getElementById('tariff-input').value = val;
    updateCalculations();
  }
}

function updateCustomTariff() {
  const val = parseFloat(document.getElementById('tariff-input').value);
  if (!isNaN(val) && val > 0) {
    tariffRate = val;
    document.getElementById('tariff-preset').value = 'custom';
    updateCalculations();
  }
}

function openModal(app = null) {
  document.getElementById('appliance-modal').classList.remove('hidden');
  if (app) {
    document.getElementById('modal-title').innerText = 'Edit Appliance';
    document.getElementById('modal-app-id').value = app.id;
    document.getElementById('modal-app-name').value = app.name;
    document.getElementById('modal-app-category').value = app.category;
    document.getElementById('modal-app-wattage').value = app.wattage;
    
    let hrs = Math.floor(app.dailyHours);
    let mins = Math.round((app.dailyHours - hrs) * 60);
    document.getElementById('modal-app-hours').value = hrs;
    document.getElementById('modal-app-minutes').value = mins;
  } else {
    document.getElementById('modal-title').innerText = 'Add Appliance';
    document.getElementById('modal-app-id').value = '';
    document.getElementById('appliance-form').reset();
  }
}

function closeModal() {
  document.getElementById('appliance-modal').classList.add('hidden');
}

function saveAppliance(e) {
  e.preventDefault();
  let id = document.getElementById('modal-app-id').value;
  let name = document.getElementById('modal-app-name').value;
  let category = document.getElementById('modal-app-category').value;
  let wattage = parseFloat(document.getElementById('modal-app-wattage').value);
  
  let hours = parseFloat(document.getElementById('modal-app-hours').value) || 0;
  let minutes = parseFloat(document.getElementById('modal-app-minutes').value) || 0;
  let totalDailyHours = hours + (minutes / 60);

  if (id) {
    let app = appliances.find(a => a.id == id);
    if (app) {
      app.name = name; app.category = category; app.wattage = wattage; app.dailyHours = totalDailyHours;
    }
  } else {
    appliances.push({ id: Date.now(), name, category, wattage, dailyHours: totalDailyHours });
  }
  closeModal();
  updateCalculations();
}

function editAppliance(id) {
  let app = appliances.find(a => a.id === id);
  if (app) openModal(app);
}

function deleteAppliance(id) {
  appliances = appliances.filter(a => a.id !== id);
  updateCalculations();
}

function initCharts() {
  const tfCtx = document.getElementById('timeframeBarChart').getContext('2d');
  timeframeChart = new Chart(tfCtx, {
    type: 'bar',
    data: {
      labels: ['Daily', 'Weekly (7d)', 'Monthly (30d)', 'Yearly (365d)'],
      datasets: [{
        label: 'Cost (₱)',
        data: [0, 0, 0, 0],
        backgroundColor: ['#f97316', '#3b82f6', '#10b981', '#a855f7'],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { font: { size: 9 } } }, x: { ticks: { font: { size: 9 } } } }
    }
  });

  const pieCtx = document.getElementById('categoryPieChart').getContext('2d');
  pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: { labels: [], datasets: [{ data: [], backgroundColor: ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#64748b'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }
  });
}

function updateCharts(totals = calculateTotals()) {
  if (!timeframeChart || !pieChart) return;

  timeframeChart.data.datasets[0].data = [
    totals.dailyCost.toFixed(2),
    totals.weeklyCost.toFixed(2),
    totals.monthlyCost.toFixed(2),
    totals.yearlyCost.toFixed(2)
  ];
  timeframeChart.update();

  let catTotals = {};
  appliances.forEach(a => {
    let appMonthlyCost = ((a.wattage * a.dailyHours) / 1000) * tariffRate * 30;
    catTotals[a.category] = (catTotals[a.category] || 0) + appMonthlyCost;
  });

  pieChart.data.labels = Object.keys(catTotals);
  pieChart.data.datasets[0].data = Object.values(catTotals);
  pieChart.update();
}

function exportCSV() {
  const totals = calculateTotals();
  let csv = `Appliance,Category,Wattage (W),Daily Runtime,Daily Cost (PHP),Weekly Cost (PHP),Monthly Cost (PHP),Yearly Cost (PHP)\n`;
  
  appliances.forEach(a => {
    let dKwh = (a.wattage * a.dailyHours) / 1000;
    let dC = dKwh * tariffRate;
    csv += `"${a.name}","${a.category}",${a.wattage},"${formatHoursAndMinutes(a.dailyHours)}",${dC.toFixed(2)},${(dC * 7).toFixed(2)},${(dC * 30).toFixed(2)},${(dC * 365).toFixed(2)}\n`;
  });

  csv += `\nTOTAL ESTIMATES,,,Daily: ₱${totals.dailyCost.toFixed(2)},Weekly: ₱${totals.weeklyCost.toFixed(2)},Monthly: ₱${totals.monthlyCost.toFixed(2)},Yearly: ₱${totals.yearlyCost.toFixed(2)}\n`;

  let blob = new Blob([csv], { type: 'text/csv' });
  link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `wattwise_electricity_report.csv`;
  link.click();
}