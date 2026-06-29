const RUN_NAME_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function formatRunNameTimestamp(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: RUN_NAME_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}

module.exports = {
  RUN_NAME_TIME_ZONE,
  formatRunNameTimestamp,
};
