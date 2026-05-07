function normalizeLine(value, fallback = '') {
  return String(value || fallback)
    .replace(/\s+/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();
}

export function buildNotificationContent(title, body) {
  const cleanTitle = normalizeLine(title, 'Reminder');
  const cleanBody = normalizeLine(body, 'Open NoteKit for more details.');

  return {
    title: cleanTitle.slice(0, 80),
    body: cleanBody.slice(0, 140),
  };
}

export function sendNotification(title, body) {
  return buildNotificationContent(title, body);
}
