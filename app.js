// CineScrape Dashboard App Logic

// State variables
let moviesData = [];
let filteredMovies = [];
let currentCategory = 'all';
let currentSearch = '';
let currentSort = 'scoreDesc';

// Chart instances (to destroy before recreating on filter updates)
let categoryChartInstance = null;
let scoreChartInstance = null;

// DOM Elements
const totalMoviesCountEl = document.getElementById('totalMoviesCount');
const avgScoreValueEl = document.getElementById('avgScoreValue');
const avgRuntimeValueEl = document.getElementById('avgRuntimeValue');
const uniqueCategoriesCountEl = document.getElementById('uniqueCategoriesCount');

const moviesGrid = document.getElementById('moviesGrid');
const moviesLoader = document.getElementById('moviesLoader');
const searchInput = document.getElementById('searchInput');
const sortBySelect = document.getElementById('sortBySelect');
const filterTagsContainer = document.getElementById('filterTags');
const regionListEl = document.getElementById('regionList');

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  fetchMoviesData();
  setupEventListeners();
});

// Fetch movie data from movies.json
async function fetchMoviesData() {
  try {
    const response = await fetch('movies.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    moviesData = await response.json();
    filteredMovies = [...moviesData];
    
    // Hide loader
    if (moviesLoader) moviesLoader.style.display = 'none';
    
    // Calculate global stats and load filters
    calculateStats();
    generateCategoryFilters();
    renderRegionStats();
    
    // Initial render and charts
    updateDashboard();
    initCharts();
  } catch (error) {
    console.error('Failed to load movie data:', error);
    moviesGrid.innerHTML = `
      <div class="no-results">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>載入電影資料失敗！請確認已執行爬蟲腳本並產生 movies.json。</p>
        <p style="font-size: 0.8rem; margin-top: 0.5rem; opacity: 0.7;">Error: ${error.message}</p>
      </div>
    `;
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Search Input listener
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.toLowerCase().trim();
    applyFilterAndSort();
  });

  // Sort select listener
  sortBySelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    applyFilterAndSort();
  });
}

// Calculate dashboard stats (using raw moviesData)
function calculateStats() {
  if (moviesData.length === 0) return;

  const totalMovies = moviesData.length;
  
  // Calculate average score
  const validScores = moviesData.filter(m => m.score > 0);
  const avgScore = validScores.reduce((acc, curr) => acc + curr.score, 0) / validScores.length;
  
  // Calculate average runtime
  const validRuntimes = moviesData.filter(m => m.runtime > 0);
  const avgRuntime = validRuntimes.reduce((acc, curr) => acc + curr.runtime, 0) / validRuntimes.length;
  
  // Count unique categories
  const categoriesSet = new Set();
  moviesData.forEach(m => {
    if (m.categories) {
      m.categories.forEach(cat => categoriesSet.add(cat));
    }
  });

  // Update DOM
  totalMoviesCountEl.textContent = totalMovies;
  avgScoreValueEl.textContent = avgScore.toFixed(2);
  avgRuntimeValueEl.textContent = `${Math.round(avgRuntime)} 分鐘`;
  uniqueCategoriesCountEl.textContent = categoriesSet.size;
}

// Generate category tag filters dynamically
function generateCategoryFilters() {
  const categoriesMap = {};
  moviesData.forEach(m => {
    if (m.categories) {
      m.categories.forEach(cat => {
        categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
      });
    }
  });

  // Sort categories by popularity
  const sortedCategories = Object.entries(categoriesMap)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  // Render tag buttons
  sortedCategories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'tag-btn';
    btn.textContent = `${cat} (${categoriesMap[cat]})`;
    btn.dataset.category = cat;
    
    btn.addEventListener('click', () => {
      // Toggle active states
      document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = cat;
      applyFilterAndSort();
    });
    
    filterTagsContainer.appendChild(btn);
  });

  // Setup click for "All" tag button
  const tagAllBtn = document.getElementById('tagAllBtn');
  tagAllBtn.addEventListener('click', () => {
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
    tagAllBtn.classList.add('active');
    currentCategory = 'all';
    applyFilterAndSort();
  });
}

