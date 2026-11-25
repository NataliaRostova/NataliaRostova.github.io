const STORAGE_KEY = 'natalia-finance-portfolio-v1';

// Embedded fallback mirrors portfolio.json so double-clicking index.html via file:// works offline too.
let DEFAULT_DATA = null;

const CAPABILITIES = [
  {
    code: '01 / CORE FINANCE',
    title: '金融与核心课程基础',
    desc: '计量经济学、商业银行业务与经营、财务管理、线性代数、期货与衍生品实务、商务英语（南京农业大学 211 · 投资学 2028 届）。'
  },
  {
    code: '02 / QUANT & DATA',
    title: '量化分析与数据工程',
    desc: '熟练使用 Python（Pandas / NumPy / Matplotlib / SciPy / Scikit-learn）开展回测、风控建模与可视化；精通 Excel 函数建模与透视表、Git 版本控制。'
  },
  {
    code: '03 / FINTECH & LLM',
    title: 'AI 工作流与前端可视化',
    desc: '熟悉 DeepSeek / Gemini API 结构化研报抽取与清洗流水线；具备原生 HTML5 / CSS3 / ES6 Canvas 交互式数值计算与可视化工具开发能力。'
  },
  {
    code: '04 / LANGUAGES & DELIVERY',
    title: '跨语言与独立履约能力',
    desc: '日语 JLPT N1（118 分，可流利阅读日文研报与跨境业务沟通）；英语 CET-6（530 分，无障碍阅读英文财报与文献）；累计 200+ 课时独立学科教学交付。'
  }
];

const root = document.querySelector('#app');
let data = null;
let managing = false;
let category = '全部';
let query = '';
let loadError = '';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function safeUrl(value, image = false) {
  if (!value) return '';
  if (image && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  if (/^(assets|demo)\/[a-z0-9._/-]+$/i.test(value)) return value;
  if (/^\/(?!\/)/.test(value)) return value;
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}

function validate(value) {
  if (!value || value.version !== 1 || !value.profile || !Array.isArray(value.projects) || value.projects.length > 200) {
    throw new Error('内容格式不正确，最多支持 200 个项目。');
  }
  for (const key of ['name', 'role', 'headline', 'bio', 'about', 'email', 'github']) {
    if (typeof value.profile[key] !== 'string') throw new Error('个人资料格式不正确。');
  }
  if (!value.profile.name.trim() || !value.profile.headline.trim()) {
    throw new Error('名称和首页标题不能为空。');
  }
  const ids = new Set();
  for (const p of value.projects) {
    for (const key of ['id', 'title', 'category', 'year', 'summary', 'description', 'tags', 'image', 'url', 'source']) {
      if (typeof p[key] !== 'string') throw new Error('项目字段格式不正确。');
    }
    if (!p.id || ids.has(p.id) || !p.title.trim() || !p.category.trim() || typeof p.featured !== 'boolean') {
      throw new Error('项目编号重复或缺少标题、分类。');
    }
    ids.add(p.id);
    for (const key of ['url', 'source', 'image']) {
      if (p[key] && !safeUrl(p[key], key === 'image')) {
        throw new Error('链接仅支持 HTTP、HTTPS 或站内相对路径。');
      }
    }
  }
  return structuredClone(value);
}

const renderTags = (p) =>
  p.tags
    .split(/[,，]/)
    .filter(Boolean)
    .map((t) => `<span>${esc(t.trim())}</span>`)
    .join('');

const renderMetrics = (p) =>
  Array.isArray(p.metrics) && p.metrics.length
    ? `<div class="metric-strip">${p.metrics.map((m) => `<span>${esc(m)}</span>`).join('')}</div>`
    : '';

function notify(message) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  clearTimeout(notify._timer);
  notify._timer = setTimeout(() => {
    toast.textContent = '';
  }, 4000);
}

