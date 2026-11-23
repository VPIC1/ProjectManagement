// Keep the calendar window intact, including months with no projects due.
export function dueMonthRows(months, year, today) {
  const [currentYear, currentMonth] = (today ?? "").split("-").map(Number);
  if (!currentYear || !currentMonth || year > currentYear) return [];
  const lastMonth = year === currentYear ? currentMonth : 12;
  return [2, 1, 0].map((offset) => {
    const index = year * 12 + lastMonth - 1 - offset;
    const rowYear = Math.floor(index / 12);
    const month = (index % 12) + 1;
    return (
      months.find((row) => (row.year ?? year) === rowYear && row.month === month) ?? {
        year: rowYear,
        month,
        complete: 0,
        overdue: 0,
        notOverdue: 0,
        total: 0,
      }
    );
  });
}
