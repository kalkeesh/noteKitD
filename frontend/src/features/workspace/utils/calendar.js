export function buildTaskCalendarMap(todos) {
  const byDate = {};

  (todos || []).forEach((todo) => {
    (todo.items || []).forEach((item) => {
      const date = item.reminderDate || '';
      if (!date) {
        return;
      }

      if (!byDate[date]) {
        byDate[date] = [];
      }

      byDate[date].push({
        id: `${todo.id}-${item.id}`,
        listTitle: todo.title || 'Untitled List',
        text: item.text || '(empty task)',
        done: Boolean(item.done),
        time: item.reminderTime || '',
      });
    });
  });

  Object.keys(byDate).forEach((date) => {
    byDate[date].sort((a, b) => {
      const timeA = a.time || '99:99';
      const timeB = b.time || '99:99';
      return timeA.localeCompare(timeB);
    });
  });

  return byDate;
}

export function formatMonthYear(year, month) {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];

  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    const dayNum = daysInPrevMonth - i;
    const date = new Date(year, month - 1, dayNum);
    cells.push({ date, inCurrentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ date, inCurrentMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const offset = cells.length - (startWeekday + daysInMonth) + 1;
    const date = new Date(year, month + 1, offset);
    cells.push({ date, inCurrentMonth: false });
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
}
