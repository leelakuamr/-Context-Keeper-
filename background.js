// background.js - Enhanced Context Keeper background service worker

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Context Keeper extension installed');
  
  // Initialize storage with empty arrays
  chrome.storage.local.set({ 
    contexts: [],
    notifications: [],
    userPreferences: {
      autoSave: false,
      autoSaveInterval: 30, // minutes
      maxContexts: 50,
      enableNotifications: true
    }
  });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getTabCount':
      getTabCount().then(sendResponse);
      return true;
      
    case 'saveContext':
      saveContext(request.contextName, request.category, request.tags).then(sendResponse);
      return true;
      
    case 'loadContext':
      loadContext(request.contextId, request.loadMode).then(sendResponse);
      return true;
      
    case 'deleteContext':
      deleteContext(request.contextId).then(sendResponse);
      return true;
      
    case 'autoOrganize':
      autoOrganizeTabs().then(sendResponse);
      return true;
      
    case 'smartOrganize':
      smartOrganizeTabs().then(sendResponse);
      return true;
      
    case 'getSmartSuggestions':
      getSmartSuggestions().then(sendResponse);
      return true;
      
    case 'addNotification':
      addNotification(request.message, request.type).then(sendResponse);
      return true;
      
    case 'getNotifications':
      getNotifications().then(sendResponse);
      return true;
      
    case 'clearNotifications':
      clearNotifications().then(sendResponse);
      return true;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Get current tab count