// Filter and Sort movies
function applyFilterAndSort() {
  filteredMovies = moviesData.filter(m => {
    // 1. Search filter
    const matchesSearch = m.title.toLowerCase().includes(currentSearch);
    
    // 2. Category filter
    const matchesCategory = currentCategory === 'all' || (m.categories && m.categories.includes(currentCategory));
    
    return matchesSearch && matchesCategory;
  });

  // 3. Sort logic
  filteredMovies.sort((a, b) => {
    switch (currentSort) {
      case 'scoreDesc':
        return b.score - a.score;
      case 'scoreAsc':
        return a.score - b.score;
      case 'dateDesc':
        return new Date(b.release_date || '1970-01-01') - new Date(a.release_date || '1970-01-01');
      case 'dateAsc':
        return new Date(a.release_date || '1970-01-01') - new Date(b.release_date || '1970-01-01');
      case 'runtimeDesc':
        return (b.runtime || 0) - (a.runtime || 0);
      case 'runtimeAsc':
        return (a.runtime || 0) - (b.runtime || 0);
      default:
        return 0;
    }
  });

  updateDashboard();
  updateCharts();
}

// Render dynamic movie list grid
function updateDashboard() {
  moviesGrid.innerHTML = '';
  
  if (filteredMovies.length === 0) {
    moviesGrid.innerHTML = `
      <div class="no-results">
        <i class="fa-solid fa-magnifying-glass"></i>
        <p>查無符合篩選條件的電影，請試試其他關鍵字或分類。</p>
      </div>
    `;
    return;
  }

  filteredMovies.forEach(m => {
    const card = document.createElement('article');
    card.className = 'movie-card';
    
    // Render stars based on rating (score / 2)
    const starScore = m.score / 2;
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      if (starScore >= i) {
        starsHtml += '<i class="fa-solid fa-star"></i>';
      } else if (starScore >= i - 0.5) {
        starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';
      } else {
        starsHtml += '<i class="fa-regular fa-star"></i>';
      }
    }

    // Prefer local cover if available to support offline viewing
    const coverUrl = m.local_cover || m.cover || 'https://via.placeholder.com/270x360?text=No+Cover';
    
    const categoriesHtml = m.categories.map(cat => `<span class="genre-badge">${cat}</span>`).join('');
    const regionsStr = m.regions.join('、') || '未知';
    const runtimeStr = m.runtime ? `${m.runtime} 分鐘` : '未知';
    const releaseStr = m.release_date ? `${m.release_date} 上映` : '未知';

    card.innerHTML = `
      <div class="movie-cover-wrapper">
        <img class="movie-cover" src="${coverUrl}" alt="${m.title}" loading="lazy">
        <div class="movie-score-badge">
          <i class="fa-solid fa-star" style="color: var(--accent-gold);"></i> ${m.score.toFixed(1)}
        </div>
      </div>
      <div class="movie-body">
        <h2 class="movie-title" title="${m.title}">${m.title}</h2>
        <div class="movie-genres">
          ${categoriesHtml}
        </div>
        <div class="movie-meta">
          <div class="meta-item"><i class="fa-solid fa-globe"></i> ${regionsStr}</div>
          <div class="meta-item"><i class="fa-solid fa-clock"></i> ${runtimeStr}</div>
          <div class="meta-item"><i class="fa-solid fa-calendar-days"></i> ${releaseStr}</div>
        </div>
      </div>
    `;
    
    moviesGrid.appendChild(card);
  });
}

// Render regions distribution leaderboard
function renderRegionStats() {
  const regionsMap = {};
  moviesData.forEach(m => {
    if (m.regions) {
      m.regions.forEach(reg => {
        regionsMap[reg] = (regionsMap[reg] || 0) + 1;
      });
    }
  });

  const sortedRegions = Object.entries(regionsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8); // Top 8 regions

  regionListEl.innerHTML = '';
  sortedRegions.forEach(([name, count]) => {
    const item = document.createElement('div');
    item.className = 'region-item';
    item.innerHTML = `
      <span class="region-name">${name}</span>
      <span class="region-count">${count} 部</span>
    `;
    regionListEl.appendChild(item);
  });
}

