function normalizeAuthEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return email.includes('@') ? email : '';
}

module.exports = {
  normalizeAuthEmail,
};
