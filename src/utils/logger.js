const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // text colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
}

function getMethodColor(method) {
  switch(method) {
    case 'GET': return colors.green
    case 'POST': return colors.blue
    case 'PUT': return colors.yellow
    case 'PATCH': return colors.magenta
    case 'DELETE': return colors.red
    default: return colors.white
  }
}

function getStatusColor(status) {
  if (status >= 500) return colors.red
  if (status >= 400) return colors.yellow
  if (status >= 300) return colors.cyan
  return colors.green
}

function formatTime() {
  const now = new Date()
  return now.toTimeString().split(' ')[0]
}

module.exports = {
  info: (msg, ...args) => {
    console.log(`${colors.cyan}[INFO]${colors.reset} ${formatTime()} ${msg}`, ...args)
  },
  
  success: (msg, ...args) => {
    console.log(`${colors.green}✓${colors.reset} ${formatTime()} ${msg}`, ...args)
  },
  
  error: (msg, ...args) => {
    console.error(`${colors.red}[ERROR]${colors.reset} ${formatTime()} ${msg}`, ...args)
  },
  
  warn: (msg, ...args) => {
    console.warn(`${colors.yellow}[WARN]${colors.reset} ${formatTime()} ${msg}`, ...args)
  },
  
  request: (req, res, ms) => {
    const methodColor = getMethodColor(req.method)
    const statusColor = getStatusColor(res.statusCode)
    console.log(
      `${methodColor}${req.method}${colors.reset} ${req.originalUrl} ` +
      `${statusColor}${res.statusCode}${colors.reset} ` +
      `${colors.dim}${ms}ms${colors.reset}`
    )
  },
  
  db: (msg, ...args) => {
    console.log(`${colors.magenta}[DB]${colors.reset} ${formatTime()} ${msg}`, ...args)
  },
  
  auth: (msg, ...args) => {
    console.log(`${colors.blue}[AUTH]${colors.reset} ${formatTime()} ${msg}`, ...args)
  }
}








