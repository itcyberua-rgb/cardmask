(() => {
  'use strict';

  const sourceText = document.querySelector('#sourceText');
  const processButton = document.querySelector('#processButton');
  const clearButton = document.querySelector('#clearButton');
  const copyButton = document.querySelector('#copyButton');
  const resultList = document.querySelector('#resultList');
  const emptyState = document.querySelector('#emptyState');
  const errorList = document.querySelector('#errorList');
  const charCount = document.querySelector('#charCount');
  const matchedCount = document.querySelector('#matchedCount');
  const validCount = document.querySelector('#validCount');
  const errorCount = document.querySelector('#errorCount');
  const toast = document.querySelector('#toast');

  const recordPattern = /^(\d{13,19})\|(0[1-9]|1[0-2])\|(\d{2}|\d{4})\|(\d{3,4})$/;
  let safeOutput = [];
  let toastTimer;

  function luhnCheck(number) {
    let sum = 0;
    let shouldDouble = false;

    for (let index = number.length - 1; index >= 0; index -= 1) {
      let digit = Number(number[index]);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
  }

  function maskNumber(number) {
    const hiddenLength = Math.max(1, number.length - 8);
    return `${number.slice(0, 4)}${'*'.repeat(hiddenLength)}${number.slice(-4)}`;
  }

  function pluralize(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function updateCharCount() {
    const count = sourceText.value.length;
    charCount.textContent = `${count.toLocaleString('ru-RU')} ${pluralize(count, 'символ', 'символа', 'символов')}`;
  }

  function makeResultRow(item) {
    const row = document.createElement('div');
    row.className = 'result-row';

    const main = document.createElement('div');
    main.className = 'result-main';

    const value = document.createElement('span');
    value.className = 'result-value';
    value.textContent = `${item.masked}|${item.month}|${item.year}|[удалено]`;

    const sub = document.createElement('span');
    sub.className = 'result-sub';
    sub.textContent = `Строка ${item.lineNumber} · формат и Луна подтверждены`;

    const badge = document.createElement('span');
    badge.className = 'result-badge';
    badge.textContent = 'SAFE';

    main.append(value, sub);
    row.append(main, badge);
    return row;
  }

  function renderResults(results, errors) {
    resultList.replaceChildren();
    if (results.length === 0) {
      resultList.append(emptyState);
    } else {
      const fragment = document.createDocumentFragment();
      results.forEach((item) => fragment.append(makeResultRow(item)));
      resultList.append(fragment);
    }

    errorList.replaceChildren();
    if (errors.length > 0) {
      const title = document.createElement('strong');
      title.textContent = 'Строки, требующие внимания';
      errorList.append(title);
      errors.slice(0, 8).forEach((error) => {
        const item = document.createElement('span');
        item.className = 'error-item';
        item.textContent = `Строка ${error.lineNumber}: ${error.reason}`;
        errorList.append(item);
      });
      if (errors.length > 8) {
        const more = document.createElement('span');
        more.className = 'error-item';
        more.textContent = `И ещё ${errors.length - 8} ${pluralize(errors.length - 8, 'строка', 'строки', 'строк')} без подробностей.`;
        errorList.append(more);
      }
      errorList.hidden = false;
    } else {
      errorList.hidden = true;
    }
  }

  function processInput() {
    const rawText = sourceText.value;
    if (!rawText.trim()) {
      safeOutput = [];
      matchedCount.textContent = '0';
      validCount.textContent = '0';
      errorCount.textContent = '0';
      renderResults([], []);
      copyButton.disabled = true;
      showToast('Сначала вставьте тестовые строки.');
      return;
    }

    const results = [];
    const errors = [];
    let matched = 0;

    rawText.split(/\r?\n/).forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line) return;

      const match = recordPattern.exec(line);
      if (!match) {
        errors.push({ lineNumber: index + 1, reason: 'не совпадает с форматом номер|MM|YY|CVV' });
        return;
      }

      matched += 1;
      const [, number, month, year] = match;
      if (!luhnCheck(number)) {
        errors.push({ lineNumber: index + 1, reason: 'номер не прошёл проверку Луна' });
        return;
      }

      results.push({
        lineNumber: index + 1,
        masked: maskNumber(number),
        month,
        year,
      });
    });

    safeOutput = results.map((item) => `${item.masked}|${item.month}|${item.year}|[удалено]`);
    matchedCount.textContent = String(matched);
    validCount.textContent = String(results.length);
    errorCount.textContent = String(errors.length);
    copyButton.disabled = results.length === 0;
    renderResults(results, errors);

    if (results.length > 0) {
      showToast(`Готово: ${results.length} безопасных ${pluralize(results.length, 'результат', 'результата', 'результатов')}.`);
    } else {
      showToast('Подходящих тестовых строк не найдено.');
    }
  }

  function clearAll() {
    sourceText.value = '';
    safeOutput = [];
    matchedCount.textContent = '0';
    validCount.textContent = '0';
    errorCount.textContent = '0';
    copyButton.disabled = true;
    errorList.hidden = true;
    renderResults([], []);
    updateCharCount();
    sourceText.focus();
    showToast('Поле и результаты очищены.');
  }

  async function copySafeOutput() {
    if (safeOutput.length === 0) return;
    try {
      await navigator.clipboard.writeText(safeOutput.join('\n'));
      showToast('Скопирован только безопасный результат.');
    } catch {
      showToast('Не удалось скопировать. Разрешите доступ к буферу обмена.');
    }
  }

  sourceText.addEventListener('input', updateCharCount);
  processButton.addEventListener('click', processInput);
  clearButton.addEventListener('click', clearAll);
  copyButton.addEventListener('click', copySafeOutput);

  updateCharCount();
})();
