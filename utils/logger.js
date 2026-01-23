/**
 * ============================================================================
 * PRODUCTION LOGGER UTILITY
 * ============================================================================
 * 
 * ERP-standard logging with:
 * - Structured logging (timestamp, level, context)
 * - File-based persistence
 * - Console output for development
 * - Performance metrics
 * - Error tracking
 * - No sensitive data exposure
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const LOG_LEVEL = process.env.LOG_LEVEL ? 
  LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] ?? LOG_LEVELS.INFO : 
  LOG_LEVELS.INFO;

const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'scheduler.log');
const LOG_FILE_ERROR = path.join(LOG_DIR, 'scheduler-error.log');

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ============================================================================
// INTERNAL UTILITIES
// ============================================================================

/**
 * Get current timestamp in ISO format
 */
const getTimestamp = () => {
  return new Date().toISOString();
};

/**
 * Format log message with context
 */
const formatLogMessage = (level, message, context = {}) => {
  const timestamp = getTimestamp();
  const contextStr = Object.keys(context).length > 0 
    ? JSON.stringify(context) 
    : '';
  
  return `[${timestamp}] [${level}] ${message}${contextStr ? ` | ${contextStr}` : ''}`;
};

/**
 * Write to file safely (non-blocking)
 */
const writeToFile = (filePath, content) => {
  try {
    fs.appendFileSync(filePath, content + '\n', { encoding: 'utf-8' });
  } catch (error) {
    console.error(`[LOGGER] Failed to write to ${filePath}:`, error.message);
  }
};

/**
 * Sanitize sensitive data
 */
const sanitizeContext = (context) => {
  if (!context || typeof context !== 'object') return context;
  
  const sanitized = { ...context };
  const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'email', 'phone'];
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '***REDACTED***';
    }
  });
  
  return sanitized;
};

// ============================================================================
// LOGGER FUNCTIONS
// ============================================================================

/**
 * Debug log (detailed diagnostic information)
 */
const debug = (message, context = {}) => {
  if (LOG_LEVEL > LOG_LEVELS.DEBUG) return;
  
  const logMessage = formatLogMessage('DEBUG', message, sanitizeContext(context));
  console.log(logMessage);
  writeToFile(LOG_FILE, logMessage);
};

/**
 * Info log (important milestones, started/completed)
 */
const info = (message, context = {}) => {
  if (LOG_LEVEL > LOG_LEVELS.INFO) return;
  
  const logMessage = formatLogMessage('INFO', message, sanitizeContext(context));
  console.log(logMessage);
  writeToFile(LOG_FILE, logMessage);
};

/**
 * Warning log (potentially problematic situations)
 */
const warn = (message, context = {}) => {
  if (LOG_LEVEL > LOG_LEVELS.WARN) return;
  
  const logMessage = formatLogMessage('WARN', message, sanitizeContext(context));
  console.warn(logMessage);
  writeToFile(LOG_FILE, logMessage);
};

/**
 * Error log (error conditions)
 */
const error = (message, context = {}) => {
  if (LOG_LEVEL > LOG_LEVELS.ERROR) return;
  
  const logMessage = formatLogMessage('ERROR', message, sanitizeContext(context));
  console.error(logMessage);
  writeToFile(LOG_FILE, logMessage);
  writeToFile(LOG_FILE_ERROR, logMessage);
};

/**
 * Performance metrics
 */
const performance = (label, durationMs, context = {}) => {
  const message = `[PERF] ${label} completed in ${durationMs}ms`;
  const logMessage = formatLogMessage('INFO', message, sanitizeContext(context));
  console.log(logMessage);
  writeToFile(LOG_FILE, logMessage);
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  debug,
  info,
  warn,
  error,
  performance,
  
  // Utilities
  getTimestamp,
  sanitizeContext
};
