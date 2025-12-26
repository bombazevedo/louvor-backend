// src/utils/dateUtils.js
function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);

  // ajuste simples para meses com menos dias (ex.: 31 -> 30/28)
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function startOfNow() {
  return new Date();
}

module.exports = { addMonths, startOfNow };