// Initialize Charts
function initCharts() {
  // Common Dark Chart Styles
  Chart.defaults.color = 'hsl(250, 10%, 75%)';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;
  
  createCategoryChart();
  createScoreChart();
}

// Update charts with currently filtered movies
function updateCharts() {
  if (categoryChartInstance) {
    const { labels, data } = getCategoryChartData();
    categoryChartInstance.data.labels = labels;
    categoryChartInstance.data.datasets[0].data = data;
    categoryChartInstance.update();
  }
  
  if (scoreChartInstance) {
    const { labels, data } = getScoreChartData();
    scoreChartInstance.data.labels = labels;
    scoreChartInstance.data.datasets[0].data = data;
    scoreChartInstance.update();
  }
}

// Generate category distribution chart data from filtered movies
function getCategoryChartData() {
  const categoriesMap = {};
  filteredMovies.forEach(m => {
    if (m.categories) {
      m.categories.forEach(cat => {
        categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
      });
    }
  });

  const sorted = Object.entries(categoriesMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // top 5
  
  const labels = sorted.map(e => e[0]);
  const data = sorted.map(e => e[1]);
  
  return { labels, data };
}

// Generate score distribution chart data from filtered movies
function getScoreChartData() {
  // Ranges: < 7.0, 7.0-7.9, 8.0-8.9, 9.0-9.4, 9.5+
  const ranges = {
    '< 7.0': 0,
    '7.0 - 7.9': 0,
    '8.0 - 8.9': 0,
    '9.0 - 9.4': 0,
    '9.5+': 0
  };

  filteredMovies.forEach(m => {
    if (m.score < 7.0) ranges['< 7.0']++;
    else if (m.score < 8.0) ranges['7.0 - 7.9']++;
    else if (m.score < 9.0) ranges['8.0 - 8.9']++;
    else if (m.score < 9.5) ranges['9.0 - 9.4']++;
    else ranges['9.5+']++;
  });

  return {
    labels: Object.keys(ranges),
    data: Object.values(ranges)
  };
}

// Create Category Doughnut Chart
function createCategoryChart() {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  const { labels, data } = getCategoryChartData();

  categoryChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          'hsl(250, 85%, 65%)',
          'hsl(320, 80%, 60%)',
          'hsl(180, 80%, 55%)',
          'hsl(42, 95%, 55%)',
          'hsl(145, 75%, 50%)'
        ],
        borderWidth: 1,
        borderColor: 'hsl(250, 24%, 12%)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            padding: 15
          }
        }
      },
      cutout: '65%'
    }
  });
}

// Create Score Bar Chart
function createScoreChart() {
  const ctx = document.getElementById('scoreChart').getContext('2d');
  const { labels, data } = getScoreChartData();

  scoreChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '電影數量',
        data: data,
        backgroundColor: 'rgba(250, 85, 65, 0.45)',
        borderColor: 'hsl(250, 85%, 65%)',
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

// ==========================================
// CineScrape AI Chatbot Frontend Integration
// ==========================================

// Chatbot DOM Elements
const chatTriggerBtn = document.getElementById('chatTriggerBtn');
const chatWindow = document.getElementById('chatWindow');
const chatbotCloseBtn = document.getElementById('chatbotCloseBtn');
const chatbotSettingsBtn = document.getElementById('chatbotSettingsBtn');

const apiKeyModal = document.getElementById('apiKeyModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKeyVisibility = document.getElementById('toggleApiKeyVisibility');
const apiKeyCancelBtn = document.getElementById('apiKeyCancelBtn');
const apiKeySaveBtn = document.getElementById('apiKeySaveBtn');

const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');

// Load API key from local storage on startup
let geminiApiKey = localStorage.getItem('gemini_api_key') || '';
apiKeyInput.value = geminiApiKey;

// Event Listeners for Chatbot
if (chatTriggerBtn) {
  chatTriggerBtn.addEventListener('click', toggleChat);
}
if (chatbotCloseBtn) {
  chatbotCloseBtn.addEventListener('click', () => chatWindow.classList.remove('open'));
}
if (chatbotSettingsBtn) {
  chatbotSettingsBtn.addEventListener('click', openSettings);
}
if (apiKeyCancelBtn) {
  apiKeyCancelBtn.addEventListener('click', closeSettings);
}
if (apiKeySaveBtn) {
  apiKeySaveBtn.addEventListener('click', saveSettings);
}
if (toggleApiKeyVisibility) {
  toggleApiKeyVisibility.addEventListener('click', togglePasswordVisibility);
}
if (chatSendBtn) {
  chatSendBtn.addEventListener('click', handleUserSend);
}
if (chatInput) {
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUserSend();
    }
  });
}