async function getTabCount() {
  try {
    const tabs = await chrome.tabs.query({});
    return { success: true, count: tabs.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Enhanced Save Context with Categories and Tags
async function saveContext(contextName, category = '', tags = []) {
  try {
    const tabs = await chrome.tabs.query({});
    
    if (tabs.length === 0) {
      return { success: false, error: 'No tabs to save' };
    }

    const context = {
      id: Date.now().toString(),
      name: contextName,
      category: category,
      tags: tags,
      tabs: tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      })),
      createdAt: new Date().toISOString(),
      tabCount: tabs.length
    };

    const result = await chrome.storage.local.get(['contexts']);
    const contexts = result.contexts || [];
    
    // Check if context name already exists
    const existingIndex = contexts.findIndex(c => c.name === contextName);
    if (existingIndex !== -1) {
      contexts[existingIndex] = context;
    } else {
      contexts.push(context);
    }

    await chrome.storage.local.set({ contexts });

    // Add notification
    await addNotification(`Context "${contextName}" saved with ${tabs.length} tabs`, 'success');

    return { 
      success: true, 
      message: `Context "${contextName}" saved with ${tabs.length} tabs`,
      context 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Enhanced Load Context with Multiple Modes
async function loadContext(contextId, loadMode = 'replace') {
  try {
    const result = await chrome.storage.local.get(['contexts']);
    const contexts = result.contexts || [];
    const context = contexts.find(c => c.id === contextId);
    
    if (!context) {
      return { success: false, error: 'Context not found' };
    }

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
      default:
        await loadContextReplace(context);
    }

    // Add notification
    await addNotification(`Context "${context.name}" loaded`, 'success');

    return { 
      success: true, 
      message: `Context "${context.name}" loaded`,
      context 
    };
  } catch (error) {
    return { success: false, error: error.message };
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

// Enhanced Delete Context
async function deleteContext(contextId) {
  try {
    const result = await chrome.storage.local.get(['contexts']);
    let contexts = result.contexts || [];
    
    const contextToDelete = contexts.find(c => c.id === contextId);
    if (!contextToDelete) {
      return { success: false, error: 'Context not found' };
    }

    contexts = contexts.filter(c => c.id !== contextId);
    await chrome.storage.local.set({ contexts });

    // Add notification
    await addNotification(`Context "${contextToDelete.name}" deleted`, 'info');

    return { 
      success: true, 
      message: `Context "${contextToDelete.name}" deleted`,
      deletedContext: contextToDelete 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Enhanced Auto-Organize with Smart Categorization
async function autoOrganizeTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    
    // Group tabs by domain
    const domainGroups = {};
    tabs.forEach(tab => {
      try {
        const domain = new URL(tab.url).hostname;
        if (!domainGroups[domain]) {
          domainGroups[domain] = [];
        }
        domainGroups[domain].push(tab);
      } catch (error) {
        // Skip invalid URLs
        console.warn('Invalid URL:', tab.url);
      }
    });

    const createdContexts = [];

    // Create contexts for each domain group
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

        const result = await chrome.storage.local.get(['contexts']);
        const contexts = result.contexts || [];
        contexts.push(context);
        await chrome.storage.local.set({ contexts });
        
        createdContexts.push(context);
      }
    }

    // Add notification
    await addNotification(`Auto-organized ${createdContexts.length} contexts`, 'success');

    return { 
      success: true, 
      message: `Auto-organized ${createdContexts.length} contexts`,
      createdContexts 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Smart Organize Tabs with Enhanced Logic
async function smartOrganizeTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    
    // Enhanced domain grouping with priority detection
    const domainGroups = {};
    const priorityTabs = [];
    
    tabs.forEach(tab => {
      try {
        const domain = new URL(tab.url).hostname;
        
        // Detect priority tabs (pinned, active, or important domains)
        if (tab.pinned || tab.active || isImportantDomain(domain)) {
          priorityTabs.push(tab);
        }
        
        if (!domainGroups[domain]) {
          domainGroups[domain] = [];
        }
        domainGroups[domain].push(tab);
      } catch (error) {
        console.warn('Invalid URL:', tab.url);
      }
    });

    const createdContexts = [];

    // Create priority context if needed
    if (priorityTabs.length > 0) {
      const priorityContext = {
        id: Date.now().toString() + 'priority',
        name: `Priority Tabs (${priorityTabs.length} tabs)`,
        category: 'work',
        tags: ['priority', 'important', 'smart-organized'],
        tabs: priorityTabs.map(tab => ({
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl
        })),
        createdAt: new Date().toISOString(),
        tabCount: priorityTabs.length
      };

      const result = await chrome.storage.local.get(['contexts']);
      const contexts = result.contexts || [];
      contexts.push(priorityContext);
      await chrome.storage.local.set({ contexts });
      
      createdContexts.push(priorityContext);
    }

    // Create contexts for remaining domain groups
    for (const [domain, domainTabs] of Object.entries(domainGroups)) {
      if (domainTabs.length > 1 && !isImportantDomain(domain)) {
        const contextName = `${domain} (${domainTabs.length} tabs)`;
        const category = getCategoryFromDomain(domain);
        
        const context = {
          id: Date.now().toString() + Math.random(),
          name: contextName,
          category: category,
          tags: [domain, 'smart-organized'],
          tabs: domainTabs.map(tab => ({
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl
          })),
          createdAt: new Date().toISOString(),
          tabCount: domainTabs.length
        };

        const result = await chrome.storage.local.get(['contexts']);
        const contexts = result.contexts || [];
        contexts.push(context);
        await chrome.storage.local.set({ contexts });
        
        createdContexts.push(context);
      }
    }

    // Add notification
    await addNotification(`Smart organized ${createdContexts.length} contexts`, 'success');

    return { 
      success: true, 
      message: `Smart organized ${createdContexts.length} contexts`,
      createdContexts 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get Smart Suggestions
async function getSmartSuggestions() {
  try {
    const tabs = await chrome.tabs.query({});
    
    if (tabs.length === 0) {
      return { success: true, suggestions: [] };
    }

    const suggestions = [];
    const domainCounts = {};
    const commonWords = {};

    // Analyze current tabs
    tabs.forEach(tab => {
      try {
        const domain = new URL(tab.url).hostname;
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        
        // Extract common words from titles
        const words = tab.title.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 3 && !isCommonWord(word)) {
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

    // Add category-based suggestions
    const category = getCategoryFromTabs(tabs);
    if (category) {
      suggestions.push(`${category.charAt(0).toUpperCase() + category.slice(1)} Session`);
    }

    return { success: true, suggestions: suggestions.slice(0, 6) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Helper Functions
function getCategoryFromDomain(domain) {
  const workDomains = ['gmail.com', 'google.com', 'slack.com', 'zoom.us', 'teams.microsoft.com', 'outlook.com'];
  const shoppingDomains = ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com'];
  const socialDomains = ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'reddit.com'];
  const entertainmentDomains = ['youtube.com', 'netflix.com', 'spotify.com', 'twitch.tv', 'hulu.com'];
  const educationDomains = ['wikipedia.org', 'khanacademy.org', 'coursera.org', 'udemy.com'];
  
  if (workDomains.some(d => domain.includes(d))) return 'work';
  if (shoppingDomains.some(d => domain.includes(d))) return 'shopping';
  if (socialDomains.some(d => domain.includes(d))) return 'social';
  if (entertainmentDomains.some(d => domain.includes(d))) return 'entertainment';
  if (educationDomains.some(d => domain.includes(d))) return 'education';
  
  return 'other';
}

function isImportantDomain(domain) {
  const importantDomains = ['gmail.com', 'google.com', 'slack.com', 'zoom.us', 'teams.microsoft.com'];
  return importantDomains.some(d => domain.includes(d));
}

function isCommonWord(word) {
  const commonWords = ['the', 'and', 'for', 'with', 'this', 'that', 'have', 'from', 'they', 'know'];
  return commonWords.includes(word);
}

function getCategoryFromTabs(tabs) {
  const categories = {};
  
  tabs.forEach(tab => {
    try {
      const domain = new URL(tab.url).hostname;
      const category = getCategoryFromDomain(domain);
      categories[category] = (categories[category] || 0) + 1;
    } catch (error) {
      // Skip invalid URLs
    }
  });

  // Return the most common category
  return Object.entries(categories)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
}

// Notification System
async function addNotification(message, type = 'info') {
  try {
    const notification = {
      id: Date.now().toString(),
      message: message,
      type: type,
      timestamp: new Date().toISOString()
    };

    const result = await chrome.storage.local.get(['notifications']);
    const notifications = result.notifications || [];
    notifications.unshift(notification);
    
    // Keep only last 10 notifications
    if (notifications.length > 10) {
      notifications.splice(10);
    }
    
    await chrome.storage.local.set({ notifications: notifications });

    return { success: true, notification };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getNotifications() {
  try {
    const result = await chrome.storage.local.get(['notifications']);
    return { success: true, notifications: result.notifications || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function clearNotifications() {
  try {
    await chrome.storage.local.set({ notifications: [] });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Tab Management Functions
async function saveCurrentTabToContext(tab) {
  try {
    const contextName = `Single Tab - ${tab.title}`;
    const context = {
      id: Date.now().toString(),
      name: contextName,
      category: getCategoryFromDomain(new URL(tab.url).hostname),
      tags: ['single-tab', 'quick-save'],
      tabs: [{
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      }],
      createdAt: new Date().toISOString(),
      tabCount: 1
    };

    const result = await chrome.storage.local.get(['contexts']);
    const contexts = result.contexts || [];
    contexts.push(context);
    await chrome.storage.local.set({ contexts });

    return { success: true, context };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function saveAllTabsAsContext() {
  try {
    const tabs = await chrome.tabs.query({});
    const contextName = `All Tabs - ${new Date().toLocaleString()}`;
    
    return await saveContext(contextName, 'other', ['all-tabs', 'backup']);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Listen for tab updates to track context changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Could be used for automatic context detection in the future
    console.log('Tab updated:', tab.url);
  }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log('Tab removed:', tabId);
});

// Context menu for right-click actions
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'saveCurrentTab',
    title: 'Save current tab to context',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'saveAllTabs',
    title: 'Save all tabs as context',
    contexts: ['page']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'saveCurrentTab':
      saveCurrentTabToContext(tab);
      break;
    case 'saveAllTabs':
      saveAllTabsAsContext();
      break;
  }
}); 