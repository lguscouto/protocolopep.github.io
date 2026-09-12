function inRange(entry, startDate, endDate) {
  return entry?.date && (!startDate || entry.date >= startDate) && (!endDate || entry.date <= endDate);
}

export function buildProgressSummary({ measurements = [], peptides = [], logs = {}, startDate = null, endDate = null } = {}) {
  const entries = measurements.filter((entry) => inRange(entry, startDate, endDate));
  const weights = entries.filter((entry) => Number.isFinite(entry?.weightKg) && entry.weightKg > 0)
    .sort((a, b) => `${a.date}T${a.time || ""}`.localeCompare(`${b.date}T${b.time || ""}`));
  const firstWeight = weights[0]?.weightKg ?? null;
  const latestWeight = weights.at(-1)?.weightKg ?? null;
  const absoluteChangeKg = firstWeight === null || latestWeight === null ? null : Math.round((latestWeight - firstWeight) * 100) / 100;
  const percentChange = absoluteChangeKg === null || firstWeight === 0 ? null : Math.round((absoluteChangeKg / firstWeight) * 1000) / 10;
  const symptoms = new Map();
  entries.forEach((entry) => (entry.symptoms || []).forEach((name) => symptoms.set(name, (symptoms.get(name) || 0) + 1)));
  const symptomFrequency = [...symptoms.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const doseContexts = peptides.filter((item) => item.lifecycleStatus !== "ended").map((item) => {
    let matchingRecords = 0;
    Object.entries(logs).forEach(([date, byPeptide]) => {
      if ((startDate && date < startDate) || (endDate && date > endDate)) return;
      const records = Array.isArray(byPeptide?.[item.id]) ? byPeptide[item.id] : byPeptide?.[item.id] ? [byPeptide[item.id]] : [];
      matchingRecords += records.filter((record) => record?.status !== "skipped" && record?.status !== "missed" && String(record?.dose || "") === String(item.dose || "")).length;
    });
    return { id: item.id, name: item.name || "Tratamento", dose: item.dose || "Não informada", matchingRecords };
  });
  return { firstWeight, latestWeight, absoluteChangeKg, percentChange, weightCount: weights.length, symptomFrequency, doseContexts };
}