// Toggle chat window visibility
function toggleChat() {
  chatWindow.classList.toggle('open');
  if (chatWindow.classList.contains('open')) {
    setTimeout(() => chatInput.focus(), 150);
    scrollToBottom();
  }
}

// Open API Key Modal
function openSettings() {
  apiKeyModal.classList.add('open');
  apiKeyInput.value = localStorage.getItem('gemini_api_key') || '';
}

// Close API Key Modal
function closeSettings() {
  apiKeyModal.classList.remove('open');
}

// Toggle password input visibility
function togglePasswordVisibility() {
  const icon = toggleApiKeyVisibility.querySelector('i');
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    icon.className = 'fa-solid fa-eye-slash';
  } else {
    apiKeyInput.type = 'password';
    icon.className = 'fa-solid fa-eye';
  }
}

// Save API Key to localStorage
function saveSettings() {
  const keyVal = apiKeyInput.value.trim();
  localStorage.setItem('gemini_api_key', keyVal);
  geminiApiKey = keyVal;
  closeSettings();
  
  // Send status update message
  addMessage('系統', `API Key 已儲存！您可以開始與我對話了。🚀`, 'bot');
}

// Scroll chat window to bottom
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Handle sending message
async function handleUserSend() {
  const text = chatInput.value.trim();
  if (!text) return;
  
  // Clear input
  chatInput.value = '';
  
  // Render user bubble
  addMessage('You', text, 'user');
  scrollToBottom();
  
  // Add bot loading bubble
  const loadingBubbleId = addLoadingMessage();
  scrollToBottom();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: text,
        apiKey: geminiApiKey
      })
    });
    
    const data = await response.json();
    
    // Remove loading bubble
    removeLoadingMessage(loadingBubbleId);
    
    if (response.ok) {
      addMessage('CineScrape AI', data.reply, 'bot');
    } else {
      // Detect invalid API key errors from server and auto-open settings
      const isKeyError = data.needsApiKey === true || 
                         (data.error && (data.error.includes('API Key') || data.error.includes('API_KEY_INVALID') || data.error.includes('無效')));
      
      if (isKeyError) {
        addMessage('CineScrape AI', data.error || '🔑 API Key 無效，請重新設定。', 'bot');
        // Automatically open the settings modal after a short delay
        setTimeout(() => openSettings(), 1500);
      } else {
        addMessage('CineScrape AI', `${data.error || '⚠️ 發生未知錯誤，請稍後再試。'}`, 'bot');
      }
    }
  } catch (error) {
    removeLoadingMessage(loadingBubbleId);
    addMessage('CineScrape AI', `⚠️ 連線錯誤：無法連接至伺服器，請確保 server.py 正在運行中。`, 'bot');
    console.error('Chat error:', error);
  }
  
  scrollToBottom();
}

// Helper to format bot responses containing basic markdown (* and ` and \n)
function formatResponseText(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Bold markdown: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Inline Code markdown: `code`
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Convert newlines to breaks
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// Add message bubble
function addMessage(sender, text, type) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${type}`;
  
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'msg-bubble';
  
  if (type === 'bot') {
    bubbleDiv.innerHTML = formatResponseText(text);
  } else {
    bubbleDiv.textContent = text;
  }
  
  msgDiv.appendChild(bubbleDiv);
  chatMessages.appendChild(msgDiv);
}

// Add typing loading indicator
function addLoadingMessage() {
  const loadingId = 'loading-' + Date.now();
  
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-msg bot';
  msgDiv.id = loadingId;
  
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'msg-bubble';
  bubbleDiv.innerHTML = `
    <div class="typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  
  msgDiv.appendChild(bubbleDiv);
  chatMessages.appendChild(msgDiv);
  return loadingId;
}

// Remove loading bubble
function removeLoadingMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

