// --- Tab Switching ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// --- Status Tab ---
const $refresh = document.getElementById('btn-refresh');
const $sysPlatform = document.getElementById('sys-platform');
const $sysArch = document.getElementById('sys-arch');
const $sysHome = document.getElementById('sys-home');
const $depNode = document.getElementById('dep-node');
const $depNpm = document.getElementById('dep-npm');
const $depPython = document.getElementById('dep-python');
const $fwOpenclaw = document.getElementById('fw-openclaw');
const $fwHermes = document.getElementById('fw-hermes');

const NOT_INSTALLED = '未安装';

async function refreshStatus() {
  $refresh.disabled = true;
  $refresh.textContent = '加载中...';

  try {
    const system = await window.electronAPI.invoke('system:get-status');
    $sysPlatform.textContent = system.platform;
    $sysArch.textContent = system.architecture;
    $sysHome.textContent = system.home;

    $depNode.textContent = system.node.installed
      ? `${system.node.version}`
      : NOT_INSTALLED;
    $depNode.style.color = system.node.installed ? 'var(--success)' : 'var(--danger)';

    $depNpm.textContent = system.npm.installed
      ? `${system.npm.version}`
      : NOT_INSTALLED;
    $depNpm.style.color = system.npm.installed ? 'var(--success)' : 'var(--danger)';

    $depPython.textContent = system.python.installed
      ? `${system.python.version}`
      : NOT_INSTALLED;
    $depPython.style.color = system.python.installed ? 'var(--success)' : 'var(--danger)';

    const fw = system.frameworks;
    $fwOpenclaw.textContent = fw.openclaw.installed ? '已安装' : '未安装';
    $fwOpenclaw.style.color = fw.openclaw.installed ? 'var(--success)' : 'var(--danger)';

    $fwHermes.textContent = fw.hermes.installed ? '已安装' : '未安装';
    $fwHermes.style.color = fw.hermes.installed ? 'var(--success)' : 'var(--danger)';
  } catch (err) {
    console.error('Failed to get status:', err);
  }

  $refresh.disabled = false;
  $refresh.textContent = '刷新状态';
}

$refresh.addEventListener('click', refreshStatus);

// --- Utility: Append to log ---
function appendLog(logEl, text, isError) {
  const existing = logEl.querySelector('.log-placeholder');
  if (existing) existing.remove();

  const lines = text.split('\n');
  lines.forEach(line => {
    if (!line.trim()) return;
    const div = document.createElement('div');
    div.className = 'log-line' + (isError ? ' log-error' : '');
    div.textContent = line;
    logEl.appendChild(div);
  });
  logEl.scrollTop = logEl.scrollHeight;
}

function markSuccess(logEl) {
  const div = document.createElement('div');
  div.className = 'log-success';
  div.textContent = '\n完成！';
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

// --- Export Tab ---
const $expOutput = document.getElementById('exp-output-path');
const $btnExpPick = document.getElementById('btn-exp-pick');
const $btnExport = document.getElementById('btn-export');
const $expLog = document.getElementById('exp-log');
const $expFwOpenclaw = document.getElementById('exp-fw-openclaw');
const $expFwHermes = document.getElementById('exp-fw-hermes');

$btnExpPick.addEventListener('click', async () => {
  const filePath = await window.electronAPI.invoke('file:pick-export');
  if (filePath) $expOutput.value = filePath;
});

$btnExport.addEventListener('click', () => {
  const outputPath = $expOutput.value || null;
  const frameworks = {
    openclaw: $expFwOpenclaw.checked,
    hermes: $expFwHermes.checked,
  };

  if (!frameworks.openclaw && !frameworks.hermes) {
    appendLog($expLog, '错误：请至少选择一个框架。', true);
    return;
  }

  $btnExport.disabled = true;
  $expLog.innerHTML = '';

  const removeOutput = window.electronAPI.on('action:export-output', (text) => {
    appendLog($expLog, text, false);
  });

  const removeDone = window.electronAPI.on('action:export-done', (result) => {
    if (result.success) {
      markSuccess($expLog);
    } else {
      appendLog($expLog, `进程退出，代码 ${result.code}`, true);
    }
    $btnExport.disabled = false;
    removeOutput();
    removeDone();
  });

  window.electronAPI.send('action:export', {
    outputPath,
    frameworks,
  });
});

// --- Import Tab ---
const $impFilePath = document.getElementById('imp-file-path');
const $btnImpPick = document.getElementById('btn-imp-pick');
const $btnImport = document.getElementById('btn-import');
const $impLog = document.getElementById('imp-log');
const $impForce = document.getElementById('imp-force');
const $impAutoInstall = document.getElementById('imp-auto-install');
const $impFwOpenclaw = document.getElementById('imp-fw-openclaw');
const $impFwHermes = document.getElementById('imp-fw-hermes');

$btnImpPick.addEventListener('click', async () => {
  const filePath = await window.electronAPI.invoke('file:pick-import');
  if (filePath) $impFilePath.value = filePath;
});

$btnImport.addEventListener('click', () => {
  const filePath = $impFilePath.value;
  if (!filePath) {
    appendLog($impLog, '错误：请选择迁移文件。', true);
    return;
  }

  const frameworks = {
    openclaw: $impFwOpenclaw.checked,
    hermes: $impFwHermes.checked,
  };

  if (!frameworks.openclaw && !frameworks.hermes) {
    appendLog($impLog, '错误：请至少选择一个框架。', true);
    return;
  }

  $btnImport.disabled = true;
  $impLog.innerHTML = '';

  const removeOutput = window.electronAPI.on('action:import-output', (text) => {
    appendLog($impLog, text, false);
  });

  const removeDone = window.electronAPI.on('action:import-done', (result) => {
    if (result.success) {
      markSuccess($impLog);
    } else {
      appendLog($impLog, `进程退出，代码 ${result.code}`, true);
    }
    $btnImport.disabled = false;
    removeOutput();
    removeDone();
  });

  window.electronAPI.send('action:import', {
    filePath,
    force: $impForce.checked,
    autoInstall: $impAutoInstall.checked,
    frameworks,
  });
});

// --- Footer Version ---
window.electronAPI.invoke('app:get-version').then(v => {
  document.getElementById('footer-version').textContent = v.tool;
});

// --- Initial Status Load ---
refreshStatus();
