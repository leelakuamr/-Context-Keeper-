// content.js - Context Keeper content script

// This content script can be used for future features like:
// - Automatic context detection based on page content
// - Keyboard shortcuts for quick context operations
// - Page-specific context suggestions

console.log('Context Keeper content script loaded');

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getPageInfo':
      sendResponse({
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname
      });
      break;
      
    case 'detectContext':
      detectPageContext().then(sendResponse);
      return true; // Keep message channel open for async response
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Detect potential context based on page content
async function detectPageContext() {
  try {
    const pageInfo = {
      url: window.location.href,
      title: document.title,
      domain: window.location.hostname,
      keywords: extractKeywords(),
      contentType: detectContentType()
    };

    return { success: true, pageInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Extract keywords from page content
function extractKeywords() {
  const keywords = [];
  
  // Get meta keywords
  const metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords) {
    keywords.push(...metaKeywords.content.split(',').map(k => k.trim()));
  }
  
  // Get page title words
  const titleWords = document.title.toLowerCase().split(/\s+/);
  keywords.push(...titleWords.filter(word => word.length > 3));
  
  // Get heading words
  const headings = document.querySelectorAll('h1, h2, h3');
  headings.forEach(heading => {
    const headingWords = heading.textContent.toLowerCase().split(/\s+/);
    keywords.push(...headingWords.filter(word => word.length > 3));
  });
  
  // Remove duplicates and common words
  const commonWords = ['the', 'and', 'for', 'with', 'this', 'that', 'have', 'will', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'just', 'into', 'than', 'more', 'other', 'about', 'many', 'then', 'them', 'these', 'so', 'people', 'can', 'said', 'each', 'which', 'she', 'do', 'how', 'their', 'if', 'up', 'out', 'many', 'then', 'them', 'these', 'so', 'people', 'can', 'said', 'each', 'which', 'she', 'do', 'how', 'their', 'if', 'up', 'out'];
  
  return [...new Set(keywords)].filter(word => 
    word.length > 3 && !commonWords.includes(word)
  ).slice(0, 10);
}

// Detect content type based on page structure
function detectContentType() {
  if (document.querySelector('article, .post, .blog-post')) {
    return 'article';
  } else if (document.querySelector('.product, .item')) {
    return 'product';
  } else if (document.querySelector('form, .login, .signup')) {
    return 'form';
  } else if (document.querySelector('.video, video')) {
    return 'video';
  } else if (document.querySelector('.gallery, .images')) {
    return 'gallery';
  } else {
    return 'general';
  }
}

// Add keyboard shortcuts for quick context operations
document.addEventListener('keydown', (event) => {
  // Ctrl+Shift+S to save current page to context
  if (event.ctrlKey && event.shiftKey && event.key === 'S') {
    event.preventDefault();
    chrome.runtime.sendMessage({
      action: 'saveCurrentTab',
      tab: {
        url: window.location.href,
        title: document.title,
        favIconUrl: document.querySelector('link[rel="icon"]')?.href
      }
    });
  }
  
  // Ctrl+Shift+L to load last context
  if (event.ctrlKey && event.shiftKey && event.key === 'L') {
    event.preventDefault();
    chrome.runtime.sendMessage({ action: 'loadLastContext' });
  }
});

// Auto-detect when user might want to save a context
let lastActivity = Date.now();
let activityTimer;

// Track user activity
document.addEventListener('click', updateActivity);
document.addEventListener('scroll', updateActivity);
document.addEventListener('keydown', updateActivity);

function updateActivity() {
  lastActivity = Date.now();
  clearTimeout(activityTimer);
  
  // If user has been active for more than 5 minutes, suggest saving context
  activityTimer = setTimeout(() => {
    const timeSinceLastActivity = Date.now() - lastActivity;
    if (timeSinceLastActivity > 5 * 60 * 1000) { // 5 minutes
      suggestSaveContext();
    }
  }, 5 * 60 * 1000);
}

// Suggest saving context after extended activity
function suggestSaveContext() {
  // This could show a notification or popup suggesting to save the current context
  console.log('User has been active for a while, might want to save context');
  
  // You could implement a subtle notification here
  // For now, just log to console
}

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
  clearTimeout(activityTimer);
}); 