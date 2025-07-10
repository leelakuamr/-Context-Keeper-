// popup-debug.js - Debug version with enhanced error handling

document.addEventListener('DOMContentLoaded', function() {
  const contextNameInput = document.getElementById('contextName');
  const saveContextBtn = document.getElementById('saveContext');
  const contextList = document.getElementById('contextList');
  const tabCountSpan = document.getElementById('tabCount');
  const totalContextsSpan = document.getElementById('totalContexts');
  const totalTabsSpan = document.getElementById('totalTabs');
  const closeAllTabsBtn = document.getElementById('closeAllTabs');
  const organizeTabsBtn = document.getElementById('organizeTabs');
  const contextNoteInput = document.getElementById('contextNote');
  const importContextBtn = document.getElementById('importContext');

  let currentTabCount = 0;

  // Initialize popup
  initializePopup();

  // Event listeners with debug logging
  saveContextBtn.addEventListener('click', saveCurrentContext);
  closeAllTabsBtn.addEventListener('click', closeAllTabs);
  
  // Enhanced Auto-Organize button listener with debugging
  organizeTabsBtn.addEventListener('click', function() {
    console.log('Auto-Organize button clicked');
    showMessage('Starting Auto-Organize...', 'success');
    autoOrganizeTabs();
  });
  
  contextNameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      saveCurrentContext();
    }
  });

  // Import context event
  importContextBtn.addEventListener('click', importContext);

  // Initialize popup data
  async function initializePopup() {
    try {
      console.log('Initializing popup...');
      
      // Get current tab count
      const tabs = await chrome.tabs.query({});
      currentTabCount = tabs.length;
      tabCountSpan.textContent = currentTabCount;
      console.log(`Found ${currentTabCount} tabs`);

      // Load saved contexts
      await loadSavedContexts();
      
      // Update stats
      updateStats();
      
      console.log('Popup initialized successfully');
    } catch (error) {
      console.error('Error initializing popup:', error);
      showMessage('Error loading data: ' + error.message, 'error');
    }
  }

  // Enhanced Auto-organize tabs with detailed logging
  async function autoOrganizeTabs() {
    try {
      console.log('Auto-organize started');
      showMessage('Scanning tabs...', 'success');
      
      const tabs = await chrome.tabs.query({});
      console.log(`Found ${tabs.length} tabs to organize`);
      
      if (tabs.length === 0) {
        showMessage('No tabs found to organize', 'error');
        return;
      }
      
      // Group tabs by domain
      const domainGroups = {};
      let validTabs = 0;
      
      tabs.forEach(tab => {
        try {
          if (tab.url && tab.url.startsWith('http')) {
            const domain = new URL(tab.url).hostname;
            if (!domainGroups[domain]) {
              domainGroups[domain] = [];
            }
            domainGroups[domain].push(tab);
            validTabs++;
          }
        } catch (error) {
          console.warn('Invalid URL:', tab.url, error);
        }
      });
      
      console.log(`Grouped ${validTabs} valid tabs into ${Object.keys(domainGroups).length} domains`);
      
      let contextsCreated = 0;
      
      // Create contexts for each domain group
      for (const [domain, domainTabs] of Object.entries(domainGroups)) {
        console.log(`Processing domain: ${domain} with ${domainTabs.length} tabs`);
        
        if (domainTabs.length > 1) {
          const contextName = `${domain} (${domainTabs.length} tabs)`;
          console.log(`Creating context: ${contextName}`);
          
          const context = {
            id: Date.now().toString() + Math.random(),
            name: contextName,
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
          
          contextsCreated++;
          console.log(`Context created: ${contextName}`);
        } else {
          console.log(`Skipping ${domain} - only ${domainTabs.length} tab`);
        }
      }

      console.log(`Auto-organize completed. Created ${contextsCreated} contexts`);
      
      await loadSavedContexts();
      updateStats();
      
      if (contextsCreated > 0) {
        showMessage(`Auto-organized ${contextsCreated} contexts created!`, 'success');
      } else {
        showMessage('No contexts created (need 2+ tabs per domain)', 'error');
      }
      
    } catch (error) {
      console.error('Error auto-organizing tabs:', error);
      showMessage('Error auto-organizing: ' + error.message, 'error');
    }
  }

  // Save current context
  async function saveCurrentContext() {
    const contextName = contextNameInput.value.trim();
    const contextNote = contextNoteInput.value.trim();
    
    if (!contextName) {
      showMessage('Please enter a context name', 'error');
      return;
    }

    try {
      const tabs = await chrome.tabs.query({});
      
      if (tabs.length === 0) {
        showMessage('No tabs to save', 'error');
        return;
      }

      const context = {
        id: Date.now().toString(),
        name: contextName,
        note: contextNote,
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
      
      const existingIndex = contexts.findIndex(c => c.name === contextName);
      if (existingIndex !== -1) {
        contexts[existingIndex] = context;
      } else {
        contexts.push(context);
      }

      await chrome.storage.local.set({ contexts });

      contextNameInput.value = '';
      contextNoteInput.value = '';
      await loadSavedContexts();
      updateStats();
      
      showMessage(`Context "${contextName}" saved with ${tabs.length} tabs`, 'success');
    } catch (error) {
      console.error('Error saving context:', error);
      showMessage('Error saving context: ' + error.message, 'error');
    }
  }

  // Load saved contexts
  async function loadSavedContexts() {
    try {
      const result = await chrome.storage.local.get(['contexts']);
      const contexts = result.contexts || [];
      
      if (contexts.length === 0) {
        contextList.innerHTML = '<div class="no-contexts">No saved contexts yet</div>';
        return;
      }

      contexts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      contextList.innerHTML = contexts.map(context => `
        <div class="context-item">
          <div class="context-info">
            <div class="context-name">${context.name}</div>
            <div class="context-meta">
              ${context.tabCount} tabs • ${formatDate(context.createdAt)}
            </div>
            ${context.note ? `<div class='context-note'>${context.note.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
          </div>
          <div class="context-actions">
            <button class="btn-small btn-load" data-context-id="${context.id}">Load</button>
            <button class="btn-small btn-delete" data-context-id="${context.id}">Delete</button>
          </div>
        </div>
      `).join('');

      contextList.querySelectorAll('.btn-load').forEach(btn => {
        btn.addEventListener('click', () => loadContext(btn.dataset.contextId));
      });

      contextList.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteContext(btn.dataset.contextId));
      });

    } catch (error) {
      console.error('Error loading contexts:', error);
      showMessage('Error loading contexts: ' + error.message, 'error');
    }
  }

  // Load a specific context
  async function loadContext(contextId) {
    try {
      const result = await chrome.storage.local.get(['contexts']);
      const contexts = result.contexts || [];
      const context = contexts.find(c => c.id === contextId);
      
      if (!context) {
        showMessage('Context not found', 'error');
        return;
      }

      const currentTabs = await chrome.tabs.query({});
      for (let i = 1; i < currentTabs.length; i++) {
        await chrome.tabs.remove(currentTabs[i].id);
      }

      if (context.tabs.length > 0) {
        await chrome.tabs.update(currentTabs[0].id, { url: context.tabs[0].url });
      }

      for (let i = 1; i < context.tabs.length; i++) {
        await chrome.tabs.create({ url: context.tabs[i].url });
      }

      showMessage(`Context "${context.name}" loaded`, 'success');
      window.close();
    } catch (error) {
      console.error('Error loading context:', error);
      showMessage('Error loading context: ' + error.message, 'error');
    }
  }

  // Delete a context
  async function deleteContext(contextId) {
    try {
      const result = await chrome.storage.local.get(['contexts']);
      let contexts = result.contexts || [];
      
      const contextToDelete = contexts.find(c => c.id === contextId);
      if (!contextToDelete) {
        showMessage('Context not found', 'error');
        return;
      }

      if (confirm(`Are you sure you want to delete "${contextToDelete.name}"?`)) {
        contexts = contexts.filter(c => c.id !== contextId);
        await chrome.storage.local.set({ contexts });
        
        await loadSavedContexts();
        updateStats();
        showMessage(`Context "${contextToDelete.name}" deleted`, 'success');
      }
    } catch (error) {
      console.error('Error deleting context:', error);
      showMessage('Error deleting context: ' + error.message, 'error');
    }
  }

  // Close all tabs
  async function closeAllTabs() {
    try {
      if (confirm('Are you sure you want to close all tabs?')) {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          await chrome.tabs.remove(tab.id);
        }
        showMessage('All tabs closed', 'success');
        window.close();
      }
    } catch (error) {
      console.error('Error closing tabs:', error);
      showMessage('Error closing tabs: ' + error.message, 'error');
    }
  }

  // Update statistics
  async function updateStats() {
    try {
      const result = await chrome.storage.local.get(['contexts']);
      const contexts = result.contexts || [];
      
      const totalTabs = contexts.reduce((sum, context) => sum + context.tabCount, 0);
      
      totalContextsSpan.textContent = contexts.length;
      totalTabsSpan.textContent = totalTabs;
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  // Show message
  function showMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    
    const container = document.querySelector('.container');
    container.insertBefore(messageDiv, container.firstChild);
    
    setTimeout(() => {
      messageDiv.remove();
    }, 5000); // Show messages longer for debugging
  }

  // Format date
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

  // Import context from file or pasted JSON
  async function importContext() {
    try {
      // Prompt for file or JSON
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        let context;
        try {
          context = JSON.parse(text);
        } catch (err) {
          showMessage('Invalid JSON file', 'error');
          return;
        }
        if (!context.name || !context.tabs) {
          showMessage('Invalid context format', 'error');
          return;
        }
        context.id = Date.now().toString() + Math.random();
        context.createdAt = new Date().toISOString();
        context.tabCount = context.tabs.length;
        const result = await chrome.storage.local.get(['contexts']);
        const contexts = result.contexts || [];
        contexts.push(context);
        await chrome.storage.local.set({ contexts });
        await loadSavedContexts();
        updateStats();
        showMessage('Context imported!', 'success');
      };
      input.click();
    } catch (error) {
      console.error('Error importing context:', error);
      showMessage('Error importing context: ' + error.message, 'error');
    }
  }

  // Add icon helper function
  function icon(type) {
    switch(type) {
      case 'copy': return `<svg viewBox='0 0 20 20'><rect x='6' y='6' width='8' height='8' rx='2' fill='none' stroke='#888' stroke-width='1.5'/><rect x='8' y='8' width='6' height='6' rx='1.5' fill='none' stroke='#bbb' stroke-width='1'/></svg>`;
      case 'download': return `<svg viewBox='0 0 20 20'><path d='M10 5v7m0 0l-3-3m3 3l3-3' stroke='#888' stroke-width='1.5' fill='none'/><rect x='6' y='15' width='8' height='1.5' rx='0.75' fill='#bbb'/></svg>`;
      case 'whatsapp': return `<svg viewBox='0 0 20 20'><path d='M7 8c1 2 3 3 5 2' stroke='#25D366' stroke-width='1.5' fill='none'/></svg>`;
      case 'email': return `<svg viewBox='0 0 20 20'><rect x='4' y='6' width='12' height='8' rx='2' fill='none' stroke='#888' stroke-width='1.5'/><polyline points='4,6 10,12 16,6' stroke='#888' stroke-width='1.5' fill='none'/></svg>`;
      case 'telegram': return `<svg viewBox='0 0 20 20'><polygon points='6,10 15,6.5 12,14 10,12 8,13' fill='none' stroke='#0088cc' stroke-width='1.5'/></svg>`;
      case 'messenger': return `<svg viewBox='0 0 20 20'><polyline points='6,13 10,9 13,12 10,7' stroke='#0084FF' stroke-width='1.5' fill='none'/></svg>`;
      case 'twitter': return `<svg viewBox='0 0 20 20'><path d='M7 13c4 0 6-3 6-6v0c0-.5-.5-.5-1-.5-1 0-2 1-3 1s-2-1-2-1' stroke='#1DA1F2' stroke-width='1.2' fill='none'/></svg>`;
      case 'facebook': return `<svg viewBox='0 0 20 20'><rect x='9' y='7' width='2' height='6' fill='#1877F3'/><rect x='8' y='11' width='4' height='2' fill='#1877F3'/></svg>`;
      default: return '';
    }
  }
}); 