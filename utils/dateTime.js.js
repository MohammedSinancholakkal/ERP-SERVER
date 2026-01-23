// utils/dateTime.js
const formatISTTime = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
};

const formatISTDateTime = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
};

module.exports = {
  formatISTTime,
  formatISTDateTime
};
