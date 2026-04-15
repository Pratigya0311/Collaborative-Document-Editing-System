import { formatDistanceToNow, format } from 'date-fns';

export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
};

export const formatDateTime = (timestamp) => {
  if (!timestamp) return '';
  return format(new Date(timestamp), 'PPpp');
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