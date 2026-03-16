// utils/dateTime.js
const formatISTTime = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
};

const formatISTDateTime = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
};

const formatISTDate = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

module.exports = {
  formatISTTime,
  formatISTDateTime,
  formatISTDate
};
