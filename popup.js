// popup.js - Enhanced Context Keeper popup functionality

document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const contextNameInput = document.getElementById('contextName');
  const saveContextBtn = document.getElementById('saveContext');
  const contextList = document.getElementById('contextList');
  const tabCountSpan = document.getElementById('tabCount');
  const totalContextsSpan = document.getElementById('totalContexts');
  const totalTabsSpan = document.getElementById('totalTabs');
  const closeAllTabsBtn = document.getElementById('closeAllTabs');
  const organizeTabsBtn = document.getElementById('organizeTabs');
  const saveQuickBtn = document.getElementById('saveQuick');
  
  // New feature elements
  const suggestionChips = document.getElementById('suggestionChips');
  const contextCategory = document.getElementById('contextCategory');
  const contextTags = document.getElementById('contextTags');
  const currentTabList = document.getElementById('currentTabList');
  const organizeTabsSmartBtn = document.getElementById('organizeTabsSmart');
  const contextSearch = document.getElementById('contextSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  const notificationsList = document.getElementById('notificationsList');
  const clearNotificationsBtn = document.getElementById('clearNotifications');

  let currentTabCount = 0;
  let currentTabs = [];
  let savedContexts = [];
  let currentTags = [];

  // Initialize popup
  initializePopup();

  // Event listeners
  if (organizeTabsSmartBtn) {
    organizeTabsSmartBtn.addEventListener('click', smartOrganizeTabs);
  }
  if (clearNotificationsBtn) {
    clearNotificationsBtn.addEventListener('click', clearAllNotifications);
  }
  if (saveContextBtn) {
    saveContextBtn.addEventListener('click', saveCurrentContext);
  }
  if (closeAllTabsBtn) {
    closeAllTabsBtn.addEventListener('click', closeAllTabs);
  }
  if (organizeTabsBtn) {
    organizeTabsBtn.addEventListener('click', autoOrganizeTabs);
  }
  if (saveQuickBtn) {
    saveQuickBtn.addEventListener('click', quickSave);
  }
  if (contextNameInput) {
    contextNameInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        saveCurrentContext();
      }
    });
  }
  if (contextTags) {
    contextTags.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag();
      }
    });
    contextTags.addEventListener('blur', function() {
      const tagInput = contextTags.value.trim();
      if (tagInput && !currentTags.includes(tagInput)) {
        addTag();
      } else {
        contextTags.value = '';
      }
    });
  }
  if (contextSearch) {
    contextSearch.addEventListener('input', filterContexts);
  }
  if (categoryFilter) {
    categoryFilter.addEventListener('change', filterContexts);
  }

  // Initialize popup data
  async function initializePopup() {
    try {
      // Get current tabs
      currentTabs = await chrome.tabs.query({});
      currentTabCount = currentTabs.length;
      tabCountSpan.textContent = currentTabCount;

      // Load saved contexts
      await loadSavedContexts();
      
      // Update UI
      updateTabPreview();
      generateSmartSuggestions();
      updateStats();
      loadNotifications();
      
    } catch (error) {
      console.error('Error initializing popup:', error);
      showNotification('Error loading data', 'error');
    }
  }

  // Smart Context Suggestions
  function generateSmartSuggestions() {
    if (!currentTabs || currentTabs.length === 0 || !suggestionChips) return;

    const suggestions = [];
    const domainCounts = {};
    const commonWords = {};

    // Analyze current tabs
    currentTabs.forEach(tab => {
      try {
        const domain = new URL(tab.url).hostname;
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        
        // Extract common words from titles
        const words = tab.title.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 3) {
            commonWords[word] = (commonWords[word] || 0) + 1;
          }
        });
      } catch (error) {
        // Skip invalid URLs
      }
    });

    // Generate domain-based suggestions
    Object.entries(domainCounts).forEach(([domain, count]) => {
      if (count > 1) {
        suggestions.push(`${domain} (${count} tabs)`);
      }
    });

    // Generate word-based suggestions
    Object.entries(commonWords)
      .filter(([word, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([word, count]) => {
        suggestions.push(word.charAt(0).toUpperCase() + word.slice(1));
      });

    // Add time-based suggestions
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) {
      suggestions.push('Work Session');
    } else if (hour >= 18 && hour <= 22) {
      suggestions.push('Evening Browsing');
    } else {
      suggestions.push('Late Night Session');
    }

    // Render chips without inline handlers
    suggestionChips.innerHTML = suggestions.map(suggestion => 
      `<div class="suggestion-chip" data-suggestion="${encodeURIComponent(suggestion)}">${suggestion}</div>`
    ).join('');

    // Attach event listeners for chips
    suggestionChips.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', function() {
        const suggestion = decodeURIComponent(this.getAttribute('data-suggestion'));
        if (contextNameInput) {
          contextNameInput.value = suggestion;
          contextNameInput.focus();
        }
      });
    });
  }

  // Tag Management
  function addTag() {
    const tagInput = contextTags.value.trim();
    if (tagInput && !currentTags.includes(tagInput)) {
      currentTags.push(tagInput);
      updateTagsDisplay();
    }
    contextTags.value = '';
  }

  function removeTag(tag) {
    currentTags = currentTags.filter(t => t !== tag);
    updateTagsDisplay();
  }

  function updateTagsDisplay() {
    const tagsInputContainer = document.querySelector('.tags-input');
    if (!tagsInputContainer) return;
    let tagsContainer = document.querySelector('.tags-display');
    if (!tagsContainer) {
      tagsContainer = document.createElement('div');
      tagsContainer.className = 'tags-display';
      tagsInputContainer.appendChild(tagsContainer);
    }
    tagsContainer.innerHTML = '';
    currentTags.forEach(tag => {
      const tagItem = document.createElement('div');
      tagItem.className = 'tag-item';
      tagItem.textContent = tag;
      const removeBtn = document.createElement('span');
      removeBtn.className = 'tag-remove';
      removeBtn.textContent = '×';
      removeBtn.setAttribute('role', 'button');
      removeBtn.setAttribute('tabindex', '0');
      removeBtn.addEventListener('click', () => {
        currentTags = currentTags.filter(t => t !== tag);
        updateTagsDisplay();
      });
      tagItem.appendChild(removeBtn);
      tagsContainer.appendChild(tagItem);
    });
  }

  // Smart Tab Organization
  function updateTabPreview() {
    if (!currentTabList) return;
    if (currentTabs.length === 0) {
      currentTabList.innerHTML = '<div class="no-tabs">No tabs open</div>';
      return;
    }
    currentTabList.innerHTML = currentTabs.map(tab => `
      <div class="tab-item">
        <img src="${tab.favIconUrl || 'icons/default-favicon.png'}" class="tab-favicon" alt="">
        <div class="tab-title">${tab.title}</div>
        ${tab.pinned ? '<span class="tab-priority">PINNED</span>' : ''}
      </div>
    `).join('');
  }

  async function smartOrganizeTabs() {
    try {
      // Group tabs by domain and suggest organization
      const domainGroups = {};
      currentTabs.forEach(tab => {
        try {
          const domain = new URL(tab.url).hostname;
          if (!domainGroups[domain]) {
            domainGroups[domain] = [];
          }
          domainGroups[domain].push(tab);
        } catch (error) {
          // Skip invalid URLs
        }
      });

      // Create contexts for each domain group
      const createdContexts = [];
      for (const [domain, domainTabs] of Object.entries(domainGroups)) {
        if (domainTabs.length > 1) {
          const contextName = `${domain} (${domainTabs.length} tabs)`;
          const category = getCategoryFromDomain(domain);
          
          const context = {
            id: Date.now().toString() + Math.random(),
            name: contextName,
            category: category,
            tags: [domain, 'auto-organized'],
            tabs: domainTabs.map(tab => ({
              url: tab.url,
              title: tab.title,
              favIconUrl: tab.favIconUrl
            })),
            createdAt: new Date().toISOString(),
            tabCount: domainTabs.length
          };

          savedContexts.push(context);
          createdContexts.push(context);
        }
      }

      await chrome.storage.local.set({ contexts: savedContexts });
      await loadSavedContexts();
      updateStats();
      
      showNotification(`Smart organized ${createdContexts.length} contexts`, 'success');
    } catch (error) {
      console.error('Error smart organizing tabs:', error);
      showNotification('Error organizing tabs', 'error');
    }
  }

  function getCategoryFromDomain(domain) {
    const workDomains = ['gmail.com', 'google.com', 'slack.com', 'zoom.us', 'teams.microsoft.com'];
    const shoppingDomains = ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com'];
    const socialDomains = ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com'];
    const entertainmentDomains = ['youtube.com', 'netflix.com', 'spotify.com', 'twitch.tv'];
    
    if (workDomains.some(d => domain.includes(d))) return 'work';
    if (shoppingDomains.some(d => domain.includes(d))) return 'shopping';
    if (socialDomains.some(d => domain.includes(d))) return 'social';
    if (entertainmentDomains.some(d => domain.includes(d))) return 'entertainment';
    
    return 'other';
  }

  // Enhanced Save Context
  async function saveCurrentContext() {
    const contextName = contextNameInput.value.trim();
    const category = contextCategory.value;
    
    if (!contextName) {
      showNotification('Please enter a context name', 'error');
      return;
    }

    if (currentTabs.length === 0) {
      showNotification('No tabs to save', 'error');
      return;
    }

    try {
      const context = {
        id: Date.now().toString(),
        name: contextName,
        category: category,
        tags: currentTags,
        tabs: currentTabs.map(tab => ({
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl
        })),
        createdAt: new Date().toISOString(),
        tabCount: currentTabs.length
      };

      // Check if context name already exists
      const existingIndex = savedContexts.findIndex(c => c.name === contextName);
      if (existingIndex !== -1) {
        savedContexts[existingIndex] = context;
        showNotification(`Context "${contextName}" updated`, 'success');
      } else {
        savedContexts.push(context);
        showNotification(`Context "${contextName}" saved`, 'success');
      }

      await chrome.storage.local.set({ contexts: savedContexts });

      // Reset form
      contextNameInput.value = '';
      contextCategory.value = '';
      currentTags = [];
      updateTagsDisplay();
      
      await loadSavedContexts();
      updateStats();
      
    } catch (error) {
      console.error('Error saving context:', error);
      showNotification('Error saving context', 'error');
    }
  }

  // Quick Save
  async function quickSave() {
    const quickName = `Quick Save ${new Date().toLocaleTimeString()}`;
    contextNameInput.value = quickName;
    await saveCurrentContext();
  }

  // Enhanced Load Contexts
  async function loadSavedContexts() {
    try {
      const result = await chrome.storage.local.get(['contexts']);
      savedContexts = result.contexts || [];
      
      if (savedContexts.length === 0) {
        contextList.innerHTML = '<div class="no-contexts">No saved contexts yet</div>';
        addContextEventListeners();
        return;
      }

      // Sort contexts by creation date (newest first)
      savedContexts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      contextList.innerHTML = savedContexts.map(context => `
        <div class="context-item">
          <div class="context-info">
            <div class="context-name">${context.name}</div>
            <div class="context-meta">
              ${context.tabCount} tabs • ${formatDate(context.createdAt)}
              ${context.category ? `<span class="context-category ${context.category}">${getCategoryEmoji(context.category)} ${context.category}</span>` : ''}
            </div>
            ${context.tags && context.tags.length > 0 ? `
              <div class="context-tags">
                ${context.tags.map(tag => `<span class="context-tag">${tag}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="context-actions">
            <button class="btn-small btn-load" data-context-id="${context.id}">Load</button>
            <button class="btn-small btn-delete" data-context-id="${context.id}">Delete</button>
          </div>
        </div>
      `).join('');

      addContextEventListeners();

    } catch (error) {
      console.error('Error loading contexts:', error);
      showNotification('Error loading contexts', 'error');
    }
  }

  function getCategoryEmoji(category) {
    const emojis = {
      work: '💼',
      personal: '👤',
      shopping: '🛒',
      research: '🔍',
      entertainment: '🎮',
      education: '📚',
      social: '📱',
      other: '📁'
    };
    return emojis[category] || '📁';
  }

  function addContextEventListeners() {
    contextList.querySelectorAll('.btn-load').forEach(btn => {
      btn.addEventListener('click', () => loadContext(btn.dataset.contextId));
    });

    contextList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteContext(btn.dataset.contextId));
    });
  }

  // Enhanced Load Context with Advanced Options
  async function loadContext(contextId) {
    try {
      const context = savedContexts.find(c => c.id === contextId);
      
      if (!context) {
        showNotification('Context not found', 'error');
        return;
      }

      const loadMode = document.querySelector('input[name="loadMode"]:checked').value;

      switch (loadMode) {
        case 'replace':
          await loadContextReplace(context);
          break;
        case 'newWindow':
          await loadContextNewWindow(context);
          break;
        case 'background':
          await loadContextBackground(context);
          break;
        case 'merge':
          await loadContextMerge(context);
          break;
      }

      showNotification(`Context "${context.name}" loaded`, 'success');
      window.close();
      
    } catch (error) {
      console.error('Error loading context:', error);
      showNotification('Error loading context', 'error');
    }
  }

  async function loadContextReplace(context) {
    const currentTabs = await chrome.tabs.query({});
    
    // Close all current tabs except the first one
    for (let i = 1; i < currentTabs.length; i++) {
      await chrome.tabs.remove(currentTabs[i].id);
    }

    // Navigate first tab to first context tab
    if (context.tabs.length > 0) {
      await chrome.tabs.update(currentTabs[0].id, { url: context.tabs[0].url });
    }

    // Create new tabs for remaining context tabs
    for (let i = 1; i < context.tabs.length; i++) {
      await chrome.tabs.create({ url: context.tabs[i].url });
    }
  }

  async function loadContextNewWindow(context) {
    const window = await chrome.windows.create({});
    
    // Create tabs in new window
    for (let i = 0; i < context.tabs.length; i++) {
      if (i === 0) {
        await chrome.tabs.update(window.tabs[0].id, { url: context.tabs[i].url });
      } else {
        await chrome.tabs.create({ windowId: window.id, url: context.tabs[i].url });
      }
    }
  }

  async function loadContextBackground(context) {
    // Create all tabs in background
    for (const tab of context.tabs) {
      await chrome.tabs.create({ url: tab.url, active: false });
    }
  }

  async function loadContextMerge(context) {
    // Add context tabs to current tabs
    for (const tab of context.tabs) {
      await chrome.tabs.create({ url: tab.url });
    }
  }

  // Filter Contexts
  function filterContexts() {
    const searchTerm = contextSearch.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    
    const filteredContexts = savedContexts.filter(context => {
      const matchesSearch = context.name.toLowerCase().includes(searchTerm) ||
                           (context.tags && context.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
      const matchesCategory = !selectedCategory || context.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });

    displayFilteredContexts(filteredContexts);
  }

  function displayFilteredContexts(contexts) {
    if (contexts.length === 0) {
      contextList.innerHTML = '<div class="no-contexts">No contexts match your search</div>';
      addContextEventListeners();
      return;
    }

    contextList.innerHTML = contexts.map(context => `
      <div class="context-item">
        <div class="context-info">
          <div class="context-name">${context.name}</div>
          <div class="context-meta">
            ${context.tabCount} tabs • ${formatDate(context.createdAt)}
            ${context.category ? `<span class="context-category ${context.category}">${getCategoryEmoji(context.category)} ${context.category}</span>` : ''}
          </div>
          ${context.tags && context.tags.length > 0 ? `
            <div class="context-tags">
              ${context.tags.map(tag => `<span class="context-tag">${tag}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="context-actions">
          <button class="btn-small btn-load" data-context-id="${context.id}">Load</button>
          <button class="btn-small btn-delete" data-context-id="${context.id}">Delete</button>
        </div>
      </div>
    `).join('');

    addContextEventListeners();
  }

  // Smart Notifications
  function showNotification(message, type = 'info') {
    const notification = {
      id: Date.now().toString(),
      message: message,
      type: type,
      timestamp: new Date().toISOString()
    };

    // Save to storage
    chrome.storage.local.get(['notifications'], function(result) {
      const notifications = result.notifications || [];
      notifications.unshift(notification);
      
      // Keep only last 10 notifications
      if (notifications.length > 10) {
        notifications.splice(10);
      }
      
      chrome.storage.local.set({ notifications: notifications });
    });

    // Display notification
    displayNotification(notification);
  }

  function displayNotification(notification) {
    const notificationElement = document.createElement('div');
    notificationElement.className = `notification-item ${notification.type}`;
    notificationElement.innerHTML = `
      <span>${notification.message}</span>
      <span class="notification-remove" role="button" tabindex="0">×</span>
    `;
    
    notificationsList.insertBefore(notificationElement, notificationsList.firstChild);
    
    // Attach remove event listener (CSP-safe)
    const removeBtn = notificationElement.querySelector('.notification-remove');
    removeBtn.addEventListener('click', () => {
      notificationElement.remove();
      // Remove from storage
      chrome.storage.local.get(['notifications'], function(result) {
        const notifications = result.notifications || [];
        const filteredNotifications = notifications.filter(n => n.id !== notification.id);
        chrome.storage.local.set({ notifications: filteredNotifications });
      });
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notificationElement.parentNode) {
        notificationElement.remove();
      }
    }, 5000);
  }

  function clearAllNotifications() {
    notificationsList.innerHTML = '';
    chrome.storage.local.set({ notifications: [] });
  }

  async function loadNotifications() {
    try {
      const result = await chrome.storage.local.get(['notifications']);
      const notifications = result.notifications || [];
      
      notifications.forEach(notification => {
        displayNotification(notification);
      });
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }

  // Enhanced Delete Context
  async function deleteContext(contextId) {
    try {
      const contextToDelete = savedContexts.find(c => c.id === contextId);
      if (!contextToDelete) {
        showNotification('Context not found', 'error');
        return;
      }

      if (confirm(`Are you sure you want to delete "${contextToDelete.name}"?`)) {
        savedContexts = savedContexts.filter(c => c.id !== contextId);
        await chrome.storage.local.set({ contexts: savedContexts });
        
        await loadSavedContexts();
        updateStats();
        showNotification(`Context "${contextToDelete.name}" deleted`, 'success');
      }
    } catch (error) {
      console.error('Error deleting context:', error);
      showNotification('Error deleting context', 'error');
    }
  }

  // Enhanced Close All Tabs
  async function closeAllTabs() {
    try {
      if (confirm('Are you sure you want to close all tabs?')) {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          await chrome.tabs.remove(tab.id);
        }
        showNotification('All tabs closed', 'success');
        window.close();
      }
    } catch (error) {
      console.error('Error closing tabs:', error);
      showNotification('Error closing tabs', 'error');
    }
  }

  // Enhanced Auto-Organize
  async function autoOrganizeTabs() {
    try {
      await smartOrganizeTabs();
    } catch (error) {
      console.error('Error auto-organizing tabs:', error);
      showNotification('Error auto-organizing tabs', 'error');
    }
  }

  // Update Statistics
  async function updateStats() {
    try {
      const totalTabs = savedContexts.reduce((sum, context) => sum + context.tabCount, 0);
      
      totalContextsSpan.textContent = savedContexts.length;
      totalTabsSpan.textContent = totalTabs;
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  // Format Date
  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) {
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}); 