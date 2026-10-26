(() => {
  'use strict';

  const sourceText = document.querySelector('#sourceText');
  const processButton = document.querySelector('#processButton');
  const clearButton = document.querySelector('#clearButton');
  const copyButton = document.querySelector('#copyButton');
  const fileInput = document.querySelector('#fileInput');
  const fileButton = document.querySelector('#fileButton');
  const fileName = document.querySelector('#fileName');
  const resultList = document.querySelector('#resultList');
  const emptyState = document.querySelector('#emptyState');
  const errorList = document.querySelector('#errorList');
  const charCount = document.querySelector('#charCount');
  const matchedCount = document.querySelector('#matchedCount');
  const validCount = document.querySelector('#validCount');
  const errorCount = document.querySelector('#errorCount');
  const toast = document.querySelector('#toast');

  const recordPattern = /(?<!\d)(\d{13,19})\|(0[1-9]|1[0-2])\|(\d{2}|\d{4})\|(\d{3,4})(?!\d)/g;
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
    sub.textContent = item.valid
      ? `Строка ${item.lineNumber} · формат и Луна подтверждены`
      : `Строка ${item.lineNumber} · формат найден, Луна не пройдена`;

    const badge = document.createElement('span');
    badge.className = `result-badge${item.valid ? '' : ' result-badge-warn'}`;
    badge.textContent = item.valid ? 'SAFE' : 'CHECK';

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
    let match;

    while ((match = recordPattern.exec(rawText)) !== null) {
      matched += 1;
      const [, number, month, year] = match;
      const lineNumber = rawText.slice(0, match.index).split(/\r?\n/).length;

      const valid = luhnCheck(number);
      if (!valid) {
        errors.push({ lineNumber, reason: 'номер не прошёл проверку Луна' });
      }

      results.push({
        lineNumber,
        masked: maskNumber(number),
        month,
        year,
        valid,
      });
    }

    recordPattern.lastIndex = 0;

    safeOutput = results.map((item) => `${item.masked}|${item.month}|${item.year}|[удалено]`);
    matchedCount.textContent = String(matched);
    validCount.textContent = String(results.filter((item) => item.valid).length);
    errorCount.textContent = String(errors.length);
    copyButton.disabled = safeOutput.length === 0;
    renderResults(results, errors);

    if (results.length > 0) {
      showToast(`Найдено ${results.length} ${pluralize(results.length, 'совпадение', 'совпадения', 'совпадений')}.`);
    } else {
      showToast('Подходящих тестовых строк не найдено.');
    }
  }

  function clearAll() {
    sourceText.value = '';
    fileName.textContent = 'TXT / CSV / JSON до 5 МБ';
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

  async function loadLocalFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Файл слишком большой: максимум 5 МБ.');
      return;
    }

    try {
      sourceText.value = await file.text();
      fileName.textContent = file.name;
      updateCharCount();
      showToast(`Файл «${file.name}» загружен локально.`);
    } catch {
      showToast('Не удалось прочитать текстовый файл.');
    }
  }

  sourceText.addEventListener('input', updateCharCount);
  processButton.addEventListener('click', processInput);
  clearButton.addEventListener('click', clearAll);
  copyButton.addEventListener('click', copySafeOutput);
  fileButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    loadLocalFile(fileInput.files?.[0]);
    fileInput.value = '';
  });

  updateCharCount();
})();