function persist(next) {
  try {
    const checked = validate(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    data = checked;
    render();
    notify('已保存到当前浏览器');
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : '保存失败';
    const errEl = document.querySelector('#form-error');
    if (errEl) errEl.textContent = msg;
    else notify(msg);
    return false;
  }
}

function render() {
  const p = data.profile;
  const categories = ['全部', ...new Set(data.projects.map((item) => item.category))];
  if (!categories.includes(category)) category = '全部';

  root.innerHTML = `
  <header>
    <a class="wordmark" href="#">
      <span class="mark">✳</span>
      <span>${esc(p.name)}<small>QUANTITATIVE &amp; FINTECH ARCHIVE</small></span>
    </a>
    <nav>
      <a href="#projects">项目档案 <sup>${String(data.projects.length).padStart(2, '0')}</sup></a>
      <a href="#capabilities">能力矩阵</a>
      <a href="#about">关于</a>
      <a class="nav-pill" href="demo/optimizer.html">在线模拟器 ↗</a>
      <button id="manage" class="nav-manage">${managing ? '退出管理 ↗' : '内容管理 ↗'}</button>
    </nav>
  </header>

  ${
    managing
      ? `<aside class="managebar">
          <div>
            <b>内容管理（RhineLab Archive CMS）</b>
            <span>修改存于当前浏览器 localStorage · 导出 portfolio.json 可直接同步发布</span>
          </div>
          <div class="actions">
            <button data-action="profile">编辑个人资料</button>
            <button data-action="export">导出 JSON</button>
            <button data-action="import">导入 JSON</button>
            <button data-action="reset">恢复默认档案</button>
            <button data-action="new" class="dark">＋ 新增项目</button>
          </div>
        </aside>`
      : ''
  }

  <main>
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow"><i></i> NJAU (211) · INVESTMENT '28 · NANJING, CHINA</p>
        <h1>${esc(p.headline).replace(/\n/g, '<br>')}</h1>
        <p class="bio">${esc(p.bio)}</p>

        <div class="hero-kpis">
          <div class="hero-kpi"><b>${String(data.projects.length).padStart(2, '0')} REPOS</b><span>可复现金融工程档案</span></div>
          <div class="hero-kpi"><b>N1 · CET-6</b><span>日语 118 / 英语 530</span></div>
          <div class="hero-kpi"><b>3–4 DAYS/W</b><span>南京卫岗 · 立即到岗</span></div>
        </div>

        <div class="hero-actions">
          <a class="hero-link" href="#projects">探索项目档案 <span>↘</span></a>
          <a class="hero-link secondary" href="demo/optimizer.html">二维最优解交互演示 <span>↗</span></a>
        </div>
      </div>

      <div class="hero-art">
        <span class="corner top"><span>FIG. 01 / FINANCIAL SYSTEMS ARCHIVE</span><span>ID: NATALIA-ROSTOVA</span></span>
        <div class="art-grid"></div>
        <img src="assets/hero-assembly.jpg" alt="RhineLab 几何档案结构视觉" />
        <span class="art-label">QUANT.<br>RISK.<br>FINTECH.</span>
        <span class="corner bottom"><span>DERIVATIVES · QDII · SCORECARD · LLM</span><b>＋</b></span>
      </div>
    </section>

    <section id="projects">
      <div class="section-heading">
        <div>
          <p class="eyebrow">SELECTED WORKS / 项目档案</p>
          <h2>研究与工程的不同形态<span>(${String(data.projects.length).padStart(2, '0')})</span></h2>
        </div>
        <p>点击任意卡片可浏览完整实证图表、策略指标与源码入口。</p>
      </div>

      <div class="filterbar">
        <div class="filters">
          ${categories
            .map(
              (c) =>
                `<button data-category="${esc(c)}" aria-pressed="${c === category}" class="${
                  c === category ? 'active' : ''
                }">${esc(c)}</button>`
            )
            .join('')}
        </div>
        <label class="search">⌕ <input id="search" type="search" placeholder="搜索项目、策略、技术栈…" aria-label="搜索项目" value="${esc(
          query
        )}" /></label>
      </div>

      <div id="cards" class="cards"></div>
    </section>

    <section id="capabilities">
      <div class="section-heading">
        <div>
          <p class="eyebrow">COMPETENCY MATRIX / 专业能力矩阵</p>
          <h2>金融理论与工程落地<span>(04)</span></h2>
        </div>
        <p>面向南京金融数据分析、金融科技与衍生品投研支持实习岗位。</p>
      </div>
      <div class="cap-grid">
        ${CAPABILITIES.map(
          (c) => `
          <div class="cap-cell">
            <span class="cap-num">${esc(c.code)}</span>
            <h3>${esc(c.title)}</h3>
            <p>${esc(c.desc)}</p>
          </div>`
        ).join('')}
      </div>
    </section>

    <section id="about" class="about">
      <div>
        <p class="eyebrow">BEHIND THE ARCHIVE</p>
        <h2>关于我<span class="orange">↗</span></h2>
      </div>
      <div>
        <h3>${esc(p.role)}</h3>
        <p>${esc(p.about)}</p>
        <div class="contact">
          ${p.email ? `<a href="mailto:${esc(p.email)}">邮箱联系 (${esc(p.email)}) ↗</a>` : ''}
          ${p.github ? `<a href="${esc(safeUrl(p.github))}" target="_blank" rel="noopener noreferrer">GitHub 主页 ↗</a>` : ''}
          <a href="demo/optimizer.html">在线二维寻优模拟器 ↗</a>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <span>© ${new Date().getFullYear()} ${esc(p.name)} · NATALIAROSTOVA</span>
    <span>INSPIRED BY RHINELAB ARCHIVE OS <i>✳</i></span>
    <a href="#">回到顶部 ↑</a>
  </footer>

  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="modal"></dialog>
  <input type="file" id="import-file" accept="application/json,.json" hidden />
  `;

  renderCards();

  document.querySelector('#manage').addEventListener('click', () => {
    managing = !managing;
    render();
  });
  document.querySelector('#search').addEventListener('input', (e) => {
    query = e.target.value;
    renderCards();
  });
  document.querySelectorAll('[data-category]').forEach((b) => {
    b.onclick = () => {
      category = b.dataset.category;
      render();
    };
  });
  document.querySelectorAll('[data-action]').forEach((b) => {
    b.onclick = () => {
      const act = b.dataset.action;
      if (act === 'new') editProject();
      if (act === 'profile') editProfile();
      if (act === 'reset') {
        localStorage.removeItem(STORAGE_KEY);
        data = validate(DEFAULT_DATA);
        render();
        notify('已恢复默认项目档案');
      }
      if (act === 'export') {
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'portfolio.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notify('已导出 portfolio.json');
      }
      if (act === 'import') document.querySelector('#import-file').click();
    };
  });

  document.querySelector('#import-file').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = validate(JSON.parse(await file.text()));
      modal(
        `<h2>导入内容</h2><p>将替换当前个人资料与 ${data.projects.length} 个项目，导入 ${imported.projects.length} 个项目。</p><button id="confirm-import" class="dark">确认替换</button>`
      );
      document.querySelector('#confirm-import').onclick = () => persist(imported);
    } catch (err) {
      notify(`导入失败：${err.message}`);
    }
  };
}

function renderCards() {
  const q = query.trim().toLowerCase();
  const filtered = data.projects.filter((p) => {
    const matchCat = category === '全部' || p.category === category;
    const blob = `${p.title} ${p.summary} ${p.tags} ${(p.metrics || []).join(' ')}`.toLowerCase();
    return matchCat && (!q || blob.includes(q));
  });

  const container = document.querySelector('#cards');
  container.innerHTML = filtered.length
    ? filtered
        .map((p) => {
          const idx = String(data.projects.indexOf(p) + 1).padStart(2, '0');
          const imgSrc = safeUrl(p.image, true) || 'assets/archive-cover.jpg';
          return `
          <article class="card">
            <button class="cover" data-open="${esc(p.id)}" aria-label="查看 ${esc(p.title)}">
              <img src="${esc(imgSrc)}" alt="${esc(p.title)}" loading="lazy" />
              <span class="cover-index">${esc(p.code || idx)} / ${esc(p.category)}</span>
              ${p.featured ? '<span class="featured">✳ 核心项目</span>' : ''}
              <span class="open-arrow">↗</span>
            </button>
            <div class="card-meta"><span>${esc(p.category)}</span><span>${esc(p.year)}</span></div>
            <button class="card-title" data-open="${esc(p.id)}">${esc(p.title)}</button>
            <p>${esc(p.summary)}</p>
            ${renderMetrics(p)}
            <div class="tags">${renderTags(p)}</div>
            <div class="card-links">
              <button class="text-link" data-open="${esc(p.id)}">查看详情与图表 ↗</button>
              ${p.source ? `<a href="${esc(safeUrl(p.source))}" target="_blank" rel="noopener noreferrer">GitHub 源码 ↗</a>` : ''}
            </div>
            ${
              managing
                ? `<div class="edit-actions"><button data-edit="${esc(p.id)}">编辑项目</button><button data-delete="${esc(
                    p.id
                  )}">删除</button></div>`
                : ''
            }
          </article>`;
        })
        .join('')
    : `<div class="empty"><h3>${data.projects.length ? '没有找到匹配的项目' : '暂无项目档案'}</h3><p>试试切换分类或清除搜索关键词。</p></div>`;

  document.querySelectorAll('.cover img').forEach((img) => {
    img.onerror = () => {
      img.onerror = null;
      img.src = 'assets/archive-cover.jpg';
    };
  });
  document.querySelectorAll('[data-open]').forEach((b) => {
    b.onclick = () => detail(data.projects.find((item) => item.id === b.dataset.open));
  });
  document.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => editProject(data.projects.find((item) => item.id === b.dataset.edit));
  });
  document.querySelectorAll('[data-delete]').forEach((b) => {
    b.onclick = () => {
      const target = data.projects.find((item) => item.id === b.dataset.delete);
      modal(
        `<p class="eyebrow">DELETE PROJECT</p><h2>删除这个项目？</h2><p>「${esc(target.title)}」将从当前浏览器的展示列表中移除。</p><button class="danger" id="confirm-delete">确认删除</button>`
      );
      document.querySelector('#confirm-delete').onclick = () =>
        persist({ ...data, projects: data.projects.filter((x) => x.id !== target.id) });
    };
  });
}

function modal(html) {
  const dialog = document.querySelector('#modal');
  dialog.innerHTML = `<button class="close" aria-label="关闭">×</button>${html}`;
  dialog.querySelector('.close').onclick = () => dialog.close();
  dialog.onclick = (e) => {
    if (e.target === dialog) dialog.close();
  };
  dialog.showModal();
}

function detail(p) {
  if (!p) return;
  const gallery =
    Array.isArray(p.gallery) && p.gallery.length
      ? p.gallery
      : [{ src: safeUrl(p.image, true) || 'assets/archive-cover.jpg', caption: p.title }];

  const isLocalDemo = p.url && !/^https?:\/\//i.test(p.url);
  const urlAttr = isLocalDemo ? '' : 'target="_blank" rel="noopener noreferrer"';
  const urlLabel = isLocalDemo ? '打开在线交互演示 ↗' : '查看完整分析报告 ↗';

  modal(`
    <p class="eyebrow">${esc(p.code || 'ARCHIVE')} / ${esc(p.category)} / ${esc(p.year)}</p>
    <h2>${esc(p.title)}</h2>
    <div class="detail-stage">
      <img id="stage-img" class="detail-image" src="${esc(safeUrl(gallery[0].src, true))}" alt="${esc(p.title)}" />
      <p id="stage-cap" class="detail-caption">${esc(gallery[0].caption || '')}</p>
    </div>
    ${
      gallery.length > 1
        ? `<div class="gallery-thumbs">${gallery
            .map(
              (g, i) =>
                `<button type="button" data-gidx="${i}" class="${i === 0 ? 'active' : ''}">图表 0${i + 1}</button>`
            )
            .join('')}</div>`
        : ''
    }
    ${renderMetrics(p)}
    <div class="tags" style="margin-top:10px;">${renderTags(p)}</div>
    <p class="description">${esc(p.description || p.summary)}</p>
    <div class="actions">
      ${p.url ? `<a class="button dark" href="${esc(safeUrl(p.url))}" ${urlAttr}>${urlLabel}</a>` : ''}
      ${
        p.source
          ? `<a class="button" href="${esc(safeUrl(p.source))}" target="_blank" rel="noopener noreferrer">查看 GitHub 源码 ↗</a>`
          : ''
      }
    </div>
  `);

  document.querySelectorAll('[data-gidx]').forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.gidx);
      document.querySelector('#stage-img').src = safeUrl(gallery[idx].src, true);
      document.querySelector('#stage-cap').textContent = gallery[idx].caption || '';
      document.querySelectorAll('[data-gidx]').forEach((x) => x.classList.remove('active'));
      btn.classList.add('active');
    };
  });
}

function field(label, key, value, multiline = false, required = false) {
  return `<label class="field">${label}${
    multiline
      ? `<textarea name="${key}" rows="3" ${required ? 'required' : ''}>${esc(value)}</textarea>`
      : `<input name="${key}" value="${esc(value)}" ${required ? 'required' : ''} />`
  }</label>`;
}

function editProject(existing) {
  const p = existing || {
    id: crypto.randomUUID(),
    code: `FIN-0${data.projects.length + 1}`,
    title: '',
    category: '衍生品与量化',
    year: String(new Date().getFullYear()),
    summary: '',
    description: '',
    tags: '',
    metrics: [],
    image: '',
    url: '',
    source: '',
    featured: false
  };
  modal(`
    <p class="eyebrow">PROJECT EDITOR</p>
    <h2>${existing ? '编辑项目档案' : '新增项目档案'}</h2>
    <form id="editor">
      <div class="form-grid">
        ${field('项目名称 *', 'title', p.title, false, true)}
        ${field('分类 *', 'category', p.category, false, true)}
        ${field('时间 / 年份', 'year', p.year)}
        ${field('技术标签（逗号分隔）', 'tags', p.tags)}
      </div>
      ${field('一句话介绍', 'summary', p.summary, true)}
      ${field('项目详情', 'description', p.description, true)}
      ${field('封面图片地址', 'image', p.image)}
      <label class="upload">或上传封面图片（PNG / JPEG / WebP，最大 1 MB）
        <input id="image-file" type="file" accept="image/png,image/jpeg,image/webp" />
      </label>
      <div class="form-grid">
        ${field('演示 / 报告链接', 'url', p.url)}
        ${field('GitHub 源码链接', 'source', p.source)}
      </div>
      <label class="checkbox"><input name="featured" type="checkbox" ${p.featured ? 'checked' : ''} /> 标记为核心项目</label>
      <p id="form-error" role="alert"></p>
      <div class="form-footer">
        <span>保存后立即更新页面</span>
        <button class="dark" type="submit">保存项目 ↗</button>
      </div>
    </form>
  `);

  const form = document.querySelector('#editor');
  document.querySelector('#image-file').onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const errEl = document.querySelector('#form-error');
    if (file.size > 1000000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      errEl.textContent = '请选择不超过 1 MB 的 PNG、JPEG 或 WebP 图片。';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      form.elements.namedItem('image').value = String(reader.result);
      errEl.textContent = '图片已载入，点击保存后生效。';
    };
    reader.readAsDataURL(file);
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const updated = { ...p, ...values, featured: values.featured === 'on' };
    const projects = existing ? data.projects.map((x) => (x.id === p.id ? updated : x)) : [...data.projects, updated];
    persist({ ...data, projects });
  };
}

function editProfile() {
  const p = data.profile;
  modal(`
    <p class="eyebrow">PROFILE EDITOR</p>
    <h2>编辑个人资料</h2>
    <form id="profile-editor">
      ${field('展示名称 *', 'name', p.name, false, true)}
      ${field('身份 / 求职方向', 'role', p.role)}
      ${field('首页标题 *（可换行）', 'headline', p.headline, true, true)}
      ${field('首页简介', 'bio', p.bio, true)}
      ${field('关于我', 'about', p.about, true)}
      ${field('联系邮箱', 'email', p.email)}
      ${field('GitHub 主页链接', 'github', p.github)}
      <p id="form-error" role="alert"></p>
      <button class="dark" type="submit">保存个人资料 ↗</button>
    </form>
  `);
  document.querySelector('#profile-editor').onsubmit = (e) => {
    e.preventDefault();
    const profile = Object.fromEntries(new FormData(e.target));
    persist({ ...data, profile });
  };
}

async function boot() {
  if (window.__DEFAULT_PORTFOLIO__) {
    DEFAULT_DATA = validate(window.__DEFAULT_PORTFOLIO__);
  }
  if (location.protocol.startsWith('http')) {
    try {
      const resp = await fetch('./portfolio.json');
      if (resp.ok) DEFAULT_DATA = validate(await resp.json());
    } catch {
      // Keep bundled fallback
    }
  }
  data = DEFAULT_DATA;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) data = validate(JSON.parse(saved));
  } catch {
    loadError = '本地草稿无法读取，已恢复默认项目档案。';
  }
  if (data) render();
  if (loadError) notify(loadError);
}

boot();
