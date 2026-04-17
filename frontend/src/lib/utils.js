import { formatDistanceToNow, format } from 'date-fns';

const parseTimestamp = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;

  if (
    typeof timestamp === 'string' &&
    !/[zZ]$/.test(timestamp) &&
    !/[+-]\d{2}:\d{2}$/.test(timestamp)
  ) {
    return new Date(`${timestamp}Z`);
  }

  return new Date(timestamp);
};

export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const parsed = parseTimestamp(timestamp);
  if (!parsed || Number.isNaN(parsed.getTime())) return '';
  return formatDistanceToNow(parsed, { addSuffix: true });
};

export const formatDateTime = (timestamp) => {
  if (!timestamp) return '';
  const parsed = parseTimestamp(timestamp);
  if (!parsed || Number.isNaN(parsed.getTime())) return '';
  return format(parsed, 'PPpp');
};

export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const generateRandomColor = (seed) => {
  const hue = (seed || Math.random()) * 360;
  return `hsl(${hue}, 70%, 50%)`;
};

export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};
