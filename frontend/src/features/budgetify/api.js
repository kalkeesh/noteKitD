import { budgetifyApiRequest } from '../../config/api';

export async function setupBudget(payload, token) {
  return budgetifyApiRequest('/budget/setup', 'POST', payload, token);
}

export async function addExpense(payload, token) {
  return budgetifyApiRequest('/budget/expense', 'POST', payload, token);
}

export async function addEmi(payload, token) {
  return budgetifyApiRequest('/budget/emi', 'POST', payload, token);
}

export async function updateEmi(id, payload, token) {
  return budgetifyApiRequest(`/budget/emi/${id}`, 'PUT', payload, token);
}

export async function deleteEmi(id, token) {
  return budgetifyApiRequest(`/budget/emi/${id}`, 'DELETE', undefined, token);
}

export async function addSip(payload, token) {
  return budgetifyApiRequest('/budget/sip', 'POST', payload, token);
}

export async function addDebt(payload, token) {
  return budgetifyApiRequest('/budget/debt', 'POST', payload, token);
}

export async function markDebtPaid(id, token) {
  return budgetifyApiRequest(`/budget/debt/${id}/paid`, 'PUT', undefined, token);
}

export async function updateDebt(id, payload, token) {
  return budgetifyApiRequest(`/budget/debt/${id}`, 'PUT', payload, token);
}

export async function deleteDebt(id, token) {
  return budgetifyApiRequest(`/budget/debt/${id}`, 'DELETE', undefined, token);
}

export async function addSpend(payload, token) {
  return budgetifyApiRequest('/budget/spend', 'POST', payload, token);
}

export async function updateSpend(id, payload, token) {
  return budgetifyApiRequest(`/budget/spend/${id}`, 'PUT', payload, token);
}

export async function getSpends(token, params = {}) {
  const query = [];
  if (params.month) {
    query.push(`month=${params.month}`);
  }
  if (params.year) {
    query.push(`year=${params.year}`);
  }
  if (params.date_from) {
    query.push(`date_from=${encodeURIComponent(params.date_from)}`);
  }
  if (params.date_to) {
    query.push(`date_to=${encodeURIComponent(params.date_to)}`);
  }
  const suffix = query.length ? `?${query.join('&')}` : '';
  return budgetifyApiRequest(`/budget/spend${suffix}`, 'GET', undefined, token);
}

export async function getTodayBudget(token, month, year) {
  const query = [];
  if (month) {
    query.push(`month=${month}`);
  }
  if (year) {
    query.push(`year=${year}`);
  }
  const suffix = query.length ? `?${query.join('&')}` : '';
  return budgetifyApiRequest(`/budget/today${suffix}`, 'GET', undefined, token);
}

export async function getBudgetReport(token, month, year) {
  const query = [];
  if (month) {
    query.push(`month=${month}`);
  }
  if (year) {
    query.push(`year=${year}`);
  }
  const suffix = query.length ? `?${query.join('&')}` : '';
  return budgetifyApiRequest(`/budget/report${suffix}`, 'GET', undefined, token);
}

export async function getBudgetSummary(token, month, year) {
  const query = [];
  if (month) {
    query.push(`month=${month}`);
  }
  if (year) {
    query.push(`year=${year}`);
  }
  const suffix = query.length ? `?${query.join('&')}` : '';
  return budgetifyApiRequest(`/budget/summary${suffix}`, 'GET', undefined, token);
}

export async function getDebts(token, month, year) {
  const query = [];
  if (month) {
    query.push(`month=${month}`);
  }
  if (year) {
    query.push(`year=${year}`);
  }
  const suffix = query.length ? `?${query.join('&')}` : '';
  return budgetifyApiRequest(`/budget/debts${suffix}`, 'GET', undefined, token);
}

export async function getMandatoryExpenses(token, month, year) {
  const query = [];
  if (month) {
    query.push(`month=${month}`);
  }
  if (year) {
    query.push(`year=${year}`);
  }
  const suffix = query.length ? `?${query.join('&')}` : '';
  return budgetifyApiRequest(`/budget/expenses${suffix}`, 'GET', undefined, token);
}

export async function getEmi(token, month, year) {
  const query = [];
  if (month) {
    query.push(`month=${month}`);
  }
  if (year) {
    query.push(`year=${year}`);
  }
  const suffix = query.length ? `?${query.join('&')}` : '';
  return budgetifyApiRequest(`/budget/emi${suffix}`, 'GET', undefined, token);
}

export async function setEmiMonthlyStatus(id, payload, token) {
  return budgetifyApiRequest(`/budget/emi/${id}/status`, 'PUT', payload, token);
}

export async function getSip(token, month, year) {
  const query = [];
  if (month) {
    query.push(`month=${month}`);
  }
  if (year) {
    query.push(`year=${year}`);
  }
  const suffix = query.length ? `?${query.join('&')}` : '';
  return budgetifyApiRequest(`/budget/sip${suffix}`, 'GET', undefined, token);
}

export async function setSipMonthlyStatus(id, payload, token) {
  return budgetifyApiRequest(`/budget/sip/${id}/status`, 'PUT', payload, token);
}
